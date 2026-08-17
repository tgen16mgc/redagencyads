import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteUrl } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureActiveWorkspaceMembership, getWorkspaceAuthMode } from "@/lib/workspace-session";

const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  fullName: z.string().trim().max(120).optional().default(""),
  role: z.enum(["admin", "analyst", "viewer"]),
});

const noStoreHeaders = { "Cache-Control": "private, no-store" };

async function sendInviteEmail({
  email,
  inviterName,
  inviteUrl,
  role,
  workspaceName,
}: {
  email: string;
  inviterName: string;
  inviteUrl: string;
  role: string;
  workspaceName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `You're invited to ${workspaceName}`,
      text: `${inviterName} invited you to join ${workspaceName} as ${role}. Sign in or create an account with this email address to accept the invitation: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
    }),
  });

  if (!response.ok) console.error("Workspace invitation email delivery failed with status", response.status);
  return response.ok;
}

export async function POST(request: Request) {
  try {
    if (getWorkspaceAuthMode() !== "supabase") throw new Error("Workspace invitations require Supabase authentication.");
    const body = inviteSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in again to invite workspace members.");
    const membership = await ensureActiveWorkspaceMembership(supabase, authData.user.id);
    if (!membership) throw new Error("Your active workspace could not be loaded.");

    const { data: inviteId, error: inviteError } = await supabase.rpc("create_workspace_invite", {
      p_email: body.email.toLowerCase(),
      p_full_name: body.fullName || undefined,
      p_role: body.role,
    });
    if (inviteError || !inviteId) throw new Error(inviteError?.message || "The invitation could not be created.");

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", membership.workspace_id)
      .maybeSingle();
    const inviteUrl = `${getSiteUrl(request.url)}/`;
    const emailSent = await sendInviteEmail({
      email: body.email.toLowerCase(),
      inviterName: membership.full_name,
      inviteUrl,
      role: body.role,
      workspaceName: workspace?.name || "Decision Workspace",
    });

    return NextResponse.json({ inviteId, inviteUrl, emailSent }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The invitation could not be created." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (getWorkspaceAuthMode() !== "supabase") throw new Error("Workspace invitations require Supabase authentication.");
    const inviteId = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in again to revoke workspace invitations.");
    await ensureActiveWorkspaceMembership(supabase, authData.user.id);

    const { data, error } = await supabase.rpc("revoke_workspace_invite", { p_invite_id: inviteId });
    if (error || !data) throw new Error(error?.message || "The invitation could not be revoked.");
    return NextResponse.json({ revoked: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The invitation could not be revoked." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
