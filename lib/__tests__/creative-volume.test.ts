import { describe, expect, it } from "vitest";
import { assessCreativeVolume } from "../creative-volume";
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

describe("assessCreativeVolume", () => {
  it("returns insufficient data when there are no served ad rows", () => {
    const result = assessCreativeVolume([row({ id: "a", adsetId: "set-1", spend: 0, impressions: 0 })]);

    expect(result.status).toBe("insufficient_data");
    expect(result.adsets).toHaveLength(0);
    expect(result.summary.en).toContain("served ad rows");
  });

  it("flags adsets with fewer than 3 active creatives as constrained", () => {
    const result = assessCreativeVolume([
      row({ id: "a1", name: "Ad 1", adId: "a1", adsetId: "set-1", adsetName: "Prospecting", spend: 20, impressions: 1000 }),
      row({ id: "a2", name: "Ad 2", adId: "a2", adsetId: "set-1", adsetName: "Prospecting", spend: 15, impressions: 900 }),
      row({ id: "b1", name: "Ad 1", adId: "b1", adsetId: "set-2", adsetName: "Retargeting", spend: 10, impressions: 600 }),
      row({ id: "b2", name: "Ad 2", adId: "b2", adsetId: "set-2", adsetName: "Retargeting", spend: 10, impressions: 600 }),
      row({ id: "b3", name: "Ad 3", adId: "b3", adsetId: "set-2", adsetName: "Retargeting", spend: 10, impressions: 600 }),
      row({ id: "b4", name: "Ad 4", adId: "b4", adsetId: "set-2", adsetName: "Retargeting", spend: 10, impressions: 600 }),
      row({ id: "b5", name: "Ad 5", adId: "b5", adsetId: "set-2", adsetName: "Retargeting", spend: 10, impressions: 600 }),
    ]);

    expect(result.status).toBe("constrained");
    expect(result.adsets[0]).toMatchObject({ adsetId: "set-1", creativeCount: 2, status: "constrained" });
    expect(result.adsets[0].reason.en).toContain("fewer than 3");
  });

  it("marks 3 to 4 active creatives as watch", () => {
    const result = assessCreativeVolume([
      row({ id: "a1", adId: "a1", adsetId: "set-1", adsetName: "Prospecting", spend: 10 }),
      row({ id: "a2", adId: "a2", adsetId: "set-1", adsetName: "Prospecting", spend: 10 }),
      row({ id: "a3", adId: "a3", adsetId: "set-1", adsetName: "Prospecting", spend: 10 }),
    ]);

    expect(result.status).toBe("watch");
    expect(result.adsets[0]).toMatchObject({ creativeCount: 3, status: "watch" });
  });

  it("marks adsets with at least 5 active creatives as healthy", () => {
    const rows = Array.from({ length: 5 }, (_, index) => row({
      id: `a${index}`,
      adId: `a${index}`,
      adsetId: "set-1",
      adsetName: "Prospecting",
      spend: 10,
    }));

    const result = assessCreativeVolume(rows);

    expect(result.status).toBe("healthy");
    expect(result.adsets[0]).toMatchObject({ creativeCount: 5, status: "healthy" });
  });

  it("flags adsets where all creatives are the same format as format-constrained", () => {
    const rows = Array.from({ length: 5 }, (_, index) => row({
      id: `a${index}`,
      adId: `a${index}`,
      adsetId: "set-1",
      adsetName: "Prospecting",
      spend: 10,
      adFormat: "static",
    }));

    const result = assessCreativeVolume(rows);

    expect(result.adsets[0].formatDiverse).toBe(false);
    expect(result.adsets[0].reason.en).toMatch(/format/i);
  });

  it("marks adsets with mixed formats as format-diverse", () => {
    const result = assessCreativeVolume([
      row({ id: "a1", adId: "a1", adsetId: "set-1", adsetName: "Prospecting", spend: 10, adFormat: "static" }),
      row({ id: "a2", adId: "a2", adsetId: "set-1", adsetName: "Prospecting", spend: 10, adFormat: "video" }),
      row({ id: "a3", adId: "a3", adsetId: "set-1", adsetName: "Prospecting", spend: 10, adFormat: "carousel" }),
      row({ id: "a4", adId: "a4", adsetId: "set-1", adsetName: "Prospecting", spend: 10, adFormat: "static" }),
      row({ id: "a5", adId: "a5", adsetId: "set-1", adsetName: "Prospecting", spend: 10, adFormat: "video" }),
    ]);

    expect(result.adsets[0].formatDiverse).toBe(true);
  });

  it("treats adsets with no format data as format-diverse to avoid false positives", () => {
    const rows = Array.from({ length: 5 }, (_, index) => row({
      id: `a${index}`,
      adId: `a${index}`,
      adsetId: "set-1",
      adsetName: "Prospecting",
      spend: 10,
    }));

    const result = assessCreativeVolume(rows);

    expect(result.adsets[0].formatDiverse).toBe(true);
  });
});
