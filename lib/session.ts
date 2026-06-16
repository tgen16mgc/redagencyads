import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "meta_ads_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  token: string;
  issuedAt: number;
};

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for encrypted token sessions.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSession(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const payload: SessionPayload = { token, issuedAt: Date.now() };
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

export async function setTokenCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, encryptSession(token), {
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
  if (!encrypted) throw new Error("Meta access token session missing.");
  const payload = decryptSession(encrypted);
  if (!payload) throw new Error("Meta access token session expired.");
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
