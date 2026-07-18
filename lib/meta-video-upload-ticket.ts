import crypto from "node:crypto";

const TICKET_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type MetaVideoUploadTicket = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  uploadSessionId: string;
  videoId: string;
};

type SealedTicket = MetaVideoUploadTicket & {
  issuedAt: number;
  sessionHash: string;
};

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for encrypted upload sessions.");
  return crypto.createHash("sha256").update(`meta-video-upload:${secret}`).digest();
}

function sessionHash(sessionToken: string) {
  return crypto.createHash("sha256").update(sessionToken).digest("base64url");
}

export function sealMetaVideoUploadTicket(ticket: MetaVideoUploadTicket, sessionToken: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const payload: SealedTicket = { ...ticket, issuedAt: Date.now(), sessionHash: sessionHash(sessionToken) };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openMetaVideoUploadTicket(value: string, sessionToken: string): MetaVideoUploadTicket | null {
  try {
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"),
    ) as SealedTicket;

    if (Date.now() - payload.issuedAt > TICKET_MAX_AGE_MS) return null;
    if (payload.sessionHash !== sessionHash(sessionToken)) return null;

    const { issuedAt: _issuedAt, sessionHash: _sessionHash, ...ticket } = payload;
    return ticket;
  } catch {
    return null;
  }
}
