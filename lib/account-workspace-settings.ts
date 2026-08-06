import { z } from "zod";

export const DEFAULT_WORKSPACE_TIME_ZONE = "Asia/Ho_Chi_Minh";

export const profileSettingsSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(120),
  avatarDataUrl: z.string().max(2_100_000).refine((value) => value.startsWith("data:image/"), "Choose a valid image.").optional(),
  timeZone: z.string().trim().min(1, "Enter a time zone.").max(100),
  weeklyPerformanceDigest: z.boolean(),
  evidenceFreshnessAlerts: z.boolean(),
  campaignAnomalyAlerts: z.boolean(),
});

export const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(120),
  timeZone: z.string().trim().min(1, "Enter a time zone.").max(100),
  requireTwoFactorAuthentication: z.boolean(),
  approvalBeforePublishing: z.boolean(),
});

export const settingsPatchSchema = z.discriminatedUnion("tab", [
  z.object({ tab: z.literal("profile"), profile: profileSettingsSchema }),
  z.object({ tab: z.literal("workspace"), workspace: workspaceSettingsSchema }),
]);

export type ProfileSettings = z.infer<typeof profileSettingsSchema> & {
  email: string;
};

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema> & {
  memberCount: number;
  roleSummary: string;
  canManage: boolean;
  members: WorkspaceMemberSummary[];
};

export type WorkspaceMemberSummary = {
  userId: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "analyst" | "viewer";
  status: string;
};

export type AccountWorkspaceSettingsData = {
  profile: ProfileSettings;
  workspace: WorkspaceSettings;
};

export type PasswordValidation = {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  symbol: boolean;
  different: boolean;
  matches: boolean;
  valid: boolean;
};

export function validatePasswordChange(currentPassword: string, newPassword: string, confirmPassword: string): PasswordValidation {
  const validation = {
    length: newPassword.length >= 12,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    symbol: /[^A-Za-z0-9]/.test(newPassword),
    different: newPassword.length > 0 && newPassword !== currentPassword,
    matches: newPassword.length > 0 && newPassword === confirmPassword,
  };

  return {
    ...validation,
    valid: currentPassword.length > 0 && Object.values(validation).every(Boolean),
  };
}

export function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "DW";
}

export function defaultAccountWorkspaceSettings(input: {
  email?: string | null;
  name?: string | null;
  role?: string | null;
}): AccountWorkspaceSettingsData {
  const canManage = input.role === "Workspace owner" || input.role === "Workspace admin" || input.role === "Development mode";
  const roleSummary = input.role ? `1 ${input.role.replace(/^Workspace\s+/i, "").toLowerCase()}` : "1 member";

  return {
    profile: {
      fullName: input.name?.trim() || "Workspace member",
      avatarDataUrl: undefined,
      email: input.email?.trim() || "",
      timeZone: DEFAULT_WORKSPACE_TIME_ZONE,
      weeklyPerformanceDigest: true,
      evidenceFreshnessAlerts: true,
      campaignAnomalyAlerts: false,
    },
    workspace: {
      name: "Decision Workspace",
      timeZone: DEFAULT_WORKSPACE_TIME_ZONE,
      requireTwoFactorAuthentication: false,
      approvalBeforePublishing: true,
      memberCount: 1,
      roleSummary,
      canManage,
      members: [{
        userId: "local",
        email: input.email?.trim() || "local@redagency.vn",
        fullName: input.name?.trim() || "Local workspace",
        role: canManage ? "owner" : "viewer",
        status: "active",
      }],
    },
  };
}
