import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceDirectoryEntry, WorkspaceRole } from "@/lib/account-workspace-settings";
import type { Database } from "@/lib/supabase/types";

type WorkspaceSupabaseClient = SupabaseClient<Database>;

export async function loadWorkspaceDirectory(
  supabase: WorkspaceSupabaseClient,
  userId: string,
): Promise<WorkspaceDirectoryEntry[]> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("workspace_id,role,is_current,created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (membershipsError) throw new Error("Your workspaces could not be loaded.");
  if (!memberships?.length) return [];

  const workspaceIds = memberships.map((membership) => membership.workspace_id);
  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("id,name,slug")
    .in("id", workspaceIds);

  if (workspacesError) throw new Error("Your workspaces could not be loaded.");
  const workspaceById = new Map((workspaces || []).map((workspace) => [workspace.id, workspace]));

  return memberships.flatMap((membership) => {
    const workspace = workspaceById.get(membership.workspace_id);
    if (!workspace) return [];
    return [{
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: membership.role as WorkspaceRole,
      isCurrent: membership.is_current,
    }];
  });
}
