import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";
import {
  DEFAULT_WORKSPACE_TIME_ZONE,
  defaultAccountWorkspaceSettings,
  settingsPatchSchema,
  type AccountWorkspaceSettingsData,
} from "@/lib/account-workspace-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceAuthMode } from "@/lib/workspace-session";

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

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id,email,full_name,role,status,preferences")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) throw new Error("Your active workspace membership could not be loaded.");

  const [{ data: workspace, error: workspaceError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("workspaces").select("id,name,settings").eq("id", membership.workspace_id).single(),
    supabase.from("workspace_members").select("role").eq("workspace_id", membership.workspace_id).eq("status", "active"),
  ]);
  if (workspaceError || !workspace) throw new Error("Workspace settings could not be loaded.");

  const profilePreferences = jsonRecord(membership.preferences);
  const workspacePreferences = jsonRecord(workspace.settings);
  const roles = membersError ? [membership.role] : (members || []).map((member) => member.role);
  const canManage = membership.role === "owner" || membership.role === "admin";

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
      name: workspace.name,
      timeZone: stringSetting(workspacePreferences, "timeZone", DEFAULT_WORKSPACE_TIME_ZONE),
      requireTwoFactorAuthentication: booleanSetting(workspacePreferences, "requireTwoFactorAuthentication", false),
      approvalBeforePublishing: booleanSetting(workspacePreferences, "approvalBeforePublishing", true),
      memberCount: roles.length,
      roleSummary: roleSummary(roles),
      canManage,
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

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id,role,status")
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipError || !membership) throw new Error("Your active workspace membership could not be loaded.");

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
