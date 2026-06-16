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
import { type ChartKey, formatChartValue } from "@/lib/chart-spec";
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
    invalid: "This chart needs at least one metric on a single scale.",
  },
  vi: {
    noData: "Chưa có dữ liệu theo ngày để vẽ biểu đồ.",
    invalid: "Biểu đồ cần ít nhất một chỉ số trên cùng một thang đo.",
  },
};

function CustomChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function tooltipFormatter(currency: string) {
  return (value: unknown, name: unknown) => (
    <span className="tabular-nums">
      {formatChartValue(Number(value), metricFormat(name as ChartKey), currency)}
    </span>
  );
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
  const copy = EMPTY_COPY[language];
  const validation = validateSpec(spec);
  const data = buildCustomChartData(rows, spec);
  const config = buildChartConfig(spec, language);
  const usedAxes: CustomAxis[] = [...new Set(spec.series.map((s) => s.axis))];

  const body = (() => {
    if (!validation.ok) return <CustomChartEmpty message={copy.invalid} />;
    if (!data.length) return <CustomChartEmpty message={copy.noData} />;

    const axes = usedAxes.map((axis) => {
      const fmt = axisFormatFor(spec, axis);
      return (
        <YAxis
          key={axis}
          yAxisId={axis}
          orientation={axis === "right" ? "right" : "left"}
          tickLine={false}
          axisLine={false}
          width={48}
          tickMargin={4}
          tickFormatter={fmt ? (v) => formatAxisTick(Number(v), fmt, currency) : undefined}
        />
      );
    });
    const grid = <CartesianGrid vertical={false} />;
    const xAxis = <XAxis dataKey="x" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />;
    const tooltip = <ChartTooltip content={<ChartTooltipContent formatter={tooltipFormatter(currency)} />} />;
    const margin = { left: 8, right: 8, top: 8, bottom: 0 };

    if (spec.type === "bar") {
      return (
        <ChartContainer config={config} className="h-[260px] w-full">
          <BarChart data={data} margin={margin}>
            {grid}
            {xAxis}
            {axes}
            {tooltip}
            {spec.series.map((s) => (
              <Bar key={s.key} yAxisId={s.axis} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ChartContainer>
      );
    }

    if (spec.type === "area") {
      return (
        <ChartContainer config={config} className="h-[260px] w-full">
          <AreaChart data={data} margin={margin}>
            {grid}
            {xAxis}
            {axes}
            {tooltip}
            {spec.series.map((s) => (
              <Area
                key={s.key}
                yAxisId={s.axis}
                type="monotone"
                dataKey={s.key}
                stroke={`var(--color-${s.key})`}
                fill={`var(--color-${s.key})`}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      );
    }

    if (spec.type === "composed") {
      return (
        <ChartContainer config={config} className="h-[260px] w-full">
          <ComposedChart data={data} margin={margin}>
            {grid}
            {xAxis}
            {axes}
            {tooltip}
            {spec.series.map((s) =>
              s.axis === "left" ? (
                <Bar key={s.key} yAxisId={s.axis} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[3, 3, 0, 0]} />
              ) : (
                <Line key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} stroke={`var(--color-${s.key})`} strokeWidth={2} dot={false} />
              ),
            )}
          </ComposedChart>
        </ChartContainer>
      );
    }

    return (
      <ChartContainer config={config} className="h-[260px] w-full">
        <LineChart data={data} margin={margin}>
          {grid}
          {xAxis}
          {axes}
          {tooltip}
          {spec.series.map((s) => (
            <Line key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} stroke={`var(--color-${s.key})`} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ChartContainer>
    );
  })();

  return (
    <Card data-print-flow>
      <CardHeader>
        <CardTitle>{spec.title}</CardTitle>
        <CardDescription>{spec.series.map((s) => config[s.key]?.label).filter(Boolean).join(" · ")}</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
