import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearServerConnectorTokenCacheForTests,
  resolveServerConnectorAccessToken,
} from "@/lib/server-connector-auth";

describe("scheduled connector OAuth", () => {
  beforeEach(() => clearServerConnectorTokenCacheForTests());

  it("uses a directly managed server token when no refresh token exists", async () => {
    await expect(
      resolveServerConnectorAccessToken({
        platform: "youtube",
        env: { YOUTUBE_ACCESS_TOKEN: "managed-access-token" },
      }),
    ).resolves.toBe("managed-access-token");
  });

  it("refreshes and caches Google access for scheduled Ads and YouTube jobs", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ access_token: "refreshed-google", expires_in: 3600 }),
          { status: 200 },
        ),
    );
    const env = {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      GOOGLE_REFRESH_TOKEN: "google-refresh",
    };

    await expect(
      resolveServerConnectorAccessToken({
        platform: "google_ads",
        env,
        fetchFn: fetchFn as typeof fetch,
        now: 1_000,
      }),
    ).resolves.toBe("refreshed-google");
    await expect(
      resolveServerConnectorAccessToken({
        platform: "youtube",
        env,
        fetchFn: fetchFn as typeof fetch,
        now: 2_000,
      }),
    ).resolves.toBe("refreshed-google");

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(String(fetchFn.mock.calls[0][0])).toBe(
      "https://oauth2.googleapis.com/token",
    );
    expect(String(fetchFn.mock.calls[0][1]?.body)).toContain(
      "refresh_token=google-refresh",
    );
  });

  it("refreshes LinkedIn scheduled access with LinkedIn client credentials", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ access_token: "refreshed-linkedin", expires_in: 3600 }),
          { status: 200 },
        ),
    );

    await expect(
      resolveServerConnectorAccessToken({
        platform: "linkedin",
        env: {
          LINKEDIN_CLIENT_ID: "linkedin-client",
          LINKEDIN_CLIENT_SECRET: "linkedin-secret",
          LINKEDIN_REFRESH_TOKEN: "linkedin-refresh",
        },
        fetchFn: fetchFn as typeof fetch,
      }),
    ).resolves.toBe("refreshed-linkedin");
    expect(String(fetchFn.mock.calls[0][0])).toBe(
      "https://www.linkedin.com/oauth/v2/accessToken",
    );
  });

  it("continues with a rotated refresh token while the server instance is warm", async () => {
    const now = Date.now();
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify(
            fetchFn.mock.calls.length === 1
              ? {
                  access_token: "first-access",
                  refresh_token: "rotated-refresh",
                  expires_in: 60,
                }
              : { access_token: "second-access", expires_in: 3600 },
          ),
          { status: 200 },
        ),
    );
    const env = {
      LINKEDIN_CLIENT_ID: "linkedin-client",
      LINKEDIN_CLIENT_SECRET: "linkedin-secret",
      LINKEDIN_REFRESH_TOKEN: "initial-refresh",
    };

    await resolveServerConnectorAccessToken({
      platform: "linkedin",
      env,
      fetchFn: fetchFn as typeof fetch,
      now,
    });
    await resolveServerConnectorAccessToken({
      platform: "linkedin",
      env,
      fetchFn: fetchFn as typeof fetch,
      now: now + 120_000,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[1][1]?.body)).toContain(
      "refresh_token=rotated-refresh",
    );
  });

  it("fails honestly when refresh credentials are incomplete", async () => {
    await expect(
      resolveServerConnectorAccessToken({
        platform: "google_ads",
        env: { GOOGLE_REFRESH_TOKEN: "refresh-without-client" },
      }),
    ).rejects.toThrow("client credentials");
  });
});
