import { describe, expect, it } from "vitest";
import { diagnoseDailyChange, diagnosisText } from "../daily-diagnosis";
import type { KpiPack, NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "daily",
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

// Build N dated daily rows from a per-day template; date increments from 2026-06-01.
function days(specs: Array<Partial<NormalizedRow>>): NormalizedRow[] {
  return specs.map((spec, index) => {
    const day = String(index + 1).padStart(2, "0");
    return row({ id: `d-${day}`, date: `2026-06-${day}`, ...spec });
  });
}

function fill(count: number, spec: Partial<NormalizedRow>): Array<Partial<NormalizedRow>> {
  return Array.from({ length: count }, () => ({ ...spec }));
}

describe("diagnoseDailyChange", () => {
  it("returns insufficient_data below 6 dated rows", () => {
    const result = diagnoseDailyChange({
      selectedPack: "lead_gen",
      dailyRows: days(fill(4, { leads: 10, ctr: 1.5 })),
    });
    expect(result.status).toBe("insufficient_data");
    expect(result.causes).toEqual([]);
  });

  it("returns stable when nothing moves materially", () => {
    const result = diagnoseDailyChange({
      selectedPack: "lead_gen",
      dailyRows: days(fill(8, { leads: 10, ctr: 1.5, frequency: 2, cpm: 100, reach: 1000, linkClicks: 100, spend: 50 })),
    });
    expect(result.status).toBe("stable");
    expect(result.causes).toEqual([]);
  });

  it("detects creative fatigue when CTR falls and frequency rises", () => {
    const prior = fill(4, { ctr: 2.0, frequency: 2.0, reach: 1000, cpm: 100, linkClicks: 100, leads: 10, spend: 50 });
    const recent = fill(4, { ctr: 1.2, frequency: 3.0, reach: 1000, cpm: 100, linkClicks: 100, leads: 10, spend: 50 });
    const result = diagnoseDailyChange({ selectedPack: "lead_gen", dailyRows: days([...prior, ...recent]) });

    expect(result.status).toBe("causes_found");
    const fatigue = result.causes.find((c) => c.id === "creative_fatigue");
    expect(fatigue).toBeDefined();
    expect(fatigue!.evidence.map((e) => e.en)).toContain("CTR down 40%");
  });

  it("detects audience saturation when reach falls and CPM rises", () => {
    const prior = fill(4, { reach: 1000, cpm: 100, ctr: 1.5, frequency: 2, linkClicks: 100, leads: 10, spend: 50 });
    const recent = fill(4, { reach: 700, cpm: 140, ctr: 1.5, frequency: 2, linkClicks: 100, leads: 10, spend: 50 });
    const result = diagnoseDailyChange({ selectedPack: "lead_gen", dailyRows: days([...prior, ...recent]) });

    const saturation = result.causes.find((c) => c.id === "audience_saturation");
    expect(saturation).toBeDefined();
  });

  it("flags auction pressure when CPM rises but CTR and reach hold", () => {
    const prior = fill(4, { cpm: 100, ctr: 1.5, reach: 1000, frequency: 2, linkClicks: 100, leads: 10, spend: 50 });
    const recent = fill(4, { cpm: 140, ctr: 1.5, reach: 1020, frequency: 2, linkClicks: 100, leads: 10, spend: 50 });
    const result = diagnoseDailyChange({ selectedPack: "lead_gen", dailyRows: days([...prior, ...recent]) });

    const auction = result.causes.find((c) => c.id === "auction_pressure");
    expect(auction).toBeDefined();
    expect(auction!.severity).toBe("warning");
  });

  it("detects funnel breakdown when conversion rate drops while CTR holds", () => {
    const prior = fill(4, { linkClicks: 100, leads: 10, ctr: 1.5, frequency: 2, cpm: 100, reach: 1000, spend: 50 });
    const recent = fill(4, { linkClicks: 100, leads: 6, ctr: 1.5, frequency: 2, cpm: 100, reach: 1000, spend: 50 });
    const result = diagnoseDailyChange({ selectedPack: "lead_gen", dailyRows: days([...prior, ...recent]) });

    const funnel = result.causes.find((c) => c.id === "funnel_breakdown");
    expect(funnel).toBeDefined();
  });

  it("does not flag funnel breakdown for the traffic pack", () => {
    const prior = fill(4, { linkClicks: 100, ctr: 1.5, frequency: 2, cpm: 100, reach: 1000, spend: 50 });
    const recent = fill(4, { linkClicks: 60, ctr: 1.5, frequency: 2, cpm: 100, reach: 1000, spend: 50 });
    const result = diagnoseDailyChange({ selectedPack: "traffic", dailyRows: days([...prior, ...recent]) });

    expect(result.causes.find((c) => c.id === "funnel_breakdown")).toBeUndefined();
  });

  it("uses the pack result metric for efficiency decay (purchases for sales)", () => {
    const prior = fill(4, { purchases: 20, spend: 100, ctr: 1.5, frequency: 2, cpm: 100, reach: 1000, linkClicks: 100 });
    const recent = fill(4, { purchases: 12, spend: 100, ctr: 1.5, frequency: 2, cpm: 100, reach: 1000, linkClicks: 100 });
    const result = diagnoseDailyChange({ selectedPack: "sales_roas", dailyRows: days([...prior, ...recent]) });

    const decay = result.causes.find((c) => c.id === "efficiency_decay");
    expect(decay).toBeDefined();
    expect(decay!.evidence.map((e) => e.en).some((line) => line.startsWith("Purchases"))).toBe(true);
  });

  it("ranks causes by score and caps the list", () => {
    const prior = fill(4, { ctr: 2.0, frequency: 2.0, reach: 1000, cpm: 100, linkClicks: 100, leads: 10, spend: 50 });
    const recent = fill(4, { ctr: 1.0, frequency: 3.5, reach: 600, cpm: 160, linkClicks: 100, leads: 5, spend: 50 });
    const result = diagnoseDailyChange({ selectedPack: "lead_gen", dailyRows: days([...prior, ...recent]) });

    expect(result.status).toBe("causes_found");
    expect(result.causes.length).toBeLessThanOrEqual(4);
    const scores = result.causes.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("localizes output through diagnosisText", () => {
    const prior = fill(4, { ctr: 2.0, frequency: 2.0, reach: 1000, cpm: 100, linkClicks: 100, leads: 10, spend: 50 });
    const recent = fill(4, { ctr: 1.2, frequency: 3.0, reach: 1000, cpm: 100, linkClicks: 100, leads: 10, spend: 50 });
    const diagnosis = diagnoseDailyChange({ selectedPack: "lead_gen", dailyRows: days([...prior, ...recent]) });

    const vi = diagnosisText(diagnosis, "vi");
    expect(vi.causes[0].title).toBe("Mỏi creative");
    expect(vi.causes[0].evidence[0]).toContain("giảm");
  });
});
