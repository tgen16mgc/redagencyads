import { createElement } from "react";
import type { BreakdownChartAnnotations } from "@/lib/breakdown-chart-annotations";

export function ChartAnnotationHeader({ annotations }: { annotations: BreakdownChartAnnotations }) {
  return createElement(
    "div",
    { className: "flex flex-col gap-0.5" },
    createElement("span", { className: "text-xs font-medium text-foreground" }, annotations.title),
    createElement("span", { className: "text-[11px] leading-snug text-muted-foreground" }, annotations.subtitle),
  );
}

export function ChartAnnotationLegend({ annotations }: { annotations: BreakdownChartAnnotations }) {
  if (!annotations.legend.length) return null;
  return createElement(
    "div",
    { className: "flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground" },
    annotations.legend.map((item) =>
      createElement(
        "span",
        { key: item.label, className: "flex items-center gap-1.5" },
        createElement("span", {
          "aria-hidden": true,
          className: "inline-block size-2.5 rounded-sm",
          style: { backgroundColor: item.color },
        }),
        item.label,
      ),
    ),
  );
}
