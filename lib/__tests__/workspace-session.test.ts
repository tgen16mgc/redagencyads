import { afterEach, describe, expect, it } from "vitest";
import {
  authenticateWorkspace,
  decryptWorkspaceSession,
  encryptWorkspaceSession,
  getWorkspaceAuthMode,
  getWorkspaceUser,
  hashWorkspacePassword,
  verifyWorkspacePassword,
} from "@/lib/workspace-session";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  SESSION_SECRET: process.env.SESSION_SECRET,
  WORKSPACE_AUTH_EMAIL: process.env.WORKSPACE_AUTH_EMAIL,
  WORKSPACE_AUTH_PASSWORD_HASH: process.env.WORKSPACE_AUTH_PASSWORD_HASH,
  WORKSPACE_AUTH_NAME: process.env.WORKSPACE_AUTH_NAME,
  WORKSPACE_AUTH_ROLE: process.env.WORKSPACE_AUTH_ROLE,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("workspace sessions", () => {
  it("hashes and verifies passwords without storing plaintext", () => {
    const encoded = hashWorkspacePassword("correct horse battery staple", "fixed-salt");
    expect(encoded).toMatch(/^scrypt\$fixed-salt\$/);
    expect(verifyWorkspacePassword("correct horse battery staple", encoded)).toBe(true);
    expect(verifyWorkspacePassword("wrong password", encoded)).toBe(false);
  });

  it("authenticates the configured workspace identity", async () => {
    process.env.WORKSPACE_AUTH_EMAIL = "Owner@Example.com";
    process.env.WORKSPACE_AUTH_PASSWORD_HASH = hashWorkspacePassword("secure-password", "auth-salt");
    process.env.WORKSPACE_AUTH_NAME = "Tien Duong";
    process.env.WORKSPACE_AUTH_ROLE = "Workspace owner";

    await expect(authenticateWorkspace("owner@example.com", "secure-password")).resolves.toMatchObject({
      email: "owner@example.com",
      name: "Tien Duong",
      initials: "TD",
    });
    await expect(authenticateWorkspace("owner@example.com", "not-the-password")).rejects.toThrow("does not match");
  });

  it("encrypts identity separately from the Meta token session", () => {
    process.env.SESSION_SECRET = "workspace-test-secret";
    const user = { email: "owner@example.com", name: "Owner", role: "Workspace owner", initials: "O" };
    const encrypted = encryptWorkspaceSession(user, false, 1_000);
    expect(encrypted).not.toContain(user.email);
    expect(decryptWorkspaceSession(encrypted, 2_000)).toMatchObject(user);
    expect(decryptWorkspaceSession(encrypted, 1_000 + 12 * 60 * 60 * 1000 + 1)).toBeNull();
  });

  it("fails closed in production when workspace credentials are absent", () => {
    delete process.env.WORKSPACE_AUTH_EMAIL;
    delete process.env.WORKSPACE_AUTH_PASSWORD_HASH;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(getWorkspaceUser()).toBeNull();
    expect(getWorkspaceAuthMode()).toBe("unconfigured");
  });
});
