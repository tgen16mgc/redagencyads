import type { KpiPack, NormalizedRow } from "@/lib/types";
import { sumRows } from "@/lib/metric-aggregation";

export type BreakdownMetricMode = "spend" | "results" | "efficiency";
export type BreakdownDimension = "platform" | "age" | "gender" | "geography";
export type BreakdownChartType = "bar" | "scatter";
export type BreakdownInsightTone = "neutral" | "positive" | "warning" | "insufficient";

export type BreakdownChartRow = {
  id: string;
  label: string;
  spend: number;
  results: number;
  costPerResult: number | null;
  efficiency: number;
  efficiencyValue: number;
  share: number;
  spendShare: number;
  resultShare: number;
  allocationGap: number;
  efficiencyIndex: number;
  tone: BreakdownInsightTone;
  diagnosis: string;
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
  resultLabel: string;
  topInsight: string;
  recommendedAction: string;
  confidenceLabel: string;
  dataCaveat: string | null;
  insightTone: BreakdownInsightTone;
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
  const ageRows = groupDemographicRows(input.ageGenderRows, "age", input.language);
  const genderRows = groupDemographicRows(input.ageGenderRows, "gender", input.language);
  return [
    { value: "platform", label: input.language === "vi" ? "Nền tảng" : "Platform", rows: input.platformRows, available: input.platformRows.length > 0 },
    { value: "age", label: input.language === "vi" ? "Tuổi" : "Age", rows: ageRows, available: ageRows.length > 0 },
    { value: "gender", label: input.language === "vi" ? "Giới tính" : "Gender", rows: genderRows, available: genderRows.length > 0 },
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
  const rows = sortBreakdownRows(buildBreakdownChartRows(activeDimension?.rows || [], input.pack), input.mode).slice(0, input.mode === "efficiency" ? 14 : 10);
  const chartType = chooseBreakdownChartType(rows, input.mode);
  const metricLabel = breakdownMetricLabel(input.mode, input.language);
  const resultLabel = primaryResultLabel(input.pack, input.language);
  const chartLabel = breakdownChartLabel(chartType, input.language);
  const diagnosis = buildBreakdownDiagnosis({
    rows,
    dimensionLabel: activeDimension?.label || "",
    resultLabel,
    language: input.language,
    selectedDimension: activeDimension?.value || input.selectedDimension,
  });
  return {
    activeDimension: activeDimension?.value || input.selectedDimension,
    activeDimensionLabel: activeDimension?.label || "",
    chartType,
    chartLabel,
    chartExplanation: breakdownChartExplanation(chartType, input.mode, input.language),
    metricLabel,
    resultLabel,
    topInsight: diagnosis.topInsight,
    recommendedAction: diagnosis.recommendedAction,
    confidenceLabel: diagnosis.confidenceLabel,
    dataCaveat: diagnosis.dataCaveat,
    insightTone: diagnosis.insightTone,
    ariaLabel: breakdownAriaLabel({ chartLabel, dimensionLabel: activeDimension?.label || "", metricLabel, language: input.language }),
    rows,
    summaryRows: sortBreakdownRows(rows, "spend").slice(0, 6),
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
      costPerResult: results > 0 ? row.spend / results : null,
      efficiency: results > 0 ? row.spend / results : 0,
      efficiencyValue: 0,
      share: 0,
      spendShare: 0,
      resultShare: 0,
      allocationGap: 0,
      efficiencyIndex: 0,
      tone: "neutral" as BreakdownInsightTone,
      diagnosis: "",
    };
  }).filter((row) => row.spend > 0 || row.results > 0);
  const totalSpend = mapped.reduce((sum, row) => sum + row.spend, 0);
  const totalResults = mapped.reduce((sum, row) => sum + row.results, 0);
  const averageCost = totalResults > 0 ? totalSpend / totalResults : 0;
  const finiteCosts = mapped.map((row) => row.costPerResult).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const noResultCost = finiteCosts.length ? Math.max(...finiteCosts) * 1.25 : Math.max(...mapped.map((row) => row.spend), 1);
  return mapped
    .map((row) => {
      const spendShare = totalSpend > 0 ? row.spend / totalSpend : 0;
      const resultShare = totalResults > 0 ? row.results / totalResults : 0;
      const allocationGap = spendShare - resultShare;
      const efficiencyIndex = row.costPerResult && averageCost > 0 ? averageCost / row.costPerResult : row.spend > 0 ? 0 : 1;
      return {
        ...row,
        share: spendShare,
        spendShare,
        resultShare,
        allocationGap,
        efficiencyIndex,
        efficiencyValue: row.costPerResult ?? noResultCost,
        tone: breakdownRowTone(row.spend, row.results, allocationGap, efficiencyIndex),
        diagnosis: breakdownRowDiagnosis({ label: row.label, spendShare, resultShare, allocationGap, efficiencyIndex, hasResults: row.results > 0 }),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function chooseBreakdownChartType(rows: BreakdownChartRow[], mode: BreakdownMetricMode): BreakdownChartType {
  if (mode === "efficiency" && rows.length >= 6) return "scatter";
  return "bar";
}

export function primaryResultValue(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "lead_gen") return row.leads;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  if (pack === "awareness") return row.impressions;
  return row.leads;
}

export function breakdownRowLabel(row: NormalizedRow) {
  const demographic = row.age && row.gender ? `${row.age} / ${row.gender}` : row.age || row.gender;
  return row.region || row.country || row.platform || demographic || row.name;
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
    if (type === "scatter") return "Bản đồ hiệu suất";
    return "Xếp hạng phân khúc";
  }
  if (type === "scatter") return "Efficiency map";
  return "Segment ranking";
}

export function breakdownChartExplanation(type: BreakdownChartType, mode: BreakdownMetricMode, language: "en" | "vi") {
  if (type === "scatter") {
    return language === "vi"
      ? "Mỗi điểm là một phân khúc: bên phải là chi tiêu cao, càng lên trên là chi phí/kết quả càng đắt."
      : "Each dot is a segment: farther right means more spend, higher means costlier results.";
  }
  if (mode === "efficiency") {
    return language === "vi"
      ? "Xếp hạng chi phí/kết quả để thấy phân khúc nào đang đắt nhất hoặc chưa có kết quả."
      : "Ranks cost per result so the most expensive or no-result segments surface first.";
  }
  if (mode === "results") {
    return language === "vi"
      ? "Xếp hạng kết quả chính và so với tỷ trọng chi tiêu để thấy phân khúc đáng giữ."
      : "Ranks primary results against spend share so productive segments stand out.";
  }
  return language === "vi"
    ? "Xếp hạng chi tiêu và so với tỷ trọng kết quả để thấy phân bổ lệch."
    : "Ranks spend against result share to show where allocation is out of balance.";
}

function breakdownAriaLabel(input: { chartLabel: string; dimensionLabel: string; metricLabel: string; language: "en" | "vi" }) {
  return input.language === "vi"
    ? `${input.chartLabel} cho ${input.dimensionLabel}, đo theo ${input.metricLabel}`
    : `${input.chartLabel} for ${input.dimensionLabel}, measured by ${input.metricLabel}`;
}

function groupDemographicRows(rows: NormalizedRow[], key: "age" | "gender", language: "en" | "vi"): NormalizedRow[] {
  const groups = new Map<string, NormalizedRow[]>();
  rows.forEach((row) => {
    const value = row[key];
    if (!value) return;
    groups.set(value, [...(groups.get(value) || []), row]);
  });
  return Array.from(groups.entries()).map(([value, groupedRows]) => ({
    ...sumRows(groupedRows, demographicLabel(value, key, language)),
    id: `${key}:${value}`,
    level: "breakdown",
    [key]: value,
  }));
}

function demographicLabel(value: string, key: "age" | "gender", language: "en" | "vi") {
  if (key === "age") return value;
  if (language === "vi") {
    if (value === "male") return "Nam";
    if (value === "female") return "Nữ";
    if (value === "unknown") return "Không rõ";
  }
  if (value === "male") return "Male";
  if (value === "female") return "Female";
  if (value === "unknown") return "Unknown";
  return value;
}

function breakdownRowTone(spend: number, results: number, allocationGap: number, efficiencyIndex: number): BreakdownInsightTone {
  if (spend > 0 && results === 0) return "warning";
  if (allocationGap >= 0.15 && efficiencyIndex < 0.8) return "warning";
  if (allocationGap <= -0.1 && efficiencyIndex >= 1) return "positive";
  return "neutral";
}

function breakdownRowDiagnosis(input: {
  label: string;
  spendShare: number;
  resultShare: number;
  allocationGap: number;
  efficiencyIndex: number;
  hasResults: boolean;
}) {
  if (!input.hasResults && input.spendShare > 0) return "Spend with no primary result";
  if (input.allocationGap >= 0.15 && input.efficiencyIndex < 0.8) return "High spend share with weak result share";
  if (input.allocationGap <= -0.1 && input.efficiencyIndex >= 1) return "Result share beats spend share";
  return "Spend and result share are aligned";
}

function sortBreakdownRows(rows: BreakdownChartRow[], mode: BreakdownMetricMode) {
  return [...rows].sort((a, b) => {
    if (mode === "results") return b.results - a.results || b.spend - a.spend;
    if (mode === "efficiency") {
      const aNoResult = a.spend > 0 && a.results === 0;
      const bNoResult = b.spend > 0 && b.results === 0;
      if (aNoResult !== bNoResult) return aNoResult ? -1 : 1;
      return b.efficiencyValue - a.efficiencyValue || b.spend - a.spend;
    }
    return b.spend - a.spend;
  });
}

function buildBreakdownDiagnosis(input: {
  rows: BreakdownChartRow[];
  dimensionLabel: string;
  resultLabel: string;
  language: "en" | "vi";
  selectedDimension: BreakdownDimension;
}) {
  const { rows, dimensionLabel, resultLabel, language, selectedDimension } = input;
  const totalResults = rows.reduce((sum, row) => sum + row.results, 0);
  const warning = [...rows]
    .filter((row) => row.tone === "warning")
    .sort((a, b) => b.allocationGap - a.allocationGap || b.spend - a.spend)[0];
  const opportunity = [...rows]
    .filter((row) => row.tone === "positive")
    .sort((a, b) => Math.abs(b.allocationGap) - Math.abs(a.allocationGap) || b.results - a.results)[0];
  const confidenceLabel = breakdownConfidence(rows.length, totalResults, language);
  const dataCaveat = selectedDimension === "age" || selectedDimension === "gender"
    ? language === "vi"
      ? "Tuổi và giới tính được gộp lại từ breakdown age+gender của Meta; dùng như tín hiệu định hướng."
      : "Age and gender are derived from Meta age+gender rows; treat them as directional."
    : null;

  if (!rows.length) {
    return {
      insightTone: "insufficient" as BreakdownInsightTone,
      topInsight: language === "vi" ? `Chưa có dữ liệu ${dimensionLabel}.` : `No usable ${dimensionLabel} breakdown data.`,
      recommendedAction: language === "vi" ? "Kéo thêm dữ liệu hoặc chọn dimension khác trước khi ra quyết định." : "Pull more data or switch dimension before making an allocation decision.",
      confidenceLabel,
      dataCaveat,
    };
  }

  if (warning) {
    return {
      insightTone: "warning" as BreakdownInsightTone,
      topInsight: language === "vi"
        ? `${warning.label} chiếm ${formatPct(warning.spendShare)} chi tiêu nhưng chỉ tạo ${formatPct(warning.resultShare)} ${resultLabel}.`
        : `${warning.label} owns ${formatPct(warning.spendShare)} of spend but only ${formatPct(warning.resultShare)} of ${resultLabel}.`,
      recommendedAction: language === "vi"
        ? `Giảm hoặc kiểm tra ${warning.label}; ưu tiên chuyển ngân sách sang phân khúc có chi phí/kết quả thấp hơn.`
        : `Reduce or inspect ${warning.label}; favor segments with lower cost per result before scaling.`,
      confidenceLabel,
      dataCaveat,
    };
  }

  if (opportunity) {
    return {
      insightTone: "positive" as BreakdownInsightTone,
      topInsight: language === "vi"
        ? `${opportunity.label} tạo ${formatPct(opportunity.resultShare)} ${resultLabel} với ${formatPct(opportunity.spendShare)} chi tiêu.`
        : `${opportunity.label} produces ${formatPct(opportunity.resultShare)} of ${resultLabel} with ${formatPct(opportunity.spendShare)} of spend.`,
      recommendedAction: language === "vi"
        ? `Giữ ${opportunity.label} và test tăng ngân sách nhỏ trước khi scale rộng.`
        : `Protect ${opportunity.label} and test a small budget increase before scaling wider.`,
      confidenceLabel,
      dataCaveat,
    };
  }

  return {
    insightTone: "neutral" as BreakdownInsightTone,
    topInsight: language === "vi"
      ? `Chi tiêu và ${resultLabel} đang khá cân bằng theo ${dimensionLabel}.`
      : `Spend and ${resultLabel} are broadly aligned by ${dimensionLabel}.`,
    recommendedAction: language === "vi"
      ? "Không đổi ngân sách chỉ vì breakdown này; hãy ưu tiên tín hiệu creative, ad set và pacing."
      : "Do not change budget from this breakdown alone; prioritize creative, ad set, and pacing signals.",
    confidenceLabel,
    dataCaveat,
  };
}

function breakdownConfidence(rowCount: number, totalResults: number, language: "en" | "vi") {
  if (rowCount >= 3 && totalResults >= 10) return language === "vi" ? "Độ tin cậy cao" : "High confidence";
  if (rowCount >= 2 && totalResults > 0) return language === "vi" ? "Độ tin cậy vừa" : "Medium confidence";
  return language === "vi" ? "Độ tin cậy thấp" : "Low confidence";
}

function primaryResultLabel(pack: KpiPack, language: "en" | "vi") {
  if (language === "vi") {
    if (pack === "messages") return "tin nhắn";
    if (pack === "sales_roas") return "purchase";
    if (pack === "traffic") return "link click";
    if (pack === "awareness") return "impression";
    return "lead";
  }
  if (pack === "messages") return "messages";
  if (pack === "sales_roas") return "purchases";
  if (pack === "traffic") return "link clicks";
  if (pack === "awareness") return "impressions";
  return "leads";
}

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`;
}
