import { describe, expect, it } from "vitest";
import { breakdownWasteDiagnostic, runDiagnostics, type DiagnosticId } from "../diagnosis";
import type { DashboardReport, NormalizedRow } from "../types";

const DIAGNOSTIC_ORDER: DiagnosticId[] = [
  "healthTriage",
  "dailyDiagnosis",
  "experimentReadiness",
  "decisionConfidence",
  "spendPacing",
  "consolidationPressure",
  "costCapDelivery",
  "creativeVolume",
  "creativeStarvation",
  "budgetMove",
  "resultConcentration",
  "funnelLeakage",
  "audienceOverlap",
  "targetingExclusions",
  "measurementQuality",
];

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
    dateRange: { since: "2026-07-01", until: "2026-07-07" },
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
    pulledAt: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

function adsetRow(id: string, name: string, spend: number, messages: number, ctr: number, frequency: number): NormalizedRow {
  return row({ id, level: "adset", name, spend, messages, ctr, frequency, impressions: spend * 100, clicks: spend * 2, linkClicks: spend * 2 });
}

function adRow(id: string, adsetId: string, adsetName: string, spend: number, messages: number): NormalizedRow {
  return row({
    id,
    adId: id,
    level: "ad",
    name: `Ad ${id}`,
    adsetId,
    adsetName,
    spend,
    messages,
    impressions: 5000,
    ctr: 1.4,
    frequency: 2,
  });
}

function richReport(): DashboardReport {
  const dailyRows = Array.from({ length: 14 }, (_, index) =>
    row({
      id: `day-${index}`,
      level: "account",
      name: `Day ${index}`,
      date: new Date(Date.UTC(2026, 5, 24 + index)).toISOString().slice(0, 10),
      spend: 40,
      impressions: 4000,
      reach: 3000,
      ctr: 1.5,
      frequency: 1.8,
      cpm: 10,
      cpc: 0.5,
      linkClicks: 80,
      messages: 6,
    }),
  );

  return report({
    totals: row({
      id: "total",
      name: "Account total",
      spend: 600,
      impressions: 60000,
      clicks: 1500,
      linkClicks: 1200,
      messages: 90,
      addToCart: 120,
      initiateCheckout: 40,
      purchases: 12,
      ctr: 1.5,
      frequency: 2,
    }),
    campaignRows: [
      row({ id: "c1", level: "campaign", name: "Campaign One", spend: 340, dailyBudget: 50, messages: 50, impressions: 30000, ctr: 1.4, frequency: 2 }),
      row({ id: "c2", level: "campaign", name: "Campaign Two", spend: 300, dailyBudget: 50, messages: 40, impressions: 28000, ctr: 1.4, frequency: 2 }),
    ],
    adsetRows: [
      adsetRow("as1", "Broad Male 25-45", 250, 50, 1.5, 1.8),
      adsetRow("as2", "Interest E-commerce", 200, 30, 1.2, 2),
      adsetRow("as3", "Retargeting Page Engagement", 150, 10, 0.9, 2.2),
    ],
    adRows: [
      adRow("ad1", "as1", "Broad Male 25-45", 90, 10),
      adRow("ad2", "as1", "Broad Male 25-45", 80, 9),
      adRow("ad3", "as1", "Broad Male 25-45", 80, 8),
      adRow("ad4", "as2", "Interest E-commerce", 70, 8),
      adRow("ad5", "as2", "Interest E-commerce", 70, 7),
      adRow("ad6", "as2", "Interest E-commerce", 60, 6),
    ],
    dailyRows,
    health: { score: 85, grade: "B", checks: [{ id: "tracking", label: "Tracking", status: "pass", detail: "Pixel events flowing." }] },
  });
}

describe("runDiagnostics", () => {
  it("runs every diagnostic rule in the pinned registry order", () => {
    const diagnostics = runDiagnostics(richReport());
    expect(diagnostics.map((diagnostic) => diagnostic.id)).toEqual(DIAGNOSTIC_ORDER);
  });

  it("yields the expected severity for every diagnostic on a healthy fixture", () => {
    const diagnostics = runDiagnostics(richReport());
    const severities = Object.fromEntries(diagnostics.map((diagnostic) => [diagnostic.id, diagnostic.severity]));
    expect(severities).toEqual({
      healthTriage: "ok",
      dailyDiagnosis: "ok",
      experimentReadiness: "ok",
      decisionConfidence: "watch",
      spendPacing: "ok",
      consolidationPressure: "ok",
      costCapDelivery: "ok",
      creativeVolume: "watch",
      creativeStarvation: "ok",
      budgetMove: "ok",
      resultConcentration: "ok",
      funnelLeakage: "ok",
      audienceOverlap: "ok",
      targetingExclusions: "ok",
      measurementQuality: "ok",
    });
  });

  it("returns bilingual label, badge, and next-step content for every diagnostic", () => {
    for (const diagnostic of runDiagnostics(richReport())) {
      expect(diagnostic.title.en.trim().length, diagnostic.id).toBeGreaterThan(0);
      expect(diagnostic.title.vi.trim().length, diagnostic.id).toBeGreaterThan(0);
      expect(diagnostic.badge.en.trim().length, diagnostic.id).toBeGreaterThan(0);
      expect(diagnostic.badge.vi.trim().length, diagnostic.id).toBeGreaterThan(0);
      expect(diagnostic.nextStep.en.trim().length, diagnostic.id).toBeGreaterThan(0);
      expect(diagnostic.nextStep.vi.trim().length, diagnostic.id).toBeGreaterThan(0);
    }
  });

  it("surfaces blocked rows as detail items for decision confidence", () => {
    const diagnostics = runDiagnostics(richReport());
    const confidence = diagnostics.find((diagnostic) => diagnostic.id === "decisionConfidence")!;
    expect(confidence.badge.en).toBe("2/3 actionable");
    expect(confidence.items).toHaveLength(1);
    expect(confidence.items[0].title?.en).toBe("Retargeting Page Engagement");
  });

  it("reports the shared insufficient severity everywhere applicable on an empty report", () => {
    const diagnostics = runDiagnostics(report());
    const insufficient = diagnostics.filter((diagnostic) => diagnostic.severity === "insufficient").map((diagnostic) => diagnostic.id);
    expect(insufficient).toEqual([
      "dailyDiagnosis",
      "decisionConfidence",
      "spendPacing",
      "consolidationPressure",
      "costCapDelivery",
      "creativeVolume",
      "creativeStarvation",
      "budgetMove",
      "resultConcentration",
      "funnelLeakage",
      "audienceOverlap",
      "measurementQuality",
    ]);
  });
});

describe("breakdownWasteDiagnostic", () => {
  it("maps the waste rule onto the uniform diagnostic shape", () => {
    const diagnostic = breakdownWasteDiagnostic({
      rows: [
        row({ id: "fb", name: "Facebook Feed", platform: "facebook", spend: 300, impressions: 10000, messages: 3 }),
        row({ id: "ig", name: "Instagram Feed", platform: "instagram", spend: 100, impressions: 8000, messages: 20 }),
        row({ id: "stories", name: "Stories", platform: "instagram", spend: 100, impressions: 6000, messages: 12 }),
      ],
      pack: "messages",
      chartRows: [],
      dimensionLabel: "Platform",
    });

    expect(diagnostic.id).toBe("breakdownWaste");
    expect(diagnostic.severity).toBe("risk");
    expect(diagnostic.badge.en).toBe("Waste detected");
    expect(diagnostic.description.en).toContain("Platform");
    expect(diagnostic.waste.rows[0].name).toBe("Facebook Feed");
    expect(diagnostic.nextStep.en.trim().length).toBeGreaterThan(0);
  });
});
