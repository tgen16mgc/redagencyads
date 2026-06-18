import type { KpiPack, NormalizedRow } from "@/lib/types";

export type BreakdownMetricMode = "spend" | "results" | "efficiency";
export type BreakdownDimension = "platform" | "ageGender" | "geography";
export type BreakdownChartType = "donut" | "bar" | "scatter";

export type BreakdownChartRow = {
  id: string;
  label: string;
  spend: number;
  results: number;
  efficiency: number;
  share: number;
};

export type BreakdownDimensionModel = {
  value: BreakdownDimension;
  label: string;
  rows: NormalizedRow[];
  available: boolean;
};

export type BreakdownViewModel = {
  activeDimension: BreakdownDimension;
  activeDimensionLabel: string;
  chartType: BreakdownChartType;
  chartLabel: string;
  chartExplanation: string;
  metricLabel: string;
  ariaLabel: string;
  rows: BreakdownChartRow[];
  summaryRows: BreakdownChartRow[];
};

export function buildBreakdownDimensions(input: {
  platformRows: NormalizedRow[];
  ageGenderRows: NormalizedRow[];
  regionRows: NormalizedRow[];
  countryRows?: NormalizedRow[];
  language: "en" | "vi";
}): BreakdownDimensionModel[] {
  const geographyRows = input.regionRows.length ? input.regionRows : input.countryRows || [];
  return [
    { value: "platform", label: input.language === "vi" ? "Nền tảng" : "Platform", rows: input.platformRows, available: input.platformRows.length > 0 },
    { value: "ageGender", label: input.language === "vi" ? "Tuổi/Giới" : "Age/Gender", rows: input.ageGenderRows, available: input.ageGenderRows.length > 0 },
    { value: "geography", label: input.language === "vi" ? "Khu vực" : "Geography", rows: geographyRows, available: geographyRows.length > 0 },
  ];
}

export function buildBreakdownViewModel(input: {
  dimensions: BreakdownDimensionModel[];
  selectedDimension: BreakdownDimension;
  mode: BreakdownMetricMode;
  pack: KpiPack;
  language: "en" | "vi";
}): BreakdownViewModel {
  const activeDimension = input.dimensions.find((dimension) => dimension.value === input.selectedDimension && dimension.available)
    || input.dimensions.find((dimension) => dimension.available)
    || input.dimensions[0];
  const rows = buildBreakdownChartRows(activeDimension?.rows || [], input.pack).slice(0, input.mode === "efficiency" ? 14 : 10);
  const chartType = chooseBreakdownChartType(rows, input.mode);
  const metricLabel = breakdownMetricLabel(input.mode, input.language);
  const chartLabel = breakdownChartLabel(chartType, input.language);
  return {
    activeDimension: activeDimension?.value || input.selectedDimension,
    activeDimensionLabel: activeDimension?.label || "",
    chartType,
    chartLabel,
    chartExplanation: breakdownChartExplanation(chartType, input.language),
    metricLabel,
    ariaLabel: breakdownAriaLabel({ chartLabel, dimensionLabel: activeDimension?.label || "", metricLabel, language: input.language }),
    rows,
    summaryRows: rows.slice(0, 5),
  };
}

export function buildBreakdownChartRows(rows: NormalizedRow[], pack: KpiPack): BreakdownChartRow[] {
  const mapped = rows.map((row) => {
    const results = primaryResultValue(row, pack);
    return {
      id: row.id,
      label: breakdownRowLabel(row),
      spend: row.spend,
      results,
      efficiency: results > 0 ? row.spend / results : 0,
      share: 0,
    };
  }).filter((row) => row.spend > 0 || row.results > 0);
  const totalSpend = mapped.reduce((sum, row) => sum + row.spend, 0);
  return mapped
    .map((row) => ({ ...row, share: totalSpend > 0 ? row.spend / totalSpend : 0 }))
    .sort((a, b) => b.spend - a.spend);
}

export function chooseBreakdownChartType(rows: BreakdownChartRow[], mode: BreakdownMetricMode): BreakdownChartType {
  if (mode === "efficiency") return "scatter";
  return rows.length > 0 && rows.length <= 4 ? "donut" : "bar";
}

export function primaryResultValue(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  if (pack === "awareness") return row.impressions;
  return row.leads || row.messages;
}

export function breakdownRowLabel(row: NormalizedRow) {
  return row.region || row.country || row.platform || [row.age, row.gender].filter(Boolean).join(" / ") || row.name;
}

export function breakdownMetricLabel(mode: BreakdownMetricMode, language: "en" | "vi") {
  if (language === "vi") {
    if (mode === "spend") return "Chi tiêu";
    if (mode === "results") return "Kết quả";
    return "Chi phí/kết quả";
  }
  if (mode === "spend") return "Spend";
  if (mode === "results") return "Results";
  return "Cost per result";
}

export function breakdownChartLabel(type: BreakdownChartType, language: "en" | "vi") {
  if (language === "vi") {
    if (type === "donut") return "Biểu đồ donut";
    if (type === "scatter") return "Bản đồ hiệu suất";
    return "Thanh xếp hạng";
  }
  if (type === "donut") return "Donut share";
  if (type === "scatter") return "Efficiency map";
  return "Ranked bars";
}

export function breakdownChartExplanation(type: BreakdownChartType, language: "en" | "vi") {
  if (type === "donut") {
    return language === "vi"
      ? "Ít phân khúc: dùng donut để thấy tỷ trọng chi tiêu/kết quả nhanh."
      : "Few segments: donut shows spend or result share at a glance.";
  }
  if (type === "scatter") {
    return language === "vi"
      ? "Mỗi điểm là một phân khúc: bên phải là chi tiêu cao, càng lên trên là chi phí/kết quả càng đắt."
      : "Each dot is a segment: farther right means more spend, higher means costlier results.";
  }
  return language === "vi"
    ? "Nhiều phân khúc: dùng thanh xếp hạng để giữ nhãn dễ đọc và tìm phần chi tiêu lớn nhất."
    : "Many segments: ranked bars keep labels readable and surface the biggest allocations.";
}

function breakdownAriaLabel(input: { chartLabel: string; dimensionLabel: string; metricLabel: string; language: "en" | "vi" }) {
  return input.language === "vi"
    ? `${input.chartLabel} cho ${input.dimensionLabel}, đo theo ${input.metricLabel}`
    : `${input.chartLabel} for ${input.dimensionLabel}, measured by ${input.metricLabel}`;
}
