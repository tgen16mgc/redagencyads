import { describe, expect, it } from "vitest";
import { buildClientReportViewModel } from "../client-report";
import type { DashboardReport, KpiCard, NormalizedRow, Verdict } from "../types";

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

const kpis: KpiCard[] = [
  { key: "spend", label: "Spend", format: "currency" },
  { key: "leads", label: "Leads", format: "number" },
  { key: "cpl", label: "CPL", format: "currency" },
  { key: "healthScore", label: "Health", format: "number" },
];

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  return {
    account: { id: "act", name: "Seoul Beauty Clinic", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-26" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "Lead actions detected.",
    kpis,
    totals: row({ id: "total", level: "account", name: "Total", spend: 84000000, leads: 1200, cpl: 70000 }),
    campaignRows: [row({ id: "c1", name: "Lead campaign - HCM", spend: 30000000, leads: 500, cpl: 60000 })],
    adsetRows: [row({ id: "a1", name: "Consult retargeting", spend: 14000000, leads: 250, cpl: 56000 })],
    adRows: [row({ id: "ad1", level: "ad", name: "Testimonial ad", spend: 5000000, leads: 80, cpl: 62500 })],
    dailyRows: [
      row({ id: "d1", level: "daily", name: "2026-06-25", date: "2026-06-25", spend: 3000000, leads: 40 }),
      row({ id: "d2", level: "daily", name: "2026-06-26", date: "2026-06-26", spend: 3200000, leads: 44 }),
    ],
    platformRows: [row({ id: "p1", level: "breakdown", name: "instagram", platform: "instagram", spend: 50000000, leads: 700 })],
    ageGenderRows: [row({ id: "ag1", level: "breakdown", name: "25-34 female", age: "25-34", gender: "female", spend: 22000000, leads: 340 })],
    regionRows: [row({ id: "r1", level: "breakdown", name: "Ho Chi Minh", region: "Ho Chi Minh", spend: 36000000, leads: 620 })],
    health: {
      score: 82,
      grade: "B",
      checks: [
        { id: "ctr", label: "CTR benchmark", status: "pass", detail: "CTR is above benchmark." },
        { id: "freq", label: "Frequency", status: "warning", detail: "Frequency is rising." },
      ],
    },
    prompt: "Prompt",
    pulledAt: "2026-06-26T10:00:00.000Z",
    adsetPreviews: [
      {
        id: "as1",
        name: "Consult retargeting",
        campaignId: "c1",
        campaignName: "Lead campaign - HCM",
        status: "ACTIVE",
        dailyBudget: 1000000,
        lifetimeBudget: 0,
        ads: [{ id: "ad1", name: "Testimonial ad", adsetId: "as1", previewHtml: "<iframe></iframe>" }],
      },
    ],
    ...overrides,
  };
}

function verdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    verdict: "Scale carefully while protecting CPA.",
    risks: ["Frequency is rising on retargeting."],
    winners: ["Lead campaign - HCM is the strongest volume driver."],
    losers: [],
    budget_moves: ["Move 15% more budget to the efficient lead cluster."],
    tests: ["Launch testimonial creative variants."],
    confidence: "high",
    assumptions: [],
    provider: "prompt",
    ...overrides,
  };
}

describe("buildClientReportViewModel", () => {
  it("builds client-ready KPI cards with comparison deltas", () => {
    const model = buildClientReportViewModel({
      report: report(),
      previousReport: report({ totals: row({ id: "prev", level: "account", name: "Previous", spend: 70000000, leads: 1000, cpl: 70000 }) }),
      compareMode: "mom",
      language: "en",
      kpis,
      verdict: verdict(),
    });

    expect(model.accountName).toBe("Seoul Beauty Clinic");
    expect(model.verdictText).toBe("Scale carefully while protecting CPA.");
    expect(model.kpis.find((kpi) => kpi.key === "spend")?.delta).toContain("vs MoM");
    expect(model.kpis.find((kpi) => kpi.key === "healthScore")?.value).toBe("B");
  });

  it("keeps appendix tables and creative details explicit", () => {
    const model = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "en",
      kpis,
    });

    expect(model.tables.map((table) => table.title)).toEqual(["Campaigns", "Ad sets", "Ads", "Daily"]);
    expect(model.tables[0].rows[0].name).toBe("Lead campaign - HCM");
    expect(model.creativeDetails[0]).toMatchObject({ name: "Consult retargeting", adCount: 1, ads: ["Testimonial ad"] });
  });

  it("uses Vietnamese report copy when requested", () => {
    const model = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "vi",
      kpis,
    });

    expect(model.copy.executiveSummary).toBe("Tóm tắt điều hành");
    expect(model.copy.appendixCharts).toContain("Phụ lục A");
    expect(model.dateRangeLabel).toContain("2026");
  });
});
