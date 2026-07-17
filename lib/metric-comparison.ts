import type { CompareMode, DashboardReport, KpiCard, NormalizedRow } from "@/lib/types";

type ReportLanguage = "en" | "vi";
type ComparisonBasis = "compare-range";

export type MetricComparisonDelta = {
  key: keyof NormalizedRow;
  label: string;
  format: KpiCard["format"];
  current: number;
  previous: number;
  change: number;
  changePct: number | null;
  basis: ComparisonBasis;
  descriptor: string;
};

const LOWER_IS_BETTER = new Set<keyof NormalizedRow>([
  "cpc",
  "cpm",
  "cpl",
  "costPerMessage",
  "costPerReply",
  "cpaPurchase",
  "frequency",
]);

const HIGHER_IS_BETTER = new Set<keyof NormalizedRow>([
  "messages",
  "replies",
  "leads",
  "purchases",
  "linkClicks",
  "clicks",
  "impressions",
  "reach",
  "ctr",
  "roas",
  "replyRate",
  "leadRate",
]);

export function buildKpiComparisons(args: {
  report: DashboardReport;
  previousReport?: DashboardReport | null;
  compareMode: CompareMode;
  language?: ReportLanguage;
}): MetricComparisonDelta[] {
  if (args.compareMode === "off" || !args.previousReport) return [];
  const basis = "compare-range";
  const previousTotals = args.previousReport.totals;
  const currentTotals = args.report.totals;

  return args.report.kpis
    .filter((kpi): kpi is KpiCard & { key: keyof NormalizedRow } => kpi.key !== "healthScore")
    .map((kpi) => buildDelta({
      kpi,
      currentTotals,
      previousTotals,
      basis,
      compareMode: args.compareMode,
      language: args.language ?? "en",
      previousReport: args.previousReport,
    }));
}

export function compareTotals(current: NormalizedRow, previous: NormalizedRow) {
  const keys: Array<keyof NormalizedRow> = [
    "spend",
    "impressions",
    "reach",
    "messages",
    "leads",
    "purchases",
    "linkClicks",
    "ctr",
    "frequency",
    "costPerMessage",
    "cpl",
    "cpaPurchase",
    "roas",
  ];

  return keys.map((key) => {
    const currentValue = Number(current[key] || 0);
    const previousValue = Number(previous[key] || 0);
    return {
      key,
      current: currentValue,
      previous: previousValue,
      change: currentValue - previousValue,
      change_pct: previousValue ? ((currentValue - previousValue) / previousValue) * 100 : null,
    };
  });
}

export function metricMovementIsBad(key: keyof NormalizedRow | string, change: number) {
  if (change === 0) return false;
  const metricKey = key as keyof NormalizedRow;
  if (LOWER_IS_BETTER.has(metricKey)) return change > 0;
  if (HIGHER_IS_BETTER.has(metricKey)) return change < 0;
  return false;
}

export function formatComparisonChangePct(value: number | null, language: ReportLanguage = "en") {
  if (value === null) return language === "vi" ? "mới" : "new";
  const sign = value > 0 ? "+" : "";
  const locale = language === "vi" ? "vi-VN" : "en-US";
  return `${sign}${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
}

export function comparisonDescriptor(args: {
  compareMode: CompareMode;
  previousReport?: DashboardReport | null;
  language?: ReportLanguage;
}) {
  const language = args.language ?? "en";
  if (args.compareMode === "off") return language === "vi" ? "không so sánh" : "no comparison";
  if (args.compareMode === "wow") return language === "vi" ? "so với WoW" : "vs WoW";
  if (args.compareMode === "mom") return language === "vi" ? "so với MoM" : "vs MoM";
  if (args.compareMode === "yoy") return language === "vi" ? "so với YoY" : "vs YoY";
  return language === "vi" ? "so với kỳ trước" : "vs prior period";
}

export function comparisonFootnote(args: {
  report: DashboardReport;
  previousReport?: DashboardReport | null;
  compareMode: CompareMode;
  language?: ReportLanguage;
}) {
  const language = args.language ?? "en";
  if (args.compareMode === "off") {
    return language === "vi"
      ? "Không chọn so sánh cho báo cáo này."
      : "No comparison selected for this report.";
  }
  if (!args.previousReport) {
    return language === "vi"
      ? "Không có dữ liệu so sánh; báo cáo này chỉ bao gồm số liệu của kỳ hiện tại."
      : "Comparison unavailable; this report contains current-period values only.";
  }

  const mode = args.compareMode === "wow" ? "WoW" : args.compareMode === "mom" ? "MoM" : "YoY";
  const current = `${args.report.dateRange.since} to ${args.report.dateRange.until}`;
  const previous = `${args.previousReport.dateRange.since} to ${args.previousReport.dateRange.until}`;
  return language === "vi"
    ? `So sánh ${mode}: kỳ hiện tại ${current}; kỳ trước ${previous}.`
    : `${mode} comparison: current ${current}; previous ${previous}.`;
}

function buildDelta(args: {
  kpi: KpiCard & { key: keyof NormalizedRow };
  currentTotals: NormalizedRow;
  previousTotals: NormalizedRow;
  basis: ComparisonBasis;
  compareMode: CompareMode;
  language: ReportLanguage;
  previousReport?: DashboardReport | null;
}): MetricComparisonDelta {
  const current = Number(args.currentTotals[args.kpi.key] || 0);
  const previous = Number(args.previousTotals[args.kpi.key] || 0);
  const change = current - previous;
  return {
    key: args.kpi.key,
    label: args.kpi.label,
    format: args.kpi.format,
    current,
    previous,
    change,
    changePct: previous ? (change / previous) * 100 : null,
    basis: args.basis,
    descriptor: comparisonDescriptor({
      compareMode: args.compareMode,
      previousReport: args.previousReport,
      language: args.language,
    }),
  };
}
