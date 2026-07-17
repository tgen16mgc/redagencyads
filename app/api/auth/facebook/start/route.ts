import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildFacebookOAuthReturnUrl,
  buildFacebookOAuthUrl,
  createFacebookOAuthState,
  FACEBOOK_OAUTH_RETURN_COOKIE,
  FACEBOOK_OAUTH_STATE_COOKIE,
  FACEBOOK_OAUTH_STATE_MAX_AGE_SECONDS,
  parseFacebookOAuthReturnDestination,
} from "@/lib/meta-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const destination = parseFacebookOAuthReturnDestination(requestUrl.searchParams.get("returnTo"));

  try {
    const state = createFacebookOAuthState();
    const facebookUrl = buildFacebookOAuthUrl(request, state);
    const store = await cookies();
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: FACEBOOK_OAUTH_STATE_MAX_AGE_SECONDS,
      path: "/",
    } as const;

    store.set(FACEBOOK_OAUTH_STATE_COOKIE, state, cookieOptions);
    if (destination) {
      store.set(FACEBOOK_OAUTH_RETURN_COOKIE, destination, cookieOptions);
    } else {
      store.delete(FACEBOOK_OAUTH_RETURN_COOKIE);
    }
    return NextResponse.redirect(facebookUrl);
  } catch {
    try {
      const store = await cookies();
      store.delete(FACEBOOK_OAUTH_STATE_COOKIE);
      store.delete(FACEBOOK_OAUTH_RETURN_COOKIE);
    } catch {
      // The safe local redirect below remains available if cookie access fails.
    }
    return NextResponse.redirect(buildFacebookOAuthReturnUrl(request, destination, true));
  }
}
