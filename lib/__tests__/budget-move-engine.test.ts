import { describe, expect, it } from "vitest";
import { recommendBudgetMoves } from "../budget-move-engine";
import type { DashboardReport, NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "adset",
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

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  const totals = row({ id: "totals", level: "account", name: "Totals", spend: 0 });
  return {
    account: { id: "act_1", name: "Account", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-06" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "test",
    kpis: [],
    totals,
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    health: { score: 85, grade: "B", checks: [] },
    prompt: "",
    pulledAt: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("recommendBudgetMoves", () => {
  it("returns insufficient data for too few budget-owning rows", () => {
    const result = recommendBudgetMoves(report({
      adsetRows: [row({ id: "1", name: "Only ad set", spend: 100, leads: 5, ctr: 1.4, frequency: 1.5 })],
    }));

    expect(result.status).toBe("insufficient_data");
    expect(result.recommendations).toHaveLength(0);
    expect(result.holdReasons.en.join(" ")).toContain("3 budget-owning rows");
  });

  it("recommends a guarded transfer from inefficient source to efficient target", () => {
    const result = recommendBudgetMoves(report({
      selectedPack: "lead_gen",
      adsetRows: [
        row({ id: "winner", name: "Winner", spend: 300, leads: 30, ctr: 1.8, frequency: 1.7, impressions: 10000 }),
        row({ id: "loser", name: "Loser", spend: 500, leads: 2, ctr: 0.4, frequency: 3.5, impressions: 12000 }),
        row({ id: "steady", name: "Steady", spend: 300, leads: 10, ctr: 1.1, frequency: 2.1, impressions: 9000 }),
      ],
    }));

    expect(result.status).toBe("moves_recommended");
    expect(result.recommendations[0].id).toBe("transfer:loser->winner");
    expect(result.recommendations[0].suggestedMovePercent).toBeLessThanOrEqual(20);
    expect(result.recommendations[0].maxIncreasePercent).toBe(20);
    expect(result.recommendations[0].maxReductionPercent).toBe(20);
    expect(result.recommendations[0].targetReasons[0].reasons.length).toBeGreaterThan(0);
    expect(result.recommendations[0].sourceReasons[0].metrics.spend).toBe(500);
  });

  it("holds when the efficient target has fatigue risk", () => {
    const result = recommendBudgetMoves(report({
      adsetRows: [
        row({ id: "fatigued", name: "Fatigued winner", spend: 300, leads: 30, ctr: 0.7, frequency: 4.2, impressions: 10000 }),
        row({ id: "loser", name: "Loser", spend: 500, leads: 2, ctr: 0.4, frequency: 3.5, impressions: 12000 }),
        row({ id: "steady", name: "Steady", spend: 300, leads: 10, ctr: 1.1, frequency: 2.1, impressions: 9000 }),
      ],
    }));

    expect(result.status).toBe("hold");
    expect(result.recommendations).toHaveLength(0);
    expect(result.holdReasons.en.join(" ").toLowerCase()).toContain("fatigue");
  });

  it("does not recommend sales budget moves when ROAS signal is missing", () => {
    const result = recommendBudgetMoves(report({
      selectedPack: "sales_roas",
      adsetRows: [
        row({ id: "winner", name: "Winner", spend: 300, purchases: 30, roas: 0, ctr: 1.8, frequency: 1.7 }),
        row({ id: "loser", name: "Loser", spend: 500, purchases: 2, roas: 0, ctr: 0.4, frequency: 3.5 }),
        row({ id: "steady", name: "Steady", spend: 300, purchases: 10, roas: 0, ctr: 1.1, frequency: 2.1 }),
      ],
    }));

    expect(result.status).toBe("insufficient_data");
    expect(result.holdReasons.en.join(" ")).toContain("ROAS");
  });

  it("falls back to campaign rows when ad set rows are unavailable", () => {
    const result = recommendBudgetMoves(report({
      campaignRows: [
        row({ id: "campaign-winner", level: "campaign", name: "Campaign winner", spend: 300, leads: 30, ctr: 1.8, frequency: 1.7 }),
        row({ id: "campaign-loser", level: "campaign", name: "Campaign loser", spend: 500, leads: 2, ctr: 0.4, frequency: 3.5 }),
        row({ id: "campaign-steady", level: "campaign", name: "Campaign steady", spend: 300, leads: 10, ctr: 1.1, frequency: 2.1 }),
      ],
    }));

    expect(result.status).toBe("moves_recommended");
    expect(result.recommendations[0].id).toBe("transfer:campaign-loser->campaign-winner");
  });

  it("does not recommend moves from ad rows only", () => {
    const result = recommendBudgetMoves(report({
      adRows: [
        row({ id: "ad-winner", level: "ad", name: "Ad winner", spend: 300, leads: 30, ctr: 1.8, frequency: 1.7 }),
        row({ id: "ad-loser", level: "ad", name: "Ad loser", spend: 500, leads: 2, ctr: 0.4, frequency: 3.5 }),
        row({ id: "ad-steady", level: "ad", name: "Ad steady", spend: 300, leads: 10, ctr: 1.1, frequency: 2.1 }),
      ],
    }));

    expect(result.status).toBe("insufficient_data");
    expect(result.recommendations).toHaveLength(0);
  });
});
