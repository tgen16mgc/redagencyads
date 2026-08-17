import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";
import {
  DEFAULT_WORKSPACE_TIME_ZONE,
  defaultAccountWorkspaceSettings,
  settingsPatchSchema,
  type AccountWorkspaceSettingsData,
  type WorkspaceRole,
} from "@/lib/account-workspace-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureActiveWorkspaceMembership, getWorkspaceAuthMode } from "@/lib/workspace-session";
import { loadWorkspaceDirectory } from "@/lib/workspace-directory";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function jsonRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function booleanSetting(record: Record<string, Json | undefined>, key: string, fallback: boolean) {
  return typeof record[key] === "boolean" ? record[key] : fallback;
}

function stringSetting(record: Record<string, Json | undefined>, key: string, fallback: string) {
  return typeof record[key] === "string" && record[key].trim() ? record[key].trim() : fallback;
}

function avatarSetting(record: Record<string, Json | undefined>) {
  const value = record.avatarDataUrl;
  return typeof value === "string" && value.startsWith("data:image/") ? value : undefined;
}

function roleSummary(roles: string[]) {
  const labels = ["owner", "admin", "analyst", "viewer"]
    .map((role) => {
      const count = roles.filter((value) => value === role).length;
      return count ? `${count} ${role}${count === 1 ? "" : "s"}` : "";
    })
    .filter(Boolean);
  return labels.join(" · ") || "No active members";
}

async function loadSettings() {
  const mode = getWorkspaceAuthMode();
  if (mode === "disabled") {
    return defaultAccountWorkspaceSettings({
      email: "local@redagency.vn",
      name: "Local workspace",
      role: "Development mode",
    });
  }
  if (mode === "unconfigured") throw new Error("Workspace authentication is not configured.");

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Sign in again to manage workspace settings.");

  const membership = await ensureActiveWorkspaceMembership(supabase, authData.user.id);
  if (!membership) throw new Error("Your active workspace membership could not be loaded.");
  const canManage = membership.role === "owner" || membership.role === "admin";

  const [
    { data: workspace, error: workspaceError },
    { data: members, error: membersError },
    invitesResult,
    availableWorkspaces,
  ] = await Promise.all([
    supabase.from("workspaces").select("id,name,settings").eq("id", membership.workspace_id).single(),
    supabase.from("workspace_members").select("user_id,email,full_name,role,status,preferences").eq("workspace_id", membership.workspace_id).eq("status", "active").order("created_at", { ascending: true }),
    canManage
      ? supabase.from("workspace_invites").select("id,email,full_name,role,created_at,expires_at").eq("workspace_id", membership.workspace_id).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    loadWorkspaceDirectory(supabase, authData.user.id),
  ]);
  if (workspaceError || !workspace) throw new Error("Workspace settings could not be loaded.");
  if (membersError) throw new Error("Workspace members could not be loaded.");
  if (invitesResult.error) throw new Error("Workspace invitations could not be loaded.");

  const profilePreferences = jsonRecord(membership.preferences);
  const workspacePreferences = jsonRecord(workspace.settings);
  const roles = (members || []).map((member) => member.role);

  return {
    profile: {
      fullName: membership.full_name,
      avatarDataUrl: avatarSetting(profilePreferences),
      email: membership.email,
      timeZone: stringSetting(profilePreferences, "timeZone", DEFAULT_WORKSPACE_TIME_ZONE),
      weeklyPerformanceDigest: booleanSetting(profilePreferences, "weeklyPerformanceDigest", true),
      evidenceFreshnessAlerts: booleanSetting(profilePreferences, "evidenceFreshnessAlerts", true),
      campaignAnomalyAlerts: booleanSetting(profilePreferences, "campaignAnomalyAlerts", false),
    },
    workspace: {
      id: workspace.id,
      slug: availableWorkspaces.find((entry) => entry.id === workspace.id)?.slug || "workspace",
      name: workspace.name,
      timeZone: stringSetting(workspacePreferences, "timeZone", DEFAULT_WORKSPACE_TIME_ZONE),
      requireTwoFactorAuthentication: booleanSetting(workspacePreferences, "requireTwoFactorAuthentication", false),
      approvalBeforePublishing: booleanSetting(workspacePreferences, "approvalBeforePublishing", true),
      memberCount: roles.length,
      roleSummary: roleSummary(roles),
      canManage,
      currentUserId: authData.user.id,
      currentUserRole: membership.role as WorkspaceRole,
      members: (members || []).map((member) => ({
        userId: member.user_id,
        email: member.email,
        fullName: member.full_name,
        avatarDataUrl: avatarSetting(jsonRecord(member.preferences)),
        role: member.role as WorkspaceRole,
        status: member.status,
      })),
      pendingInvites: (invitesResult.data || []).map((invite) => ({
        id: invite.id,
        email: invite.email,
        fullName: invite.full_name || "",
        role: invite.role as "admin" | "analyst" | "viewer",
        createdAt: invite.created_at,
        expiresAt: invite.expires_at,
      })),
      availableWorkspaces,
    },
  } satisfies AccountWorkspaceSettingsData;
}

export async function GET() {
  try {
    return NextResponse.json(await loadSettings(), { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settings could not be loaded." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = settingsPatchSchema.parse(await request.json());
    const mode = getWorkspaceAuthMode();
    if (mode === "disabled") return NextResponse.json(await loadSettings(), { headers: noStoreHeaders });
    if (mode === "unconfigured") throw new Error("Workspace authentication is not configured.");

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in again to save these settings.");

    const membership = await ensureActiveWorkspaceMembership(supabase, authData.user.id);
    if (!membership) throw new Error("Your active workspace membership could not be loaded.");

    if (body.tab === "profile") {
      const { fullName, ...preferences } = body.profile;
      const { error } = await supabase
        .from("workspace_members")
        .update({ full_name: fullName, preferences })
        .eq("workspace_id", membership.workspace_id)
        .eq("user_id", authData.user.id);
      if (error) throw new Error("Profile settings could not be saved.");
    } else {
      if (membership.role !== "owner" && membership.role !== "admin") {
        return NextResponse.json({ error: "Only workspace owners and admins can change workspace settings." }, { status: 403, headers: noStoreHeaders });
      }
      const { name, ...settings } = body.workspace;
      const { error } = await supabase.from("workspaces").update({ name, settings }).eq("id", membership.workspace_id);
      if (error) throw new Error("Workspace settings could not be saved.");
    }

    return NextResponse.json(await loadSettings(), { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settings could not be saved." },
      { status: 400, headers: noStoreHeaders },
    );
  }
}
