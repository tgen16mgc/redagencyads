import { funnelRowKey, matchFunnelBaseline, funnelBreakdownRows, measureFunnelStage, type FunnelBreakdown } from "@/lib/funnel-analysis";
import type { PerformanceStageKey } from "@/lib/performance-stages";
import type { CompareMode, DashboardReport, NormalizedRow } from "@/lib/types";
import type { ExperimentDefinition, ExperimentMetric } from "@/lib/experiment-engine";

export type FunnelObservation = {
  scopeKey: string;
  accountId: string;
  accountName: string;
  source: "sample" | "meta_api";
  currency: string;
  scopeCampaigns?: string[];
  spend?: number;
  baselineSpend?: number | null;
  dates: DashboardReport["dateRange"];
  baselineDates: DashboardReport["dateRange"] | null;
  compareMode: CompareMode;
  stage: PerformanceStageKey;
  dimension: FunnelBreakdown;
  segment: { key: string; name: string } | null;
  current: ReturnType<typeof measureFunnelStage>;
  baseline: ReturnType<typeof measureFunnelStage> | null;
};
export type FunnelBriefDraft = { hypothesis: string; change: string; guardrails: string; metric: ExperimentMetric };
export type FunnelTestBrief = { version: 1; id: string; createdAt: string; observation: FunnelObservation; draft: FunnelBriefDraft };

export function funnelScopeKey(report: DashboardReport, previous: DashboardReport | null, compareMode: CompareMode) {
  const scope = (value: DashboardReport) => [value.account.id, value.account.currency, value.source, value.dateRange.since, value.dateRange.until, value.selectedPack, value.selectedCampaigns.map(item => item.id).sort()];
  return JSON.stringify([scope(report), compareMode, compareMode !== "off" && previous ? scope(previous) : null]);
}

export function buildFunnelObservation(report: DashboardReport, previous: DashboardReport | null, compareMode: CompareMode, stage: PerformanceStageKey, dimension: FunnelBreakdown, row: NormalizedRow | null, segmentName?: string): FunnelObservation {
  const comparable = compareMode !== "off" && previous?.account.id === report.account.id && previous.account.currency === report.account.currency ? previous : null;
  const priorRow = row ? comparable ? matchFunnelBaseline(row, funnelBreakdownRows(comparable, dimension), dimension) : null : comparable?.totals ?? null;
  return {
    scopeKey: funnelScopeKey(report, comparable, compareMode), accountId: report.account.id, accountName: report.account.name,
    source: report.source === "sample" ? "sample" : "meta_api", currency: report.account.currency || "VND",
    scopeCampaigns: report.selectedCampaigns.map(campaign => campaign.name), spend: (row ?? report.totals).spend, baselineSpend: priorRow?.spend ?? null,
    dates: { ...report.dateRange }, baselineDates: comparable ? { ...comparable.dateRange } : null, compareMode,
    stage, dimension, segment: row ? { key: funnelRowKey(row, dimension) ?? row.id, name: segmentName ?? row.name } : null,
    current: measureFunnelStage(row ?? report.totals, stage), baseline: priorRow ? measureFunnelStage(priorRow, stage) : null,
  };
}

export type FunnelPlannerDraft = { version: 1; briefId: string; definition: ExperimentDefinition; dailyUnits: number; measurementDefinition: string };

export function parseFunnelPlannerDraft(raw: string | null, briefId: string): FunnelPlannerDraft | null {
  if (!raw || raw.length > 100_000) return null;
  try {
    const data = JSON.parse(raw);
    const definition = data?.definition;
    if (data?.version !== 1 || data.briefId !== briefId || typeof data.measurementDefinition !== "string" || !Number.isFinite(data.dailyUnits) || !definition) return null;
    if (!["id", "hypothesis", "layer"].every(key => typeof definition[key] === "string") || !Array.isArray(definition.guardrails) || !definition.guardrails.every((item: unknown) => typeof item === "string")) return null;
    if (!["baselineRate", "minimumDetectableEffect", "confidence", "power", "trafficAllocation"].every(key => typeof definition[key] === "number" && Number.isFinite(definition[key]))) return null;
    if (definition.baselineStandardDeviation !== undefined && (typeof definition.baselineStandardDeviation !== "number" || !Number.isFinite(definition.baselineStandardDeviation))) return null;
    if (!["cpa", "roas", "ctr", "conversion_rate", "cost_per_lead"].includes(definition.metric) || !["user", "geo"].includes(definition.assignmentUnit)) return null;
    return data;
  } catch { return null; }
}

export function defaultFunnelBriefMetric(pack: DashboardReport["selectedPack"]): ExperimentMetric {
  return pack === "sales_roas" ? "roas" : pack === "lead_gen" ? "cost_per_lead" : pack === "traffic" ? "ctr" : pack === "messages" ? "cpa" : "conversion_rate";
}

// The measurement itself is part of draft identity, so refreshed evidence cannot silently inherit a different finding's explanation.
export function funnelObservationKey(observation: FunnelObservation) {
  return JSON.stringify([observation.scopeKey, observation.stage, observation.dimension, observation.segment?.key, observation.current, observation.baseline]);
}

export function parseFunnelBriefs(raw: string | null, scopeKey: string): FunnelTestBrief[] {
  if (!raw) return [];
  try {
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry): entry is FunnelTestBrief => {
      if (!entry || typeof entry !== "object") return false;
      const { version, id, createdAt, observation, draft } = entry;
      const validMeasure = (measure: unknown) => !!measure && typeof measure === "object" && "metric" in measure && typeof measure.metric === "string" && ["value", "denominator", "rate", "cost"].every(key => key in measure && (Reflect.get(measure, key) === null || typeof Reflect.get(measure, key) === "number" && Number.isFinite(Reflect.get(measure, key))));
      return version === 1 && typeof id === "string" && typeof createdAt === "string" && Number.isFinite(Date.parse(createdAt)) &&
        observation?.scopeKey === scopeKey && typeof observation.accountName === "string" && typeof observation.currency === "string" &&
        (observation.scopeCampaigns === undefined || Array.isArray(observation.scopeCampaigns) && observation.scopeCampaigns.every((name: unknown) => typeof name === "string")) &&
        (observation.spend === undefined || typeof observation.spend === "number" && Number.isFinite(observation.spend)) &&
        (observation.baselineSpend == null || typeof observation.baselineSpend === "number" && Number.isFinite(observation.baselineSpend)) &&
        typeof observation.dates?.since === "string" && typeof observation.dates?.until === "string" &&
        (!observation.baselineDates || typeof observation.baselineDates.since === "string" && typeof observation.baselineDates.until === "string") &&
        (!observation.segment || typeof observation.segment.name === "string") && validMeasure(observation.current) && (observation.baseline === null || validMeasure(observation.baseline)) &&
        !!draft && ["hypothesis", "change", "guardrails"].every(key => typeof draft[key] === "string") && ["cpa", "roas", "ctr", "conversion_rate", "cost_per_lead"].includes(draft.metric);
    }).slice(0, 8);
  } catch { return []; }
}
