import type { DashboardReport, InterfaceLanguage, NormalizedRow, OutcomeMetricKey } from "@/lib/types";

export type DriverConcentration = {
  basis: "results" | "spend";
  count: number;
  share: number;
};

export function buildDriverConcentration(
  rows: NormalizedRow[],
  resultKey: keyof NormalizedRow,
  count = 3,
): DriverConcentration {
  const totalResults = rows.reduce((sum, row) => sum + Number(row[resultKey] || 0), 0);
  const basis = totalResults > 0 ? "results" : "spend";
  const value = (row: NormalizedRow) => basis === "results" ? Number(row[resultKey] || 0) : row.spend;
  const total = rows.reduce((sum, row) => sum + value(row), 0);
  const selectedCount = Math.min(count, rows.length);
  const selected = [...rows].sort((left, right) => value(right) - value(left)).slice(0, selectedCount);
  const selectedTotal = selected.reduce((sum, row) => sum + value(row), 0);
  return {
    basis,
    count: selectedCount,
    share: total > 0 ? (selectedTotal / total) * 100 : 0,
  };
}

export function evidenceCostLabel(pack: DashboardReport["selectedPack"], language: InterfaceLanguage) {
  if (pack === "sales_roas") return "CPA";
  if (pack === "lead_gen") return "CPL";
  if (pack === "messages") return language === "vi" ? "Chi phí/tin nhắn" : "Cost/message";
  if (pack === "traffic") return "CPC";
  return "CPM";
}

export function trackedOutcomeValue(
  row: NormalizedRow,
  key: OutcomeMetricKey,
  value: string,
  language: InterfaceLanguage,
) {
  return row.metricAvailability?.[key] === "not_tracked"
    ? (language === "vi" ? "Chưa theo dõi" : "Not tracked")
    : value;
}
