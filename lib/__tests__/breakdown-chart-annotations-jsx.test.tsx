import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { buildBreakdownChartAnnotations } from "../breakdown-chart-annotations";

// Replicas of the JSX used inside dashboard-shell chart components. Keeping them
// here (rather than importing from dashboard-shell) lets us test the visible-text
// contract without pulling the entire component tree and shadcn context into the
// unit-test graph. If the dashboard JSX changes shape, these replicas must change
// with it — the assertions below lock the visible-copy contract.

function ChartAnnotationHeader({ annotations }: { annotations: { title: string; subtitle: string } }) {
  return createElement(
    "div",
    { className: "chart-annotation-header" },
    createElement("span", { className: "chart-title" }, annotations.title),
    createElement("span", { className: "chart-subtitle" }, annotations.subtitle),
  );
}

function ChartAnnotationLegend({ annotations }: { annotations: { legend: Array<{ label: string; color: string }> } }) {
  if (!annotations.legend.length) return null;
  return createElement(
    "div",
    { className: "chart-annotation-legend" },
    annotations.legend.map((item) =>
      createElement("span", { key: item.label, "data-label": item.label, "data-color": item.color }, item.label),
    ),
  );
}

const baseInput = {
  chartType: "pie" as const,
  mode: "spend" as const,
  dimensionLabel: "Platform",
  metricLabel: "Spend",
  chartLabel: "Share",
  chartExplanation: "Shows each segment's share of the selected total.",
  resultLabel: "messages",
  currency: "VND",
  language: "en" as const,
};

describe("Chart annotation JSX renders the visible copy the user sees", () => {
  it("pie chart: title, subtitle, and center-total label all appear in the rendered tree", () => {
    const annotations = buildBreakdownChartAnnotations(baseInput);
    const html = renderToStaticMarkup(
      createElement(
        "section",
        null,
        createElement(ChartAnnotationHeader, { annotations }),
        createElement("div", { className: "pie-center" }, annotations.centerTotalLabel ?? ""),
        createElement(ChartAnnotationLegend, { annotations }),
      ),
    );
    expect(html).toContain("Share for Platform");
    expect(html).toMatch(/Shows each segment/);
    expect(html).toContain("Total spend");
  });

  it("area chart: legend lists spend share and result share, and y-axis label is visible", () => {
    const annotations = buildBreakdownChartAnnotations({ ...baseInput, chartType: "area", chartLabel: "Spend vs result share", chartExplanation: "Compares spend share with result share to expose allocation gaps." });
    const html = renderToStaticMarkup(
      createElement(
        "section",
        null,
        createElement(ChartAnnotationHeader, { annotations }),
        createElement(ChartAnnotationLegend, { annotations }),
        createElement("span", { "data-axis": "y" }, annotations.yAxisLabel ?? ""),
      ),
    );
    expect(html).toContain("Spend vs result share for Platform");
    expect(html).toContain("Compares spend share with result share to expose allocation gaps.");
    expect(html).toContain('data-label="Spend share"');
    expect(html).toContain('data-label="Result share"');
    expect(html).toContain("Share");
  });

  it("bar chart: x-axis label carries the currency unit so the units are visible", () => {
    const annotations = buildBreakdownChartAnnotations({ ...baseInput, chartType: "bar", mode: "efficiency", metricLabel: "Cost per result", chartLabel: "Cost ranking", chartExplanation: "Ranks cost per result." });
    const html = renderToStaticMarkup(
      createElement(
        "section",
        null,
        createElement(ChartAnnotationHeader, { annotations }),
        createElement("span", { "data-axis": "x" }, annotations.xAxisLabel ?? ""),
      ),
    );
    expect(html).toContain("Cost ranking for Platform");
    expect(html).toContain("Ranks cost per result.");
    expect(html).toContain("Cost per result (VND)");
  });

  it("scatter chart: both axes carry units and labels localize to Vietnamese", () => {
    const annotations = buildBreakdownChartAnnotations({
      ...baseInput,
      chartType: "scatter",
      dimensionLabel: "Nền tảng",
      metricLabel: "Chi phí/kết quả",
      chartLabel: "Bản đồ hiệu suất",
      chartExplanation: "Mỗi điểm là một phân khúc.",
      resultLabel: "tin nhắn",
      language: "vi",
    });
    const html = renderToStaticMarkup(
      createElement(
        "section",
        null,
        createElement(ChartAnnotationHeader, { annotations }),
        createElement("span", { "data-axis": "x" }, annotations.xAxisLabel ?? ""),
        createElement("span", { "data-axis": "y" }, annotations.yAxisLabel ?? ""),
      ),
    );
    expect(html).toContain("Bản đồ hiệu suất cho Nền tảng");
    expect(html).toContain("Mỗi điểm là một phân khúc.");
    expect(html).toContain("Chi tiêu (VND)");
    expect(html).toContain("Chi phí/kết quả (VND)");
  });
});
