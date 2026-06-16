import type { InterfaceLanguage, NormalizedRow } from "@/lib/types";
import type { ChartConfig } from "@/components/ui/chart";
import { type ChartFormat, type ChartKey, compactDate, metricValue, roundForFormat } from "@/lib/chart-spec";

export type CustomChartType = "line" | "bar" | "area" | "composed";
export type CustomAxis = "left" | "right";

export type MetricCatalogEntry = {
  key: ChartKey;
  format: ChartFormat;
  labelEn: string;
  labelVi: string;
  defaultAxis: CustomAxis;
  colorVar: string;
};

export type CustomSeries = {
  key: ChartKey;
  axis: CustomAxis;
};

export type CustomChartSpec = {
  id: string;
  title: string;
  type: CustomChartType;
  xKey: "date";
  series: CustomSeries[];
  dualAxis: boolean;
};

export type ChartPreset = {
  id: string;
  type: CustomChartType;
  series: CustomSeries[];
  dualAxis: boolean;
  nameEn: string;
  nameVi: string;
  usageEn: string;
  usageVi: string;
  meaningEn: string;
  meaningVi: string;
};

export type ValidationCode =
  | "EMPTY_SERIES"
  | "TOO_MANY_SERIES"
  | "MIXED_FORMATS_SINGLE_AXIS"
  | "TOO_MANY_FORMATS"
  | "DUPLICATE_SERIES"
  | "DUAL_AXIS_UNNEEDED";

export type ValidationIssue = { code: ValidationCode; message: string };
export type ValidationResult = { ok: boolean; issues: ValidationIssue[] };

export const MAX_SERIES = 5;
export const CUSTOM_CHARTS_STORAGE_KEY = "redagencyads-custom-charts";

const CHART_TYPES: readonly CustomChartType[] = ["line", "bar", "area", "composed"];
const AXES: readonly CustomAxis[] = ["left", "right"];
const SERIES_COLOR_VARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;

function axisForFormat(format: ChartFormat): CustomAxis {
  return format === "percent" || format === "ratio" ? "right" : "left";
}

const CATALOG_SOURCE: Array<Pick<MetricCatalogEntry, "key" | "format" | "labelEn" | "labelVi">> = [
  { key: "messages", format: "number", labelEn: "Messages", labelVi: "Tin nhắn" },
  { key: "replies", format: "number", labelEn: "Replies", labelVi: "Phản hồi" },
  { key: "leads", format: "number", labelEn: "Leads", labelVi: "Lead" },
  { key: "purchases", format: "number", labelEn: "Purchases", labelVi: "Đơn hàng" },
  { key: "linkClicks", format: "number", labelEn: "Link clicks", labelVi: "Click link" },
  { key: "clicks", format: "number", labelEn: "Clicks", labelVi: "Click" },
  { key: "impressions", format: "number", labelEn: "Impressions", labelVi: "Hiển thị" },
  { key: "reach", format: "number", labelEn: "Reach", labelVi: "Tiếp cận" },
  { key: "costPerMessage", format: "currency", labelEn: "Cost/msg", labelVi: "Chi phí/tin nhắn" },
  { key: "costPerReply", format: "currency", labelEn: "Cost/reply", labelVi: "Chi phí/phản hồi" },
  { key: "cpl", format: "currency", labelEn: "CPL", labelVi: "CPL" },
  { key: "cpaPurchase", format: "currency", labelEn: "CPA purchase", labelVi: "CPA đơn" },
  { key: "cpc", format: "currency", labelEn: "CPC", labelVi: "CPC" },
  { key: "cpm", format: "currency", labelEn: "CPM", labelVi: "CPM" },
  { key: "roas", format: "ratio", labelEn: "ROAS", labelVi: "ROAS" },
  { key: "ctr", format: "percent", labelEn: "CTR", labelVi: "CTR" },
  { key: "frequency", format: "ratio", labelEn: "Frequency", labelVi: "Tần suất" },
];

export const METRIC_CATALOG: MetricCatalogEntry[] = CATALOG_SOURCE.map((entry, index) => ({
  ...entry,
  defaultAxis: axisForFormat(entry.format),
  colorVar: SERIES_COLOR_VARS[index % SERIES_COLOR_VARS.length],
}));

const CATALOG_BY_KEY = new Map<ChartKey, MetricCatalogEntry>(METRIC_CATALOG.map((entry) => [entry.key, entry]));

export function isChartKey(value: unknown): value is ChartKey {
  return typeof value === "string" && CATALOG_BY_KEY.has(value as ChartKey);
}

export function metricFormat(key: ChartKey): ChartFormat {
  return CATALOG_BY_KEY.get(key)?.format ?? "number";
}

export function metricLabel(key: ChartKey, language: InterfaceLanguage): string {
  const entry = CATALOG_BY_KEY.get(key);
  if (!entry) return key;
  return language === "vi" ? entry.labelVi : entry.labelEn;
}

export function defaultAxisFor(key: ChartKey): CustomAxis {
  return CATALOG_BY_KEY.get(key)?.defaultAxis ?? "left";
}

export type ResolvedCatalogEntry = {
  key: ChartKey;
  format: ChartFormat;
  label: string;
  defaultAxis: CustomAxis;
  colorVar: string;
};

export function getMetricCatalog(language: InterfaceLanguage): ResolvedCatalogEntry[] {
  return METRIC_CATALOG.map((entry) => ({
    key: entry.key,
    format: entry.format,
    label: language === "vi" ? entry.labelVi : entry.labelEn,
    defaultAxis: entry.defaultAxis,
    colorVar: entry.colorVar,
  }));
}

function coerceAxis(axis: unknown, key: ChartKey): CustomAxis {
  return axis === "left" || axis === "right" ? axis : defaultAxisFor(key);
}

function distinctFormats(series: CustomSeries[]): ChartFormat[] {
  const seen = new Set<ChartFormat>();
  for (const s of series) seen.add(metricFormat(s.key));
  return [...seen];
}

function fallbackTitle(series: CustomSeries[]): string {
  if (series.length === 0) return "Custom chart";
  return series.map((s) => metricLabel(s.key, "en")).join(" vs ");
}

export function normalizeSpec(spec: CustomChartSpec): CustomChartSpec {
  const seen = new Set<string>();
  const deduped: CustomSeries[] = [];
  for (const raw of spec.series) {
    if (!isChartKey(raw.key)) continue;
    const axis = coerceAxis(raw.axis, raw.key);
    const id = `${raw.key}:${axis}`;
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push({ key: raw.key, axis });
  }
  const series = deduped.slice(0, MAX_SERIES);
  const formats = distinctFormats(series).length;
  const title = spec.title.trim() === "" ? fallbackTitle(series) : spec.title;
  return {
    ...spec,
    title,
    series,
    dualAxis: formats === 2,
  };
}

export function validateSpec(spec: CustomChartSpec): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { series } = spec;

  if (series.length === 0) {
    issues.push({ code: "EMPTY_SERIES", message: "Add at least one metric to the chart." });
  }
  if (series.length > MAX_SERIES) {
    issues.push({ code: "TOO_MANY_SERIES", message: `A chart can show at most ${MAX_SERIES} metrics.` });
  }

  const pairSeen = new Set<string>();
  let hasDuplicate = false;
  for (const s of series) {
    const id = `${s.key}:${s.axis}`;
    if (pairSeen.has(id)) hasDuplicate = true;
    pairSeen.add(id);
  }
  if (hasDuplicate) {
    issues.push({ code: "DUPLICATE_SERIES", message: "The same metric is added twice on the same axis." });
  }

  const formats = distinctFormats(series);
  if (formats.length >= 3) {
    issues.push({ code: "TOO_MANY_FORMATS", message: "A chart supports at most two metric formats (two axes)." });
  }

  const formatsByAxis = new Map<CustomAxis, Set<ChartFormat>>();
  for (const s of series) {
    const set = formatsByAxis.get(s.axis) ?? new Set<ChartFormat>();
    set.add(metricFormat(s.key));
    formatsByAxis.set(s.axis, set);
  }
  for (const set of formatsByAxis.values()) {
    if (set.size >= 2) {
      issues.push({ code: "MIXED_FORMATS_SINGLE_AXIS", message: "One axis mixes two formats. Move a metric to the other axis." });
      break;
    }
  }

  if (spec.dualAxis && formats.length < 2) {
    issues.push({ code: "DUAL_AXIS_UNNEEDED", message: "Dual axis is on but the chart has a single metric format." });
  }

  return { ok: issues.length === 0, issues };
}

export function canAddSeries(spec: CustomChartSpec): boolean {
  return spec.series.length < MAX_SERIES;
}

export function addSeries(spec: CustomChartSpec, key: ChartKey, axis?: CustomAxis): CustomChartSpec {
  if (!isChartKey(key)) return normalizeSpec(spec);
  const nextAxis = axis ?? defaultAxisFor(key);
  return normalizeSpec({ ...spec, series: [...spec.series, { key, axis: nextAxis }] });
}

export function removeSeries(spec: CustomChartSpec, key: ChartKey, axis?: CustomAxis): CustomChartSpec {
  const series = spec.series.filter((s) => (axis ? !(s.key === key && s.axis === axis) : s.key !== key));
  return normalizeSpec({ ...spec, series });
}

export function setSeriesAxis(spec: CustomChartSpec, key: ChartKey, axis: CustomAxis): CustomChartSpec {
  const series = spec.series.map((s) => (s.key === key ? { ...s, axis } : s));
  return normalizeSpec({ ...spec, series });
}

export const CHART_PRESETS: ChartPreset[] = [
  {
    id: "preset-cpl-leads",
    type: "composed",
    series: [
      { key: "leads", axis: "left" },
      { key: "cpl", axis: "right" },
    ],
    dualAxis: true,
    nameEn: "Lead volume vs CPL",
    nameVi: "Lượng lead vs CPL",
    usageEn: "Track lead volume against cost per lead over time.",
    usageVi: "Theo dõi lượng lead so với chi phí mỗi lead theo thời gian.",
    meaningEn: "If CPL climbs while leads flatten, scaling is getting expensive.",
    meaningVi: "Nếu CPL tăng trong khi lead chững lại, việc scale đang đắt dần.",
  },
  {
    id: "preset-purchases-roas",
    type: "composed",
    series: [
      { key: "purchases", axis: "left" },
      { key: "roas", axis: "right" },
    ],
    dualAxis: true,
    nameEn: "Purchases vs ROAS",
    nameVi: "Đơn hàng vs ROAS",
    usageEn: "Watch purchase scale against return on ad spend.",
    usageVi: "Xem mức tăng đơn hàng so với ROAS.",
    meaningEn: "Purchases rising while ROAS holds is healthy scaling.",
    meaningVi: "Đơn hàng tăng mà ROAS giữ vững là scale lành mạnh.",
  },
  {
    id: "preset-messages-costpermsg",
    type: "composed",
    series: [
      { key: "messages", axis: "left" },
      { key: "costPerMessage", axis: "right" },
    ],
    dualAxis: true,
    nameEn: "Messages vs Cost/msg",
    nameVi: "Tin nhắn vs Chi phí/tin nhắn",
    usageEn: "Track DM volume against cost per message.",
    usageVi: "Theo dõi lượng tin nhắn so với chi phí mỗi tin nhắn.",
    meaningEn: "Cost per message drifting up signals acquisition pressure.",
    meaningVi: "Chi phí mỗi tin nhắn tăng dần báo hiệu áp lực chi phí.",
  },
  {
    id: "preset-clicks-ctr",
    type: "composed",
    series: [
      { key: "clicks", axis: "left" },
      { key: "ctr", axis: "right" },
    ],
    dualAxis: true,
    nameEn: "Clicks vs CTR",
    nameVi: "Click vs CTR",
    usageEn: "Check whether extra clicks reflect real interest or just more impressions.",
    usageVi: "Kiểm tra click tăng là do quan tâm thật hay chỉ vì nhiều hiển thị hơn.",
    meaningEn: "Clicks up but CTR down means delivery is widening, not improving.",
    meaningVi: "Click tăng nhưng CTR giảm nghĩa là phân phối mở rộng chứ không tốt lên.",
  },
  {
    id: "preset-frequency-ctr",
    type: "line",
    series: [
      { key: "frequency", axis: "left" },
      { key: "ctr", axis: "right" },
    ],
    dualAxis: true,
    nameEn: "Frequency vs CTR",
    nameVi: "Tần suất vs CTR",
    usageEn: "Spot creative fatigue as frequency rises.",
    usageVi: "Phát hiện fatigue creative khi tần suất tăng.",
    meaningEn: "Rising frequency with falling CTR is a classic fatigue signal.",
    meaningVi: "Tần suất tăng kèm CTR giảm là tín hiệu fatigue điển hình.",
  },
  {
    id: "preset-cpm-reach",
    type: "composed",
    series: [
      { key: "reach", axis: "left" },
      { key: "cpm", axis: "right" },
    ],
    dualAxis: true,
    nameEn: "Reach vs CPM",
    nameVi: "Tiếp cận vs CPM",
    usageEn: "Watch delivery cost as reach expands.",
    usageVi: "Xem chi phí phân phối khi tiếp cận mở rộng.",
    meaningEn: "CPM climbing while reach stalls points to audience saturation.",
    meaningVi: "CPM tăng trong khi tiếp cận chững lại cho thấy tệp đã bão hòa.",
  },
];

export function getPresets(language: InterfaceLanguage) {
  return CHART_PRESETS.map((preset) => ({
    id: preset.id,
    type: preset.type,
    name: language === "vi" ? preset.nameVi : preset.nameEn,
    usage: language === "vi" ? preset.usageVi : preset.usageEn,
    meaning: language === "vi" ? preset.meaningVi : preset.meaningEn,
  }));
}

export function presetToSpec(preset: ChartPreset, language: InterfaceLanguage, id: string): CustomChartSpec {
  return normalizeSpec({
    id,
    title: language === "vi" ? preset.nameVi : preset.nameEn,
    type: preset.type,
    xKey: "date",
    series: preset.series.map((s) => ({ key: s.key, axis: s.axis })),
    dualAxis: preset.dualAxis,
  });
}

export function buildCustomChartData(rows: NormalizedRow[], spec: CustomChartSpec): Array<Record<string, number | string>> {
  return rows
    .filter((row) => Boolean(row.date))
    .map((row) => {
      const point: Record<string, number | string> = { x: compactDate(row.date) };
      for (const s of spec.series) {
        point[s.key] = roundForFormat(metricValue(row, s.key), metricFormat(s.key));
      }
      return point;
    });
}

export function buildChartConfig(spec: CustomChartSpec, language: InterfaceLanguage): ChartConfig {
  const config: ChartConfig = {};
  spec.series.forEach((s, index) => {
    config[s.key] = {
      label: metricLabel(s.key, language),
      color: SERIES_COLOR_VARS[index % SERIES_COLOR_VARS.length],
    };
  });
  return config;
}

export function axisFormatFor(spec: CustomChartSpec, axis: CustomAxis): ChartFormat | undefined {
  const match = spec.series.find((s) => s.axis === axis);
  return match ? metricFormat(match.key) : undefined;
}

export function formatAxisTick(value: number, format: ChartFormat, currency: string): string {
  const locale = currency === "VND" ? "vi-VN" : "en-US";
  const safe = value || 0;
  if (format === "currency") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(safe);
  }
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(safe);
  if (format === "percent") return `${compact}%`;
  if (format === "ratio") return `${compact}x`;
  return compact;
}

export function serializeCharts(specs: CustomChartSpec[]): string {
  return JSON.stringify(specs);
}

function isStoredSpecShape(value: unknown): value is CustomChartSpec {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || entry.id.trim() === "") return false;
  if (typeof entry.title !== "string") return false;
  if (!CHART_TYPES.includes(entry.type as CustomChartType)) return false;
  if (entry.xKey !== "date") return false;
  if (typeof entry.dualAxis !== "boolean") return false;
  if (!Array.isArray(entry.series)) return false;
  for (const s of entry.series) {
    if (typeof s !== "object" || s === null) return false;
    const series = s as Record<string, unknown>;
    if (!isChartKey(series.key)) return false;
    if (!AXES.includes(series.axis as CustomAxis)) return false;
  }
  return true;
}

export function deserializeCharts(raw: string | null | undefined): CustomChartSpec[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const result: CustomChartSpec[] = [];
  for (const entry of parsed) {
    if (!isStoredSpecShape(entry)) continue;
    const spec: CustomChartSpec = {
      id: entry.id,
      title: entry.title,
      type: entry.type,
      xKey: "date",
      series: entry.series.map((s) => ({ key: s.key, axis: s.axis })),
      dualAxis: entry.dualAxis,
    };
    if (!validateSpec(spec).ok) continue;
    result.push(spec);
  }
  return result;
}
