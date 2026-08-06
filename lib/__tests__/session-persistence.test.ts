import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookieStore,
  cookies,
  createSupabaseServerClient,
  ensureActiveWorkspaceMembership,
  getWorkspaceAuthMode,
} = vi.hoisted(() => ({
  cookieStore: {
    delete: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
  cookies: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  ensureActiveWorkspaceMembership: vi.fn(),
  getWorkspaceAuthMode: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/workspace-session", () => ({ ensureActiveWorkspaceMembership, getWorkspaceAuthMode }));

import {
  clearTokenCookie,
  decryptStoredCredential,
  encryptStoredCredential,
  requireToken,
  setTokenCookie,
} from "@/lib/session";

const userId = "00000000-0000-4000-8000-000000000001";
const workspaceId = "00000000-0000-4000-8000-000000000002";
const originalSecret = process.env.SESSION_SECRET;

function supabaseWithQuery(query: unknown) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
    from: vi.fn().mockReturnValue(query),
  };
}

describe("durable Meta credential persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "session-persistence-test-secret";
    cookies.mockResolvedValue(cookieStore);
    getWorkspaceAuthMode.mockReturnValue("supabase");
    ensureActiveWorkspaceMembership.mockResolvedValue({ workspace_id: workspaceId });
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  it("stores an encrypted account credential when Meta connects", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    createSupabaseServerClient.mockResolvedValue(supabaseWithQuery({ upsert }));

    await setTokenCookie("meta-token-1234567890");

    expect(cookieStore.set).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: workspaceId,
      user_id: userId,
      provider: "meta",
    }), { onConflict: "user_id,provider" });
    const stored = upsert.mock.calls[0][0].encrypted_token as string;
    expect(stored).not.toContain("meta-token-1234567890");
    expect(decryptStoredCredential(stored)).toMatchObject({ token: "meta-token-1234567890", ownerId: userId });
  });

  it("restores the saved credential after the browser cookie is gone", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          encrypted_token: encryptStoredCredential("meta-token-1234567890", userId),
          token_expires_at: null,
        },
        error: null,
      }),
    };
    createSupabaseServerClient.mockResolvedValue(supabaseWithQuery(query));

    await expect(requireToken()).resolves.toBe("meta-token-1234567890");
  });

  it("rejects a saved credential after its provider expiry", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          encrypted_token: encryptStoredCredential("meta-token-1234567890", userId),
          token_expires_at: "2020-01-01T00:00:00.000Z",
        },
        error: null,
      }),
    };
    createSupabaseServerClient.mockResolvedValue(supabaseWithQuery(query));

    await expect(requireToken()).rejects.toThrow("saved Meta token has expired");
  });

  it("removes both the browser cookie and saved credential", async () => {
    const query = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
    };
    createSupabaseServerClient.mockResolvedValue(supabaseWithQuery(query));

    await clearTokenCookie();

    expect(cookieStore.delete).toHaveBeenCalledWith("meta_ads_session");
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", userId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "provider", "meta");
  });
});
