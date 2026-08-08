import type { CompareMode, DashboardReport, KpiPack } from "@/lib/types";

export type CurrentReportScope = {
  accountId: string;
  selectedCampaignIds: string[];
  since: string;
  until: string;
  pack: KpiPack;
};

export type MetaReportRequestScope = Omit<CurrentReportScope, "pack"> & {
  pack: KpiPack | "auto";
};

export type ReportRequestKeyScope = MetaReportRequestScope & {
  compareMode: CompareMode;
};

export function currentReportScope(report: DashboardReport): CurrentReportScope {
  return {
    accountId: report.account.id,
    selectedCampaignIds: report.selectedCampaigns.map((campaign) => campaign.id),
    since: report.dateRange.since,
    until: report.dateRange.until,
    pack: report.selectedPack,
  };
}

export function buildMetaReportUrl(origin: string, scope: MetaReportRequestScope) {
  const url = new URL("/api/meta/report", origin);
  url.searchParams.set("accountId", scope.accountId);
  url.searchParams.set("since", scope.since);
  url.searchParams.set("until", scope.until);
  scope.selectedCampaignIds.forEach((id) => url.searchParams.append("campaignId", id));
  if (scope.pack !== "auto") url.searchParams.set("pack", scope.pack);
  return url.toString();
}

export function buildReportRequestKey(scope: ReportRequestKeyScope) {
  return JSON.stringify({
    ...scope,
    selectedCampaignIds: [...scope.selectedCampaignIds].sort(),
  });
}

export function buildDashboardReportKey(report: DashboardReport) {
  return JSON.stringify({
    source: report.source,
    accountId: report.account.id,
    selectedCampaignIds: report.selectedCampaigns.map((campaign) => campaign.id).sort(),
    since: report.dateRange.since,
    until: report.dateRange.until,
    pack: report.selectedPack,
    pulledAt: report.pulledAt,
  });
}

export function toggleReportCampaignSelection(input: {
  selectedIds: string[];
  activeCampaignIds: string[];
  campaignId: string;
}) {
  const current = input.selectedIds.length ? input.selectedIds : input.activeCampaignIds;
  if (!current.includes(input.campaignId)) return [...current, input.campaignId];
  return current.length === 1 ? current : current.filter((id) => id !== input.campaignId);
}

export function reportCampaignSelectionForAccount(
  accountId: string,
  report: DashboardReport | null,
) {
  const normalizedAccountId = accountId.replace(/^act_/u, "");
  const reportAccountIds = report
    ? [report.account.id, report.account.account_id].filter((value): value is string => Boolean(value)).map((value) => value.replace(/^act_/u, ""))
    : [];
  if (!report || !reportAccountIds.includes(normalizedAccountId)) return [];
  return report.selectedCampaigns.map((campaign) => campaign.id);
}
