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
      timeoutSeconds: 135,
    }));
    expect(result.source).toBe("apify");
    expect(result.outcome).toBe("matched");
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
        matched: 2,
        mediaReady: 3,
        accepted: 1,
        needsReview: 1,
        rejected: 1,
      },
    ]);
  });

  it("attributes untagged multi-competitor actor rows by advertiser and builds verifiable source URLs", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "data_xplorer/facebook-ads-library");
    runApifyActor
      .mockResolvedValueOnce([{
        adArchiveId: "northstar-ad",
        pageName: "Northstar Fitness",
        bodyText: "28-day strength reset",
        ctaText: "Learn More",
        platforms: ["Facebook", "Instagram"],
        publicationDate: { startDate: "2026-07-01T00:00:00.000Z" },
      }])
      .mockResolvedValueOnce([{
        adArchiveId: "studio-form-ad",
        pageName: "Studio Form",
        bodyText: "Small-group reformer intro",
        ctaText: "Sign Up",
        platforms: ["Instagram"],
        publicationDate: { startDate: "2026-07-02T00:00:00.000Z" },
      }]);

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Northstar Fitness", "Studio Form"],
      country: "VN",
      limit: 6,
      libraryUrls: [],
    });

    expect(result.ads).toEqual([
      expect.objectContaining({
        id: "northstar-ad",
        body: "28-day strength reset",
        cta: "Learn More",
        platform: "Facebook, Instagram",
        startDate: "2026-07-01T00:00:00.000Z",
        snapshotUrl: "https://www.facebook.com/ads/library/?id=northstar-ad",
        evidence: expect.objectContaining({
          requestedCompetitor: "Northstar Fitness",
          advertiser: "Northstar Fitness",
          status: "accepted",
          match: "exact",
        }),
      }),
      expect.objectContaining({
        id: "studio-form-ad",
        evidence: expect.objectContaining({
          requestedCompetitor: "Studio Form",
          advertiser: "Studio Form",
          status: "accepted",
          match: "exact",
        }),
      }),
    ]);
    expect(result.ads.every((ad) => ad.raw === undefined)).toBe(true);
    expect(result.coverage).toEqual([
      { competitor: "Northstar Fitness", collected: 1, matched: 1, mediaReady: 1, accepted: 1, needsReview: 0, rejected: 0 },
      { competitor: "Studio Form", collected: 1, matched: 1, mediaReady: 1, accepted: 1, needsReview: 0, rejected: 0 },
    ]);
  });

  it("normalizes nested image and video media for inline Reel playback", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "data_xplorer/facebook-ads-library");
    runApifyActor.mockResolvedValue([{
      adArchiveId: "reel-ad",
      pageName: "Northstar Fitness",
      bodyText: "Trainer-led Reel",
      mediaType: "VIDEO",
      isActive: true,
      image: { url: "https://images.example/reel-poster.jpg" },
      all_videos: [{ video_hd_url: "https://videos.example/reel.mp4" }],
    }]);

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Northstar Fitness"],
      country: "VN",
      limit: 4,
      libraryUrls: [],
    });

    expect(result.ads[0]).toEqual(expect.objectContaining({
      format: "VIDEO",
      isActive: true,
      imageUrl: "https://images.example/reel-poster.jpg",
      videoUrl: "https://videos.example/reel.mp4",
      evidence: expect.objectContaining({
        hasUsableCreative: true,
        matchedToCompetitor: true,
      }),
    }));
  });

  it("does not auto-verify an exact advertiser match without an openable source", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "vendor/meta-ads");
    runApifyActor.mockResolvedValue([{ pageName: "Northstar Fitness", bodyText: "No source returned" }]);

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Northstar Fitness", "Studio Form"],
      country: "VN",
      limit: 4,
      libraryUrls: [],
    });

    expect(result.ads[0].evidence).toEqual(expect.objectContaining({
      requestedCompetitor: "Northstar Fitness",
      advertiser: "Northstar Fitness",
      status: "needs_review",
      match: "ambiguous",
      sourceUrl: undefined,
    }));
  });

  it("does not fabricate provenance from opaque row IDs or off-domain URLs", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "vendor/meta-ads");
    runApifyActor.mockResolvedValue([
      { id: "row-1", pageName: "Northstar Fitness", bodyText: "Opaque dataset row" },
      {
        id: "row-2",
        pageName: "Northstar Fitness",
        bodyText: "Untrusted link",
        adSnapshotUrl: "https://example.com/ads/library/?id=2",
      },
    ]);

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Northstar Fitness"],
      country: "VN",
      limit: 4,
      libraryUrls: [],
    });

    expect(result.ads).toEqual([
      expect.objectContaining({
        id: "row-1",
        snapshotUrl: undefined,
        evidence: expect.objectContaining({ status: "needs_review", sourceUrl: undefined }),
      }),
      expect.objectContaining({
        id: "row-2",
        snapshotUrl: undefined,
        evidence: expect.objectContaining({ status: "needs_review", sourceUrl: undefined }),
      }),
    ]);
    expect(result.coverage).toEqual([
      { competitor: "Northstar Fitness", collected: 2, matched: 2, mediaReady: 0, accepted: 0, needsReview: 2, rejected: 0 },
    ]);
  });

  it("keeps an unrelated actor row tied to its originating query without matching it", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "vendor/meta-ads");
    runApifyActor.mockResolvedValue([{ adId: "other-ad", pageName: "Unrelated Brand" }]);

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Northstar Fitness", "Studio Form"],
      country: "VN",
      limit: 4,
      libraryUrls: [],
    });

    expect(result.ads[0].evidence).toEqual(expect.objectContaining({
      requestedCompetitor: "Northstar Fitness",
      advertiser: "Unrelated Brand",
      status: "rejected",
      matchedToCompetitor: false,
    }));
    expect(result.outcome).toBe("zero_match");
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
      timeoutSeconds: 135,
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

    expect(runApifyActor).toHaveBeenCalledTimes(4);
    for (const competitor of ["Seoul+Spa", "Hasaki", "Guardian", "Watsons"]) {
      expect(runApifyActor).toHaveBeenCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          urls: [{ url: expect.stringContaining(`q=${competitor}`) }],
          maxAds: 10,
        }),
      }));
    }
  });

  it("keeps name-search targets for competitors without a paired library URL", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "data_xplorer/facebook-ads-library");
    runApifyActor.mockResolvedValue([]);
    const exactUrl = "https://www.facebook.com/ads/library/?view_all_page_id=101";

    await fetchCompetitorAds({
      source: "apify",
      competitors: ["Northstar Fitness", "Studio Form"],
      country: "VN",
      limit: 10,
      libraryUrls: [exactUrl],
    });

    expect(runApifyActor).toHaveBeenCalledTimes(2);
    expect(runApifyActor).toHaveBeenNthCalledWith(1, expect.objectContaining({
      input: { urls: [{ url: exactUrl }], maxAds: 5, fetchDetails: false },
    }));
    expect(runApifyActor).toHaveBeenNthCalledWith(2, expect.objectContaining({
      input: {
        urls: [{ url: expect.stringContaining("q=Studio+Form") }],
        maxAds: 5,
        fetchDetails: false,
      },
    }));
  });

  it("uses the observed advertiser to correct reordered URL attribution", async () => {
    vi.stubEnv("APIFY_TOKEN", "configured-for-test");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "data_xplorer/facebook-ads-library");
    runApifyActor
      .mockResolvedValueOnce([{ adArchiveId: "studio-ad", pageName: "Studio Form", bodyText: "Studio creative" }])
      .mockResolvedValueOnce([{ adArchiveId: "northstar-ad", pageName: "Northstar Fitness", bodyText: "Northstar creative" }]);

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Northstar Fitness", "Studio Form"],
      country: "VN",
      limit: 10,
      libraryUrls: [
        "https://www.facebook.com/ads/library/?view_all_page_id=studio",
        "https://www.facebook.com/ads/library/?view_all_page_id=northstar",
      ],
    });

    expect(result.ads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "studio-ad",
        evidence: expect.objectContaining({ requestedCompetitor: "Studio Form", status: "accepted" }),
      }),
      expect.objectContaining({
        id: "northstar-ad",
        evidence: expect.objectContaining({ requestedCompetitor: "Northstar Fitness", status: "accepted" }),
      }),
    ]));
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
      timeoutSeconds: 135,
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
