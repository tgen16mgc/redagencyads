"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  BotMessageSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import BorderGlow from "@/components/BorderGlow";
import type { ClientReportPdfFile } from "@/lib/client-report";
import { buildSampleReport, SAMPLE_CAMPAIGNS } from "@/lib/sample-report";
import { BreakdownAnalysisSection, ChartEmpty, paddedPositiveDomain } from "@/components/dashboard/breakdown-analysis";
import { CONTEXT_CHAT_PANEL_ID } from "@/components/dashboard/context-chat-copy";
import { CustomChartsSection } from "@/components/dashboard/custom-charts-section";
import { DiagnosticCard } from "@/components/dashboard/diagnostic-card";
import { PerformanceV2 } from "@/components/dashboard/performance-v2";
import { sanitizeAdPreviewHtml } from "@/lib/ad-preview-html";
import { isAbortError, jsonFetch } from "@/lib/api-client";
import { detectBaselineAnomalies, anomalyBadgeText } from "@/lib/baseline-anomaly";
import type { CapabilityStatus } from "@/lib/capabilities";
import { chartSeriesDot, performanceChartConfig } from "@/lib/chart-palette";
import {
  chartMetricUnavailableLabel,
  chartMetricValue,
  compactDate,
  detectTrendAnnotation,
  formatChartValue,
  getPackChartSpec,
  metricValue,
  roundForFormat,
  roundMetric,
  sortByDrilldown,
  truncateLabel,
  type ChartFormat,
  type ChartKey,
} from "@/lib/chart-spec";
import { analyzeComparisonRootCauses } from "@/lib/comparison-root-cause";
import { classifyCreativeFatigue, computeCreativeFatigueBaseline } from "@/lib/creative-fatigue";
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
import type { DecisionTargets } from "@/lib/decision-confidence";
import { runDiagnostics } from "@/lib/diagnosis";
import type { HealthScoreSummary } from "@/lib/health-score";
import { buildKpiComparisons } from "@/lib/metric-comparison";
import { formatMetric } from "@/lib/metrics";
import {
  FUNNEL_STAGE_STORAGE_KEY,
  defaultPerformanceStageKeys,
  deserializePerformanceStageKeys,
  getPerformanceStageCatalog,
  serializePerformanceStageKeys,
  type PerformanceStageKey,
} from "@/lib/performance-stages";
import { getCompareRange } from "@/lib/report-ranges";
import {
  buildDashboardReportKey,
  buildMetaReportUrl,
  buildReportRequestKey,
  currentReportScope,
  toggleReportCampaignSelection,
} from "@/lib/report-refresh";
import { rowDecision } from "@/lib/row-decision";
import { readStorageSlot } from "@/lib/storage-slot";
import type {
  AdSetWithPreviews,
  AiInsightTable,
  CompareMode,
  DashboardReport,
  InterfaceLanguage,
  KpiCard,
  KpiPack,
  MetaAccount,
  MetaCampaign,
  NormalizedRow,
  Verdict,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type ReportScopePatch = Partial<Pick<
  AdsWorkspaceState,
  "selectedCampaignIds" | "since" | "until" | "pack" | "compareMode" | "targetCpa" | "targetRoas"
>>;

type ReportRequestOverrides = ReportScopePatch & { accountId?: string };

const compareItems: { label: string; value: CompareMode }[] = [
  { label: "Previous period", value: "previous" },
  { label: "Campaign group", value: "campaign" },
  { label: "No comparison", value: "off" },
];

const adsCopy = {
  en: {
    scope: {
      title: "Scope",
      description: "Define the evidence window and rules for this report.",
      account: "Ad account",
      chooseAccount: "Choose account",
      since: "Since",
      until: "Until",
      sourceTitle: "Source and period",
      analysisTitle: "Analysis rules",
      thresholdsTitle: "Decision thresholds",
      thresholdsHelp: "Optional guardrails used by scale and budget recommendations.",
      kpiPack: "KPI pack",
      autoDetect: "Auto-detect",
      kpiHelp: "Objective/name/actions decide default; override anytime.",
      compare: "Compare",
      pullData: "Pull data",
      pullReport: "Pull report",
      ready: "Ready to pull",
      pullingReport: "Pulling report",
      loadingAccount: "Loading account data...",
      loadingCampaigns: "Loading campaigns before the scope can run...",
      chooseAccountHint: "Choose an ad account to continue.",
      invalidDate: "Until must be the same as or later than Since.",
      checkDates: "Check dates",
      readyHint: "The report will use the scope and decision rules shown here.",
    },
    empty: {
      reportTitle: "No report loaded",
      reportDescription: "Choose account and campaign scope, then pull report from Meta Graph API.",
      rowsTitle: "No rows",
      rowsDescription: "Meta returned no insight rows for this scope.",
    },
    campaign: {
      label: "Campaigns",
      selected: "selected",
      allActive: "All active",
      inScope: "in report scope",
      hide: "Hide",
      edit: "Choose",
      search: "Search campaigns",
      all: "Select shown",
      customScope: "Custom scope",
      activeCampaigns: "active campaigns",
      loading: "Loading campaigns",
      noObjective: "No objective",
      none: "No campaigns found.",
      help: "Click campaigns to build a custom scope. Leave empty to pull all active campaigns.",
      day: "day",
      lifetime: "lifetime",
    },
    adsetPreview: {
      day: "day",
      lifetime: "lifetime",
    },
    performance: {
      title: "Performance view",
      description: "Detected pack: {detected}. Active pack: {active}. {reason}",
      campaigns: "Campaigns",
      adsets: "Ad sets",
      ads: "Ads",
      daily: "Daily",
    },
    table: {
      date: "Date",
      name: "Name",
      spend: "Spend",
      impressions: "Impr.",
      ctr: "CTR",
      messages: "Messages",
      leads: "Leads",
      costMessage: "Cost/msg",
      cpl: "CPL",
      action: "Action",
      creativeFatigue: "Creative",
    },
    verdict: {
      provider: "Provider",
      generate: "Generate verdict",
      copied: "Copied",
      copyPrompt: "Copy prompt",
      emptyTitle: "No Verdict yet",
      emptyDescription: "Generate after pulling report. Export will include this section once available.",
    },
  },
  vi: {
    scope: {
      title: "Phạm vi",
      description: "Xác định khoảng dữ liệu và quy tắc cho báo cáo này.",
      account: "Tài khoản ads",
      chooseAccount: "Chọn tài khoản",
      since: "Từ ngày",
      until: "Đến ngày",
      sourceTitle: "Nguồn và thời gian",
      analysisTitle: "Quy tắc phân tích",
      thresholdsTitle: "Ngưỡng ra quyết định",
      thresholdsHelp: "Guardrail tùy chọn cho đề xuất scale và điều chuyển ngân sách.",
      kpiPack: "Bộ KPI",
      autoDetect: "Tự nhận diện",
      kpiHelp: "Objective/tên/action quyết định mặc định; có thể override.",
      compare: "So sánh",
      pullData: "Kéo dữ liệu",
      pullReport: "Kéo báo cáo",
      ready: "Sẵn sàng kéo",
      pullingReport: "Đang kéo báo cáo",
      loadingAccount: "Đang tải dữ liệu tài khoản...",
      loadingCampaigns: "Đang tải campaign trước khi chạy phạm vi...",
      chooseAccountHint: "Chọn tài khoản ads để tiếp tục.",
      invalidDate: "Đến ngày phải bằng hoặc sau Từ ngày.",
      checkDates: "Kiểm tra ngày",
      readyHint: "Báo cáo sẽ dùng phạm vi và quy tắc quyết định hiển thị tại đây.",
    },
    empty: {
      reportTitle: "Chưa có báo cáo",
      reportDescription: "Chọn tài khoản và campaign, rồi kéo báo cáo từ Meta Graph API.",
      rowsTitle: "Không có dòng",
      rowsDescription: "Meta không trả insight rows cho phạm vi này.",
    },
    campaign: {
      label: "Campaign",
      selected: "đã chọn",
      allActive: "Tất cả active",
      inScope: "trong phạm vi báo cáo",
      hide: "Ẩn",
      edit: "Chọn",
      search: "Tìm campaign",
      all: "Chọn kết quả",
      customScope: "Phạm vi tùy chỉnh",
      activeCampaigns: "campaign active",
      loading: "Đang tải campaign",
      noObjective: "Không có objective",
      none: "Không tìm thấy campaign.",
      help: "Bấm campaign để tạo phạm vi tùy chỉnh. Để trống để kéo tất cả campaign active.",
      day: "ngày",
      lifetime: "lifetime",
    },
    adsetPreview: {
      day: "ngày",
      lifetime: "lifetime",
    },
    performance: {
      title: "Hiệu quả",
      description: "Bộ nhận diện: {detected}. Bộ đang dùng: {active}. {reason}",
      campaigns: "Campaign",
      adsets: "Ad set",
      ads: "Ads",
      daily: "Ngày",
    },
    table: {
      date: "Ngày",
      name: "Tên",
      spend: "Chi tiêu",
      impressions: "Impr.",
      ctr: "CTR",
      messages: "Tin nhắn",
      leads: "Lead",
      costMessage: "Cost/msg",
      cpl: "CPL",
      action: "Hành động",
      creativeFatigue: "Creative",
    },
    verdict: {
      provider: "Provider",
      generate: "Tạo Verdict",
      copied: "Đã copy",
      copyPrompt: "Copy prompt",
      emptyTitle: "Chưa có Verdict",
      emptyDescription: "Tạo sau khi kéo báo cáo. File export sẽ có phần này khi sẵn sàng.",
    },
  },
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
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  aiLoading: { verdict: boolean; insights: boolean };
  copiedPrompt: boolean;
  scopeExpanded: boolean;
  diagnosticsOpen: boolean;
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
    verdict: null,
    insights: null,
    aiLoading: { verdict: false, insights: false },
    copiedPrompt: false,
    scopeExpanded: false,
    diagnosticsOpen: false,
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

type AiProgressState = {
  elapsedSeconds: number;
  percent: number;
  stepIndex: number;
};

function useTimedProgress(active: boolean) {
  const [progress, setProgress] = React.useState<AiProgressState | null>(null);

  React.useEffect(() => {
    if (!active) {
      setProgress(null);
      return;
    }

    const startedAt = Date.now();
    const update = () => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const stepIndex = elapsedSeconds < 10 ? 0 : elapsedSeconds < 45 ? 1 : elapsedSeconds < 100 ? 2 : 3;
      setProgress({
        elapsedSeconds,
        percent: Math.min(96, 10 + elapsedSeconds * 0.6),
        stepIndex,
      });
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  return progress;
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
  decisionTargets,
  exportingPdf,
  chatShortcutsDisabled,
  onProviderChange,
  onAccountIdChange,
  onLoadingChange,
  onError,
  onStateChange,
  onSaveCustomKpis,
  onExportPdf,
  onOpenAssistant,
  onCancelInitialScope,
  onReportReady,
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
  decisionTargets: DecisionTargets;
  exportingPdf: boolean;
  chatShortcutsDisabled: boolean;
  onProviderChange: (value: Provider) => void;
  onAccountIdChange: (id: string) => void;
  onLoadingChange: (value: string) => void;
  onError: (message: string) => void;
  onStateChange: React.Dispatch<React.SetStateAction<AdsWorkspaceState>>;
  onSaveCustomKpis: (keys: CustomKpiKey[]) => void;
  onExportPdf: () => Promise<ClientReportPdfFile>;
  onOpenAssistant: () => void;
  onCancelInitialScope: () => void;
  onReportReady?: () => void;
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
    verdict,
    insights,
    aiLoading,
    copiedPrompt,
    scopeExpanded,
    diagnosticsOpen,
    customKpiKeys,
    funnelStageKeys,
    customCharts,
  } = state;
  const copy = adsCopy[language];
  const reportStartRef = React.useRef<HTMLDivElement>(null);
  const autoVerdictKeyRef = React.useRef("");
  const lastReportRequestRef = React.useRef<ReportRequestOverrides>({});
  const reportRequestSequenceRef = React.useRef(0);
  const reportReadySequenceRef = React.useRef(0);
  const activeReportRequestRef = React.useRef<{ id: number; key: string; controller: AbortController } | null>(null);
  const aiRequestSequenceRef = React.useRef({ verdict: 0, insights: 0 });
  const activeAiRequestRef = React.useRef<Partial<Record<keyof AdsWorkspaceState["aiLoading"], { id: number; reportKey: string; controller: AbortController }>>>({});
  const [reportFlow, setReportFlow] = React.useState<"idle" | "pulling" | "ready" | "error">("idle");
  const [reportFlowError, setReportFlowError] = React.useState("");
  const verdictProgress = useTimedProgress(aiLoading.verdict);
  const insightProgress = useTimedProgress(aiLoading.insights);
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
  const diagnostics = React.useMemo(() => (report ? runDiagnostics(report, decisionTargets) : []), [report, decisionTargets]);
  const reportCurrency = report?.account.currency || "VND";
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

  async function fetchReportForRange(range: { since: string; until: string }, overrides: ReportRequestOverrides = {}, signal?: AbortSignal) {
    const resolvedPack = overrides.pack ?? pack;
    const url = buildMetaReportUrl(window.location.origin, {
      accountId: overrides.accountId ?? accountId,
      selectedCampaignIds: overrides.selectedCampaignIds ?? selectedCampaignIds,
      since: range.since,
      until: range.until,
      pack: resolvedPack,
    });
    return jsonFetch<{ report: DashboardReport }>(url, { timeoutMs: 30000, signal });
  }

  async function pullReport(overrides: ReportRequestOverrides = {}) {
    const { accountId: requestedAccountId, ...stateOverrides } = overrides;
    const resolvedAccountId = requestedAccountId ?? accountId;
    const resolvedSelectedCampaignIds = overrides.selectedCampaignIds ?? selectedCampaignIds;
    const nextSince = overrides.since ?? since;
    const nextUntil = overrides.until ?? until;
    const nextPack = overrides.pack ?? pack;
    const nextCompareMode = overrides.compareMode ?? compareMode;
    const sampleMode = report?.source === "sample" && !accountId;
    if ((!sampleMode && !resolvedAccountId) || !nextSince || !nextUntil || nextSince > nextUntil) return;

    const requestKey = buildReportRequestKey({
      accountId: resolvedAccountId || report?.account.id || "sample",
      selectedCampaignIds: resolvedSelectedCampaignIds,
      since: nextSince,
      until: nextUntil,
      pack: nextPack,
      compareMode: nextCompareMode,
    });
    if (activeReportRequestRef.current?.key === requestKey) return;

    abortAiRequests();
    activeReportRequestRef.current?.controller.abort();
    const requestId = ++reportRequestSequenceRef.current;
    reportReadySequenceRef.current = 0;
    const controller = new AbortController();
    activeReportRequestRef.current = { id: requestId, key: requestKey, controller };
    lastReportRequestRef.current = overrides;
    const requestIsCurrent = () => activeReportRequestRef.current?.id === requestId && !controller.signal.aborted;

    if (sampleMode) {
      const sampleSelectedIds = resolvedSelectedCampaignIds;
      const samplePack = nextPack;
      setReportFlowError("");
      setReportFlow("pulling");
      onLoadingChange("report");
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
        if (!requestIsCurrent()) return;
        const current = buildSampleReport({ selectedCampaignIds: sampleSelectedIds, pack: samplePack, dateRange: { since: nextSince, until: nextUntil } });
        let sampleComparison: DashboardReport | null = null;
        if (nextCompareMode === "campaign") {
          if (!sampleSelectedIds.length) throw new Error("Choose at least one campaign before comparing it with the peer group.");
          const peerIds = SAMPLE_CAMPAIGNS.filter((campaign) => !sampleSelectedIds.includes(campaign.id)).map((campaign) => campaign.id);
          if (!peerIds.length) throw new Error("No active peer campaigns are available outside the selected group.");
          sampleComparison = buildSampleReport({ selectedCampaignIds: peerIds, pack: samplePack, dateRange: { since: nextSince, until: nextUntil } });
        } else if (nextCompareMode !== "off") {
          sampleComparison = buildSampleReport({ selectedCampaignIds: sampleSelectedIds, pack: samplePack, dateRange: getCompareRange({ since: nextSince, until: nextUntil }, nextCompareMode) });
        }
        if (!requestIsCurrent()) return;
        updateState({
          ...stateOverrides,
          report: current,
          previousReport: sampleComparison,
          selectedCampaignIds: current.selectedCampaigns.map((campaign) => campaign.id),
          since: current.dateRange.since,
          until: current.dateRange.until,
          pack: current.selectedPack,
          compareMode: nextCompareMode,
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
      const current = await fetchReportForRange({ since: nextSince, until: nextUntil }, overrides, controller.signal);
      if (!requestIsCurrent()) return;
      const refreshedScope = currentReportScope(current.report);
      let nextPreviousReport: DashboardReport | null = null;
      if (nextCompareMode !== "off") {
        const selectedIds = refreshedScope.selectedCampaignIds;
        if (nextCompareMode === "campaign" && !selectedIds.length) {
          throw new Error("Choose at least one campaign before comparing it with the peer group.");
        }
        const comparisonOverrides = nextCompareMode === "campaign"
          ? { ...overrides, accountId: refreshedScope.accountId, pack: refreshedScope.pack, selectedCampaignIds: campaigns.filter((campaign) => campaignStatus(campaign) === "ACTIVE" && !selectedIds.includes(campaign.id)).map((campaign) => campaign.id) }
          : { ...overrides, accountId: refreshedScope.accountId, pack: refreshedScope.pack, selectedCampaignIds: selectedIds };
        if (nextCompareMode === "campaign" && !comparisonOverrides.selectedCampaignIds?.length) {
          throw new Error("No active peer campaigns are available outside the selected group.");
        }
        const previousRange = getCompareRange({ since: nextSince, until: nextUntil }, nextCompareMode);
        const previous = await fetchReportForRange(previousRange, comparisonOverrides, controller.signal);
        if (!requestIsCurrent()) return;
        nextPreviousReport = previous.report;
      }
      updateState({
        ...stateOverrides,
        report: current.report,
        previousReport: nextPreviousReport,
        selectedCampaignIds: refreshedScope.selectedCampaignIds,
        since: refreshedScope.since,
        until: refreshedScope.until,
        pack: refreshedScope.pack,
        compareMode: nextCompareMode,
        verdict: null,
        insights: null,
        aiLoading: { verdict: false, insights: false },
        scopeExpanded: false,
      });
      if (requestedAccountId && requestedAccountId !== accountId) onAccountIdChange(refreshedScope.accountId);
      onReportReady?.();
      window.setTimeout(() => reportStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      if (Object.keys(overrides).length) {
        toast.success(language === "vi" ? "Đã áp dụng thay đổi" : "Changes applied", { description: language === "vi" ? "Báo cáo đã được kéo lại với phạm vi và quy tắc mới." : "The report was refreshed with the new scope and decision rules." });
      }
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

  React.useEffect(() => {
    if (!report || !reportHasData || verdict || aiLoading.verdict || reportFlow === "pulling") return;
    if (autoVerdictKeyRef.current === reportKey) return;
    autoVerdictKeyRef.current = reportKey;
    void runAi();
  }, [aiLoading.verdict, report, reportFlow, reportHasData, reportKey, verdict]);

  async function runInsights() {
    if (!report || !reportHasData || aiLoading.insights || reportFlow === "pulling") return;
    const sourceReport = report;
    const sourceReportKey = buildDashboardReportKey(sourceReport);
    const request = startAiRequest("insights", sourceReportKey);
    onError("");
    onStateChange((current) => ({ ...current, aiLoading: { ...current.aiLoading, insights: true } }));
    try {
      const data = await jsonFetch<{ insights: AiInsightTable }>("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report: sourceReport, previousReport, compareMode, language, provider }),
        timeoutMs: 150000,
        signal: request.controller.signal,
      });
      if (activeAiRequestRef.current.insights?.id !== request.id) return;
      onStateChange((current) => current.report && buildDashboardReportKey(current.report) === sourceReportKey
        ? { ...current, insights: data.insights }
        : current);
    } catch (err) {
      if (activeAiRequestRef.current.insights?.id === request.id && !isAbortError(err)) {
        onError(err instanceof Error ? err.message : "Could not generate insights.");
      }
    } finally {
      if (activeAiRequestRef.current.insights?.id === request.id) {
        delete activeAiRequestRef.current.insights;
        onStateChange((current) => current.report && buildDashboardReportKey(current.report) === sourceReportKey
          ? { ...current, aiLoading: { ...current.aiLoading, insights: false } }
          : current);
      }
    }
  }

  async function copyPrompt() {
    if (!report || !reportHasData) return;
    await navigator.clipboard.writeText(report.prompt);
    updateState({ copiedPrompt: true });
    window.setTimeout(() => updateState({ copiedPrompt: false }), 1500);
  }

  return (
    <>
      <ReportProgressDialog
        language={language}
        state={reportFlow}
        error={reportFlowError}
        onClose={() => setReportFlow("idle")}
        onRetry={() => void pullReport(lastReportRequestRef.current)}
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
          onAccountIdChange={report?.source === "sample" && !accountId ? () => undefined : onAccountIdChange}
          onOpenChange={(open) => {
            if (!open && !report) {
              onCancelInitialScope();
              return;
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
            campaigns={campaigns}
            selectedCampaignIds={selectedCampaignIds}
            since={since}
            until={until}
            pack={pack}
            compareMode={compareMode}
            funnelStageKeys={funnelStageKeys}
            exporting={exportingPdf}
            reviewing={aiLoading.verdict}
            reportLoading={loading === "report"}
            onEditScope={() => updateState({ scopeExpanded: true })}
            onRefresh={() => void pullReport(currentReportScope(report))}
            onExport={onExportPdf}
            onReviewActions={runAi}
            onApplyScope={(patch) => pullReport(patch)}
            customizeAction={
              <CustomKpiSetSheet
                defaultKpis={report.kpis}
                language={language}
                selectedKeys={customKpiKeys || effectiveKpis.map((kpi) => kpi.key as CustomKpiKey)}
                funnelPack={report.selectedPack}
                funnelStageKeys={funnelStageKeys || defaultPerformanceStageKeys(report.selectedPack)}
                onSave={onSaveCustomKpis}
                onSaveFunnelStages={(keys) => updateState({ funnelStageKeys: keys })}
              />
            }
            evidenceExtra={
              <CustomChartsSection
                controllerOnly
                report={report}
                language={language}
                saved={customCharts}
                onSavedChange={(update) => {
                  onStateChange((current) => ({
                    ...current,
                    customCharts: typeof update === "function" ? update(current.customCharts) : update,
                  }));
                }}
              />
            }
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
  onAccountIdChange,
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
  onAccountIdChange: (id: string) => void;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: ReportScopePatch) => void;
}) {
  const isVietnamese = language === "vi";
  const [draft, setDraft] = React.useState({ selectedCampaignIds, since, until, pack, compareMode, targetCpa, targetRoas });
  const [thresholdsEnabled, setThresholdsEnabled] = React.useState(Boolean(targetCpa || targetRoas));
  const wasOpenRef = React.useRef(false);
  const invalidDates = Boolean(draft.since && draft.until && draft.since > draft.until);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft({ selectedCampaignIds, since, until, pack, compareMode, targetCpa, targetRoas });
      setThresholdsEnabled(Boolean(targetCpa || targetRoas));
    }
    wasOpenRef.current = open;
  }, [open, selectedCampaignIds, since, until, pack, compareMode, targetCpa, targetRoas]);

  function save() {
    if (!accountId || invalidDates || loading === "report" || loading === "campaigns") return;
    onSave({
      ...draft,
      targetCpa: thresholdsEnabled ? draft.targetCpa : "",
      targetRoas: thresholdsEnabled ? draft.targetRoas : "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] min-w-0 max-w-[520px] flex-col gap-0 overflow-hidden rounded-[24px] border border-border bg-popover p-0 shadow-2xl" showCloseButton={false}>
        <DialogHeader className="shrink-0 flex-row items-center justify-between gap-4 border-b border-border px-4 py-4 text-left sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <SlidersHorizontalIcon className="size-[19px]" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold">{isVietnamese ? "Sửa phạm vi báo cáo" : "Edit report scope"}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">{isVietnamese ? "Chỉ thay đổi những gì ảnh hưởng đến quyết định." : "Change only what affects the decision."}</DialogDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">4 {isVietnamese ? "trường" : "fields"}</Badge>
            <button type="button" className="flex size-8 items-center justify-center rounded-[10px] border border-border bg-secondary text-muted-foreground transition-colors hover:text-foreground" aria-label={isVietnamese ? "Đóng" : "Close"} onClick={() => onOpenChange(false)}>
              <XIcon className="size-[15px]" />
            </button>
          </div>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <div className="grid min-w-0 gap-5">
            <section className="grid min-w-0 gap-3.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{isVietnamese ? "Nguồn & kỳ" : "Source & period"}</div>
              <Field className="min-w-0">
                <FieldLabel>{isVietnamese ? "Tài khoản quảng cáo" : "Ad account"}</FieldLabel>
                <Select
                  items={accounts.map((account) => ({ label: account.name, value: account.id }))}
                  value={accountId}
                  onValueChange={(value) => {
                    if (!value || value === accountId) return;
                    setDraft((current) => ({ ...current, selectedCampaignIds: [] }));
                    onAccountIdChange(value);
                  }}
                >
                  <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field className="min-w-0" data-invalid={invalidDates || undefined}>
                <FieldLabel>{isVietnamese ? "Khoảng evidence" : "Evidence window"}</FieldLabel>
                <div className="grid min-h-10 min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center overflow-hidden rounded-xl bg-secondary/75 ring-1 ring-foreground/5 focus-within:ring-2 focus-within:ring-ring">
                  <label className="sr-only" htmlFor="report-scope-since">{isVietnamese ? "Từ ngày" : "Since"}</label>
                  <Input id="report-scope-since" type="date" value={draft.since} onChange={(event) => setDraft((current) => ({ ...current, since: event.target.value }))} className="min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  <span className="px-1 text-sm text-muted-foreground">–</span>
                  <label className="sr-only" htmlFor="report-scope-until">{isVietnamese ? "Đến ngày" : "Until"}</label>
                  <Input id="report-scope-until" type="date" value={draft.until} onChange={(event) => setDraft((current) => ({ ...current, until: event.target.value }))} className="min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                </div>
              </Field>
              {invalidDates ? <p className="text-xs text-destructive">{isVietnamese ? "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." : "Until must be the same as or later than Since."}</p> : null}
            </section>

            <section className="grid min-w-0 gap-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{isVietnamese ? "Quy tắc quyết định" : "Decision rules"}</div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Field className="min-w-0">
                  <FieldLabel>KPI pack</FieldLabel>
                  <Select items={[{ label: "Auto-detect", value: "auto" }, ...packItems]} value={draft.pack} onValueChange={(value) => value && setDraft((current) => ({ ...current, pack: value as KpiPack | "auto" }))}>
                    <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="auto">{isVietnamese ? "Tự nhận diện" : "Auto-detect"}</SelectItem>{packItems.map((item) => <SelectItem key={item.value} value={item.value}>{packLabel(item.value, language)}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field className="min-w-0">
                  <FieldLabel>{isVietnamese ? "So sánh" : "Compare"}</FieldLabel>
                  <Select items={compareItems} value={draft.compareMode} onValueChange={(value) => value && setDraft((current) => ({ ...current, compareMode: value as CompareMode }))}>
                    <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>{compareItems.map((item) => <SelectItem key={item.value} value={item.value}>{compareLabel(item.value, language)}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 accent-[var(--primary)]"
                  checked={thresholdsEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setThresholdsEnabled(enabled);
                    if (enabled) setDraft((current) => ({ ...current, targetCpa: current.targetCpa || "40", targetRoas: current.targetRoas || "2.5" }));
                  }}
                />
                <span><span className="block text-sm font-medium">{isVietnamese ? "Áp dụng ngưỡng quyết định" : "Apply decision thresholds"}</span><span className="mt-0.5 block text-sm text-muted-foreground">{isVietnamese ? `Dùng CPA ${draft.targetCpa || "40"} và ROAS ${draft.targetRoas || "2.5"} làm guardrail khi scale.` : `Use CPA ${draft.targetCpa || "40"} and ROAS ${draft.targetRoas || "2.5"} as scale guardrails.`}</span></span>
              </label>
            </section>

            <section className="grid min-w-0 gap-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{isVietnamese ? "Phạm vi campaign" : "Campaign scope"}</div>
              <ReportScopeCampaignPicker
                open={open}
                campaigns={campaigns}
                currency={currency}
                language={language}
                loading={loading === "campaigns"}
                selectedIds={draft.selectedCampaignIds}
                onChange={(ids) => setDraft((current) => ({ ...current, selectedCampaignIds: ids }))}
              />
            </section>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border bg-popover px-4 py-4 sm:px-6">
          <span className="mr-auto hidden text-[11px] text-muted-foreground sm:block">{isVietnamese ? "Cập nhật báo cáo này ngay" : "Updates this report immediately"}</span>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>{isVietnamese ? "Hủy" : "Cancel"}</Button>
          <Button type="button" className="rounded-full" onClick={save} disabled={!accountId || invalidDates || loading === "report" || loading === "campaigns"}>{loading === "report" ? <Spinner data-icon="inline-start" /> : null}{isVietnamese ? "Áp dụng & làm mới" : "Apply & refresh"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportScopeCampaignPicker({ open, campaigns, currency, language, loading, selectedIds, onChange }: {
  open: boolean;
  campaigns: MetaCampaign[];
  currency: string;
  language: InterfaceLanguage;
  loading: boolean;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const isVietnamese = language === "vi";
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const activeCampaigns = React.useMemo(() => campaigns.filter(isActiveCampaign), [campaigns]);
  const activeCampaignIds = React.useMemo(() => activeCampaigns.map((campaign) => campaign.id), [activeCampaigns]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const scopedCampaigns = selectedIds.length ? campaigns.filter((campaign) => selectedSet.has(campaign.id)) : activeCampaigns;
  const primary = scopedCampaigns[0] || campaigns[0];
  const visibleCampaigns = campaigns.filter((campaign) => `${campaign.name} ${campaign.objective || ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 30);
  const allActive = selectedIds.length === 0;

  React.useEffect(() => {
    if (open) return;
    setExpanded(false);
    setQuery("");
  }, [open]);

  function toggle(id: string) {
    onChange(toggleReportCampaignSelection({ selectedIds, activeCampaignIds, campaignId: id }));
  }

  return (
    <div className="min-w-0">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge variant={scopedCampaigns.length ? "success" : "secondary"}>{scopedCampaigns.length} {isVietnamese ? "đã chọn" : "selected"}</Badge>
            <div className="mt-2 truncate text-sm font-medium" title={allActive ? undefined : primary?.name}>{allActive ? (isVietnamese ? "Tất cả campaign đang hoạt động" : "All active campaigns") : primary?.name || (isVietnamese ? "Chưa có campaign" : "No campaigns available")}</div>
            <div className="mt-1 truncate text-[11px] uppercase text-muted-foreground">
              {allActive
                ? (isVietnamese ? "Campaign active mới sẽ tự động được đưa vào phạm vi" : "New active campaigns will be included automatically")
                : primary
                  ? `${campaignObjectiveLabel(primary, language)}${scopedCampaigns.length > 1 ? ` · +${scopedCampaigns.length - 1}` : ""} ${formatCampaignBudget(primary, currency, language)}`
                  : (isVietnamese ? "Chưa có campaign" : "No campaigns available")}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => setExpanded((current) => !current)} disabled={loading || !campaigns.length} aria-expanded={expanded}>
            {expanded ? (isVietnamese ? "Xong" : "Done") : (isVietnamese ? "Thay đổi" : "Change")}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 min-w-0 overflow-hidden rounded-2xl border border-border bg-secondary/35 p-3">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVietnamese ? "Tìm campaign..." : "Search campaigns..."} />
            <Button type="button" variant="secondary" size="sm" onClick={() => onChange([])} disabled={loading}>{isVietnamese ? "Tất cả active" : "All active"}</Button>
          </div>
          <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto">
            {visibleCampaigns.map((campaign) => {
              const selected = selectedIds.length ? selectedSet.has(campaign.id) : isActiveCampaign(campaign);
              return (
                <button key={campaign.id} type="button" aria-pressed={selected} onClick={() => toggle(campaign.id)} className="grid w-full min-w-0 shrink-0 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-xl px-2.5 py-2 text-left hover:bg-secondary aria-pressed:bg-primary/10">
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

function ReportSkeleton({ language }: { language: InterfaceLanguage }) {
  const isVietnamese = language === "vi";
  const steps = isVietnamese
    ? ["Campaign", "Ad set", "Insight", "Breakdown"]
    : ["Campaigns", "Ad sets", "Insights", "Breakdowns"];
  const [activeStep, setActiveStep] = React.useState(0);
  const [percent, setPercent] = React.useState(8);

  React.useEffect(() => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setActiveStep(Math.min(steps.length - 1, Math.floor(elapsed / 3)));
      setPercent(Math.min(92, 8 + elapsed * 7));
    }, 400);
    return () => window.clearInterval(interval);
  }, [steps.length]);

  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Spinner className="size-4" />
          {isVietnamese ? "Đang kéo dữ liệu từ Meta và chuẩn bị dashboard..." : "Pulling Meta data and preparing your dashboard..."}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2" role="status" aria-live="polite">
          {steps.map((step, index) => {
            const done = index < activeStep;
            const active = index === activeStep;
            return (
              <div key={step} className="flex items-center gap-1.5 text-xs">
                <span
                  className={`flex size-4 items-center justify-center rounded-full ${
                    done ? "bg-primary text-primary-foreground" : active ? "workbench-step-active bg-primary" : "border bg-muted"
                  }`}
                >
                  {done ? <CheckIcon className="size-3" /> : null}
                </span>
                <span className={done || active ? "font-medium text-foreground" : "text-muted-foreground"}>{step}</span>
              </div>
            );
          })}
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-500"
            style={{ transform: `scaleX(${percent / 100})` }}
          />
        </div>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </section>
      </CardContent>
    </Card>
  );
}

function RunningAdSetsPanel({
  adsets,
  currency,
  language,
}: {
  adsets: AdSetWithPreviews[];
  currency: string;
  language: InterfaceLanguage;
}) {
  const isVietnamese = language === "vi";
  const eyebrow = isVietnamese ? "Cấu trúc & Quảng cáo" : "Ad Set Preview";
  const title = isVietnamese ? "Ad set & Creative đang chạy" : "Running Ad Sets & Creatives";
  const description = isVietnamese
    ? "Xem trước cấu trúc ad set active và bài đăng ad post đang chạy (banner, caption, ảnh, video)."
    : "Preview active ad set structure and currently running ad posts (banner, caption, image, video).";

  const [selectedAdSetId, setSelectedAdSetId] = React.useState<string>(adsets[0]?.id || "");
  const [selectedAdId, setSelectedAdId] = React.useState<string | null>(null);

  const selectedAdSet = adsets.find((a) => a.id === selectedAdSetId) || adsets[0];

  React.useEffect(() => {
    if (selectedAdSet?.ads && selectedAdSet.ads.length > 0) {
      setSelectedAdId(selectedAdSet.ads[0].id);
    } else {
      setSelectedAdId(null);
    }
  }, [selectedAdSetId, selectedAdSet?.ads]);

  if (!adsets || !adsets.length) return null;

  const selectedAd = selectedAdSet?.ads?.find((ad) => ad.id === selectedAdId) || selectedAdSet?.ads?.[0];
  const hasMultipleAdSets = adsets.length > 1;

  return (
    <div className="w-full rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5" data-print-flow>
      <div className="mb-6 flex flex-col gap-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
        <h2 className="text-xl font-semibold leading-none tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className={`grid gap-6 ${hasMultipleAdSets ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1"}`}>
        {hasMultipleAdSets && (
          <div className="flex flex-col gap-2 md:col-span-4 lg:col-span-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isVietnamese ? "Chọn Ad Set" : "Select Ad Set"}
            </div>
            <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto pr-2">
              {adsets.map((adset) => {
                const isSelected = selectedAdSetId === adset.id;
                return (
                  <button
                    key={adset.id}
                    onClick={() => setSelectedAdSetId(adset.id)}
                    className={`group flex w-full flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "border border-border/50 bg-background font-medium text-foreground shadow-sm"
                        : "border border-transparent bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <span className="line-clamp-2 text-sm">{adset.name}</span>
                    <span className={`text-xs ${isSelected ? "text-muted-foreground" : "opacity-70"}`}>
                      {formatAdSetBudget(adset, currency, language)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={hasMultipleAdSets ? "flex flex-col gap-4 md:col-span-8 lg:col-span-9" : "flex flex-col gap-4"}>
          <div className="rounded-xl border bg-background/50 p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-lg font-semibold">{selectedAdSet.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isVietnamese ? "Campaign: " : "Campaign: "}
                  <span className="font-medium text-foreground/80">{selectedAdSet.campaignName}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="rounded-full bg-background/50 backdrop-blur-sm">
                  {formatAdSetBudget(selectedAdSet, currency, language)}
                </Badge>
                <Badge variant="secondary" className="rounded-full">
                  {selectedAdSet.status}
                </Badge>
              </div>
            </div>

            {selectedAdSet.ads && selectedAdSet.ads.length > 0 ? (
              <>
                {selectedAdSet.ads.length > 1 && (
                  <div className="mb-5 flex flex-wrap gap-2">
                    {selectedAdSet.ads.map((ad, idx) => {
                      const isAdSelected = selectedAdId === ad.id;
                      return (
                        <button
                          key={ad.id}
                          onClick={() => setSelectedAdId(ad.id)}
                          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                            isAdSelected
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {ad.name || `Creative ${idx + 1}`}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedAd ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                      <div className="min-w-0 flex-1 truncate text-sm font-semibold">{selectedAd.name}</div>
                      <span className="shrink-0 text-xs text-muted-foreground">ID: {selectedAd.id}</span>
                    </div>
                    {selectedAd.previewHtml ? (
                      <div
                        className="flex w-full justify-center overflow-x-auto rounded-xl border bg-muted/20 p-4 sm:p-6"
                        data-ad-preview-frame
                      >
                        <div
                          className="relative max-h-[75vh] w-full max-w-[500px] overflow-y-auto overflow-x-hidden rounded-xl border border-border/50 bg-white shadow-sm [&_iframe]:!block [&_iframe]:!w-full [&_iframe]:!max-w-full [&_iframe]:!border-0"
                          data-ad-preview-html
                          dangerouslySetInnerHTML={{ __html: sanitizeAdPreviewHtml(selectedAd.previewHtml) }}
                        />
                      </div>
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed bg-muted/10 text-xs text-muted-foreground">
                        {isVietnamese ? "Không tải được bản xem trước" : "Unable to load ad preview"}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                {isVietnamese ? "Không có ad nào hoạt động trong ad set này." : "No active ads found in this ad set."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
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

function formatAdSetBudget(adset: AdSetWithPreviews, currency: string, language: InterfaceLanguage) {
  const copy = adsCopy[language].adsetPreview;
  const divider = getBudgetDivider(currency);
  if (adset.dailyBudget > 0) return `${formatMetric(adset.dailyBudget / divider, "currency", currency)}/${copy.day}`;
  if (adset.lifetimeBudget > 0) return `${formatMetric(adset.lifetimeBudget / divider, "currency", currency)} ${copy.lifetime}`;
  return language === "vi" ? "Không có ngân sách trực tiếp" : "No direct budget";
}

function ComparisonPanel({
  current,
  previous,
  mode,
  language,
}: {
  current: DashboardReport;
  previous: DashboardReport;
  mode: CompareMode;
  language: InterfaceLanguage;
}) {
  const isVietnamese = language === "vi";
  const rootCauses = analyzeComparisonRootCauses(current, previous);
  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5">
      <div className="mb-6 flex flex-col gap-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {isVietnamese ? "Động lực So sánh" : "Comparison Drivers"}
        </div>
        <h2 className="text-xl font-semibold leading-none tracking-tight text-foreground">
          {isVietnamese ? "Yếu tố dẫn dắt so sánh" : "Comparison Drivers"}: {modeLabel(mode, language)}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {isVietnamese ? "Thẻ KPI phía trên cho biết chỉ số nào đã thay đổi; phần này giải thích campaign/ad set nào đang dẫn dắt thay đổi đó." : "The KPI cards above show what changed; this section explains which matched campaigns or ad sets drove the movement."}{" "}
          {isVietnamese ? "Hiện tại" : "Current"} {current.dateRange.since} {isVietnamese ? "đến" : "to"} {current.dateRange.until}.{" "}
          {isVietnamese ? "Kỳ trước" : "Previous"} {previous.dateRange.since} {isVietnamese ? "đến" : "to"} {previous.dateRange.until}.
        </p>
      </div>

      <div className="rounded-xl border bg-background/50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isVietnamese ? "Nguyên nhân chính" : "Root-cause drivers"}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rootCauses.summary[language]}</p>
          </div>
          <Badge variant={rootCauses.status === "drivers_found" ? "secondary" : "outline"} className="shrink-0 rounded-full bg-background/50 backdrop-blur-sm">
            {rootCauses.status === "drivers_found" ? (isVietnamese ? "Có driver" : "Drivers found") : isVietnamese ? "Chưa rõ" : "No clear driver"}
          </Badge>
        </div>
        {rootCauses.drivers.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {rootCauses.drivers.map((driver) => (
              <div key={driver.rowId} className="rounded-xl border bg-card/70 p-4 text-sm shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{driver.rowName}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{driver.rowLevel}</div>
                  </div>
                  <Badge variant={driver.direction === "negative" ? "destructive" : "secondary"} className="shrink-0 rounded-full">
                    {driver.direction === "negative" ? (isVietnamese ? "Xấu" : "Negative") : isVietnamese ? "Tốt" : "Positive"}
                  </Badge>
                </div>
                <ul className="mt-4 flex flex-col gap-2 text-xs leading-5 text-muted-foreground">
                  {driver.evidence.slice(0, 4).map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t pt-3 text-xs leading-5 text-foreground/90">{driver.action[language]}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AiProgressStatus({
  kind,
  provider,
  progress,
  language,
}: {
  kind: "verdict" | "insights";
  provider: Provider;
  progress: AiProgressState | null;
  language: InterfaceLanguage;
}) {
  if (!progress) return null;

  const isVietnamese = language === "vi";
  const currentProviderLabel = providerLabel(provider, language);
  const verdictSteps = isVietnamese
    ? ["Tạo Verdict local", `Gọi ${currentProviderLabel}`, "Đợi model phản hồi", "Đọc JSON và kiểm tra kết quả"]
    : ["Generating local Verdict", `Calling ${currentProviderLabel}`, "Waiting for model response", "Parsing JSON and checking result"];
  const insightSteps = isVietnamese
    ? ["Chuẩn bị prompt insight", `Gọi ${currentProviderLabel}`, "Đợi model phản hồi", "Sắp xếp insight ưu tiên"]
    : ["Preparing insight prompt", `Calling ${currentProviderLabel}`, "Waiting for model response", "Organizing priority insights"];
  const steps = kind === "verdict" ? verdictSteps : insightSteps;
  const stepText = steps[Math.min(progress.stepIndex, steps.length - 1)];
  const elapsedText = isVietnamese ? `${progress.elapsedSeconds}s đã trôi qua` : `${progress.elapsedSeconds}s elapsed`;

  return (
    <div className="mb-4 rounded-md bg-muted/45 px-4 py-3" role="status" aria-live="polite" data-print-hidden>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Spinner className="size-4 shrink-0" />
          <span className="font-medium">{stepText}</span>
        </div>
        <Badge variant="outline" className="shrink-0">
          {elapsedText}
        </Badge>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-500"
          style={{ transform: `scaleX(${progress.percent / 100})` }}
        />
      </div>
    </div>
  );
}

function VerdictPanel({
  provider,
  loading,
  progress,
  verdict,
  copiedPrompt,
  language,
  onProviderChange,
  onGenerate,
  onCopyPrompt,
}: {
  provider: Provider;
  loading: boolean;
  progress: AiProgressState | null;
  verdict: Verdict | null;
  copiedPrompt: boolean;
  language: InterfaceLanguage;
  onProviderChange: (value: Provider) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
}) {
  const isVietnamese = language === "vi";
  const copy = adsCopy[language].verdict;
  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5" data-print-break data-print-flow>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {isVietnamese ? "Bộ máy quyết định" : "Decision Engine"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">Verdict</h2>
          <p className="text-sm text-muted-foreground">
            {isVietnamese
              ? "Verdict local có thể chạy không cần model; chế độ auto dùng AI để cải thiện khi có key."
              : "Local Verdict works without a model call; auto uses AI enhancement when a provider key exists."}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-end" data-print-hidden>
          <Field className="md:w-56">
            <FieldLabel>{copy.provider}</FieldLabel>
            <Select
              items={providerItems}
              value={provider}
              onValueChange={(value) => {
                if (value) onProviderChange(value as Provider);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {providerItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {providerLabel(item.value, language)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {!verdict && !loading ? (
            <BorderGlow
              active
              interactive
              showShadow={false}
              borderRadius={999}
              borderWidth={2.5}
              coneSpread={18}
              glowRadius={22}
              glowIntensity={1.5}
              backgroundColor="transparent"
            >
              <Button onClick={onGenerate} className="w-full">
                <SparklesIcon data-icon="inline-start" />
                {copy.generate}
              </Button>
            </BorderGlow>
          ) : (
            <Button onClick={onGenerate} disabled={loading}>
              {loading ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              {copy.generate}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCopyPrompt}>
            <ClipboardIcon data-icon="inline-start" />
            {copiedPrompt ? copy.copied : copy.copyPrompt}
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        {loading ? <AiProgressStatus kind="verdict" provider={provider} progress={progress} language={language} /> : null}
        {verdict ? (
          <VerdictCard verdict={verdict} language={language} />
        ) : (
          <Empty className="rounded-xl border bg-background/50">
            <EmptyHeader>
              <EmptyTitle>{copy.emptyTitle}</EmptyTitle>
              <EmptyDescription>{copy.emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}

function InsightPanel({
  provider,
  insights,
  loading,
  progress,
  compareMode,
  hasComparison,
  language,
  onGenerate,
}: {
  provider: Provider;
  insights: AiInsightTable | null;
  loading: boolean;
  progress: AiProgressState | null;
  compareMode: CompareMode;
  hasComparison: boolean;
  language: InterfaceLanguage;
  onGenerate: () => void;
}) {
  const visibleRows = insights?.rows.slice(0, 5) || [];
  const isVietnamese = language === "vi";
  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5" data-print-flow>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {isVietnamese ? "Chuyên gia AI" : "AI Analyst"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{isVietnamese ? "Tóm tắt insight AI" : "AI insight brief"}</h2>
          <p className="text-sm text-muted-foreground">
            {isVietnamese
              ? compareMode !== "off" && hasComparison
                ? "Các thay đổi chính, nguyên nhân và hành động đề xuất."
                : "Các hành động ưu tiên. Dữ liệu chi tiết nằm trong bảng drilldown."
              : compareMode !== "off" && hasComparison
                ? "Top comparison deltas, causes, and actions."
                : "Top action items. Full raw performance stays in drilldown tables."}
          </p>
        </div>
        <div className="flex justify-start md:justify-end" data-print-hidden>
          <Button type="button" onClick={onGenerate} disabled={loading}>
            {loading ? <Spinner data-icon="inline-start" /> : <FileTextIcon data-icon="inline-start" />}
            {isVietnamese ? "Tạo insight" : "Generate insights"}
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        {loading ? <AiProgressStatus kind="insights" provider={provider} progress={progress} language={language} /> : null}
        {insights ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border bg-background/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{providerLabel(insights.provider, language)}</Badge>
                <Badge variant="outline">{insights.confidence} confidence</Badge>
                <span className="text-sm text-muted-foreground">{insights.summary}</span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleRows.map((row, index) => (
                <div key={`${row.area}-${index}`} className="rounded-xl border bg-card/70 p-4 shadow-sm" data-print-expand>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">{row.area}</div>
                    <Badge variant={row.priority === "high" ? "destructive" : row.priority === "medium" ? "secondary" : "outline"}>
                      {row.priority}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-5" data-print-expand>
                    {row.insight}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground" data-print-expand>
                    {row.evidence}
                  </p>
                  <Separator className="my-3" />
                  <p className="line-clamp-2 text-sm leading-5" data-print-expand>
                    {row.action}
                  </p>
                </div>
              ))}
            </div>
            {insights.rows.length > visibleRows.length ? (
              <p className="text-xs text-muted-foreground" data-print-hidden>
                {isVietnamese
                  ? `Đang hiển thị ${visibleRows.length}/${insights.rows.length} insight ưu tiên. Xem bảng hiệu quả để drilldown sâu hơn.`
                  : `Showing top ${visibleRows.length} of ${insights.rows.length}. Use performance tables for deeper drilldown.`}
              </p>
            ) : null}
          </div>
        ) : (
          <Empty className="rounded-xl border bg-background/50">
            <EmptyHeader>
              <EmptyTitle>{isVietnamese ? "Chưa có insight AI" : "No insight table yet"}</EmptyTitle>
              <EmptyDescription>
                {isVietnamese ? "Tạo sau khi kéo báo cáo. Nội dung sẽ theo chế độ so sánh." : "Generate after report pull. It adapts to compare mode."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
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

function averageRows(rows: NormalizedRow[], key: ChartKey): number | null {
  const values = rows
    .map((row) => chartMetricValue(row, key))
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundedChartMetric(
  row: NormalizedRow,
  key: ChartKey,
  round: (value: number) => number,
): number | null {
  const value = chartMetricValue(row, key);
  return value === null ? null : round(value);
}

function performanceTooltipValue(
  value: unknown,
  key: ChartKey,
  format: ChartFormat,
  currency: string,
  language: InterfaceLanguage,
): string {
  if (value == null) return `— · ${chartMetricUnavailableLabel(key, language)}`;
  return formatChartValue(Number(value), format, currency);
}

function PerformanceCharts({ report, language }: { report: DashboardReport; language: InterfaceLanguage }) {
  const currency = report.account.currency || "VND";
  const spec = getPackChartSpec(report.selectedPack, language);
  const trendAnnotation = spec.trendKeys.map((key) => detectTrendAnnotation(report.dailyRows, key)).find((annotation) => annotation !== null);
  const anomalyResult = detectBaselineAnomalies(report.dailyRows);
  const referenceRows = report.dailyRows.filter((row) => Boolean(row.date)).slice(0, -Math.min(7, Math.floor(report.dailyRows.length / 2)));
  const trendReferenceValue = referenceRows.length ? averageRows(referenceRows, spec.trendKeys[0]) : null;
  const efficiencyReferenceValue = referenceRows.length ? averageRows(referenceRows, spec.efficiencyKeys[0]) : null;
  const diagnosticReferenceValue = Math.max(spec.referenceLine?.value || 0, spec.diagnosticKeys.includes("ctr") ? 1 : 0);
  const dailyData = report.dailyRows.map((row) => ({
    date: compactDate(row.date),
    spend: Math.round(row.spend),
    messages: row.messages,
    replies: row.replies,
    leads: row.leads,
    purchases: row.purchases,
    linkClicks: row.linkClicks,
    clicks: row.clicks,
    impressions: row.impressions,
    reach: row.reach,
    costPerMessage: roundedChartMetric(row, "costPerMessage", Math.round),
    costPerReply: roundedChartMetric(row, "costPerReply", Math.round),
    cpl: roundedChartMetric(row, "cpl", Math.round),
    cpaPurchase: roundedChartMetric(row, "cpaPurchase", Math.round),
    cpc: roundedChartMetric(row, "cpc", roundMetric),
    cpm: roundedChartMetric(row, "cpm", roundMetric),
    roas: roundedChartMetric(row, "roas", roundMetric),
    frequency: roundedChartMetric(row, "frequency", roundMetric),
    ctr: roundedChartMetric(row, "ctr", roundMetric),
  }));
  const adsetData = [...report.adsetRows]
    .sort((a, b) => sortByDrilldown(a, b, spec.drilldownKey, spec.higherIsBetter))
    .slice(0, 7)
    .map((row) => ({
      name: truncateLabel(row.name),
      spend: Math.round(row.spend),
      result: roundForFormat(metricValue(row, spec.drilldownKey), spec.drilldownFormat),
    }));

  if (!dailyData.length && !adsetData.length) {
    return (
      <div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5" data-print-flow>
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Không gian phân tích" : "Analytics Workspace"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{language === "vi" ? "Chưa có dữ liệu biểu đồ" : "No chart data yet"}</h2>
          <p className="text-sm text-muted-foreground">
            {language === "vi" ? "Cần dữ liệu theo ngày hoặc ad set để hiển thị xu hướng." : "Daily or ad set data is needed to show performance trends."}
          </p>
        </div>
        <div className="mt-5 rounded-xl border bg-background/50 p-4">
          <ChartEmpty language={language} />
        </div>
      </div>
    );
  }

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-3">
      <div className="min-w-0 rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5 xl:col-span-2">
        <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div className="flex min-w-0 max-w-2xl flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {language === "vi" ? "Theo dõi xu hướng" : "Trend Monitor"}
            </p>
            <h2 className="text-xl font-semibold tracking-tight">{spec.trendTitle}</h2>
            <p className="text-sm text-muted-foreground">{spec.trendDescription}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {anomalyResult.status === "anomalies_found" ? (
              anomalyResult.anomalies.slice(0, 2).map((anomaly) => (
                <Badge key={anomaly.key} variant={anomaly.severity === "danger" ? "destructive" : "outline"} className="shrink-0">
                  {anomalyBadgeText(anomaly, language)}
                </Badge>
              ))
            ) : null}
            {trendAnnotation ? <Badge variant="outline" className="shrink-0">{trendAnnotation.label}</Badge> : null}
          </div>
        </div>
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border bg-background/50 p-4">
          {dailyData.length ? (
            <ChartContainer config={performanceChartConfig} className="h-[280px] w-full">
              <ComposedChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                <YAxis yAxisId="spend" hide domain={paddedPositiveDomain()} />
                <YAxis yAxisId="outcomes" orientation="right" hide domain={paddedPositiveDomain(trendReferenceValue)} />
                {trendReferenceValue ? <ReferenceLine yAxisId="outcomes" y={trendReferenceValue} stroke="var(--chart-reference)" strokeDasharray="2 4" /> : null}
                <ChartTooltip
                  filterNull={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => performanceTooltipValue(
                        value,
                        name as ChartKey,
                        name === "spend" ? "currency" : spec.metricFormats[name as ChartKey] || "number",
                        currency,
                        language,
                      )}
                    />
                  }
                />
                <Bar yAxisId="spend" dataKey="spend" fill="var(--color-spend)" radius={[3, 3, 0, 0]} />
                {spec.trendKeys.map((key) => (
                  <Line key={key} yAxisId="outcomes" type="monotone" dataKey={key} connectNulls={false} stroke={`var(--color-${key})`} strokeWidth={trendAnnotation?.key === key ? 3 : 2} dot={false} />
                ))}
              </ComposedChart>
            </ChartContainer>
          ) : (
            <ChartEmpty language={language} />
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Đường hiệu quả" : "Efficiency Curve"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{spec.efficiencyTitle}</h2>
          <p className="text-sm text-muted-foreground">{spec.efficiencyDescription}</p>
        </div>
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border bg-background/50 p-4">
          {dailyData.length ? (
            <ChartContainer config={performanceChartConfig} className="h-[280px] w-full">
              <LineChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                <YAxis hide domain={paddedPositiveDomain(efficiencyReferenceValue)} />
                {efficiencyReferenceValue ? <ReferenceLine y={efficiencyReferenceValue} stroke="var(--chart-reference)" strokeDasharray="2 4" /> : null}
                <ChartTooltip
                  filterNull={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => performanceTooltipValue(
                        value,
                        name as ChartKey,
                        spec.metricFormats[name as ChartKey] || "currency",
                        currency,
                        language,
                      )}
                    />
                  }
                />
                {spec.efficiencyKeys.map((key) => (
                  <Line key={key} type="monotone" dataKey={key} connectNulls={false} stroke={`var(--color-${key})`} strokeWidth={2} dot={chartSeriesDot(key, 2.5)} />
                ))}
              </LineChart>
            </ChartContainer>
          ) : (
            <ChartEmpty language={language} />
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Tín hiệu chẩn đoán" : "Diagnostic Signal"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{spec.diagnosticTitle}</h2>
          <p className="text-sm text-muted-foreground">{spec.diagnosticDescription}</p>
        </div>
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border bg-background/50 p-4">
          {dailyData.length ? (
            <ChartContainer config={performanceChartConfig} className="h-[240px] w-full">
              <LineChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} />
                <YAxis hide domain={paddedPositiveDomain(diagnosticReferenceValue)} />
                {spec.referenceLine ? <ReferenceLine y={spec.referenceLine.value} stroke="var(--destructive)" strokeDasharray="4 4" /> : null}
                {spec.diagnosticKeys.includes("ctr") ? <ReferenceLine y={1} stroke="var(--chart-reference)" strokeDasharray="2 4" /> : null}
                <ChartTooltip
                  filterNull={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => performanceTooltipValue(
                        value,
                        name as ChartKey,
                        spec.metricFormats[name as ChartKey] || "number",
                        currency,
                        language,
                      )}
                    />
                  }
                />
                {spec.diagnosticKeys.map((key) => (
                  <Line key={key} type="monotone" dataKey={key} connectNulls={false} stroke={`var(--color-${key})`} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ChartContainer>
          ) : (
            <ChartEmpty language={language} />
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5 xl:col-span-2">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Phân rã nhóm quảng cáo" : "Ad Set Drilldown"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{spec.drilldownTitle}</h2>
          <p className="text-sm text-muted-foreground">{spec.drilldownDescription}</p>
        </div>
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border bg-background/50 p-4">
          {adsetData.length ? (
            <ChartContainer config={performanceChartConfig} className="h-[240px] w-full">
              <BarChart data={adsetData} layout="vertical" margin={{ left: 12, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide domain={paddedPositiveDomain()} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={142} tickMargin={8} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="tabular-nums">
                          {formatChartValue(Number(value), name === "spend" ? "currency" : spec.drilldownFormat, currency)}
                        </span>
                      )}
                    />
                  }
                />
                <Bar dataKey="spend" fill="var(--color-spend)" radius={4} />
                <Bar dataKey="result" fill="var(--color-result)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <ChartEmpty language={language} />
          )}
        </div>
      </div>
    </section>
  );
}

function PerformanceTable({
  rows,
  currency,
  language,
  daily = false,
  pack,
}: {
  rows: NormalizedRow[];
  currency: string;
  language: InterfaceLanguage;
  daily?: boolean;
  pack?: KpiPack;
}) {
  const copy = adsCopy[language];
  if (!rows.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{copy.empty.rowsTitle}</EmptyTitle>
          <EmptyDescription>{copy.empty.rowsDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{daily ? copy.table.date : copy.table.name}</TableHead>
          <TableHead className="text-right">{copy.table.spend}</TableHead>
          <TableHead className="text-right">{copy.table.impressions}</TableHead>
          <TableHead className="text-right">{copy.table.ctr}</TableHead>
          <TableHead className="text-right">{copy.table.messages}</TableHead>
          <TableHead className="text-right">{copy.table.leads}</TableHead>
          <TableHead className="text-right">{copy.table.costMessage}</TableHead>
          <TableHead className="text-right">{copy.table.cpl}</TableHead>
          <TableHead>{copy.table.creativeFatigue}</TableHead>
          {pack ? <TableHead>{copy.table.action}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {(() => {
          const fatigueBaseline = daily ? null : computeCreativeFatigueBaseline(rows);
          return rows.map((row) => {
          const action = pack ? rowDecision(row, pack, language) : null;
          const creativeSignal = classifyCreativeFatigue(row, fatigueBaseline);
          return (
            <TableRow key={`${row.level}-${row.id}-${row.date || ""}`} className="hover:bg-muted/40 transition-colors">
              <TableCell className="max-w-48 truncate font-medium">{daily ? row.date : row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMetric(row.spend, "currency", currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMetric(row.impressions, "number")}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMetric(row.ctr, "percent")}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMetric(row.messages, "number")}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMetric(row.leads, "number")}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMetric(row.costPerMessage, "currency", currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMetric(row.cpl, "currency", currency)}</TableCell>
              {creativeSignal ? (
                <TableCell className="min-w-44">
                  <div className="flex flex-col gap-1">
                    <Badge variant={creativeSignal.severity === "danger" ? "destructive" : creativeSignal.severity === "warning" ? "outline" : "secondary"}>
                      {creativeSignal.label[language]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{creativeSignal.reason[language]}</span>
                  </div>
                </TableCell>
              ) : null}
              {action ? (
                <TableCell>
                  <Badge variant={action.intent === "danger" ? "destructive" : action.intent === "good" ? "success" : "outline"}>
                    {action.label}
                  </Badge>
                </TableCell>
              ) : null}
            </TableRow>
          );
          });
        })()}
      </TableBody>
    </Table>
  );
}

function VerdictCard({ verdict, language }: { verdict: Verdict; language: InterfaceLanguage }) {
  const isVietnamese = language === "vi";
  const nextActions = [...verdict.budget_moves, ...verdict.tests].filter(Boolean).slice(0, 3);
  const highlights = verdict.winners.filter(Boolean).slice(0, 3);
  const risks = verdict.risks.filter(Boolean).slice(0, 3);
  const detailRows = [
    { title: isVietnamese ? "Điểm yếu" : "Losers", rows: verdict.losers },
    { title: isVietnamese ? "Điều chỉnh ngân sách" : "Budget moves", rows: verdict.budget_moves },
    { title: isVietnamese ? "Thử nghiệm đề xuất" : "Tests", rows: verdict.tests },
    { title: isVietnamese ? "Giả định dữ liệu" : "Assumptions", rows: verdict.assumptions },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4" data-print-expand>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">
            {isVietnamese ? "Verdict hiệu quả tháng" : "Monthly performance Verdict"}
          </div>
          <p className="mt-2 max-w-5xl text-base font-medium leading-7 md:text-lg">{compactText(verdict.verdict, 420)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{providerLabel(verdict.provider, language)}</Badge>
            <Badge variant="secondary">{verdict.confidence} confidence</Badge>
          </div>
          <Separator className="my-3" />
          <div className="text-xs font-medium uppercase text-muted-foreground">
            {isVietnamese ? "Đề xuất tối ưu kỳ tiếp theo" : "Next-period optimization recommendations"}
          </div>
          <CompactList rows={nextActions} emptyLabel={isVietnamese ? "Chưa có đề xuất." : "No recommendations."} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InsightSummary
          title={isVietnamese ? "Điểm hiệu quả" : "What is working"}
          rows={highlights}
          emptyLabel={isVietnamese ? "Chưa có tín hiệu tốt rõ ràng." : "No clear positive signal."}
        />
        <InsightSummary
          title={isVietnamese ? "Rủi ro cần xử lý" : "Risks to address"}
          rows={risks}
          emptyLabel={isVietnamese ? "Chưa có rủi ro rõ ràng." : "No clear risk."}
        />
      </div>

      <details className="rounded-lg border bg-background p-3" data-print-hidden>
        <summary className="cursor-pointer text-sm font-medium">
          {isVietnamese ? "Xem chi tiết AI" : "View AI detail"}
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {detailRows.map((group) => (
            <InsightSummary key={group.title} title={group.title} rows={group.rows.filter(Boolean).slice(0, 5)} emptyLabel={isVietnamese ? "Không có dữ liệu." : "No items."} />
          ))}
        </div>
      </details>
    </div>
  );
}

function InsightSummary({ title, rows, emptyLabel }: { title: string; rows: string[]; emptyLabel: string }) {
  const visibleRows = rows.filter(Boolean);
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {visibleRows.length ? (
        <ul className="mt-2 flex flex-col gap-2">
          {visibleRows.map((row, index) => (
            <li key={`${row}-${index}`} className="flex gap-2.5 text-sm leading-5">
              <span className="mt-[6px] size-2 shrink-0 rounded-full bg-primary/60" />
              <span>{compactText(row, 180)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

function CompactList({ rows, emptyLabel }: { rows: string[]; emptyLabel: string }) {
  if (!rows.length) return <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ol className="mt-2 flex flex-col gap-2">
      {rows.map((row, index) => (
        <li key={`${row}-${index}`} className="flex gap-2.5 text-sm leading-5">
          <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span>{compactText(row, 170)}</span>
        </li>
      ))}
    </ol>
  );
}

function compactText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength).trim();
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  return `${(sentenceEnd > maxLength * 0.55 ? clipped.slice(0, sentenceEnd + 1) : clipped).trim()}...`;
}
