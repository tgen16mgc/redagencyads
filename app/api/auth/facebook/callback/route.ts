import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeFacebookCode, FACEBOOK_OAUTH_STATE_COOKIE, getFacebookOAuthRedirectUri, validateFacebookOAuthToken } from "@/lib/meta-oauth";
import { setTokenCookie } from "@/lib/session";

function redirectHome(request: Request, error?: string) {
  const url = new URL("/", request.url);
  if (error) url.searchParams.set("auth_error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const expectedState = store.get(FACEBOOK_OAUTH_STATE_COOKIE)?.value;
  store.delete(FACEBOOK_OAUTH_STATE_COOKIE);

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
    return redirectHome(request);
  } catch (error) {
    return redirectHome(request, error instanceof Error ? error.message : "Facebook login failed.");
  }
}
