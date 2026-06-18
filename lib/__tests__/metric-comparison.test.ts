import { describe, expect, it } from "vitest";
import {
  buildKpiComparisons,
  comparisonDescriptor,
  formatComparisonChangePct,
  metricMovementIsBad,
} from "../metric-comparison";
import type { CompareMode, DashboardReport, InterfaceLanguage, KpiCard, NormalizedRow } from "../types";

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

const leadKpis: KpiCard[] = [
  { key: "spend", label: "Spend", format: "currency" },
  { key: "impressions", label: "Impressions", format: "number" },
  { key: "reach", label: "Reach", format: "number" },
  { key: "leads", label: "Leads", format: "number", intent: "good" },
  { key: "cpl", label: "CPL", format: "currency" },
  { key: "leadRate", label: "Lead/message", format: "percent" },
];

function report(overrides: Partial<DashboardReport>): DashboardReport {
  return {
    account: { id: "act", name: "Account", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-14" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "test",
    kpis: leadKpis,
    totals: row({ id: "total", level: "account", name: "Total" }),
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    regionRows: [],
    health: { score: 100, grade: "A", checks: [] },
    prompt: "",
    pulledAt: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

function daily(date: string, overrides: Partial<NormalizedRow>): NormalizedRow {
  return row({ id: date, level: "daily", name: date, date, ...overrides });
}

function comparisonArgs(overrides: {
  report: DashboardReport;
  previousReport?: DashboardReport | null;
  compareMode?: CompareMode;
}) {
  return {
    compareMode: "off" as CompareMode,
    previousReport: null,
    ...overrides,
  };
}

function descriptorArgs(overrides: {
  compareMode: CompareMode;
  language: InterfaceLanguage;
  previousReport?: DashboardReport | null;
}) {
  return {
    previousReport: null,
    ...overrides,
  };
}

describe("buildKpiComparisons", () => {
  it("uses previous report totals when a previous report is provided and compareMode is wow", () => {
    const current = report({ totals: row({ spend: 1000, leads: 10, cpl: 100 }) });
    const previous = report({ totals: row({ spend: 400, leads: 20, cpl: 20 }) });

    const deltas = buildKpiComparisons(comparisonArgs({ report: current, previousReport: previous, compareMode: "wow" }));

    expect(deltas.find((delta) => delta.key === "spend")).toMatchObject({ current: 1000, previous: 400 });
    expect(deltas.find((delta) => delta.key === "leads")).toMatchObject({ current: 10, previous: 20 });
    expect(deltas.find((delta) => delta.key === "cpl")).toMatchObject({ current: 100, previous: 20 });
  });

  it("falls back to recent vs prior daily-window comparison when compare mode is off and no previous report exists", () => {
    const current = report({
      dailyRows: [
        daily("2026-06-01", { spend: 5, leads: 1 }),
        daily("2026-06-02", { spend: 5, leads: 1 }),
        daily("2026-06-03", { spend: 5, leads: 1 }),
        daily("2026-06-04", { spend: 5, leads: 1 }),
        daily("2026-06-05", { spend: 5, leads: 1 }),
        daily("2026-06-06", { spend: 5, leads: 1 }),
        daily("2026-06-07", { spend: 5, leads: 1 }),
        daily("2026-06-08", { spend: 10, leads: 2 }),
        daily("2026-06-09", { spend: 10, leads: 2 }),
        daily("2026-06-10", { spend: 10, leads: 2 }),
        daily("2026-06-11", { spend: 10, leads: 2 }),
        daily("2026-06-12", { spend: 10, leads: 2 }),
        daily("2026-06-13", { spend: 10, leads: 2 }),
        daily("2026-06-14", { spend: 10, leads: 2 }),
      ],
    });

    const deltas = buildKpiComparisons(comparisonArgs({ report: current }));

    expect(deltas.find((delta) => delta.key === "spend")).toMatchObject({ current: 70, previous: 35 });
    expect(deltas.find((delta) => delta.key === "leads")).toMatchObject({ current: 14, previous: 7 });
  });

  it("recomputes daily-window derived metrics such as cpl from summed rows instead of averaging daily rates", () => {
    const current = report({
      dailyRows: [
        daily("2026-06-01", { spend: 70, leads: 7, cpl: 10 }),
        daily("2026-06-02", { spend: 2, leads: 1, cpl: 2 }),
        daily("2026-06-03", { spend: 2, leads: 1, cpl: 2 }),
        daily("2026-06-04", { spend: 2, leads: 1, cpl: 2 }),
        daily("2026-06-05", { spend: 2, leads: 1, cpl: 2 }),
        daily("2026-06-06", { spend: 2, leads: 1, cpl: 2 }),
        daily("2026-06-07", { spend: 2, leads: 1, cpl: 2 }),
        daily("2026-06-08", { spend: 90, leads: 9, cpl: 10 }),
        daily("2026-06-09", { spend: 1, leads: 1, cpl: 1 }),
        daily("2026-06-10", { spend: 1, leads: 1, cpl: 1 }),
        daily("2026-06-11", { spend: 1, leads: 1, cpl: 1 }),
        daily("2026-06-12", { spend: 1, leads: 1, cpl: 1 }),
        daily("2026-06-13", { spend: 1, leads: 1, cpl: 1 }),
        daily("2026-06-14", { spend: 1, leads: 1, cpl: 1 }),
      ],
    });

    const deltas = buildKpiComparisons(comparisonArgs({ report: current }));
    const cplDelta = deltas.find((delta) => delta.key === "cpl");

    expect(cplDelta?.current).toBeCloseTo(96 / 15);
    expect(cplDelta?.previous).toBeCloseTo(82 / 13);
  });

  it("returns no KPI deltas when there are too few dated daily rows and no previous report", () => {
    const current = report({
      dailyRows: [
        daily("2026-06-12", { spend: 10, leads: 1 }),
        daily("2026-06-13", { spend: 10, leads: 1 }),
        daily("2026-06-14", { spend: 10, leads: 1 }),
      ],
    });

    expect(buildKpiComparisons(comparisonArgs({ report: current }))).toEqual([]);
  });
});


describe("formatComparisonChangePct", () => {
  it("formats percentage-point deltas without multiplying them again", () => {
    expect(formatComparisonChangePct(-34.529, "en")).toBe("-34.5%");
    expect(formatComparisonChangePct(57.725, "en")).toBe("+57.7%");
  });
});

describe("metricMovementIsBad", () => {
  it("treats cost increases as bad and result decreases as bad", () => {
    expect(metricMovementIsBad("cpl", 25)).toBe(true);
    expect(metricMovementIsBad("cpc", 25)).toBe(true);
    expect(metricMovementIsBad("leads", -25)).toBe(true);
    expect(metricMovementIsBad("purchases", -25)).toBe(true);
    expect(metricMovementIsBad("cpl", -25)).toBe(false);
    expect(metricMovementIsBad("leads", 25)).toBe(false);
  });
});

describe("comparisonDescriptor", () => {
  it("labels WoW and MoM descriptors in English and Vietnamese", () => {
    const previous = report({});

    expect(comparisonDescriptor(descriptorArgs({ compareMode: "wow", previousReport: previous, language: "en" }))).toBe("vs WoW");
    expect(comparisonDescriptor(descriptorArgs({ compareMode: "mom", previousReport: previous, language: "en" }))).toBe("vs MoM");
    expect(comparisonDescriptor(descriptorArgs({ compareMode: "wow", previousReport: previous, language: "vi" }))).toBe("so với WoW");
    expect(comparisonDescriptor(descriptorArgs({ compareMode: "mom", previousReport: previous, language: "vi" }))).toBe("so với MoM");
  });

  it("labels recent-window descriptors in English and Vietnamese", () => {
    expect(comparisonDescriptor(descriptorArgs({ compareMode: "off", language: "en" }))).toBe("vs prior period");
    expect(comparisonDescriptor(descriptorArgs({ compareMode: "off", language: "vi" }))).toBe("so với kỳ trước");
  });
});
