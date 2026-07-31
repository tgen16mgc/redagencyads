import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recordWorkspaceLogin,
  requireWorkspaceMembership,
  workspaceSessionStatus,
} from "@/lib/workspace-session";
import { getSupabaseConfig } from "@/lib/supabase/config";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  keepSignedIn: z.boolean().default(true),
});

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  return NextResponse.json(await workspaceSessionStatus(), { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  try {
    if (!getSupabaseConfig().configured) {
      return NextResponse.json(
        { ok: false, error: "Workspace authentication is not fully configured." },
        { status: 503, headers: noStoreHeaders },
      );
    }

    const body = bodySchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email.trim().toLowerCase(),
      password: body.password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { ok: false, error: "Email or password does not match. Check your details and try again." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    try {
      await requireWorkspaceMembership(supabase, data.user);
    } catch (membershipError) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, error: membershipError instanceof Error ? membershipError.message : "Workspace access is not approved." },
        { status: 403, headers: noStoreHeaders },
      );
    }

    await recordWorkspaceLogin(supabase, "email", request.headers.get("user-agent"));
    return NextResponse.json(await workspaceSessionStatus(supabase), { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign in to the workspace.";
    return NextResponse.json({ ok: false, error: message }, { status: 400, headers: noStoreHeaders });
  }
}

export async function DELETE() {
  if (!getSupabaseConfig().configured) return NextResponse.json(await workspaceSessionStatus(), { headers: noStoreHeaders });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json(await workspaceSessionStatus(supabase), { headers: noStoreHeaders });
}
