import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runApifyActor } = vi.hoisted(() => ({
  runApifyActor: vi.fn(),
}));

vi.mock("../apify", () => ({
  runApifyActor,
}));

import { fetchTikTokAdLibrary, fetchTikTokProfiles } from "../tiktok";

describe("fetchTikTokProfiles", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses the TikTok profile actor and normalizes profile/video rows", async () => {
    vi.stubEnv(
      "APIFY_TIKTOK_PROFILE_ACTOR_ID",
      "clockworks/tiktok-profile-scraper",
    );
    runApifyActor.mockResolvedValue([
      {
        id: "video-1",
        text: "New treatment routine",
        webVideoUrl: "https://www.tiktok.com/@redagency/video/1",
        diggCount: 100,
        playCount: 1000,
        authorMeta: {
          id: "user-1",
          name: "redagency",
          nickName: "Demo Studio",
          signature: "Ads team",
          verified: true,
          fans: 12000,
          following: 10,
          heart: 30000,
          video: 40,
          avatar: "https://images.example/avatar.jpg",
        },
      },
    ]);

    const result = await fetchTikTokProfiles({
      profiles: ["@redagency"],
      resultsPerPage: 5,
    });

    expect(runApifyActor).toHaveBeenCalledWith({
      actorId: "clockworks/tiktok-profile-scraper",
      input: {
        profiles: ["redagency"],
        profileScrapeSections: ["videos"],
        profileSorting: "latest",
        resultsPerPage: 5,
        maxFollowersPerProfile: 0,
        maxFollowingPerProfile: 0,
        commentsPerPost: 0,
        topLevelCommentsPerPost: 0,
        maxRepliesPerComment: 0,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadAvatars: false,
      },
      timeoutSeconds: 240,
    });
    expect(result.profiles[0]).toMatchObject({
      id: "user-1",
      username: "redagency",
      displayName: "Demo Studio",
      bio: "Ads team",
      verified: true,
      followerCount: 12000,
      followingCount: 10,
      likesCount: 30000,
      videoCount: 40,
      avatarUrl: "https://images.example/avatar.jpg",
      profileUrl: "https://www.tiktok.com/@redagency",
    });
    expect(result.videos[0]).toMatchObject({
      id: "video-1",
      username: "redagency",
      text: "New treatment routine",
      videoUrl: "https://www.tiktok.com/@redagency/video/1",
      likeCount: 100,
      playCount: 1000,
    });
  });

  it("returns actor error rows as warnings", async () => {
    runApifyActor.mockResolvedValue([
      {
        input: "missing-user",
        error: "Profile not found",
        errorCode: "not-found",
      },
    ]);

    const result = await fetchTikTokProfiles({
      profiles: ["missing-user"],
      resultsPerPage: 5,
    });

    expect(result.profiles).toEqual([]);
    expect(result.warnings[0]).toContain("missing-user: Profile not found");
  });

  it("supports a TikTok profile actor input template", async () => {
    vi.stubEnv(
      "APIFY_TIKTOK_PROFILE_INPUT_TEMPLATE",
      JSON.stringify({ handles: "{{profiles}}", limit: "{{resultsPerPage}}" }),
    );
    runApifyActor.mockResolvedValue([]);

    await fetchTikTokProfiles({ profiles: ["@redagency"], resultsPerPage: 7 });

    expect(runApifyActor).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { handles: ["redagency"], limit: 7 },
      }),
    );
  });
});

describe("fetchTikTokAdLibrary", () => {
  beforeEach(() => {
    vi.stubEnv("TIKTOK_MEDIA_HASH_MAX_ASSETS", "0");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prefers a configured Commercial Content Library feed over the actor", async () => {
    vi.stubEnv("TIKTOK_CCL_API_URL", "https://ccl.example.test/ads");
    vi.stubEnv("TIKTOK_CCL_ACCESS_TOKEN", "ccl-token");
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            items: [
              {
                "AD ID": "ccl-1",
                "Advertiser Name": "Brand",
                caption: "Launch",
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const report = await fetchTikTokAdLibrary({
      region: "DE",
      queryType: "1",
      query: "Brand",
      maxAds: 5,
      fetchDetails: false,
    });
    expect(report.actorId).toBe("tiktok-commercial-content-library");
    expect(report.matchedAdvertisers).toBe(1);
    expect(
      new URL(String(fetcher.mock.calls[0][0])).searchParams.get("query_type"),
    ).toBe("1");
    expect(runApifyActor).not.toHaveBeenCalled();
  });

  it("uses search-based TikTok ads actor input and normalizes public range metrics", async () => {
    vi.stubEnv(
      "APIFY_TIKTOK_ADS_ACTOR_ID",
      "data_xplorer/tiktok-ads-library-fast",
    );
    runApifyActor.mockResolvedValue([
      {
        "AD ID": "ad-1",
        "Advertiser Name": "Seoul Spa",
        "Ad Title": "Glow Up",
        "AD Preview": "https://library.tiktok.com/ad/ad-1",
        "Ad Dates": "2026-01-01 - 2026-01-31",
        "Ad Audience": { min: 10000, max: 50000 },
        "Ad Details": {
          cta: "Learn more",
          landingUrl: "https://example.com",
          impressions: { lowerBound: 1000, upperBound: 5000 },
          spend: { lowerBound: 100, upperBound: 500 },
        },
        "Ad Media": {
          videoUrl: "https://videos.example/ad.mp4",
          coverUrl: "https://images.example/ad.jpg",
        },
        "Ad Targeting": { regions: ["VN"] },
      },
    ]);

    const result = await fetchTikTokAdLibrary({
      region: "VN",
      queryType: "1",
      query: "spa",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      maxAds: 10,
      fetchDetails: true,
    });

    expect(runApifyActor).toHaveBeenCalledWith({
      actorId: "data_xplorer/tiktok-ads-library-fast",
      input: {
        region: "VN",
        queryType: "1",
        query: "spa",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        maxAds: 10,
        fetchDetails: true,
        proxyConfiguration: { useApifyProxy: true },
      },
      timeoutSeconds: 240,
    });
    expect(result.rows[0]).toMatchObject({
      id: "ad-1",
      advertiserName: "Seoul Spa",
      adTitle: "Glow Up",
      previewUrl: "https://library.tiktok.com/ad/ad-1",
      impressionsLower: 1000,
      impressionsUpper: 5000,
      spendLower: 100,
      spendUpper: 500,
      audienceMin: 10000,
      audienceMax: 50000,
      videoUrl: "https://videos.example/ad.mp4",
      imageUrl: "https://images.example/ad.jpg",
      regions: ["VN"],
    });
    expect(result.warnings.join(" ")).toContain("public TikTok Ad Library");
  });

  it("supports a TikTok ads actor input template", async () => {
    vi.stubEnv(
      "APIFY_TIKTOK_ADS_INPUT_TEMPLATE",
      JSON.stringify({
        market: "{{region}}",
        mode: "{{queryType}}",
        search: "{{query}}",
        window: "{{startDate}}/{{endDate}}",
        limit: "{{maxAds}}",
        details: "{{fetchDetails}}",
      }),
    );
    runApifyActor.mockResolvedValue([]);

    await fetchTikTokAdLibrary({
      region: "VN",
      queryType: "2",
      query: "Seoul Spa",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      maxAds: 12,
      fetchDetails: false,
    });

    expect(runApifyActor).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          market: "VN",
          mode: "2",
          search: "Seoul Spa",
          window: "2026-01-01/2026-01-31",
          limit: 12,
          details: false,
        },
      }),
    );
  });

  it("uses the dual-source Apify actor contract and deduplicates enriched creative rows", async () => {
    runApifyActor.mockResolvedValue([
      {
        materialId: "creative-2",
        brandName: "Brand One",
        title: "A new offer",
        adType: "VIDEO",
        videoUrl: "https://cdn.example/creative-1.mp4",
        ctr: 0.04,
        ctrPercentile: 0.9,
        duration: 12,
        keyframeAnalysis: [{ value: 1 }, { value: 0.8 }, { value: 0.7 }],
        countryCode: "VN",
      },
      {
        materialId: "creative-1",
        brandName: "Brand One",
        title: "A new offer",
        adType: "VIDEO",
        videoUrl: "https://cdn.example/creative-1.mp4",
      },
    ]);

    const result = await fetchTikTokAdLibrary({
      region: "VN",
      queryType: "2",
      query: "offer",
      maxAds: 3,
      fetchDetails: true,
    });

    expect(runApifyActor).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "brilliant_gum/tiktok-ads-library-scraper",
        input: expect.objectContaining({
          source: "creative_center",
          searchTerms: ["offer"],
          countries: ["VN"],
          maxResults: 3,
          resolveAdDetails: true,
          proxyConfiguration: { useApifyProxy: true },
        }),
      }),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: "creative-2",
      advertiserName: "Brand One",
      format: "video",
      durationSeconds: 12,
      hookRetention: 0.83,
      performanceTier: "top",
    });
    expect(result.deduplicatedCount).toBe(1);
    expect(result.pipelineDurationMs).toBeLessThan(15 * 60 * 1000);
    expect(result.deduplicationIntegrity).toBeUndefined();
    expect(result.acceptance).toEqual({
      normalizedWithin15Minutes: true,
      deduplicationAbove99Percent: null,
      deduplicationEvidence: "labeled_cohort_required",
    });
    expect(result.warnings).toContain(
      "Deduplication accuracy remains unvalidated until a labeled cohort is submitted to /api/tiktok/deduplication/validate.",
    );
  });

  it("hashes provider-fetched TikTok media and deduplicates byte-identical creatives", async () => {
    vi.stubEnv("TIKTOK_MEDIA_HASH_MAX_ASSETS", "2");
    const mediaBytes = "same-tiktok-creative";
    const expectedHash = `sha256:${createHash("sha256").update(mediaBytes).digest("hex")}`;
    const mediaFetch = vi.fn(
      async () =>
        new Response(mediaBytes, {
          headers: { "content-type": "video/mp4" },
        }),
    );
    vi.stubGlobal("fetch", mediaFetch);
    runApifyActor.mockResolvedValue([
      {
        materialId: "creative-a",
        brandName: "Brand One",
        title: "Launch A",
        videoUrl: "https://cdn-a.example/creative.mp4",
      },
      {
        materialId: "creative-b",
        brandName: "Brand One",
        title: "Launch B",
        videoUrl: "https://cdn-b.example/creative.mp4",
      },
      {
        materialId: "creative-c",
        brandName: "Brand One",
        title: "Launch C",
        contentSha256: expectedHash,
        videoUrl: "https://cdn-c.example/creative.mp4",
      },
    ]);

    const result = await fetchTikTokAdLibrary({
      region: "VN",
      queryType: "2",
      query: "launch",
      maxAds: 5,
      fetchDetails: true,
    });

    expect(mediaFetch).toHaveBeenCalledTimes(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].contentHash).toBe(expectedHash);
    expect(result.creativeHashing).toMatchObject({
      source: "tiktok_provider_media_sha256",
      totalAssets: 3,
      providerHashAssets: 1,
      fetchedHashAssets: 2,
      metadataFallbackAssets: 0,
      cappedAssets: 0,
      warnings: [],
    });
    expect(result.deduplicatedCount).toBe(2);
  });

  it("selects the advertiser-search source for supported transparency markets", async () => {
    runApifyActor.mockResolvedValue([]);

    await fetchTikTokAdLibrary({
      region: "DE",
      queryType: "1",
      query: "Nike",
      maxAds: 5,
      fetchDetails: false,
    });

    expect(runApifyActor).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "brilliant_gum/tiktok-ads-library-scraper",
        input: expect.objectContaining({
          source: "library",
          searchTerms: ["Nike"],
          countries: ["DE"],
          maxResults: 5,
        }),
      }),
    );
  });
});
