import type { InterfaceLanguage, NormalizedRow } from "@/lib/types";
import type { ChartKey } from "@/lib/chart-spec";

export type AnomalyDirection = "up" | "down";
export type AnomalySeverity = "info" | "warning" | "danger";

export type BaselineAnomaly = {
  key: ChartKey;
  label: { en: string; vi: string };
  direction: AnomalyDirection;
  severity: AnomalySeverity;
  recentMean: number;
  baselineMean: number;
  changePct: number;
  zScore: number;
};

export type BaselineAnomalyResult = {
  status: "anomalies_found" | "stable" | "insufficient_data";
  anomalies: BaselineAnomaly[];
  summary: { en: string; vi: string };
  windowDays: { recent: number; baseline: number };
};

const RECENT_WINDOW = 7;
const MIN_BASELINE_DAYS = 14;
const WARNING_Z = 1.5;
const DANGER_Z = 2.5;
const MIN_CHANGE_PCT = 10;
const MAX_ANOMALIES = 5;

const METRIC_LABELS: Record<string, { en: string; vi: string }> = {
  spend: { en: "Spend", vi: "Chi tiêu" },
  impressions: { en: "Impressions", vi: "Hiển thị" },
  reach: { en: "Reach", vi: "Tiếp cận" },
  ctr: { en: "CTR", vi: "CTR" },
  cpc: { en: "CPC", vi: "CPC" },
  cpm: { en: "CPM", vi: "CPM" },
  cpl: { en: "CPL", vi: "CPL" },
  roas: { en: "ROAS", vi: "ROAS" },
  frequency: { en: "Frequency", vi: "Tần suất" },
  leads: { en: "Leads", vi: "Lead" },
  messages: { en: "Messages", vi: "Tin nhắn" },
  purchases: { en: "Purchases", vi: "Đơn hàng" },
  linkClicks: { en: "Link clicks", vi: "Click link" },
  costPerMessage: { en: "Cost/msg", vi: "Chi phí/tin nhắn" },
  costPerReply: { en: "Cost/reply", vi: "Chi phí/phản hồi" },
  cpaPurchase: { en: "CPA purchase", vi: "CPA đơn" },
};

const TRACKED_METRICS: ChartKey[] = [
  "cpm",
  "cpc",
  "ctr",
  "cpl",
  "roas",
  "frequency",
  "costPerMessage",
  "cpaPurchase",
];

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const sumSq = values.reduce((sum, v) => sum + (v - avg) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

function metricValues(rows: NormalizedRow[], key: ChartKey): number[] {
  return rows.map((row) => Number(row[key] || 0)).filter((v) => v > 0);
}

function classifySeverity(z: number): AnomalySeverity {
  if (Math.abs(z) >= DANGER_Z) return "danger";
  if (Math.abs(z) >= WARNING_Z) return "warning";
  return "info";
}

/** Higher-is-better metrics: a drop is danger, a rise is info. For cost metrics it's the reverse. */
const HIGHER_IS_BETTER = new Set<ChartKey>(["ctr", "roas", "leads", "messages", "purchases", "linkClicks"]);

function adjustSeverityForDirection(baseSeverity: AnomalySeverity, key: ChartKey, direction: AnomalyDirection): AnomalySeverity {
  if (baseSeverity === "info") return "info";
  const goodDirection = HIGHER_IS_BETTER.has(key) ? "up" : "down";
  if (direction === goodDirection) return "info";
  return baseSeverity;
}

export function detectBaselineAnomalies(dailyRows: NormalizedRow[]): BaselineAnomalyResult {
  const dated = dailyRows
    .filter((row) => Boolean(row.date))
    .slice()
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));

  const totalDays = dated.length;
  const recentDays = Math.min(RECENT_WINDOW, Math.floor(totalDays / 3));

  if (totalDays < MIN_BASELINE_DAYS + recentDays) {
    return {
      status: "insufficient_data",
      anomalies: [],
      summary: {
        en: `Need at least ${MIN_BASELINE_DAYS + recentDays} days of data for baseline anomaly detection.`,
        vi: `Cần tối thiểu ${MIN_BASELINE_DAYS + recentDays} ngày dữ liệu để phát hiện bất thường so với baseline.`,
      },
      windowDays: { recent: 0, baseline: 0 },
    };
  }

  const recentRows = dated.slice(totalDays - recentDays);
  const baselineRows = dated.slice(0, totalDays - recentDays);

  const anomalies: BaselineAnomaly[] = [];

  for (const key of TRACKED_METRICS) {
    const baselineValues = metricValues(baselineRows, key);
    const recentValues = metricValues(recentRows, key);

    if (baselineValues.length < 7 || recentValues.length < 3) continue;

    const baselineMean = mean(baselineValues);
    const baselineStd = stdDev(baselineValues, baselineMean);
    const recentMean = mean(recentValues);

    if (baselineMean === 0) continue;

    const changePct = ((recentMean - baselineMean) / baselineMean) * 100;
    if (Math.abs(changePct) < MIN_CHANGE_PCT) continue;

    const zScore = baselineStd === 0 ? (recentMean === baselineMean ? 0 : WARNING_Z * Math.sign(recentMean - baselineMean)) : (recentMean - baselineMean) / baselineStd;

    if (Math.abs(zScore) < WARNING_Z) continue;

    const direction: AnomalyDirection = recentMean > baselineMean ? "up" : "down";
    const rawSeverity = classifySeverity(zScore);
    const severity = adjustSeverityForDirection(rawSeverity, key, direction);

    if (severity === "info") continue;

    anomalies.push({
      key,
      label: METRIC_LABELS[key] || { en: key, vi: key },
      direction,
      severity,
      recentMean: Math.round(recentMean * 100) / 100,
      baselineMean: Math.round(baselineMean * 100) / 100,
      changePct: Math.round(changePct * 10) / 10,
      zScore: Math.round(zScore * 100) / 100,
    });
  }

  const ranked = anomalies
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, MAX_ANOMALIES);

  if (!ranked.length) {
    return {
      status: "stable",
      anomalies: [],
      summary: {
        en: `The last ${recentDays} days are within normal range of the prior ${baselineRows.length}-day baseline.`,
        vi: `${recentDays} ngày gần nhất nằm trong phạm vi bình thường so với baseline ${baselineRows.length} ngày trước đó.`,
      },
      windowDays: { recent: recentDays, baseline: baselineRows.length },
    };
  }

  const dangerCount = ranked.filter((a) => a.severity === "danger").length;
  return {
    status: "anomalies_found",
    anomalies: ranked,
    summary: {
      en: `${ranked.length} metric${ranked.length > 1 ? "s" : ""} drifting from the ${baselineRows.length}-day baseline${dangerCount > 0 ? ` (${dangerCount} critical)` : ""}.`,
      vi: `${ranked.length} chỉ số lệch khỏi baseline ${baselineRows.length} ngày${dangerCount > 0 ? ` (${dangerCount} nghiêm trọng)` : ""}.`,
    },
    windowDays: { recent: recentDays, baseline: baselineRows.length },
  };
}

export function anomalyBadgeText(anomaly: BaselineAnomaly, language: InterfaceLanguage): string {
  const arrow = anomaly.direction === "up" ? "↑" : "↓";
  return `${anomaly.label[language]} ${arrow}${Math.abs(anomaly.changePct).toFixed(0)}%`;
}
