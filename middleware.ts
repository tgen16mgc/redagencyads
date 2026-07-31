import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

function copyAuthState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

export async function middleware(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    return NextResponse.json({ ok: false, error: "Workspace authentication is not fully configured." }, { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return copyAuthState(
      response,
      NextResponse.json({ ok: false, error: "Workspace session missing or expired." }, { status: 401 }),
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return copyAuthState(
      response,
      NextResponse.json({ ok: false, error: "Workspace access is not approved for this account." }, { status: 403 }),
    );
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/api/meta/:path*",
    "/api/ai/:path*",
    "/api/budget/:path*",
    "/api/connectors/:path*",
    "/api/creatives/:path*",
    "/api/experiments/:path*",
    "/api/intelligence/:path*",
    "/api/spy/:path*",
    "/api/tiktok/:path*",
  ],
};
