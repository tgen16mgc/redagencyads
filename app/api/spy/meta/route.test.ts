import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchCompetitorAds, requireToken } = vi.hoisted(() => ({
  fetchCompetitorAds: vi.fn(),
  requireToken: vi.fn(),
}));

vi.mock("@/lib/competitor-spy", () => ({ fetchCompetitorAds }));
vi.mock("@/lib/session", () => ({ requireToken }));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/spy/meta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/spy/meta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses Apify collection by default", async () => {
    fetchCompetitorAds.mockResolvedValue({
      source: "apify",
      ads: [],
      coverage: [],
      warnings: [],
      fetchedAt: "2026-07-14T00:00:00.000Z",
    });

    const response = await POST(request({ competitors: ["Seoul Spa"] }));

    expect(response.status).toBe(200);
    expect(fetchCompetitorAds).toHaveBeenCalledWith(expect.objectContaining({
      source: "apify",
      competitors: ["Seoul Spa"],
    }));
  });

  it("returns service unavailable when evidence collection is not configured", async () => {
    fetchCompetitorAds.mockRejectedValue(
      new Error("Competitor evidence collection requires APIFY_TOKEN and APIFY_META_ADS_ACTOR_ID."),
    );

    const response = await POST(request({ competitors: ["Seoul Spa"] }));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toContain("requires APIFY_TOKEN");
  });

  it("rejects requests without competitors or library URLs", async () => {
    const response = await POST(request({ competitors: [] }));

    expect(response.status).toBe(400);
    expect(fetchCompetitorAds).not.toHaveBeenCalled();
  });

  it("bounds competitor input before invoking the paid actor", async () => {
    const response = await POST(request({ competitors: Array.from({ length: 9 }, (_, index) => `Brand ${index}`) }));

    expect(response.status).toBe(400);
    expect(fetchCompetitorAds).not.toHaveBeenCalled();
  });

  it("does not invoke the paid actor for untrusted library URLs", async () => {
    const response = await POST(request({
      competitors: [],
      libraryUrls: [
        "http://www.facebook.com/ads/library/?id=1",
        "https://example.com/ads/library/?id=2",
        "https://www.facebook.com/ads/library-fake?id=3",
      ],
    }));

    expect(response.status).toBe(400);
    expect(fetchCompetitorAds).not.toHaveBeenCalled();
  });
});
