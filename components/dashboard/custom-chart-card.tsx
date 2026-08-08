"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import type { InterfaceLanguage, NormalizedRow } from "@/lib/types";
import { chartMetricUnavailableLabel, type ChartKey, formatChartValue } from "@/lib/chart-spec";
import { chartSeriesDot } from "@/lib/chart-palette";
import {
  type CustomAxis,
  type CustomChartSpec,
  axisFormatFor,
  buildChartConfig,
  buildCustomChartData,
  formatAxisTick,
  metricFormat,
  validateSpec,
} from "@/lib/custom-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const EMPTY_COPY: Record<InterfaceLanguage, { noData: string; invalid: string }> = {
  en: {
    noData: "No daily data to chart yet.",
    invalid: "This chart needs at least one metric on a valid scale.",
  },
  vi: {
    noData: "Chưa có dữ liệu theo ngày để vẽ biểu đồ.",
    invalid: "Biểu đồ cần ít nhất một chỉ số trên thang đo hợp lệ.",
  },
};

function CustomChartEmpty({ message, height }: { message: string; height: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-border text-center text-xs text-muted-foreground" style={{ height }}>
      {message}
    </div>
  );
}

function tooltipFormatter(currency: string, language: InterfaceLanguage) {
  return (value: unknown, name: unknown) => (
    <span className="tabular-nums">
      {value == null
        ? `— · ${chartMetricUnavailableLabel(name as ChartKey, language)}`
        : formatChartValue(Number(value), metricFormat(name as ChartKey), currency)}
    </span>
  );
}

function CustomChartPlot({
  spec,
  rows,
  language,
  currency,
  height,
  compact = false,
}: {
  spec: CustomChartSpec;
  rows: NormalizedRow[];
  language: InterfaceLanguage;
  currency: string;
  height: number;
  compact?: boolean;
}) {
  const copy = EMPTY_COPY[language];
  const validation = validateSpec(spec);
  const data = buildCustomChartData(rows, spec);
  const config = buildChartConfig(spec, language);
  const usedAxes: CustomAxis[] = [...new Set(spec.series.map((series) => series.axis))];

  if (!validation.ok) return <CustomChartEmpty message={copy.invalid} height={height} />;
  if (!data.length) return <CustomChartEmpty message={copy.noData} height={height} />;

  const axes = usedAxes.map((axis) => {
    const format = axisFormatFor(spec, axis);
    return (
      <YAxis
        key={axis}
        yAxisId={axis}
        orientation={axis === "right" ? "right" : "left"}
        hide={compact}
        tickLine={false}
        axisLine={false}
        width={compact ? 0 : format === "currency" ? 64 : 52}
        tickMargin={6}
        tickFormatter={format ? (value) => formatAxisTick(Number(value), format, currency) : undefined}
      />
    );
  });
  const grid = <CartesianGrid vertical={false} strokeDasharray={compact ? "3 3" : undefined} />;
  const xAxis = <XAxis dataKey="x" hide={compact} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />;
  const tooltip = compact ? null : <ChartTooltip filterNull={false} content={<ChartTooltipContent formatter={tooltipFormatter(currency, language)} />} />;
  const margin = compact ? { left: 2, right: 2, top: 4, bottom: 0 } : { left: 8, right: 8, top: 8, bottom: 0 };
  const chartClassName = "h-full w-full";

  const chart = (() => {
    if (spec.type === "bar") {
      return (
        <BarChart data={data} margin={margin}>
          {grid}{xAxis}{axes}{tooltip}
          {spec.series.map((series) => <Bar key={series.key} yAxisId={series.axis} dataKey={series.key} fill={`var(--color-${series.key})`} radius={[3, 3, 0, 0]} />)}
        </BarChart>
      );
    }
    if (spec.type === "area") {
      return (
        <AreaChart data={data} margin={margin}>
          {grid}{xAxis}{axes}{tooltip}
          {spec.series.map((series) => <Area key={series.key} yAxisId={series.axis} type="monotone" dataKey={series.key} connectNulls={false} stroke={`var(--color-${series.key})`} fill={`var(--color-${series.key})`} fillOpacity={0.15} strokeWidth={2} dot={compact ? false : chartSeriesDot(series.key, 2)} />)}
        </AreaChart>
      );
    }
    if (spec.type === "composed") {
      return (
        <ComposedChart data={data} margin={margin}>
          {grid}{xAxis}{axes}{tooltip}
          {spec.series.map((series) => series.axis === "left"
            ? <Bar key={series.key} yAxisId={series.axis} dataKey={series.key} fill={`var(--color-${series.key})`} radius={[3, 3, 0, 0]} />
            : <Line key={series.key} yAxisId={series.axis} type="monotone" dataKey={series.key} connectNulls={false} stroke={`var(--color-${series.key})`} strokeWidth={2} dot={compact ? false : chartSeriesDot(series.key, 2)} />)}
        </ComposedChart>
      );
    }
    return (
      <LineChart data={data} margin={margin}>
        {grid}{xAxis}{axes}{tooltip}
        {spec.series.map((series) => <Line key={series.key} yAxisId={series.axis} type="monotone" dataKey={series.key} connectNulls={false} stroke={`var(--color-${series.key})`} strokeWidth={2} dot={compact ? false : chartSeriesDot(series.key, 2)} />)}
      </LineChart>
    );
  })();

  return (
    <div style={{ height }}>
      <ChartContainer config={config} className={chartClassName}>{chart}</ChartContainer>
    </div>
  );
}

export function CustomChartPreview(props: {
  spec: CustomChartSpec;
  rows: NormalizedRow[];
  language: InterfaceLanguage;
  currency: string;
}) {
  return <CustomChartPlot {...props} height={94} compact />;
}

export function CustomChartCard({
  spec,
  rows,
  language,
  currency,
}: {
  spec: CustomChartSpec;
  rows: NormalizedRow[];
  language: InterfaceLanguage;
  currency: string;
}) {
  const config = buildChartConfig(spec, language);
  return (
    <Card data-print-flow>
      <CardHeader>
        <CardTitle>{spec.title}</CardTitle>
        <CardDescription>{spec.series.map((series) => config[series.key]?.label).filter(Boolean).join(" · ")}</CardDescription>
      </CardHeader>
      <CardContent>
        <CustomChartPlot spec={spec} rows={rows} language={language} currency={currency} height={260} />
      </CardContent>
    </Card>
  );
}
