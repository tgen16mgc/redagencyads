"use client";

import * as React from "react";
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
  ActivityIcon,
  BotMessageSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  RefreshCcwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import BorderGlow from "@/components/BorderGlow";
import { BreakdownAnalysisSection, ChartEmpty, paddedPositiveDomain } from "@/components/dashboard/breakdown-analysis";
import { CONTEXT_CHAT_PANEL_ID } from "@/components/dashboard/context-chat-copy";
import { CustomChartsSection } from "@/components/dashboard/custom-charts-section";
import { DiagnosticCard } from "@/components/dashboard/diagnostic-card";
import { StickyActionDock } from "@/components/dashboard/sticky-action-dock";
import { sanitizeAdPreviewHtml } from "@/lib/ad-preview-html";
import { jsonFetch } from "@/lib/api-client";
import { detectBaselineAnomalies, anomalyBadgeText } from "@/lib/baseline-anomaly";
import type { CapabilityStatus } from "@/lib/capabilities";
import { performanceChartConfig } from "@/lib/chart-palette";
import {
  compactDate,
  detectTrendAnnotation,
  formatChartValue,
  getPackChartSpec,
  metricValue,
  roundForFormat,
  roundMetric,
  sortByDrilldown,
  truncateLabel,
  type ChartKey,
} from "@/lib/chart-spec";
import { analyzeComparisonRootCauses } from "@/lib/comparison-root-cause";
import { classifyCreativeFatigue, computeCreativeFatigueBaseline } from "@/lib/creative-fatigue";
import {
  buildCustomKpiCards,
  type CustomKpiKey,
  deserializeCustomKpiSet,
  getCustomKpiCatalogGroups,
} from "@/lib/custom-kpi-set";
import type { DecisionTargets } from "@/lib/decision-confidence";
import { runDiagnostics } from "@/lib/diagnosis";
import type { HealthScoreSummary } from "@/lib/health-score";
import { buildKpiComparisons, formatComparisonChangePct, metricMovementIsBad } from "@/lib/metric-comparison";
import { formatMetric } from "@/lib/metrics";
import { getCompareRange } from "@/lib/report-ranges";
import { rowDecision } from "@/lib/row-decision";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

const compareItems: { label: string; value: CompareMode }[] = [
  { label: "No compare", value: "off" },
  { label: "WoW", value: "wow" },
  { label: "MoM", value: "mom" },
  { label: "YoY", value: "yoy" },
];

const adsCopy = {
  en: {
    scope: {
      title: "Scope",
      description: "Choose account, campaign scope, date range, and KPI pack.",
      account: "Ad account",
      chooseAccount: "Choose account",
      since: "Since",
      until: "Until",
      kpiPack: "KPI pack",
      autoDetect: "Auto-detect",
      kpiHelp: "Objective/name/actions decide default; override anytime.",
      compare: "Compare",
      pullData: "Pull data",
      pullReport: "Pull report",
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
      edit: "Edit",
      search: "Search campaigns",
      all: "All",
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
      description: "Chọn tài khoản, campaign, ngày và bộ KPI.",
      account: "Tài khoản ads",
      chooseAccount: "Chọn tài khoản",
      since: "Từ ngày",
      until: "Đến ngày",
      kpiPack: "Bộ KPI",
      autoDetect: "Tự nhận diện",
      kpiHelp: "Objective/tên/action quyết định mặc định; có thể override.",
      compare: "So sánh",
      pullData: "Kéo dữ liệu",
      pullReport: "Kéo báo cáo",
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
      edit: "Sửa",
      search: "Tìm campaign",
      all: "Tất cả",
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
};

export function initialAdsWorkspaceState(): AdsWorkspaceState {
  const dates = defaultDates();
  return {
    campaigns: [],
    selectedCampaignIds: [],
    since: dates.since,
    until: dates.until,
    pack: "auto",
    compareMode: "off",
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
  onExportPdf: () => void;
  onOpenAssistant: () => void;
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
  } = state;
  const copy = adsCopy[language];
  const reportStartRef = React.useRef<HTMLDivElement>(null);
  const verdictProgress = useTimedProgress(aiLoading.verdict);
  const insightProgress = useTimedProgress(aiLoading.insights);
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

  async function fetchReportForRange(range: { since: string; until: string }) {
    const url = new URL("/api/meta/report", window.location.origin);
    url.searchParams.set("accountId", accountId);
    url.searchParams.set("since", range.since);
    url.searchParams.set("until", range.until);
    selectedCampaignIds.forEach((id) => url.searchParams.append("campaignId", id));
    if (pack !== "auto") url.searchParams.set("pack", pack);
    return jsonFetch<{ report: DashboardReport }>(url.toString(), { timeoutMs: 30000 });
  }

  async function pullReport() {
    if (!accountId) return;
    onError("");
    updateState({ verdict: null, insights: null, aiLoading: { verdict: false, insights: false }, previousReport: null });
    onLoadingChange("report");
    try {
      const current = await fetchReportForRange({ since, until });
      updateState({ report: current.report, scopeExpanded: false });
      window.setTimeout(() => reportStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      if (compareMode !== "off") {
        const previousRange = getCompareRange({ since, until }, compareMode);
        const previous = await fetchReportForRange(previousRange);
        updateState({ previousReport: previous.report });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not pull Meta report.");
    } finally {
      onLoadingChange("");
    }
  }

  async function runAi() {
    if (!report || !reportHasData || aiLoading.verdict) return;
    onError("");
    onStateChange((current) => ({ ...current, aiLoading: { ...current.aiLoading, verdict: true } }));
    try {
      const data = await jsonFetch<{ verdict: Verdict }>("/api/ai/verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report, language, provider }),
        timeoutMs: 150000,
      });
      onStateChange((current) => ({ ...current, verdict: data.verdict }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not generate Verdict.");
    } finally {
      onStateChange((current) => ({ ...current, aiLoading: { ...current.aiLoading, verdict: false } }));
    }
  }

  async function runInsights() {
    if (!report || !reportHasData || aiLoading.insights) return;
    onError("");
    onStateChange((current) => ({ ...current, aiLoading: { ...current.aiLoading, insights: true } }));
    try {
      const data = await jsonFetch<{ insights: AiInsightTable }>("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report, previousReport, compareMode, language, provider }),
        timeoutMs: 150000,
      });
      onStateChange((current) => ({ ...current, insights: data.insights }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not generate insights.");
    } finally {
      onStateChange((current) => ({ ...current, aiLoading: { ...current.aiLoading, insights: false } }));
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
      {report && !scopeExpanded ? (
        <Card className="workbench-fade-up">
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">{accounts.find((account) => account.id === accountId)?.name || copy.scope.account}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{since} to {until}</span>
                <span>{selectedCampaignIds.length ? `${selectedCampaignIds.length} ${copy.campaign.selected}` : copy.campaign.allActive}</span>
                <span>{pack === "auto" ? copy.scope.autoDetect : packLabel(pack, language)}</span>
                <span>{compareLabel(compareMode, language)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => updateState({ scopeExpanded: true })}>
                {language === "vi" ? "Sửa phạm vi" : "Edit scope"}
              </Button>
              <Button onClick={pullReport} disabled={!accountId || loading === "report"}>
                {loading === "report" ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
                {language === "vi" ? "Kéo lại" : "Refresh report"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="workbench-fade-up">
          <CardHeader>
            <CardTitle>{copy.scope.title}</CardTitle>
            <CardDescription>{copy.scope.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <Field className="xl:col-span-2">
                <FieldLabel>{copy.scope.account}</FieldLabel>
                <Select
                  items={accounts.map((item) => ({ label: item.name, value: item.id }))}
                  value={accountId}
                  onValueChange={(value) => {
                    if (value) onAccountIdChange(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loading === "accounts" ? (language === "vi" ? "Đang tải tài khoản..." : "Loading accounts...") : copy.scope.chooseAccount} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <CampaignPicker
                campaigns={campaigns}
                currency={accounts.find((account) => account.id === accountId)?.currency || "VND"}
                language={language}
                loading={loading === "campaigns"}
                selectedIds={selectedCampaignIds}
                onChange={(ids) => updateState({ selectedCampaignIds: ids })}
              />
              <Field>
                <FieldLabel>{copy.scope.since}</FieldLabel>
                <Input type="date" value={since} onChange={(event) => updateState({ since: event.target.value })} />
              </Field>
              <Field>
                <FieldLabel>{copy.scope.until}</FieldLabel>
                <Input type="date" value={until} onChange={(event) => updateState({ until: event.target.value })} />
              </Field>
              <Field className="xl:col-span-2">
                <FieldLabel>{copy.scope.kpiPack}</FieldLabel>
                <Select
                  items={[{ label: "Auto-detect", value: "auto" }, ...packItems]}
                  value={pack}
                  onValueChange={(value) => {
                    if (value) updateState({ pack: value as KpiPack | "auto" });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={copy.scope.kpiPack} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="auto">{copy.scope.autoDetect}</SelectItem>
                      {packItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {packLabel(item.value, language)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{copy.scope.kpiHelp}</FieldDescription>
              </Field>
              <div className="rounded-lg border border-dashed bg-muted/15 p-3 md:col-span-2 xl:col-span-2">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {language === "vi" ? "Mục tiêu (tùy chọn)" : "Targets (optional)"}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>{language === "vi" ? "Target CPA" : "Target CPA"}</FieldLabel>
                    <Input type="number" min="0" step="0.01" inputMode="decimal" value={targetCpa} onChange={(event) => updateState({ targetCpa: event.target.value })} placeholder="40" />
                    <FieldDescription>{language === "vi" ? "Chặn scale nếu CPA vượt mục tiêu." : "Blocks scale when CPA is above target."}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>{language === "vi" ? "Target ROAS" : "Target ROAS"}</FieldLabel>
                    <Input type="number" min="0" step="0.01" inputMode="decimal" value={targetRoas} onChange={(event) => updateState({ targetRoas: event.target.value })} placeholder="2.5" />
                    <FieldDescription>{language === "vi" ? "Chặn scale sales nếu ROAS dưới mục tiêu." : "Blocks sales scale when ROAS is below target."}</FieldDescription>
                  </Field>
                </div>
              </div>
              <Field>
                <FieldLabel>{copy.scope.compare}</FieldLabel>
                <Select
                  items={compareItems}
                  value={compareMode}
                  onValueChange={(value) => {
                    if (value) {
                      const nextMode = value as CompareMode;
                      updateState(nextMode === "off" ? { compareMode: nextMode, previousReport: null } : { compareMode: nextMode });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {compareItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {compareLabel(item.value, language)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="justify-end">
                <FieldLabel className="sr-only">{copy.scope.pullData}</FieldLabel>
                <Button onClick={pullReport} disabled={!accountId || loading === "report" || loading === "accounts"} className="w-full">
                  {loading === "report" ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
                  {copy.scope.pullReport}
                </Button>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      {!report && loading !== "report" ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium">{language === "vi" ? "Sẵn sàng kéo dashboard" : "Ready to pull your dashboard"}</div>
              <div className="text-sm text-muted-foreground">
                {language === "vi" ? "Mặc định sẽ phân tích toàn bộ campaign active trong 30 ngày gần nhất." : "By default, this analyzes all active campaigns from the last 30 days."}
              </div>
            </div>
            <Button onClick={pullReport} disabled={!accountId || loading === "accounts" || loading === "report"} className="md:shrink-0">
              {loading === "report" ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
              {copy.scope.pullReport}
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {loading === "report" ? <ReportSkeleton language={language} /> : null}
      {!report && loading !== "report" ? <EmptyState language={language} /> : null}
      {report && !reportHasData ? (
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
      {report && reportHasData ? (
        <div ref={reportStartRef} className="workbench-fade-up flex flex-col gap-4 scroll-mt-4">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2" data-print-hidden>
              <div>
                <h2 className="font-heading text-lg font-semibold tracking-tight">{language === "vi" ? "KPI chính" : "Top KPIs"}</h2>
                <p className="text-sm text-muted-foreground">
                  {language === "vi" ? "Các thẻ này là phần hiển thị, không đổi bộ KPI đang chọn hoặc Verdict." : "These cards are display-only and do not change the selected KPI pack or Verdict."}
                </p>
              </div>
              <CustomKpiSetSheet
                defaultKpis={report.kpis}
                language={language}
                selectedKeys={customKpiKeys || effectiveKpis.map((kpi) => kpi.key as CustomKpiKey)}
                onSave={onSaveCustomKpis}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              {effectiveKpis.map((kpi) => {
                const comparison = kpiComparisons?.get(kpi.key as keyof NormalizedRow);

                return (
                  <Card key={kpi.key} size="sm">
                    <CardHeader>
                      <CardDescription className="text-xs font-medium uppercase tracking-wide">{kpi.label}</CardDescription>
                      <CardTitle className="text-3xl font-semibold tabular-nums leading-none">
                        {kpi.key === "healthScore" && healthSummary
                          ? `${healthSummary.score}/100`
                          : formatMetric(Number(report.totals[kpi.key as keyof NormalizedRow] || 0), kpi.format, report.account.currency || "VND")}
                      </CardTitle>
                      {comparison ? (
                        <CardDescription className={`text-xs tabular-nums ${metricMovementIsBad(kpi.key, comparison.change) ? "text-destructive" : "text-muted-foreground"}`}>
                          {comparison.change > 0 ? "↑" : comparison.change < 0 ? "↓" : "→"} {formatComparisonChangePct(comparison.changePct, language)} {comparison.descriptor}
                        </CardDescription>
                      ) : null}
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </section>

          <PerformanceCharts report={report} language={language} />

          <BreakdownAnalysisSection report={report} language={language} />

          <CustomChartsSection report={report} language={language} />

          {previousReport ? <ComparisonPanel current={report} previous={previousReport} mode={compareMode} language={language} /> : null}

          <VerdictPanel
            provider={provider}
            loading={aiLoading.verdict}
            progress={verdictProgress}
            verdict={verdict}
            copiedPrompt={copiedPrompt}
            language={language}
            onProviderChange={onProviderChange}
            onGenerate={runAi}
            onCopyPrompt={copyPrompt}
          />

          <InsightPanel
            provider={provider}
            insights={insights}
            loading={aiLoading.insights}
            progress={insightProgress}
            compareMode={compareMode}
            hasComparison={Boolean(previousReport)}
            language={language}
            onGenerate={runInsights}
          />

          {report.adsetPreviews ? (
            <RunningAdSetsPanel
              adsets={report.adsetPreviews}
              currency={report.account.currency || "VND"}
              language={language}
            />
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]" data-print-flow>
            <Card>
              <CardHeader>
                <CardTitle>{copy.performance.title}</CardTitle>
                <CardDescription>
                  {copy.performance.description
                    .replace("{detected}", report.detectedPack)
                    .replace("{active}", report.selectedPack)
                    .replace("{reason}", report.packReason)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="campaigns">
                  <TabsList>
                    <TabsTrigger value="campaigns">{copy.performance.campaigns}</TabsTrigger>
                    <TabsTrigger value="adsets">{copy.performance.adsets}</TabsTrigger>
                    <TabsTrigger value="ads">{copy.performance.ads}</TabsTrigger>
                    <TabsTrigger value="daily">{copy.performance.daily}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="campaigns" className="mt-3">
                    <PerformanceTable
                      rows={report.campaignRows}
                      currency={report.account.currency || "VND"}
                      language={language}
                      pack={report.selectedPack}
                    />
                  </TabsContent>
                  <TabsContent value="adsets" className="mt-3">
                    <PerformanceTable
                      rows={report.adsetRows}
                      currency={report.account.currency || "VND"}
                      language={language}
                      pack={report.selectedPack}
                    />
                  </TabsContent>
                  <TabsContent value="ads" className="mt-3">
                    <PerformanceTable
                      rows={report.adRows}
                      currency={report.account.currency || "VND"}
                      language={language}
                      pack={report.selectedPack}
                    />
                  </TabsContent>
                  <TabsContent value="daily" className="mt-3">
                    <PerformanceTable rows={report.dailyRows} currency={report.account.currency || "VND"} language={language} daily />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <DiagnosticCard diagnostic={diagnostics.find((diagnostic) => diagnostic.id === "healthTriage")!} language={language} currency={reportCurrency} />
          </section>

          <section data-print-flow>
            <DiagnosticCard diagnostic={diagnostics.find((diagnostic) => diagnostic.id === "dailyDiagnosis")!} language={language} currency={reportCurrency} />
          </section>

          <Collapsible open={diagnosticsOpen} onOpenChange={(open) => updateState({ diagnosticsOpen: open })} className="rounded-2xl border bg-card" data-print-flow>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  {language === "vi" ? "Evidence chẩn đoán chi tiết" : "Detailed diagnostic evidence"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language === "vi"
                    ? "13 kiểm tra chuyên sâu được ẩn mặc định để ưu tiên health score, nguyên nhân và hành động."
                    : "Thirteen deep checks stay collapsed so health, causes, and actions remain primary."}
                </p>
              </div>
              <CollapsibleTrigger render={<Button type="button" variant="outline" className="shrink-0" />}>
                {diagnosticsOpen
                  ? language === "vi" ? "Ẩn evidence" : "Hide evidence"
                  : language === "vi" ? "Mở 13 kiểm tra" : "Open 13 checks"}
                <ChevronDownIcon data-icon="inline-end" className={diagnosticsOpen ? "rotate-180" : undefined} />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="border-t p-4 sm:p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {diagnostics
                  .filter((diagnostic) => diagnostic.id !== "healthTriage" && diagnostic.id !== "dailyDiagnosis")
                  .map((diagnostic) => (
                    <DiagnosticCard key={diagnostic.id} diagnostic={diagnostic} language={language} currency={reportCurrency} />
                  ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

        </div>
      ) : null}
      {report && reportHasData ? (
        <StickyActionDock
          contextLabel={language === "vi" ? "Hiệu quả" : "Performance"}
          status={aiLoading.verdict ? "working" : "ready"}
          statusLabel={aiLoading.verdict
            ? language === "vi" ? "Đang tạo Verdict" : "Generating Verdict"
            : verdict
              ? language === "vi" ? "Verdict đã sẵn sàng" : "Verdict ready"
              : language === "vi" ? "Báo cáo đã sẵn sàng" : "Report ready"}
          primaryAction={{
            id: "verdict",
            label: verdict
              ? language === "vi" ? "Làm mới Verdict" : "Refresh Verdict"
              : language === "vi" ? "Tạo Verdict" : "Generate Verdict",
            shortLabel: "Verdict",
            icon: SparklesIcon,
            onSelect: runAi,
            loading: aiLoading.verdict,
            shortcut: "mod+enter",
          }}
          secondaryActions={[
            {
              id: "export",
              label: language === "vi" ? "Xuất báo cáo" : "Export report",
              icon: DownloadIcon,
              onSelect: onExportPdf,
              loading: exportingPdf,
            },
            {
              id: "copy-prompt",
              label: copiedPrompt
                ? language === "vi" ? "Đã copy prompt" : "Prompt copied"
                : language === "vi" ? "Copy prompt phân tích" : "Copy analyst prompt",
              icon: ClipboardIcon,
              onSelect: copyPrompt,
            },
          ]}
          shortcutsDisabled={chatShortcutsDisabled}
          companionAction={{
            id: "open-performance-assistant",
            label: language === "vi" ? "Hỏi trợ lý AI về hiệu quả" : "Ask the smart assistant about performance",
            shortLabel: language === "vi" ? "Trợ lý AI" : "Assistant",
            controlsId: CONTEXT_CHAT_PANEL_ID,
            icon: BotMessageSquareIcon,
            onSelect: onOpenAssistant,
          }}
          companionActive={chatShortcutsDisabled}
        />
      ) : null}
    </>
  );
}

function CustomKpiSetSheet({
  defaultKpis,
  language,
  selectedKeys,
  onSave,
}: {
  defaultKpis: KpiCard[];
  language: InterfaceLanguage;
  selectedKeys: CustomKpiKey[];
  onSave: (keys: CustomKpiKey[]) => void;
}) {
  const isVietnamese = language === "vi";
  const [open, setOpen] = React.useState(false);
  const [draftKeys, setDraftKeys] = React.useState<CustomKpiKey[]>(selectedKeys);
  const groups = getCustomKpiCatalogGroups(language);
  const selectedSet = React.useMemo(() => new Set(draftKeys), [draftKeys]);
  const selectedCards = buildCustomKpiCards(draftKeys);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setDraftKeys(selectedKeys.length ? selectedKeys : deserializeCustomKpiSet(null, defaultKpis));
  }

  function toggleMetric(key: CustomKpiKey) {
    setDraftKeys((current) => {
      if (current.includes(key)) return current.length > 1 ? current.filter((item) => item !== key) : current;
      return [...current, key];
    });
  }

  function handleSave() {
    if (!draftKeys.length) return;
    onSave(draftKeys);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <SlidersHorizontalIcon data-icon="inline-start" />
            {isVietnamese ? "Tùy chỉnh KPI" : "Customize KPIs"}
          </Button>
        }
      />
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isVietnamese ? "Tùy chỉnh KPI" : "Customize KPIs"}</SheetTitle>
          <SheetDescription>
            {isVietnamese
              ? "Chọn các thẻ KPI hiển thị ở đầu dashboard. Việc này không đổi bộ KPI hoặc Verdict."
              : "Choose the KPI cards shown at the top of the dashboard. This does not change the KPI pack or Verdict."}
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="flex flex-col gap-4 p-4">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isVietnamese ? "KPI đã chọn" : "Selected KPIs"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedCards.map((kpi, index) => (
                <Badge key={kpi.key} variant="secondary">
                  {index + 1}. {kpi.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</div>
                <div className="grid gap-2">
                  {group.metrics.map((metric) => {
                    const checked = selectedSet.has(metric.key);
                    const disabled = checked && draftKeys.length === 1;
                    return (
                      <label
                        key={metric.key}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleMetric(metric.key)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{metric.label}</span>
                          <span className="block text-xs text-muted-foreground">{metric.format}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Button type="button" onClick={handleSave} disabled={!draftKeys.length}>
            {isVietnamese ? "Lưu KPI" : "Save KPIs"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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

function EmptyState({ language }: { language: InterfaceLanguage }) {
  const copy = adsCopy[language].empty;
  return (
    <Empty className="min-h-80 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ActivityIcon />
        </EmptyMedia>
        <EmptyTitle>{copy.reportTitle}</EmptyTitle>
        <EmptyDescription>{copy.reportDescription}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function CampaignPicker({
  campaigns,
  currency,
  language,
  loading,
  selectedIds,
  onChange,
}: {
  campaigns: MetaCampaign[];
  currency: string;
  language: InterfaceLanguage;
  loading: boolean;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const activeCampaigns = campaigns.filter(isActiveCampaign);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleCampaigns = campaigns
    .filter((campaign) => `${campaign.name} ${campaign.objective || ""} ${campaignStatus(campaign)}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(isActiveCampaign(b)) - Number(isActiveCampaign(a)) || a.name.localeCompare(b.name))
    .slice(0, 30);
  const effectiveCount = selectedIds.length || activeCampaigns.length;
  const copy = adsCopy[language].campaign;
  const summary = selectedIds.length ? `${selectedIds.length} ${copy.selected}` : `${copy.allActive} (${activeCampaigns.length})`;

  function toggleCampaign(id: string) {
    const current = selectedIds.length ? selectedIds : [];
    onChange(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <Field className="xl:col-span-2">
      <FieldLabel>{copy.label}</FieldLabel>
      <div className="rounded-lg border bg-background p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="secondary">{summary}</Badge>
            <span className="text-xs text-muted-foreground">{effectiveCount} {copy.inScope}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onChange([])} disabled={loading}>
              {copy.allActive}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((value) => !value)}
              disabled={loading || !campaigns.length}
            >
              {expanded ? <ChevronUpIcon data-icon="inline-start" /> : <ChevronDownIcon data-icon="inline-start" />}
              {expanded ? copy.hide : copy.edit}
            </Button>
          </div>
        </div>
        {selectedIds.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {campaigns
              .filter((campaign) => selectedSet.has(campaign.id))
              .slice(0, 4)
              .map((campaign) => (
                <Badge key={campaign.id} variant="outline" className="max-w-48 truncate">
                  {campaign.name}
                </Badge>
              ))}
            {selectedIds.length > 4 ? <Badge variant="outline">+{selectedIds.length - 4}</Badge> : null}
          </div>
        ) : null}
        {expanded ? (
          <>
            <div className="mt-2 flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                disabled={loading}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => onChange(campaigns.map((campaign) => campaign.id))} disabled={loading || !campaigns.length}>
                {copy.all}
              </Button>
            </div>
            <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-auto pr-1">
              {loading ? (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                  <Spinner data-icon="inline-start" />
                  {copy.loading}
                </div>
              ) : null}
              {!loading && visibleCampaigns.length
                ? visibleCampaigns.map((campaign) => {
                    const status = campaignStatus(campaign);
                    const selected = selectedIds.length ? selectedSet.has(campaign.id) : isActiveCampaign(campaign);
                    return (
                      <button
                        key={campaign.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleCampaign(campaign.id)}
                        className="group grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none aria-pressed:border-ring/70 aria-pressed:bg-muted aria-pressed:ring-1 aria-pressed:ring-ring/50"
                      >
                        <span className="flex size-5 items-center justify-center rounded-md border text-ring group-aria-pressed:border-ring group-aria-pressed:bg-ring group-aria-pressed:text-black">
                          {selected ? <CheckIcon className="size-3.5" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{campaign.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {campaign.objective || copy.noObjective} {formatCampaignBudget(campaign, currency, language)}
                          </span>
                        </span>
                        <Badge variant={status === "ACTIVE" ? "secondary" : status === "PAUSED" ? "outline" : "destructive"}>{status}</Badge>
                      </button>
                    );
                  })
                : null}
              {!loading && !visibleCampaigns.length ? <div className="py-6 text-center text-sm text-muted-foreground">{copy.none}</div> : null}
            </div>
          </>
        ) : null}
      </div>
      <FieldDescription>{copy.help}</FieldDescription>
    </Field>
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
  if (mode === "wow") return "WoW";
  if (mode === "mom") return "MoM";
  if (mode === "yoy") return "YoY";
  return language === "vi" ? "Tắt" : "Off";
}

function averageRows(rows: NormalizedRow[], key: keyof NormalizedRow): number {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length;
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
    costPerMessage: Math.round(row.costPerMessage),
    costPerReply: Math.round(row.costPerReply),
    cpl: Math.round(row.cpl),
    cpaPurchase: Math.round(row.cpaPurchase),
    cpc: roundMetric(row.cpc),
    cpm: roundMetric(row.cpm),
    roas: roundMetric(row.roas),
    frequency: roundMetric(row.frequency),
    ctr: roundMetric(row.ctr),
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
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="tabular-nums">
                          {formatChartValue(Number(value), name === "spend" ? "currency" : spec.metricFormats[name as ChartKey] || "number", currency)}
                        </span>
                      )}
                    />
                  }
                />
                <Bar yAxisId="spend" dataKey="spend" fill="var(--color-spend)" radius={[3, 3, 0, 0]} />
                {spec.trendKeys.map((key) => (
                  <Line key={key} yAxisId="outcomes" type="monotone" dataKey={key} stroke={`var(--color-${key})`} strokeWidth={trendAnnotation?.key === key ? 3 : 2} dot={false} />
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
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="tabular-nums">
                          {formatChartValue(Number(value), spec.metricFormats[name as ChartKey] || "currency", currency)}
                        </span>
                      )}
                    />
                  }
                />
                {spec.efficiencyKeys.map((key) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={`var(--color-${key})`} strokeWidth={2} dot={false} />
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
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="tabular-nums">
                          {formatChartValue(Number(value), spec.metricFormats[name as ChartKey] || "number", currency)}
                        </span>
                      )}
                    />
                  }
                />
                {spec.diagnosticKeys.map((key) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={`var(--color-${key})`} strokeWidth={2} dot={false} />
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
