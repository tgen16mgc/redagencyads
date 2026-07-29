import crypto from "node:crypto";

export const CONNECTOR_OAUTH_STATE_COOKIE = "connector_oauth_state";
export const CONNECTOR_TOKEN_COOKIE = "connector_tokens";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for connector OAuth state.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function createOAuthState(provider: string, returnTo = "/?view=intelligence") {
  const nonce = crypto.randomBytes(18).toString("base64url");
  const payload = `${provider}|${returnTo}|${nonce}`;
  const signature = crypto.createHmac("sha256", secretKey()).update(payload).digest("base64url");
  return `${payload}|${signature}`;
}

export function verifyOAuthState(value: string | undefined, provider: string) {
  if (!value) return null;
  const parts = value.split("|");
  if (parts.length !== 4 || parts[0] !== provider) return null;
  const payload = parts.slice(0, 3).join("|");
  const expected = crypto.createHmac("sha256", secretKey()).update(payload).digest("base64url");
  if (parts[3].length !== expected.length || !crypto.timingSafeEqual(Buffer.from(parts[3]), Buffer.from(expected))) return null;
  return { provider: parts[0], returnTo: parts[1], nonce: parts[2] };
}

export type ConnectorTokenPayload = { provider: string; accessToken: string; refreshToken?: string; expiresAt?: string; issuedAt: number };

export function encryptConnectorToken(input: Omit<ConnectorTokenPayload, "issuedAt">) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const payload: ConnectorTokenPayload = { ...input, issuedAt: Date.now() };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decryptConnectorToken(value: string | undefined): ConnectorTokenPayload | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as ConnectorTokenPayload;
    if (!payload.provider || !payload.accessToken || !Number.isFinite(payload.issuedAt) || Date.now() - payload.issuedAt > 30 * 24 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function connectorTokenNeedsRefresh(token: ConnectorTokenPayload, now = Date.now(), skewMs = 60_000) {
  if (!token.expiresAt) return false;
  const expiresAt = Date.parse(token.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now + Math.max(0, skewMs);
}
