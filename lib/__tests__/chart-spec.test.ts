import { describe, expect, it } from "vitest";
import { compactDate, getPackChartSpec, roundForFormat, sortByDrilldown, truncateLabel } from "../chart-spec";
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
});
