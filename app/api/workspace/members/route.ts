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

    const { data: target, error: targetError } = await supabase
      .from("workspace_members")
      .select("user_id,role")
      .eq("workspace_id", membership.workspace_id)
      .eq("user_id", body.userId)
      .eq("status", "active")
      .maybeSingle();
    if (targetError || !target) throw new Error("The workspace member could not be found.");
    if (target.role === "owner") throw new Error("Transfer ownership before changing the owner role.");
    if (membership.role === "admin" && target.role === "admin") throw new Error("Only the workspace owner can change another admin.");

    const { error } = await supabase
      .from("workspace_members")
      .update({ role: body.role })
      .eq("workspace_id", membership.workspace_id)
      .eq("user_id", body.userId);
    if (error) throw new Error("The workspace member role could not be updated.");
    return NextResponse.json({ updated: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The workspace member could not be updated." }, { status: 400, headers: noStoreHeaders });
  }
}
