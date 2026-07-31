import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getSupabaseConfig } from "@/lib/supabase/config";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    if (!getSupabaseConfig().configured) {
      return NextResponse.json({ ok: false, error: "Password reset is not configured on this deployment." }, { status: 503 });
    }

    const { email } = bodySchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const redirectTo = `${getSiteUrl(request.url)}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });

    if (error) {
      const rateLimited = /rate|limit|security purposes/i.test(error.message);
      throw new Error(rateLimited ? "Please wait a moment before requesting another reset email." : "The reset email could not be sent. Try again shortly.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not request a reset link." },
      { status: 400 },
    );
  }
}
