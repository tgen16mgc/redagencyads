import { describe, expect, it } from "vitest";
import { detectBaselineAnomalies, anomalyBadgeText } from "../baseline-anomaly";
import type { NormalizedRow } from "../types";

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

function days(specs: Array<Partial<NormalizedRow>>): NormalizedRow[] {
  return specs.map((spec, index) => {
    const day = String(index + 1).padStart(2, "0");
    const month = index < 28 ? "05" : "06";
    const dayOfMonth = index < 28 ? String(index + 1).padStart(2, "0") : String(index - 27).padStart(2, "0");
    return row({ id: `d-${day}`, date: `2026-${month}-${dayOfMonth}`, ...spec });
  });
}

function fill(count: number, spec: Partial<NormalizedRow>): Array<Partial<NormalizedRow>> {
  return Array.from({ length: count }, () => ({ ...spec }));
}

describe("detectBaselineAnomalies", () => {
  it("returns insufficient_data with fewer than 21 rows", () => {
    const result = detectBaselineAnomalies(days(fill(15, { cpm: 100, ctr: 1.5 })));
    expect(result.status).toBe("insufficient_data");
    expect(result.anomalies).toEqual([]);
  });

  it("returns stable when metrics are consistent across windows", () => {
    const result = detectBaselineAnomalies(
      days(fill(28, { cpm: 100, ctr: 1.5, cpc: 5, frequency: 2, cpl: 50, roas: 3 })),
    );
    expect(result.status).toBe("stable");
    expect(result.anomalies).toEqual([]);
  });

  it("detects CPM spike as a warning or danger anomaly", () => {
    // 21 baseline days with CPM=100 (±small noise), then 7 recent days with CPM=160
    const baseline = fill(21, { cpm: 100, ctr: 1.5, cpc: 5, frequency: 2 });
    // Add small variance to baseline so stdDev is non-zero
    baseline[0].cpm = 95;
    baseline[5].cpm = 105;
    baseline[10].cpm = 98;
    baseline[15].cpm = 103;
    const recent = fill(7, { cpm: 160, ctr: 1.5, cpc: 5, frequency: 2 });
    const result = detectBaselineAnomalies(days([...baseline, ...recent]));

    expect(result.status).toBe("anomalies_found");
    const cpmAnomaly = result.anomalies.find((a) => a.key === "cpm");
    expect(cpmAnomaly).toBeDefined();
    expect(cpmAnomaly!.direction).toBe("up");
    expect(cpmAnomaly!.changePct).toBeGreaterThan(0);
    // CPM up is bad (cost metric), so severity should not be "info"
    expect(["warning", "danger"]).toContain(cpmAnomaly!.severity);
  });

  it("does not flag CTR going up as a problem", () => {
    const baseline = fill(21, { cpm: 100, ctr: 1.0, cpc: 5, frequency: 2 });
    baseline[0].ctr = 0.9;
    baseline[5].ctr = 1.1;
    baseline[10].ctr = 0.95;
    baseline[15].ctr = 1.05;
    const recent = fill(7, { cpm: 100, ctr: 2.5, cpc: 5, frequency: 2 });
    const result = detectBaselineAnomalies(days([...baseline, ...recent]));

    const ctrAnomaly = result.anomalies.find((a) => a.key === "ctr");
    // CTR going up is good, so it should be suppressed (direction-adjusted to "info" and filtered)
    expect(ctrAnomaly).toBeUndefined();
  });

  it("flags CTR dropping as a warning", () => {
    const baseline = fill(21, { cpm: 100, ctr: 2.0, cpc: 5, frequency: 2 });
    baseline[0].ctr = 1.9;
    baseline[5].ctr = 2.1;
    baseline[10].ctr = 1.95;
    baseline[15].ctr = 2.05;
    const recent = fill(7, { cpm: 100, ctr: 0.8, cpc: 5, frequency: 2 });
    const result = detectBaselineAnomalies(days([...baseline, ...recent]));

    const ctrAnomaly = result.anomalies.find((a) => a.key === "ctr");
    expect(ctrAnomaly).toBeDefined();
    expect(ctrAnomaly!.direction).toBe("down");
    expect(["warning", "danger"]).toContain(ctrAnomaly!.severity);
  });

  it("flags drift on a perfectly flat baseline (zero variance)", () => {
    // Baseline CPM is dead flat (stdDev = 0); a real drift should still surface, not be skipped.
    const baseline = fill(21, { cpm: 100, ctr: 1.5, cpc: 5, frequency: 2 });
    const recent = fill(7, { cpm: 140, ctr: 1.5, cpc: 5, frequency: 2 });
    const result = detectBaselineAnomalies(days([...baseline, ...recent]));

    const cpmAnomaly = result.anomalies.find((a) => a.key === "cpm");
    expect(cpmAnomaly).toBeDefined();
    expect(cpmAnomaly!.direction).toBe("up");
    expect(["warning", "danger"]).toContain(cpmAnomaly!.severity);
  });

  it("ignores a tiny drift on a flat baseline below the change floor", () => {
    const baseline = fill(21, { cpm: 100, ctr: 1.5, cpc: 5, frequency: 2 });
    const recent = fill(7, { cpm: 104, ctr: 1.5, cpc: 5, frequency: 2 });
    const result = detectBaselineAnomalies(days([...baseline, ...recent]));

    expect(result.anomalies.find((a) => a.key === "cpm")).toBeUndefined();
  });

  it("caps anomalies at 5", () => {
    // Create dramatic shifts in many metrics at once
    const baseline = fill(21, { cpm: 100, cpc: 5, ctr: 2, cpl: 50, roas: 3, frequency: 2, costPerMessage: 20, cpaPurchase: 80 });
    baseline[0] = { ...baseline[0], cpm: 95, cpc: 4.8, cpl: 48, costPerMessage: 19 };
    baseline[5] = { ...baseline[5], cpm: 105, cpc: 5.2, cpl: 52, costPerMessage: 21 };
    const recent = fill(7, { cpm: 200, cpc: 15, ctr: 0.5, cpl: 150, roas: 0.8, frequency: 6, costPerMessage: 60, cpaPurchase: 200 });
    const result = detectBaselineAnomalies(days([...baseline, ...recent]));

    expect(result.anomalies.length).toBeLessThanOrEqual(5);
  });

  it("generates correct badge text", () => {
    const baseline = fill(21, { cpm: 100, ctr: 1.5, cpc: 5, frequency: 2 });
    baseline[0].cpm = 95;
    baseline[5].cpm = 105;
    const recent = fill(7, { cpm: 160, ctr: 1.5, cpc: 5, frequency: 2 });
    const result = detectBaselineAnomalies(days([...baseline, ...recent]));

    if (result.anomalies.length > 0) {
      const text = anomalyBadgeText(result.anomalies[0], "en");
      expect(text).toContain("↑");
      const viText = anomalyBadgeText(result.anomalies[0], "vi");
      expect(viText).toBeTruthy();
    }
  });
});
