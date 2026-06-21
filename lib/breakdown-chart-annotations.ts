import type { BreakdownChartType, BreakdownMetricMode } from "./breakdown-view-model";

export type BreakdownChartAnnotations = {
  title: string;
  subtitle: string;
  xAxisLabel: string | null;
  yAxisLabel: string | null;
  legend: Array<{ label: string; color: string }>;
  centerTotalLabel: string | null;
};

export type BreakdownChartAnnotationInput = {
  chartType: BreakdownChartType;
  mode: BreakdownMetricMode;
  dimensionLabel: string;
  metricLabel: string;
  chartLabel: string;
  chartExplanation: string;
  resultLabel: string;
  currency: string;
  language: "en" | "vi";
};

export function buildBreakdownChartAnnotations(input: BreakdownChartAnnotationInput): BreakdownChartAnnotations {
  return {
    title: chartTitle(input),
    subtitle: input.chartExplanation,
    xAxisLabel: xAxisLabelFor(input),
    yAxisLabel: yAxisLabelFor(input),
    legend: legendFor(input),
    centerTotalLabel: centerTotalLabelFor(input),
  };
}

function chartTitle(input: BreakdownChartAnnotationInput) {
  const connector = input.language === "vi" ? "cho" : "for";
  return `${input.chartLabel} ${connector} ${input.dimensionLabel}`.trim();
}

function xAxisLabelFor(input: BreakdownChartAnnotationInput) {
  if (input.chartType === "bar") {
    return `${input.metricLabel} (${input.currency})`;
  }
  if (input.chartType === "scatter") {
    return input.language === "vi" ? `Chi tiêu (${input.currency})` : `Spend (${input.currency})`;
  }
  if (input.chartType === "area") {
    return input.language === "vi" ? "Phân khúc" : "Segment";
  }
  return null;
}

function yAxisLabelFor(input: BreakdownChartAnnotationInput) {
  if (input.chartType === "scatter") {
    return input.language === "vi" ? `Chi phí/kết quả (${input.currency})` : `Cost/result (${input.currency})`;
  }
  if (input.chartType === "area") {
    return input.language === "vi" ? "Tỷ trọng" : "Share";
  }
  return null;
}

function legendFor(input: BreakdownChartAnnotationInput) {
  if (input.chartType !== "area") return [];
  return input.language === "vi"
    ? [
        { label: "Tỷ trọng chi tiêu", color: "var(--color-spend)" },
        { label: "Tỷ trọng kết quả", color: "var(--color-result)" },
      ]
    : [
        { label: "Spend share", color: "var(--color-spend)" },
        { label: "Result share", color: "var(--color-result)" },
      ];
}

function centerTotalLabelFor(input: BreakdownChartAnnotationInput) {
  if (input.chartType !== "pie") return null;
  if (input.language === "vi") {
    return input.mode === "results" ? "Tổng kết quả" : "Tổng chi tiêu";
  }
  return input.mode === "results" ? "Total results" : "Total spend";
}
