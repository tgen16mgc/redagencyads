import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildOAuthAuthorizationUrl } from "@/lib/connector-adapters";
import { connectorOAuthConfig } from "@/lib/connectors";
import { createOAuthState, CONNECTOR_OAUTH_STATE_COOKIE } from "@/lib/connector-oauth";

const providers = new Set(["google", "linkedin"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") || "";
  if (!providers.has(provider)) return NextResponse.json({ error: "Unsupported connector provider." }, { status: 400 });
  const config = connectorOAuthConfig(provider as "google" | "linkedin", `${url.origin}/api/connectors/oauth/callback?provider=${encodeURIComponent(provider)}`);
  if (!config) return NextResponse.json({ error: `${provider} OAuth is not configured.` }, { status: 503 });
  const requestedReturnTo = url.searchParams.get("returnTo") || "/?view=intelligence";
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/?view=intelligence";
  const state = createOAuthState(provider, returnTo);
  const store = await cookies();
  store.set(CONNECTOR_OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return NextResponse.redirect(buildOAuthAuthorizationUrl(config, state));
}
