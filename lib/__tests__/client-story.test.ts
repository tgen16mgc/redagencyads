import { describe, expect, it } from "vitest";
import { buildClientStory } from "../client-story";
import type { AiInsightTable, DashboardReport, NormalizedRow, Verdict } from "../types";

const totals: NormalizedRow = {
  id: "total",
  level: "account",
  name: "Total",
  spend: 48_200_000,
  impressions: 100_000,
  reach: 60_000,
  frequency: 3.8,
  clicks: 1_900,
  linkClicks: 1_700,
  ctr: 1.9,
  cpc: 25_368,
  cpm: 482_000,
  messages: 0,
  replies: 0,
  leads: 752,
  purchases: 0,
  addToCart: 0,
  initiateCheckout: 0,
  costPerMessage: 0,
  costPerReply: 0,
  cpl: 64_096,
  cpaPurchase: 0,
  roas: 0,
  replyRate: 0,
  leadRate: 0.442,
};

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  return {
    account: { id: "act_1", name: "Red Agency VN", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-05-20", until: "2026-06-18" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "Detected lead generation activity.",
    kpis: [
      { key: "spend", label: "Spend", format: "currency" },
      { key: "leads", label: "Leads", format: "number" },
      { key: "cpl", label: "CPL", format: "currency", intent: "warning" },
      { key: "ctr", label: "CTR", format: "percent" },
    ],
    totals,
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    regionRows: [],
    health: {
      score: 78,
      grade: "B+",
      checks: [
        { id: "creative", label: "Creative fatigue", status: "warning", detail: "Frequency is rising." },
        { id: "measurement", label: "Measurement quality", status: "pass", detail: "Enough lead volume for directional decisions." },
      ],
    },
    prompt: "Prompt",
    pulledAt: "2026-06-19T10:00:00.000Z",
    ...overrides,
  };
}

const verdict: Verdict = {
  verdict: "Lead volume improved, but rising frequency creates creative fatigue risk.",
  risks: ["Frequency is rising across core campaigns."],
  winners: ["Lead volume increased with stable click-through rate."],
  losers: ["Some placements are spending without proportional lead volume."],
  budget_moves: ["Shift budget gradually toward campaigns with stable CPL."],
  tests: ["Launch proof-led creative variants for the fatigued audience."],
  confidence: "high",
  assumptions: ["Meta attribution data is complete for the selected range."],
  provider: "9router",
};

const insights: AiInsightTable = {
  summary: "Performance improved, but creative fatigue should be addressed before scaling harder.",
  rows: [
    {
      area: "Creative",
      insight: "Frequency is approaching fatigue territory.",
      evidence: "Frequency reached 3.8.",
      action: "Refresh the main creative angle.",
      priority: "high",
      confidence: "medium",
    },
  ],
  confidence: "medium",
  assumptions: [],
  provider: "9router",
};

describe("buildClientStory", () => {
  it("uses Verdict as the client-safe headline when available", () => {
    const story = buildClientStory({ report: report(), verdict, insights: null, previousReport: null, compareMode: "off", language: "en" });

    expect(story.headline).toBe("Lead volume improved, but rising frequency creates creative fatigue risk.");
    expect(story.verdict.status).toBe("Needs attention");
    expect(story.verdict.confidence).toBe("high");
  });

  it("builds a useful story draft before Verdict exists", () => {
    const story = buildClientStory({ report: report(), verdict: null, insights: null, previousReport: null, compareMode: "off", language: "en" });

    expect(story.headline).toBe("Lead generation report is ready for client review.");
    expect(story.executiveSummary.length).toBe(3);
    expect(story.nextActions[0].title).toBe("Generate client Verdict");
  });

  it("includes KPI snapshot values from the report", () => {
    const story = buildClientStory({ report: report(), verdict, insights: null, previousReport: null, compareMode: "off", language: "en" });

    expect(story.kpis.map((kpi) => kpi.label)).toEqual(["Spend", "Leads", "CPL", "CTR"]);
    expect(story.kpis[0].value).toContain("48");
  });

  it("creates comparison changes when a previous report is available", () => {
    const previous = report({ totals: { ...totals, spend: 40_000_000, leads: 650, cpl: 61_538, ctr: 1.8 } });
    const story = buildClientStory({ report: report(), previousReport: previous, verdict, insights, compareMode: "wow", language: "en" });

    expect(story.whatChanged.some((item) => item.label === "Spend")).toBe(true);
    expect(story.whatChanged.some((item) => item.label === "Leads")).toBe(true);
  });

  it("groups evidence into client-readable causes", () => {
    const story = buildClientStory({ report: report(), verdict, insights, previousReport: null, compareMode: "off", language: "en" });

    expect(story.evidenceGroups.map((group) => group.title)).toEqual([
      "Performance movement",
      "Creative performance",
      "Budget allocation",
      "Measurement confidence",
    ]);
  });
});
