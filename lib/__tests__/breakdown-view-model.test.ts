import { describe, expect, it } from "vitest";
import {
  buildBreakdownChartRows,
  buildBreakdownDimensions,
  buildBreakdownViewModel,
  chooseBreakdownChartType,
} from "../breakdown-view-model";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "breakdown",
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

describe("buildBreakdownChartRows", () => {
  it("labels geography before generic row names and computes spend share", () => {
    const rows = buildBreakdownChartRows([
      row({ id: "hcm", name: "1", region: "Ho Chi Minh City", spend: 90, messages: 9 }),
      row({ id: "hn", name: "2", region: "Hanoi", spend: 10, messages: 1 }),
    ], "messages");

    expect(rows[0]).toMatchObject({ id: "hcm", label: "Ho Chi Minh City", results: 9 });
    expect(rows[0].share).toBeCloseTo(0.9);
    expect(rows[0].spendShare).toBeCloseTo(0.9);
    expect(rows[0].resultShare).toBeCloseTo(0.9);
  });

  it("uses the selected KPI pack to compute primary results", () => {
    const trafficRows = buildBreakdownChartRows([
      row({ id: "traffic", platform: "instagram", spend: 50, messages: 20, linkClicks: 200 }),
    ], "traffic");

    expect(trafficRows[0].results).toBe(200);
  });

  it("marks zero-result spend as a warning row with an efficiency fallback value", () => {
    const rows = buildBreakdownChartRows([
      row({ id: "waste", platform: "facebook", spend: 100, messages: 0 }),
      row({ id: "winner", platform: "instagram", spend: 50, messages: 10 }),
    ], "messages");

    expect(rows[0].tone).toBe("warning");
    expect(rows[0].costPerResult).toBeNull();
    expect(rows[0].efficiencyValue).toBeGreaterThan(rows[1].efficiencyValue);
  });
});

describe("chooseBreakdownChartType", () => {
  it("uses ranked bars by default and scatter only when efficiency has enough rows", () => {
    const fourRows = buildBreakdownChartRows(Array.from({ length: 4 }, (_, index) => row({ id: String(index), platform: `p${index}`, spend: 10, messages: 1 })), "messages");
    const sixRows = buildBreakdownChartRows(Array.from({ length: 6 }, (_, index) => row({ id: String(index), platform: `p${index}`, spend: 10, messages: 1 })), "messages");

    expect(chooseBreakdownChartType(fourRows, "spend")).toBe("bar");
    expect(chooseBreakdownChartType(fourRows, "efficiency")).toBe("bar");
    expect(chooseBreakdownChartType(sixRows, "efficiency")).toBe("scatter");
  });
});

describe("buildBreakdownViewModel", () => {
  it("splits combined age and gender breakdown rows into separate dimensions", () => {
    const dimensions = buildBreakdownDimensions({
      platformRows: [],
      ageGenderRows: [
        row({ id: "18-m", age: "18-24", gender: "male", spend: 60, messages: 6 }),
        row({ id: "18-f", age: "18-24", gender: "female", spend: 40, messages: 4 }),
        row({ id: "25-f", age: "25-34", gender: "female", spend: 100, messages: 20 }),
      ],
      regionRows: [],
      language: "en",
    });

    const age = dimensions.find((dimension) => dimension.value === "age");
    const gender = dimensions.find((dimension) => dimension.value === "gender");

    expect(age?.rows).toHaveLength(2);
    expect(age?.rows.find((dimensionRow) => dimensionRow.age === "18-24")?.spend).toBe(100);
    expect(gender?.rows).toHaveLength(2);
    expect(gender?.rows.find((dimensionRow) => dimensionRow.gender === "female")?.messages).toBe(24);
  });

  it("falls back to the first available dimension and exposes accessible chart copy", () => {
    const dimensions = buildBreakdownDimensions({
      platformRows: [],
      ageGenderRows: [],
      regionRows: [row({ id: "hcm", region: "Ho Chi Minh City", spend: 100, leads: 4 })],
      language: "en",
    });

    const model = buildBreakdownViewModel({
      dimensions,
      selectedDimension: "platform",
      mode: "spend",
      pack: "lead_gen",
      language: "en",
    });

    expect(model.activeDimension).toBe("geography");
    expect(model.chartLabel).toBe("Segment ranking");
    expect(model.ariaLabel).toBe("Segment ranking for Geography, measured by Spend");
    expect(model.chartExplanation).toContain("allocation is out of balance");
    expect(model.resultLabel).toBe("leads");
  });

  it("surfaces diagnosis and action copy for high-spend weak-result segments", () => {
    const dimensions = buildBreakdownDimensions({
      platformRows: [
        row({ id: "fb", platform: "facebook", spend: 300, messages: 2 }),
        row({ id: "ig", platform: "instagram", spend: 100, messages: 20 }),
        row({ id: "tt", platform: "audience_network", spend: 80, messages: 15 }),
      ],
      ageGenderRows: [],
      regionRows: [],
      language: "en",
    });

    const model = buildBreakdownViewModel({
      dimensions,
      selectedDimension: "platform",
      mode: "efficiency",
      pack: "messages",
      language: "en",
    });

    expect(model.chartType).toBe("bar");
    expect(model.metricLabel).toBe("Cost per result");
    expect(model.insightTone).toBe("warning");
    expect(model.topInsight).toContain("facebook owns");
    expect(model.recommendedAction).toContain("Reduce or inspect facebook");
  });
});
