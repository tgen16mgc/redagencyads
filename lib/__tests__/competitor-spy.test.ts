import { afterEach, describe, expect, it, vi } from "vitest";

const { runApifyActor } = vi.hoisted(() => ({
  runApifyActor: vi.fn(),
}));

vi.mock("@/lib/apify", () => ({ runApifyActor }));

import { fetchCompetitorAds, parsePublicMetaLibraryHtml } from "../competitor-spy";

describe("fetchCompetitorAds", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires an Apify token and Meta Ads actor instead of falling back to public links", async () => {
    vi.stubEnv("APIFY_TOKEN", "");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "");

    await expect(fetchCompetitorAds({
      source: "apify",
      competitors: ["Seoul Spa"],
      country: "VN",
      limit: 5,
      libraryUrls: [],
    })).rejects.toThrow("Competitor evidence collection requires APIFY_TOKEN and APIFY_META_ADS_ACTOR_ID.");

    expect(runApifyActor).not.toHaveBeenCalled();
  });

  it("classifies Apify rows conservatively and reports evidence coverage", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "vendor/meta-ads");
    runApifyActor.mockResolvedValue([
      {
        id: "exact-ad",
        query: "Seoul Spa",
        pageName: "Seoul Spa",
        adText: "Exact advertiser evidence",
        adSnapshotUrl: "https://www.facebook.com/ads/library/?id=1",
      },
      {
        id: "ambiguous-ad",
        query: "Seoul Spa",
        pageName: "Seoul Spa Vietnam",
        adText: "Similar advertiser evidence",
        adSnapshotUrl: "https://www.facebook.com/ads/library/?id=2",
      },
      {
        id: "mismatch-ad",
        query: "Seoul Spa",
        pageName: "Unrelated Clinic",
        adText: "Wrong advertiser evidence",
        adSnapshotUrl: "https://www.facebook.com/ads/library/?id=3",
      },
    ]);

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Seoul Spa"],
      country: "VN",
      limit: 10,
      libraryUrls: [],
    });

    expect(runApifyActor).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "vendor/meta-ads",
      timeoutSeconds: 285,
    }));
    expect(result.source).toBe("apify");
    expect(result.ads.map((ad) => ad.evidence)).toEqual([
      expect.objectContaining({
        status: "accepted",
        match: "exact",
        requestedCompetitor: "Seoul Spa",
        advertiser: "Seoul Spa",
        sourceUrl: "https://www.facebook.com/ads/library/?id=1",
        collectedAt: result.fetchedAt,
      }),
      expect.objectContaining({
        status: "needs_review",
        match: "ambiguous",
        requestedCompetitor: "Seoul Spa",
        advertiser: "Seoul Spa Vietnam",
      }),
      expect.objectContaining({
        status: "rejected",
        match: "mismatch",
        requestedCompetitor: "Seoul Spa",
        advertiser: "Unrelated Clinic",
      }),
    ]);
    expect(result.coverage).toEqual([
      {
        competitor: "Seoul Spa",
        collected: 3,
        accepted: 1,
        needsReview: 1,
        rejected: 1,
      },
    ]);
  });

  it("builds the required urls input for the data_xplorer Facebook Ads actor", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "data_xplorer/facebook-ads-library");
    runApifyActor.mockResolvedValue([]);

    await fetchCompetitorAds({
      source: "apify",
      competitors: ["Seoul Spa"],
      country: "VN",
      limit: 7,
      libraryUrls: [],
    });

    expect(runApifyActor).toHaveBeenCalledWith({
      actorId: "data_xplorer/facebook-ads-library",
      input: {
        urls: [{ url: expect.stringContaining("facebook.com/ads/library") }],
        maxAds: 7,
        fetchDetails: false,
      },
      timeoutSeconds: 285,
    });
  });

  it("keeps the requested ad limit total across multiple competitor URLs", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "data_xplorer/facebook-ads-library");
    runApifyActor.mockResolvedValue([]);

    await fetchCompetitorAds({
      source: "apify",
      competitors: ["Seoul Spa", "Hasaki", "Guardian", "Watsons"],
      country: "VN",
      limit: 40,
      libraryUrls: [],
    });

    expect(runApifyActor).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        urls: expect.arrayContaining([
          { url: expect.stringContaining("q=Seoul+Spa") },
          { url: expect.stringContaining("q=Hasaki") },
          { url: expect.stringContaining("q=Guardian") },
          { url: expect.stringContaining("q=Watsons") },
        ]),
        maxAds: 10,
      }),
    }));
  });

  it("recovers from a stale actor template when input.urls is required", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "data_xplorer/facebook-ads-library");
    vi.stubEnv("APIFY_META_ADS_INPUT_TEMPLATE", JSON.stringify({
      searchQueries: "{{competitors}}",
      maxItems: "{{limit}}",
    }));
    runApifyActor
      .mockRejectedValueOnce(new Error("Input is not valid: Field input.urls is required"))
      .mockResolvedValueOnce([]);

    await fetchCompetitorAds({
      source: "apify",
      competitors: ["Seoul Spa"],
      country: "VN",
      limit: 7,
      libraryUrls: [],
    });

    expect(runApifyActor).toHaveBeenNthCalledWith(2, {
      actorId: "data_xplorer/facebook-ads-library",
      input: {
        urls: [{ url: expect.stringContaining("facebook.com/ads/library") }],
        maxAds: 7,
        fetchDetails: false,
      },
      timeoutSeconds: 285,
    });
  });

  it("extracts ad cards from public Meta Ad Library HTML", () => {
    const html = String.raw`
      <script>
        require("RelayPrefetchedStreamCache").next({"__bbox":{"result":{
          "data":{
            "ad_archive_id":"987654321",
            "page_name":"Seoul Spa",
            "publisher_platform":["FACEBOOK","INSTAGRAM"],
            "snapshot":{
              "body":{"text":"Book a skin consultation today"},
              "title":"Clear skin plan",
              "caption":"seoulspa.vn",
              "cta_text":"Send message",
              "link_url":"https:\/\/seoulspa.vn\/consult",
              "images":[{"resized_image_url":"https:\/\/images.example\/ad.jpg"}],
              "videos":[{"video_hd_url":"https:\/\/videos.example\/ad.mp4"}]
            },
            "start_date":1779778800,
            "ad_snapshot_url":"https:\/\/www.facebook.com\/ads\/library\/?id=987654321"
          }
        }});
      </script>
    `;

    const ads = parsePublicMetaLibraryHtml(html, {
      competitorName: "Seoul Spa",
      sourceUrl: "https://www.facebook.com/ads/library/?q=Seoul%20Spa",
      limit: 5,
    });

    expect(ads).toHaveLength(1);
    expect(ads[0]).toMatchObject({
      id: "987654321",
      source: "public",
      competitorName: "Seoul Spa",
      pageName: "Seoul Spa",
      platform: "FACEBOOK, INSTAGRAM",
      body: "Book a skin consultation today",
      headline: "Clear skin plan",
      cta: "Send message",
      landingUrl: "https://seoulspa.vn/consult",
      snapshotUrl: "https://www.facebook.com/ads/library/?id=987654321",
      imageUrl: "https://images.example/ad.jpg",
      videoUrl: "https://videos.example/ad.mp4",
    });
    expect(ads[0].startDate).toContain("2026");
  });
});
