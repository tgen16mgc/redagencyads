import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient, ensureActiveWorkspaceMembership, getWorkspaceAuthMode } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  ensureActiveWorkspaceMembership: vi.fn(),
  getWorkspaceAuthMode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/workspace-session", () => ({ ensureActiveWorkspaceMembership, getWorkspaceAuthMode }));

import { DELETE, PATCH } from "./route";

const targetUserId = "00000000-0000-4000-8000-000000000002";

describe("/api/workspace/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceAuthMode.mockReturnValue("supabase");
  });

  it("allows an owner to update a non-owner role", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
      rpc,
    });
    ensureActiveWorkspaceMembership.mockResolvedValue({ workspace_id: "workspace-1", role: "owner" });

    const response = await PATCH(new Request("https://workspace.example/api/workspace/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, role: "analyst" }),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("update_workspace_member_role", {
      p_user_id: targetUserId,
      p_role: "analyst",
    });
  });

  it("rejects member management for analysts and viewers", async () => {
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "viewer-1" } }, error: null }) },
    });
    ensureActiveWorkspaceMembership.mockResolvedValue({ workspace_id: "workspace-1", role: "viewer" });

    const response = await PATCH(new Request("https://workspace.example/api/workspace/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, role: "analyst" }),
    }));

    expect(response.status).toBe(403);
  });

  it("removes a non-owner member through the guarded RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
      rpc,
    });
    ensureActiveWorkspaceMembership.mockResolvedValue({ workspace_id: "workspace-1", role: "owner" });

    const response = await DELETE(new Request("https://workspace.example/api/workspace/members", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: targetUserId }),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("remove_workspace_member", { p_user_id: targetUserId });
    expect(await response.json()).toEqual({ removed: true });
  });
});
