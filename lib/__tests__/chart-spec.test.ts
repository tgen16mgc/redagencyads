import { describe, expect, it } from "vitest";
import { compactDate, detectTrendAnnotation, getPackChartSpec, roundForFormat, sortByDrilldown, truncateLabel } from "../chart-spec";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "adset",
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

describe("getPackChartSpec", () => {
  it("uses ROAS as the sales drilldown and treats higher values as better", () => {
    const spec = getPackChartSpec("sales_roas");

    expect(spec.drilldownKey).toBe("roas");
    expect(spec.drilldownFormat).toBe("ratio");
    expect(spec.higherIsBetter).toBe(true);
  });

  it("uses Vietnamese chart copy when requested", () => {
    expect(getPackChartSpec("messages", "vi").trendTitle).toBe("Xu hướng tin nhắn");
  });
});

describe("chart helpers", () => {
  it("sorts zero-value rows below rows with metric signal", () => {
    const rows = [row({ id: "zero", spend: 999, cpl: 0 }), row({ id: "signal", spend: 10, cpl: 20 })];

    expect([...rows].sort((a, b) => sortByDrilldown(a, b, "cpl", false))[0].id).toBe("signal");
  });

  it("rounds and formats lightweight labels", () => {
    expect(roundForFormat(1.234, "ratio")).toBe(1.23);
    expect(compactDate("2026-06-05")).toBe("5/6");
    expect(truncateLabel("1234567890123456789012345")).toBe("1234567890123456789...");
  });

  it("skips trend annotation when there are too few daily rows", () => {
    const rows = [10, 12, 15].map((leads, index) => row({ id: String(index), level: "daily", leads }));

    expect(detectTrendAnnotation(rows, "leads")).toBeNull();
  });

  it("skips trend annotation when values are mostly zero", () => {
    const rows = [0, 0, 0, 0, 10, 12, 14].map((leads, index) => row({ id: String(index), level: "daily", leads }));

    expect(detectTrendAnnotation(rows, "leads")).toBeNull();
  });

  it("skips trend annotation when movement is below the noticeable threshold", () => {
    const rows = [10, 11, 10, 11, 12, 11, 12].map((leads, index) => row({ id: String(index), level: "daily", leads }));

    expect(detectTrendAnnotation(rows, "leads")).toBeNull();
  });

  it("detects a noticeable upward trend", () => {
    const rows = [10, 11, 12, 18, 22, 25, 28].map((leads, index) => row({ id: String(index), level: "daily", leads }));
    const annotation = detectTrendAnnotation(rows, "leads");

    expect(annotation?.direction).toBe("up");
    expect(annotation?.key).toBe("leads");
    expect(annotation?.changePct).toBeGreaterThanOrEqual(25);
    expect(annotation?.label).toContain("Leads up");
  });

  it("detects a noticeable downward trend", () => {
    const rows = [30, 28, 26, 20, 16, 14, 12].map((leads, index) => row({ id: String(index), level: "daily", leads }));
    const annotation = detectTrendAnnotation(rows, "leads");

    expect(annotation?.direction).toBe("down");
    expect(annotation?.changePct).toBeLessThanOrEqual(-25);
    expect(annotation?.label).toContain("Leads down");
  });
});
