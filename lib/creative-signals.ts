import type { NormalizedRow } from "@/lib/types";

export const FATIGUE_FREQUENCY_THRESHOLD = 3;

export type CreativeSignals = {
  fatigueCount: number;
  totalCreatives: number;
  concentration: number;
  concentrationStatus: "balanced" | "watch" | "concentrated";
  topSpendShareCount: number;
};

/**
 * Share of spend held by the top `count` creatives, as a percentage.
 *
 * Returns 0 rather than NaN when nothing has spent yet, so the panel shows a
 * real 0% instead of an empty metric.
 */
export function spendConcentration(rows: NormalizedRow[], count = 2) {
  const totalSpend = rows.reduce((sum, row) => sum + Math.max(row.spend, 0), 0);
  if (totalSpend <= 0) return 0;
  const topSpend = [...rows]
    .sort((left, right) => right.spend - left.spend)
    .slice(0, count)
    .reduce((sum, row) => sum + Math.max(row.spend, 0), 0);
  return (topSpend / totalSpend) * 100;
}

export function concentrationStatus(concentration: number): CreativeSignals["concentrationStatus"] {
  if (concentration >= 65) return "concentrated";
  if (concentration >= 45) return "watch";
  return "balanced";
}

/**
 * Creatives at or above the fatigue frequency threshold.
 *
 * The panel previously described this as "frequency above account norm" while
 * actually comparing against a fixed threshold. Keep the threshold explicit so
 * the label and the maths agree.
 */
export function fatiguedCreatives(rows: NormalizedRow[]) {
  return rows.filter((row) => row.frequency >= FATIGUE_FREQUENCY_THRESHOLD);
}

export function buildCreativeSignals(rows: NormalizedRow[], topSpendShareCount = 2): CreativeSignals {
  const concentration = spendConcentration(rows, topSpendShareCount);
  return {
    fatigueCount: fatiguedCreatives(rows).length,
    totalCreatives: rows.length,
    concentration,
    concentrationStatus: concentrationStatus(concentration),
    topSpendShareCount,
  };
}
