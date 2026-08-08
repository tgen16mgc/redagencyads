import { describe, expect, it } from "vitest";
import { chartSeriesDot, performanceChartConfig } from "../chart-palette";

describe("performanceChartConfig", () => {
  it("uses the old red chart palette variables", () => {
    expect(performanceChartConfig.spend.color).toBe("var(--chart-1)");
    expect(performanceChartConfig.messages.color).toBe("var(--chart-2)");
    expect(performanceChartConfig.replies.color).toBe("var(--chart-3)");
    expect(performanceChartConfig.costPerMessage.color).toBe("var(--chart-1)");
    expect(performanceChartConfig.frequency.color).toBe("var(--chart-1)");
    expect(performanceChartConfig.result.color).toBe("var(--chart-2)");
  });

  it("fills chart dots with their series color", () => {
    expect(chartSeriesDot("cpl", 2.5)).toEqual({
      fill: "var(--color-cpl)",
      r: 2.5,
      strokeWidth: 0,
    });
  });
});
