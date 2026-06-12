import { describe, expect, it } from "vitest";
import { assessCostCapDelivery } from "../cost-cap-delivery";
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

describe("assessCostCapDelivery", () => {
  it("returns no_cap_data when no campaigns have a daily budget", () => {
    const result = assessCostCapDelivery([row({ id: "c1", spend: 50 })], 7);
    expect(result.status).toBe("no_cap_data");
  });

  it("returns healthy when all campaigns spend at least 80% of their daily budget", () => {
    const result = assessCostCapDelivery(
      [row({ id: "c1", spend: 80 * 7, dailyBudget: 100 })],
      7,
    );
    expect(result.status).toBe("healthy");
    expect(result.underdelivering).toHaveLength(0);
  });

  it("returns warning when a campaign spends 60-80% of daily budget", () => {
    const result = assessCostCapDelivery(
      [row({ id: "c1", name: "Slow camp", spend: 65 * 7, dailyBudget: 100 })],
      7,
    );
    expect(result.status).toBe("warning");
    expect(result.underdelivering[0].spendRate).toBeCloseTo(0.65);
  });

  it("returns critical when a campaign spends under 60% of daily budget", () => {
    const result = assessCostCapDelivery(
      [row({ id: "c1", name: "Capped camp", spend: 40 * 7, dailyBudget: 100 })],
      7,
    );
    expect(result.status).toBe("critical");
    expect(result.underdelivering[0].spendRate).toBeCloseTo(0.4);
    expect(result.summary.en).toMatch(/cap/i);
  });

  it("ignores campaigns with zero daily budget", () => {
    const result = assessCostCapDelivery(
      [
        row({ id: "c1", spend: 10 * 7, dailyBudget: 0 }),
        row({ id: "c2", spend: 90 * 7, dailyBudget: 100 }),
      ],
      7,
    );
    expect(result.status).toBe("healthy");
    expect(result.underdelivering).toHaveLength(0);
  });

  it("uses the most critical severity across multiple campaigns", () => {
    const result = assessCostCapDelivery(
      [
        row({ id: "c1", spend: 90 * 7, dailyBudget: 100 }),
        row({ id: "c2", spend: 30 * 7, dailyBudget: 100 }),
      ],
      7,
    );
    expect(result.status).toBe("critical");
    expect(result.underdelivering).toHaveLength(1);
  });
});
