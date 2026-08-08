import { describe, expect, it } from "vitest";
import {
  applyIncrementalityOverlay,
  audienceOverlapMatrix,
  attributeRows,
  buildAudienceFingerprint,
  buildCreativeDrillthrough,
  buildCrossChannelSnapshot,
  creativeFingerprint,
  evaluateQuality,
  flattenAudienceTargeting,
  normalizeMetaHierarchy,
  normalizeMetaPerformance,
  normalizeTikTokCreative,
  recommendAudienceConsolidation,
  type AudienceFingerprint,
} from "@/lib/cross-channel";
import { buildSampleReport } from "@/lib/sample-report";
import { normalizeGoogleAdsRows } from "@/lib/connector-adapters";
import type { TikTokAdLibraryRow } from "@/lib/types";

describe("cross-channel canonical layer", () => {
  it("maps Meta campaigns to owned canonical performance rows without treating public data as spend", () => {
    const report = buildSampleReport();
    const rows = normalizeMetaPerformance(report);
    expect(rows).toHaveLength(report.campaignRows.length);
    expect(
      rows.every(
        (row) =>
          row.platform === "meta" && row.authority === "owned_performance",
      ),
    ).toBe(true);
    expect(rows.reduce((sum, row) => sum + row.spend, 0)).toBe(
      report.totals.spend,
    );
    expect(normalizeMetaHierarchy(report).map((row) => row.grain)).toEqual(
      expect.arrayContaining(["campaign", "ad_set", "ad"]),
    );
  });

  it("deduplicates creatives by a stable cross-source fingerprint", () => {
    const base: TikTokAdLibraryRow = {
      id: "1",
      advertiserName: "Brand",
      caption: "Hook",
      videoUrl: "https://cdn.test/ad.mp4?token=one",
      format: "video",
    };
    const duplicate: TikTokAdLibraryRow = {
      ...base,
      id: "2",
      videoUrl: "https://cdn.test/ad.mp4?token=two",
    };
    expect(creativeFingerprint(base)).toBe(creativeFingerprint(duplicate));
    expect(normalizeTikTokCreative(base).authority).toBe("public_intelligence");
    const snapshot = buildCrossChannelSnapshot({
      tiktokReport: {
        rows: [base, duplicate],
        warnings: [],
        actorId: "actor",
        pulledAt: new Date().toISOString(),
      },
    });
    expect(snapshot.creativeRows).toHaveLength(1);
    expect(snapshot.performanceRows).toHaveLength(0);
    expect(
      snapshot.warnings.some((warning) =>
        warning.includes("budget recommendations"),
      ),
    ).toBe(true);
    expect(
      creativeFingerprint({
        advertiser: "Different source name",
        caption: "Hook",
        mediaUrl: "https://cdn.test/ad.mp4?token=three",
      }),
    ).toBe(
      creativeFingerprint({
        advertiser: base.advertiserName,
        caption: base.caption,
        mediaUrl: base.videoUrl,
      }),
    );
  });

  it("uses one immutable creative ID for matching SHA-256 content across Meta, TikTok, and Google", () => {
    const contentHash = "b".repeat(64);
    const report = buildSampleReport();
    const metaAd = report.adRows[0];
    report.adsetPreviews = [
      {
        id: metaAd.adsetId || "adset",
        name: metaAd.adsetName || "Ad set",
        campaignId: metaAd.campaignId || "campaign",
        campaignName: metaAd.campaignName || "Campaign",
        status: "ACTIVE",
        dailyBudget: 0,
        lifetimeBudget: 0,
        ads: [
          {
            id: metaAd.adId || metaAd.id,
            name: metaAd.adName || metaAd.name,
            adsetId: metaAd.adsetId || "adset",
            previewHtml: "",
            contentHash,
          },
        ],
      },
    ];
    const google = normalizeGoogleAdsRows(
      [
        {
          date: report.dateRange.until,
          contentSha256: contentHash,
          campaign: { id: "google-campaign", name: "Google campaign" },
          adGroup: { id: "google-group", name: "Google group" },
          adGroupAd: {
            ad: { id: "google-ad", name: "Google ad", type: "IMAGE_AD" },
          },
          metrics: {
            costMicros: 1000000,
            impressions: 100,
            clicks: 10,
            conversions: 1,
            conversionsValue: 4,
          },
        },
      ],
      report.dateRange.until,
    );
    const tiktok: TikTokAdLibraryRow = {
      id: "tiktok-ad",
      advertiserName: "Brand",
      caption: "Same file",
      format: "image",
      contentHash,
    };
    const snapshot = buildCrossChannelSnapshot({
      metaReport: report,
      tiktokReport: {
        rows: [tiktok],
        warnings: [],
        actorId: "actor",
        pulledAt: new Date().toISOString(),
      },
      connectorPerformanceRows: google.rows,
      connectorCreativeRows: google.creatives,
    });
    const creativeId = `creative:${contentHash}`;
    expect(
      snapshot.creativeRows.filter((row) => row.creativeId === creativeId),
    ).toHaveLength(1);
    expect(
      snapshot.performanceRows
        .filter((row) => row.creativeId === creativeId)
        .map((row) => row.platform),
    ).toEqual(expect.arrayContaining(["meta", "google_ads"]));
    expect(
      snapshot.creativeDrillthrough.find((row) => row.creativeId === creativeId)
        ?.spend,
    ).toBeGreaterThan(0);
  });

  it("raises quality warnings when spend changes by more than five percent", () => {
    const report = buildSampleReport();
    const current = normalizeMetaPerformance(report);
    const previous = current.map((row) => ({ ...row, spend: row.spend / 2 }));
    expect(
      evaluateQuality(current, previous).find(
        (gate) => gate.id === "spend_variance",
      )?.status,
    ).toBe("warning");
  });

  it("flags cannibalization only above the requested overlap and spend thresholds", () => {
    const audiences: AudienceFingerprint[] = [
      {
        id: "a",
        platform: "meta",
        adSetId: "left",
        spend: 100,
        criteria: ["women", "skincare", "hcm"],
      },
      {
        id: "b",
        platform: "tiktok",
        adSetId: "right",
        spend: 100,
        criteria: ["women", "skincare", "hcm", "lookalike"],
      },
    ];
    const alerts = audienceOverlapMatrix(audiences);
    expect(alerts[0].overlap).toBeCloseTo(0.75);
    expect(alerts[0].cannibalizationRisk).toBe(true);
    expect(recommendAudienceConsolidation(audiences)[0].apiSupported).toBe(
      false,
    );
  });

  it("supports attribution, incrementality, and creative drill-through", () => {
    const report = buildSampleReport();
    const rows = normalizeMetaHierarchy(report);
    expect(
      attributeRows(
        rows.filter((row) => row.grain === "campaign"),
        "7d_click_1d_view",
      ).attributedConversions,
    ).toBeGreaterThan(0);
    expect(
      applyIncrementalityOverlay(
        buildCrossChannelSnapshot({ metaReport: report }).executive,
        {
          id: "lift",
          method: "geo_lift",
          startDate: report.dateRange.since,
          endDate: report.dateRange.until,
          lift: 0.12,
        },
      ).incrementality.lift,
    ).toBe(0.12);
    expect(
      buildCreativeDrillthrough(
        [
          {
            schemaVersion: "1.0",
            id: "c",
            creativeId: "creative:c",
            platform: "meta",
            authority: "owned_performance",
            format: "image",
            fingerprint: "f",
          },
        ],
        [{ ...rows[0], creativeId: "creative:c" }],
      )[0].spend,
    ).toBeGreaterThan(0);
  });

  it("uses verified GA4 totals for data-driven attribution and otherwise falls back truthfully", () => {
    const rows = normalizeMetaPerformance(buildSampleReport());
    expect(attributeRows(rows, "data_driven")).toMatchObject({
      effectiveModel: "last_click",
      source: "canonical_rows",
    });
    expect(
      attributeRows(rows, "data_driven", undefined, {
        propertyId: "123456",
        reportingAttributionModel: "CROSS_CHANNEL_DATA_DRIVEN",
        conversions: 42,
        revenue: 8400,
        since: "2026-07-01",
        until: "2026-07-28",
        source: "ga4_data_api",
      }),
    ).toMatchObject({
      effectiveModel: "data_driven",
      source: "ga4_data_api",
      attributedConversions: 42,
      attributedRevenue: 8400,
      propertyId: "123456",
    });
  });

  it("does not treat organic video views as view-through conversions", () => {
    const youtube = [
      {
        schemaVersion: "1.0" as const,
        id: "youtube:1",
        platform: "youtube" as const,
        authority: "owned_performance" as const,
        grain: "ad" as const,
        date: "2026-07-20",
        spend: 0,
        impressions: 100,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        viewThroughConversions: 0,
        videoViews: 100,
      },
    ];
    expect(
      attributeRows(youtube, "7d_click_1d_view").attributedConversions,
    ).toBe(0);
  });

  it("merges connector-owned performance into platform summaries and creative drill-through", () => {
    const snapshot = buildCrossChannelSnapshot({
      metaReport: buildSampleReport(),
      connectorPerformanceRows: [
        {
          schemaVersion: "1.0",
          id: "google:1",
          platform: "google_ads",
          authority: "owned_performance",
          grain: "ad",
          date: "2026-07-20",
          adId: "g-ad",
          creativeId: "creative:google",
          spend: 100,
          impressions: 1000,
          clicks: 50,
          conversions: 5,
          revenue: 250,
          viewThroughConversions: 1,
        },
      ],
      connectorCreativeRows: [
        {
          schemaVersion: "1.0",
          id: "google:creative:1",
          creativeId: "creative:google",
          platform: "google_ads",
          authority: "owned_performance",
          title: "Google video",
          format: "video",
          fingerprint: "google-fingerprint",
        },
      ],
    });
    expect(snapshot.platforms.map((item) => item.platform)).toEqual(
      expect.arrayContaining(["meta", "google_ads"]),
    );
    expect(snapshot.totals.spend).toBe(buildSampleReport().totals.spend + 100);
    expect(
      snapshot.creativeDrillthrough.find(
        (item) => item.creativeId === "creative:google",
      ),
    ).toMatchObject({ spend: 100, conversions: 5 });
  });

  it("hashes normalized targeting criteria and only marks supported exclusions as directly applicable", () => {
    const left = buildAudienceFingerprint({
      platform: "meta",
      adSetId: "left",
      spend: 120,
      criteria: ["Women", "Skincare", "HCM", "women"],
    });
    const right = buildAudienceFingerprint({
      platform: "meta",
      adSetId: "right",
      spend: 90,
      criteria: ["women", "skincare", "HCM", "lookalike"],
    });
    expect(left.criteria).toEqual(["hcm", "skincare", "women"]);
    expect(
      buildAudienceFingerprint({
        platform: "meta",
        adSetId: "left",
        spend: 1,
        criteria: ["hcm", "women", "skincare"],
      }).id,
    ).toBe(left.id);
    expect(recommendAudienceConsolidation([left, right])[0]).toMatchObject({
      action: "exclude",
      apiSupported: true,
    });
  });

  it("flattens native targeting dimensions instead of inferring audiences from ad-set names", () => {
    expect(
      flattenAudienceTargeting({
        age_min: 25,
        geo_locations: { countries: ["VN"] },
        flexible_spec: [{ interests: [{ id: "123", name: "Skincare" }] }],
      }),
    ).toEqual(
      expect.arrayContaining([
        "age_min:25",
        "geo_locations.countries:VN",
        "flexible_spec.interests.id:123",
        "flexible_spec.interests.name:Skincare",
      ]),
    );
  });
});
