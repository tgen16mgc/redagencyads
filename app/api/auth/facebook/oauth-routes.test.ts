import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookieStore,
  cookies,
  buildFacebookOAuthUrl,
  createFacebookOAuthState,
  exchangeFacebookCode,
  getFacebookOAuthRedirectUri,
  validateFacebookOAuthToken,
  setTokenCookie,
} = vi.hoisted(() => {
  const cookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return {
    cookieStore,
    cookies: vi.fn(async () => cookieStore),
    buildFacebookOAuthUrl: vi.fn(),
    createFacebookOAuthState: vi.fn(),
    exchangeFacebookCode: vi.fn(),
    getFacebookOAuthRedirectUri: vi.fn(),
    validateFacebookOAuthToken: vi.fn(),
    setTokenCookie: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("@/lib/meta-oauth", () => ({
  FACEBOOK_OAUTH_STATE_COOKIE: "meta_facebook_oauth_state",
  FACEBOOK_OAUTH_STATE_MAX_AGE_SECONDS: 600,
  buildFacebookOAuthUrl,
  createFacebookOAuthState,
  exchangeFacebookCode,
  getFacebookOAuthRedirectUri,
  validateFacebookOAuthToken,
}));

vi.mock("@/lib/session", () => ({
  setTokenCookie,
}));

describe("Facebook OAuth routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue(undefined);
    createFacebookOAuthState.mockReturnValue("state_123");
    buildFacebookOAuthUrl.mockReturnValue(new URL("https://www.facebook.com/dialog/oauth?state=state_123"));
    getFacebookOAuthRedirectUri.mockReturnValue("http://localhost/api/auth/facebook/callback");
    exchangeFacebookCode.mockResolvedValue("oauth-token");
    validateFacebookOAuthToken.mockResolvedValue(undefined);
    setTokenCookie.mockResolvedValue(undefined);
  });

  it("redirects to Facebook and stores a short-lived state cookie", async () => {
    const { GET } = await import("./start/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/start"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.facebook.com/dialog/oauth?state=state_123");
    expect(cookieStore.set).toHaveBeenCalledWith(
      "meta_facebook_oauth_state",
      "state_123",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" }),
    );
  });

  it("redirects home with an error when start cannot build the Facebook URL", async () => {
    buildFacebookOAuthUrl.mockImplementation(() => {
      throw new Error("META_APP_ID is required for Facebook login.");
    });
    const { GET } = await import("./start/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/start"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("auth_error")).toBe("META_APP_ID is required for Facebook login.");
  });

  it("rejects callback state mismatches", async () => {
    cookieStore.get.mockReturnValue({ value: "expected_state" });
    const { GET } = await import("./callback/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/callback?state=wrong&code=code_123"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.searchParams.get("auth_error")).toBe("Facebook login state did not match. Please try again.");
    expect(exchangeFacebookCode).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_state");
  });

  it("handles Facebook callback errors", async () => {
    cookieStore.get.mockReturnValue({ value: "state_123" });
    const { GET } = await import("./callback/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/callback?state=state_123&error_description=Denied"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.searchParams.get("auth_error")).toBe("Denied");
    expect(exchangeFacebookCode).not.toHaveBeenCalled();
  });

  it("exchanges a valid callback code and stores the encrypted token session", async () => {
    cookieStore.get.mockReturnValue({ value: "state_123" });
    const { GET } = await import("./callback/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/callback?state=state_123&code=code_123"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("auth_error")).toBeNull();
    expect(exchangeFacebookCode).toHaveBeenCalledWith("code_123", "http://localhost/api/auth/facebook/callback");
    expect(validateFacebookOAuthToken).toHaveBeenCalledWith("oauth-token");
    expect(setTokenCookie).toHaveBeenCalledWith("oauth-token");
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_state");
  });
});
