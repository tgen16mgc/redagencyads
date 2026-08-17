import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClient,
  ensureActiveWorkspaceMembership,
  getWorkspaceAuthMode,
  loadWorkspaceDirectory,
} = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  ensureActiveWorkspaceMembership: vi.fn(),
  getWorkspaceAuthMode: vi.fn(),
  loadWorkspaceDirectory: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/workspace-session", () => ({ ensureActiveWorkspaceMembership, getWorkspaceAuthMode }));
vi.mock("@/lib/workspace-directory", () => ({ loadWorkspaceDirectory }));

import { GET, POST } from "./route";

const workspace = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Growth Team",
  slug: "growth-team",
  role: "owner",
  isCurrent: true,
};

describe("/api/workspace/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceAuthMode.mockReturnValue("supabase");
    ensureActiveWorkspaceMembership.mockResolvedValue({ workspace_id: workspace.id });
    loadWorkspaceDirectory.mockResolvedValue([workspace]);
  });

  it("lists every active workspace membership", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    };
    createSupabaseServerClient.mockResolvedValue(client);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workspaces: [workspace] });
    expect(loadWorkspaceDirectory).toHaveBeenCalledWith(client, "user-1");
  });

  it("switches the active workspace through the guarded RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: workspace.id, error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      rpc,
    });

    const response = await POST(new Request("https://workspace.example/api/workspace/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "switch", workspaceId: workspace.id }),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("switch_workspace", { p_workspace_id: workspace.id });
    expect(await response.json()).toEqual({ activeWorkspaceId: workspace.id, workspaces: [workspace] });
  });

  it("creates a workspace and returns the refreshed directory", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: workspace.id, error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      rpc,
    });

    const response = await POST(new Request("https://workspace.example/api/workspace/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", name: "Growth Team" }),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("create_workspace", { p_name: "Growth Team" });
    expect(await response.json()).toEqual({ activeWorkspaceId: workspace.id, workspaces: [workspace] });
  });
});
