import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookieStore,
  cookies,
  buildFacebookOAuthUrl,
  buildFacebookOAuthReturnUrl,
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
    buildFacebookOAuthReturnUrl: vi.fn(),
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
  FACEBOOK_OAUTH_RETURN_COOKIE: "meta_facebook_oauth_return",
  FACEBOOK_OAUTH_STATE_MAX_AGE_SECONDS: 600,
  buildFacebookOAuthUrl,
  buildFacebookOAuthReturnUrl,
  createFacebookOAuthState,
  exchangeFacebookCode,
  getFacebookOAuthRedirectUri,
  parseFacebookOAuthReturnDestination: (value: string | null | undefined) => value === "ads" || value === "publisher" ? value : undefined,
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
    buildFacebookOAuthReturnUrl.mockImplementation((request: Request, destination?: string, error?: boolean) => {
      const url = new URL("/", request.url);
      if (destination) url.searchParams.set("view", destination);
      if (error) url.searchParams.set("auth_error", "Facebook Login could not finish. Try again or use a Meta access token.");
      return url;
    });
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

  it("stores an allowlisted return destination with the OAuth transaction", async () => {
    const { GET } = await import("./start/route");

    await GET(new Request("http://localhost/api/auth/facebook/start?returnTo=publisher"));

    expect(cookieStore.set).toHaveBeenCalledWith(
      "meta_facebook_oauth_return",
      "publisher",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" }),
    );
  });

  it("rejects arbitrary return destinations and clears a stale destination", async () => {
    const { GET } = await import("./start/route");

    await GET(new Request("http://localhost/api/auth/facebook/start?returnTo=https://evil.example"));

    expect(cookieStore.set).not.toHaveBeenCalledWith("meta_facebook_oauth_return", expect.anything(), expect.anything());
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_return");
  });

  it("redirects home with an error when start cannot build the Facebook URL", async () => {
    buildFacebookOAuthUrl.mockImplementation(() => {
      throw new Error("META_APP_ID is required for Facebook login.");
    });
    const { GET } = await import("./start/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/start"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("auth_error")).toBe("Facebook Login could not finish. Try again or use a Meta access token.");
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_state");
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_return");
  });

  it("rejects callback state mismatches", async () => {
    cookieStore.get.mockImplementation((name: string) => name === "meta_facebook_oauth_state" ? { value: "expected_state" } : { value: "ads" });
    const { GET } = await import("./callback/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/callback?state=wrong&code=code_123"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.searchParams.get("view")).toBe("ads");
    expect(location.searchParams.get("auth_error")).toBe("Facebook Login could not finish. Try again or use a Meta access token.");
    expect(exchangeFacebookCode).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_state");
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_return");
  });

  it("handles Facebook callback errors", async () => {
    cookieStore.get.mockImplementation((name: string) => name === "meta_facebook_oauth_state" ? { value: "state_123" } : { value: "publisher" });
    const { GET } = await import("./callback/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/callback?state=state_123&error_description=Denied"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.searchParams.get("view")).toBe("publisher");
    expect(location.searchParams.get("auth_error")).toBe("Facebook Login could not finish. Try again or use a Meta access token.");
    expect(exchangeFacebookCode).not.toHaveBeenCalled();
  });

  it("exchanges a valid callback code and stores the encrypted token session", async () => {
    cookieStore.get.mockImplementation((name: string) => name === "meta_facebook_oauth_state" ? { value: "state_123" } : { value: "ads" });
    const { GET } = await import("./callback/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/callback?state=state_123&code=code_123"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("view")).toBe("ads");
    expect(location.searchParams.get("auth_error")).toBeNull();
    expect(exchangeFacebookCode).toHaveBeenCalledWith("code_123", "http://localhost/api/auth/facebook/callback");
    expect(validateFacebookOAuthToken).toHaveBeenCalledWith("oauth-token");
    expect(setTokenCookie).toHaveBeenCalledWith("oauth-token");
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_state");
    expect(cookieStore.delete).toHaveBeenCalledWith("meta_facebook_oauth_return");
  });

  it("logs the callback stage when permission validation fails", async () => {
    cookieStore.get.mockImplementation((name: string) => name === "meta_facebook_oauth_state" ? { value: "state_123" } : { value: "ads" });
    validateFacebookOAuthToken.mockRejectedValueOnce(new Error("Missing permissions"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await import("./callback/route");

    await GET(new Request("http://localhost/api/auth/facebook/callback?state=state_123&code=code_123"));

    expect(consoleError).toHaveBeenCalledWith("[DEBUG-meta-oauth]", {
      stage: "permissions",
      message: "Missing permissions",
    });
    consoleError.mockRestore();
  });

  it("falls back to the root when the stored destination is malicious", async () => {
    cookieStore.get.mockImplementation((name: string) => name === "meta_facebook_oauth_state" ? { value: "state_123" } : { value: "javascript:alert(1)" });
    const { GET } = await import("./callback/route");

    const response = await GET(new Request("http://localhost/api/auth/facebook/callback?state=state_123&code=code_123"));
    const location = new URL(response.headers.get("location") || "");

    expect(location.toString()).toBe("http://localhost/");
  });
});
