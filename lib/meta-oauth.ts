import crypto from "node:crypto";
import { pageSetupPermissions } from "@/lib/meta-pages";
import { validateToken } from "@/lib/meta";
import { graphRequest } from "@/lib/meta-graph";

export const FACEBOOK_OAUTH_STATE_COOKIE = "meta_facebook_oauth_state";
export const FACEBOOK_OAUTH_RETURN_COOKIE = "meta_facebook_oauth_return";
export const FACEBOOK_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
export const FACEBOOK_OAUTH_GENERIC_ERROR = "Facebook Login could not finish. Try again or use a Meta access token.";
export const facebookOAuthScopes = ["ads_read", ...pageSetupPermissions];

export type FacebookOAuthReturnDestination = "ads" | "publisher" | "settings";

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type PermissionsResponse = {
  data?: Array<{ permission?: string; status?: string }>;
};

function getRequiredEnv(name: "META_APP_ID" | "META_APP_SECRET" | "META_LOGIN_CONFIG_ID") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Facebook login.`);
  return value;
}

export function createFacebookOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function parseFacebookOAuthReturnDestination(
  value: string | null | undefined,
): FacebookOAuthReturnDestination | undefined {
  return value === "ads" || value === "publisher" || value === "settings" ? value : undefined;
}

export function buildFacebookOAuthReturnUrl(
  request: Request,
  destination?: FacebookOAuthReturnDestination,
  error?: boolean,
) {
  const url = new URL("/", request.url);
  if (destination === "settings") url.searchParams.set("settings", "workspace");
  else if (destination) url.searchParams.set("view", destination);
  if (error) url.searchParams.set("auth_error", FACEBOOK_OAUTH_GENERIC_ERROR);
  return url;
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
  url.searchParams.set("config_id", getRequiredEnv("META_LOGIN_CONFIG_ID"));
  url.searchParams.set("response_type", "code");
  return url;
}

export async function exchangeFacebookCode(code: string, redirectUri: string) {
  const json = await graphRequest<TokenResponse>({
    path: "/oauth/access_token",
    params: {
      client_id: getRequiredEnv("META_APP_ID"),
      client_secret: getRequiredEnv("META_APP_SECRET"),
      redirect_uri: redirectUri,
      code,
    },
  });
  if (!json.access_token) {
    throw new Error("Facebook login failed while exchanging the authorization code.");
  }
  return json.access_token;
}

export async function getFacebookTokenPermissions(token: string) {
  const json = await graphRequest<PermissionsResponse>({ path: "/me/permissions", token });
  return new Set((json.data || []).filter((item) => item.status === "granted" && item.permission).map((item) => item.permission as string));
}

export async function validateFacebookOAuthToken(token: string) {
  await validateToken(token);
  const granted = await getFacebookTokenPermissions(token);
  const missing = facebookOAuthScopes.filter((scope) => !granted.has(scope));
  if (missing.length) throw new Error(`Facebook login is missing required permissions: ${missing.join(", ")}.`);
}
