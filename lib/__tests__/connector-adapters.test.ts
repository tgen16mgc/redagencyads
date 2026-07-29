import { describe, expect, it, vi } from "vitest";
import {
  buildOAuthAuthorizationUrl,
  enrichConnectorCreativeContentHashes,
  fetchGoogleAdsCampaignLearningState,
  fetchGoogleAdsRows,
  fetchLinkedInB2BBreakdown,
  fetchLinkedInRows,
  fetchYouTubeAnalyticsRows,
  normalizeGoogleAdsRows,
  normalizeLinkedInRows,
  normalizeYouTubeAnalyticsRows,
  pauseGoogleAdsCampaign,
  refreshOAuthToken,
  replaceGoogleAdsCampaignDaypartSchedule,
  rollupLinkedInJobTitles,
  rollupLinkedInTargetAccounts,
  updateGoogleAdsCampaignBudget,
} from "@/lib/connector-adapters";

describe("connector adapters", () => {
  it("builds provider OAuth URLs with scopes and state", () => {
    const url = buildOAuthAuthorizationUrl(
      {
        provider: "google",
        clientId: "client",
        redirectUri: "https://app.test/callback",
        scopes: ["scope.one"],
        authorizationEndpoint: "https://accounts.test/auth",
        tokenEndpoint: "https://accounts.test/token",
      },
      "state",
    );
    expect(url.searchParams.get("client_id")).toBe("client");
    expect(url.searchParams.get("scope")).toBe("scope.one");
    expect(url.searchParams.get("state")).toBe("state");
  });

  it("refreshes OAuth tokens while retaining a provider that omits refresh-token rotation", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ access_token: "next-access", expires_in: 3600 }),
          { status: 200 },
        ),
    );
    const token = await refreshOAuthToken(
      {
        provider: "google",
        clientId: "client",
        clientSecret: "secret",
        redirectUri: "https://app.test/callback",
        scopes: [],
        authorizationEndpoint: "https://accounts.test/auth",
        tokenEndpoint: "https://accounts.test/token",
      },
      "existing-refresh",
      fetchFn as typeof fetch,
    );
    const init = fetchFn.mock.calls[0][1];
    expect(String(init?.body)).toContain("grant_type=refresh_token");
    expect(String(init?.body)).toContain("refresh_token=existing-refresh");
    expect(token).toMatchObject({
      accessToken: "next-access",
      refreshToken: "existing-refresh",
    });
  });

  it("normalizes production-shaped Google Ads rows without collapsing ads in one campaign", () => {
    const result = normalizeGoogleAdsRows(
      [
        {
          date: "2026-07-01",
          contentSha256: "a".repeat(64),
          campaign: { id: "c1", name: "Search" },
          adGroup: { id: "g1", name: "Group" },
          adGroupAd: {
            ad: {
              id: "a1",
              name: "Ad one",
              type: "RESPONSIVE_SEARCH_AD",
              finalUrls: ["https://example.test/one"],
              responsiveSearchAd: {
                headlines: [{ text: "First headline" }],
                descriptions: [{ text: "First description" }],
              },
            },
          },
          metrics: {
            costMicros: "2500000",
            impressions: "1000",
            clicks: "40",
            conversions: 4,
            conversionsValue: 20,
          },
        },
        {
          date: "2026-07-01",
          campaign: { id: "c1", name: "Search" },
          adGroup: { id: "g1", name: "Group" },
          adGroupAd: {
            ad: {
              id: "a2",
              name: "Ad two",
              type: "VIDEO_AD",
              finalUrls: ["https://example.test/two"],
            },
          },
          metrics: {
            costMicros: 1000000,
            impressions: 500,
            clicks: 20,
            conversions: 2,
            conversionsValue: 8,
          },
        },
      ],
      "2026-07-02",
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      id: "google_ads:a1:2026-07-01",
      platform: "google_ads",
      spend: 2.5,
      conversions: 4,
      grain: "ad",
    });
    expect(result.creatives[0]).toMatchObject({
      title: "First headline",
      caption: "First description",
      format: "text",
      landingUrl: "https://example.test/one",
      contentHash: `sha256:${"a".repeat(64)}`,
      fingerprintMethod: "content_sha256",
    });
    expect(result.creatives[0].creativeId).toBe(`creative:${"a".repeat(64)}`);
    expect(result.creatives[1].format).toBe("video");
    expect(result.rows[0].creativeId).toBe(result.creatives[0].creativeId);
  });

  it("keeps YouTube and LinkedIn native signals without inventing spend", () => {
    const youtube = normalizeYouTubeAnalyticsRows(
      [{ video: "v1", day: "2026-07-01", views: 100, watchTimeMinutes: 20 }],
      "2026-07-02",
    );
    const linkedin = normalizeLinkedInRows(
      [
        {
          id: "li1",
          date: "2026-07-01",
          impressions: 200,
          clicks: 10,
          leadGenFormFills: 3,
        },
      ],
      "2026-07-02",
    );
    expect(youtube.rows[0]).toMatchObject({
      platform: "youtube",
      impressions: 100,
      spend: 0,
      videoViews: 100,
      viewThroughConversions: 0,
      watchTimeMinutes: 20,
    });
    expect(linkedin.rows[0]).toMatchObject({
      platform: "linkedin",
      impressions: 200,
      clicks: 10,
      spend: 0,
    });
    expect(youtube.rows[0].creativeId).toBe(youtube.creatives[0].creativeId);
    expect(linkedin.rows[0].creativeId).toBe(linkedin.creatives[0].creativeId);
  });

  it("streams provider media into one SHA-256 creative identity across platforms", async () => {
    const mediaUrl = "https://media.example.test/shared-creative.png";
    const google = normalizeGoogleAdsRows(
      [
        {
          date: "2026-07-29",
          campaign: { id: "google-campaign" },
          adGroupAd: {
            ad: {
              id: "google-ad",
              type: "IMAGE_AD",
              imageAd: { imageUrl: mediaUrl },
            },
          },
          metrics: { impressions: 100 },
        },
      ],
      "2026-07-29",
    );
    const linkedin = normalizeLinkedInRows(
      [
        {
          id: "linkedin-row",
          date: "2026-07-29",
          creative: {
            id: "linkedin-ad",
            type: "IMAGE",
            imageUrl: mediaUrl,
          },
        },
      ],
      "2026-07-29",
    );
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(new TextEncoder().encode("identical-media-bytes"), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );

    const googleEnriched = await enrichConnectorCreativeContentHashes({
      result: google,
      fetchFn: fetchFn as typeof fetch,
    });
    const linkedinEnriched = await enrichConnectorCreativeContentHashes({
      result: linkedin,
      fetchFn: fetchFn as typeof fetch,
    });

    expect(googleEnriched.creatives[0]).toMatchObject({
      fingerprintMethod: "content_sha256",
      contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    expect(googleEnriched.creatives[0].creativeId).toBe(
      linkedinEnriched.creatives[0].creativeId,
    );
    expect(googleEnriched.rows[0].creativeId).toBe(
      googleEnriched.creatives[0].creativeId,
    );
    expect(linkedinEnriched.rows[0].creativeId).toBe(
      linkedinEnriched.creatives[0].creativeId,
    );
  });

  it("keeps metadata fingerprints when provider media exceeds the hashing limit", async () => {
    const result = normalizeYouTubeAnalyticsRows(
      [
        {
          day: "2026-07-29",
          video: "video-1",
          thumbnailUrl: "https://i.ytimg.com/vi/video-1/maxresdefault.jpg",
        },
      ],
      "2026-07-29",
    );
    const originalCreativeId = result.creatives[0].creativeId;
    const enriched = await enrichConnectorCreativeContentHashes({
      result,
      maxBytes: 4,
      fetchFn: vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response(new TextEncoder().encode("too-large"), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          }),
      ) as typeof fetch,
    });

    expect(enriched.creatives[0].creativeId).toBe(originalCreativeId);
    expect(enriched.warnings.join(" ")).toContain("hashing limit");
  });

  it("sends the expected Google Ads search-stream request", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify([
            {
              results: [
                { segments: { date: "2026-07-01" }, campaign: { id: "c1" } },
              ],
            },
          ]),
          { status: 200 },
        ),
    );
    const rows = await fetchGoogleAdsRows({
      accessToken: "access",
      customerId: "123-456",
      developerToken: "developer",
      loginCustomerId: "987-654",
      since: "2026-07-01",
      until: "2026-07-07",
      fetchFn: fetchFn as typeof fetch,
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain(
      "/v25/customers/123456/googleAds:searchStream",
    );
    expect(init?.headers).toMatchObject({
      authorization: "Bearer access",
      "developer-token": "developer",
      "login-customer-id": "987654",
    });
    expect(JSON.parse(String(init?.body)).query).toContain(
      "segments.date BETWEEN '2026-07-01' AND '2026-07-07'",
    );
    expect(rows[0]).toMatchObject({
      date: "2026-07-01",
      campaign: { id: "c1" },
    });
  });

  it("updates a Google Ads campaign budget in micros", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            results: [{ resourceName: "customers/123456/campaignBudgets/789" }],
          }),
          { status: 200 },
        ),
    );
    const result = await updateGoogleAdsCampaignBudget({
      accessToken: "access",
      customerId: "123-456",
      developerToken: "developer",
      loginCustomerId: "987-654",
      campaignBudgetId: "campaignBudgets/789",
      amount: 125.5,
      fetchFn: fetchFn as typeof fetch,
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain(
      "/v25/customers/123456/campaignBudgets:mutate",
    );
    expect(init?.headers).toMatchObject({
      authorization: "Bearer access",
      "developer-token": "developer",
      "login-customer-id": "987654",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      operations: [
        {
          update: {
            resourceName: "customers/123456/campaignBudgets/789",
            amountMicros: "125500000",
          },
          updateMask: "amount_micros",
        },
      ],
      partialFailure: false,
      validateOnly: false,
    });
    expect(result).toMatchObject({
      resourceName: "customers/123456/campaignBudgets/789",
      amountMicros: 125500000,
    });
  });

  it("rejects a Google Ads campaign budget from another customer", async () => {
    await expect(
      updateGoogleAdsCampaignBudget({
        accessToken: "access",
        customerId: "123",
        developerToken: "developer",
        campaignBudgetId: "customers/999/campaignBudgets/789",
        amount: 100,
        fetchFn: vi.fn() as typeof fetch,
      }),
    ).rejects.toThrow("different customer");
  });

  it("pauses a Google Ads campaign through the campaign mutate endpoint", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            results: [{ resourceName: "customers/123/campaigns/456" }],
          }),
          { status: 200 },
        ),
    );
    await pauseGoogleAdsCampaign({
      accessToken: "access",
      customerId: "123",
      developerToken: "developer",
      campaignId: "campaigns/456",
      fetchFn: fetchFn as typeof fetch,
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("/customers/123/campaigns:mutate");
    expect(JSON.parse(String(init?.body)).operations[0]).toEqual({
      update: { resourceName: "customers/123/campaigns/456", status: "PAUSED" },
      updateMask: "status",
    });
  });

  it("reads Google Ads bidding-strategy learning state for deferred actions", async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify([
            {
              results: [
                {
                  campaign: {
                    id: "456",
                    campaignBudget: "customers/123/campaignBudgets/789",
                    biddingStrategySystemStatus: "LEARNING_BUDGET_CHANGE",
                  },
                },
              ],
            },
          ]),
          { status: 200 },
        ),
    );
    const state = await fetchGoogleAdsCampaignLearningState({
      accessToken: "access",
      customerId: "123",
      developerToken: "developer",
      campaignId: "campaigns/456",
      fetchFn: fetchFn as typeof fetch,
    });
    const [url, init] = fetchFn.mock.calls[0];

    expect(String(url)).toContain("/customers/123/googleAds:searchStream");
    expect(JSON.parse(String(init?.body)).query).toContain(
      "campaign.bidding_strategy_system_status",
    );
    expect(state).toEqual({
      campaignId: "456",
      resourceName: "customers/123/campaigns/456",
      campaignBudgetId: "customers/123/campaignBudgets/789",
      status: "LEARNING_BUDGET_CHANGE",
    });
  });

  it("replaces existing Google Ads daypart criteria before creating the new schedule", async () => {
    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) =>
        String(input).includes("googleAds:searchStream")
          ? new Response(
              JSON.stringify([
                {
                  results: [
                    {
                      campaignCriterion: {
                        resourceName: "customers/123/campaignCriteria/old",
                      },
                    },
                  ],
                },
              ]),
              { status: 200 },
            )
          : new Response(
              JSON.stringify({
                results: [
                  { resourceName: "customers/123/campaignCriteria/new" },
                ],
              }),
              { status: 200 },
            ),
    );
    const result = await replaceGoogleAdsCampaignDaypartSchedule({
      accessToken: "access",
      customerId: "123",
      developerToken: "developer",
      campaignId: "456",
      rules: [{ day: 1, startHour: 9, endHour: 18, bidMultiplier: 1.1 }],
      fetchFn: fetchFn as typeof fetch,
    });
    const [, mutateInit] = fetchFn.mock.calls[1];
    const operations = JSON.parse(String(mutateInit?.body)).operations;
    expect(operations[0]).toEqual({
      remove: "customers/123/campaignCriteria/old",
    });
    expect(operations[1].create).toMatchObject({
      campaign: "customers/123/campaigns/456",
      adSchedule: { dayOfWeek: "MONDAY", startHour: 9, endHour: 18 },
      bidModifier: 1.1,
    });
    expect(result).toMatchObject({ removed: 1, created: 1 });
  });

  it("sends the expected YouTube and LinkedIn reporting requests", async () => {
    const youtubeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            columnHeaders: [
              { name: "day" },
              { name: "video" },
              { name: "views" },
            ],
            rows: [["2026-07-01", "video-1", 100]],
          }),
          { status: 200 },
        ),
    );
    const youtubeRows = await fetchYouTubeAnalyticsRows({
      accessToken: "yt",
      channelId: "channel-1",
      since: "2026-07-01",
      until: "2026-07-07",
      fetchFn: youtubeFetch as typeof fetch,
    });
    const youtubeUrl = new URL(String(youtubeFetch.mock.calls[0][0]));
    expect(youtubeUrl.searchParams.get("ids")).toBe("channel==channel-1");
    expect(youtubeUrl.searchParams.get("dimensions")).toBe("day,video");
    expect(youtubeUrl.searchParams.get("startIndex")).toBe("1");
    expect(youtubeRows[0]).toEqual({
      day: "2026-07-01",
      video: "video-1",
      views: 100,
    });

    const linkedinFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            elements: [
              { pivotValues: ["urn:li:sponsoredCampaign:44"], impressions: 20 },
            ],
          }),
          { status: 200 },
        ),
    );
    const linkedinRows = await fetchLinkedInRows({
      accessToken: "li",
      accountId: "123-456",
      since: "2026-07-01",
      until: "2026-07-07",
      fetchFn: linkedinFetch as typeof fetch,
    });
    const [linkedinRequest, linkedinInit] = linkedinFetch.mock.calls[0];
    const linkedinUrl = new URL(String(linkedinRequest));
    expect(linkedinUrl.searchParams.get("accounts")).toBe(
      "List(urn:li:sponsoredAccount:123456)",
    );
    expect(linkedinUrl.searchParams.get("pivot")).toBe("CAMPAIGN");
    expect(linkedinUrl.searchParams.get("timeGranularity")).toBe("DAILY");
    expect(linkedinInit?.headers).toMatchObject({
      authorization: "Bearer li",
      "LinkedIn-Version": "202607",
      "X-Restli-Protocol-Version": "2.0.0",
    });
    expect(linkedinRows[0]).toMatchObject({
      id: "urn:li:sponsoredCampaign:44",
      date: "2026-07-07",
    });
  });

  it("paginates YouTube and LinkedIn reports without duplicating pages", async () => {
    const youtubeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const startIndex = new URL(String(input)).searchParams.get("startIndex");
      return new Response(
        JSON.stringify(
          startIndex === "1"
            ? {
                columnHeaders: [
                  { name: "day" },
                  { name: "video" },
                  { name: "views" },
                ],
                rows: [["2026-07-01", "video-1", 100]],
                nextPageToken: "next",
              }
            : {
                columnHeaders: [
                  { name: "day" },
                  { name: "video" },
                  { name: "views" },
                ],
                rows: [["2026-07-02", "video-2", 90]],
              },
        ),
        { status: 200 },
      );
    });
    const youtubeRows = await fetchYouTubeAnalyticsRows({
      accessToken: "yt",
      since: "2026-07-01",
      until: "2026-07-07",
      fetchFn: youtubeFetch as typeof fetch,
    });
    expect(youtubeFetch).toHaveBeenCalledTimes(2);
    expect(youtubeRows.map((row) => row.video)).toEqual(["video-1", "video-2"]);

    const linkedinFetch = vi.fn(async (input: RequestInfo | URL) => {
      const start = new URL(String(input)).searchParams.get("start");
      return new Response(
        JSON.stringify(
          start === "0"
            ? {
                elements: [
                  {
                    pivotValues: ["campaign-1"],
                    dateRange: { start: { year: 2026, month: 7, day: 1 } },
                  },
                ],
                paging: { total: 2 },
              }
            : {
                elements: [
                  {
                    pivotValues: ["campaign-2"],
                    dateRange: { start: { year: 2026, month: 7, day: 2 } },
                  },
                ],
                paging: { total: 2 },
              },
        ),
        { status: 200 },
      );
    });
    const linkedinRows = await fetchLinkedInRows({
      accessToken: "li",
      accountId: "123",
      since: "2026-07-01",
      until: "2026-07-07",
      fetchFn: linkedinFetch as typeof fetch,
    });
    expect(linkedinFetch).toHaveBeenCalledTimes(2);
    expect(linkedinRows.map((row) => row.date)).toEqual([
      "2026-07-01",
      "2026-07-02",
    ]);
  });

  it("rolls LinkedIn lead and engagement metrics up to requested target accounts", () => {
    const rollup = rollupLinkedInTargetAccounts(
      [
        {
          targetAccount: "Acme",
          jobTitle: "CMO",
          leadGenFormFills: 4,
          companyEngagement: 12,
          impressions: 1000,
          clicks: 30,
          spend: 500,
        },
        {
          targetAccount: "Acme",
          jobTitle: "VP Growth",
          leadGenFormFills: 3,
          companyEngagement: 8,
          impressions: 700,
          clicks: 20,
          spend: 300,
        },
        {
          targetAccount: "Other",
          jobTitle: "Founder",
          leadGenFormFills: 9,
          companyEngagement: 20,
          impressions: 900,
          clicks: 40,
          spend: 600,
        },
      ],
      ["acme"],
    );
    expect(rollup).toEqual([
      {
        targetAccount: "Acme",
        leadGenFormFills: 7,
        companyEngagement: 20,
        impressions: 1700,
        clicks: 50,
        spend: 800,
        jobTitles: ["CMO", "VP Growth"],
      },
    ]);
  });

  it("fetches LinkedIn company and job-title pivots without adding them to blended totals", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const pivot = new URL(String(input)).searchParams.get("pivot");
      return new Response(
        JSON.stringify({
          elements: [
            {
              pivotValues: [pivot === "MEMBER_COMPANY" ? "Acme" : "CMO"],
              impressions: 100,
              clicks: 8,
              leadGenerationMailContactInfoShares: 2,
              totalEngagements: 12,
              costInLocalCurrency: "50",
            },
          ],
        }),
        { status: 200 },
      );
    });
    const breakdown = await fetchLinkedInB2BBreakdown({
      accessToken: "li",
      accountId: "123",
      since: "2026-07-01",
      until: "2026-07-07",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(
      fetchFn.mock.calls.map(([input]) =>
        new URL(String(input)).searchParams.get("pivot"),
      ),
    ).toEqual(["MEMBER_COMPANY", "MEMBER_JOB_TITLE"]);
    expect(
      rollupLinkedInTargetAccounts(breakdown.companyRows, ["Acme"])[0],
    ).toMatchObject({
      targetAccount: "Acme",
      leadGenFormFills: 2,
      companyEngagement: 12,
    });
    expect(rollupLinkedInJobTitles(breakdown.jobTitleRows)[0]).toMatchObject({
      jobTitle: "CMO",
      leadGenFormFills: 2,
    });
  });
});
