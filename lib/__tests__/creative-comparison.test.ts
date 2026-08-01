import { describe, expect, it } from "vitest";
import { buildCreativeComparisonVerdict, resolveCreativePreview } from "@/lib/creative-comparison";
import type { DashboardReport, NormalizedRow } from "@/lib/types";

function row(input: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "ad-1",
    level: "ad",
    name: "Creative",
    spend: 100,
    impressions: 1000,
    reach: 800,
    frequency: 1.25,
    clicks: 20,
    linkClicks: 10,
    ctr: 2,
    cpc: 10,
    cpm: 100,
    messages: 10,
    replies: 0,
    leads: 0,
    purchases: 0,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: 10,
    costPerReply: 0,
    cpl: 0,
    cpaPurchase: 0,
    roas: 0,
    replyRate: 0,
    leadRate: 0,
    metricAvailability: { messages: "tracked" },
    ...input,
  };
}

describe("creative comparison", () => {
  it("keeps the first selected creative as the control when it wins", () => {
    const verdict = buildCreativeComparisonVerdict(
      row({ id: "control", name: "Control", spend: 100, messages: 20, costPerMessage: 5 }),
      row({ id: "challenger", name: "Challenger", spend: 100, messages: 10, costPerMessage: 10 }),
      "messages",
      "VND",
    );

    expect(verdict.winner).toBe("control");
    expect(verdict.title).toContain("Creative 1 remains the control");
    expect(verdict.detail).toContain("Control wins this selected comparison");
  });

  it("recommends the challenger when the selected pair supports it", () => {
    const verdict = buildCreativeComparisonVerdict(
      row({ id: "control", name: "Control", spend: 100, messages: 10, costPerMessage: 10 }),
      row({ id: "challenger", name: "Challenger", spend: 100, messages: 25, costPerMessage: 4 }),
      "messages",
      "VND",
    );

    expect(verdict.winner).toBe("challenger");
    expect(verdict.title).toContain("Creative 2 should replace the control");
  });

  it("keeps missing outcome tracking explicit", () => {
    const verdict = buildCreativeComparisonVerdict(
      row({ metricAvailability: { messages: "not_tracked" }, messages: 0 }),
      row({ id: "challenger" }),
      "messages",
      "VND",
    );

    expect(verdict.winner).toBe("insufficient");
    expect(verdict.title).toContain("tracking is incomplete");
  });

  it("matches report preview assets to normalized ad rows", () => {
    const report = {
      adsetPreviews: [{
        id: "set-1",
        name: "Set",
        campaignId: "campaign-1",
        campaignName: "Campaign",
        status: "ACTIVE",
        dailyBudget: 0,
        lifetimeBudget: 0,
        ads: [{ id: "ad-1", name: "Creative", adsetId: "set-1", previewHtml: "<iframe></iframe>", previewImageUrl: "https://scontent.example.fbcdn.net/ad.jpg" }],
      }],
    } as DashboardReport;

    expect(resolveCreativePreview(report, row({ adId: "ad-1" }))?.previewImageUrl).toContain("ad.jpg");
  });
});
