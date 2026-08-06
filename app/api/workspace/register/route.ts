import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteUrl, getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordWorkspaceLogin, workspaceSessionStatus } from "@/lib/workspace-session";

const bodySchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120, "Full name is too long."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72, "Password is too long."),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: "Accept the terms to create an account." }) }),
});

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try {
    if (!getSupabaseConfig().configured) {
      return NextResponse.json(
        { ok: false, error: "Account registration is not configured on this deployment." },
        { status: 503, headers: noStoreHeaders },
      );
    }

    const body = bodySchema.parse(await request.json());
    const email = body.email.toLowerCase();
    const supabase = await createSupabaseServerClient();
    const emailRedirectTo = `${getSiteUrl(request.url)}/auth/callback?next=${encodeURIComponent("/")}`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password: body.password,
      options: {
        data: { full_name: body.fullName },
        emailRedirectTo,
      },
    });

    if (error) {
      const rateLimited = /rate|limit|security purposes/i.test(error.message);
      const weakPassword = /password/i.test(error.message);
      const message = rateLimited
        ? "Please wait a moment before trying again."
        : weakPassword
          ? "Choose a stronger password with at least 8 characters."
          : "The account could not be created. Check your details and try again.";
      return NextResponse.json({ ok: false, error: message }, { status: 400, headers: noStoreHeaders });
    }

    if (data.session && data.user) {
      await recordWorkspaceLogin(supabase, "email", request.headers.get("user-agent"));
      return NextResponse.json(
        {
          ok: true,
          confirmationRequired: false,
          email,
          status: await workspaceSessionStatus(supabase),
        },
        { headers: noStoreHeaders },
      );
    }

    return NextResponse.json(
      { ok: true, confirmationRequired: true, email },
      { status: 202, headers: noStoreHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not create the account." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
