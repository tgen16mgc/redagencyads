import { cookies } from "next/headers";
import type { OAuthProvider } from "@/lib/connector-adapters";
import { decryptConnectorToken } from "@/lib/connector-oauth";
import { ensureConnectorSession } from "@/lib/connector-session";
import { SessionAuthError } from "@/lib/session";

const CONNECTOR_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function providerLabel(provider: OAuthProvider) {
  return provider === "google" ? "Google" : "LinkedIn";
}

export async function requireConnectorSessionAccessToken(
  request: Request,
  provider: OAuthProvider,
) {
  const store = await cookies();
  const encrypted = store.get(`connector_token_${provider}`)?.value;
  if (!encrypted) {
    throw new SessionAuthError(
      `${providerLabel(provider)} connector session missing.`,
    );
  }

  const session = decryptConnectorToken(encrypted);
  if (!session || session.provider !== provider) {
    throw new SessionAuthError(
      `${providerLabel(provider)} connector session expired.`,
    );
  }

  try {
    const current = await ensureConnectorSession({
      provider,
      session,
      origin: new URL(request.url).origin,
    });
    if (current.refreshed && current.encryptedValue) {
      store.set(`connector_token_${provider}`, current.encryptedValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: CONNECTOR_COOKIE_MAX_AGE_SECONDS,
        path: "/",
      });
    }
    return current.accessToken;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : ".";
    throw new SessionAuthError(
      `${providerLabel(provider)} connector session unavailable${detail}`,
    );
  }
}
