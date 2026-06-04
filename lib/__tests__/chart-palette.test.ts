import { describe, expect, it } from "vitest";
import { performanceChartConfig } from "../chart-palette";

describe("performanceChartConfig", () => {
  it("keeps bar fills visually separate from line strokes", () => {
    expect(performanceChartConfig.spend.color).toBe("var(--chart-bar-spend)");
    expect(performanceChartConfig.result.color).toBe("var(--chart-bar-result)");

    const lineKeys = ["messages", "replies", "leads", "purchases", "ctr", "frequency"] as const;
    for (const key of lineKeys) {
      expect(performanceChartConfig[key].color).toMatch(/^var\(--chart-line-/);
      expect(performanceChartConfig[key].color).not.toBe(performanceChartConfig.spend.color);
    }

    expect(new Set(lineKeys.map((key) => performanceChartConfig[key].color)).size).toBeGreaterThanOrEqual(4);
  });
});
