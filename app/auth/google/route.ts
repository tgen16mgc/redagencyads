import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const config = getSupabaseConfig();
  const siteUrl = getSiteUrl(request.url);
  if (!config.configured || !config.googleEnabled) {
    return NextResponse.redirect(`${siteUrl}/?auth_error=${encodeURIComponent("Google sign-in is not configured on this deployment.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/")}`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${siteUrl}/?auth_error=${encodeURIComponent("Google sign-in could not start. Try again shortly.")}`);
  }

  return NextResponse.redirect(data.url);
}
