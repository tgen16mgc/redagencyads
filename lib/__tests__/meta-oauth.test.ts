import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { validateToken } = vi.hoisted(() => ({
  validateToken: vi.fn(),
}));

vi.mock("@/lib/meta", () => ({
  validateToken,
}));

function graphResponse(body: unknown, ok = true, status = 200) {
  return new Response(JSON.stringify(body), { status, statusText: ok ? "OK" : "Bad Request" });
}

describe("Facebook OAuth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.META_APP_ID = "app_123";
    process.env.META_APP_SECRET = "secret_123";
    delete process.env.META_OAUTH_REDIRECT_URI;
    delete process.env.META_GRAPH_VERSION;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.META_OAUTH_REDIRECT_URI;
    delete process.env.META_GRAPH_VERSION;
  });

  it("builds a Facebook authorization URL with Page publishing scopes", async () => {
    const { buildFacebookOAuthUrl } = await import("../meta-oauth");

    const url = buildFacebookOAuthUrl(new Request("http://localhost:3000/connect"), "state_123");

    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("app_123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/facebook/callback");
    expect(url.searchParams.get("state")).toBe("state_123");
    expect(url.searchParams.get("scope")).toBe("pages_show_list,pages_read_engagement,pages_manage_posts");
  });

  it("uses a configured redirect URI when provided", async () => {
    process.env.META_OAUTH_REDIRECT_URI = "https://app.example.com/oauth/meta";
    const { getFacebookOAuthRedirectUri } = await import("../meta-oauth");

    expect(getFacebookOAuthRedirectUri(new Request("http://localhost:3000/connect"))).toBe("https://app.example.com/oauth/meta");
  });

  it("requires Facebook app credentials", async () => {
    delete process.env.META_APP_ID;
    const { buildFacebookOAuthUrl } = await import("../meta-oauth");

    expect(() => buildFacebookOAuthUrl(new Request("http://localhost:3000"), "state_123")).toThrow("META_APP_ID is required for Facebook login.");
  });

  it("exchanges an authorization code for an access token", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(graphResponse({ access_token: "oauth-token" }));
    vi.stubGlobal("fetch", fetchSpy);
    const { exchangeFacebookCode } = await import("../meta-oauth");

    await expect(exchangeFacebookCode("code_123", "http://localhost:3000/api/auth/facebook/callback")).resolves.toBe("oauth-token");

    const url = fetchSpy.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/v22.0/oauth/access_token");
    expect(url.searchParams.get("client_id")).toBe("app_123");
    expect(url.searchParams.get("client_secret")).toBe("secret_123");
    expect(url.searchParams.get("code")).toBe("code_123");
  });

  it("surfaces Meta token exchange errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(graphResponse({ error: { message: "Invalid code" } }, false, 400)));
    const { exchangeFacebookCode } = await import("../meta-oauth");

    await expect(exchangeFacebookCode("bad", "http://localhost/callback")).rejects.toThrow("Invalid code");
  });

  it("validates token identity and required granted permissions", async () => {
    validateToken.mockResolvedValue({ id: "user_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        graphResponse({
          data: [
            { permission: "pages_show_list", status: "granted" },
            { permission: "pages_read_engagement", status: "granted" },
            { permission: "pages_manage_posts", status: "granted" },
          ],
        }),
      ),
    );
    const { validateFacebookOAuthToken } = await import("../meta-oauth");

    await expect(validateFacebookOAuthToken("oauth-token")).resolves.toBeUndefined();
    expect(validateToken).toHaveBeenCalledWith("oauth-token");
  });

  it("rejects missing required Page scopes", async () => {
    validateToken.mockResolvedValue({ id: "user_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        graphResponse({
          data: [
            { permission: "pages_show_list", status: "granted" },
            { permission: "pages_read_engagement", status: "granted" },
          ],
        }),
      ),
    );
    const { validateFacebookOAuthToken } = await import("../meta-oauth");

    await expect(validateFacebookOAuthToken("oauth-token")).rejects.toThrow("Facebook login is missing required permissions: pages_manage_posts.");
  });
});
