import { describe, expect, it } from "vitest";
import { buildSampleReport } from "../sample-report";
import { buildPerformanceStages } from "../performance-stages";
import { defaultFunnelTarget, describeFunnelFocus, hasLowFunnelVolume, primaryFunnelStage, funnelRateDelta, measureFunnelStage, modelStageTarget, pickFunnelFocus } from "../funnel-analysis";

const report = () => buildSampleReport({ pack: "messages" });

describe("aggregate funnel analysis", () => {
  it("keeps lead ratios independent of a custom conversations-before-leads layout", () => {
    const row = { ...report().totals, linkClicks: 332, messages: 47, leads: 15 };
    expect(measureFunnelStage(row, "lead")).toMatchObject({ denominatorKey: "linkClicks", denominator: 332, rate: 15 / 332 * 100 });
    expect(measureFunnelStage(row, "conversations").rate).toBe(47 / 332 * 100);
  });

  it("distinguishes tracked zero, untracked zero and missing denominators", () => {
    const row = { ...report().totals, messages: 0, metricAvailability: { messages: "tracked" as const } };
    expect(measureFunnelStage(row, "conversations")).toMatchObject({ value: 0, rate: 0, cost: null });
    expect(measureFunnelStage({ ...row, metricAvailability: { messages: "not_tracked" } }, "conversations")).toMatchObject({ value: null, rate: null, cost: null });
    expect(measureFunnelStage({ ...row, metricAvailability: undefined }, "conversations").value).toBeNull();
    expect(measureFunnelStage({ ...row, linkClicks: 0 }, "conversations").rate).toBeNull();
  });

  it("preserves event ratios above 100% and does not invent awareness conversions", () => {
    const row = { ...report().totals, messages: 120, linkClicks: 100 };
    expect(measureFunnelStage(row, "conversations").rate).toBe(120);
    expect(measureFunnelStage(row, "reach").rate).toBeNull();
    expect(measureFunnelStage(row, "saturation")).toMatchObject({ rate: null, cost: null });
  });

  it("compares percentage points, including a valid zero baseline", () => {
    const row = { ...report().totals, linkClicks: 10, impressions: 1000 };
    expect(funnelRateDelta(row, { ...row, linkClicks: 20 }, "traffic")).toBe(-1);
    expect(funnelRateDelta(row, { ...row, linkClicks: 0 }, "traffic")).toBe(1);
    expect(funnelRateDelta(row, null, "traffic")).toBeNull();
  });

  it("prioritizes tracking gaps and avoids ranking tiny samples as major declines", () => {
    const current = report();
    const stages = buildPerformanceStages({ report: current, compareMode: "off", language: "en" });
    expect(pickFunnelFocus(stages.map(stage => stage.key === "replies" ? { ...stage, availability: "not_tracked" as const } : stage), current.totals, null)).toBe("replies");
    const row = { ...current.totals, messages: 2, replies: 1, linkClicks: 1000, impressions: 100000 };
    const prior = { ...row, messages: 2, replies: 2, linkClicks: 2000 };
    expect(pickFunnelFocus(stages, row, prior)).toBe("traffic");
  });

  it("keeps the primary goal independent of custom stage order and explains focus", () => {
    expect(primaryFunnelStage("messages")).toBe("conversations");
    expect(primaryFunnelStage("lead_gen")).toBe("lead");
    expect(primaryFunnelStage("sales_roas")).toBe("purchase");
    expect(primaryFunnelStage("awareness")).toBe("reach");
    const current = report();
    const stages = buildPerformanceStages({ report: current, compareMode: "off", language: "en" });
    const row = { ...current.totals, linkClicks: 100, impressions: 10000 };
    expect(describeFunnelFocus(stages, row, { ...row, linkClicks: 200 })).toMatchObject({ key: "traffic", reason: "decline", delta: -1 });
  });

  it("cautions on few outcomes even with a large denominator", () => {
    const row = { ...report().totals, leads: 3, linkClicks: 1898 };
    expect(hasLowFunnelVolume(row, "lead")).toBe(true);
    expect(hasLowFunnelVolume({ ...row, leads: 100 }, "lead")).toBe(false);
    expect(hasLowFunnelVolume({ ...row, metricAvailability: { leads: "not_tracked" } }, "lead")).toBe(false);
  });

  it("does not suggest a lower target when current performance exceeds baseline", () => {
    expect(defaultFunnelTarget(0.158, 0.13)).toBe(0.16);
    expect(defaultFunnelTarget(0.97, 1.16)).toBe(1.16);
    expect(defaultFunnelTarget(6, null)).toBe(6);
    expect(defaultFunnelTarget(1.1, null)).toBe(1.1);
    expect(hasLowFunnelVolume(report().totals, "saturation")).toBe(false);
    expect(defaultFunnelTarget(6, 120)).toBe(6);
  });

  it("models only the selected event at a fixed denominator and rejects invalid targets", () => {
    expect(modelStageTarget(15, 332, 6)).toEqual({ total: 19.92, additional: 4.920000000000002 });
    expect(modelStageTarget(15, 0, 6)).toBeNull();
    expect(modelStageTarget(null, 332, 6)).toBeNull();
    expect(modelStageTarget(15, 332, 101)).toBeNull();
    expect(modelStageTarget(15, 332, NaN)).toBeNull();
  });
});
