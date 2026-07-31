import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/config";
import { recordWorkspaceLogin, requireWorkspaceMembership } from "@/lib/workspace-session";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = getSiteUrl(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));
  const providerError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(`${siteUrl}/?auth_error=${encodeURIComponent(providerError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${siteUrl}/?auth_error=${encodeURIComponent("The authentication link is invalid or expired.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${siteUrl}/?auth_error=${encodeURIComponent("Authentication could not be completed. Request a new link and try again.")}`);
  }

  if (next !== "/auth/update-password") {
    try {
      await requireWorkspaceMembership(supabase, data.user);
    } catch (membershipError) {
      await supabase.auth.signOut();
      const message = membershipError instanceof Error ? membershipError.message : "Workspace access is not approved.";
      return NextResponse.redirect(`${siteUrl}/?auth_error=${encodeURIComponent(message)}`);
    }

    const provider = data.user.app_metadata.provider === "google" ? "google" : "email";
    await recordWorkspaceLogin(supabase, provider, request.headers.get("user-agent"));
  }

  return NextResponse.redirect(`${siteUrl}${next}`);
}
