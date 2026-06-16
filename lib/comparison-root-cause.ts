import type { DashboardReport, NormalizedRow } from "@/lib/types";

export type ComparisonRootCauseStatus = "drivers_found" | "no_clear_driver" | "insufficient_data";
export type ComparisonRootCauseDirection = "positive" | "negative";
export type ComparisonRootCauseMetric = "leads" | "messages" | "purchases" | "linkClicks" | "cpl" | "cpc" | "costPerMessage" | "cpaPurchase" | "roas";

export type ComparisonRootCauseDriver = {
  rowId: string;
  rowName: string;
  rowLevel: NormalizedRow["level"];
  direction: ComparisonRootCauseDirection;
  primaryMetric: ComparisonRootCauseMetric;
  score: number;
  evidence: string[];
  action: { en: string; vi: string };
};

export type ComparisonRootCauseAnalysis = {
  status: ComparisonRootCauseStatus;
  summary: { en: string; vi: string };
  drivers: ComparisonRootCauseDriver[];
};

type MetricChange = {
  metric: ComparisonRootCauseMetric | "spend" | "ctr" | "frequency";
  current: number;
  previous: number;
  changePct: number | null;
};

function pctChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function formatPct(value: number) {
  return `${Math.abs(value).toFixed(0)}%`;
}

function labelMetric(metric: MetricChange["metric"]) {
  if (metric === "cpl") return "CPL";
  if (metric === "cpc") return "CPC";
  if (metric === "costPerMessage") return "Cost/message";
  if (metric === "cpaPurchase") return "CPA purchase";
  if (metric === "roas") return "ROAS";
  if (metric === "ctr") return "CTR";
  return metric.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function evidenceLine(change: MetricChange) {
  if (change.changePct === null) return null;
  return `${labelMetric(change.metric)} ${change.changePct >= 0 ? "up" : "down"} ${formatPct(change.changePct)}`;
}

function resultMetric(pack: DashboardReport["selectedPack"]): ComparisonRootCauseMetric {
  if (pack === "messages") return "messages";
  if (pack === "sales_roas") return "purchases";
  if (pack === "traffic") return "linkClicks";
  return "leads";
}

function efficiencyMetric(pack: DashboardReport["selectedPack"]): ComparisonRootCauseMetric {
  if (pack === "messages") return "costPerMessage";
  if (pack === "sales_roas") return "roas";
  if (pack === "traffic") return "cpc";
  return "cpl";
}

function metricChange(current: NormalizedRow, previous: NormalizedRow, metric: MetricChange["metric"]): MetricChange {
  return {
    metric,
    current: Number(current[metric as keyof NormalizedRow] || 0),
    previous: Number(previous[metric as keyof NormalizedRow] || 0),
    changePct: pctChange(Number(current[metric as keyof NormalizedRow] || 0), Number(previous[metric as keyof NormalizedRow] || 0)),
  };
}

function comparableRows(current: DashboardReport, previous: DashboardReport) {
  const currentRows = current.adsetRows.length > 0 ? current.adsetRows : current.campaignRows;
  const previousRows = previous.adsetRows.length > 0 ? previous.adsetRows : previous.campaignRows;
  const previousById = new Map(previousRows.map((row) => [row.id, row]));

  return currentRows.flatMap((currentRow) => {
    const previousRow = previousById.get(currentRow.id);
    return previousRow ? [{ currentRow, previousRow }] : [];
  });
}

function buildDriver(current: DashboardReport, currentRow: NormalizedRow, previousRow: NormalizedRow): ComparisonRootCauseDriver | null {
  const result = resultMetric(current.selectedPack);
  const efficiency = efficiencyMetric(current.selectedPack);
  const resultChange = metricChange(currentRow, previousRow, result);
  const efficiencyChange = metricChange(currentRow, previousRow, efficiency);
  const spendChange = metricChange(currentRow, previousRow, "spend");
  const ctrChange = metricChange(currentRow, previousRow, "ctr");
  const frequencyChange = metricChange(currentRow, previousRow, "frequency");

  const resultPct = resultChange.changePct ?? 0;
  const efficiencyPct = efficiencyChange.changePct ?? 0;
  const spendPct = spendChange.changePct ?? 0;
  const efficiencyImproved = efficiency === "roas" ? efficiencyPct >= 25 : efficiencyPct <= -25;
  const efficiencyWorsened = efficiency === "roas" ? efficiencyPct <= -25 : efficiencyPct >= 25;
  const resultGrew = resultPct >= 25;
  const resultFell = resultPct <= -25;
  const spendRose = spendPct >= 25;

  let direction: ComparisonRootCauseDirection | null = null;
  let primaryMetric: ComparisonRootCauseMetric = result;

  if ((resultGrew && efficiencyImproved) || (resultGrew && spendPct <= 50)) {
    direction = "positive";
    primaryMetric = result;
  } else if (efficiencyWorsened && (spendRose || resultFell)) {
    direction = "negative";
    primaryMetric = efficiency;
  } else if (resultFell && spendRose) {
    direction = "negative";
    primaryMetric = result;
  }

  if (!direction) return null;

  const evidence = [resultChange, efficiencyChange, spendChange, ctrChange, frequencyChange]
    .filter((change) => change.changePct !== null && Math.abs(change.changePct) >= 20)
    .map((change) => evidenceLine(change))
    .filter((line): line is string => Boolean(line));

  const score = evidence.reduce((sum, line) => {
    const match = line.match(/(\d+)%$/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);

  return {
    rowId: currentRow.id,
    rowName: currentRow.name,
    rowLevel: currentRow.level,
    direction,
    primaryMetric,
    score,
    evidence,
    action: direction === "positive"
      ? {
          en: "Inspect what changed here before scaling further.",
          vi: "Kiểm tra thay đổi ở nhóm này trước khi scale thêm.",
        }
      : {
          en: "Review budget, creative fatigue, and delivery quality for this row.",
          vi: "Rà soát ngân sách, fatigue creative và chất lượng delivery của dòng này.",
        },
  };
}

export function analyzeComparisonRootCauses(current: DashboardReport, previous: DashboardReport): ComparisonRootCauseAnalysis {
  const pairs = comparableRows(current, previous);

  if (pairs.length === 0) {
    return {
      status: "insufficient_data",
      summary: {
        en: "No matching campaign or ad set rows were found between periods.",
        vi: "Không có campaign hoặc ad set trùng nhau giữa hai kỳ.",
      },
      drivers: [],
    };
  }

  const drivers = pairs
    .map(({ currentRow, previousRow }) => buildDriver(current, currentRow, previousRow))
    .filter((driver): driver is ComparisonRootCauseDriver => Boolean(driver))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (drivers.length === 0) {
    return {
      status: "no_clear_driver",
      summary: {
        en: "Matched rows moved, but no single row crossed the root-cause threshold.",
        vi: "Các dòng trùng nhau có thay đổi, nhưng chưa có dòng nào vượt ngưỡng root-cause.",
      },
      drivers: [],
    };
  }

  return {
    status: "drivers_found",
    summary: {
      en: "These matched rows explain the clearest period-over-period movement.",
      vi: "Các dòng trùng nhau này giải thích biến động rõ nhất giữa hai kỳ.",
    },
    drivers,
  };
}
