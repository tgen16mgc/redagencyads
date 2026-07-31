import { NextRequest, NextResponse } from "next/server";

const WORKSPACE_COOKIE = "decision_workspace_session";

export async function middleware(request: NextRequest) {
  const requestedMode = process.env.WORKSPACE_AUTH_MODE?.trim().toLowerCase();
  if (requestedMode === "disabled") return NextResponse.next();

  const secret = process.env.WORKSPACE_SESSION_SECRET || process.env.SESSION_SECRET || "";
  const credentialsConfigured = Boolean(process.env.WORKSPACE_AUTH_EMAIL && process.env.WORKSPACE_AUTH_PASSWORD_HASH && secret);
  const authRequired = requestedMode === "credentials" || credentialsConfigured || process.env.NODE_ENV === "production";
  if (!authRequired) return NextResponse.next();
  if (!credentialsConfigured) {
    return NextResponse.json({ ok: false, error: "Workspace authentication is not fully configured." }, { status: 503 });
  }

  const value = request.cookies.get(WORKSPACE_COOKIE)?.value;
  if (!value || !(await validWorkspaceCookie(value, secret))) {
    return NextResponse.json({ ok: false, error: "Workspace session missing or expired." }, { status: 401 });
  }

  return NextResponse.next();
}

async function validWorkspaceCookie(value: string, secret: string) {
  try {
    const raw = decodeBase64Url(value);
    if (raw.length < 29) return false;
    const iv = raw.slice(0, 12);
    const tag = raw.slice(12, 28);
    const encrypted = raw.slice(28);
    const encryptedWithTag = new Uint8Array(encrypted.length + tag.length);
    encryptedWithTag.set(encrypted);
    encryptedWithTag.set(tag, encrypted.length);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`workspace:${secret}`));
    const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, encryptedWithTag);
    const payload = JSON.parse(new TextDecoder().decode(plain)) as { email?: string; expiresAt?: number };
    return Boolean(payload.email && payload.expiresAt && payload.expiresAt > Date.now());
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export const config = {
  matcher: [
    "/api/meta/:path*",
    "/api/ai/:path*",
    "/api/budget/:path*",
    "/api/connectors/:path*",
    "/api/creatives/:path*",
    "/api/experiments/:path*",
    "/api/intelligence/:path*",
    "/api/spy/:path*",
    "/api/tiktok/:path*",
  ],
};
