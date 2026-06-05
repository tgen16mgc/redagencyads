import { describe, expect, it } from "vitest";
import { assessFunnelLeakage } from "../funnel-leakage";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "account",
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

describe("assessFunnelLeakage", () => {
  it("returns clean status for healthy conversion ratios", () => {
    const result = assessFunnelLeakage(
      row({
        spend: 500,
        linkClicks: 1000,
        addToCart: 200,
        initiateCheckout: 100,
        purchases: 30,
      }),
    );

    expect(result.status).toBe("clean");
    expect(result.variant).toBe("secondary");
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.summary.en).toContain("healthy");
  });

  it("flags checkout leakage when cart-to-checkout ratio is very low", () => {
    const result = assessFunnelLeakage(
      row({
        spend: 500,
        linkClicks: 1000,
        addToCart: 300,
        initiateCheckout: 10,
        purchases: 2,
      }),
    );

    expect(result.status).toBe("leakage_detected");
    expect(result.variant).toBe("destructive");
    expect(result.score).toBeLessThan(70);
    expect(result.blockers.en.join(" ")).toContain("checkout");
  });

  it("flags purchase leakage when checkout-to-purchase conversion is low", () => {
    const result = assessFunnelLeakage(
      row({
        spend: 500,
        linkClicks: 1000,
        addToCart: 200,
        initiateCheckout: 150,
        purchases: 2,
      }),
    );

    expect(result.status).toBe("leakage_detected");
    expect(result.blockers.en.join(" ")).toContain("purchase");
  });

  it("marks low click volume as insufficient data", () => {
    const result = assessFunnelLeakage(
      row({
        spend: 50,
        linkClicks: 10,
        addToCart: 1,
        purchases: 0,
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.variant).toBe("outline");
    expect(result.summary.vi.toLowerCase()).toContain("tối thiểu");
  });
});
