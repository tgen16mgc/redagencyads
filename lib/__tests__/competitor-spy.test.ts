import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCompetitorAds } from "../competitor-spy";

describe("fetchCompetitorAds", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns no-key public evidence cards when Apify credentials are missing", async () => {
    vi.stubEnv("APIFY_TOKEN", "");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "");

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Seoul Spa"],
      country: "VN",
      limit: 5,
      libraryUrls: [],
    });

    expect(result.source).toBe("public");
    expect(result.ads).toHaveLength(1);
    expect(result.ads[0]).toMatchObject({
      competitorName: "Seoul Spa",
      pageName: "Seoul Spa",
      source: "public",
      headline: "Open Meta Ad Library search",
    });
    expect(result.ads[0].snapshotUrl).toContain("facebook.com/ads/library");
    expect(result.warnings.join(" ")).toContain("No Apify credentials");
  });
});
