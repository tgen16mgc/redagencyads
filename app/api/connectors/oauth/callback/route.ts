import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeOAuthCode } from "@/lib/connector-adapters";
import { connectorOAuthConfig } from "@/lib/connectors";
import { CONNECTOR_OAUTH_STATE_COOKIE, encryptConnectorToken, verifyOAuthState } from "@/lib/connector-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") || "";
  const code = url.searchParams.get("code") || "";
  const store = await cookies();
  const state = store.get(CONNECTOR_OAUTH_STATE_COOKIE)?.value;
  const verified = verifyOAuthState(state, provider);
  if (!verified || !code) return NextResponse.json({ error: "Invalid connector OAuth state or missing code." }, { status: 400 });
  const config = connectorOAuthConfig(provider as "google" | "linkedin", `${url.origin}/api/connectors/oauth/callback?provider=${encodeURIComponent(provider)}`);
  if (!config) return NextResponse.json({ error: `${provider} OAuth is not configured.` }, { status: 503 });
  try {
    const token = await exchangeOAuthCode(config, code);
    store.set(`connector_token_${provider}`, encryptConnectorToken({ provider, accessToken: token.accessToken, refreshToken: token.refreshToken, expiresAt: token.expiresAt }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60, path: "/" });
    store.delete(CONNECTOR_OAUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL(verified.returnTo, url.origin));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connector OAuth failed." }, { status: 400 });
  }
}
