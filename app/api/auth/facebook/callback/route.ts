import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildFacebookOAuthReturnUrl,
  exchangeFacebookCode,
  FACEBOOK_OAUTH_RETURN_COOKIE,
  FACEBOOK_OAUTH_STATE_COOKIE,
  getFacebookOAuthRedirectUri,
  parseFacebookOAuthReturnDestination,
  validateFacebookOAuthToken,
} from "@/lib/meta-oauth";
import { setTokenCookie } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const expectedState = store.get(FACEBOOK_OAUTH_STATE_COOKIE)?.value;
  const destination = parseFacebookOAuthReturnDestination(store.get(FACEBOOK_OAUTH_RETURN_COOKIE)?.value);
  store.delete(FACEBOOK_OAUTH_STATE_COOKIE);
  store.delete(FACEBOOK_OAUTH_RETURN_COOKIE);
  let stage = "facebook_response";

  try {
    const error = url.searchParams.get("error_description") || url.searchParams.get("error");
    if (error) throw new Error(error);

    stage = "state";
    const state = url.searchParams.get("state");
    if (!state || !expectedState || state !== expectedState) throw new Error("Facebook login state did not match. Please try again.");

    stage = "code";
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Facebook login did not return an authorization code.");

    stage = "exchange";
    const token = await exchangeFacebookCode(code, getFacebookOAuthRedirectUri(request));
    stage = "permissions";
    await validateFacebookOAuthToken(token);
    stage = "session";
    await setTokenCookie(token);
    return NextResponse.redirect(buildFacebookOAuthReturnUrl(request, destination));
  } catch (error) {
    console.error("[DEBUG-meta-oauth]", {
      stage,
      message: error instanceof Error ? error.message : "Unknown Facebook OAuth error",
    });
    return NextResponse.redirect(buildFacebookOAuthReturnUrl(request, destination, true));
  }
}
