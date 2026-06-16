import { describe, expect, it } from "vitest";
import { analyzeComparisonRootCauses } from "../comparison-root-cause";
import type { DashboardReport, NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "campaign",
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

function report(overrides: Partial<DashboardReport>): DashboardReport {
  return {
    account: { id: "act", name: "Account", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-07" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "test",
    kpis: [],
    totals: row({ id: "total", level: "account", name: "Total" }),
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    health: { score: 100, grade: "A", checks: [] },
    prompt: "",
    pulledAt: "2026-06-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("analyzeComparisonRootCauses", () => {
  it("returns insufficient data when there are no matched rows", () => {
    const current = report({ campaignRows: [row({ id: "current-only", name: "Current", spend: 100, leads: 10 })] });
    const previous = report({ campaignRows: [row({ id: "previous-only", name: "Previous", spend: 100, leads: 10 })] });

    const analysis = analyzeComparisonRootCauses(current, previous);

    expect(analysis.status).toBe("insufficient_data");
    expect(analysis.drivers).toEqual([]);
  });

  it("flags a negative driver when spend rises and lead efficiency worsens", () => {
    const current = report({
      campaignRows: [row({ id: "campaign-1", name: "Prospecting", spend: 200, leads: 5, cpl: 40, ctr: 0.7, frequency: 3.4 })],
    });
    const previous = report({
      campaignRows: [row({ id: "campaign-1", name: "Prospecting", spend: 100, leads: 10, cpl: 10, ctr: 1.4, frequency: 2 })],
    });

    const analysis = analyzeComparisonRootCauses(current, previous);

    expect(analysis.status).toBe("drivers_found");
    expect(analysis.drivers[0]).toMatchObject({
      rowId: "campaign-1",
      rowName: "Prospecting",
      direction: "negative",
      primaryMetric: "cpl",
    });
    expect(analysis.drivers[0].evidence).toContain("CPL up 300%");
    expect(analysis.drivers[0].evidence).toContain("Spend up 100%");
  });

  it("flags a positive driver when row volume grows while efficiency improves", () => {
    const current = report({
      adsetRows: [row({ id: "adset-1", level: "adset", name: "Retargeting", spend: 180, leads: 18, cpl: 10, ctr: 2.2 })],
    });
    const previous = report({
      adsetRows: [row({ id: "adset-1", level: "adset", name: "Retargeting", spend: 120, leads: 6, cpl: 20, ctr: 1.1 })],
    });

    const analysis = analyzeComparisonRootCauses(current, previous);

    expect(analysis.status).toBe("drivers_found");
    expect(analysis.drivers[0]).toMatchObject({
      rowId: "adset-1",
      rowName: "Retargeting",
      direction: "positive",
      primaryMetric: "leads",
    });
    expect(analysis.drivers[0].evidence).toContain("Leads up 200%");
    expect(analysis.drivers[0].evidence).toContain("CPL down 50%");
  });

  it("uses CPC as the traffic-pack efficiency metric for negative drivers", () => {
    const current = report({
      selectedPack: "traffic",
      detectedPack: "traffic",
      campaignRows: [row({ id: "campaign-1", name: "Traffic", spend: 200, linkClicks: 100, cpc: 2, ctr: 0.7, frequency: 3.4 })],
    });
    const previous = report({
      selectedPack: "traffic",
      detectedPack: "traffic",
      campaignRows: [row({ id: "campaign-1", name: "Traffic", spend: 100, linkClicks: 120, cpc: 0.8, ctr: 1.4, frequency: 2 })],
    });

    const analysis = analyzeComparisonRootCauses(current, previous);

    expect(analysis.status).toBe("drivers_found");
    expect(analysis.drivers[0]).toMatchObject({
      rowId: "campaign-1",
      direction: "negative",
      primaryMetric: "cpc",
    });
    expect(analysis.drivers[0].evidence).toContain("CPC up 150%");
  });

  it("ignores matched rows when movement is too small to explain", () => {
    const current = report({ campaignRows: [row({ id: "campaign-1", spend: 110, leads: 11, cpl: 10 })] });
    const previous = report({ campaignRows: [row({ id: "campaign-1", spend: 100, leads: 10, cpl: 10 })] });

    const analysis = analyzeComparisonRootCauses(current, previous);

    expect(analysis.status).toBe("no_clear_driver");
    expect(analysis.drivers).toEqual([]);
  });
});
