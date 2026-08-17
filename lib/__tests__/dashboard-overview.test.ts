import { describe, expect, it } from "vitest";
import { advanceOverviewPerformanceIntent, overviewAttentionTarget, overviewReportMetrics, sampleModeForReport } from "../dashboard-overview";

describe("advanceOverviewPerformanceIntent", () => {
  it("refreshes repeated targeted navigation requests", () => {
    const first = advanceOverviewPerformanceIntent({ target: "overview", key: 0 }, "creatives");
    const second = advanceOverviewPerformanceIntent(first, "creatives");

    expect(first).toEqual({ target: "creatives", key: 1 });
    expect(second).toEqual({ target: "creatives", key: 2 });
  });

  it("resets generic Performance navigation to overview", () => {
    expect(advanceOverviewPerformanceIntent({ target: "evidence", key: 7 })).toEqual({ target: "overview", key: 8 });
  });

  it("reopens the action plan for repeated Verdict navigation", () => {
    const first = advanceOverviewPerformanceIntent({ target: "overview", key: 2 }, "actions");
    expect(advanceOverviewPerformanceIntent(first, "actions")).toEqual({ target: "actions", key: 4 });
  });
});

describe("overviewReportMetrics", () => {
  it("uses message outcomes and conversation efficiency for a messages report", () => {
    expect(overviewReportMetrics({ selectedPack: "messages" }, "en")).toEqual([
      { key: "spend", label: "Spend", format: "currency" },
      { key: "messages", label: "Messages", format: "number" },
      { key: "costPerMessage", label: "Cost / message", format: "currency" },
      { key: "replyRate", label: "Reply rate", format: "percent" },
    ]);
  });

  it("keeps ROAS only in the sales report summary", () => {
    expect(overviewReportMetrics({ selectedPack: "lead_gen" }, "en").map((metric) => metric.key)).toEqual(["spend", "leads", "cpl", "ctr"]);
    expect(overviewReportMetrics({ selectedPack: "sales_roas" }, "en").map((metric) => metric.key)).toEqual(["spend", "purchases", "cpaPurchase", "roas"]);
  });
});

describe("overviewAttentionTarget", () => {
  it("routes creative coverage directly to the creatives evidence", () => {
    expect(overviewAttentionTarget({ id: "health-M25", title: { en: "Creative coverage", vi: "Độ phủ creative" } })).toBe("creatives");
  });

  it("routes other diagnostic checks to the evidence tab", () => {
    expect(overviewAttentionTarget({ id: "health-M-CR4", title: { en: "CTR benchmark", vi: "Chuẩn CTR" } })).toBe("evidence");
  });
});

describe("sampleModeForReport", () => {
  it("clears sample mode when a real saved report is restored", () => {
    expect(sampleModeForReport({ source: "meta_api" })).toBe(false);
    expect(sampleModeForReport({ source: "sample" })).toBe(true);
  });
});
