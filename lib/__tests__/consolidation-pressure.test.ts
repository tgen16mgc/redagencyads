import { describe, expect, it } from "vitest";
import { assessConsolidationPressure } from "../consolidation-pressure";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "adset",
    name: "Ad Set",
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

describe("assessConsolidationPressure", () => {
  it("returns insufficient_data when no adset rows with spend exist", () => {
    const result = assessConsolidationPressure([], "lead_gen", 7);
    expect(result.status).toBe("insufficient_data");
    expect(result.conversionsPerAdset).toBe(0);
  });

  it("returns healthy when conversions per adset meets or exceeds the threshold", () => {
    // 3 adsets, 21 leads over 7 days = 7/adset/week — exactly at threshold
    const adsets = [
      row({ id: "s1", spend: 100, leads: 7 }),
      row({ id: "s2", spend: 100, leads: 7 }),
      row({ id: "s3", spend: 100, leads: 7 }),
    ];
    const result = assessConsolidationPressure(adsets, "lead_gen", 7);
    expect(result.status).toBe("healthy");
    expect(result.conversionsPerAdset).toBeCloseTo(7);
  });

  it("returns warning when conversions per adset is below threshold but above half", () => {
    // 4 adsets, 16 leads over 7 days = 4/adset/week — below 7 but above 3.5
    const adsets = [
      row({ id: "s1", spend: 100, leads: 4 }),
      row({ id: "s2", spend: 100, leads: 4 }),
      row({ id: "s3", spend: 100, leads: 4 }),
      row({ id: "s4", spend: 100, leads: 4 }),
    ];
    const result = assessConsolidationPressure(adsets, "lead_gen", 7);
    expect(result.status).toBe("warning");
    expect(result.activeAdsets).toBe(4);
  });

  it("returns critical when conversions per adset is at or below half the threshold", () => {
    // 8 adsets, 8 leads over 7 days = 1/adset/week — well below threshold
    const adsets = Array.from({ length: 8 }, (_, i) =>
      row({ id: `s${i}`, spend: 50, leads: 1 }),
    );
    const result = assessConsolidationPressure(adsets, "lead_gen", 7);
    expect(result.status).toBe("critical");
    expect(result.summary.en).toMatch(/consolidat/i);
  });

  it("uses purchases for sales_roas pack", () => {
    const adsets = [
      row({ id: "s1", spend: 200, purchases: 10 }),
      row({ id: "s2", spend: 200, purchases: 10 }),
    ];
    const result = assessConsolidationPressure(adsets, "sales_roas", 7);
    expect(result.conversionsPerAdset).toBeCloseTo(10);
    expect(result.status).toBe("healthy");
  });

  it("uses messages for messages pack", () => {
    const adsets = [
      row({ id: "s1", spend: 100, messages: 3 }),
      row({ id: "s2", spend: 100, messages: 3 }),
    ];
    const result = assessConsolidationPressure(adsets, "messages", 7);
    expect(result.conversionsPerAdset).toBeCloseTo(3);
    expect(result.status).toBe("critical");
  });

  it("skips adsets with no spend", () => {
    const adsets = [
      row({ id: "s1", spend: 100, leads: 14 }),
      row({ id: "s2", spend: 0, leads: 0 }),
    ];
    const result = assessConsolidationPressure(adsets, "lead_gen", 7);
    expect(result.activeAdsets).toBe(1);
    expect(result.conversionsPerAdset).toBeCloseTo(14);
  });
});
