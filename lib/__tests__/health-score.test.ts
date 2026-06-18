import { describe, expect, it } from "vitest";
import { summarizeHealth } from "../health-score";
import type { DailyDiagnosis } from "../daily-diagnosis";
import type { DashboardReport, NormalizedRow } from "../types";

function row(): NormalizedRow {
  return {
    id: "total",
    level: "account",
    name: "Total",
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
  };
}

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  return {
    account: { id: "act", name: "Account", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-07" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "test",
    kpis: [],
    totals: row(),
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    regionRows: [],
    health: { score: 90, grade: "A", checks: [] },
    prompt: "",
    pulledAt: "2026-06-07T00:00:00.000Z",
    ...overrides,
  };
}

const stableDiagnosis: DailyDiagnosis = {
  status: "stable",
  summary: { en: "Stable", vi: "Ổn định" },
  window: { recentDays: 7, priorDays: 7 },
  causes: [],
};

describe("summarizeHealth", () => {
  it("keeps a healthy account healthy when checks pass", () => {
    const summary = summarizeHealth(
      report({ health: { score: 90, grade: "A", checks: [{ id: "ctr", label: "CTR", status: "pass", detail: "Strong" }] } }),
      stableDiagnosis,
    );

    expect(summary.score).toBe(90);
    expect(summary.severity).toBe("healthy");
    expect(summary.counts.healthy).toBe(1);
  });

  it("penalizes warning and fail checks", () => {
    const summary = summarizeHealth(
      report({
        health: {
          score: 90,
          grade: "A",
          checks: [
            { id: "ctr", label: "CTR", status: "warning", detail: "Soft" },
            { id: "frequency", label: "Frequency", status: "fail", detail: "High" },
          ],
        },
      }),
      stableDiagnosis,
    );

    expect(summary.score).toBe(72);
    expect(summary.grade).toBe("C");
    expect(summary.severity).toBe("danger");
    expect(summary.counts.danger).toBe(1);
    expect(summary.counts.warning).toBe(1);
  });

  it("folds daily diagnosis causes into triage", () => {
    const diagnosis: DailyDiagnosis = {
      status: "causes_found",
      summary: { en: "Found", vi: "Có" },
      window: { recentDays: 7, priorDays: 7 },
      causes: [
        {
          id: "creative_fatigue",
          severity: "danger",
          score: 50,
          title: { en: "Creative fatigue", vi: "Mỏi creative" },
          evidence: [],
          action: { en: "Refresh creative", vi: "Thay creative" },
        },
      ],
    };

    const summary = summarizeHealth(report(), diagnosis);

    expect(summary.severity).toBe("danger");
    expect(summary.counts.danger).toBe(1);
    expect(summary.items[0]).toMatchObject({ id: "daily-creative_fatigue", severity: "danger" });
  });
});
