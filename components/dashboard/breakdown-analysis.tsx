"use client";

import * as React from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartAnnotationHeader, ChartAnnotationLegend } from "@/components/dashboard/chart-annotations";
import { DiagnosticCard } from "@/components/dashboard/diagnostic-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildBreakdownChartAnnotations, type BreakdownChartAnnotations } from "@/lib/breakdown-chart-annotations";
import {
  buildBreakdownDimensions,
  buildBreakdownViewModel,
  type BreakdownChartRow,
  type BreakdownDimension,
  type BreakdownMetricMode,
} from "@/lib/breakdown-view-model";
import { performanceChartConfig } from "@/lib/chart-palette";
import { breakdownWasteDiagnostic } from "@/lib/diagnosis";
import { formatCompactNumber, formatMetric, formatSharePct } from "@/lib/metrics";
import type { DashboardReport, InterfaceLanguage } from "@/lib/types";

const breakdownCopy = {
  en: {
    breakdowns: "Breakdowns",
    breakdownsDescription: "Adaptive platform, demographic, and geography signal for allocation diagnosis.",
    chartEmpty: "No chart data returned.",
  },
  vi: {
    breakdowns: "Breakdown",
    breakdownsDescription: "Tín hiệu adaptive theo nền tảng, nhân khẩu học và khu vực để chẩn đoán phân bổ.",
    chartEmpty: "Không có dữ liệu biểu đồ.",
  },
} as const;

export function BreakdownAnalysisSection({ report, language }: { report: DashboardReport; language: InterfaceLanguage }) {
  const copy = breakdownCopy[language];
  const dimensions = React.useMemo(
    () => buildBreakdownDimensions({
      platformRows: report.platformRows,
      ageGenderRows: report.ageGenderRows,
      regionRows: report.regionRows || [],
      countryRows: report.countryRows,
      language,
    }),
    [language, report.ageGenderRows, report.countryRows, report.platformRows, report.regionRows],
  );
  const defaultDimension = dimensions.find((dimensionItem) => dimensionItem.available)?.value || "platform";
  const [dimension, setDimension] = React.useState<BreakdownDimension>(defaultDimension);
  const selectedDimension = dimensions.find((dimensionItem) => dimensionItem.value === dimension && dimensionItem.available)
    || dimensions.find((dimensionItem) => dimensionItem.available)
    || dimensions[0];
  const sideModel = buildBreakdownViewModel({
    dimensions,
    selectedDimension: dimension,
    mode: "spend",
    pack: report.selectedPack,
    language,
  });

  React.useEffect(() => {
    if (selectedDimension?.value && selectedDimension.value !== dimension) {
      setDimension(selectedDimension.value);
    }
  }, [dimension, selectedDimension?.value]);

  return (
    <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[1.6fr_1fr]" data-print-flow>
      <div className="min-w-0 rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Chẩn đoán phân khúc" : "Segment Diagnostics"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{copy.breakdowns}</h2>
          <p className="text-sm text-muted-foreground">{copy.breakdownsDescription}</p>
        </div>
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border bg-background/50 p-4">
          <AdaptiveBreakdownChart
            report={report}
            language={language}
            dimensions={dimensions}
            dimension={dimension}
            onDimensionChange={setDimension}
          />
        </div>
      </div>
      <DiagnosticCard
        className="min-w-0 self-start"
        diagnostic={breakdownWasteDiagnostic({
          rows: selectedDimension?.rows || [],
          pack: report.selectedPack,
          chartRows: sideModel.summaryRows,
          dimensionLabel: selectedDimension?.label || "",
        })}
        language={language}
        currency={report.account.currency || "VND"}
      />
    </section>
  );
}

function AdaptiveBreakdownChart({
  report,
  language,
  dimensions,
  dimension,
  onDimensionChange,
}: {
  report: DashboardReport;
  language: InterfaceLanguage;
  dimensions: ReturnType<typeof buildBreakdownDimensions>;
  dimension: BreakdownDimension;
  onDimensionChange: (dimension: BreakdownDimension) => void;
}) {
  const [mode, setMode] = React.useState<BreakdownMetricMode>("spend");
  const currency = report.account.currency || "VND";
  const model = buildBreakdownViewModel({
    dimensions,
    selectedDimension: dimension,
    mode,
    pack: report.selectedPack,
    language,
  });
  const annotations = buildBreakdownChartAnnotations({
    chartType: model.chartType,
    mode,
    dimensionLabel: model.activeDimensionLabel,
    metricLabel: model.metricLabel,
    chartLabel: model.chartLabel,
    chartExplanation: model.chartExplanation,
    resultLabel: model.resultLabel,
    currency,
    language,
  });
  const metricCopy = breakdownMetricCopy(language);

  React.useEffect(() => {
    if (model.activeDimension !== dimension) onDimensionChange(model.activeDimension);
  }, [dimension, model.activeDimension, onDimensionChange]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" data-print-hidden>
        <ToggleGroup
          aria-label={language === "vi" ? "Dimension breakdown" : "Breakdown dimension"}
          value={[dimension]}
          onValueChange={(values) => {
            const next = values.find((value): value is BreakdownDimension => value === "platform" || value === "age" || value === "gender" || value === "geography");
            if (next) onDimensionChange(next);
          }}
          multiple={false}
          variant="outline"
          size="sm"
          spacing={0}
        >
          {dimensions.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value} disabled={!item.available} aria-label={item.label}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          aria-label={language === "vi" ? "Metric breakdown" : "Breakdown metric"}
          value={[mode]}
          onValueChange={(values) => {
            const next = values.find((value): value is BreakdownMetricMode => value === "spend" || value === "results" || value === "efficiency");
            if (next) setMode(next);
          }}
          multiple={false}
          variant="outline"
          size="sm"
          spacing={0}
        >
          <ToggleGroupItem value="spend" aria-label={metricCopy.spend}>{metricCopy.spend}</ToggleGroupItem>
          <ToggleGroupItem value="results" aria-label={metricCopy.results}>{metricCopy.results}</ToggleGroupItem>
          <ToggleGroupItem value="efficiency" aria-label={metricCopy.efficiency}>{metricCopy.efficiency}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Alert variant={model.insightTone === "warning" ? "destructive" : "default"}>
        <AlertTitle>{model.topInsight}</AlertTitle>
        <AlertDescription>{model.recommendedAction}</AlertDescription>
      </Alert>

      {!model.rows.length ? <ChartEmpty language={language} /> : null}
      {model.rows.length && model.chartType === "pie" ? (
        <BreakdownPieChart rows={model.rows} mode={mode} currency={currency} language={language} annotations={annotations} />
      ) : null}
      {model.rows.length && model.chartType === "area" ? (
        <BreakdownAreaChart rows={model.rows} mode={mode} currency={currency} language={language} annotations={annotations} />
      ) : null}
      {model.rows.length && model.chartType === "bar" ? (
        <BreakdownBarChart rows={model.rows} mode={mode} currency={currency} language={language} annotations={annotations} />
      ) : null}
      {model.rows.length && model.chartType === "scatter" ? (
        <BreakdownScatterChart rows={model.rows} currency={currency} language={language} annotations={annotations} />
      ) : null}
    </div>
  );
}

const BREAKDOWN_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function BreakdownPieChart({ rows, mode, currency, language, annotations }: { rows: BreakdownChartRow[]; mode: BreakdownMetricMode; currency: string; language: InterfaceLanguage; annotations: BreakdownChartAnnotations }) {
  const dataKey = mode === "results" ? "results" : "spend";
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const totalResults = rows.reduce((sum, row) => sum + row.results, 0);
  const centerValue = dataKey === "results" ? formatMetric(totalResults, "number", currency) : formatMetric(totalSpend, "currency", currency);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ChartAnnotationHeader annotations={annotations} />
      <ChartContainer config={performanceChartConfig} className="relative h-[300px] min-w-0 w-full" role="img" aria-label={annotations.title}>
        <PieChart>
          <ChartTooltip content={<BreakdownTooltip mode={mode} currency={currency} language={language} dimensionLabel={annotations.title} />} />
          <Pie data={rows} dataKey={dataKey} nameKey="label" innerRadius={62} outerRadius={104} paddingAngle={2} label={(props: { percent?: number }) => formatSharePct(Number(props.percent ?? 0), currency)} labelLine={false}>
            {rows.map((row, index) => <Cell key={row.id} fill={BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length]} />)}
          </Pie>
        </PieChart>
        {annotations.centerTotalLabel ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{annotations.centerTotalLabel}</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{centerValue}</span>
          </div>
        ) : null}
      </ChartContainer>
      <ChartAnnotationLegend annotations={annotations} />
    </div>
  );
}

function BreakdownAreaChart({ rows, mode, currency, language, annotations }: { rows: BreakdownChartRow[]; mode: BreakdownMetricMode; currency: string; language: InterfaceLanguage; annotations: BreakdownChartAnnotations }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ChartAnnotationHeader annotations={annotations} />
      <ChartContainer config={performanceChartConfig} className="h-[300px] min-w-0 w-full" role="img" aria-label={annotations.title}>
        <ComposedChart data={rows} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
          <YAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => formatSharePct(Number(value), currency)} domain={paddedPositiveDomain()} label={annotations.yAxisLabel ? { value: annotations.yAxisLabel, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "currentColor" } } : undefined} />
          <ChartTooltip content={<BreakdownTooltip mode={mode} currency={currency} language={language} dimensionLabel={annotations.title} />} />
          <Area type="monotone" dataKey="spendShare" name={language === "vi" ? "Tỷ trọng chi tiêu" : "Spend share"} stroke="var(--color-spend)" fill="var(--color-spend)" fillOpacity={0.18} strokeWidth={2} />
          <Area type="monotone" dataKey="resultShare" name={language === "vi" ? "Tỷ trọng kết quả" : "Result share"} stroke="var(--color-result)" fill="var(--color-result)" fillOpacity={0.12} strokeWidth={2} />
        </ComposedChart>
      </ChartContainer>
      <ChartAnnotationLegend annotations={annotations} />
    </div>
  );
}

function BreakdownBarChart({ rows, mode, currency, language, annotations }: { rows: BreakdownChartRow[]; mode: BreakdownMetricMode; currency: string; language: InterfaceLanguage; annotations: BreakdownChartAnnotations }) {
  const dataKey = breakdownChartDataKey(mode);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ChartAnnotationHeader annotations={annotations} />
      <ChartContainer config={performanceChartConfig} className="h-[300px] min-w-0 w-full" role="img" aria-label={annotations.title}>
        <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 36, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" domain={paddedPositiveDomain()} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactNumber(Number(value), currency)} label={annotations.xAxisLabel ? { value: annotations.xAxisLabel, position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "currentColor" } } : undefined} />
          <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={132} tickMargin={8} />
          <ChartTooltip content={<BreakdownTooltip mode={mode} currency={currency} language={language} dimensionLabel={annotations.title} />} />
          <Bar dataKey={dataKey} fill={breakdownBarFill(mode)} radius={[0, 4, 4, 0]} label={(props: { value?: unknown; x?: string | number; y?: string | number; width?: string | number }) => {
            if (typeof props.value !== "number" || typeof props.x !== "number" || typeof props.y !== "number" || typeof props.width !== "number") return null;
            return <text x={props.x + props.width + 6} y={props.y} dy={4} fontSize={11} textAnchor="start" fill="currentColor" className="font-mono tabular-nums">{formatMetric(props.value, mode === "results" ? "number" : "currency", currency)}</text>;
          }} />
        </BarChart>
      </ChartContainer>
      <ChartAnnotationLegend annotations={annotations} />
    </div>
  );
}

function BreakdownScatterChart({ rows, currency, language, annotations }: { rows: BreakdownChartRow[]; currency: string; language: InterfaceLanguage; annotations: BreakdownChartAnnotations }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ChartAnnotationHeader annotations={annotations} />
      <ChartContainer config={performanceChartConfig} className="h-[300px] min-w-0 w-full" role="img" aria-label={annotations.title}>
        <ScatterChart margin={{ left: 8, right: 16, top: 12, bottom: 8 }}>
          <CartesianGrid />
          <XAxis dataKey="spend" name={language === "vi" ? "Chi tiêu" : "Spend"} type="number" domain={paddedPositiveDomain()} tickFormatter={(value) => formatCompactNumber(Number(value), currency)} label={annotations.xAxisLabel ? { value: annotations.xAxisLabel, position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "currentColor" } } : undefined} />
          <YAxis dataKey="efficiencyValue" name={language === "vi" ? "Chi phí/kết quả" : "Cost/result"} type="number" domain={paddedPositiveDomain()} tickFormatter={(value) => formatCompactNumber(Number(value), currency)} label={annotations.yAxisLabel ? { value: annotations.yAxisLabel, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "currentColor" } } : undefined} />
          <ZAxis dataKey="results" range={[60, 320]} />
          <ChartTooltip content={<BreakdownTooltip mode="efficiency" currency={currency} language={language} dimensionLabel={annotations.title} />} />
          <Scatter data={rows} fill="var(--color-spend)" name={language === "vi" ? "Phân khúc" : "Segment"} />
        </ScatterChart>
      </ChartContainer>
      <ChartAnnotationLegend annotations={annotations} />
    </div>
  );
}

function BreakdownTooltip({
  active,
  payload,
  mode,
  currency,
  language,
  dimensionLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: BreakdownChartRow }>;
  mode: BreakdownMetricMode;
  currency: string;
  language: InterfaceLanguage;
  dimensionLabel: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const metricCopy = breakdownMetricCopy(language);
  const metricLabel = mode === "spend" ? metricCopy.spend : mode === "results" ? metricCopy.results : metricCopy.efficiency;
  const metricValue = mode === "spend"
    ? formatMetric(row.spend, "currency", currency)
    : mode === "results"
      ? formatMetric(row.results, "number", currency)
      : row.costPerResult === null
        ? (language === "vi" ? "Chưa có kết quả" : "No result yet")
        : formatMetric(row.costPerResult, "currency", currency);

  return (
    <div className="grid min-w-64 gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="grid gap-0.5">
        <div className="font-medium">{row.label}</div>
        <div className="text-muted-foreground">{dimensionLabel}</div>
      </div>
      <div className="grid gap-1">
        <TooltipMetric label={metricLabel} value={metricValue} />
        <TooltipMetric label={metricCopy.spend} value={formatMetric(row.spend, "currency", currency)} />
        <TooltipMetric label={language === "vi" ? "Kết quả chính" : "Primary results"} value={formatMetric(row.results, "number", currency)} />
        <TooltipMetric label={language === "vi" ? "Tỷ trọng chi tiêu" : "Spend share"} value={formatSharePct(row.spendShare, currency)} />
        <TooltipMetric label={language === "vi" ? "Tỷ trọng kết quả" : "Result share"} value={formatSharePct(row.resultShare, currency)} />
      </div>
      <div className="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">{row.diagnosis}</div>
    </div>
  );
}

function TooltipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
    </div>
  );
}

function breakdownChartDataKey(mode: BreakdownMetricMode) {
  if (mode === "results") return "results";
  if (mode === "efficiency") return "efficiencyValue";
  return "spend";
}

function breakdownBarFill(mode: BreakdownMetricMode) {
  if (mode === "results") return "var(--color-result)";
  if (mode === "efficiency") return "var(--color-costPerMessage)";
  return "var(--color-spend)";
}

function breakdownMetricCopy(language: InterfaceLanguage) {
  return language === "vi"
    ? { spend: "Chi tiêu", results: "Kết quả", efficiency: "Chi phí/kết quả" }
    : { spend: "Spend", results: "Results", efficiency: "Cost per result" };
}

export function ChartEmpty({ language }: { language: InterfaceLanguage }) {
  return <div className="flex h-56 items-center justify-center rounded-lg border text-sm text-muted-foreground">{breakdownCopy[language].chartEmpty}</div>;
}

export function paddedPositiveDomain(referenceValue: number | null = null) {
  return ([dataMin, dataMax]: readonly [number, number]): [number, number] => {
    const safeMin = Number.isFinite(dataMin) ? dataMin : 0;
    const safeMax = Math.max(Number.isFinite(dataMax) ? dataMax : 0, referenceValue || 0);
    return [Math.min(0, safeMin), safeMax > 0 ? safeMax * 1.15 : 1];
  };
}
