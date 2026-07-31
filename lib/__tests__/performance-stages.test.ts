import { describe, expect, it } from "vitest";
import { buildPerformanceStages } from "../performance-stages";
import { buildSampleReport } from "../sample-report";

describe("buildPerformanceStages", () => {
  it.each([
    ["lead_gen", ["exposure", "traffic", "lead"]],
    ["messages", ["exposure", "traffic", "conversations", "replies"]],
    ["traffic", ["exposure", "traffic"]],
    ["awareness", ["reach", "impressions", "saturation"]],
    ["sales_roas", ["exposure", "traffic", "cart", "checkout", "purchase"]],
  ] as const)("uses the Figma funnel matrix for %s", (pack, expected) => {
    const report = buildSampleReport({ pack });
    const stages = buildPerformanceStages({ report, compareMode: "off", language: "en" });

    expect(stages.map((stage) => stage.key)).toEqual(expected);
  });

  it("labels missing sales events as not tracked instead of zero", () => {
    const report = buildSampleReport({ pack: "sales_roas" });
    const stages = buildPerformanceStages({ report, compareMode: "off", language: "en" });

    expect(stages.filter((stage) => ["cart", "checkout", "purchase"].includes(stage.key))).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "cart", value: null, availability: "not_tracked", statusLabel: "Not tracked" }),
      expect.objectContaining({ key: "checkout", value: null, availability: "not_tracked", statusLabel: "Not tracked" }),
      expect.objectContaining({ key: "purchase", value: null, availability: "not_tracked", statusLabel: "Not tracked" }),
    ]));
  });

  it("keeps tracked messaging stages available", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c3"], pack: "messages" });
    const stages = buildPerformanceStages({ report, compareMode: "off", language: "en" });

    expect(stages.find((stage) => stage.key === "conversations")).toMatchObject({ availability: "available", value: 210 });
    expect(stages.find((stage) => stage.key === "replies")).toMatchObject({ availability: "available", value: 168 });
  });

  it("surfaces an explicit comparison basis in stage movement", () => {
    const report = buildSampleReport({ pack: "traffic", dateRange: { since: "2026-07-01", until: "2026-07-30" } });
    const previousReport = buildSampleReport({ pack: "traffic", dateRange: { since: "2026-06-01", until: "2026-06-30" } });
    const stages = buildPerformanceStages({ report, previousReport, compareMode: "previous", language: "en" });

    expect(stages.every((stage) => stage.movement.includes("vs previous period"))).toBe(true);
  });
});
