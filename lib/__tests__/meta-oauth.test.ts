import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { graphRequest, validateToken } = vi.hoisted(() => ({
  graphRequest: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock("@/lib/meta", () => ({
  validateToken,
}));

vi.mock("@/lib/meta-graph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../meta-graph")>()),
  graphRequest,
}));

import { MetaGraphRequestError } from "../meta-graph";

describe("Facebook OAuth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.META_APP_ID = "app_123";
    process.env.META_APP_SECRET = "secret_123";
    process.env.META_LOGIN_CONFIG_ID = "config_123";
    delete process.env.META_OAUTH_REDIRECT_URI;
  });

  afterEach(() => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.META_LOGIN_CONFIG_ID;
    delete process.env.META_OAUTH_REDIRECT_URI;
  });

  it("builds a Facebook Login for Business authorization URL", async () => {
    const { buildFacebookOAuthUrl } = await import("../meta-oauth");

    const url = buildFacebookOAuthUrl(new Request("http://localhost:3000/connect"), "state_123");

    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("app_123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/facebook/callback");
    expect(url.searchParams.get("state")).toBe("state_123");
    expect(url.searchParams.get("config_id")).toBe("config_123");
    expect(url.searchParams.get("scope")).toBeNull();
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("uses a configured redirect URI when provided", async () => {
    process.env.META_OAUTH_REDIRECT_URI = "https://app.example.com/oauth/meta";
    const { getFacebookOAuthRedirectUri } = await import("../meta-oauth");

    expect(getFacebookOAuthRedirectUri(new Request("http://localhost:3000/connect"))).toBe("https://app.example.com/oauth/meta");
  });

  it("allowlists OAuth return destinations and builds only local return URLs", async () => {
    const { buildFacebookOAuthReturnUrl, parseFacebookOAuthReturnDestination } = await import("../meta-oauth");

    expect(parseFacebookOAuthReturnDestination("ads")).toBe("ads");
    expect(parseFacebookOAuthReturnDestination("publisher")).toBe("publisher");
    expect(parseFacebookOAuthReturnDestination("settings")).toBe("settings");
    expect(parseFacebookOAuthReturnDestination("https://evil.example")).toBeUndefined();
    expect(parseFacebookOAuthReturnDestination("javascript:alert(1)")).toBeUndefined();

    const success = buildFacebookOAuthReturnUrl(new Request("https://app.example.com/api/auth/facebook/callback"), "publisher");
    expect(success.toString()).toBe("https://app.example.com/?view=publisher");

    const settings = buildFacebookOAuthReturnUrl(new Request("https://app.example.com/api/auth/facebook/callback"), "settings");
    expect(settings.toString()).toBe("https://app.example.com/?settings=workspace");

    const failure = buildFacebookOAuthReturnUrl(new Request("https://app.example.com/api/auth/facebook/callback"), undefined, true);
    expect(failure.origin).toBe("https://app.example.com");
    expect(failure.pathname).toBe("/");
    expect(failure.searchParams.get("view")).toBeNull();
    expect(failure.searchParams.get("auth_error")).toBe("Facebook Login could not finish. Try again or use a Meta access token.");
  });

  it("requires Facebook app credentials", async () => {
    delete process.env.META_APP_ID;
    const { buildFacebookOAuthUrl } = await import("../meta-oauth");

    expect(() => buildFacebookOAuthUrl(new Request("http://localhost:3000"), "state_123")).toThrow("META_APP_ID is required for Facebook login.");
  });

  it("requires the Facebook Login for Business configuration", async () => {
    delete process.env.META_LOGIN_CONFIG_ID;
    const { buildFacebookOAuthUrl } = await import("../meta-oauth");

    expect(() => buildFacebookOAuthUrl(new Request("http://localhost:3000"), "state_123")).toThrow("META_LOGIN_CONFIG_ID is required for Facebook login.");
  });

  it("exchanges an authorization code for an access token", async () => {
    graphRequest.mockResolvedValue({ access_token: "oauth-token" });
    const { exchangeFacebookCode } = await import("../meta-oauth");

    await expect(exchangeFacebookCode("code_123", "http://localhost:3000/api/auth/facebook/callback")).resolves.toBe("oauth-token");

    expect(graphRequest).toHaveBeenCalledWith({
      path: "/oauth/access_token",
      params: {
        client_id: "app_123",
        client_secret: "secret_123",
        redirect_uri: "http://localhost:3000/api/auth/facebook/callback",
        code: "code_123",
      },
    });
  });

  it("surfaces Meta token exchange errors", async () => {
    graphRequest.mockRejectedValue(new MetaGraphRequestError(400, { message: "Invalid code" }));
    const { exchangeFacebookCode } = await import("../meta-oauth");

    await expect(exchangeFacebookCode("bad", "http://localhost/callback")).rejects.toThrow("Invalid code");
  });

  it("validates token identity and required granted permissions", async () => {
    validateToken.mockResolvedValue({ id: "user_1" });
    graphRequest.mockResolvedValue({
      data: [
        { permission: "ads_read", status: "granted" },
        { permission: "pages_show_list", status: "granted" },
        { permission: "pages_read_engagement", status: "granted" },
        { permission: "pages_manage_posts", status: "granted" },
      ],
    });
    const { validateFacebookOAuthToken } = await import("../meta-oauth");

    await expect(validateFacebookOAuthToken("oauth-token")).resolves.toBeUndefined();
    expect(validateToken).toHaveBeenCalledWith("oauth-token");
    expect(graphRequest).toHaveBeenCalledWith({ path: "/me/permissions", token: "oauth-token" });
  });

  it("rejects missing required Business Login permissions", async () => {
    validateToken.mockResolvedValue({ id: "user_1" });
    graphRequest.mockResolvedValue({
      data: [
        { permission: "ads_read", status: "granted" },
        { permission: "pages_show_list", status: "granted" },
        { permission: "pages_read_engagement", status: "granted" },
      ],
    });
    const { validateFacebookOAuthToken } = await import("../meta-oauth");

    await expect(validateFacebookOAuthToken("oauth-token")).rejects.toThrow("Facebook login is missing required permissions: pages_manage_posts.");
  });
});
