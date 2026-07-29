import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, cookies, hasTokenSession } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn() },
  cookies: vi.fn(),
  hasTokenSession: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ hasTokenSession }));
vi.mock("next/headers", () => ({ cookies }));

import { GET } from "./route";

describe("GET /api/connectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APIFY_TOKEN;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_ACCESS_TOKEN;
    delete process.env.YOUTUBE_ACCESS_TOKEN;
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.GA4_ACCESS_TOKEN;
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.TIKTOK_CCL_API_URL;
    delete process.env.TIKTOK_CCL_ACCESS_TOKEN;
    cookieStore.get.mockReturnValue(undefined);
    cookies.mockResolvedValue(cookieStore);
  });

  it("returns honest connector states without secrets", async () => {
    hasTokenSession.mockResolvedValue(false);
    process.env.APIFY_TOKEN = "apify-secret";
    const response = await GET();
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(
      json.connectors.find(
        (item: { id: string }) => item.id === "tiktok_public",
      ).state,
    ).toBe("available");
    expect(
      json.connectors.find((item: { id: string }) => item.id === "google_ads")
        .state,
    ).toBe("needs_setup");
    expect(JSON.stringify(json)).not.toContain("apify-secret");
  });

  it("does not present scheduled server tokens as interactive connections", async () => {
    hasTokenSession.mockResolvedValue(false);
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer";
    process.env.GOOGLE_ADS_CUSTOMER_ID = "123";
    process.env.GA4_PROPERTY_ID = "456";
    process.env.GOOGLE_ADS_ACCESS_TOKEN = "server-google-token";
    process.env.GA4_ACCESS_TOKEN = "server-ga4-token";
    process.env.LINKEDIN_CLIENT_ID = "linkedin-client";
    process.env.LINKEDIN_CLIENT_SECRET = "linkedin-secret";
    process.env.LINKEDIN_AD_ACCOUNT_ID = "789";
    process.env.LINKEDIN_ACCESS_TOKEN = "server-linkedin-token";

    const response = await GET();
    const json = await response.json();

    expect(
      json.connectors
        .filter((item: { id: string }) =>
          ["google_ads", "youtube_analytics", "ga4_attribution", "linkedin_ads"].includes(item.id),
        )
        .every((item: { state: string }) => item.state === "needs_connection"),
    ).toBe(true);
    expect(JSON.stringify(json)).not.toContain("server-google-token");
    expect(JSON.stringify(json)).not.toContain("server-linkedin-token");
  });
});
