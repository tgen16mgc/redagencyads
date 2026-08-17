import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClient,
  ensureActiveWorkspaceMembership,
  getSiteUrl,
  getWorkspaceAuthMode,
} = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  ensureActiveWorkspaceMembership: vi.fn(),
  getSiteUrl: vi.fn(),
  getWorkspaceAuthMode: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ getSiteUrl }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/workspace-session", () => ({ ensureActiveWorkspaceMembership, getWorkspaceAuthMode }));

import { DELETE, POST } from "./route";

const inviteId = "00000000-0000-4000-8000-000000000003";
const workspaceId = "00000000-0000-4000-8000-000000000002";
const originalResendKey = process.env.RESEND_API_KEY;
const originalResendFrom = process.env.RESEND_FROM_EMAIL;

describe("/api/workspace/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    getSiteUrl.mockReturnValue("https://workspace.example");
    getWorkspaceAuthMode.mockReturnValue("supabase");
    ensureActiveWorkspaceMembership.mockResolvedValue({
      workspace_id: workspaceId,
      full_name: "Workspace Owner",
      role: "owner",
    });
  });

  afterEach(() => {
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
    if (originalResendFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalResendFrom;
  });

  it("creates a normalized pending invitation even when email delivery is not configured", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: inviteId, error: null });
    const workspaceQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Growth Team" }, error: null }),
    };
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
      from: vi.fn().mockReturnValue(workspaceQuery),
      rpc,
    });

    const response = await POST(new Request("https://workspace.example/api/workspace/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "Analyst@Example.com", fullName: "New Analyst", role: "analyst" }),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("create_workspace_invite", {
      p_email: "analyst@example.com",
      p_full_name: "New Analyst",
      p_role: "analyst",
    });
    expect(await response.json()).toEqual({
      inviteId,
      inviteUrl: "https://workspace.example/",
      emailSent: false,
    });
  });

  it("revokes a pending invitation through the guarded RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
      rpc,
    });

    const response = await DELETE(new Request(`https://workspace.example/api/workspace/invites?id=${inviteId}`, { method: "DELETE" }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("revoke_workspace_invite", { p_invite_id: inviteId });
    expect(await response.json()).toEqual({ revoked: true });
  });
});
