import { describe, expect, it } from "vitest";
import { assessMeasurementQuality } from "../measurement-quality";
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
    health: { score: 80, grade: "B", checks: [] },
    prompt: "prompt",
    pulledAt: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("assessMeasurementQuality", () => {
  it("marks no-spend reports as not applicable", () => {
    const result = assessMeasurementQuality(report());

    expect(result.status).toBe("not_applicable");
    expect(result.variant).toBe("outline");
    expect(result.label.en).toBe("Not applicable");
  });

  it("marks spend with primary results as good for message campaigns", () => {
    const result = assessMeasurementQuality(
      report({
        selectedPack: "messages",
        totals: row({ spend: 100, impressions: 10000, clicks: 200, messages: 20, costPerMessage: 5 }),
      }),
    );

    expect(result.status).toBe("good");
    expect(result.variant).toBe("secondary");
    expect(result.reasons.en.join(" ")).toContain("Primary result signal is present");
  });

  it("marks spend without conversion/result signal as unverified", () => {
    const result = assessMeasurementQuality(
      report({
        selectedPack: "lead_gen",
        totals: row({ spend: 100, impressions: 10000, clicks: 200, leads: 0, cpl: 0 }),
      }),
    );

    expect(result.status).toBe("unverified");
    expect(result.variant).toBe("destructive");
    expect(result.reasons.en.join(" ")).toContain("Tracking data is not available in the current dataset");
  });

  it("marks sales reports with purchases but missing ROAS as limited", () => {
    const result = assessMeasurementQuality(
      report({
        selectedPack: "sales_roas",
        totals: row({ spend: 300, impressions: 20000, clicks: 500, purchases: 8, cpaPurchase: 37.5, roas: 0 }),
      }),
    );

    expect(result.status).toBe("limited");
    expect(result.variant).toBe("outline");
    expect(result.reasons.en.join(" ")).toContain("Value or ROAS data is missing");
    expect(result.reasons.vi.join(" ")).toContain("thiếu dữ liệu giá trị hoặc ROAS");
  });
});
