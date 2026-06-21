import { describe, expect, it } from "vitest";
import { buildBreakdownChartAnnotations } from "../breakdown-chart-annotations";
import type { BreakdownChartType, BreakdownMetricMode } from "../breakdown-view-model";

type Language = "en" | "vi";

function annotationsFor(overrides: Partial<{
  chartType: BreakdownChartType;
  mode: BreakdownMetricMode;
  dimensionLabel: string;
  metricLabel: string;
  chartLabel: string;
  chartExplanation: string;
  resultLabel: string;
  currency: string;
  language: Language;
}> = {}) {
  return buildBreakdownChartAnnotations({
    chartType: "pie",
    mode: "spend",
    dimensionLabel: "Platform",
    metricLabel: "Spend",
    chartLabel: "Share",
    chartExplanation: "Shows each segment's share of the selected total.",
    resultLabel: "messages",
    currency: "VND",
    language: "en",
    ...overrides,
  });
}

describe("buildBreakdownChartAnnotations", () => {
  it("produces a visible title that names the chart type and the selected dimension", () => {
    expect(annotationsFor().title).toBe("Share for Platform");
  });

  it("propagates the chart explanation as the subtitle so each chart is self-describing", () => {
    expect(annotationsFor().subtitle).toBe("Shows each segment's share of the selected total.");
  });

  it("localizes the title in Vietnamese", () => {
    expect(annotationsFor({
      language: "vi",
      dimensionLabel: "Nền tảng",
      chartLabel: "Tỷ trọng",
      chartExplanation: "Tỷ trọng của từng phân khúc trong tổng hiện tại.",
    }).title).toBe("Tỷ trọng cho Nền tảng");
  });

  it("exposes a center total label on the pie chart so the slice has visible context", () => {
    const annotations = annotationsFor({ chartType: "pie", metricLabel: "Spend" });
    expect(annotations.centerTotalLabel).toBe("Total spend");
  });

  it("switches the pie center label to the primary result unit when the metric is results", () => {
    const annotations = annotationsFor({ chartType: "pie", mode: "results", metricLabel: "Results" });
    expect(annotations.centerTotalLabel).toBe("Total results");
  });

  it("exposes legend items for the area chart so spend share vs result share is visible", () => {
    expect(annotationsFor({ chartType: "area" }).legend).toEqual([
      { label: "Spend share", color: "var(--color-spend)" },
      { label: "Result share", color: "var(--color-result)" },
    ]);
  });

  it("exposes a bar-chart x-axis label with currency unit when ranking cost per result", () => {
    const annotations = annotationsFor({
      chartType: "bar",
      mode: "efficiency",
      metricLabel: "Cost per result",
      chartLabel: "Cost ranking",
    });
    expect(annotations.xAxisLabel).toBe("Cost per result (VND)");
  });

  it("exposes spend and result-share axis labels for the scatter efficiency map", () => {
    const annotations = annotationsFor({
      chartType: "scatter",
      chartLabel: "Efficiency map",
      metricLabel: "Cost per result",
    });
    expect(annotations.xAxisLabel).toBe("Spend (VND)");
    expect(annotations.yAxisLabel).toBe("Cost/result (VND)");
  });

  it("localizes the scatter chart axis labels in Vietnamese", () => {
    const annotations = annotationsFor({
      chartType: "scatter",
      chartLabel: "Bản đồ hiệu suất",
      metricLabel: "Chi phí/kết quả",
      language: "vi",
    });
    expect(annotations.xAxisLabel).toBe("Chi tiêu (VND)");
    expect(annotations.yAxisLabel).toBe("Chi phí/kết quả (VND)");
  });
});
