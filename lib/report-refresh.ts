import type { DashboardReport, KpiPack } from "@/lib/types";

export type CurrentReportScope = {
  selectedCampaignIds: string[];
  since: string;
  until: string;
  pack: KpiPack;
};

export function currentReportScope(report: DashboardReport): CurrentReportScope {
  return {
    selectedCampaignIds: report.selectedCampaigns.map((campaign) => campaign.id),
    since: report.dateRange.since,
    until: report.dateRange.until,
    pack: report.selectedPack,
  };
}

export function reportCampaignSelectionForAccount(
  accountId: string,
  report: DashboardReport | null,
) {
  return report?.account.id === accountId
    ? report.selectedCampaigns.map((campaign) => campaign.id)
    : [];
}
