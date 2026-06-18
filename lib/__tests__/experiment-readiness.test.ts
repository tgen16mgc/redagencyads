import { describe, expect, it } from "vitest";
import { assessExperimentReadiness } from "../experiment-readiness";
import type { DashboardReport, NormalizedRow } from "../types";

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

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  return {
    account: { id: "act_1", name: "Test Account", currency: "USD" },
    selectedCampaigns: [],
    dateRange: { since: "2026-05-01", until: "2026-05-31" },
    detectedPack: "messages",
    selectedPack: "messages",
    packReason: "Messages detected.",
    kpis: [],
    totals: row({ id: "total", name: "Account total" }),
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    regionRows: [],
    health: { score: 85, grade: "B", checks: [] },
    prompt: "prompt",
    pulledAt: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("assessExperimentReadiness", () => {
  it("marks healthy spend, measurement, delivery, and creative signals as ready", () => {
    const result = assessExperimentReadiness(
      report({
        totals: row({ spend: 250, impressions: 20000, clicks: 500, messages: 40, costPerMessage: 6.25 }),
        adRows: [row({ id: "ad_1", level: "ad", name: "Fresh ad", spend: 80, impressions: 8000, frequency: 1.8, ctr: 2.1, messages: 12 })],
      }),
    );

    expect(result.status).toBe("ready");
    expect(result.variant).toBe("secondary");
    expect(result.label.en).toBe("Ready");
    expect(result.blockers.en).toHaveLength(0);
    expect(result.nextAction.en).toContain("Launch");
  });

  it("marks missing primary-result tracking as not ready", () => {
    const result = assessExperimentReadiness(
      report({
        selectedPack: "lead_gen",
        totals: row({ spend: 120, impressions: 15000, clicks: 300, leads: 0 }),
      }),
    );

    expect(result.status).toBe("not_ready");
    expect(result.variant).toBe("destructive");
    expect(result.blockers.en.join(" ")).toContain("measurement");
    expect(result.nextAction.en).toContain("Fix");
  });

  it("marks severe creative fatigue as needs fix before launching a new test", () => {
    const result = assessExperimentReadiness(
      report({
        totals: row({ spend: 200, impressions: 18000, clicks: 400, messages: 25, costPerMessage: 8 }),
        adRows: [row({ id: "ad_1", level: "ad", name: "Tired ad", spend: 120, impressions: 12000, frequency: 5.8, ctr: 0.5, messages: 14 })],
      }),
    );

    expect(result.status).toBe("needs_fix");
    expect(result.variant).toBe("outline");
    expect(result.blockers.en.join(" ")).toContain("creative");
    expect(result.nextAction.en).toContain("Rotate");
  });

  it("marks failing account health as not ready", () => {
    const result = assessExperimentReadiness(
      report({
        totals: row({ spend: 250, impressions: 20000, clicks: 500, messages: 40, costPerMessage: 6.25 }),
        health: {
          score: 45,
          grade: "D",
          checks: [{ id: "tracking", label: "Tracking", status: "fail", detail: "Pixel events are missing." }],
        },
      }),
    );

    expect(result.status).toBe("not_ready");
    expect(result.blockers.en.join(" ")).toContain("Account health");
    expect(result.blockers.vi.join(" ")).toContain("sức khỏe tài khoản");
  });
});
