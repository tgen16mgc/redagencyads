import { sumRows } from "@/lib/metric-aggregation";
import type { NormalizedRow } from "@/lib/types";

export type SegmentEfficiencyPoint = {
  row: NormalizedRow;
  label: string;
  efficiency: number;
  unitCost: number;
  left: number;
  bottom: number;
  tone: "primary" | "warning";
};

export function buildPlatformEfficiencyPoints(rows: NormalizedRow[], primaryKey: keyof NormalizedRow): SegmentEfficiencyPoint[] {
  const grouped = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    const key = row.platform?.trim();
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }

  const values = [...grouped.entries()].flatMap(([platform, platformRows]) => {
    const row = {
      ...sumRows(platformRows, platform),
      id: `platform:${platform}`,
      level: "breakdown" as const,
      name: platform,
      platform,
    };
    const result = Number(row[primaryKey] || 0);
    if (row.spend <= 0 || result <= 0 || !segmentMetricIsTracked(row, primaryKey)) return [];
    return [{
      row,
      label: segmentLabel(platform),
      efficiency: result / row.spend,
      unitCost: row.spend / result,
    }];
  }).sort((left, right) => right.row.spend - left.row.spend).slice(0, 6);

  const efficiencies = values.map((item) => item.efficiency);
  const unitCosts = values.map((item) => item.unitCost);
  const minEfficiency = efficiencies.length ? Math.min(...efficiencies) : 0;
  const maxEfficiency = efficiencies.length ? Math.max(...efficiencies) : 0;
  const minUnitCost = unitCosts.length ? Math.min(...unitCosts) : 0;
  const maxUnitCost = unitCosts.length ? Math.max(...unitCosts) : 0;
  const efficiencyRange = maxEfficiency - minEfficiency;
  const costRange = maxUnitCost - minUnitCost;
  const medianEfficiency = median(efficiencies);
  const medianCost = median(unitCosts);

  return values.map((item) => {
    const normalizedEfficiency = efficiencyRange > 0.000001 ? (item.efficiency - minEfficiency) / efficiencyRange : 0.5;
    const normalizedCost = costRange > 0.000001 ? (item.unitCost - minUnitCost) / costRange : 0.5;
    return {
      ...item,
      left: 14 + normalizedEfficiency * 72,
      bottom: 14 + normalizedCost * 72,
      tone: item.efficiency < medianEfficiency || item.unitCost > medianCost ? "warning" as const : "primary" as const,
    };
  });
}

function segmentMetricIsTracked(row: NormalizedRow, primaryKey: keyof NormalizedRow) {
  if (primaryKey === "messages" || primaryKey === "leads" || primaryKey === "purchases") {
    return row.metricAvailability?.[primaryKey] !== "not_tracked";
  }
  return primaryKey === "linkClicks" || primaryKey === "reach";
}

function segmentLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
