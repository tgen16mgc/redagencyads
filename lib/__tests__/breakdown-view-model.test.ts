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
  it("uses pie for small share views, area for larger share views, and scatter only when efficiency has enough rows", () => {
    const fourRows = buildBreakdownChartRows(Array.from({ length: 4 }, (_, index) => row({ id: String(index), platform: `p${index}`, spend: 10, messages: 1 })), "messages");
    const sixRows = buildBreakdownChartRows(Array.from({ length: 6 }, (_, index) => row({ id: String(index), platform: `p${index}`, spend: 10, messages: 1 })), "messages");

    expect(chooseBreakdownChartType(fourRows, "spend")).toBe("pie");
    expect(chooseBreakdownChartType(sixRows, "results")).toBe("area");
    expect(chooseBreakdownChartType(fourRows, "efficiency")).toBe("bar");
    expect(chooseBreakdownChartType(sixRows, "efficiency")).toBe("scatter");
  });
});

describe("buildBreakdownViewModel", () => {
  it("aggregates duplicate platform rows before building dimensions", () => {
    const dimensions = buildBreakdownDimensions({
      platformRows: [
        row({ id: "fb-1", platform: "facebook", spend: 100, messages: 1 }),
        row({ id: "fb-2", platform: "facebook", spend: 200, messages: 2 }),
        row({ id: "ig", platform: "instagram", spend: 50, messages: 5 }),
      ],
      ageGenderRows: [],
      regionRows: [],
      language: "en",
    });

    const platform = dimensions.find((dimension) => dimension.value === "platform");

    expect(platform?.rows).toHaveLength(2);
    expect(platform?.rows.find((dimensionRow) => dimensionRow.platform === "facebook")?.spend).toBe(300);
    expect(platform?.rows.find((dimensionRow) => dimensionRow.platform === "facebook")?.messages).toBe(3);
  });

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
    expect(model.chartLabel).toBe("Share");
    expect(model.ariaLabel).toBe("Share for Geography, measured by Spend");
    expect(model.chartExplanation).toContain("selected total");
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

  it("does not turn tiny unknown no-result spend into an action recommendation", () => {
    const dimensions = buildBreakdownDimensions({
      platformRows: [],
      ageGenderRows: [
        row({ id: "female", gender: "female", age: "18-24", spend: 3104278, messages: 17 }),
        row({ id: "male", gender: "male", age: "18-24", spend: 1910153, messages: 10 }),
        row({ id: "unknown", gender: "unknown", age: "18-24", spend: 48725, messages: 0 }),
      ],
      regionRows: [],
      language: "en",
    });

    const model = buildBreakdownViewModel({
      dimensions,
      selectedDimension: "gender",
      mode: "efficiency",
      pack: "messages",
      language: "en",
    });

    const unknown = model.rows.find((dimensionRow) => dimensionRow.label === "Unknown");
    expect(unknown?.tone).toBe("insufficient");
    expect(unknown?.diagnosis).toBe("Too little spend to judge");
    expect(model.insightTone).not.toBe("warning");
    expect(model.topInsight).toContain("broadly aligned");
  });
});
