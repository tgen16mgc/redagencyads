import { NextResponse } from "next/server";
import { z } from "zod";
import { validatePasswordChange } from "@/lib/account-workspace-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceAuthMode } from "@/lib/workspace-session";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
  confirmPassword: z.string().min(1),
});
const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try {
    if (getWorkspaceAuthMode() !== "supabase") {
      return NextResponse.json(
        { error: "Password changes require configured workspace authentication." },
        { status: 409, headers: noStoreHeaders },
      );
    }

    const body = bodySchema.parse(await request.json());
    if (!validatePasswordChange(body.currentPassword, body.newPassword, body.confirmPassword).valid) {
      return NextResponse.json({ error: "The new password does not meet every requirement." }, { status: 400, headers: noStoreHeaders });
    }

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const email = authData.user?.email;
    if (authError || !authData.user || !email) {
      return NextResponse.json({ error: "Sign in again before changing your password." }, { status: 401, headers: noStoreHeaders });
    }

    const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
      email,
      password: body.currentPassword,
    });
    if (reauthenticationError) {
      return NextResponse.json({ error: "The current password is incorrect." }, { status: 401, headers: noStoreHeaders });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: body.newPassword });
    if (updateError) throw new Error("The password could not be updated. Try again.");

    await supabase.auth.signOut({ scope: "others" });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The password could not be updated." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
