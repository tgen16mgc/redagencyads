import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildFacebookOAuthUrl, createFacebookOAuthState, FACEBOOK_OAUTH_STATE_COOKIE, FACEBOOK_OAUTH_STATE_MAX_AGE_SECONDS } from "@/lib/meta-oauth";

export async function GET(request: Request) {
  try {
    const state = createFacebookOAuthState();
    const store = await cookies();
    store.set(FACEBOOK_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: FACEBOOK_OAUTH_STATE_MAX_AGE_SECONDS,
      path: "/",
    });
    return NextResponse.redirect(buildFacebookOAuthUrl(request, state));
  } catch (error) {
    const url = new URL("/", request.url);
    url.searchParams.set("auth_error", error instanceof Error ? error.message : "Unable to start Facebook login.");
    return NextResponse.redirect(url);
  }
}
