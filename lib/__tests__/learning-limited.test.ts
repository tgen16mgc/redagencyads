import { describe, expect, it } from "vitest";
import { assessLearningLimited } from "../learning-limited";
import type { DashboardReport, NormalizedRow } from "../types";

function mockReport(overrides: Partial<DashboardReport>): DashboardReport {
  return {
    account: { id: "act_123", name: "Mock Account" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-07" }, // 7 days
    detectedPack: "sales_roas",
    selectedPack: "sales_roas",
    packReason: "Test",
    kpis: [],
    totals: row({ level: "account", spend: 1000, purchases: 100 }),
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    health: { score: 100, grade: "A", checks: [] },
    prompt: "",
    pulledAt: new Date().toISOString(),
    ...overrides,
  };
}

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

describe("assessLearningLimited", () => {
  it("returns insufficient data when total spend is zero", () => {
    const report = mockReport({
      totals: row({ level: "account", spend: 0 }),
      adsetRows: [row({ id: "set-1", spend: 0 })],
    });

    const result = assessLearningLimited(report);
    expect(result.status).toBe("insufficient_data");
    expect(result.adsets).toHaveLength(0);
  });

  it("returns healthy when awareness pack is selected", () => {
    const report = mockReport({
      selectedPack: "awareness",
      totals: row({ level: "account", spend: 100 }),
      adsetRows: [row({ id: "set-1", spend: 100, impressions: 5000 })],
    });

    const result = assessLearningLimited(report);
    expect(result.status).toBe("healthy");
    expect(result.adsets).toHaveLength(0);
  });

  it("identifies healthy adsets that will comfortably exit learning phase (>= 50/week)", () => {
    const report = mockReport({
      selectedPack: "sales_roas",
      dateRange: { since: "2026-06-01", until: "2026-06-05" }, // 5 days
      adsetRows: [
        // 5 days, needs 50 * 5/7 = 35.7 conversions. Let's give it 40.
        row({ id: "set-1", name: "Purchase Prospecting", spend: 500, purchases: 40 }),
      ],
    });

    const result = assessLearningLimited(report);
    expect(result.status).toBe("healthy");
    expect(result.adsets).toHaveLength(1);
    expect(result.adsets[0].status).toBe("healthy");
  });

  it("flags adsets with learning limited risk (< 50/week)", () => {
    const report = mockReport({
      selectedPack: "lead_gen",
      dateRange: { since: "2026-06-01", until: "2026-06-07" }, // 7 days
      adsetRows: [
        // 7 days, needs 50 leads. Has 20.
        row({ id: "set-1", name: "Lead Generation", spend: 200, leads: 20 }),
      ],
    });

    const result = assessLearningLimited(report);
    expect(result.status).toBe("learning_limited_risk");
    expect(result.adsets).toHaveLength(1);
    expect(result.adsets[0].status).toBe("learning_limited_risk");
    expect(result.adsets[0].projectedConversions).toBe(20);
    expect(result.adsets[0].recommendation.en).toContain("Consolidate overlapping ad sets");
  });

  it("handles zero conversion adsets with warnings", () => {
    const report = mockReport({
      selectedPack: "messages",
      dateRange: { since: "2026-06-01", until: "2026-06-07" }, // 7 days
      adsetRows: [
        row({ id: "set-1", name: "Message Ads", spend: 100, messages: 0 }),
      ],
    });

    const result = assessLearningLimited(report);
    expect(result.status).toBe("learning_limited_risk");
    expect(result.adsets[0].status).toBe("learning_limited_risk");
    expect(result.adsets[0].projectedConversions).toBe(0);
    expect(result.adsets[0].recommendation.en).toContain("Move event up-funnel");
  });
});

describe("assessLearningLimited reason codes", () => {
  it("maps LOW_VOLUME reason code to a budget/volume recommendation", () => {
    const report = mockReport({
      selectedPack: "sales_roas",
      dateRange: { since: "2026-06-01", until: "2026-06-07" },
      adsetRows: [
        row({ id: "set-1", name: "Prospecting", spend: 100, purchases: 5, learningStageStatus: "LEARNING_LIMITED", learningStageReasons: ["LOW_VOLUME"] }),
      ],
    });

    const result = assessLearningLimited(report);
    expect(result.adsets[0].reasonCode).toBe("LOW_VOLUME");
    expect(result.adsets[0].recommendation.en).toMatch(/budget|consolidat/i);
  });

  it("maps CREATIVE_FATIGUE reason code to a creative rotation recommendation", () => {
    const report = mockReport({
      selectedPack: "lead_gen",
      dateRange: { since: "2026-06-01", until: "2026-06-07" },
      adsetRows: [
        row({ id: "set-1", name: "Creative Test", spend: 200, leads: 5, learningStageStatus: "LEARNING_LIMITED", learningStageReasons: ["CREATIVE_FATIGUE"] }),
      ],
    });

    const result = assessLearningLimited(report);
    expect(result.adsets[0].reasonCode).toBe("CREATIVE_FATIGUE");
    expect(result.adsets[0].recommendation.en).toMatch(/creative|rotat/i);
  });

  it("maps HIGH_OVERLAP reason code to an audience overlap recommendation", () => {
    const report = mockReport({
      selectedPack: "lead_gen",
      dateRange: { since: "2026-06-01", until: "2026-06-07" },
      adsetRows: [
        row({ id: "set-1", name: "LAL 1%", spend: 200, leads: 5, learningStageStatus: "LEARNING_LIMITED", learningStageReasons: ["HIGH_OVERLAP"] }),
      ],
    });

    const result = assessLearningLimited(report);
    expect(result.adsets[0].reasonCode).toBe("HIGH_OVERLAP");
    expect(result.adsets[0].recommendation.en).toMatch(/overlap|audience/i);
  });

  it("maps NOT_ENOUGH_BUDGET reason code to a budget increase recommendation", () => {
    const report = mockReport({
      selectedPack: "sales_roas",
      dateRange: { since: "2026-06-01", until: "2026-06-07" },
      adsetRows: [
        row({ id: "set-1", name: "Low Budget", spend: 50, purchases: 2, learningStageStatus: "LEARNING_LIMITED", learningStageReasons: ["NOT_ENOUGH_BUDGET"] }),
      ],
    });

    const result = assessLearningLimited(report);
    expect(result.adsets[0].reasonCode).toBe("NOT_ENOUGH_BUDGET");
    expect(result.adsets[0].recommendation.en).toMatch(/budget|increas/i);
  });

  it("falls back to projection-based recommendation when no API reason code is present", () => {
    const report = mockReport({
      selectedPack: "sales_roas",
      dateRange: { since: "2026-06-01", until: "2026-06-07" },
      adsetRows: [
        row({ id: "set-1", name: "No API Data", spend: 100, purchases: 10 }),
      ],
    });

    const result = assessLearningLimited(report);
    expect(result.adsets[0].reasonCode).toBeUndefined();
    expect(result.adsets[0].recommendation.en).toContain("Consolidate");
  });
});
