import { describe, expect, it } from "vitest";
import { assessCreativeStarvation } from "../creative-starvation";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "ad",
    name: "Row",
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    linkClicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    messages: 0,
    replies: 0,
    leads: 0,
    purchases: 0,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: 0,
    costPerReply: 0,
    cpl: 0,
    cpaPurchase: 0,
    roas: 0,
    replyRate: 0,
    leadRate: 0,
    ...overrides,
  };
}

describe("assessCreativeStarvation", () => {
  it("returns insufficient data when there are no served ad rows with spend", () => {
    const result = assessCreativeStarvation([
      row({ id: "a", level: "ad", adsetId: "set-1", spend: 0 })
    ]);

    expect(result.status).toBe("insufficient_data");
    expect(result.adsets).toHaveLength(0);
    expect(result.summary.en).toContain("served ad rows");
  });

  it("returns clean status when spend is evenly distributed", () => {
    const result = assessCreativeStarvation([
      // Adset total spend: 100. Each has 50 (50%).
      row({ id: "a1", name: "Ad 1", adId: "a1", adsetId: "set-1", adsetName: "Ad Set 1", level: "ad", spend: 50, impressions: 5000, frequency: 1.2, ctr: 1.5 }),
      row({ id: "a2", name: "Ad 2", adId: "a2", adsetId: "set-1", adsetName: "Ad Set 1", level: "ad", spend: 50, impressions: 4500, frequency: 1.1, ctr: 1.8 }),
    ]);

    expect(result.status).toBe("clean");
    expect(result.adsets).toHaveLength(0);
  });

  it("returns clean status if a dominant ad exists but it is fresh (not fatigued)", () => {
    const result = assessCreativeStarvation([
      // Adset total spend: 100. Ad 1 has 90 (90%). But it's fresh (frequency 1.2, CTR 2.0).
      row({ id: "a1", name: "Ad 1", adId: "a1", adsetId: "set-1", adsetName: "Ad Set 1", level: "ad", spend: 90, impressions: 8000, frequency: 1.2, ctr: 2.0 }),
      row({ id: "a2", name: "Ad 2", adId: "a2", adsetId: "set-1", adsetName: "Ad Set 1", level: "ad", spend: 10, impressions: 800, frequency: 1.0, ctr: 1.5 }),
    ]);

    expect(result.status).toBe("clean");
    expect(result.adsets).toHaveLength(0);
  });

  it("flags adsets when a fatigued ad dominates spend and fresh ads are starved", () => {
    const result = assessCreativeStarvation([
      // Adset total spend: 100.
      // Ad 1: spend 85 (85%), fatigued (frequency 5.5, CTR 0.5)
      row({ id: "a1", name: "Ad 1", adId: "a1", adsetId: "set-1", adsetName: "Ad Set 1", level: "ad", spend: 82, impressions: 15000, frequency: 5.5, ctr: 0.5 }),
      // Ad 2: spend 15 (15%), but it's watch/fatigued (frequency 3.5, CTR 0.7) - not starved fresh
      row({ id: "a2", name: "Ad 2", adId: "a2", adsetId: "set-1", adsetName: "Ad Set 1", level: "ad", spend: 15, impressions: 2000, frequency: 3.5, ctr: 0.7 }),
      // Ad 3: spend 3 (3%), fresh (frequency 1.1, CTR 1.8) - starved!
      row({ id: "a3", name: "Ad 3", adId: "a3", adsetId: "set-1", adsetName: "Ad Set 1", level: "ad", spend: 3, impressions: 300, frequency: 1.1, ctr: 1.8 }),
    ]);

    expect(result.status).toBe("warning");
    expect(result.adsets).toHaveLength(1);
    expect(result.adsets[0].dominantAdId).toBe("a1");
    expect(result.adsets[0].starvedAds).toHaveLength(1);
    expect(result.adsets[0].starvedAds[0].adId).toBe("a3");
    expect(result.adsets[0].reason.en).toContain("dominates 82% of spend");
  });
});
