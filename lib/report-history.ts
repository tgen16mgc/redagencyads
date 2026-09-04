import type { AiInsightTable, DashboardReport, Verdict } from "@/lib/types";
import { creativeCoverageCopy } from "@/lib/metrics";
import { buildReportRequestKey, currentReportScope, type ReportExecutionScope } from "@/lib/report-refresh";

export type SavedReportSnapshot = {
  id: string;
  accountId: string;
  accountName: string;
  dateSince: string;
  dateUntil: string;
  selectedPack: string;
  report: DashboardReport;
  previousReport: DashboardReport | null;
  executionScope: ReportExecutionScope | null;
  scopeKey: string | null;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  updatedAt: string;
};

export function reportSnapshotKey(report: DashboardReport, executionScope?: ReportExecutionScope | null) {
  if (executionScope) return buildReportRequestKey(executionScope);
  return [
    report.account.id,
    report.dateRange.since,
    report.dateRange.until,
    report.selectedPack,
  ].join(":");
}

export function restoreSavedReportExecutionScope(input: {
  report: DashboardReport;
  previousReport: DashboardReport | null;
  executionScope?: ReportExecutionScope | null;
}) {
  if (input.executionScope) return input.executionScope;
  const currentIds = input.report.selectedCampaigns.map((campaign) => campaign.id).sort();
  const previousIds = input.previousReport?.selectedCampaigns.map((campaign) => campaign.id).sort() || [];
  const compareMode = !input.previousReport
    ? "off"
    : currentIds.join("\u0000") === previousIds.join("\u0000")
      ? "previous"
      : "campaign";
  return currentReportScope(input.report, {
    previousReport: input.previousReport,
    compareMode,
    targetCpa: "",
    targetRoas: "",
  });
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
