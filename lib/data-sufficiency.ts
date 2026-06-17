import type { NormalizedRow } from "@/lib/types";

export const SUFFICIENCY = {
  minRowImpressions: 1000,
  minRowSpend: 10,
  minFunnelClicks: 100,
  minDatedRows: 6,
  minBaselineDays: 14,
  minBaselineSample: 5,
} as const;

export function hasRowDelivery(row: NormalizedRow): boolean {
  return row.impressions >= SUFFICIENCY.minRowImpressions && row.spend >= SUFFICIENCY.minRowSpend;
}

export function hasFunnelClickVolume(totals: { linkClicks: number; addToCart: number; initiateCheckout: number; purchases: number }): boolean {
  return totals.linkClicks >= SUFFICIENCY.minFunnelClicks && (totals.addToCart > 0 || totals.initiateCheckout > 0 || totals.purchases > 0);
}

export function hasDatedHistory(count: number): boolean {
  return count >= SUFFICIENCY.minDatedRows;
}

export function hasBaselineHistory(baselineDays: number, recentWindow: number): boolean {
  return baselineDays >= SUFFICIENCY.minBaselineDays + recentWindow;
}
