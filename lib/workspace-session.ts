import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export type WorkspaceAuthMode = "disabled" | "supabase" | "unconfigured";

export type WorkspaceUser = {
  email: string;
  name: string;
  role: string;
  initials: string;
  avatarDataUrl?: string;
};

export type WorkspaceMembership = Database["public"]["Tables"]["workspace_members"]["Row"];

export type WorkspaceSessionStatus = {
  authenticated: boolean;
  configured: boolean;
  required: boolean;
  googleConfigured: boolean;
  googleAuthUrl: string | null;
  resetConfigured: boolean;
  accessRequestConfigured: boolean;
  signedInAt: number | null;
  user: WorkspaceUser | null;
};

type WorkspaceSupabaseClient = SupabaseClient<Database>;

export function getWorkspaceAuthMode(): WorkspaceAuthMode {
  const config = getSupabaseConfig();
  if (config.configured) return "supabase";
  if (process.env.NODE_ENV === "production") return "unconfigured";
  return "disabled";
}

export function workspaceIdentityFromMembership(membership: Pick<WorkspaceMembership, "email" | "full_name" | "role"> & { preferences?: WorkspaceMembership["preferences"] }): WorkspaceUser {
  const name = membership.full_name.trim() || membership.email.split("@")[0] || "Workspace member";
  const preferences = membership.preferences && typeof membership.preferences === "object" && !Array.isArray(membership.preferences)
    ? membership.preferences
    : {};
  const avatarDataUrl = typeof preferences.avatarDataUrl === "string" && preferences.avatarDataUrl.startsWith("data:image/")
    ? preferences.avatarDataUrl
    : undefined;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "DW";

  return {
    email: membership.email,
    name,
    role: workspaceRoleLabel(membership.role),
    initials,
    avatarDataUrl,
  };
}

function workspaceRoleLabel(role: string) {
  if (role === "owner") return "Workspace owner";
  if (role === "admin") return "Workspace admin";
  if (role === "analyst") return "Performance analyst";
  return "Workspace viewer";
}

export async function getActiveWorkspaceMembership(supabase: WorkspaceSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id,user_id,email,full_name,role,status,preferences,created_at,updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Workspace membership could not be verified.");
  return data;
}

export async function requireWorkspaceMembership(supabase: WorkspaceSupabaseClient, user: User) {
  const membership = await getActiveWorkspaceMembership(supabase, user.id);
  if (!membership) throw new Error("Workspace access is not approved for this account.");
  return membership;
}

export async function recordWorkspaceLogin(supabase: WorkspaceSupabaseClient, provider: "email" | "google" | "unknown", userAgent?: string | null) {
  const { error } = await supabase.rpc("record_workspace_login", {
    p_provider: provider,
    p_user_agent: userAgent?.slice(0, 500) || undefined,
  });
  if (error) console.error("Unable to record workspace login event:", error.message);
}

export async function workspaceSessionStatus(client?: WorkspaceSupabaseClient): Promise<WorkspaceSessionStatus> {
  const config = getSupabaseConfig();
  const mode = getWorkspaceAuthMode();
  const base = {
    configured: mode !== "unconfigured",
    required: mode !== "disabled",
    googleConfigured: config.configured && config.googleEnabled,
    googleAuthUrl: config.configured && config.googleEnabled ? "/auth/google" : null,
    resetConfigured: config.configured,
    accessRequestConfigured: config.configured,
  };

  if (mode === "disabled") {
    return {
      ...base,
      authenticated: true,
      signedInAt: null,
      user: { email: "local@redagency.vn", name: "Local workspace", role: "Development mode", initials: "LW" },
    };
  }

  if (mode === "unconfigured") {
    return { ...base, authenticated: false, signedInAt: null, user: null };
  }

  const supabase = client || await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ...base, authenticated: false, signedInAt: null, user: null };
  }

  const membership = await getActiveWorkspaceMembership(supabase, data.user.id);
  if (!membership) {
    return { ...base, authenticated: false, signedInAt: null, user: null };
  }

  return {
    ...base,
    authenticated: true,
    signedInAt: data.user.last_sign_in_at ? Date.parse(data.user.last_sign_in_at) : null,
    user: workspaceIdentityFromMembership(membership),
  };
}
