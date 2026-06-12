import { describe, expect, it } from "vitest";
import { assessSpendPacing } from "../spend-pacing";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "campaign",
    name: "Campaign",
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

describe("assessSpendPacing", () => {
  it("returns no_budget_data when no rows have a daily budget", () => {
    const result = assessSpendPacing([row({ id: "c1", spend: 50 })], 7);
    expect(result.status).toBe("no_budget_data");
  });

  it("returns on_pace when spend is >= 85% of expected", () => {
    // daily budget 100, 7 days, expected = 700, actual = 630 = 90%
    const result = assessSpendPacing([row({ id: "c1", spend: 630, dailyBudget: 100 })], 7);
    expect(result.status).toBe("on_pace");
    expect(result.campaigns[0].pacePercent).toBeCloseTo(90);
  });

  it("returns underpacing when spend is 60-84% of expected", () => {
    // daily 100, 7 days, expected = 700, actual = 490 = 70%
    const result = assessSpendPacing([row({ id: "c1", name: "Slow", spend: 490, dailyBudget: 100 })], 7);
    expect(result.status).toBe("underpacing");
    expect(result.campaigns[0].pacePercent).toBeCloseTo(70);
  });

  it("returns severely_underpacing when spend is below 60% of expected", () => {
    // daily 100, 7 days, expected = 700, actual = 350 = 50%
    const result = assessSpendPacing([row({ id: "c1", name: "Stalled", spend: 350, dailyBudget: 100 })], 7);
    expect(result.status).toBe("severely_underpacing");
    expect(result.summary.en).toMatch(/pacing/i);
  });

  it("uses the worst status across multiple campaigns", () => {
    const result = assessSpendPacing([
      row({ id: "c1", spend: 700, dailyBudget: 100 }),   // on_pace
      row({ id: "c2", spend: 300, dailyBudget: 100 }),   // severely_underpacing
    ], 7);
    expect(result.status).toBe("severely_underpacing");
    expect(result.campaigns).toHaveLength(2);
  });

  it("skips campaigns with zero daily budget", () => {
    const result = assessSpendPacing([
      row({ id: "c1", spend: 100, dailyBudget: 0 }),
      row({ id: "c2", spend: 630, dailyBudget: 100 }),
    ], 7);
    expect(result.campaigns).toHaveLength(1);
    expect(result.status).toBe("on_pace");
  });

  it("computes overall pacing stats", () => {
    const result = assessSpendPacing([
      row({ id: "c1", spend: 700, dailyBudget: 100 }),
      row({ id: "c2", spend: 700, dailyBudget: 100 }),
    ], 7);
    expect(result.totalSpend).toBeCloseTo(1400);
    expect(result.totalExpected).toBeCloseTo(1400);
    expect(result.overallPacePercent).toBeCloseTo(100);
  });
});
