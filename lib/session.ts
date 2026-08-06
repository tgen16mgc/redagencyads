import { cookies } from "next/headers";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureActiveWorkspaceMembership, getWorkspaceAuthMode } from "@/lib/workspace-session";

const COOKIE_NAME = "meta_ads_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export class SessionAuthError extends Error {}

export function sessionErrorStatus(error: unknown) {
  return error instanceof SessionAuthError ? 401 : 400;
}

type SessionPayload = {
  token: string;
  issuedAt: number;
  ownerId: string;
};

type StoredCredentialPayload = {
  token: string;
  ownerId: string;
  version: 1;
};

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for encrypted token sessions.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSession(token: string, ownerId: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const payload: SessionPayload = { token, issuedAt: Date.now(), ownerId };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSession(value: string) {
  try {
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const payload = JSON.parse(decrypted) as SessionPayload;
    if (Date.now() - payload.issuedAt > COOKIE_MAX_AGE_SECONDS * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function encryptStoredCredential(token: string, ownerId: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const payload: StoredCredentialPayload = { token, ownerId, version: 1 };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptStoredCredential(value: string) {
  try {
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const payload = JSON.parse(decrypted) as StoredCredentialPayload;
    return payload.version === 1 && payload.token && payload.ownerId ? payload : null;
  } catch {
    return null;
  }
}

async function currentWorkspaceContext() {
  const mode = getWorkspaceAuthMode();
  if (mode === "disabled") return { ownerId: "development:local@redagency.vn", workspaceId: null, supabase: null };
  if (mode === "unconfigured") return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const membership = await ensureActiveWorkspaceMembership(supabase, data.user.id);
  if (!membership) return null;
  return { ownerId: data.user.id, workspaceId: membership.workspace_id, supabase };
}

export async function setTokenCookie(token: string) {
  const context = await currentWorkspaceContext();
  if (!context) throw new SessionAuthError("Sign in to the workspace before connecting Meta.");
  const store = await cookies();
  store.set(COOKIE_NAME, encryptSession(token, context.ownerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  if (context.supabase && context.workspaceId) {
    const { error } = await context.supabase.from("workspace_connector_credentials").upsert({
      workspace_id: context.workspaceId,
      user_id: context.ownerId,
      provider: "meta",
      encrypted_token: encryptStoredCredential(token, context.ownerId),
      last_validated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (error) throw new Error("Meta connected, but the account credential could not be saved.");
  }
}

export async function clearTokenCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  const context = await currentWorkspaceContext();
  if (context?.supabase) {
    const { error } = await context.supabase
      .from("workspace_connector_credentials")
      .delete()
      .eq("user_id", context.ownerId)
      .eq("provider", "meta");
    if (error) throw new Error("The saved Meta credential could not be removed.");
  }
}

export async function requireToken() {
  const context = await currentWorkspaceContext();
  if (!context) throw new SessionAuthError("Sign in to the workspace before using Meta.");
  const store = await cookies();
  const encrypted = store.get(COOKIE_NAME)?.value;
  const payload = encrypted ? decryptSession(encrypted) : null;
  if (payload?.ownerId === context.ownerId) return payload.token;

  if (!context.supabase) throw new SessionAuthError(encrypted ? "Meta access token session expired." : "Meta access token session missing.");
  const { data, error } = await context.supabase
    .from("workspace_connector_credentials")
    .select("encrypted_token,token_expires_at")
    .eq("user_id", context.ownerId)
    .eq("provider", "meta")
    .maybeSingle();
  if (error || !data) throw new SessionAuthError("Meta access token session missing.");
  if (data.token_expires_at && Date.parse(data.token_expires_at) <= Date.now()) {
    throw new SessionAuthError("The saved Meta token has expired. Reconnect Meta to continue.");
  }
  const stored = decryptStoredCredential(data.encrypted_token);
  if (!stored || stored.ownerId !== context.ownerId) throw new SessionAuthError("The saved Meta credential could not be restored.");
  return stored.token;
}

export async function hasTokenSession() {
  try {
    await requireToken();
    return true;
  } catch {
    return false;
  }
}
