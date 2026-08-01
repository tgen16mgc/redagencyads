import type { DashboardReport, KpiPack, NormalizedRow, OutcomeMetricKey } from "@/lib/types";

export type CreativePreviewAsset = NonNullable<DashboardReport["adsetPreviews"]>[number]["ads"][number];

export type CreativeComparisonVerdict = {
  winner: "control" | "challenger" | "tie" | "insufficient";
  title: string;
  detail: string;
  resultLabel: string;
  costLabel: string;
  resultKey: keyof NormalizedRow;
  costKey: keyof NormalizedRow;
  controlResult: number | null;
  challengerResult: number | null;
  controlCost: number | null;
  challengerCost: number | null;
};

export function resolveCreativePreview(report: DashboardReport, row: NormalizedRow): CreativePreviewAsset | null {
  const ads = report.adsetPreviews?.flatMap((adset) => adset.ads) || [];
  const id = row.adId || row.id;
  return ads.find((ad) => ad.id === id)
    || ads.find((ad) => ad.adsetId === row.adsetId && ad.name === (row.adName || row.name))
    || null;
}

export function metaPreviewImageSrc(url: string) {
  return `/api/meta/ad-preview-image?url=${encodeURIComponent(url)}`;
}

export function buildCreativeComparisonVerdict(control: NormalizedRow, challenger: NormalizedRow, pack: KpiPack, currencyCode: string): CreativeComparisonVerdict {
  const metric = creativeMetric(pack);
  const controlTracked = creativeMetricIsTracked(control, metric.resultKey);
  const challengerTracked = creativeMetricIsTracked(challenger, metric.resultKey);
  const controlRawResult = Number(control[metric.resultKey] || 0);
  const challengerRawResult = Number(challenger[metric.resultKey] || 0);
  const controlResult = controlTracked ? controlRawResult : null;
  const challengerResult = challengerTracked ? challengerRawResult : null;
  const controlCost = controlTracked && controlRawResult > 0 ? Number(control[metric.costKey] || control.spend / controlRawResult) : null;
  const challengerCost = challengerTracked && challengerRawResult > 0 ? Number(challenger[metric.costKey] || challenger.spend / challengerRawResult) : null;
  const base = { ...metric, controlResult, challengerResult, controlCost, challengerCost };

  if (!controlTracked || !challengerTracked) {
    return {
      ...base,
      winner: "insufficient",
      title: `${metric.resultLabel} tracking is incomplete`,
      detail: `Keep Creative 1 as the control until ${metric.resultLabel.toLowerCase()} is tracked for both selected creatives. CTR and delivery metrics remain directional, not a scaling verdict.`,
    };
  }

  if (controlRawResult <= 0 && challengerRawResult <= 0) {
    return {
      ...base,
      winner: "insufficient",
      title: `No observed ${metric.resultLabel.toLowerCase()}`,
      detail: `Neither selected creative produced a tracked ${metric.resultLabel.toLowerCase()} in this period. Keep Creative 1 as the control and collect more outcome data before promoting a winner.`,
    };
  }

  if (controlRawResult > 0 && challengerRawResult <= 0) {
    return winnerVerdict("control", control, challenger, currencyCode, base);
  }
  if (challengerRawResult > 0 && controlRawResult <= 0) {
    return winnerVerdict("challenger", control, challenger, currencyCode, base);
  }

  const costDifference = Math.abs((controlCost || 0) - (challengerCost || 0));
  const costBaseline = Math.max(Math.min(controlCost || 0, challengerCost || 0), 1);
  if (costDifference / costBaseline < 0.05) {
    return {
      ...base,
      winner: "tie",
      title: "No decisive efficiency winner",
      detail: `${metric.costLabel} is within 5% for the selected pair. Keep Creative 1 as the control and use a longer evidence window before changing the control.`,
    };
  }

  return winnerVerdict((controlCost || Infinity) < (challengerCost || Infinity) ? "control" : "challenger", control, challenger, currencyCode, base);
}

function winnerVerdict(
  winner: "control" | "challenger",
  control: NormalizedRow,
  challenger: NormalizedRow,
  currencyCode: string,
  base: Omit<CreativeComparisonVerdict, "winner" | "title" | "detail">,
): CreativeComparisonVerdict {
  const winnerRow = winner === "control" ? control : challenger;
  const winnerCost = winner === "control" ? base.controlCost : base.challengerCost;
  const loserCost = winner === "control" ? base.challengerCost : base.controlCost;
  const costDelta = winnerCost !== null && loserCost !== null && loserCost > 0 ? ((loserCost - winnerCost) / loserCost) * 100 : null;
  const role = winner === "control" ? "Creative 1 remains the control" : "Creative 2 should replace the control";
  const costEvidence = winnerCost === null
    ? `${base.resultLabel} is the only tracked outcome in the pair`
    : `${base.costLabel} is ${formatCurrency(winnerCost, currencyCode)}${costDelta === null ? "" : `, ${costDelta.toFixed(0)}% lower than the other creative`}`;
  return {
    ...base,
    winner,
    title: role,
    detail: `${winnerRow.name} wins this selected comparison because ${costEvidence}. CTR is ${winnerRow.ctr.toFixed(2)}%; keep unavailable metrics explicit before scaling.`,
  };
}

function creativeMetric(pack: KpiPack) {
  if (pack === "sales_roas") return { resultKey: "purchases" as const, costKey: "cpaPurchase" as const, resultLabel: "Purchases", costLabel: "CPA" };
  if (pack === "lead_gen") return { resultKey: "leads" as const, costKey: "cpl" as const, resultLabel: "Leads", costLabel: "CPL" };
  if (pack === "messages") return { resultKey: "messages" as const, costKey: "costPerMessage" as const, resultLabel: "Messages", costLabel: "Cost / message" };
  if (pack === "traffic") return { resultKey: "linkClicks" as const, costKey: "cpc" as const, resultLabel: "Link clicks", costLabel: "CPC" };
  return { resultKey: "reach" as const, costKey: "cpm" as const, resultLabel: "Reach", costLabel: "CPM" };
}

function creativeMetricIsTracked(row: NormalizedRow, resultKey: keyof NormalizedRow) {
  if (resultKey === "messages" || resultKey === "leads" || resultKey === "purchases") {
    return row.metricAvailability?.[resultKey as OutcomeMetricKey] !== "not_tracked";
  }
  return true;
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
    notation: Math.abs(value) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
