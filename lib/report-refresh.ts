import type { CompareMode, DashboardReport, KpiPack } from "@/lib/types";
import { getCompareRange } from "@/lib/report-ranges";

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
  comparisonCampaignIds?: string[];
  comparisonSince?: string;
  comparisonUntil?: string;
  targetCpa?: string;
  targetRoas?: string;
};

export type ReportScopeDraft = ReportRequestKeyScope & {
  targetCpa: string;
  targetRoas: string;
};

export type ReportExecutionScope = {
  accountId: string;
  selectedCampaignIds: string[];
  since: string;
  until: string;
  pack: KpiPack | "auto";
  compareMode: CompareMode;
  comparisonCampaignIds: string[];
  comparisonSince: string;
  comparisonUntil: string;
  targetCpa: string;
  targetRoas: string;
};

type CurrentReportScopeOptions = {
  previousReport?: DashboardReport | null;
  compareMode?: CompareMode;
  targetCpa?: string;
  targetRoas?: string;
};

export function currentReportScope(report: DashboardReport, selectedCampaignIds?: string[]): CurrentReportScope;
export function currentReportScope(report: DashboardReport, options: CurrentReportScopeOptions): ReportExecutionScope;
export function currentReportScope(
  report: DashboardReport,
  selectionOrOptions: string[] | CurrentReportScopeOptions = report.selectedCampaigns.map((campaign) => campaign.id),
): CurrentReportScope | ReportExecutionScope {
  if (!Array.isArray(selectionOrOptions)) {
    const previousReport = selectionOrOptions.previousReport || null;
    const compareMode = selectionOrOptions.compareMode || "off";
    return {
      accountId: report.account.id,
      selectedCampaignIds: sortedUnique(report.selectedCampaigns.map((campaign) => campaign.id)),
      since: report.dateRange.since,
      until: report.dateRange.until,
      pack: report.selectedPack,
      compareMode,
      comparisonCampaignIds: compareMode === "off" || !previousReport
        ? []
        : sortedUnique(previousReport.selectedCampaigns.map((campaign) => campaign.id)),
      comparisonSince: compareMode === "off" || !previousReport ? "" : previousReport.dateRange.since,
      comparisonUntil: compareMode === "off" || !previousReport ? "" : previousReport.dateRange.until,
      targetCpa: normalizeNumericInput(selectionOrOptions.targetCpa || ""),
      targetRoas: normalizeNumericInput(selectionOrOptions.targetRoas || ""),
    };
  }
  return {
    accountId: report.account.id,
    selectedCampaignIds: selectionOrOptions,
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
    accountId: normalizeAccountId(scope.accountId),
    selectedCampaignIds: sortedUnique(scope.selectedCampaignIds),
    since: scope.since,
    until: scope.until,
    pack: scope.pack,
    compareMode: scope.compareMode,
    comparisonCampaignIds: sortedUnique(scope.comparisonCampaignIds || []),
    comparisonSince: scope.comparisonSince || "",
    comparisonUntil: scope.comparisonUntil || "",
    targetCpa: normalizeNumericInput(scope.targetCpa || ""),
    targetRoas: normalizeNumericInput(scope.targetRoas || ""),
  });
}

export function resolveReportExecutionScope(
  draft: ReportExecutionScope,
  campaigns: Array<{ id: string; status?: string; effective_status?: string }>,
): ReportExecutionScope {
  const activeCampaignIds = campaigns
    .filter((campaign) => String(campaign.effective_status || campaign.status || "").toUpperCase() === "ACTIVE")
    .map((campaign) => campaign.id);
  const selectedCampaignIds = sortedUnique(draft.selectedCampaignIds.length ? draft.selectedCampaignIds : activeCampaignIds);
  const comparisonRange = draft.compareMode === "off"
    ? { since: "", until: "" }
    : draft.comparisonSince && draft.comparisonUntil
      ? { since: draft.comparisonSince, until: draft.comparisonUntil }
      : getCompareRange({ since: draft.since, until: draft.until }, draft.compareMode);
  const comparisonCampaignIds = draft.compareMode === "off"
    ? []
    : draft.comparisonCampaignIds.length
      ? draft.comparisonCampaignIds
      : draft.compareMode === "campaign"
        ? activeCampaignIds.filter((id) => !selectedCampaignIds.includes(id))
        : selectedCampaignIds;

  return {
    ...draft,
    accountId: draft.accountId,
    selectedCampaignIds,
    comparisonCampaignIds: sortedUnique(comparisonCampaignIds),
    comparisonSince: comparisonRange.since,
    comparisonUntil: comparisonRange.until,
    targetCpa: normalizeNumericInput(draft.targetCpa),
    targetRoas: normalizeNumericInput(draft.targetRoas),
  };
}

export function finalizeReportExecutionScope(
  requested: ReportExecutionScope,
  report: DashboardReport,
  previousReport: DashboardReport | null,
): ReportExecutionScope {
  return {
    ...requested,
    accountId: report.account.id,
    selectedCampaignIds: sortedUnique(report.selectedCampaigns.length
      ? report.selectedCampaigns.map((campaign) => campaign.id)
      : requested.selectedCampaignIds),
    since: report.dateRange.since,
    until: report.dateRange.until,
    pack: report.selectedPack,
    comparisonCampaignIds: requested.compareMode === "off"
      ? []
      : sortedUnique(previousReport?.selectedCampaigns.length
        ? previousReport.selectedCampaigns.map((campaign) => campaign.id)
        : requested.comparisonCampaignIds),
    comparisonSince: requested.compareMode === "off" ? "" : previousReport?.dateRange.since || requested.comparisonSince,
    comparisonUntil: requested.compareMode === "off" ? "" : previousReport?.dateRange.until || requested.comparisonUntil,
    targetCpa: normalizeNumericInput(requested.targetCpa),
    targetRoas: normalizeNumericInput(requested.targetRoas),
  };
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
    && reportCampaignSelectionsEqual(left.comparisonCampaignIds || [], right.comparisonCampaignIds || [])
    && (left.comparisonSince || "") === (right.comparisonSince || "")
    && (left.comparisonUntil || "") === (right.comparisonUntil || "")
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

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort();
}
