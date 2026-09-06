"use client";

import * as React from "react";
import {
  Button as HeroButton,
  Chip,
  Input as HeroInput,
  Label as HeroLabel,
  ListBox,
  Modal as HeroModal,
  Select as HeroSelect,
  TextField,
} from "@heroui/react";
import { toast } from "sonner";
import {
  CheckIcon,
  DatabaseIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import type { ClientReportPdfFile } from "@/lib/client-report";
import { buildSampleReport, SAMPLE_CAMPAIGNS } from "@/lib/sample-report";
import { PerformanceV2 } from "@/components/dashboard/performance-v2";
import type { OverviewPerformanceTarget } from "@/lib/dashboard-overview";
import { isAbortError, jsonFetch } from "@/lib/api-client";
import type { CapabilityStatus } from "@/lib/capabilities";
import {
  type CustomKpiKey,
  deserializeCustomKpiSet,
  getCustomKpiCatalogGroups,
} from "@/lib/custom-kpi-set";
import {
  CUSTOM_CHARTS_STORAGE_KEY,
  LEGACY_CUSTOM_CHARTS_STORAGE_KEY,
  deserializeCharts,
  serializeCharts,
  type CustomChartSpec,
} from "@/lib/custom-chart";
import type { HealthScoreSummary } from "@/lib/health-score";
import { buildKpiComparisons } from "@/lib/metric-comparison";
import { formatMetric } from "@/lib/metrics";
import { getCompareRange } from "@/lib/report-ranges";
import {
  FUNNEL_STAGE_STORAGE_KEY,
  defaultPerformanceStageKeys,
  deserializePerformanceStageKeys,
  getPerformanceStageCatalog,
  serializePerformanceStageKeys,
  type PerformanceStageKey,
} from "@/lib/performance-stages";
import {
  buildDashboardReportKey,
  buildMetaReportUrl,
  buildReportRequestKey,
  currentReportScope,
  finalizeReportExecutionScope,
  reportScopeDraftsEqual,
  resolveReportExecutionScope,
  type ReportExecutionScope,
  type ReportScopeDraft,
} from "@/lib/report-refresh";
import { readStorageSlot } from "@/lib/storage-slot";
import type {
  AiInsightTable,
  CompareMode,
  DashboardReport,
  InterfaceLanguage,
  KpiCard,
  KpiPack,
  MetaAccount,
  MetaCampaign,
  Verdict,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const packItems: { label: string; value: KpiPack }[] = [
  { label: "Auto: lead/message", value: "lead_gen" },
  { label: "Messages", value: "messages" },
  { label: "Sales / ROAS", value: "sales_roas" },
  { label: "Traffic", value: "traffic" },
  { label: "Awareness", value: "awareness" },
];

const providerItems = [
  { label: "Auto: best available", value: "auto" },
  { label: "AI assistant", value: "9router" },
  { label: "Local rules only", value: "prompt" },
] as const;

export type Provider = (typeof providerItems)[number]["value"];

type ReportScopePatch = Partial<ReportExecutionScope>;

const compareItems: { label: string; value: CompareMode }[] = [
  { label: "Previous period", value: "previous" },
  { label: "Campaign group", value: "campaign" },
  { label: "No comparison", value: "off" },
];

const adsCopy = {
  en: { campaign: { day: "day", lifetime: "lifetime" } },
  vi: { campaign: { day: "ngày", lifetime: "lifetime" } },
} as const;

export type AdsWorkspaceState = {
  campaigns: MetaCampaign[];
  selectedCampaignIds: string[];
  since: string;
  until: string;
  pack: KpiPack | "auto";
  compareMode: CompareMode;
  targetCpa: string;
  targetRoas: string;
  report: DashboardReport | null;
  previousReport: DashboardReport | null;
  executionScope: ReportExecutionScope | null;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  aiLoading: { verdict: boolean; insights: boolean };
  scopeExpanded: boolean;
  customKpiKeys: CustomKpiKey[] | null;
  funnelStageKeys: PerformanceStageKey[] | null;
  customCharts: CustomChartSpec[];
};

export function initialAdsWorkspaceState(): AdsWorkspaceState {
  const dates = defaultDates();
  return {
    campaigns: [],
    selectedCampaignIds: [],
    since: dates.since,
    until: dates.until,
    pack: "auto",
    compareMode: "previous",
    targetCpa: "",
    targetRoas: "",
    report: null,
    previousReport: null,
    executionScope: null,
    verdict: null,
    insights: null,
    aiLoading: { verdict: false, insights: false },
    scopeExpanded: false,
    customKpiKeys: null,
    funnelStageKeys: null,
    customCharts: typeof window === "undefined"
      ? []
      : readStorageSlot(window.localStorage, {
          key: CUSTOM_CHARTS_STORAGE_KEY,
          legacyKey: LEGACY_CUSTOM_CHARTS_STORAGE_KEY,
          deserialize: deserializeCharts,
        }),
  };
}

export function resetAdsWorkspaceOnLogout(current: AdsWorkspaceState): AdsWorkspaceState {
  return {
    ...current,
    campaigns: [],
    report: null,
    previousReport: null,
    executionScope: null,
    verdict: null,
    insights: null,
    aiLoading: { verdict: false, insights: false },
  };
}

function defaultDates() {
  const until = new Date();
  until.setDate(until.getDate() - 1);
  const since = new Date(until);
  since.setDate(since.getDate() - 30);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

export function AdsWorkspace({
  language,
  provider,
  accounts,
  accountId,
  loading,
  state,
  effectiveKpis,
  healthSummary,
  reportHasData,
  exportingPdf,
  onAccountIdChange,
  onLoadingChange,
  onError,
  onStateChange,
  onSaveCustomKpis,
  onExportPdf,
  onCancelInitialScope,
  onReportReady,
  initialPerformanceTarget = "overview",
  initialPerformanceTargetKey = 0,
  scopeOnly = false,
}: {
  language: InterfaceLanguage;
  provider: Provider;
  accounts: MetaAccount[];
  accountId: string;
  loading: string;
  state: AdsWorkspaceState;
  effectiveKpis: KpiCard[];
  healthSummary: HealthScoreSummary | null;
  reportHasData: boolean;
  exportingPdf: boolean;
  onAccountIdChange: (id: string) => void;
  onLoadingChange: (value: string) => void;
  onError: (message: string) => void;
  onStateChange: React.Dispatch<React.SetStateAction<AdsWorkspaceState>>;
  onSaveCustomKpis: (keys: CustomKpiKey[]) => void;
  onExportPdf: () => Promise<ClientReportPdfFile>;
  onCancelInitialScope: () => void;
  onReportReady?: () => void;
  initialPerformanceTarget?: OverviewPerformanceTarget;
  initialPerformanceTargetKey?: number;
  scopeOnly?: boolean;
}) {
  const {
    campaigns,
    selectedCampaignIds,
    since,
    until,
    pack,
    compareMode,
    targetCpa,
    targetRoas,
    report,
    previousReport,
    executionScope,
    verdict,
    insights,
    aiLoading,
    scopeExpanded,
    customKpiKeys,
    funnelStageKeys,
    customCharts,
  } = state;
  const reportStartRef = React.useRef<HTMLDivElement>(null);
  const lastReportRequestRef = React.useRef<ReportExecutionScope | null>(null);
  const reportRequestSequenceRef = React.useRef(0);
  const reportReadySequenceRef = React.useRef(0);
  const activeReportRequestRef = React.useRef<{ id: number; key: string; controller: AbortController } | null>(null);
  const aiRequestSequenceRef = React.useRef({ verdict: 0, insights: 0 });
  const activeAiRequestRef = React.useRef<Partial<Record<keyof AdsWorkspaceState["aiLoading"], { id: number; reportKey: string; controller: AbortController }>>>({});
  const [reportFlow, setReportFlow] = React.useState<"idle" | "pulling" | "ready" | "error">("idle");
  const [reportFlowError, setReportFlowError] = React.useState("");
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const updateState = React.useCallback(
    (patch: Partial<AdsWorkspaceState>) => {
      onStateChange((current) => ({ ...current, ...patch }));
    },
    [onStateChange],
  );
  const comparisonReport = React.useMemo<DashboardReport | null>(() => {
    if (!report) return null;
    return { ...report, kpis: effectiveKpis };
  }, [effectiveKpis, report]);
  const kpiComparisons = React.useMemo(() => {
    if (!comparisonReport || !previousReport || compareMode === "off") return null;
    const arr = buildKpiComparisons({ report: comparisonReport, previousReport, compareMode, language });
    return new Map(arr.map((c) => [c.key, c]));
  }, [comparisonReport, previousReport, compareMode, language]);
  const reportKey = report ? buildDashboardReportKey(report) : "";

  function abortAiRequests() {
    for (const kind of ["verdict", "insights"] as const) {
      activeAiRequestRef.current[kind]?.controller.abort();
      delete activeAiRequestRef.current[kind];
    }
  }

  function startAiRequest(kind: keyof AdsWorkspaceState["aiLoading"], sourceReportKey: string) {
    activeAiRequestRef.current[kind]?.controller.abort();
    const request = {
      id: ++aiRequestSequenceRef.current[kind],
      reportKey: sourceReportKey,
      controller: new AbortController(),
    };
    activeAiRequestRef.current[kind] = request;
    return request;
  }

  React.useEffect(() => {
    if (!report && !scopeExpanded) updateState({ scopeExpanded: true });
  }, [report, scopeExpanded, updateState]);

  React.useEffect(() => {
    window.localStorage.setItem(CUSTOM_CHARTS_STORAGE_KEY, serializeCharts(customCharts));
  }, [customCharts]);

  React.useEffect(() => {
    if (!report || funnelStageKeys) return;
    updateState({
      funnelStageKeys: deserializePerformanceStageKeys(
        window.localStorage.getItem(FUNNEL_STAGE_STORAGE_KEY),
        report.selectedPack,
      ),
    });
  }, [funnelStageKeys, report, updateState]);

  React.useEffect(() => {
    if (!funnelStageKeys) return;
    window.localStorage.setItem(FUNNEL_STAGE_STORAGE_KEY, serializePerformanceStageKeys(funnelStageKeys));
  }, [funnelStageKeys]);

  React.useEffect(() => () => {
    activeReportRequestRef.current?.controller.abort();
    abortAiRequests();
  }, []);

  React.useEffect(() => {
    const cancelled = { verdict: false, insights: false };
    for (const kind of ["verdict", "insights"] as const) {
      const active = activeAiRequestRef.current[kind];
      if (!active || active.reportKey === reportKey) continue;
      active.controller.abort();
      delete activeAiRequestRef.current[kind];
      cancelled[kind] = true;
    }
    if (!cancelled.verdict && !cancelled.insights) return;
    onStateChange((current) => ({
      ...current,
      aiLoading: {
        verdict: cancelled.verdict ? false : current.aiLoading.verdict,
        insights: cancelled.insights ? false : current.aiLoading.insights,
      },
    }));
  }, [onStateChange, reportKey]);

  function scopeFromState(patch: ReportScopePatch = {}) {
    const base: ReportExecutionScope = executionScope || {
      accountId: accountId || report?.account.id || "",
      selectedCampaignIds,
      since,
      until,
      pack,
      compareMode,
      comparisonCampaignIds: [],
      comparisonSince: "",
      comparisonUntil: "",
      targetCpa,
      targetRoas,
    };
    const compareModeChanged = patch.compareMode !== undefined && patch.compareMode !== base.compareMode;
    const draft = {
      ...base,
      ...patch,
      ...(compareModeChanged ? { comparisonCampaignIds: [], comparisonSince: "", comparisonUntil: "" } : {}),
    };
    const availableCampaigns = campaigns.length
      ? campaigns
      : report?.source === "sample"
        ? SAMPLE_CAMPAIGNS
        : report?.selectedCampaigns || [];
    return resolveReportExecutionScope(draft, availableCampaigns);
  }

  async function fetchReportForScope(scope: ReportExecutionScope, comparison: boolean, signal?: AbortSignal) {
    const url = buildMetaReportUrl(window.location.origin, {
      accountId: scope.accountId,
      selectedCampaignIds: comparison ? scope.comparisonCampaignIds : scope.selectedCampaignIds,
      since: comparison ? scope.comparisonSince : scope.since,
      until: comparison ? scope.comparisonUntil : scope.until,
      pack: scope.pack,
    });
    return jsonFetch<{ report: DashboardReport }>(url, { timeoutMs: 30000, signal });
  }

  async function pullReport(requestedScope: ReportExecutionScope) {
    const scope = scopeFromState(requestedScope);
    const sampleMode = report?.source === "sample" && !accountId;
    if ((!sampleMode && !scope.accountId) || !scope.since || !scope.until || scope.since > scope.until) return;
    if (scope.compareMode !== "off" && (!scope.comparisonSince || !scope.comparisonUntil)) return;
    if (scope.compareMode === "campaign" && !scope.comparisonCampaignIds.length) {
      onError(language === "vi" ? "Chọn ít nhất một campaign đối chứng." : "Choose at least one comparison campaign.");
      return;
    }

    const requestKey = buildReportRequestKey(scope);
    if (activeReportRequestRef.current?.key === requestKey) return;

    abortAiRequests();
    activeReportRequestRef.current?.controller.abort();
    const requestId = ++reportRequestSequenceRef.current;
    reportReadySequenceRef.current = 0;
    const controller = new AbortController();
    activeReportRequestRef.current = { id: requestId, key: requestKey, controller };
    lastReportRequestRef.current = scope;
    const requestIsCurrent = () => activeReportRequestRef.current?.id === requestId && !controller.signal.aborted;

    if (sampleMode) {
      setReportFlowError("");
      setReportFlow("pulling");
      onLoadingChange("report");
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
        if (!requestIsCurrent()) return;
        const current = buildSampleReport({ selectedCampaignIds: scope.selectedCampaignIds, pack: scope.pack, dateRange: { since: scope.since, until: scope.until } });
        let sampleComparison: DashboardReport | null = null;
        if (scope.compareMode !== "off") {
          sampleComparison = buildSampleReport({
            selectedCampaignIds: scope.comparisonCampaignIds,
            pack: current.selectedPack,
            dateRange: { since: scope.comparisonSince, until: scope.comparisonUntil },
          });
        }
        if (!requestIsCurrent()) return;
        const finalScope = finalizeReportExecutionScope(scope, current, sampleComparison);
        updateState({
          report: current,
          previousReport: sampleComparison,
          executionScope: finalScope,
          selectedCampaignIds: finalScope.selectedCampaignIds,
          since: finalScope.since,
          until: finalScope.until,
          pack: finalScope.pack,
          compareMode: finalScope.compareMode,
          targetCpa: finalScope.targetCpa,
          targetRoas: finalScope.targetRoas,
          verdict: null,
          insights: null,
          aiLoading: { verdict: false, insights: false },
          scopeExpanded: false,
        });
        onReportReady?.();
        toast.success(language === "vi" ? "Đã áp dụng thay đổi" : "Changes applied", { description: language === "vi" ? "Báo cáo mẫu đã được dựng lại với phạm vi mới." : "The sample report was rebuilt with the new scope and comparison." });
        setReportFlow("ready");
        reportReadySequenceRef.current = requestId;
        window.setTimeout(() => {
          if (reportReadySequenceRef.current === requestId) setReportFlow("idle");
        }, 900);
      } catch (err) {
        if (!requestIsCurrent() || isAbortError(err)) return;
        const message = err instanceof Error ? err.message : "Could not rebuild the sample report.";
        setReportFlowError(message);
        setReportFlow("error");
        onError(message);
        onStateChange((current) => ({ ...current, aiLoading: { verdict: false, insights: false } }));
      } finally {
        if (activeReportRequestRef.current?.id === requestId) {
          activeReportRequestRef.current = null;
          onLoadingChange("");
        }
      }
      return;
    }
    onError("");
    setReportFlowError("");
    setReportFlow("pulling");
    onLoadingChange("report");
    try {
      const current = await fetchReportForScope(scope, false, controller.signal);
      if (!requestIsCurrent()) return;
      const primaryScope: ReportExecutionScope = {
        ...scope,
        accountId: current.report.account.id,
        selectedCampaignIds: current.report.selectedCampaigns.length
          ? current.report.selectedCampaigns.map((campaign) => campaign.id)
          : scope.selectedCampaignIds,
        since: current.report.dateRange.since,
        until: current.report.dateRange.until,
        pack: current.report.selectedPack,
      };
      let nextPreviousReport: DashboardReport | null = null;
      if (scope.compareMode !== "off") {
        const previous = await fetchReportForScope(primaryScope, true, controller.signal);
        if (!requestIsCurrent()) return;
        nextPreviousReport = previous.report;
      }
      const finalScope = finalizeReportExecutionScope(primaryScope, current.report, nextPreviousReport);
      updateState({
        report: current.report,
        previousReport: nextPreviousReport,
        executionScope: finalScope,
        selectedCampaignIds: finalScope.selectedCampaignIds,
        since: finalScope.since,
        until: finalScope.until,
        pack: finalScope.pack,
        compareMode: finalScope.compareMode,
        targetCpa: finalScope.targetCpa,
        targetRoas: finalScope.targetRoas,
        verdict: null,
        insights: null,
        aiLoading: { verdict: false, insights: false },
        scopeExpanded: false,
      });
      if (scope.accountId !== accountId) onAccountIdChange(finalScope.accountId);
      onReportReady?.();
      window.setTimeout(() => reportStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      toast.success(language === "vi" ? "Đã làm mới đúng phạm vi" : "Exact scope refreshed", { description: language === "vi" ? "Campaign, kỳ và đối chứng đang xem được giữ nguyên." : "The visible campaigns, period, and comparison were preserved." });
      setReportFlow("ready");
      reportReadySequenceRef.current = requestId;
      window.setTimeout(() => {
        if (reportReadySequenceRef.current === requestId) setReportFlow("idle");
      }, 900);
    } catch (err) {
      if (!requestIsCurrent() || isAbortError(err)) return;
      const message = err instanceof Error ? err.message : "Could not pull Meta report.";
      setReportFlowError(message);
      setReportFlow("error");
      onError(message);
      onStateChange((current) => ({ ...current, aiLoading: { verdict: false, insights: false } }));
    } finally {
      if (activeReportRequestRef.current?.id === requestId) {
        activeReportRequestRef.current = null;
        onLoadingChange("");
      }
    }
  }

  async function runAi() {
    if (!report || !reportHasData || aiLoading.verdict || reportFlow === "pulling") return;
    const sourceReport = report;
    const sourceReportKey = buildDashboardReportKey(sourceReport);
    const request = startAiRequest("verdict", sourceReportKey);
    onError("");
    onStateChange((current) => ({ ...current, aiLoading: { ...current.aiLoading, verdict: true } }));
    try {
      const data = await jsonFetch<{ verdict: Verdict }>("/api/ai/verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report: sourceReport, language, provider }),
        timeoutMs: 150000,
        signal: request.controller.signal,
      });
      if (activeAiRequestRef.current.verdict?.id !== request.id) return;
      onStateChange((current) => current.report && buildDashboardReportKey(current.report) === sourceReportKey
        ? { ...current, verdict: data.verdict }
        : current);
    } catch (err) {
      if (activeAiRequestRef.current.verdict?.id === request.id && !isAbortError(err)) {
        onError(err instanceof Error ? err.message : "Could not generate Verdict.");
      }
    } finally {
      if (activeAiRequestRef.current.verdict?.id === request.id) {
        delete activeAiRequestRef.current.verdict;
        onStateChange((current) => current.report && buildDashboardReportKey(current.report) === sourceReportKey
          ? { ...current, aiLoading: { ...current.aiLoading, verdict: false } }
          : current);
      }
    }
  }



  return (
    <>
      <ReportProgressDialog
        language={language}
        state={scopeExpanded ? "idle" : reportFlow}
        error={reportFlowError}
        onClose={() => setReportFlow("idle")}
        onRetry={() => lastReportRequestRef.current && void pullReport(lastReportRequestRef.current)}
      />
      <ReportScopeDialog
          open={scopeExpanded}
          language={language}
          accounts={accounts.length ? accounts : report ? [report.account] : []}
          accountId={accountId || report?.account.id || ""}
          campaigns={campaigns.length ? campaigns : report?.source === "sample" ? SAMPLE_CAMPAIGNS : report?.selectedCampaigns || []}
          currency={selectedAccount?.currency || report?.account.currency || "VND"}
          loading={loading}
          selectedCampaignIds={selectedCampaignIds}
          since={since}
          until={until}
          pack={pack}
          compareMode={compareMode}
          targetCpa={targetCpa || (report?.source === "sample" ? "40" : "")}
          targetRoas={targetRoas || (report?.source === "sample" ? "2.5" : "")}
          executionScope={executionScope}
          error={reportFlow === "error" ? reportFlowError : ""}
          onAccountIdChange={report?.source === "sample" && !accountId ? () => undefined : onAccountIdChange}
          onRestoreCampaignSelection={(ids) => updateState({ selectedCampaignIds: ids })}
          onOpenChange={(open) => {
            if (!open && !report) {
              setReportFlow("idle");
              setReportFlowError("");
              onCancelInitialScope();
              return;
            }
            if (!open && reportFlow === "error") {
              setReportFlow("idle");
              setReportFlowError("");
            }
            updateState({ scopeExpanded: open });
          }}
          onSave={(patch) => {
            if (report?.source === "sample" && !accountId) {
              void pullReport(patch);
              return;
            }
            void pullReport(patch);
          }}
        />
      {!scopeOnly && report && !reportHasData ? (
        <Card className="border-border bg-card">
          <CardContent>
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <DatabaseIcon />
                </EmptyMedia>
                <EmptyTitle>{language === "vi" ? "Phạm vi này chưa có dữ liệu phân tích" : "No analyzable data in this scope"}</EmptyTitle>
                <EmptyDescription>
                  {language === "vi"
                    ? "Meta trả về 0 spend, impression và kết quả. Verdict, insight và export được tạm khóa để tránh tạo báo cáo gây hiểu nhầm."
                    : "Meta returned zero spend, impressions, and results. Verdict, insights, and export stay locked to avoid a misleading report."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : null}
      {!scopeOnly && report && reportHasData ? (
        <div ref={reportStartRef} className="workbench-fade-up scroll-mt-4">
          <PerformanceV2
            language={language}
            report={report}
            previousReport={previousReport}
            kpiComparisons={kpiComparisons}
            effectiveKpis={effectiveKpis}
            healthSummary={healthSummary}
            verdict={verdict}
            insights={insights}
            accountLabel={report.account.name}
            periodLabel={`${report.dateRange.since} – ${report.dateRange.until}`}
            scopeLabel={packLabel(report.selectedPack, language)}
            selectedCampaignIds={selectedCampaignIds}
            since={since}
            until={until}
            compareMode={compareMode}
            funnelStageKeys={funnelStageKeys}
            exporting={exportingPdf}
            reviewing={aiLoading.verdict}
            reportLoading={loading === "report"}
            onEditScope={() => updateState({ scopeExpanded: true })}
            onRefresh={(scope) => void pullReport(scope || executionScope || currentReportScope(report, { previousReport, compareMode, targetCpa, targetRoas }))}
            onExport={onExportPdf}
            onReviewActions={runAi}
            initialTab={initialPerformanceTarget}
            initialTabKey={initialPerformanceTargetKey}
          />
        </div>
      ) : null}
    </>
  );
}

function CustomKpiSetSheet({
  defaultKpis,
  language,
  selectedKeys,
  funnelPack,
  funnelStageKeys,
  onSave,
  onSaveFunnelStages,
}: {
  defaultKpis: KpiCard[];
  language: InterfaceLanguage;
  selectedKeys: CustomKpiKey[];
  funnelPack: KpiPack;
  funnelStageKeys: PerformanceStageKey[];
  onSave: (keys: CustomKpiKey[]) => void;
  onSaveFunnelStages: (keys: PerformanceStageKey[]) => void;
}) {
  const isVietnamese = language === "vi";
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"cards" | "funnel">("cards");
  const [draftKeys, setDraftKeys] = React.useState<CustomKpiKey[]>(selectedKeys);
  const [draftStageKeys, setDraftStageKeys] = React.useState<PerformanceStageKey[]>(funnelStageKeys);
  const [query, setQuery] = React.useState("");
  const groups = getCustomKpiCatalogGroups(language);
  const selectedSet = React.useMemo(() => new Set(draftKeys), [draftKeys]);
  const catalog = React.useMemo(() => groups.flatMap((group) => group.metrics), [groups]);
  const recommendedSet = React.useMemo(() => new Set(defaultKpis.map((kpi) => kpi.key)), [defaultKpis]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      metrics: normalizedQuery
        ? group.metrics.filter((metric) => `${metric.label} ${metric.format}`.toLowerCase().includes(normalizedQuery))
        : group.metrics,
    }))
    .filter((group) => group.metrics.length);
  const stageCatalog = getPerformanceStageCatalog(language);
  const stageItems = stageCatalog.map((stage) => ({ label: stage.label, value: stage.key }));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraftKeys(selectedKeys.length ? selectedKeys : deserializeCustomKpiSet(null, defaultKpis));
      setDraftStageKeys(funnelStageKeys.length ? funnelStageKeys : defaultPerformanceStageKeys(funnelPack));
      setQuery("");
      setTab("cards");
    }
  }

  function toggleMetric(key: CustomKpiKey) {
    setDraftKeys((current) => {
      if (current.includes(key)) return current.length > 1 ? current.filter((item) => item !== key) : current;
      return [...current, key];
    });
  }

  function handleSave() {
    if (!draftKeys.length || !draftStageKeys.length) return;
    onSave(draftKeys);
    onSaveFunnelStages(draftStageKeys);
    toast.success(isVietnamese ? "Đã lưu tùy chỉnh báo cáo" : "Report customization saved", { description: isVietnamese ? `${draftKeys.length} thẻ KPI và ${draftStageKeys.length} giai đoạn phễu đã được cập nhật.` : `${draftKeys.length} KPI cards and ${draftStageKeys.length} funnel stages are now active.` });
    setOpen(false);
  }

  function changeStage(index: number, key: PerformanceStageKey) {
    setDraftStageKeys((current) => {
      const next = [...current];
      const existingIndex = next.indexOf(key);
      if (existingIndex >= 0 && existingIndex !== index) next[existingIndex] = next[index];
      next[index] = key;
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <SlidersHorizontalIcon data-icon="inline-start" />
            {isVietnamese ? "Tùy chỉnh KPI" : "Customize KPIs"}
          </Button>
        }
      />
      <DialogContent className="flex h-[min(760px,calc(100svh-2rem))] w-[calc(100vw-2rem)] min-w-0 max-w-[520px] flex-col gap-3.5 overflow-hidden rounded-2xl border border-border bg-popover p-5" showCloseButton={false}>
        <DialogHeader className="gap-0 text-left">
          <DialogTitle className="text-[22px] font-bold leading-7">{isVietnamese ? "Tùy chỉnh báo cáo" : "Customize report"}</DialogTitle>
          <DialogDescription className="mt-3 text-[13px] leading-5">
            {isVietnamese
              ? "Chọn KPI hiển thị và chỉ số đại diện cho từng giai đoạn phễu. KPI pack gốc vẫn được giữ nguyên."
              : "Choose visible KPI cards and the metric represented by each funnel stage. The underlying KPI pack stays unchanged."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as "cards" | "funnel")} className="min-h-0 flex-1 gap-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cards">{isVietnamese ? "Thẻ KPI" : "KPI cards"}</TabsTrigger>
            <TabsTrigger value="funnel">{isVietnamese ? "Giai đoạn phễu" : "Funnel stages"}</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVietnamese ? `Tìm ${catalog.length} chỉ số...` : `Search all ${catalog.length} metrics...`} className="h-9" />
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {visibleGroups.map((group) => (
                  <section key={group.id} className="mb-4">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{group.label}</div>
                    <div className="grid gap-1">
                      {group.metrics.map((metric) => {
                        const checked = selectedSet.has(metric.key);
                        const disabled = checked && draftKeys.length === 1;
                        return (
                          <button
                            key={metric.key}
                            type="button"
                            aria-pressed={checked}
                            disabled={disabled}
                            onClick={() => toggleMetric(metric.key)}
                            className="flex min-h-12 items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:bg-primary/12"
                          >
                            <span className="min-w-0"><span className="block text-sm font-medium">{metric.label}</span><span className="block text-xs capitalize text-muted-foreground">{metric.format}</span></span>
                            <span className="flex shrink-0 items-center gap-2">{recommendedSet.has(metric.key) ? <Badge variant="outline">{isVietnamese ? "Gợi ý" : "Recommended"}</Badge> : null}<span className="flex size-5 items-center justify-center rounded-full border border-border text-primary">{checked ? <CheckIcon className="size-3.5" /> : null}</span></span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {!visibleGroups.length ? <div className="py-8 text-center text-sm text-muted-foreground">{isVietnamese ? "Không tìm thấy KPI phù hợp." : "No matching KPI metrics."}</div> : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="funnel" className="min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between gap-3 pb-3 text-xs text-muted-foreground"><span>{isVietnamese ? "Mỗi vị trí dùng một metric báo cáo." : "Each position uses one report metric."}</span><button type="button" className="font-medium text-primary" onClick={() => setDraftStageKeys(defaultPerformanceStageKeys(funnelPack))}>{isVietnamese ? "Đặt lại" : "Reset"}</button></div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {draftStageKeys.map((key, index) => {
                  const selectedStage = stageCatalog.find((stage) => stage.key === key);
                  return (
                    <Field key={`${index}-${key}`} className="min-w-0 rounded-2xl border border-border p-3">
                      <FieldLabel>{isVietnamese ? `Giai đoạn ${index + 1}` : `Stage ${index + 1}`}</FieldLabel>
                      <Select items={stageItems} value={key} onValueChange={(value) => value && changeStage(index, value as PerformanceStageKey)}>
                        <SelectTrigger className="mt-1 h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectGroup>{stageCatalog.map((stage) => <SelectItem key={stage.key} value={stage.key}>{stage.label}</SelectItem>)}</SelectGroup></SelectContent>
                      </Select>
                      <FieldDescription>{selectedStage?.description}</FieldDescription>
                    </Field>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{draftKeys.length} {isVietnamese ? "KPI đã chọn" : "KPIs selected"}</span><span>{draftStageKeys.length} {isVietnamese ? "giai đoạn" : "funnel stages"}</span></div>
        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <Button type="button" variant="secondary" className="rounded-full text-primary" onClick={() => handleOpenChange(false)}>{isVietnamese ? "Hủy" : "Cancel"}</Button>
          <Button type="button" className="rounded-full" onClick={handleSave} disabled={!draftKeys.length || !draftStageKeys.length}>{isVietnamese ? "Lưu tùy chỉnh" : "Save changes"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportScopeDialog({
  open,
  language,
  accounts,
  accountId,
  campaigns,
  currency,
  loading,
  selectedCampaignIds,
  since,
  until,
  pack,
  compareMode,
  targetCpa,
  targetRoas,
  executionScope,
  error,
  onAccountIdChange,
  onRestoreCampaignSelection,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  language: InterfaceLanguage;
  accounts: MetaAccount[];
  accountId: string;
  campaigns: MetaCampaign[];
  currency: string;
  loading: string;
  selectedCampaignIds: string[];
  since: string;
  until: string;
  pack: KpiPack | "auto";
  compareMode: CompareMode;
  targetCpa: string;
  targetRoas: string;
  executionScope: ReportExecutionScope | null;
  error: string;
  onAccountIdChange: (id: string) => void;
  onRestoreCampaignSelection: (ids: string[]) => void;
  onOpenChange: (open: boolean) => void;
  onSave: (scope: ReportExecutionScope) => void;
}) {
  const isVietnamese = language === "vi";
  const comparisonRange = compareMode === "off" ? { since: "", until: "" } : getCompareRange({ since, until }, compareMode);
  const initialDraft: ReportScopeDraft = executionScope || {
    accountId,
    selectedCampaignIds,
    since,
    until,
    pack,
    compareMode,
    comparisonCampaignIds: compareMode === "campaign" ? [] : selectedCampaignIds,
    comparisonSince: comparisonRange.since,
    comparisonUntil: comparisonRange.until,
    targetCpa,
    targetRoas,
  };
  const [draft, setDraft] = React.useState<ReportScopeDraft>(initialDraft);
  const [baseline, setBaseline] = React.useState<ReportScopeDraft>(initialDraft);
  const [thresholdsEnabled, setThresholdsEnabled] = React.useState(Boolean(targetCpa || targetRoas));
  const wasOpenRef = React.useRef(false);
  const invalidDates = Boolean(draft.since && draft.until && draft.since > draft.until);
  const invalidComparisonDates = draft.compareMode !== "off" && (
    !draft.comparisonSince
    || !draft.comparisonUntil
    || draft.comparisonSince > draft.comparisonUntil
  );
  const invalidThresholds = thresholdsEnabled && (
    (Boolean(draft.targetCpa) && (!Number.isFinite(Number(draft.targetCpa)) || Number(draft.targetCpa) <= 0))
    || (Boolean(draft.targetRoas) && (!Number.isFinite(Number(draft.targetRoas)) || Number(draft.targetRoas) <= 0))
  );
  const reportPending = loading === "report";
  const effectiveDraft = {
    ...draft,
    targetCpa: thresholdsEnabled ? draft.targetCpa : "",
    targetRoas: thresholdsEnabled ? draft.targetRoas : "",
  };
  const unchanged = Boolean(executionScope) && reportScopeDraftsEqual(effectiveDraft, baseline);
  const missingCampaignComparison = draft.compareMode === "campaign" && !(draft.comparisonCampaignIds || []).length;
  const primaryCampaigns = selectedCampaignSummary(draft.selectedCampaignIds, campaigns, language);
  const comparisonCampaigns = draft.compareMode === "campaign"
    ? selectedCampaignSummary(draft.comparisonCampaignIds || [], campaigns, language)
    : primaryCampaigns;

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = initialDraft;
      setDraft(next);
      setBaseline(next);
      setThresholdsEnabled(Boolean(targetCpa || targetRoas));
    }
    wasOpenRef.current = open;
  }, [open, accountId, selectedCampaignIds, since, until, pack, compareMode, targetCpa, targetRoas]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && reportPending) return;
    if (!nextOpen) {
      onRestoreCampaignSelection(baseline.selectedCampaignIds);
      if (draft.accountId !== baseline.accountId) onAccountIdChange(baseline.accountId);
    }
    onOpenChange(nextOpen);
  }

  function save() {
    if (!draft.accountId || unchanged || invalidDates || invalidComparisonDates || missingCampaignComparison || invalidThresholds || reportPending || loading === "campaigns") return;
    onSave({
      ...effectiveDraft,
      comparisonCampaignIds: effectiveDraft.comparisonCampaignIds || [],
      comparisonSince: effectiveDraft.comparisonSince || "",
      comparisonUntil: effectiveDraft.comparisonUntil || "",
    });
  }

  function changePrimaryRange(patch: Partial<Pick<ReportExecutionScope, "since" | "until">>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (next.compareMode !== "previous" || !next.since || !next.until || next.since > next.until) return next;
      const range = getCompareRange({ since: next.since, until: next.until }, "previous");
      return { ...next, comparisonSince: range.since, comparisonUntil: range.until };
    });
  }

  return (
    <HeroModal.Backdrop className="heroui-scope" isOpen={open} onOpenChange={handleOpenChange} variant="blur">
      <HeroModal.Container placement="auto" scroll="inside" size="lg">
        <HeroModal.Dialog className="max-h-[calc(100svh-1rem)] overflow-hidden sm:max-w-[880px]" data-report-scope-modal>
          <HeroModal.CloseTrigger isDisabled={reportPending} />
          <HeroModal.Header className="border-b border-border pb-5">
            <HeroModal.Icon className="bg-accent-soft text-accent-soft-foreground"><SlidersHorizontalIcon className="size-5" /></HeroModal.Icon>
            <HeroModal.Heading>{isVietnamese ? "Sửa phạm vi báo cáo" : "Edit report scope"}</HeroModal.Heading>
            <p className="mt-1 max-w-[68ch] text-sm leading-5 text-muted">{isVietnamese ? "Chọn chính xác báo cáo cần làm mới và đối chứng dùng để ra quyết định. Thay đổi chỉ áp dụng khi bạn xác nhận." : "Choose the exact report to refresh and the comparison used for the decision. Nothing changes until you apply."}</p>
          </HeroModal.Header>

          <HeroModal.Body className="gap-6 p-4 text-foreground sm:p-6">
            {error ? <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="grid min-w-0 gap-6">
                <section className="grid gap-4" aria-labelledby="report-source-heading">
                  <div><h3 id="report-source-heading" className="text-sm font-semibold">{isVietnamese ? "Báo cáo đang xem" : "Report in view"}</h3><p className="mt-1 text-xs text-muted">{isVietnamese ? "Account, campaign và kỳ chính của báo cáo." : "The report account, campaigns, and primary period."}</p></div>
                  <HeroSelect className="w-full" isDisabled={reportPending} value={draft.accountId} variant="secondary" onChange={(value) => {
                    if (!value || value === draft.accountId) return;
                    setDraft((current) => ({ ...current, accountId: String(value), selectedCampaignIds: [], comparisonCampaignIds: [] }));
                    onAccountIdChange(String(value));
                  }}>
                    <HeroLabel>{isVietnamese ? "Tài khoản quảng cáo" : "Ad account"}</HeroLabel>
                    <HeroSelect.Trigger><HeroSelect.Value /><HeroSelect.Indicator /></HeroSelect.Trigger>
                    <HeroSelect.Popover className="heroui-scope"><ListBox>{accounts.map((account) => <ListBox.Item key={account.id} id={account.id} textValue={account.name}>{account.name}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></HeroSelect.Popover>
                  </HeroSelect>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <TextField isInvalid={invalidDates} variant="secondary"><HeroLabel>{isVietnamese ? "Từ ngày" : "From"}</HeroLabel><HeroInput type="date" value={draft.since} onChange={(event) => changePrimaryRange({ since: event.target.value })} /></TextField>
                    <TextField isInvalid={invalidDates} variant="secondary"><HeroLabel>{isVietnamese ? "Đến ngày" : "To"}</HeroLabel><HeroInput type="date" value={draft.until} onChange={(event) => changePrimaryRange({ until: event.target.value })} /></TextField>
                  </div>
                  {invalidDates ? <p className="text-xs text-danger">{isVietnamese ? "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." : "The end date must be on or after the start date."}</p> : null}
                  <CampaignSelectionField
                    campaigns={campaigns}
                    currency={currency}
                    language={language}
                    label={isVietnamese ? "Campaign trong báo cáo" : "Campaigns in report"}
                    loading={loading === "campaigns" || reportPending}
                    selectedIds={draft.selectedCampaignIds}
                    emptyLabel={isVietnamese ? "Tất cả campaign active khi áp dụng" : "All active campaigns on apply"}
                    onChange={(ids) => setDraft((current) => ({ ...current, selectedCampaignIds: ids, ...(current.compareMode === "campaign" ? {} : { comparisonCampaignIds: ids }) }))}
                  />
                </section>

                <section className="grid gap-4 border-t border-border pt-6" aria-labelledby="comparison-heading">
                  <div><h3 id="comparison-heading" className="text-sm font-semibold">{isVietnamese ? "Đối chứng" : "Comparison"}</h3><p className="mt-1 text-xs text-muted">{isVietnamese ? "So campaign mới với campaign cũ, kể cả khi khác kỳ." : "Compare a new campaign with an older campaign, even across different periods."}</p></div>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label={isVietnamese ? "Chế độ so sánh" : "Comparison mode"}>
                    {compareItems.map((item) => <HeroButton key={item.value} size="sm" variant={draft.compareMode === item.value ? "primary" : "secondary"} onPress={() => {
                      const nextMode = item.value;
                      const range = nextMode === "off" ? { since: "", until: "" } : getCompareRange({ since: draft.since, until: draft.until }, nextMode);
                      setDraft((current) => ({ ...current, compareMode: nextMode, comparisonCampaignIds: nextMode === "campaign" ? [] : current.selectedCampaignIds, comparisonSince: range.since, comparisonUntil: range.until }));
                    }}>{compareLabel(item.value, language)}</HeroButton>)}
                  </div>
                  {draft.compareMode !== "off" ? <>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <TextField isInvalid={invalidComparisonDates} variant="secondary"><HeroLabel>{isVietnamese ? "Đối chứng từ" : "Compare from"}</HeroLabel><HeroInput type="date" value={draft.comparisonSince || ""} onChange={(event) => setDraft((current) => ({ ...current, comparisonSince: event.target.value }))} /></TextField>
                      <TextField isInvalid={invalidComparisonDates} variant="secondary"><HeroLabel>{isVietnamese ? "Đối chứng đến" : "Compare to"}</HeroLabel><HeroInput type="date" value={draft.comparisonUntil || ""} onChange={(event) => setDraft((current) => ({ ...current, comparisonUntil: event.target.value }))} /></TextField>
                    </div>
                    {draft.compareMode === "campaign" ? <CampaignSelectionField campaigns={campaigns} currency={currency} language={language} label={isVietnamese ? "Campaign đối chứng" : "Comparison campaigns"} loading={loading === "campaigns" || reportPending} selectedIds={draft.comparisonCampaignIds || []} emptyLabel={isVietnamese ? "Chọn campaign cũ để đối chứng" : "Choose an older comparison campaign"} onChange={(ids) => setDraft((current) => ({ ...current, comparisonCampaignIds: ids }))} /> : null}
                    {missingCampaignComparison ? <p className="text-xs text-danger">{isVietnamese ? "Chọn ít nhất một campaign đối chứng." : "Choose at least one comparison campaign."}</p> : null}
                  </> : null}
                </section>

                <section className="grid gap-4 border-t border-border pt-6" aria-labelledby="rules-heading">
                  <div><h3 id="rules-heading" className="text-sm font-semibold">{isVietnamese ? "Quy tắc quyết định" : "Decision rules"}</h3><p className="mt-1 text-xs text-muted">{isVietnamese ? "Giữ mặc định nếu bạn không có mục tiêu nội bộ." : "Keep defaults unless you have internal targets."}</p></div>
                  <HeroSelect className="w-full" isDisabled={reportPending} value={draft.pack} variant="secondary" onChange={(value) => value && setDraft((current) => ({ ...current, pack: value as KpiPack | "auto" }))}>
                    <HeroLabel>KPI pack</HeroLabel><HeroSelect.Trigger><HeroSelect.Value /><HeroSelect.Indicator /></HeroSelect.Trigger>
                    <HeroSelect.Popover className="heroui-scope"><ListBox><ListBox.Item id="auto" textValue="Auto-detect">{isVietnamese ? "Tự nhận diện" : "Auto-detect"}<ListBox.ItemIndicator /></ListBox.Item>{packItems.map((item) => <ListBox.Item key={item.value} id={item.value} textValue={packLabel(item.value, language)}>{packLabel(item.value, language)}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></HeroSelect.Popover>
                  </HeroSelect>
                  <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" disabled={reportPending} className="mt-1 accent-[var(--primary)]" checked={thresholdsEnabled} onChange={(event) => setThresholdsEnabled(event.target.checked)} /><span><span className="block text-sm font-medium">{isVietnamese ? "Dùng mục tiêu CPA / ROAS" : "Use CPA / ROAS targets"}</span><span className="mt-0.5 block text-xs text-muted">{isVietnamese ? "Tùy chọn; chỉ nhập chỉ số bạn thực sự dùng." : "Optional; enter only the target you actually use."}</span></span></label>
                  {thresholdsEnabled ? <div className="grid min-w-0 gap-3 sm:grid-cols-2"><TextField isInvalid={invalidThresholds} variant="secondary"><HeroLabel>{isVietnamese ? "CPA mục tiêu" : "Target CPA"}</HeroLabel><HeroInput type="number" min="0.01" step="0.01" value={draft.targetCpa} onChange={(event) => setDraft((current) => ({ ...current, targetCpa: event.target.value }))} /></TextField><TextField isInvalid={invalidThresholds} variant="secondary"><HeroLabel>{isVietnamese ? "ROAS mục tiêu" : "Target ROAS"}</HeroLabel><HeroInput type="number" min="0.01" step="0.01" value={draft.targetRoas} onChange={(event) => setDraft((current) => ({ ...current, targetRoas: event.target.value }))} /></TextField></div> : null}
                </section>
              </div>

              <aside className="h-fit rounded-2xl border border-border bg-surface-secondary p-4 lg:sticky lg:top-0" data-scope-preview>
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{isVietnamese ? "Sẽ làm mới" : "Refresh preview"}</h3><Chip color={unchanged ? "default" : "accent"} size="sm" variant="soft"><Chip.Label>{unchanged ? (isVietnamese ? "Hiện tại" : "Current") : (isVietnamese ? "Đã sửa" : "Edited")}</Chip.Label></Chip></div>
                <dl className="mt-4 grid gap-4 text-xs">
                  <div><dt className="text-muted">{isVietnamese ? "Báo cáo" : "Report"}</dt><dd className="mt-1 font-medium text-foreground">{primaryCampaigns}</dd></div>
                  <div><dt className="text-muted">{isVietnamese ? "Kỳ chính" : "Primary period"}</dt><dd className="mt-1 font-medium text-foreground">{draft.since} - {draft.until}</dd></div>
                  <div><dt className="text-muted">{isVietnamese ? "Đối chứng" : "Comparison"}</dt><dd className="mt-1 font-medium text-foreground">{draft.compareMode === "off" ? (isVietnamese ? "Không so sánh" : "No comparison") : `${comparisonCampaigns} · ${draft.comparisonSince} - ${draft.comparisonUntil}`}</dd></div>
                  <div><dt className="text-muted">KPI</dt><dd className="mt-1 font-medium text-foreground">{draft.pack === "auto" ? (isVietnamese ? "Tự nhận diện" : "Auto-detect") : packLabel(draft.pack, language)}</dd></div>
                </dl>
                <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted">{isVietnamese ? "Sau khi chạy, campaign ID thực tế sẽ được đóng băng để mọi nút Làm mới giữ đúng báo cáo này." : "After the pull, exact campaign IDs are frozen so every Refresh button keeps this report in view."}</p>
              </aside>
            </div>
          </HeroModal.Body>

          <HeroModal.Footer className="border-t border-border">
            <HeroButton data-scope-cancel variant="tertiary" onPress={() => handleOpenChange(false)} isDisabled={reportPending}>{isVietnamese ? "Hủy" : "Cancel"}</HeroButton>
            <HeroButton data-scope-apply onPress={save} isDisabled={!draft.accountId || unchanged || invalidDates || invalidComparisonDates || missingCampaignComparison || invalidThresholds || reportPending || loading === "campaigns"}>{reportPending ? (isVietnamese ? "Đang làm mới..." : "Refreshing...") : (isVietnamese ? "Áp dụng và làm mới" : "Apply and refresh")}</HeroButton>
          </HeroModal.Footer>
        </HeroModal.Dialog>
      </HeroModal.Container>
    </HeroModal.Backdrop>
  );
}

function CampaignSelectionField({ campaigns, currency, language, label, loading, selectedIds, emptyLabel, onChange }: {
  campaigns: MetaCampaign[];
  currency: string;
  language: InterfaceLanguage;
  label: string;
  loading: boolean;
  selectedIds: string[];
  emptyLabel: string;
  onChange: (ids: string[]) => void;
}) {
  const isVietnamese = language === "vi";
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const activeCampaigns = React.useMemo(() => campaigns.filter(isActiveCampaign), [campaigns]);
  const activeCampaignIds = React.useMemo(() => activeCampaigns.map((campaign) => campaign.id), [activeCampaigns]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleCampaigns = campaigns.filter((campaign) => `${campaign.name} ${campaign.objective || ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 30);

  function toggle(id: string) {
    if (loading) return;
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  return (
    <div className="min-w-0">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-medium">{selectedIds.length ? selectedCampaignSummary(selectedIds, campaigns, language) : emptyLabel}</div>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => setExpanded((current) => !current)} disabled={loading || !campaigns.length} aria-expanded={expanded}>
            {expanded ? (isVietnamese ? "Xong" : "Done") : (isVietnamese ? "Thay đổi" : "Change")}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 min-w-0 overflow-hidden rounded-2xl border border-border bg-secondary/35 p-3">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input disabled={loading} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVietnamese ? "Tìm campaign..." : "Search campaigns..."} />
            <Button type="button" variant="secondary" size="sm" onClick={() => onChange(activeCampaignIds)} disabled={loading}>{isVietnamese ? "Chọn active" : "Select active"}</Button>
          </div>
          <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto">
            {visibleCampaigns.map((campaign) => {
              const selected = selectedIds.length ? selectedSet.has(campaign.id) : isActiveCampaign(campaign);
              return (
                <button key={campaign.id} type="button" data-primary-campaign-id={campaign.id} disabled={loading} aria-pressed={selected} onClick={() => toggle(campaign.id)} className="grid w-full min-w-0 shrink-0 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-xl px-2.5 py-2 text-left hover:bg-secondary aria-pressed:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="flex size-4 items-center justify-center rounded border border-border text-primary">{selected ? <CheckIcon className="size-3" /> : null}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{campaign.name}</span><span className="block truncate text-xs text-muted-foreground">{campaignObjectiveLabel(campaign, language)} {formatCampaignBudget(campaign, currency, language)}</span></span>
                  <Badge className="max-w-20 truncate" variant={isActiveCampaign(campaign) ? "secondary" : "outline"}>{campaignStatus(campaign)}</Badge>
                </button>
              );
            })}
            {!visibleCampaigns.length ? <p className="px-2 py-6 text-center text-sm text-muted-foreground">{isVietnamese ? "Không có campaign khớp với tìm kiếm này." : "No campaigns match this search."}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function selectedCampaignSummary(ids: string[], campaigns: MetaCampaign[], language: InterfaceLanguage) {
  if (!ids.length) return language === "vi" ? "Chưa chọn campaign" : "No campaigns selected";
  const names = ids.map((id) => campaigns.find((campaign) => campaign.id === id)?.name || id);
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

function ReportProgressDialog({ language, state, error, onClose, onRetry }: { language: InterfaceLanguage; state: "idle" | "pulling" | "ready" | "error"; error: string; onClose: () => void; onRetry: () => void }) {
  const isVietnamese = language === "vi";
  const [percent, setPercent] = React.useState(12);

  React.useEffect(() => {
    if (state !== "pulling") {
      if (state === "ready") setPercent(100);
      return;
    }
    setPercent(12);
    const interval = window.setInterval(() => setPercent((current) => Math.min(92, current + Math.max(1, (96 - current) * 0.08))), 500);
    return () => window.clearInterval(interval);
  }, [state]);

  return (
    <Dialog open={state !== "idle"} onOpenChange={(open) => !open && state !== "pulling" && onClose()}>
      <DialogContent className="max-w-[440px] rounded-3xl border border-border bg-popover p-6" showCloseButton={state !== "pulling"}>
        <DialogHeader>
          <Badge variant={state === "ready" ? "success" : state === "error" ? "destructive" : "secondary"} className="mb-3 w-fit">Meta Marketing API</Badge>
          <DialogTitle className="text-xl font-semibold">
            {state === "ready" ? (isVietnamese ? "Báo cáo đã sẵn sàng" : "Report ready") : state === "error" ? (isVietnamese ? "Không thể làm mới báo cáo" : "Report refresh needs attention") : (isVietnamese ? "Đang kéo báo cáo" : "Pulling your report")}
          </DialogTitle>
          <DialogDescription className="mt-1 leading-5">
            {state === "ready" ? (isVietnamese ? "Dữ liệu, breakdown và evidence đã được chuẩn hóa." : "Data, breakdowns and evidence are normalized and ready.") : state === "error" ? error : (isVietnamese ? "Đang lấy campaign, ad set, insight và breakdown từ phạm vi đã chọn." : "Fetching campaigns, ad sets, insights and breakdowns from the selected scope.")}
          </DialogDescription>
        </DialogHeader>
        {state !== "error" ? (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} /></div>
            <div className="mt-2 text-xs text-muted-foreground">{state === "ready" ? "100%" : `${Math.round(percent)}% · ${isVietnamese ? "Đang chuẩn hóa evidence" : "Normalizing evidence"}`}</div>
          </div>
        ) : null}
        <DialogFooter className="mt-6">
          {state === "error" ? <><Button variant="outline" onClick={onClose}>{isVietnamese ? "Đóng" : "Close"}</Button><Button onClick={onRetry}>{isVietnamese ? "Thử lại" : "Retry"}</Button></> : state === "ready" ? <Button onClick={onClose}>{isVietnamese ? "Mở báo cáo" : "Open report"}</Button> : <Button variant="outline" disabled>{isVietnamese ? "Đang xử lý" : "Working"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ZERO_DECIMAL_CURRENCIES = ["VND", "JPY", "KRW"];

function getBudgetDivider(currency?: string): number {
  if (!currency) return 100;
  return ZERO_DECIMAL_CURRENCIES.includes(currency.toUpperCase()) ? 1 : 100;
}

function campaignStatus(campaign: MetaCampaign) {
  return campaign.effective_status || campaign.status || "UNKNOWN";
}

function isActiveCampaign(campaign: MetaCampaign) {
  return campaignStatus(campaign) === "ACTIVE";
}

function campaignObjectiveLabel(campaign: MetaCampaign, language: InterfaceLanguage) {
  const objective = String(campaign.objective || "").toUpperCase();
  const labels: Record<string, { en: string; vi: string }> = {
    OUTCOME_AWARENESS: { en: "Awareness", vi: "Nhận diện" },
    OUTCOME_TRAFFIC: { en: "Traffic", vi: "Lưu lượng truy cập" },
    OUTCOME_ENGAGEMENT: { en: "Engagement", vi: "Tương tác" },
    OUTCOME_LEADS: { en: "Leads", vi: "Khách hàng tiềm năng" },
    OUTCOME_APP_PROMOTION: { en: "App promotion", vi: "Quảng bá ứng dụng" },
    OUTCOME_SALES: { en: "Sales", vi: "Doanh số" },
    LINK_CLICKS: { en: "Traffic", vi: "Lưu lượng truy cập" },
    MESSAGES: { en: "Messages", vi: "Tin nhắn" },
    CONVERSIONS: { en: "Conversions", vi: "Chuyển đổi" },
  };
  const known = labels[objective];
  if (known) return known[language];
  if (!objective) return language === "vi" ? "Chưa có mục tiêu" : "Objective unavailable";
  return objective
    .replace(/^OUTCOME_/, "")
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatCampaignBudget(campaign: MetaCampaign, currency: string, language: InterfaceLanguage) {
  const copy = adsCopy[language].campaign;
  const daily = Number(campaign.daily_budget || 0);
  const lifetime = Number(campaign.lifetime_budget || 0);
  const divider = getBudgetDivider(currency);
  if (daily > 0) return `- ${formatMetric(daily / divider, "currency", currency)}/${copy.day}`;
  if (lifetime > 0) return `- ${formatMetric(lifetime / divider, "currency", currency)} ${copy.lifetime}`;
  return "";
}

export function providerLabel(provider: Provider, language: InterfaceLanguage, capabilities?: CapabilityStatus[]) {
  if (provider === "9router") return language === "vi" ? "Trợ lý AI" : "AI assistant";
  if (provider === "prompt") return language === "vi" ? "Luật local" : "Local rules only";
  const enhancement = capabilities?.find((capability) => capability.key === "ai_enhancement");
  if (enhancement?.state === "available") return language === "vi" ? "AI sẵn sàng" : "AI ready";
  if (enhancement?.state === "degraded") return language === "vi" ? "Phân tích local — AI tạm tắt" : "Local analysis — AI offline";
  return language === "vi" ? "Tự chọn nguồn tốt nhất" : "Auto: best available";
}

function packLabel(pack: KpiPack, language: InterfaceLanguage) {
  if (language === "en") return packItems.find((item) => item.value === pack)?.label || pack;
  const labels: Record<KpiPack, string> = {
    lead_gen: "Lead / tin nhắn",
    messages: "Tin nhắn",
    sales_roas: "Sales / ROAS",
    traffic: "Traffic",
    awareness: "Awareness",
  };
  return labels[pack];
}

function compareLabel(mode: CompareMode, language: InterfaceLanguage) {
  if (mode === "off") return language === "vi" ? "Không so sánh" : "No compare";
  return modeLabel(mode, language);
}

function modeLabel(mode: CompareMode, language: InterfaceLanguage = "en") {
  if (mode === "previous") return language === "vi" ? "Kỳ trước" : "Previous period";
  if (mode === "campaign") return language === "vi" ? "Nhóm campaign" : "Campaign group";
  if (mode === "wow") return "WoW";
  if (mode === "mom") return "MoM";
  if (mode === "yoy") return "YoY";
  return language === "vi" ? "Tắt" : "Off";
}
