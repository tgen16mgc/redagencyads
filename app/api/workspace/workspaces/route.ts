import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureActiveWorkspaceMembership, getWorkspaceAuthMode } from "@/lib/workspace-session";
import { loadWorkspaceDirectory } from "@/lib/workspace-directory";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("switch"), workspaceId: z.string().uuid() }),
  z.object({ action: z.literal("create"), name: z.string().trim().min(2).max(120) }),
]);

const noStoreHeaders = { "Cache-Control": "private, no-store" };

async function authenticatedWorkspaceContext() {
  if (getWorkspaceAuthMode() !== "supabase") {
    throw new Error("Workspace switching requires Supabase authentication.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in again to manage your workspaces.");
  await ensureActiveWorkspaceMembership(supabase, data.user.id);
  return { supabase, userId: data.user.id };
}

export async function GET() {
  try {
    if (getWorkspaceAuthMode() === "disabled") {
      return NextResponse.json({
        workspaces: [{
          id: "local",
          name: "Decision Workspace",
          slug: "decision-workspace",
          role: "owner",
          isCurrent: true,
        }],
      }, { headers: noStoreHeaders });
    }

    const { supabase, userId } = await authenticatedWorkspaceContext();
    return NextResponse.json({
      workspaces: await loadWorkspaceDirectory(supabase, userId),
    }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Your workspaces could not be loaded." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const { supabase, userId } = await authenticatedWorkspaceContext();

    const result = body.action === "switch"
      ? await supabase.rpc("switch_workspace", { p_workspace_id: body.workspaceId })
      : await supabase.rpc("create_workspace", { p_name: body.name });
    if (result.error || !result.data) {
      throw new Error(body.action === "switch"
        ? "The workspace could not be switched."
        : "The workspace could not be created.");
    }

    return NextResponse.json({
      activeWorkspaceId: result.data,
      workspaces: await loadWorkspaceDirectory(supabase, userId),
    }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The workspace action could not be completed." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
