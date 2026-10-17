import { stageContributorBasis } from "@/lib/performance-display";
import type { PerformanceStage, PerformanceStageKey } from "@/lib/performance-stages";
import type { DashboardReport, InterfaceLanguage, KpiPack, NormalizedRow, OutcomeMetricKey } from "@/lib/types";

type CountKey = "impressions" | "reach" | "linkClicks" | OutcomeMetricKey;

// These are aggregate event ratios with explicit denominators, not user cohorts.
const denominators: Partial<Record<PerformanceStageKey, CountKey>> = {
  traffic: "impressions", conversations: "linkClicks", lead: "linkClicks",
  replies: "messages", cart: "linkClicks", checkout: "addToCart", purchase: "initiateCheckout",
};

export function funnelMetricLabel(key: keyof NormalizedRow, language: InterfaceLanguage) {
  const labels: Partial<Record<keyof NormalizedRow, [string, string]>> = {
    impressions: ["Impressions", "Lượt hiển thị"], reach: ["Reach", "Tiếp cận"],
    linkClicks: ["Link clicks", "Click liên kết"], messages: ["Conversations", "Hội thoại"],
    replies: ["Replies", "Phản hồi"], leads: ["Leads", "Lead"], purchases: ["Purchases", "Mua hàng"],
    addToCart: ["Add to cart", "Thêm giỏ"], initiateCheckout: ["Checkouts", "Thanh toán"],
    frequency: ["Frequency", "Tần suất"],
  };
  return labels[key]?.[language === "vi" ? 1 : 0] ?? key;
}

function trackedCount(row: NormalizedRow, key: keyof NormalizedRow): number | null {
  const outcomes: string[] = ["messages", "replies", "leads", "purchases", "addToCart", "initiateCheckout"];
  const status = row.metricAvailability?.[key as OutcomeMetricKey];
  if (status === "not_tracked" || (outcomes.includes(key) && !status && !(Number(row[key]) > 0))) return null;
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function measureFunnelStage(row: NormalizedRow, key: PerformanceStageKey) {
  const metric = stageContributorBasis(key);
  const value = trackedCount(row, metric);
  const denominatorKey = denominators[key] ?? null;
  const denominator = denominatorKey ? trackedCount(row, denominatorKey) : null;
  const rate = value !== null && denominator !== null && denominator > 0 ? value / denominator * 100 : null;
  const cost = key === "saturation" || value === null || value <= 0 ? null : row.spend / value * (metric === "impressions" ? 1000 : 1);
  return { metric, value, denominatorKey, denominator, rate, cost };
}

export function funnelRateDelta(current: NormalizedRow, previous: NormalizedRow | null, key: PerformanceStageKey) {
  const rate = measureFunnelStage(current, key).rate;
  const prior = previous ? measureFunnelStage(previous, key).rate : null;
  return rate !== null && prior !== null ? rate - prior : null;
}

export function describeFunnelFocus(stages: PerformanceStage[], current: NormalizedRow, previous: NormalizedRow | null) {
  const missing = stages.find(stage => stage.availability === "not_tracked");
  if (missing) return { key: missing.key, reason: "tracking" as const, delta: null };
  const declines = stages.map(stage => ({ key: stage.key, measure: measureFunnelStage(current, stage.key), delta: funnelRateDelta(current, previous, stage.key) }))
    .filter(item => item.delta !== null && item.delta < -0.05 && (item.measure.denominator ?? 0) >= 30)
    .sort((a, b) => a.delta! - b.delta!);
  if (declines[0]) return { key: declines[0].key, reason: "decline" as const, delta: declines[0].delta };
  return { key: stages.find(stage => stage.tone === "warning")?.key ?? stages.at(-1)?.key ?? null, reason: "inspect" as const, delta: null };
}

export function modelStageTarget(value: number | null, denominator: number | null, targetRate: number) {
  if (value === null || denominator === null || denominator <= 0 || !Number.isFinite(targetRate) || targetRate < 0 || targetRate > 100) return null;
  return { total: denominator * targetRate / 100, additional: denominator * targetRate / 100 - value };
}

export function pickFunnelFocus(stages: PerformanceStage[], current: NormalizedRow, previous: NormalizedRow | null) {
  return describeFunnelFocus(stages, current, previous).key;
}

export function primaryFunnelStage(pack: KpiPack): PerformanceStageKey {
  return ({ messages: "conversations", lead_gen: "lead", sales_roas: "purchase", traffic: "traffic", awareness: "reach" } as const)[pack];
}

// A conservative display caution, never a statistical confidence assessment.
export function hasLowFunnelVolume(row: NormalizedRow, key: PerformanceStageKey) {
  if (key === "saturation") return false;
  const measure = measureFunnelStage(row, key);
  return measure.value !== null && (measure.value < 30 || (measure.denominator !== null && measure.denominator < 30));
}

export function defaultFunnelTarget(current: number | null, previous: number | null) {
  const validPrevious = previous !== null && previous <= 100 ? previous : 0;
  return Math.min(100, Math.ceil(Math.max(current ?? 0, validPrevious) * 100 - 1e-9) / 100);
}

export function funnelValueChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return { absolute: current - previous, relative: previous > 0 ? (current - previous) / previous * 100 : null };
}

export type FunnelBreakdown = "campaign" | "adset" | "ad" | "platform" | "region" | "ageGender" | "device";

export function funnelBreakdownRows(report: DashboardReport, dimension: FunnelBreakdown): NormalizedRow[] {
  return ({ campaign: report.campaignRows, adset: report.adsetRows, ad: report.adRows, platform: report.platformRows, region: report.regionRows, ageGender: report.ageGenderRows, device: [] })[dimension];
}

// API breakdown IDs can be index-based. Compare canonical dimension tuples, never names or array positions.
export function funnelRowKey(row: NormalizedRow, dimension: FunnelBreakdown): string | null {
  const clean = (value?: string) => value?.trim().normalize("NFC").toLowerCase() || null;
  if (dimension === "platform") return clean(row.platform) ? JSON.stringify([clean(row.platform), clean(row.placement)]) : null;
  if (dimension === "ageGender") return clean(row.age) && clean(row.gender) ? JSON.stringify([clean(row.age), clean(row.gender)]) : null;
  if (dimension === "region") return clean(row.region) ? JSON.stringify([clean(row.country), clean(row.region)]) : null;
  return dimension === "device" ? null : row.id || null;
}

export function matchFunnelBaseline(row: NormalizedRow, baseline: NormalizedRow[], dimension: FunnelBreakdown) {
  const key = funnelRowKey(row, dimension);
  if (key === null) return null;
  return indexFunnelRows(baseline, dimension).get(key) ?? null;
}

export function indexFunnelRows(rows: NormalizedRow[], dimension: FunnelBreakdown) {
  const index = new Map<string, NormalizedRow | null>();
  for (const row of rows) {
    const key = funnelRowKey(row, dimension);
    if (key !== null) index.set(key, index.has(key) ? null : row);
  }
  return index;
}

export function funnelRowLabel(row: NormalizedRow, dimension: FunnelBreakdown, language: InterfaceLanguage) {
  if (dimension === "platform") return [row.platform, row.placement].filter(Boolean).join(" · ") || row.name;
  if (dimension === "region") return [row.region, row.country].filter(Boolean).join(" · ") || row.name;
  if (dimension === "ageGender") {
    const gender = language === "vi" ? ({ female: "Nữ", male: "Nam", unknown: "Chưa rõ" } as Record<string, string>)[row.gender ?? ""] ?? row.gender : row.gender;
    return [row.age, gender].filter(Boolean).join(" · ") || row.name;
  }
  return row.name;
}
