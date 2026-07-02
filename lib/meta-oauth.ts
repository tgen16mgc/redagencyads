import crypto from "node:crypto";
import { pageSetupPermissions } from "@/lib/meta-pages";
import { validateToken } from "@/lib/meta";

const graphVersion = () => process.env.META_GRAPH_VERSION || "v22.0";

export const FACEBOOK_OAUTH_STATE_COOKIE = "meta_facebook_oauth_state";
export const FACEBOOK_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
export const facebookOAuthScopes = pageSetupPermissions;

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
  };
};

type PermissionsResponse = {
  data?: Array<{ permission?: string; status?: string }>;
  error?: {
    message?: string;
  };
};

function graphUrl(path: string) {
  return `https://graph.facebook.com/${graphVersion()}${path}`;
}

function getRequiredEnv(name: "META_APP_ID" | "META_APP_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Facebook login.`);
  return value;
}

export function createFacebookOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function getFacebookOAuthRedirectUri(request: Request) {
  const configured = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return new URL("/api/auth/facebook/callback", request.url).toString();
}

export function buildFacebookOAuthUrl(request: Request, state: string) {
  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id", getRequiredEnv("META_APP_ID"));
  url.searchParams.set("redirect_uri", getFacebookOAuthRedirectUri(request));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", facebookOAuthScopes.join(","));
  url.searchParams.set("response_type", "code");
  return url;
}

export async function exchangeFacebookCode(code: string, redirectUri: string) {
  const url = new URL(graphUrl("/oauth/access_token"));
  url.searchParams.set("client_id", getRequiredEnv("META_APP_ID"));
  url.searchParams.set("client_secret", getRequiredEnv("META_APP_SECRET"));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json()) as TokenResponse;
  if (!response.ok || !json.access_token) {
    throw new Error(json.error?.message || "Facebook login failed while exchanging the authorization code.");
  }
  return json.access_token;
}

export async function getFacebookTokenPermissions(token: string) {
  const url = new URL(graphUrl("/me/permissions"));
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json()) as PermissionsResponse;
  if (!response.ok) throw new Error(json.error?.message || "Unable to verify Facebook login permissions.");
  return new Set((json.data || []).filter((item) => item.status === "granted" && item.permission).map((item) => item.permission as string));
}

export async function validateFacebookOAuthToken(token: string) {
  await validateToken(token);
  const granted = await getFacebookTokenPermissions(token);
  const missing = facebookOAuthScopes.filter((scope) => !granted.has(scope));
  if (missing.length) throw new Error(`Facebook login is missing required permissions: ${missing.join(", ")}.`);
}
