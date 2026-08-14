import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clearTokenCookie,
  createSupabaseServerClient,
  getSupabaseConfig,
  recordWorkspaceLogin,
  requireWorkspaceMembership,
  signOut,
  workspaceSessionStatus,
} = vi.hoisted(() => ({
  clearTokenCookie: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getSupabaseConfig: vi.fn(),
  recordWorkspaceLogin: vi.fn(),
  requireWorkspaceMembership: vi.fn(),
  signOut: vi.fn(),
  workspaceSessionStatus: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ clearTokenCookie }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/workspace-session", () => ({
  recordWorkspaceLogin,
  requireWorkspaceMembership,
  workspaceSessionStatus,
}));

import { DELETE } from "./route";

describe("DELETE /api/workspace/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenCookie.mockResolvedValue(undefined);
    createSupabaseServerClient.mockResolvedValue({ auth: { signOut } });
    signOut.mockResolvedValue(undefined);
    workspaceSessionStatus.mockResolvedValue({ authenticated: false });
  });

  it("clears the Meta token when workspace authentication is not configured", async () => {
    getSupabaseConfig.mockReturnValue({ configured: false });

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(clearTokenCookie).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("clears both Meta and workspace sessions on sign out", async () => {
    getSupabaseConfig.mockReturnValue({ configured: true });

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(clearTokenCookie).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(workspaceSessionStatus).toHaveBeenCalledWith(expect.objectContaining({ auth: { signOut } }));
  });
});
