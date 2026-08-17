import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureActiveWorkspaceMembership, getWorkspaceAuthMode } from "@/lib/workspace-session";

const bodySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "analyst", "viewer"]),
});

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function PATCH(request: Request) {
  try {
    if (getWorkspaceAuthMode() !== "supabase") throw new Error("Workspace authentication is not configured.");
    const body = bodySchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in again to manage workspace members.");
    const membership = await ensureActiveWorkspaceMembership(supabase, authData.user.id);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Only workspace owners and admins can manage members." }, { status: 403, headers: noStoreHeaders });
    }
    const { data, error } = await supabase.rpc("update_workspace_member_role", {
      p_user_id: body.userId,
      p_role: body.role,
    });
    if (error || !data) throw new Error(error?.message || "The workspace member role could not be updated.");
    return NextResponse.json({ updated: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The workspace member could not be updated." }, { status: 400, headers: noStoreHeaders });
  }
}

export async function DELETE(request: Request) {
  try {
    if (getWorkspaceAuthMode() !== "supabase") throw new Error("Workspace authentication is not configured.");
    const body = z.object({ userId: z.string().uuid() }).parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in again to manage workspace members.");
    const membership = await ensureActiveWorkspaceMembership(supabase, authData.user.id);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Only workspace owners and admins can manage members." }, { status: 403, headers: noStoreHeaders });
    }

    const { data, error } = await supabase.rpc("remove_workspace_member", { p_user_id: body.userId });
    if (error || !data) throw new Error(error?.message || "The workspace member could not be removed.");
    return NextResponse.json({ removed: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The workspace member could not be removed." }, { status: 400, headers: noStoreHeaders });
  }
}
