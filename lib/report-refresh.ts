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

export type ReportScopeDraft = ReportRequestKeyScope & {
  targetCpa: string;
  targetRoas: string;
};

export function currentReportScope(
  report: DashboardReport,
  selectedCampaignIds = report.selectedCampaigns.map((campaign) => campaign.id),
): CurrentReportScope {
  return {
    accountId: report.account.id,
    selectedCampaignIds,
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
  const next = !current.includes(input.campaignId)
    ? [...current, input.campaignId]
    : current.length === 1
      ? current
      : current.filter((id) => id !== input.campaignId);
  return reportCampaignSelectionsEqual(next, input.activeCampaignIds) ? [] : next;
}

export function reportCampaignSelectionsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every((id, index) => id === normalizedRight[index]);
}

export function reportCampaignSelectionForAccount(
  accountId: string,
  report: DashboardReport | null,
  currentSelection?: string[],
) {
  const normalizedAccountId = accountId.replace(/^act_/u, "");
  const reportAccountIds = report
    ? [report.account.id, report.account.account_id].filter((value): value is string => Boolean(value)).map((value) => value.replace(/^act_/u, ""))
    : [];
  if (!report || !reportAccountIds.includes(normalizedAccountId)) return [];
  return currentSelection ?? report.selectedCampaigns.map((campaign) => campaign.id);
}

export function preserveRequestedCampaignSelection(
  requestedCampaignIds: string[],
  report: DashboardReport,
) {
  if (!requestedCampaignIds.length) return [];
  const returnedCampaignIds = report.selectedCampaigns.map((campaign) => campaign.id);
  return returnedCampaignIds.length ? returnedCampaignIds : [...requestedCampaignIds];
}

export function reportScopeDraftsEqual(left: ReportScopeDraft, right: ReportScopeDraft) {
  return normalizeAccountId(left.accountId) === normalizeAccountId(right.accountId)
    && reportCampaignSelectionsEqual(left.selectedCampaignIds, right.selectedCampaignIds)
    && left.since === right.since
    && left.until === right.until
    && left.pack === right.pack
    && left.compareMode === right.compareMode
    && normalizeNumericInput(left.targetCpa) === normalizeNumericInput(right.targetCpa)
    && normalizeNumericInput(left.targetRoas) === normalizeNumericInput(right.targetRoas);
}

export function campaignComparisonAvailable(campaigns: Array<{ id: string; status?: string; effective_status?: string }>, selectedCampaignIds: string[]) {
  if (!selectedCampaignIds.length) return false;
  const selected = new Set(selectedCampaignIds);
  const active = campaigns.filter((campaign) => String(campaign.effective_status || campaign.status || "").toUpperCase() === "ACTIVE");
  return active.some((campaign) => !selected.has(campaign.id));
}

function normalizeAccountId(value: string) {
  return value.replace(/^act_/u, "");
}

function normalizeNumericInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? String(numeric) : trimmed;
}
