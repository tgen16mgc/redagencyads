import type { InterfaceLanguage, KpiPack, NormalizedRow } from "@/lib/types";
import { formatMetric } from "@/lib/metrics";

export type ChartKey =
  | "messages"
  | "replies"
  | "leads"
  | "purchases"
  | "linkClicks"
  | "clicks"
  | "impressions"
  | "reach"
  | "costPerMessage"
  | "costPerReply"
  | "cpl"
  | "cpaPurchase"
  | "cpc"
  | "cpm"
  | "roas"
  | "ctr"
  | "frequency";

export type ChartFormat = "number" | "currency" | "percent" | "ratio";

export type TrendAnnotation = {
  key: ChartKey;
  direction: "up" | "down";
  startValue: number;
  endValue: number;
  changePct: number;
  label: string;
};

export type PackChartSpec = {
  operatorQuestion: string;
  trendTitle: string;
  trendDescription: string;
  trendKeys: ChartKey[];
  efficiencyTitle: string;
  efficiencyDescription: string;
  efficiencyKeys: ChartKey[];
  diagnosticTitle: string;
  diagnosticDescription: string;
  diagnosticKeys: ChartKey[];
  referenceLine?: { value: number };
  drilldownTitle: string;
  drilldownDescription: string;
  drilldownKey: ChartKey;
  drilldownFormat: ChartFormat;
  higherIsBetter: boolean;
  metricFormats: Partial<Record<ChartKey, ChartFormat>>;
};

export function getPackChartSpec(pack: KpiPack, language: InterfaceLanguage = "en"): PackChartSpec {
  const isVietnamese = language === "vi";
  const shared = {
    diagnosticTitle: isVietnamese ? "Guardrail fatigue" : "Fatigue guardrail",
    diagnosticDescription: isVietnamese
      ? "Frequency cộng CTR là proxy nhanh cho fatigue. Fatigue thật cần xem CTR theo từng creative qua thời gian."
      : "Frequency plus CTR is a common quick fatigue proxy. True creative fatigue needs creative-level CTR drop over time.",
    diagnosticKeys: ["frequency", "ctr"] as ChartKey[],
    referenceLine: { value: 3 },
  };

  if (pack === "messages") {
    return {
      ...shared,
      operatorQuestion: isVietnamese ? "Tin nhắn có scale mà không vỡ chất lượng reply hoặc fatigue không?" : "Are message conversations scaling without reply quality or fatigue breaking?",
      trendTitle: isVietnamese ? "Xu hướng tin nhắn" : "Message trend",
      trendDescription: isVietnamese ? "Chi tiêu so với messages và replies, tín hiệu chính của campaign DM." : "Spend against messages and replies, the core signal for DM campaigns.",
      trendKeys: ["messages", "replies"],
      efficiencyTitle: isVietnamese ? "Chi phí tin nhắn" : "Message cost",
      efficiencyDescription: isVietnamese ? "Cost per message và reply drift. Xem trước khi scale." : "Cost per message and reply drift. Use this before scaling.",
      efficiencyKeys: ["costPerMessage", "costPerReply"],
      drilldownTitle: isVietnamese ? "Cost per message theo ad set" : "Ad set cost per message",
      drilldownDescription: isVietnamese ? "Ad set xếp theo cost per message, kèm chi tiêu." : "Ad sets ranked by cost per message, with spend beside it.",
      drilldownKey: "costPerMessage",
      drilldownFormat: "currency",
      higherIsBetter: false,
      metricFormats: { messages: "number", replies: "number", costPerMessage: "currency", costPerReply: "currency", frequency: "ratio", ctr: "percent" },
    };
  }

  if (pack === "sales_roas") {
    return {
      ...shared,
      operatorQuestion: isVietnamese ? "Chi tiêu có tạo purchase với ROAS đủ để scale không?" : "Is spend creating purchases at enough ROAS to scale?",
      trendTitle: isVietnamese ? "Xu hướng sales" : "Sales trend",
      trendDescription: isVietnamese ? "Chi tiêu so với purchases và ROAS. ROAS platform chỉ nên xem như tín hiệu định hướng." : "Spend against purchases and ROAS. Platform ROAS should still be treated as directional.",
      trendKeys: ["purchases", "roas"],
      efficiencyTitle: isVietnamese ? "Hiệu quả sales" : "Sales efficiency",
      efficiencyDescription: isVietnamese ? "CPA purchase và ROAS. Theo dõi CPA tăng sau khi đổi ngân sách." : "CPA purchase and ROAS. Watch for rising CPA after budget changes.",
      efficiencyKeys: ["cpaPurchase", "roas"],
      drilldownTitle: isVietnamese ? "ROAS theo ad set" : "Ad set ROAS",
      drilldownDescription: isVietnamese ? "Ad set xếp theo ROAS báo cáo, kèm chi tiêu." : "Ad sets ranked by reported ROAS, with spend beside it.",
      drilldownKey: "roas",
      drilldownFormat: "ratio",
      higherIsBetter: true,
      metricFormats: { purchases: "number", roas: "ratio", cpaPurchase: "currency", frequency: "ratio", ctr: "percent" },
    };
  }

  if (pack === "traffic") {
    return {
      ...shared,
      operatorQuestion: isVietnamese ? "Click có đủ rẻ mà CTR quality không sụp không?" : "Are clicks cheap enough without CTR quality collapsing?",
      trendTitle: isVietnamese ? "Xu hướng traffic" : "Traffic trend",
      trendDescription: isVietnamese ? "Chi tiêu so với link clicks và clicks. Dùng để thấy delivery rẻ nhưng intent thấp." : "Spend against link clicks and clicks. Useful for spotting cheap but low-intent delivery.",
      trendKeys: ["linkClicks", "clicks"],
      efficiencyTitle: isVietnamese ? "Chi phí traffic" : "Traffic cost",
      efficiencyDescription: isVietnamese ? "CPC và CPM drift. CTR được xem riêng cho quality." : "CPC and CPM drift. CTR is checked separately for quality.",
      efficiencyKeys: ["cpc", "cpm"],
      drilldownTitle: isVietnamese ? "CPC theo ad set" : "Ad set CPC",
      drilldownDescription: isVietnamese ? "Ad set xếp theo CPC, kèm chi tiêu." : "Ad sets ranked by CPC, with spend beside it.",
      drilldownKey: "cpc",
      drilldownFormat: "currency",
      higherIsBetter: false,
      metricFormats: { linkClicks: "number", clicks: "number", cpc: "currency", cpm: "currency", frequency: "ratio", ctr: "percent" },
    };
  }

  if (pack === "awareness") {
    return {
      operatorQuestion: isVietnamese ? "Reach có mở rộng trước khi CPM và frequency báo saturation không?" : "Is reach expanding before CPM and frequency show saturation?",
      trendTitle: isVietnamese ? "Xu hướng reach" : "Reach trend",
      trendDescription: isVietnamese ? "Chi tiêu so với reach và impressions. Awareness cần delivery scale và frequency được kiểm soát." : "Spend against reach and impressions. Awareness needs delivery scale plus controlled frequency.",
      trendKeys: ["reach", "impressions"],
      efficiencyTitle: isVietnamese ? "Chi phí awareness" : "Awareness cost",
      efficiencyDescription: isVietnamese ? "CPM và frequency. CPM tăng cùng frequency tăng thường báo saturation." : "CPM and frequency. Rising CPM with rising frequency usually signals saturation.",
      efficiencyKeys: ["cpm", "frequency"],
      diagnosticTitle: isVietnamese ? "Saturation delivery" : "Delivery saturation",
      diagnosticDescription: isVietnamese ? "Frequency cộng CTR là guardrail saturation. Awareness có frequency trên 4 nên được rà soát." : "Frequency plus CTR is a delivery saturation guardrail. Frequency over 4 deserves review for awareness campaigns.",
      diagnosticKeys: ["frequency", "ctr"],
      referenceLine: { value: 4 },
      drilldownTitle: isVietnamese ? "CPM theo ad set" : "Ad set CPM",
      drilldownDescription: isVietnamese ? "Ad set xếp theo CPM, kèm chi tiêu." : "Ad sets ranked by CPM, with spend beside it.",
      drilldownKey: "cpm",
      drilldownFormat: "currency",
      higherIsBetter: false,
      metricFormats: { reach: "number", impressions: "number", cpm: "currency", frequency: "ratio", ctr: "percent" },
    };
  }

  return {
    ...shared,
    operatorQuestion: isVietnamese ? "Lead có về với chi phí đáng để scale không?" : "Are leads coming in at a cost worth scaling?",
    trendTitle: isVietnamese ? "Xu hướng lead" : "Lead trend",
    trendDescription: isVietnamese ? "Chi tiêu so với leads và messages để thấy cả direct lead và funnel DM." : "Spend against leads and messages. This keeps both direct lead and DM-led funnels visible.",
    trendKeys: ["leads", "messages"],
    efficiencyTitle: isVietnamese ? "Chi phí lead" : "Lead cost",
    efficiencyDescription: isVietnamese ? "CPL và cost per message. Dùng cho check kill-rule 3x." : "CPL and cost per message. Use this for the 3x kill-rule check.",
    efficiencyKeys: ["cpl", "costPerMessage"],
    drilldownTitle: isVietnamese ? "CPL theo ad set" : "Ad set CPL",
    drilldownDescription: isVietnamese ? "Ad set xếp theo CPL, kèm chi tiêu." : "Ad sets ranked by CPL, with spend beside it.",
    drilldownKey: "cpl",
    drilldownFormat: "currency",
    higherIsBetter: false,
    metricFormats: { leads: "number", messages: "number", cpl: "currency", costPerMessage: "currency", frequency: "ratio", ctr: "percent" },
  };
}

export function metricValue(row: NormalizedRow, key: ChartKey) {
  return Number(row[key] || 0);
}

export function sortByDrilldown(a: NormalizedRow, b: NormalizedRow, key: ChartKey, higherIsBetter: boolean) {
  const left = metricValue(a, key);
  const right = metricValue(b, key);
  if (left === 0 && right === 0) return b.spend - a.spend;
  if (left === 0) return 1;
  if (right === 0) return -1;
  return higherIsBetter ? right - left : left - right;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function chartKeyLabel(key: ChartKey) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function detectTrendAnnotation(
  rows: NormalizedRow[],
  key: ChartKey,
  options: { minPoints?: number; minAbsChangePct?: number; minNonZeroPoints?: number } = {},
): TrendAnnotation | null {
  const minPoints = options.minPoints ?? 7;
  const minAbsChangePct = options.minAbsChangePct ?? 25;
  const minNonZeroPoints = options.minNonZeroPoints ?? 4;
  const values = rows.map((row) => metricValue(row, key)).filter((value) => Number.isFinite(value));

  if (values.length < minPoints || values.filter((value) => value > 0).length < minNonZeroPoints) return null;

  const windowSize = Math.min(3, Math.floor(values.length / 2));
  const startValue = average(values.slice(0, windowSize));
  const endValue = average(values.slice(-windowSize));

  if (startValue <= 0) return null;

  const changePct = ((endValue - startValue) / startValue) * 100;
  if (Math.abs(changePct) < minAbsChangePct) return null;

  const direction = changePct > 0 ? "up" : "down";
  return {
    key,
    direction,
    startValue,
    endValue,
    changePct,
    label: `${chartKeyLabel(key)} ${direction} ${Math.abs(changePct).toFixed(0)}%`,
  };
}

export function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

export function roundForFormat(value: number, format: ChartFormat) {
  if (format === "number" || format === "currency") return Math.round(value);
  return roundMetric(value);
}

export function formatChartValue(value: number, format: ChartFormat, currency: string) {
  return formatMetric(value, format, currency);
}

export function compactDate(date?: string) {
  if (!date) return "";
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[2])}/${Number(parts[1])}`;
}

export function truncateLabel(value: string) {
  return value.length > 22 ? `${value.slice(0, 19)}...` : value;
}
