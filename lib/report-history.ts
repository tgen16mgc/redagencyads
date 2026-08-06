import type { AiInsightTable, DashboardReport, Verdict } from "@/lib/types";

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
