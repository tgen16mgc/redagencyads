import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient, ensureActiveWorkspaceMembership, getWorkspaceAuthMode } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  ensureActiveWorkspaceMembership: vi.fn(),
  getWorkspaceAuthMode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/workspace-session", () => ({ ensureActiveWorkspaceMembership, getWorkspaceAuthMode }));

import { PATCH } from "./route";

const targetUserId = "00000000-0000-4000-8000-000000000002";

describe("PATCH /api/workspace/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceAuthMode.mockReturnValue("supabase");
  });

  it("allows an owner to update a non-owner role", async () => {
    const targetQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: targetUserId, role: "viewer" }, error: null }),
    };
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
    };
    const from = vi.fn().mockReturnValueOnce(targetQuery).mockReturnValueOnce(updateQuery);
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null }) },
      from,
    });
    ensureActiveWorkspaceMembership.mockResolvedValue({ workspace_id: "workspace-1", role: "owner" });

    const response = await PATCH(new Request("https://workspace.example/api/workspace/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, role: "analyst" }),
    }));

    expect(response.status).toBe(200);
    expect(updateQuery.update).toHaveBeenCalledWith({ role: "analyst" });
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
});
