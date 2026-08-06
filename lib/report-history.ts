import type { AiInsightTable, DashboardReport, Verdict } from "@/lib/types";
import { creativeCoverageCopy } from "@/lib/metrics";

export type SavedReportSnapshot = {
  id: string;
  accountId: string;
  accountName: string;
  dateSince: string;
  dateUntil: string;
  selectedPack: string;
  report: DashboardReport;
  previousReport: DashboardReport | null;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  updatedAt: string;
};

export function reportSnapshotKey(report: DashboardReport) {
  return [
    report.account.id,
    report.dateRange.since,
    report.dateRange.until,
    report.selectedPack,
  ].join(":");
}

export function normalizeSavedReportCopy(report: DashboardReport): DashboardReport {
  const creativeCoverage = creativeCoverageCopy(report.adRows.length);
  return {
    ...report,
    health: {
      ...report.health,
      checks: report.health.checks.map((check) => check.id === "M25"
        ? { ...check, label: creativeCoverage.label, detail: creativeCoverage.detail }
        : check),
    },
  };
}
