import { describe, expect, it } from "vitest";
import { summarizeHealth } from "../health-score";
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

describe("summarizeHealth", () => {
  it("keeps a healthy account healthy when checks pass", () => {
    const summary = summarizeHealth(
      report({ health: { score: 90, grade: "A", checks: [{ id: "ctr", label: "CTR", status: "pass", detail: "Strong" }] } }),
    );

    expect(summary.score).toBe(90);
    expect(summary.severity).toBe("healthy");
    expect(summary.counts.healthy).toBe(1);
  });

  it("penalizes warning and fail checks", () => {
    const summary = summarizeHealth(
      report({
        health: {
          score: 91,
          grade: "A",
          checks: [
            { id: "ctr", label: "CTR", status: "warning", detail: "Soft" },
            { id: "frequency", label: "Frequency", status: "fail", detail: "High" },
          ],
        },
      }),
    );

    expect(summary.score).toBe(73);
    expect(summary.grade).toBe("C");
    expect(summary.severity).toBe("danger");
    expect(summary.counts.danger).toBe(1);
    expect(summary.counts.warning).toBe(1);
  });

  it("folds daily diagnosis causes into triage", () => {
    const prior = Array.from({ length: 3 }, (_, index) => ({
      ...row(),
      id: `prior-${index}`,
      level: "daily" as const,
      name: `2026-06-0${index + 1}`,
      date: `2026-06-0${index + 1}`,
      ctr: 2,
      frequency: 2,
    }));
    const recent = Array.from({ length: 3 }, (_, index) => ({
      ...row(),
      id: `recent-${index}`,
      level: "daily" as const,
      name: `2026-06-0${index + 4}`,
      date: `2026-06-0${index + 4}`,
      ctr: 1,
      frequency: 3,
    }));

    const summary = summarizeHealth(report({ dailyRows: [...prior, ...recent] }));

    expect(summary.severity).toBe("danger");
    expect(summary.counts.danger).toBe(1);
    expect(summary.items[0]).toMatchObject({ id: "daily-creative_fatigue", severity: "danger" });
  });
});
