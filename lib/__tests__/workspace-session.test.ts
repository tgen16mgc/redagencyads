import { afterEach, describe, expect, it } from "vitest";
import { getWorkspaceAuthMode, workspaceIdentityFromMembership } from "@/lib/workspace-session";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("workspace sessions", () => {
  it("uses Supabase when the project URL and publishable key are configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    expect(getWorkspaceAuthMode()).toBe("supabase");
  });

  it("maps RLS-backed membership data to the workspace identity", () => {
    expect(workspaceIdentityFromMembership({
      email: "tien@redagency.vn",
      full_name: "Tien Duong",
      role: "owner",
      preferences: { avatarDataUrl: "data:image/png;base64,avatar" },
    })).toEqual({
      email: "tien@redagency.vn",
      name: "Tien Duong",
      role: "Workspace owner",
      initials: "TD",
      avatarDataUrl: "data:image/png;base64,avatar",
    });
  });

  it("allows an unconfigured local checkout but fails closed in production", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(getWorkspaceAuthMode()).toBe("disabled");

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(getWorkspaceAuthMode()).toBe("unconfigured");
  });
});
