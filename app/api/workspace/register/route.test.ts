import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClient,
  getSiteUrl,
  getSupabaseConfig,
  recordWorkspaceLogin,
  signUp,
  workspaceSessionStatus,
} = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getSiteUrl: vi.fn(),
  getSupabaseConfig: vi.fn(),
  recordWorkspaceLogin: vi.fn(),
  signUp: vi.fn(),
  workspaceSessionStatus: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ getSiteUrl, getSupabaseConfig }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/workspace-session", () => ({ recordWorkspaceLogin, workspaceSessionStatus }));

import { POST } from "./route";

const validBody = {
  fullName: "New Analyst",
  email: "Analyst@Example.com",
  password: "strong-password",
  acceptedTerms: true,
};

describe("POST /api/workspace/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseConfig.mockReturnValue({ configured: true });
    getSiteUrl.mockReturnValue("https://workspace.example");
    createSupabaseServerClient.mockResolvedValue({ auth: { signUp } });
    recordWorkspaceLogin.mockResolvedValue(undefined);
    workspaceSessionStatus.mockResolvedValue({ authenticated: true, user: { email: "analyst@example.com" } });
  });

  it("returns an authenticated workspace session when email confirmation is disabled", async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: "session" }, user: { id: "user-1" } }, error: null });

    const response = await POST(new Request("https://workspace.example/api/workspace/register", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "vitest" },
      body: JSON.stringify(validBody),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.confirmationRequired).toBe(false);
    expect(json.status.authenticated).toBe(true);
    expect(signUp).toHaveBeenCalledWith({
      email: "analyst@example.com",
      password: "strong-password",
      options: {
        data: { full_name: "New Analyst" },
        emailRedirectTo: "https://workspace.example/auth/callback?next=%2F",
      },
    });
    expect(recordWorkspaceLogin).toHaveBeenCalledWith(expect.anything(), "email", "vitest");
  });

  it("returns a confirmation state when Supabase does not create a session", async () => {
    signUp.mockResolvedValue({ data: { session: null, user: { id: "user-1" } }, error: null });

    const response = await POST(new Request("https://workspace.example/api/workspace/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    }));
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json).toEqual({ ok: true, confirmationRequired: true, email: "analyst@example.com" });
    expect(workspaceSessionStatus).not.toHaveBeenCalled();
    expect(recordWorkspaceLogin).not.toHaveBeenCalled();
  });

  it("rejects invalid or unaccepted registration data before calling Supabase", async () => {
    const response = await POST(new Request("https://workspace.example/api/workspace/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validBody, password: "short", acceptedTerms: false }),
    }));

    expect(response.status).toBe(400);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase registration is not configured", async () => {
    getSupabaseConfig.mockReturnValue({ configured: false });

    const response = await POST(new Request("https://workspace.example/api/workspace/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    }));

    expect(response.status).toBe(503);
    expect(signUp).not.toHaveBeenCalled();
  });
});
