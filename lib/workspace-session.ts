import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "decision_workspace_session";
const STANDARD_MAX_AGE_SECONDS = 60 * 60 * 12;
const REMEMBERED_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type WorkspaceAuthMode = "disabled" | "credentials" | "unconfigured";

export type WorkspaceUser = {
  email: string;
  name: string;
  role: string;
  initials: string;
};

type WorkspaceSessionPayload = WorkspaceUser & {
  issuedAt: number;
  expiresAt: number;
};

export type WorkspaceAuthConfig = {
  mode: WorkspaceAuthMode;
  configured: boolean;
  email: string;
  name: string;
  role: string;
  initials: string;
  googleAuthUrl: string;
  resetConfigured: boolean;
  accessRequestConfigured: boolean;
};

function normalizedEmail(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

function sessionSecret() {
  return process.env.WORKSPACE_SESSION_SECRET || process.env.SESSION_SECRET || "";
}

export function hashWorkspacePassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyWorkspacePassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqual(candidate, expected);
}

export function getWorkspaceAuthMode(): WorkspaceAuthMode {
  const requestedMode = process.env.WORKSPACE_AUTH_MODE?.trim().toLowerCase();
  if (requestedMode === "disabled") return "disabled";
  const hasIdentity = Boolean(normalizedEmail(process.env.WORKSPACE_AUTH_EMAIL) && process.env.WORKSPACE_AUTH_PASSWORD_HASH?.trim() && sessionSecret());
  if (hasIdentity) return "credentials";
  if (requestedMode === "credentials" || process.env.NODE_ENV === "production") return "unconfigured";
  return "disabled";
}

export function getWorkspaceUser(): WorkspaceUser | null {
  const email = normalizedEmail(process.env.WORKSPACE_AUTH_EMAIL);
  if (!email || !process.env.WORKSPACE_AUTH_PASSWORD_HASH?.trim()) return null;
  const name = process.env.WORKSPACE_AUTH_NAME?.trim() || "Tien Duong";
  return {
    email,
    name,
    role: process.env.WORKSPACE_AUTH_ROLE?.trim() || "Workspace owner",
    initials: name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "DW",
  };
}

export async function authenticateWorkspace(email: string, password: string) {
  const user = getWorkspaceUser();
  const encoded = process.env.WORKSPACE_AUTH_PASSWORD_HASH?.trim() || "";
  if (!user || !safeEqual(normalizedEmail(email), user.email) || !verifyWorkspacePassword(password, encoded)) {
    throw new Error("Email or password does not match. Check your details and try again.");
  }
  return user;
}

function getKey() {
  const secret = sessionSecret();
  if (!secret) throw new Error("WORKSPACE_SESSION_SECRET or SESSION_SECRET is required for workspace authentication.");
  return crypto.createHash("sha256").update(`workspace:${secret}`).digest();
}

export function getWorkspaceAuthConfig(): WorkspaceAuthConfig {
  const mode = getWorkspaceAuthMode();
  const user = getWorkspaceUser();
  const name = user?.name || process.env.WORKSPACE_AUTH_NAME?.trim() || "Tien Duong";
  return {
    mode,
    configured: mode !== "unconfigured",
    email: user?.email || "",
    name,
    role: user?.role || process.env.WORKSPACE_AUTH_ROLE?.trim() || "Workspace owner",
    initials: user?.initials || "DW",
    googleAuthUrl: process.env.WORKSPACE_GOOGLE_AUTH_URL?.trim() || "",
    resetConfigured: Boolean(process.env.WORKSPACE_RESET_WEBHOOK_URL),
    accessRequestConfigured: Boolean(process.env.WORKSPACE_ACCESS_WEBHOOK_URL),
  };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateWorkspaceCredentials(email: string, password: string) {
  const user = getWorkspaceUser();
  const encoded = process.env.WORKSPACE_AUTH_PASSWORD_HASH?.trim() || "";
  return Boolean(user && safeEqual(normalizedEmail(email), user.email) && verifyWorkspacePassword(password, encoded));
}

export function encryptWorkspaceSession(user: WorkspaceUser, remember: boolean, now = Date.now()) {
  const maxAge = remember ? REMEMBERED_MAX_AGE_SECONDS : STANDARD_MAX_AGE_SECONDS;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const payload: WorkspaceSessionPayload = {
    ...user,
    issuedAt: now,
    expiresAt: now + maxAge * 1000,
  };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decryptWorkspaceSession(value: string, now = Date.now()): WorkspaceSessionPayload | null {
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length < 29) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const decrypted = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const payload = JSON.parse(decrypted) as WorkspaceSessionPayload;
    if (!payload.email || !payload.name || !payload.role || payload.expiresAt <= now) return null;
    return { ...payload, initials: payload.initials || payload.name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "DW" };
  } catch {
    return null;
  }
}

export async function setWorkspaceSession(remember: boolean) {
  const user = getWorkspaceUser();
  if (!user) throw new Error("Workspace authentication is not fully configured.");
  const encrypted = encryptWorkspaceSession(user, remember);
  const maxAge = remember ? REMEMBERED_MAX_AGE_SECONDS : STANDARD_MAX_AGE_SECONDS;
  const store = await cookies();
  store.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
}

export async function clearWorkspaceSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getWorkspaceSession() {
  const config = getWorkspaceAuthConfig();
  if (config.mode === "disabled") {
    return {
      email: config.email || "tien@redagency.vn",
      name: config.name,
      role: config.role,
      initials: config.initials,
      issuedAt: Date.now(),
      expiresAt: Number.MAX_SAFE_INTEGER,
    } satisfies WorkspaceSessionPayload;
  }
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return value ? decryptWorkspaceSession(value) : null;
}

export async function workspaceSessionStatus() {
  const config = getWorkspaceAuthConfig();
  const session = await getWorkspaceSession();
  return {
    required: config.mode !== "disabled",
    configured: config.configured,
    authenticated: Boolean(session),
    googleConfigured: Boolean(config.googleAuthUrl),
    googleAuthUrl: config.googleAuthUrl || null,
    resetConfigured: config.resetConfigured,
    accessRequestConfigured: config.accessRequestConfigured,
    signedInAt: config.mode === "disabled" ? null : session?.issuedAt || null,
    user: session ? { email: session.email, name: session.name, role: session.role, initials: session.initials } : null,
  };
}
