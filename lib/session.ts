import { cookies } from "next/headers";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceAuthMode } from "@/lib/workspace-session";

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

async function currentWorkspaceOwnerId() {
  const mode = getWorkspaceAuthMode();
  if (mode === "disabled") return "development:local@redagency.vn";
  if (mode === "unconfigured") return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

export async function setTokenCookie(token: string) {
  const ownerId = await currentWorkspaceOwnerId();
  if (!ownerId) throw new SessionAuthError("Sign in to the workspace before connecting Meta.");
  const store = await cookies();
  store.set(COOKIE_NAME, encryptSession(token, ownerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearTokenCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function requireToken() {
  const store = await cookies();
  const encrypted = store.get(COOKIE_NAME)?.value;
  if (!encrypted) throw new SessionAuthError("Meta access token session missing.");
  const payload = decryptSession(encrypted);
  if (!payload) throw new SessionAuthError("Meta access token session expired.");
  const ownerId = await currentWorkspaceOwnerId();
  if (!ownerId) throw new SessionAuthError("Sign in to the workspace before using Meta.");
  if (payload.ownerId !== ownerId) throw new SessionAuthError("Meta connection belongs to another workspace account.");
  return payload.token;
}

export async function hasTokenSession() {
  try {
    await requireToken();
    return true;
  } catch {
    return false;
  }
}
