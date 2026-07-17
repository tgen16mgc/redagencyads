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

  try {
    const error = url.searchParams.get("error_description") || url.searchParams.get("error");
    if (error) throw new Error(error);

    const state = url.searchParams.get("state");
    if (!state || !expectedState || state !== expectedState) throw new Error("Facebook login state did not match. Please try again.");

    const code = url.searchParams.get("code");
    if (!code) throw new Error("Facebook login did not return an authorization code.");

    const token = await exchangeFacebookCode(code, getFacebookOAuthRedirectUri(request));
    await validateFacebookOAuthToken(token);
    await setTokenCookie(token);
    return NextResponse.redirect(buildFacebookOAuthReturnUrl(request, destination));
  } catch {
    return NextResponse.redirect(buildFacebookOAuthReturnUrl(request, destination, true));
  }
}
