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
  });

  it("uses the selected KPI pack to compute primary results", () => {
    const trafficRows = buildBreakdownChartRows([
      row({ id: "traffic", platform: "instagram", spend: 50, messages: 20, linkClicks: 200 }),
    ], "traffic");

    expect(trafficRows[0].results).toBe(200);
  });
});

describe("chooseBreakdownChartType", () => {
  it("uses donut only for simple proportion views, bars for many segments, and scatter for efficiency", () => {
    const fourRows = Array.from({ length: 4 }, (_, index) => ({ id: String(index), label: String(index), spend: 10, results: 1, efficiency: 10, share: 0.25 }));
    const fiveRows = Array.from({ length: 5 }, (_, index) => ({ id: String(index), label: String(index), spend: 10, results: 1, efficiency: 10, share: 0.2 }));

    expect(chooseBreakdownChartType(fourRows, "spend")).toBe("donut");
    expect(chooseBreakdownChartType(fiveRows, "spend")).toBe("bar");
    expect(chooseBreakdownChartType(fiveRows, "efficiency")).toBe("scatter");
  });
});

describe("buildBreakdownViewModel", () => {
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
    expect(model.chartLabel).toBe("Donut share");
    expect(model.ariaLabel).toBe("Donut share for Geography, measured by Spend");
    expect(model.chartExplanation).toContain("Few segments");
  });

  it("describes scatter charts with semantic axis meaning instead of a generic chart type", () => {
    const dimensions = buildBreakdownDimensions({
      platformRows: [
        row({ id: "fb", platform: "facebook", spend: 100, messages: 2 }),
        row({ id: "ig", platform: "instagram", spend: 80, messages: 10 }),
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

    expect(model.chartType).toBe("scatter");
    expect(model.chartLabel).toBe("Efficiency map");
    expect(model.metricLabel).toBe("Cost per result");
    expect(model.chartExplanation).toContain("farther right means more spend");
  });
});
