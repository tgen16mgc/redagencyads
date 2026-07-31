import { describe, expect, it } from "vitest";
import {
  defaultAccountWorkspaceSettings,
  initialsFromName,
  profileSettingsSchema,
  validatePasswordChange,
  workspaceSettingsSchema,
} from "@/lib/account-workspace-settings";

describe("account and workspace settings", () => {
  it("requires every password rule before enabling an update", () => {
    expect(validatePasswordChange("Old-password1!", "New-password2!", "New-password2!")).toMatchObject({
      length: true,
      uppercase: true,
      lowercase: true,
      number: true,
      symbol: true,
      different: true,
      matches: true,
      valid: true,
    });

    expect(validatePasswordChange("Same-password1!", "Same-password1!", "Same-password1!").valid).toBe(false);
    expect(validatePasswordChange("Old-password1!", "weak-password", "weak-password").valid).toBe(false);
    expect(validatePasswordChange("Old-password1!", "New-password2!", "New-password3!").valid).toBe(false);
  });

  it("normalizes initials and local-development defaults", () => {
    expect(initialsFromName("  Duong Ngoc Tien ")).toBe("DN");
    expect(defaultAccountWorkspaceSettings({ email: "local@example.com", name: "Local workspace", role: "Development mode" })).toMatchObject({
      profile: { email: "local@example.com", fullName: "Local workspace" },
      workspace: { canManage: true, approvalBeforePublishing: true },
    });
  });

  it("rejects invalid profile and workspace fields", () => {
    expect(profileSettingsSchema.safeParse({
      fullName: "",
      timeZone: "Asia/Ho_Chi_Minh",
      weeklyPerformanceDigest: true,
      evidenceFreshnessAlerts: true,
      campaignAnomalyAlerts: false,
    }).success).toBe(false);
    expect(workspaceSettingsSchema.safeParse({
      name: "D",
      timeZone: "Asia/Ho_Chi_Minh",
      requireTwoFactorAuthentication: false,
      approvalBeforePublishing: true,
    }).success).toBe(false);
  });
});
