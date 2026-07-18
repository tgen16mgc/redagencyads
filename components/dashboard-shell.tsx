"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  BotMessageSquareIcon,
  CalendarClockIcon,
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  HomeIcon,
  KeyRoundIcon,
  LanguagesIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  WaypointsIcon,
} from "lucide-react";
import { AppSidebar, type AppSidebarItem, type WorkflowSidebarItem } from "@/components/dashboard/app-sidebar";
import { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { StickyActionDock } from "@/components/dashboard/sticky-action-dock";
import { ContextChat, type ContextChatHandle } from "@/components/dashboard/context-chat";
import { CONTEXT_CHAT_PANEL_ID } from "@/components/dashboard/context-chat-copy";
import { CompetitorEvidenceWorkspace } from "@/components/dashboard/competitor-evidence-workspace";
import { assertClientReportHealthParity, buildClientReportViewModel, downloadClientReportPdf } from "@/lib/client-report";
import { buildClientReportPdf } from "@/lib/client-report-pdf";
import { CustomChartsSection } from "@/components/dashboard/custom-charts-section";
import { PagePublisherPanel, type PagePublisherContextHandle } from "@/components/dashboard/page-publisher-panel";
import type { ChatContext } from "@/lib/ai/chat-contract";
import {
  buildCompetitorChatContext,
  buildOverviewChatContext,
  buildPerformanceChatContext,
  buildPublisherChatContext,
  buildTikTokChatContext,
} from "@/lib/ai/chat-context";
import type { AdSetWithPreviews, AiInsightTable, CompareMode, CompetitorEvidenceStatus, CompetitorFetchResult, CompetitorPlatform, CompetitorSpyResult, DashboardReport, KpiCard, KpiPack, MetaAccount, MetaCampaign, NormalizedRow, TikTokProfile, TikTokProfileResult, TikTokVideo, Verdict } from "@/lib/types";
import { buildWorkflowSteps, type DashboardWorkflowStep } from "@/lib/dashboard-workflow";
import { canOpenDashboardView, initialDashboardViewFromSearch, shouldLoadAdsWorkspaceData, type DashboardView } from "@/lib/dashboard-access";
import { buildUnknownCapabilitySnapshot, type CapabilityStatus } from "@/lib/capabilities";
import { hasReportSignal } from "@/lib/data-sufficiency";
import { getCompareRange } from "@/lib/report-ranges";
import { classifyCreativeFatigue, computeCreativeFatigueBaseline } from "@/lib/creative-fatigue";
import { assessCreativeVolume } from "@/lib/creative-volume";
import { assessCreativeStarvation } from "@/lib/creative-starvation";
import { assessLearningLimited } from "@/lib/learning-limited";
import { assessTargetingExclusions } from "@/lib/targeting-exclusions";
import { assessExperimentReadiness } from "@/lib/experiment-readiness";
import { assessMeasurementQuality } from "@/lib/measurement-quality";
import { assessResultConcentration } from "@/lib/result-concentration";
import { assessBreakdownWaste } from "@/lib/breakdown-waste";
import { assessFunnelLeakage, FUNNEL_BENCHMARKS } from "@/lib/funnel-leakage";
import { assessAudienceOverlap } from "@/lib/audience-overlap";
import { recommendBudgetMoves } from "@/lib/budget-move-engine";
import { analyzeComparisonRootCauses } from "@/lib/comparison-root-cause";
import { diagnoseDailyChange } from "@/lib/daily-diagnosis";
import { summarizeHealth, type HealthScoreSummary } from "@/lib/health-score";
import { assessConsolidationPressure } from "@/lib/consolidation-pressure";
import { assessCostCapDelivery } from "@/lib/cost-cap-delivery";
import { assessSpendPacing } from "@/lib/spend-pacing";
import { assessDecisionConfidence, type DecisionTargets } from "@/lib/decision-confidence";
import { rowDecision } from "@/lib/row-decision";
import { normalizeCompetitorNames, normalizeCompetitorUrls } from "@/lib/competitor-input";
import { acceptedManualEvidenceText, competitorEvidenceReadiness, reviewCompetitorEvidence } from "@/lib/competitor-evidence";
import { detectBaselineAnomalies, anomalyBadgeText } from "@/lib/baseline-anomaly";
import { diagnosticNextStep, type DiagnosticKind, type DiagnosticTone } from "@/lib/diagnostic-next-step";
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
import { buildKpiComparisons, formatComparisonChangePct, metricMovementIsBad } from "@/lib/metric-comparison";
import {
  buildBreakdownDimensions,
  buildBreakdownViewModel,
  type BreakdownChartRow,
  type BreakdownDimension,
  type BreakdownMetricMode,
} from "@/lib/breakdown-view-model";
import { buildBreakdownChartAnnotations, type BreakdownChartAnnotations } from "@/lib/breakdown-chart-annotations";
import {
  buildCustomKpiCards,
  CUSTOM_KPI_SET_STORAGE_KEY,
  LEGACY_CUSTOM_KPI_SET_STORAGE_KEY,
  type CustomKpiKey,
  deserializeCustomKpiSet,
  getCustomKpiCatalogGroups,
  serializeCustomKpiSet,
} from "@/lib/custom-kpi-set";
import { buildCompetitorSpyPrompt, buildInsightPrompt, formatCompactNumber, formatMetric, formatSharePct } from "@/lib/metrics";
import BorderGlow from "@/components/BorderGlow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const workflowItems: { value: DashboardWorkflowStep; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { value: "connect", label: "Connect", icon: KeyRoundIcon },
  { value: "select", label: "Select", icon: DatabaseIcon },
  { value: "analyze", label: "Analyze", icon: BarChart3Icon },
  { value: "verdict", label: "Verdict", icon: BrainIcon },
];

const appSections = [
  { label: "Overview", value: "overview", icon: HomeIcon },
  { label: "Performance", value: "ads", icon: BarChart3Icon },
  { label: "Competitor evidence", value: "competitor", icon: SearchIcon },
  { label: "TikTok tracker", value: "tiktok", icon: ActivityIcon },
  { label: "Publishing", value: "publisher", icon: CalendarClockIcon },
] as const;

type ActiveView = DashboardView;

type TikTokWorkspaceState = {
  profilesInput: string;
  profileLimit: number;
  profileResult: TikTokProfileResult | null;
  profileError: string;
  profileLoading: boolean;
};

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

type Provider = (typeof providerItems)[number]["value"];

const languageValues = ["en", "vi"] as const;

type ReportLanguage = (typeof languageValues)[number];
const COMPETITOR_SPY_TIMEOUT_MS = 5 * 60 * 1000;
const LANGUAGE_STORAGE_KEY = "decision-workspace-language";

const compareItems: { label: string; value: CompareMode }[] = [
  { label: "No compare", value: "off" },
  { label: "WoW", value: "wow" },
  { label: "MoM", value: "mom" },
  { label: "YoY", value: "yoy" },
];

const uiCopy = {
  en: {
    token: {
      title: "Decision Operations Workspace",
      description: "Connect Meta account.",
      storage: "Facebook Login and pasted tokens are validated server-side, encrypted, and stored only in an HttpOnly session cookie.",
      rejected: "Connection rejected",
      facebookLogin: "Login with Facebook",
      facebookHelp: "Requests ads_read for reporting plus Page permissions for publishing.",
      manualToken: "Manual token fallback",
      field: "Access token",
      placeholder: "Paste Meta access token",
      help: "Use a token only when Facebook Login is unavailable. Do not use shared tokens for hosted public deployments.",
      submit: "Validate token",
    },
    loading: {
      title: "Loading session",
      description: "Checking encrypted cookie state.",
    },
    nav: {
      functions: "Workspaces",
      workflow: "Workflow",
      aiSetup: "Enhancement",
      clearSession: "Clear session",
      overview: "Overview",
      ads: "Performance",
      competitor: "Competitor evidence",
      tiktok: "TikTok tracker",
      publisher: "Publishing",
      connect: "Connect",
      select: "Select",
      analyze: "Analyze",
      verdict: "Verdict",
    },
    header: {
      overviewCrumb: "Decision operations",
      overviewDetail: "evidence to action",
      adsCrumb: "Meta Graph API",
      adsDetail: "campaign-first analysis",
      competitorCrumb: "Verified research",
      competitorDetail: "Apify evidence review",
      tiktokCrumb: "TikTok public intelligence",
      tiktokDetail: "Apify profile and video pulls",
      publisherCrumb: "Meta Pages API",
      publisherDetail: "server-side Page publishing",
      overviewTitle: "Workspace overview",
      adsTitle: "Performance diagnosis",
      competitorTitle: "Competitor evidence",
      tiktokTitle: "TikTok tracker",
      publisherTitle: "Publishing operations",
      session: "HttpOnly token session",
      pulled: "Pulled",
      exportPdf: "Export PDF",
      actionFailed: "Action failed",
    },
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
      chart: "No chart data returned.",
      rowsTitle: "No rows",
      rowsDescription: "Meta returned no insight rows for this scope.",
      breakdown: "No breakdown rows returned.",
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
      title: "Running ad sets",
      description: "Preview active ad sets in the selected scope before pulling the report.",
      loading: "Loading running ad sets",
      empty: "No active ad sets found for this scope.",
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
      health: "Account health",
      healthDescription: "Ads-skill checks: creative, CTR, frequency, consolidation.",
      measurement: "Measurement quality",
      measurementDescription: "Checks whether the current dataset supports confident optimization decisions.",
      readiness: "Experiment readiness",
      readinessDescription: "Combines measurement, account health, and creative signals before launch decisions.",
      budgetMoveEngine: "Budget Move Engine",
      budgetMoveEngineDescription: "Recommends guarded budget transfers only when current row performance supports it.",
      concentration: "Result concentration",
      concentrationDescription: "Checks whether spend or primary results depend on too few rows.",
      breakdownWaste: "Breakdown waste",
      breakdownWasteDescription: "Checks platform, demographic, and geography segments for high-spend waste.",
      funnelLeakage: "Funnel leakage",
      funnelLeakageDescription: "Evaluates clicks, carts, checkouts, and purchases against standard benchmarks.",
      audienceOverlap: "Audience overlap",
      audienceOverlapDescription: "Checks for similar ad set naming that suggests target audience overlap.",
      targetingExclusions: "Targeting exclusions",
      targetingExclusionsDescription: "Verify setup of custom audience exclusions against deprecated detailed exclusions.",
      creativeStarvation: "Creative starvation",
      creativeStarvationDescription: "Checks if a fatigued creative dominates spend and blocks fresh creative testing.",
      grade: "Grade",
      breakdowns: "Breakdowns",
      breakdownsDescription: "Adaptive platform, demographic, and geography signal for allocation diagnosis.",
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
      fixCreative: "Fix creative",
      healthy: "Healthy",
      review: "Review",
      watch: "Watch",
    },
    verdict: {
      provider: "Provider",
      generate: "Generate verdict",
      copied: "Copied",
      copyPrompt: "Copy prompt",
      emptyTitle: "No Verdict yet",
      emptyDescription: "Generate after pulling report. Export will include this section once available.",
    },
    spy: {
      copyPrompt: "Copy spy prompt",
      view: "View",
      unknownAdvertiser: "Unknown advertiser",
      noCopy: "No ad copy returned.",
      adCreativeAlt: "Ad creative from",
      start: "Start",
    },
  },
  vi: {
    token: {
      title: "Decision Operations Workspace",
      description: "Kết nối tài khoản Meta.",
      storage: "Facebook Login và token dán thủ công đều được kiểm tra trên server, mã hóa và chỉ lưu trong HttpOnly session cookie.",
      rejected: "Kết nối bị từ chối",
      facebookLogin: "Đăng nhập bằng Facebook",
      facebookHelp: "Yêu cầu ads_read để đọc báo cáo và quyền Page để đăng bài.",
      manualToken: "Dùng token thủ công khi cần",
      field: "Access token",
      placeholder: "Dán Meta access token",
      help: "Chỉ dùng token khi Facebook Login chưa khả dụng. Không dùng token dùng chung cho bản public.",
      submit: "Xác thực token",
    },
    loading: {
      title: "Đang tải session",
      description: "Đang kiểm tra cookie đã mã hóa.",
    },
    nav: {
      functions: "Workspace",
      workflow: "Quy trình",
      aiSetup: "Tăng cường",
      clearSession: "Xóa session",
      overview: "Tổng quan",
      ads: "Hiệu quả",
      competitor: "Evidence đối thủ",
      tiktok: "Theo dõi TikTok",
      publisher: "Vận hành đăng bài",
      connect: "Kết nối",
      select: "Chọn phạm vi",
      analyze: "Phân tích",
      verdict: "Verdict",
    },
    header: {
      overviewCrumb: "Vận hành quyết định",
      overviewDetail: "từ evidence đến hành động",
      adsCrumb: "Meta Graph API",
      adsDetail: "phân tích theo campaign",
      competitorCrumb: "Nghiên cứu công khai",
      competitorDetail: "duyệt evidence Apify",
      tiktokCrumb: "Tình báo public TikTok",
      tiktokDetail: "kéo profile và video qua Apify",
      publisherCrumb: "Meta Pages API",
      publisherDetail: "đăng Page qua server",
      overviewTitle: "Tổng quan workspace",
      adsTitle: "Chẩn đoán hiệu quả",
      competitorTitle: "Evidence đối thủ",
      tiktokTitle: "Theo dõi TikTok",
      publisherTitle: "Vận hành đăng bài",
      session: "Session token HttpOnly",
      pulled: "Đã kéo",
      exportPdf: "Xuất PDF",
      actionFailed: "Thao tác lỗi",
    },
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
      chart: "Không có dữ liệu biểu đồ.",
      rowsTitle: "Không có dòng",
      rowsDescription: "Meta không trả insight rows cho phạm vi này.",
      breakdown: "Không có dữ liệu breakdown.",
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
      title: "Ad set đang chạy",
      description: "Xem trước ad set active trong phạm vi đã chọn trước khi kéo báo cáo.",
      loading: "Đang tải ad set active",
      empty: "Không có ad set active trong phạm vi này.",
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
      health: "Sức khỏe tài khoản",
      healthDescription: "Check ads-skill: creative, CTR, frequency, consolidation.",
      measurement: "Chất lượng đo lường",
      measurementDescription: "Kiểm tra dataset hiện tại có đủ tin cậy để ra quyết định tối ưu hay không.",
      readiness: "Sẵn sàng thử nghiệm",
      readinessDescription: "Kết hợp đo lường, sức khỏe tài khoản và creative trước quyết định launch.",
      budgetMoveEngine: "Điều chuyển ngân sách",
      budgetMoveEngineDescription: "Chỉ đề xuất chuyển ngân sách có kiểm soát khi hiệu quả hiện tại đủ hỗ trợ.",
      concentration: "Độ tập trung kết quả",
      concentrationDescription: "Kiểm tra chi tiêu hoặc kết quả chính có phụ thuộc vào quá ít dòng hay không.",
      breakdownWaste: "Lãng phí breakdown",
      breakdownWasteDescription: "Kiểm tra lãng phí chi tiêu trên nền tảng, nhân khẩu học và khu vực.",
      funnelLeakage: "Rò rỉ phễu chuyển đổi",
      funnelLeakageDescription: "Đánh giá tỷ lệ click, thêm giỏ hàng, checkout và mua hàng so với mốc tiêu chuẩn.",
      audienceOverlap: "Trùng lặp đối tượng",
      audienceOverlapDescription: "Kiểm tra sự trùng lặp đối tượng nhắm mục tiêu dựa trên tên ad set tương đồng.",
      targetingExclusions: "Loại trừ nhắm mục tiêu",
      targetingExclusionsDescription: "Xác minh cấu hình loại trừ bằng Custom Audience thay vì loại trừ chi tiết đã bị bãi bỏ.",
      creativeStarvation: "Đói ngân sách creative",
      creativeStarvationDescription: "Kiểm tra nếu creative mỏi chiếm đa số ngân sách và chặn thử nghiệm creative mới.",
      grade: "Hạng",
      breakdowns: "Breakdown",
      breakdownsDescription: "Tín hiệu adaptive theo nền tảng, nhân khẩu học và khu vực để chẩn đoán phân bổ.",
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
      fixCreative: "Sửa creative",
      healthy: "Khỏe",
      review: "Rà soát",
      watch: "Theo dõi",
    },
    verdict: {
      provider: "Provider",
      generate: "Tạo Verdict",
      copied: "Đã copy",
      copyPrompt: "Copy prompt",
      emptyTitle: "Chưa có Verdict",
      emptyDescription: "Tạo sau khi kéo báo cáo. File export sẽ có phần này khi sẵn sàng.",
    },
    spy: {
      copyPrompt: "Copy prompt spy",
      view: "Xem",
      unknownAdvertiser: "Advertiser không rõ",
      noCopy: "Không có copy quảng cáo.",
      adCreativeAlt: "Creative quảng cáo từ",
      start: "Bắt đầu",
    },
  },
} as const;

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

const competitorPlatformItems: { label: string; value: CompetitorPlatform }[] = [
  { label: "Meta / Instagram", value: "meta" },
  { label: "Google", value: "google" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "TikTok", value: "tiktok" },
  { label: "Mixed", value: "mixed" },
];

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

function sanitizeAdPreviewHtml(html: string): string {
  // Strip script tags, on* event handlers, and javascript: hrefs from Meta ad preview HTML
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');
}

async function jsonFetch<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), init?.timeoutMs ?? 15000);
  try {
    const response = await fetch(url, { ...init, signal: init?.signal ?? controller.signal });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Request failed.");
    return json as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round((init?.timeoutMs ?? 15000) / 1000)}s. Try again.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function DashboardShell() {
  const dates = React.useMemo(defaultDates, []);
  const [authenticated, setAuthenticated] = React.useState<boolean | null>(null);
  const [accounts, setAccounts] = React.useState<MetaAccount[]>([]);
  const [campaigns, setCampaigns] = React.useState<MetaCampaign[]>([]);
  const [accountId, setAccountId] = React.useState("");
  const [selectedCampaignIds, setSelectedCampaignIds] = React.useState<string[]>([]);
  const [since, setSince] = React.useState(dates.since);
  const [until, setUntil] = React.useState(dates.until);
  const [pack, setPack] = React.useState<KpiPack | "auto">("auto");
  const [compareMode, setCompareMode] = React.useState<CompareMode>("off");
  const [targetCpa, setTargetCpa] = React.useState("");
  const [targetRoas, setTargetRoas] = React.useState("");
  const [provider, setProvider] = React.useState<Provider>("auto");
  const [capabilities, setCapabilities] = React.useState<CapabilityStatus[]>(buildUnknownCapabilitySnapshot);
  const [facebookOAuthConfigured, setFacebookOAuthConfigured] = React.useState<boolean | null>(null);
  const [language, setLanguage] = React.useState<ReportLanguage>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === "vi" || stored === "en" ? stored : "en";
  });
  const [activeView, setActiveView] = React.useState<ActiveView>(() =>
    typeof window === "undefined" ? "overview" : initialDashboardViewFromSearch(window.location.search),
  );
  const [report, setReport] = React.useState<DashboardReport | null>(null);
  const [previousReport, setPreviousReport] = React.useState<DashboardReport | null>(null);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [insights, setInsights] = React.useState<AiInsightTable | null>(null);
  const [competitorNames, setCompetitorNames] = React.useState("");
  const [competitorMarket, setCompetitorMarket] = React.useState("");
  const [competitorPlatform, setCompetitorPlatform] = React.useState<CompetitorPlatform>("meta");
  const [competitorNotes, setCompetitorNotes] = React.useState("");
  const [competitorLibraryUrls, setCompetitorLibraryUrls] = React.useState("");
  const [competitorEvidence, setCompetitorEvidence] = React.useState<CompetitorFetchResult | null>(null);
  const [competitorResult, setCompetitorResult] = React.useState<CompetitorSpyResult | null>(null);
  const [competitorCollecting, setCompetitorCollecting] = React.useState(false);
  const [competitorAnalyzing, setCompetitorAnalyzing] = React.useState(false);
  const [competitorError, setCompetitorError] = React.useState("");
  const [tiktokWorkspace, setTikTokWorkspace] = React.useState<TikTokWorkspaceState>({
    profilesInput: "",
    profileLimit: 8,
    profileResult: null,
    profileError: "",
    profileLoading: false,
  });
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [copiedCompetitorPrompt, setCopiedCompetitorPrompt] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState("");
  const [scopeExpanded, setScopeExpanded] = React.useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState({ verdict: false, insights: false });
  const [exportingPdf, setExportingPdf] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const reportStartRef = React.useRef<HTMLDivElement>(null);
  const contextChatRef = React.useRef<ContextChatHandle>(null);
  const publisherContextRef = React.useRef<PagePublisherContextHandle>(null);
  const historyInitializedRef = React.useRef(false);
  const verdictProgress = useTimedProgress(aiLoading.verdict);
  const insightProgress = useTimedProgress(aiLoading.insights);
  const [customKpiKeys, setCustomKpiKeys] = React.useState<CustomKpiKey[] | null>(null);
  const effectiveKpis = React.useMemo<KpiCard[]>(() => {
    if (!report) return [];
    return customKpiKeys?.length ? buildCustomKpiCards(customKpiKeys) : report.kpis;
  }, [customKpiKeys, report]);
  const comparisonReport = React.useMemo<DashboardReport | null>(() => {
    if (!report) return null;
    return { ...report, kpis: effectiveKpis };
  }, [effectiveKpis, report]);
  const healthSummary = React.useMemo(() => report ? summarizeHealth(report) : null, [report]);
  const reportHasData = report ? hasReportSignal(report.totals) : false;
  const kpiComparisons = React.useMemo(() => {
    if (!comparisonReport || !previousReport || compareMode === "off") return null;
    const arr = buildKpiComparisons({ report: comparisonReport, previousReport, compareMode, language });
    return new Map(arr.map((c) => [c.key, c]));
  }, [comparisonReport, previousReport, compareMode, language]);

  const decisionTargets = React.useMemo<DecisionTargets>(() => {
    const cpa = Number(targetCpa);
    const roas = Number(targetRoas);
    return {
      targetCpa: Number.isFinite(cpa) && cpa > 0 ? cpa : undefined,
      targetRoas: Number.isFinite(roas) && roas > 0 ? roas : undefined,
    };
  }, [targetCpa, targetRoas]);
  const workspaceLabel = accounts.find((account) => account.id === accountId)?.name;
  const nineRouterAvailable = capabilities.find((capability) => capability.key === "ai_enhancement")?.state === "available";
  const getChatContext = React.useCallback((view: DashboardView): ChatContext => {
    if (view === "overview") {
      return buildOverviewChatContext({
        workspaceLabel,
        authenticated: Boolean(authenticated),
        capabilities,
      });
    }
    if (view === "ads") {
      return buildPerformanceChatContext({
        workspaceLabel,
        report,
        previousReport,
        compareMode,
        targets: decisionTargets,
        verdict,
        insights,
      });
    }
    if (view === "competitor") {
      return buildCompetitorChatContext({
        names: normalizeCompetitorNames(competitorNames),
        market: competitorMarket,
        platform: competitorPlatform,
        evidence: competitorEvidence,
        result: competitorResult,
      });
    }
    if (view === "tiktok") {
      return buildTikTokChatContext({
        profilesInput: tiktokWorkspace.profilesInput,
        result: tiktokWorkspace.profileResult,
      });
    }
    return publisherContextRef.current?.getChatContext() || buildPublisherChatContext({
      target: "facebook",
      message: "",
      link: "",
      mode: "publish_now",
      scheduledFor: "",
      mediaItems: [],
      queueCount: 0,
    });
  }, [
    authenticated,
    capabilities,
    compareMode,
    competitorEvidence,
    competitorMarket,
    competitorNames,
    competitorPlatform,
    competitorResult,
    decisionTargets,
    insights,
    previousReport,
    report,
    tiktokWorkspace.profileResult,
    tiktokWorkspace.profilesInput,
    verdict,
    workspaceLabel,
  ]);
  const hasWorkspaceDock = activeView === "competitor"
    || activeView === "tiktok"
    || activeView === "publisher"
    || (activeView === "ads" && Boolean(report && reportHasData));
  const copy = uiCopy[language];
  const workflowSteps = React.useMemo(
    () => buildWorkflowSteps({ hasAccount: Boolean(accountId), hasReport: reportHasData, hasVerdict: Boolean(verdict) }),
    [accountId, reportHasData, verdict],
  );
  const appNavItems = React.useMemo<AppSidebarItem<ActiveView>[]>(
    () =>
      appSections.map(({ value, icon }) => ({
        value,
        icon,
        label: appSectionLabel(value, language),
      })),
    [language],
  );
  const workflowNavItems = React.useMemo<WorkflowSidebarItem[]>(
    () =>
      workflowItems.map(({ value, icon }) => {
        const state = workflowSteps.find((item) => item.value === value)?.state || "pending";
        return {
          value,
          icon,
          state,
          label: workflowLabel(value, language),
          stateLabel: workflowStateLabel(state, language),
        };
      }),
    [language, workflowSteps],
  );
  const headerMode = {
    overview: {
      badge: copy.header.overviewCrumb,
      detail: copy.header.overviewDetail,
      title: copy.header.overviewTitle,
      description: language === "vi"
        ? "Chọn một công việc, kiểm tra capability thật và đưa evidence đến hành động."
        : "Choose a job, verify the real capability state, and move evidence toward action.",
    },
    ads: {
      badge: copy.header.adsCrumb,
      detail: copy.header.adsDetail,
      title: copy.header.adsTitle,
      description: language === "vi"
        ? "Theo dõi KPI, chẩn đoán tài khoản và tạo Verdict tối ưu."
        : "Track KPIs, diagnose account health, and generate optimization Verdicts.",
    },
    competitor: {
      badge: copy.header.competitorCrumb,
      detail: copy.header.competitorDetail,
      title: copy.header.competitorTitle,
      description: language === "vi"
        ? "Thu thập ads qua Apify, xác minh advertiser và phân tích chỉ evidence đã chấp nhận."
        : "Collect ads through Apify, verify advertiser provenance, and analyze only accepted evidence.",
    },
    tiktok: {
      badge: copy.header.tiktokCrumb,
      detail: copy.header.tiktokDetail,
      title: copy.header.tiktokTitle,
      description: language === "vi"
        ? "Kéo profile và video TikTok public để nghiên cứu creative và đối thủ."
        : "Pull public TikTok profile and video intelligence for creative and competitor research.",
    },
    publisher: {
      badge: copy.header.publisherCrumb,
      detail: copy.header.publisherDetail,
      title: copy.header.publisherTitle,
      description: language === "vi"
        ? "Đăng ngay hoặc lên lịch bài Facebook Page bằng token Meta đang kết nối."
        : "Publish now or schedule Facebook Page posts with the connected Meta token.",
    },
  }[activeView];

  React.useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get("auth_error");
    if (!authError) return;
    setError(authError);
    url.searchParams.delete("auth_error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (activeView === "overview") url.searchParams.delete("view");
    else url.searchParams.set("view", activeView);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true;
      window.history.replaceState({ view: activeView }, "", nextUrl);
    } else if (nextUrl !== currentUrl) {
      window.history.pushState({ view: activeView }, "", nextUrl);
    }
  }, [activeView]);

  React.useEffect(() => {
    const handlePopState = () => {
      setActiveView(initialDashboardViewFromSearch(window.location.search));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  React.useEffect(() => {
    if (!report) return;
    const currentValue = window.localStorage.getItem(CUSTOM_KPI_SET_STORAGE_KEY);
    const legacyValue = currentValue === null
      ? window.localStorage.getItem(LEGACY_CUSTOM_KPI_SET_STORAGE_KEY)
      : null;
    const keys = deserializeCustomKpiSet(currentValue ?? legacyValue, report.kpis);
    if (legacyValue !== null) {
      window.localStorage.setItem(CUSTOM_KPI_SET_STORAGE_KEY, legacyValue);
      window.localStorage.removeItem(LEGACY_CUSTOM_KPI_SET_STORAGE_KEY);
    }
    setCustomKpiKeys(keys);
  }, [report]);

  function saveCustomKpis(keys: CustomKpiKey[]) {
    window.localStorage.setItem(CUSTOM_KPI_SET_STORAGE_KEY, serializeCustomKpiSet(keys));
    setCustomKpiKeys(keys);
  }

  const loadAccounts = React.useCallback(async () => {
    setLoading("accounts");
    try {
      const data = await jsonFetch<{ accounts: MetaAccount[] }>("/api/meta/accounts");
      setAccounts(data.accounts);
      setAccountId(data.accounts[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load ad accounts.");
    } finally {
      setLoading("");
    }
  }, []);

  const loadCapabilities = React.useCallback(async () => {
    try {
      const data = await jsonFetch<{ capabilities: CapabilityStatus[]; facebookOAuthConfigured: boolean }>("/api/capabilities", { timeoutMs: 8000 });
      setCapabilities(data.capabilities);
      setFacebookOAuthConfigured(data.facebookOAuthConfigured);
    } catch {
      setCapabilities(buildUnknownCapabilitySnapshot());
      setFacebookOAuthConfigured(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    jsonFetch<{ authenticated: boolean }>("/api/session", { timeoutMs: 8000 })
      .then(async (data) => {
        if (cancelled) return;
        setAuthenticated(data.authenticated);
        void loadCapabilities();
        if (shouldLoadAdsWorkspaceData({ authenticated: data.authenticated, activeView })) void loadAccounts();
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not check session.");
        setAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeView, loadAccounts, loadCapabilities]);

  React.useEffect(() => {
    if (!accountId) return;
    setLoading("campaigns");
    jsonFetch<{ campaigns: MetaCampaign[] }>(`/api/meta/campaigns?accountId=${encodeURIComponent(accountId)}`)
      .then((data) => {
        setCampaigns(data.campaigns);
        setSelectedCampaignIds([]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(""));
  }, [accountId]);

  async function connectToken(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading("session");
    try {
      await jsonFetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setAuthenticated(true);
      setToken("");
      await loadCapabilities();
      if (shouldLoadAdsWorkspaceData({ authenticated: true, activeView })) await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not validate token.");
    } finally {
      setLoading("");
    }
  }

  async function logout() {
    contextChatRef.current?.clearAll();
    setChatOpen(false);
    await fetch("/api/session", { method: "DELETE" });
    setAuthenticated(false);
    setActiveView("overview");
    void loadCapabilities();
    setAccounts([]);
    setCampaigns([]);
    setReport(null);
    setPreviousReport(null);
    setVerdict(null);
    setInsights(null);
    setAiLoading({ verdict: false, insights: false });
    setCompetitorResult(null);
  }

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
    setError("");
    setVerdict(null);
    setInsights(null);
    setAiLoading({ verdict: false, insights: false });
    setPreviousReport(null);
    setLoading("report");
    try {
      const current = await fetchReportForRange({ since, until });
      setReport(current.report);
      setScopeExpanded(false);
      window.setTimeout(() => reportStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      if (compareMode !== "off") {
        const previousRange = getCompareRange({ since, until }, compareMode);
        const previous = await fetchReportForRange(previousRange);
        setPreviousReport(previous.report);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pull Meta report.");
    } finally {
      setLoading("");
    }
  }

  async function runAi() {
    if (!report || !reportHasData || aiLoading.verdict) return;
    setError("");
    setAiLoading((current) => ({ ...current, verdict: true }));
    try {
      const data = await jsonFetch<{ verdict: Verdict }>("/api/ai/verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report, language, provider }),
        timeoutMs: 150000,
      });
      setVerdict(data.verdict);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate Verdict.");
    } finally {
      setAiLoading((current) => ({ ...current, verdict: false }));
    }
  }

  async function runInsights() {
    if (!report || !reportHasData || aiLoading.insights) return;
    setError("");
    setAiLoading((current) => ({ ...current, insights: true }));
    try {
      const prompt = withReportLanguage(buildInsightPrompt({ report, previousReport, compareMode }), language, "insights");
      const data = await jsonFetch<{ insights: AiInsightTable }>("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, provider }),
        timeoutMs: 150000,
      });
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate insights.");
    } finally {
      setAiLoading((current) => ({ ...current, insights: false }));
    }
  }

  function competitorList() {
    return normalizeCompetitorNames(competitorNames);
  }

  function invalidateCompetitorBrief(reason: string) {
    if (!competitorResult) return;
    toast.info(language === "vi" ? "Decision brief đã được xoá" : "Decision brief cleared", {
      description: reason,
    });
    setCompetitorResult(null);
  }

  function competitorPrompt() {
    const competitors = competitorList();
    const manualEvidence = reviewCompetitorEvidence(competitorNotes, competitors)
      .filter((row) => row.status === "accepted");
    return withReportLanguage(
      buildCompetitorSpyPrompt({
        competitors,
        market: competitorMarket,
        platform: competitorPlatform,
        notes: acceptedManualEvidenceText(competitorNotes, competitors),
        manualEvidence,
        extractedAds: competitorEvidence?.ads || [],
        report,
      }),
      language,
      "competitor",
    );
  }

  function hasAcceptedCompetitorEvidence() {
    const manualAccepted = reviewCompetitorEvidence(competitorNotes, competitorList())
      .some((row) => row.status === "accepted");
    const collectedAccepted = competitorEvidence?.ads
      .some((ad) => ad.evidence?.status === "accepted" && ad.evidence.matchedToCompetitor && ad.evidence.hasUsableCreative);
    return manualAccepted || collectedAccepted;
  }

  async function collectCompetitorEvidence() {
    const competitors = competitorList();
    const libraryUrls = normalizeCompetitorUrls(competitorLibraryUrls);
    if (!competitors.length) {
      setCompetitorError("Add at least one competitor before collecting evidence.");
      return;
    }

    setCompetitorError("");
    setCompetitorCollecting(true);
    try {
      const data = await jsonFetch<{ result: CompetitorFetchResult }>("/api/spy/meta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "apify", competitors, country: "VN", limit: 40, libraryUrls }),
        timeoutMs: COMPETITOR_SPY_TIMEOUT_MS,
      });
      setCompetitorEvidence(data.result);
      setCompetitorResult(null);
      const matchedCount = data.result.ads.filter((ad) => ad.evidence?.matchedToCompetitor).length;
      if (data.result.outcome === "zero_match") {
        toast.warning(language === "vi" ? "Chưa tìm thấy advertiser khớp" : "No matching advertiser found", {
          description: language === "vi"
            ? `${data.result.ads.length} ads đã thu thập vẫn có thể xem trong thư viện. Thêm URL page chính xác để thử lại.`
            : `${data.result.ads.length} collected ads are still available in the library. Add the exact page URL for a precise retry.`,
        });
      } else if (data.result.outcome === "empty") {
        toast.info(language === "vi" ? "Không có ads được trả về" : "No ads returned", {
          description: language === "vi" ? "Kiểm tra URL hoặc từ khóa rồi thử lại." : "Check the page URL or search name and try again.",
        });
      } else {
        toast.success(language === "vi" ? "Thư viện ads đã sẵn sàng" : "Ad library ready", {
          description: language === "vi"
            ? `${matchedCount} ads khớp từ ${data.result.ads.length} ads đã thu thập.`
            : `${matchedCount} matched ads from ${data.result.ads.length} collected.`,
        });
      }
    } catch (err) {
      setCompetitorError(err instanceof Error ? err.message : "Could not collect competitor evidence.");
    } finally {
      setCompetitorCollecting(false);
    }
  }

  function updateCompetitorEvidenceStatus(id: string, status: CompetitorEvidenceStatus) {
    const target = competitorEvidence?.ads.find((ad) => ad.id === id);
    if (status === "accepted" && target?.evidence && !target.evidence.matchedToCompetitor) {
      toast.warning(language === "vi" ? "Không thể xác minh advertiser không khớp" : "Cannot verify a mismatched advertiser", {
        description: language === "vi"
          ? "Thêm đúng URL page hoặc chọn đúng đối thủ trước khi xác minh."
          : "Add the exact advertiser page URL or correct the competitor mapping before verification.",
      });
      return;
    }
    setCompetitorEvidence((current) => current ? {
      ...current,
      ads: current.ads.map((ad) => ad.id === id && ad.evidence
        ? { ...ad, evidence: { ...ad.evidence, status } }
        : ad),
    } : current);
    if (competitorResult) {
      toast.info(language === "vi" ? "Decision brief cần tạo lại" : "Decision brief needs regeneration", {
        description: language === "vi" ? "Trạng thái evidence đã thay đổi." : "Evidence review status changed.",
      });
    }
    setCompetitorResult(null);
  }

  async function runCompetitorSpy() {
    if (!competitorList().length || !hasAcceptedCompetitorEvidence()) {
      setCompetitorError("Collect and accept at least one advertiser-linked ad before analyzing.");
      return;
    }
    setCompetitorError("");
    setCompetitorAnalyzing(true);
    try {
      const data = await jsonFetch<{ competitor: CompetitorSpyResult }>("/api/ai/competitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: competitorPrompt(), provider }),
        timeoutMs: COMPETITOR_SPY_TIMEOUT_MS,
      });
      setCompetitorResult(data.competitor);
      toast.success(language === "vi" ? "Decision brief đã sẵn sàng" : "Decision brief ready");
    } catch (err) {
      setCompetitorError(err instanceof Error ? err.message : "Could not generate competitor spy report.");
    } finally {
      setCompetitorAnalyzing(false);
    }
  }

  async function copyCompetitorPrompt() {
    if (!competitorList().length || !hasAcceptedCompetitorEvidence()) {
      setCompetitorError("Accept at least one advertiser-linked ad before copying the prompt.");
      return;
    }
    await navigator.clipboard.writeText(competitorPrompt());
    setCopiedCompetitorPrompt(true);
    window.setTimeout(() => setCopiedCompetitorPrompt(false), 1500);
  }

  async function copyPrompt() {
    if (!report || !reportHasData) return;
    await navigator.clipboard.writeText(report.prompt);
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 1500);
  }

  async function exportPdf() {
    if (!report || !reportHasData || !healthSummary) return;
    setError("");
    setExportingPdf(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 0)));
      const model = buildClientReportViewModel({ report, healthSummary, previousReport, compareMode, verdict, insights, language, kpis: effectiveKpis });
      assertClientReportHealthParity(model, healthSummary);
      downloadClientReportPdf(buildClientReportPdf(model), {
        createObjectUrl: (blob) => URL.createObjectURL(blob),
        revokeObjectUrl: (url) => URL.revokeObjectURL(url),
        createLink: () => document.createElement("a"),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export a consistent report.");
    } finally {
      setExportingPdf(false);
    }
  }

  function withReportLanguage(prompt: string, lang: ReportLanguage, type: "verdict" | "insights" | "competitor") {
    if (lang !== "vi") return prompt;
    const sectionHint =
      type === "verdict"
        ? "Use Vietnamese for all user-facing values. Make the verdict useful for these report sections: \"Phân tích và đánh giá hiệu quả tháng - AI powered\" and \"Đề xuất tối ưu kỳ tiếp theo\"."
        : type === "insights"
          ? "Use Vietnamese for all user-facing values. Keep insight/action text concise for dashboard cards."
          : "Use Vietnamese for all user-facing values. Keep competitor themes, gaps, and test briefs concise.";
    return `${prompt}\n\nLanguage requirement:\n- ${sectionHint}\n- Keep JSON keys exactly as requested; translate only string values.`;
  }

  if (authenticated === null) {
    return <LoadingScreen language={language} />;
  }

  if (!canOpenDashboardView({ authenticated, activeView })) {
    return (
      <>
        <TokenScreen
          error={error}
          token={token}
          loading={loading === "session"}
          language={language}
          intendedView={activeView}
          facebookOAuthConfigured={facebookOAuthConfigured}
          onLanguageChange={setLanguage}
          onBack={() => setActiveView("overview")}
          onTokenChange={setToken}
          onUseCompetitor={() => setActiveView("competitor")}
          onSubmit={connectToken}
        />
        <ContextChat
          ref={contextChatRef}
          activeView={activeView}
          language={language}
          available={nineRouterAvailable}
          open={chatOpen}
          showStandaloneLauncher
          getContext={getChatContext}
          onOpenChange={setChatOpen}
        />
      </>
    );
  }

  return (
    <>
      <SidebarProvider>
      <AppSidebar
        activeView={activeView}
        aiProviderLabel={providerLabel(provider, language, capabilities)}
        appItems={appNavItems}
        clearSessionLabel={copy.nav.clearSession}
        functionsLabel={copy.nav.functions}
        showWorkflow={activeView === "ads"}
        showClearSession={authenticated}
        workflowLabel={copy.nav.workflow}
        workflowItems={workflowNavItems}
        aiSetupLabel={copy.nav.aiSetup}
        onActiveViewChange={setActiveView}
        onLogout={logout}
      />
      <SidebarInset>
        <div className="flex min-h-svh flex-col gap-4 p-4 pb-28 md:p-6 md:pb-28" data-print-page>
          <header className="rounded-2xl border bg-card p-3 sm:p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <SidebarTrigger className="mt-0.5" data-print-hidden />
                <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground sm:flex">
                  <WaypointsIcon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                    <Badge variant="secondary" className="shrink-0">{headerMode.badge}</Badge>
                    <span className="flex items-center gap-1">{headerMode.detail}</span>
                  </div>
                  <h1 className="mt-1 font-heading text-xl font-semibold tracking-[-0.035em] sm:mt-2 sm:text-2xl md:text-3xl">
                    {headerMode.title}
                  </h1>
                  <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-muted-foreground sm:block">{headerMode.description}</p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start lg:justify-end">
                <LanguageToggle language={language} onChange={setLanguage} />
                <Badge variant="secondary">
                  <ShieldCheckIcon />
                  {authenticated
                    ? copy.header.session
                    : activeView === "competitor" || activeView === "tiktok" || activeView === "overview"
                      ? language === "vi" ? "Không yêu cầu Meta" : "Meta optional"
                      : copy.header.session}
                </Badge>
                {activeView === "ads" && report ? <Badge variant="outline">{copy.header.pulled} {new Date(report.pulledAt).toLocaleString()}</Badge> : null}
                {activeView === "ads" ? (
                  <Button type="button" variant="outline" onClick={exportPdf} disabled={!reportHasData || exportingPdf} data-print-hidden>
                    {exportingPdf ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
                    {copy.header.exportPdf}
                  </Button>
                ) : null}
              </div>
            </div>
          </header>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{copy.header.actionFailed}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {activeView === "overview" ? (
            <WorkspaceOverview
              authenticated={authenticated}
              capabilities={capabilities}
              language={language}
              workspaceLabel={accounts.find((account) => account.id === accountId)?.name}
              onOpen={setActiveView}
            />
          ) : activeView === "ads" ? (
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
                  <Button type="button" variant="outline" onClick={() => setScopeExpanded(true)}>
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
                        if (value) setAccountId(value);
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
                    onChange={setSelectedCampaignIds}
                  />
                  <Field>
                    <FieldLabel>{copy.scope.since}</FieldLabel>
                    <Input type="date" value={since} onChange={(event) => setSince(event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel>{copy.scope.until}</FieldLabel>
                    <Input type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
                  </Field>
                  <Field className="xl:col-span-2">
                    <FieldLabel>{copy.scope.kpiPack}</FieldLabel>
                    <Select
                      items={[{ label: "Auto-detect", value: "auto" }, ...packItems]}
                      value={pack}
                      onValueChange={(value) => {
                        if (value) setPack(value as KpiPack | "auto");
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
                        <Input type="number" min="0" step="0.01" inputMode="decimal" value={targetCpa} onChange={(event) => setTargetCpa(event.target.value)} placeholder="40" />
                        <FieldDescription>{language === "vi" ? "Chặn scale nếu CPA vượt mục tiêu." : "Blocks scale when CPA is above target."}</FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel>{language === "vi" ? "Target ROAS" : "Target ROAS"}</FieldLabel>
                        <Input type="number" min="0" step="0.01" inputMode="decimal" value={targetRoas} onChange={(event) => setTargetRoas(event.target.value)} placeholder="2.5" />
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
                          setCompareMode(nextMode);
                          if (nextMode === "off") setPreviousReport(null);
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
                    onSave={saveCustomKpis}
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
                onProviderChange={setProvider}
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

                <HealthTriageCard summary={healthSummary!} language={language} />
              </section>

              <section data-print-flow>
                <DailyDiagnosisCard report={report} language={language} />
              </section>

              <Collapsible open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen} className="rounded-2xl border bg-card" data-print-flow>
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
                    <ExperimentReadinessCard report={report} language={language} />
                    <DecisionConfidenceCard report={report} language={language} targets={decisionTargets} />
                    <SpendPacingCard report={report} language={language} />
                    <ConsolidationPressureCard report={report} language={language} />
                    <CostCapDeliveryCard report={report} language={language} />
                    <CreativeVolumeCard report={report} language={language} />
                    <CreativeStarvationCard report={report} language={language} />
                    <BudgetMoveEngineCard report={report} language={language} />
                    <ResultConcentrationCard report={report} language={language} />
                    <FunnelLeakageCard report={report} language={language} />
                    <AudienceOverlapCard report={report} language={language} />
                    <TargetingExclusionsCard report={report} language={language} />
                    <MeasurementQualityCard report={report} language={language} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

            </div>
          ) : null}
          {activeView === "ads" && report && reportHasData ? (
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
                  onSelect: exportPdf,
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
              shortcutsDisabled={chatOpen}
              companionAction={{
                id: "open-performance-assistant",
                label: language === "vi" ? "Hỏi trợ lý AI về hiệu quả" : "Ask the smart assistant about performance",
                shortLabel: language === "vi" ? "Trợ lý AI" : "Assistant",
                controlsId: CONTEXT_CHAT_PANEL_ID,
                icon: BotMessageSquareIcon,
                onSelect: () => setChatOpen((current) => !current),
              }}
              companionActive={chatOpen}
            />
          ) : null}
            </>
          ) : activeView === "tiktok" ? (
            <TikTokIntelligencePanel
              language={language}
              state={tiktokWorkspace}
              onStateChange={setTikTokWorkspace}
              onOpenAssistant={() => setChatOpen((current) => !current)}
              chatShortcutsDisabled={chatOpen}
            />
          ) : activeView === "publisher" ? (
            <PagePublisherPanel
              ref={publisherContextRef}
              language={language}
              onOpenAssistant={() => setChatOpen((current) => !current)}
              chatShortcutsDisabled={chatOpen}
            />
          ) : (
            <CompetitorSpyPanel
              names={competitorNames}
              market={competitorMarket}
              platform={competitorPlatform}
              libraryUrls={competitorLibraryUrls}
              evidence={competitorEvidence}
              result={competitorResult}
              notes={competitorNotes}
              collecting={competitorCollecting}
              analyzing={competitorAnalyzing}
              error={competitorError}
              capabilityState={capabilities.find((item) => item.key === "competitor_evidence")?.state || "unknown"}
              language={language}
              provider={provider}
              copiedPrompt={copiedCompetitorPrompt}
              onNamesChange={(value) => {
                invalidateCompetitorBrief(language === "vi" ? "Danh sách đối thủ đã thay đổi." : "The competitor list changed.");
                setCompetitorNames(value);
                setCompetitorEvidence(null);
              }}
              onMarketChange={(value) => {
                invalidateCompetitorBrief(language === "vi" ? "Thị trường hoặc offer đã thay đổi." : "The market or offer changed.");
                setCompetitorMarket(value);
              }}
              onPlatformChange={(value) => {
                invalidateCompetitorBrief(language === "vi" ? "Nền tảng research đã thay đổi." : "The research platform changed.");
                setCompetitorPlatform(value);
              }}
              onNotesChange={(value) => {
                invalidateCompetitorBrief(language === "vi" ? "Evidence thủ công đã thay đổi." : "Manual evidence changed.");
                setCompetitorNotes(value);
              }}
              onLibraryUrlsChange={(value) => {
                invalidateCompetitorBrief(language === "vi" ? "Nguồn Meta Ad Library đã thay đổi." : "Meta Ad Library sources changed.");
                setCompetitorLibraryUrls(value);
                setCompetitorEvidence(null);
              }}
              onProviderChange={setProvider}
              onCollect={collectCompetitorEvidence}
              onEvidenceStatusChange={updateCompetitorEvidenceStatus}
              onGenerate={runCompetitorSpy}
              onCopyPrompt={copyCompetitorPrompt}
              onOpenAssistant={() => setChatOpen((current) => !current)}
              chatShortcutsDisabled={chatOpen}
            />
          )}
        </div>
      </SidebarInset>
      </SidebarProvider>
      <ContextChat
        ref={contextChatRef}
        activeView={activeView}
        language={language}
        available={nineRouterAvailable}
        open={chatOpen}
        showStandaloneLauncher={!hasWorkspaceDock}
        getContext={getChatContext}
        onOpenChange={setChatOpen}
      />
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
  language: ReportLanguage;
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

function TokenScreen(props: {
  token: string;
  error: string;
  loading: boolean;
  language: ReportLanguage;
  intendedView: ActiveView;
  facebookOAuthConfigured: boolean | null;
  onLanguageChange: (value: ReportLanguage) => void;
  onBack: () => void;
  onTokenChange: (value: string) => void;
  onUseCompetitor: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const copy = uiCopy[props.language].token;
  const isVietnamese = props.language === "vi";
  const tokenInputId = React.useId();
  const publishing = props.intendedView === "publisher";
  const oauthReturnTo = publishing ? "publisher" : "ads";
  const destination = publishing
    ? isVietnamese ? "Vận hành đăng bài" : "Publishing operations"
    : isVietnamese ? "Chẩn đoán hiệu quả" : "Performance diagnosis";

  return (
    <main className="min-h-svh bg-background p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={props.onBack}>
            <ArrowLeftIcon data-icon="inline-start" />
            {isVietnamese ? "Về tổng quan" : "Back to overview"}
          </Button>
          <LanguageToggle language={props.language} onChange={props.onLanguageChange} />
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground">
                <KeyRoundIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <CardDescription>{destination}</CardDescription>
                <CardTitle className="text-2xl">{isVietnamese ? "Kết nối Meta để tiếp tục" : "Connect Meta to continue"}</CardTitle>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {publishing
                    ? isVietnamese
                      ? "Workspace cần kiểm tra Page và quyền tạo nội dung trước khi preview hoặc gửi bài. Sau khi xác thực, bạn sẽ quay lại đúng luồng đăng bài."
                      : "This workspace must verify Page access and content permissions before previewing or submitting. After validation, you return directly to publishing."
                    : isVietnamese
                      ? "Workspace cần đọc account, campaign và insight để tạo chẩn đoán có evidence. Sau khi xác thực, bạn sẽ quay lại đúng luồng phân tích."
                      : "This workspace needs account, campaign, and insight access to produce an evidence-backed diagnosis. After validation, you return directly to performance."}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] lg:p-6">
            <div className="flex min-w-0 flex-col gap-5">
            {props.error ? (
              <Alert variant="destructive">
                <AlertTitle>{copy.rejected}</AlertTitle>
                <AlertDescription>{props.error}</AlertDescription>
              </Alert>
            ) : null}

            {props.facebookOAuthConfigured === true ? (
              <>
                <div className="flex min-w-0 flex-col gap-3">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => { window.location.href = `/api/auth/facebook/start?returnTo=${oauthReturnTo}`; }}
                  >
                    <ShieldCheckIcon data-icon="inline-start" />
                    {copy.facebookLogin}
                  </Button>
                  <FieldDescription className="break-words">{copy.facebookHelp}</FieldDescription>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Separator className="flex-1" />
                  {copy.manualToken}
                  <Separator className="flex-1" />
                </div>
              </>
            ) : (
              <Alert>
                <AlertTitle>
                  {props.facebookOAuthConfigured === null
                    ? isVietnamese ? "Đang kiểm tra Facebook Login…" : "Checking Facebook Login availability…"
                    : isVietnamese ? "Dùng Meta access token" : "Use a Meta access token"}
                </AlertTitle>
                <AlertDescription>
                  {props.facebookOAuthConfigured === null
                    ? isVietnamese ? "Bạn vẫn có thể dùng token bên dưới." : "You can still use a token below."
                    : isVietnamese
                      ? "Facebook Login chưa khả dụng trên bản triển khai này. Hãy dùng Meta access token bên dưới."
                      : "Facebook Login is not available on this deployment. Use a Meta access token below."}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={props.onSubmit} className="flex min-w-0 flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={tokenInputId}>{copy.field}</FieldLabel>
                  <Input
                    id={tokenInputId}
                    value={props.token}
                    onChange={(event) => props.onTokenChange(event.target.value)}
                    type="password"
                    autoComplete="off"
                    minLength={20}
                    placeholder={copy.placeholder}
                    className="w-full"
                    required
                  />
                  <FieldDescription className="break-words">
                    {publishing
                      ? isVietnamese
                        ? "Token dùng để kiểm tra Page và quyền CREATE_CONTENT của tài khoản Meta trước khi preview hoặc gửi bài."
                        : "The token verifies available Pages and CREATE_CONTENT permissions before previewing or submitting."
                      : isVietnamese
                        ? "Token dùng để đọc account, campaign và insight cho KPI, verdict và drilldown."
                        : "The token reads account, campaign, and insight data for KPIs, verdict, and drilldown."}
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <Button type="submit" disabled={props.loading || props.token.trim().length < 20} className="w-full" variant="outline">
                {props.loading ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
                {copy.submit}
              </Button>
                <FieldDescription className="break-words">{copy.help}</FieldDescription>
              </form>
            </div>

            <div className="flex flex-col gap-4 border-t pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div>
                <h2 className="text-sm font-semibold">{isVietnamese ? "Ranh giới truy cập" : "Access boundary"}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.storage}</p>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 text-sm">
                <span className="flex items-start gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />{isVietnamese ? "Token không được trả về client sau khi xác thực." : "The token is not returned to the client after validation."}</span>
                <span className="flex items-start gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />{isVietnamese ? "Chỉ workspace cần Meta mới yêu cầu kết nối." : "Only Meta-dependent workspaces require this connection."}</span>
              </div>
              <Button type="button" variant="outline" onClick={props.onUseCompetitor} className="mt-auto w-full">
                <SearchIcon data-icon="inline-start" />
                {isVietnamese ? "Mở evidence đối thủ" : "Open competitor evidence"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function LoadingScreen({ language }: { language: ReportLanguage }) {
  const copy = uiCopy[language].loading;
  const isVietnamese = language === "vi";

  return (
    <main className="grid min-h-svh place-items-center bg-background p-4">
      <div
        className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8"
        role="status"
        aria-live="polite"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border bg-background text-muted-foreground">
            <WaypointsIcon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <div className="text-sm font-medium text-foreground">Decision Operations Workspace</div>
            <div className="text-xs text-muted-foreground">Evidence to action</div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>

        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
          <Spinner className="size-4" />
          {isVietnamese ? "Đang chuẩn bị dashboard..." : "Preparing your dashboard..."}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}

function LanguageToggle({ language, onChange }: { language: ReportLanguage; onChange: (value: ReportLanguage) => void }) {
  const label = language === "vi" ? "Ngôn ngữ" : "Language";
  return (
    <div className="flex items-center gap-2" data-print-hidden>
      <LanguagesIcon className="text-muted-foreground" />
      <ToggleGroup
        aria-label={label}
        value={[language]}
        onValueChange={(values) => {
          const next = values.find((value): value is ReportLanguage => value === "en" || value === "vi");
          if (next) onChange(next);
        }}
        variant="outline"
        size="sm"
        spacing={0}
      >
        <ToggleGroupItem value="en" aria-label="English">
          EN
        </ToggleGroupItem>
        <ToggleGroupItem value="vi" aria-label="Tiếng Việt">
          VI
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function ReportSkeleton({ language }: { language: ReportLanguage }) {
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

function EmptyState({ language }: { language: ReportLanguage }) {
  const copy = uiCopy[language].empty;
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
  language: ReportLanguage;
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
  const copy = uiCopy[language].campaign;
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
  language: ReportLanguage;
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

function formatCampaignBudget(campaign: MetaCampaign, currency: string, language: ReportLanguage) {
  const copy = uiCopy[language].campaign;
  const daily = Number(campaign.daily_budget || 0);
  const lifetime = Number(campaign.lifetime_budget || 0);
  const divider = getBudgetDivider(currency);
  if (daily > 0) return `- ${formatMetric(daily / divider, "currency", currency)}/${copy.day}`;
  if (lifetime > 0) return `- ${formatMetric(lifetime / divider, "currency", currency)} ${copy.lifetime}`;
  return "";
}

function formatAdSetBudget(adset: AdSetWithPreviews, currency: string, language: ReportLanguage) {
  const copy = uiCopy[language].adsetPreview;
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
  language: ReportLanguage;
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
  language: ReportLanguage;
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
  language: ReportLanguage;
  onProviderChange: (value: Provider) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
}) {
  const isVietnamese = language === "vi";
  const copy = uiCopy[language].verdict;
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
  language: ReportLanguage;
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

function CompetitorSpyPanel({
  names,
  market,
  platform,
  libraryUrls,
  notes,
  evidence,
  result,
  collecting,
  analyzing,
  error,
  capabilityState,
  language,
  provider,
  copiedPrompt,
  onNamesChange,
  onMarketChange,
  onPlatformChange,
  onNotesChange,
  onLibraryUrlsChange,
  onProviderChange,
  onCollect,
  onEvidenceStatusChange,
  onGenerate,
  onCopyPrompt,
  onOpenAssistant,
  chatShortcutsDisabled,
}: {
  names: string;
  market: string;
  platform: CompetitorPlatform;
  libraryUrls: string;
  notes: string;
  evidence: CompetitorFetchResult | null;
  result: CompetitorSpyResult | null;
  collecting: boolean;
  analyzing: boolean;
  error: string;
  capabilityState: CapabilityStatus["state"];
  language: ReportLanguage;
  provider: Provider;
  copiedPrompt: boolean;
  onNamesChange: (value: string) => void;
  onMarketChange: (value: string) => void;
  onPlatformChange: (value: CompetitorPlatform) => void;
  onNotesChange: (value: string) => void;
  onLibraryUrlsChange: (value: string) => void;
  onProviderChange: (value: Provider) => void;
  onCollect: () => void;
  onEvidenceStatusChange: (id: string, status: CompetitorEvidenceStatus) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
  onOpenAssistant: () => void;
  chatShortcutsDisabled: boolean;
}) {
  return (
    <CompetitorEvidenceWorkspace
      names={names}
      market={market}
      platform={platform}
      libraryUrls={libraryUrls}
      notes={notes}
      evidence={evidence}
      result={result}
      collecting={collecting}
      analyzing={analyzing}
      error={error}
      capabilityState={capabilityState}
      language={language}
      provider={provider}
      copiedPrompt={copiedPrompt}
      onNamesChange={onNamesChange}
      onMarketChange={onMarketChange}
      onPlatformChange={onPlatformChange}
      onNotesChange={onNotesChange}
      onLibraryUrlsChange={onLibraryUrlsChange}
      onProviderChange={onProviderChange}
      onCollect={onCollect}
      onEvidenceStatusChange={onEvidenceStatusChange}
      onGenerate={onGenerate}
      onCopyPrompt={onCopyPrompt}
      onOpenAssistant={onOpenAssistant}
      chatShortcutsDisabled={chatShortcutsDisabled}
    />
  );
}

function TikTokIntelligencePanel({
  language,
  state,
  onStateChange,
  onOpenAssistant,
  chatShortcutsDisabled,
}: {
  language: ReportLanguage;
  state: TikTokWorkspaceState;
  onStateChange: React.Dispatch<React.SetStateAction<TikTokWorkspaceState>>;
  onOpenAssistant: () => void;
  chatShortcutsDisabled: boolean;
}) {
  const isVietnamese = language === "vi";
  const id = React.useId();
  const { profilesInput, profileLimit, profileResult, profileError, profileLoading } = state;
  const updateState = React.useCallback(
    (patch: Partial<TikTokWorkspaceState>) => {
      onStateChange((current) => ({ ...current, ...patch }));
    },
    [onStateChange],
  );
  const profiles = profilesInput
    .split(/[\n,]/)
    .map((profile) => profile.trim().replace(/^@/, ""))
    .filter(Boolean)
    .slice(0, 10);
  const profileCount = profileResult?.profiles.length || 0;
  const videoCount = profileResult?.videos.length || 0;
  const profileVideoGroups = (profileResult?.profiles || []).map((profile) => ({
    profile,
    videos: (profileResult?.videos || []).filter(
      (video) => video.username?.toLocaleLowerCase() === profile.username.toLocaleLowerCase(),
    ),
  }));
  const knownProfileNames = new Set((profileResult?.profiles || []).map((profile) => profile.username.toLocaleLowerCase()));
  const unattributedVideos = (profileResult?.videos || []).filter(
    (video) => !video.username || !knownProfileNames.has(video.username.toLocaleLowerCase()),
  );

  async function fetchProfiles() {
    if (!profiles.length) {
      updateState({ profileError: isVietnamese ? "Nhập ít nhất một username TikTok." : "Add at least one TikTok username." });
      return;
    }
    updateState({ profileError: "", profileLoading: true });
    try {
      const data = await jsonFetch<{ result: TikTokProfileResult }>("/api/tiktok/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profiles, resultsPerPage: clampWholeNumber(profileLimit, 1, 100) }),
        timeoutMs: 300000,
      });
      updateState({ profileResult: data.result });
    } catch (error) {
      updateState({
        profileError: error instanceof Error
          ? error.message
          : isVietnamese
            ? "Không kéo được TikTok profile."
            : "Could not fetch TikTok profiles.",
      });
    } finally {
      updateState({ profileLoading: false });
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-4" data-print-hidden>
        <Card>
          <CardHeader>
            <CardTitle>{isVietnamese ? "Profile & video context" : "Profile and video context"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "Kéo profile/video TikTok public qua Apify để xem creator hoặc đối thủ."
                : "Pull public TikTok profile and video context through Apify for creator or competitor research."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void fetchProfiles();
              }}
              className="flex flex-col gap-4"
            >
              <Field>
                <FieldLabel htmlFor={`${id}-profiles`}>{isVietnamese ? "Username TikTok" : "TikTok usernames"}</FieldLabel>
                <Textarea
                  id={`${id}-profiles`}
                  value={profilesInput}
                  onChange={(event) => updateState({ profilesInput: event.target.value })}
                  placeholder={isVietnamese ? "VD:\ncreatorvn\nbrandvn" : "Example:\ncreatorhandle\nbrandhandle"}
                  className="min-h-24 resize-none"
                />
                <FieldDescription>
                  {isVietnamese ? "Mỗi dòng một username, có hoặc không có @. Tối đa 10 profile." : "One username per line, with or without @. Up to 10 profiles."}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-profile-limit`}>{isVietnamese ? "Video/profile" : "Videos per profile"}</FieldLabel>
                <Input
                  id={`${id}-profile-limit`}
                  type="number"
                  min={1}
                  max={100}
                  value={profileLimit}
                  onChange={(event) => updateState({ profileLimit: clampWholeNumber(Number(event.target.value), 1, 100) })}
                />
              </Field>
              {profileError ? <Alert variant="destructive"><AlertTitle>{isVietnamese ? "Không kéo được profile" : "Profile fetch failed"}</AlertTitle><AlertDescription>{profileError}</AlertDescription></Alert> : null}
            </form>
          </CardContent>
        </Card>

        <Alert>
          <AlertTitle>{isVietnamese ? "TikTok Ad Library đang tạm dừng" : "TikTok Ad Library is paused"}</AlertTitle>
          <AlertDescription>
            {isVietnamese
              ? "Chỉ profile và video tracker đang hoạt động. Ad Library sẽ mở lại khi actor và danh sách region hỗ trợ dùng chung một contract."
              : "Only profile and video tracking is active. Ad Library returns when the actor and supported-region list share one validated contract."}
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex flex-col gap-4">
        {profileResult ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2">
              <TikTokStatCard label={isVietnamese ? "Profiles" : "Profiles"} value={formatCompactNumber(profileCount)} />
              <TikTokStatCard label={isVietnamese ? "Videos" : "Videos"} value={formatCompactNumber(videoCount)} />
            </section>

            <Alert>
              <AlertTitle>{isVietnamese ? "Public intelligence, không phải Ads Manager" : "Public intelligence, not Ads Manager"}</AlertTitle>
              <AlertDescription>
                {isVietnamese
                  ? "Tín hiệu profile/video hỗ trợ nghiên cứu creative và không được đưa vào Budget Moves."
                  : "Profile and video signals support creative research and never feed Budget Moves."}
              </AlertDescription>
            </Alert>
          </>
        ) : null}

        {!profileResult ? (
          <Empty className="min-h-72 rounded-2xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ActivityIcon /></EmptyMedia>
              <EmptyTitle>{isVietnamese ? "Bắt đầu bằng TikTok profile" : "Start with TikTok profiles"}</EmptyTitle>
              <EmptyDescription>
                {isVietnamese
                  ? "Nhập username TikTok để tạo evidence cho nghiên cứu creative."
                  : "Add TikTok usernames to build evidence for creative research."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {profileResult?.profiles.length ? (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="font-heading text-base font-semibold">
                {isVietnamese ? "So sánh profile" : "Profile comparison"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isVietnamese
                  ? "Mỗi profile giữ riêng follower, likes và quy mô video."
                  : "Each profile keeps its own audience, likes, and video scale."}
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {profileResult.profiles.map((profile) => (
                <TikTokProfileCard key={profile.id || profile.username} profile={profile} language={language} />
              ))}
            </div>
          </section>
        ) : null}

        {profileResult?.warnings.length ? (
          <div className="flex flex-col gap-2">
            {profileResult.warnings.slice(0, 3).map((warning, index) => (
              <Alert key={`${warning}-${index}`} variant="destructive">
                <AlertTitle>{isVietnamese ? "Cảnh báo profile" : "Profile warning"}</AlertTitle>
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}

        {profileResult?.videos.length ? (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="font-heading text-base font-semibold">
                {isVietnamese ? "Video theo profile" : "Videos by profile"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isVietnamese
                  ? "Video được nhóm theo creator để không trộn tín hiệu creative."
                  : "Videos stay grouped by creator so creative signals are never mixed."}
              </p>
            </div>
            {profileVideoGroups.map(({ profile, videos }) => (
              videos.length ? (
                <TikTokVideoGroup
                  key={profile.id || profile.username}
                  username={profile.username}
                  videos={videos}
                  language={language}
                />
              ) : null
            ))}
            {unattributedVideos.length ? (
              <TikTokVideoGroup
                username={isVietnamese ? "Chưa xác định profile" : "Unattributed"}
                videos={unattributedVideos}
                language={language}
                unattributed
              />
            ) : null}
          </section>
        ) : null}

      </div>

      <StickyActionDock
        contextLabel={isVietnamese ? "TikTok tracker" : "TikTok tracker"}
        status={profileLoading ? "working" : profiles.length ? "ready" : "blocked"}
        statusLabel={profileLoading
          ? isVietnamese ? "Đang kéo profile" : "Fetching profiles"
          : profiles.length
            ? isVietnamese ? `${profiles.length} profile sẵn sàng` : `${profiles.length} profiles ready`
            : isVietnamese ? "Cần username" : "Add usernames"}
        primaryAction={{
          id: "fetch-tiktok-profiles",
          label: profileResult
            ? isVietnamese ? "Làm mới profile" : "Refresh profiles"
            : isVietnamese ? "Kéo profile" : "Fetch profiles",
          shortLabel: isVietnamese ? "Kéo profile" : "Fetch profiles",
          icon: RefreshCcwIcon,
          onSelect: fetchProfiles,
          disabled: !profiles.length,
          disabledReason: isVietnamese ? "Nhập ít nhất một username TikTok." : "Add at least one TikTok username.",
          loading: profileLoading,
          shortcut: "mod+enter",
        }}
        shortcutsDisabled={chatShortcutsDisabled}
        companionAction={{
          id: "open-tiktok-assistant",
          label: isVietnamese ? "Hỏi trợ lý AI về TikTok" : "Ask the smart assistant about TikTok",
          shortLabel: isVietnamese ? "Trợ lý AI" : "Assistant",
          controlsId: CONTEXT_CHAT_PANEL_ID,
          icon: BotMessageSquareIcon,
          onSelect: onOpenAssistant,
        }}
        companionActive={chatShortcutsDisabled}
      />
    </div>
  );
}

function TikTokProfileCard({
  profile,
  language,
}: {
  profile: TikTokProfile;
  language: ReportLanguage;
}) {
  const isVietnamese = language === "vi";
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="truncate">@{profile.username}</CardTitle>
            <CardDescription>{profile.displayName || (isVietnamese ? "Profile TikTok" : "TikTok profile")}</CardDescription>
          </div>
          {profile.profileUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(profile.profileUrl, "_blank", "noopener,noreferrer")}
            >
              {isVietnamese ? "Mở profile" : "Open profile"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TikTokInlineStat label={isVietnamese ? "Follower" : "Followers"} value={formatMaybeNumber(profile.followerCount)} />
          <TikTokInlineStat label={isVietnamese ? "Following" : "Following"} value={formatMaybeNumber(profile.followingCount)} />
          <TikTokInlineStat label={isVietnamese ? "Likes" : "Likes"} value={formatMaybeNumber(profile.likesCount)} />
          <TikTokInlineStat label={isVietnamese ? "Videos" : "Videos"} value={formatMaybeNumber(profile.videoCount)} />
        </div>
        {profile.bio ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{profile.bio}</p> : null}
      </CardContent>
    </Card>
  );
}

function TikTokVideoGroup({
  username,
  videos,
  language,
  unattributed = false,
}: {
  username: string;
  videos: TikTokVideo[];
  language: ReportLanguage;
  unattributed?: boolean;
}) {
  const isVietnamese = language === "vi";
  const visibleVideos = videos.slice(0, 6);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{unattributed ? username : `@${username}`}</CardTitle>
            <CardDescription>
              {videos.length > visibleVideos.length
                ? isVietnamese
                  ? `Hiển thị ${visibleVideos.length}/${videos.length} video mới nhất.`
                  : `Showing ${visibleVideos.length} of ${videos.length} recent videos.`
                : isVietnamese
                  ? `${videos.length} video public.`
                  : `${videos.length} public ${videos.length === 1 ? "video" : "videos"}.`}
            </CardDescription>
          </div>
          <Badge variant={unattributed ? "outline" : "secondary"} className="shrink-0">
            {unattributed ? (isVietnamese ? "Cần kiểm tra" : "Review") : `@${username}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleVideos.map((video) => (
            <article key={video.id} className="min-w-0 border-t pt-3">
              {video.coverUrl ? (
                <img
                  src={video.coverUrl}
                  alt={video.text || `${username} TikTok video`}
                  className="mb-3 aspect-video w-full rounded-lg border object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant="outline" className="max-w-full truncate">
                  {video.username ? `@${video.username}` : isVietnamese ? "Chưa rõ profile" : "Unknown profile"}
                </Badge>
              </div>
              <p className="line-clamp-3 text-sm font-medium leading-5">
                {compactText(video.text || (isVietnamese ? "Không có caption" : "No caption"), 180)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{isVietnamese ? "View" : "Views"}: {formatMaybeNumber(video.playCount)}</span>
                <span>{isVietnamese ? "Like" : "Likes"}: {formatMaybeNumber(video.likeCount)}</span>
                <span>{isVietnamese ? "Share" : "Shares"}: {formatMaybeNumber(video.shareCount)}</span>
              </div>
              {video.videoUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => window.open(video.videoUrl, "_blank", "noopener,noreferrer")}
                >
                  {isVietnamese ? "Mở video" : "Open video"}
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TikTokStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/70 p-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function TikTokInlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-t pt-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function formatMaybeNumber(value?: number) {
  return value === undefined ? "-" : formatCompactNumber(value);
}

function clampWholeNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function platformLabel(platform: CompetitorPlatform) {
  return competitorPlatformItems.find((item) => item.value === platform)?.label || platform;
}

function appSectionLabel(value: ActiveView, language: ReportLanguage) {
  return uiCopy[language].nav[value];
}

function workflowLabel(value: (typeof workflowItems)[number]["value"], language: ReportLanguage) {
  const labels = uiCopy[language].nav;
  if (value === "connect") return labels.connect;
  if (value === "select") return labels.select;
  if (value === "analyze") return labels.analyze;
  return labels.verdict;
}

function workflowStateLabel(state: "complete" | "current" | "pending", language: ReportLanguage) {
  if (state === "complete") return language === "vi" ? "Xong" : "Done";
  if (state === "current") return language === "vi" ? "Đang làm" : "Now";
  return language === "vi" ? "Sau" : "Next";
}

function providerLabel(provider: Provider, language: ReportLanguage, capabilities?: CapabilityStatus[]) {
  if (provider === "9router") return language === "vi" ? "Trợ lý AI" : "AI assistant";
  if (provider === "prompt") return language === "vi" ? "Luật local" : "Local rules only";
  const enhancement = capabilities?.find((capability) => capability.key === "ai_enhancement");
  if (enhancement?.state === "available") return language === "vi" ? "AI sẵn sàng" : "AI ready";
  if (enhancement?.state === "degraded") return language === "vi" ? "Fallback local đang bật" : "Local fallback active";
  return language === "vi" ? "Tự chọn nguồn tốt nhất" : "Auto: best available";
}

function packLabel(pack: KpiPack, language: ReportLanguage) {
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

function compareLabel(mode: CompareMode, language: ReportLanguage) {
  if (mode === "off") return language === "vi" ? "Không so sánh" : "No compare";
  return modeLabel(mode, language);
}

function modeLabel(mode: CompareMode, language: ReportLanguage = "en") {
  if (mode === "wow") return "WoW";
  if (mode === "mom") return "MoM";
  if (mode === "yoy") return "YoY";
  return language === "vi" ? "Tắt" : "Off";
}

function metricLabel(key: string, language: ReportLanguage = "en") {
  const labels: Record<ReportLanguage, Record<string, string>> = {
    en: {
    spend: "Spend",
    messages: "Messages",
    leads: "Leads",
    purchases: "Purchases",
    linkClicks: "Link clicks",
    ctr: "CTR",
    frequency: "Frequency",
    costPerMessage: "Cost/msg",
    cpl: "CPL",
    roas: "ROAS",
    },
    vi: {
      spend: "Chi tiêu",
      messages: "Tin nhắn",
      leads: "Lead",
      purchases: "Purchase",
      linkClicks: "Link click",
      ctr: "CTR",
      frequency: "Frequency",
      costPerMessage: "Cost/msg",
      cpl: "CPL",
      roas: "ROAS",
    },
  };
  return labels[language][key] || key;
}

function averageRows(rows: NormalizedRow[], key: keyof NormalizedRow): number {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length;
}

function sumRows(rows: NormalizedRow[], key: keyof NormalizedRow): number {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function BreakdownAnalysisSection({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const dimensions = React.useMemo(
    () => buildBreakdownDimensions({
      platformRows: report.platformRows,
      ageGenderRows: report.ageGenderRows,
      regionRows: report.regionRows || [],
      countryRows: report.countryRows,
      language,
    }),
    [language, report.ageGenderRows, report.countryRows, report.platformRows, report.regionRows],
  );
  const defaultDimension = dimensions.find((dimensionItem) => dimensionItem.available)?.value || "platform";
  const [dimension, setDimension] = React.useState<BreakdownDimension>(defaultDimension);
  const selectedDimension = dimensions.find((dimensionItem) => dimensionItem.value === dimension && dimensionItem.available)
    || dimensions.find((dimensionItem) => dimensionItem.available)
    || dimensions[0];
  const sideModel = buildBreakdownViewModel({
    dimensions,
    selectedDimension: dimension,
    mode: "spend",
    pack: report.selectedPack,
    language,
  });

  React.useEffect(() => {
    if (selectedDimension?.value && selectedDimension.value !== dimension) {
      setDimension(selectedDimension.value);
    }
  }, [dimension, selectedDimension?.value]);

  return (
    <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[1.6fr_1fr]" data-print-flow>
      <div className="min-w-0 rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Chẩn đoán phân khúc" : "Segment Diagnostics"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{copy.breakdowns}</h2>
          <p className="text-sm text-muted-foreground">{copy.breakdownsDescription}</p>
        </div>
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border bg-background/50 p-4">
          <AdaptiveBreakdownChart
            report={report}
            language={language}
            dimensions={dimensions}
            dimension={dimension}
            onDimensionChange={setDimension}
          />
        </div>
      </div>
      <BreakdownWasteCard
        report={report}
        language={language}
        rows={selectedDimension?.rows || []}
        chartRows={sideModel.summaryRows}
        dimensionLabel={selectedDimension?.label || ""}
      />
    </section>
  );
}

function AdaptiveBreakdownChart({
  report,
  language,
  dimensions,
  dimension,
  onDimensionChange,
}: {
  report: DashboardReport;
  language: ReportLanguage;
  dimensions: ReturnType<typeof buildBreakdownDimensions>;
  dimension: BreakdownDimension;
  onDimensionChange: (dimension: BreakdownDimension) => void;
}) {
  const [mode, setMode] = React.useState<BreakdownMetricMode>("spend");
  const currency = report.account.currency || "VND";
  const model = buildBreakdownViewModel({
    dimensions,
    selectedDimension: dimension,
    mode,
    pack: report.selectedPack,
    language,
  });
  const annotations = buildBreakdownChartAnnotations({
    chartType: model.chartType,
    mode,
    dimensionLabel: model.activeDimensionLabel,
    metricLabel: model.metricLabel,
    chartLabel: model.chartLabel,
    chartExplanation: model.chartExplanation,
    resultLabel: model.resultLabel,
    currency,
    language,
  });
  const metricCopy = breakdownMetricCopy(language);

  React.useEffect(() => {
    if (model.activeDimension !== dimension) onDimensionChange(model.activeDimension);
  }, [dimension, model.activeDimension, onDimensionChange]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" data-print-hidden>
        <ToggleGroup
          aria-label={language === "vi" ? "Dimension breakdown" : "Breakdown dimension"}
          value={[dimension]}
          onValueChange={(values) => {
            const next = values.find((value): value is BreakdownDimension => value === "platform" || value === "age" || value === "gender" || value === "geography");
            if (next) onDimensionChange(next);
          }}
          multiple={false}
          variant="outline"
          size="sm"
          spacing={0}
        >
          {dimensions.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value} disabled={!item.available} aria-label={item.label}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          aria-label={language === "vi" ? "Metric breakdown" : "Breakdown metric"}
          value={[mode]}
          onValueChange={(values) => {
            const next = values.find((value): value is BreakdownMetricMode => value === "spend" || value === "results" || value === "efficiency");
            if (next) setMode(next);
          }}
          multiple={false}
          variant="outline"
          size="sm"
          spacing={0}
        >
          <ToggleGroupItem value="spend" aria-label={metricCopy.spend}>{metricCopy.spend}</ToggleGroupItem>
          <ToggleGroupItem value="results" aria-label={metricCopy.results}>{metricCopy.results}</ToggleGroupItem>
          <ToggleGroupItem value="efficiency" aria-label={metricCopy.efficiency}>{metricCopy.efficiency}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Alert variant={model.insightTone === "warning" ? "destructive" : "default"}>
        <AlertTitle>{model.topInsight}</AlertTitle>
        <AlertDescription>{model.recommendedAction}</AlertDescription>
      </Alert>

      {!model.rows.length ? <ChartEmpty language={language} /> : null}
      {model.rows.length && model.chartType === "pie" ? (
        <BreakdownPieChart rows={model.rows} mode={mode} currency={currency} language={language} annotations={annotations} />
      ) : null}
      {model.rows.length && model.chartType === "area" ? (
        <BreakdownAreaChart rows={model.rows} mode={mode} currency={currency} language={language} annotations={annotations} />
      ) : null}
      {model.rows.length && model.chartType === "bar" ? (
        <BreakdownBarChart rows={model.rows} mode={mode} currency={currency} language={language} annotations={annotations} />
      ) : null}
      {model.rows.length && model.chartType === "scatter" ? (
        <BreakdownScatterChart rows={model.rows} currency={currency} language={language} annotations={annotations} />
      ) : null}
    </div>
  );
}

const BREAKDOWN_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function BreakdownPieChart({ rows, mode, currency, language, annotations }: { rows: BreakdownChartRow[]; mode: BreakdownMetricMode; currency: string; language: ReportLanguage; annotations: BreakdownChartAnnotations }) {
  const dataKey = mode === "results" ? "results" : "spend";
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const totalResults = rows.reduce((sum, row) => sum + row.results, 0);
  const centerValue = dataKey === "results" ? formatMetric(totalResults, "number", currency) : formatMetric(totalSpend, "currency", currency);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ChartAnnotationHeader annotations={annotations} />
      <ChartContainer config={performanceChartConfig} className="relative h-[300px] min-w-0 w-full" role="img" aria-label={annotations.title}>
        <PieChart>
          <ChartTooltip content={<BreakdownTooltip mode={mode} currency={currency} language={language} dimensionLabel={annotations.title} />} />
          <Pie data={rows} dataKey={dataKey} nameKey="label" innerRadius={62} outerRadius={104} paddingAngle={2} label={(props: { percent?: number }) => formatSharePct(Number(props.percent ?? 0), currency)} labelLine={false}>
            {rows.map((row, index) => <Cell key={row.id} fill={BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length]} />)}
          </Pie>
        </PieChart>
        {annotations.centerTotalLabel ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{annotations.centerTotalLabel}</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{centerValue}</span>
          </div>
        ) : null}
      </ChartContainer>
      <ChartAnnotationLegend annotations={annotations} />
    </div>
  );
}

function BreakdownAreaChart({ rows, mode, currency, language, annotations }: { rows: BreakdownChartRow[]; mode: BreakdownMetricMode; currency: string; language: ReportLanguage; annotations: BreakdownChartAnnotations }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ChartAnnotationHeader annotations={annotations} />
      <ChartContainer config={performanceChartConfig} className="h-[300px] min-w-0 w-full" role="img" aria-label={annotations.title}>
        <ComposedChart data={rows} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
          <YAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => formatSharePct(Number(value), currency)} domain={paddedPositiveDomain()} label={annotations.yAxisLabel ? { value: annotations.yAxisLabel, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "currentColor" } } : undefined} />
          <ChartTooltip content={<BreakdownTooltip mode={mode} currency={currency} language={language} dimensionLabel={annotations.title} />} />
          <Area type="monotone" dataKey="spendShare" name={language === "vi" ? "Tỷ trọng chi tiêu" : "Spend share"} stroke="var(--color-spend)" fill="var(--color-spend)" fillOpacity={0.18} strokeWidth={2} />
          <Area type="monotone" dataKey="resultShare" name={language === "vi" ? "Tỷ trọng kết quả" : "Result share"} stroke="var(--color-result)" fill="var(--color-result)" fillOpacity={0.12} strokeWidth={2} />
        </ComposedChart>
      </ChartContainer>
      <ChartAnnotationLegend annotations={annotations} />
    </div>
  );
}

function BreakdownBarChart({ rows, mode, currency, language, annotations }: { rows: BreakdownChartRow[]; mode: BreakdownMetricMode; currency: string; language: ReportLanguage; annotations: BreakdownChartAnnotations }) {
  const dataKey = breakdownChartDataKey(mode);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ChartAnnotationHeader annotations={annotations} />
      <ChartContainer config={performanceChartConfig} className="h-[300px] min-w-0 w-full" role="img" aria-label={annotations.title}>
        <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 36, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" domain={paddedPositiveDomain()} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactNumber(Number(value), currency)} label={annotations.xAxisLabel ? { value: annotations.xAxisLabel, position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "currentColor" } } : undefined} />
          <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={132} tickMargin={8} />
          <ChartTooltip content={<BreakdownTooltip mode={mode} currency={currency} language={language} dimensionLabel={annotations.title} />} />
          <Bar dataKey={dataKey} fill={breakdownBarFill(mode)} radius={[0, 4, 4, 0]} label={(props: { value?: unknown; x?: string | number; y?: string | number; width?: string | number }) => {
            if (typeof props.value !== "number" || typeof props.x !== "number" || typeof props.y !== "number" || typeof props.width !== "number") return null;
            return <text x={props.x + props.width + 6} y={props.y} dy={4} fontSize={11} textAnchor="start" fill="currentColor" className="font-mono tabular-nums">{formatMetric(props.value, mode === "results" ? "number" : "currency", currency)}</text>;
          }} />
        </BarChart>
      </ChartContainer>
      <ChartAnnotationLegend annotations={annotations} />
    </div>
  );
}

function BreakdownScatterChart({ rows, currency, language, annotations }: { rows: BreakdownChartRow[]; currency: string; language: ReportLanguage; annotations: BreakdownChartAnnotations }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ChartAnnotationHeader annotations={annotations} />
      <ChartContainer config={performanceChartConfig} className="h-[300px] min-w-0 w-full" role="img" aria-label={annotations.title}>
        <ScatterChart margin={{ left: 8, right: 16, top: 12, bottom: 8 }}>
          <CartesianGrid />
          <XAxis dataKey="spend" name={language === "vi" ? "Chi tiêu" : "Spend"} type="number" domain={paddedPositiveDomain()} tickFormatter={(value) => formatCompactNumber(Number(value), currency)} label={annotations.xAxisLabel ? { value: annotations.xAxisLabel, position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "currentColor" } } : undefined} />
          <YAxis dataKey="efficiencyValue" name={language === "vi" ? "Chi phí/kết quả" : "Cost/result"} type="number" domain={paddedPositiveDomain()} tickFormatter={(value) => formatCompactNumber(Number(value), currency)} label={annotations.yAxisLabel ? { value: annotations.yAxisLabel, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "currentColor" } } : undefined} />
          <ZAxis dataKey="results" range={[60, 320]} />
          <ChartTooltip content={<BreakdownTooltip mode="efficiency" currency={currency} language={language} dimensionLabel={annotations.title} />} />
          <Scatter data={rows} fill="var(--color-spend)" name={language === "vi" ? "Phân khúc" : "Segment"} />
        </ScatterChart>
      </ChartContainer>
      <ChartAnnotationLegend annotations={annotations} />
    </div>
  );
}

function BreakdownTooltip({
  active,
  payload,
  mode,
  currency,
  language,
  dimensionLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: BreakdownChartRow }>;
  mode: BreakdownMetricMode;
  currency: string;
  language: ReportLanguage;
  dimensionLabel: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const metricCopy = breakdownMetricCopy(language);
  const metricLabel = mode === "spend" ? metricCopy.spend : mode === "results" ? metricCopy.results : metricCopy.efficiency;
  const metricValue = mode === "spend"
    ? formatMetric(row.spend, "currency", currency)
    : mode === "results"
      ? formatMetric(row.results, "number", currency)
      : row.costPerResult === null
        ? (language === "vi" ? "Chưa có kết quả" : "No result yet")
        : formatMetric(row.costPerResult, "currency", currency);

  return (
    <div className="grid min-w-64 gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="grid gap-0.5">
        <div className="font-medium">{row.label}</div>
        <div className="text-muted-foreground">{dimensionLabel}</div>
      </div>
      <div className="grid gap-1">
        <TooltipMetric label={metricLabel} value={metricValue} />
        <TooltipMetric label={metricCopy.spend} value={formatMetric(row.spend, "currency", currency)} />
        <TooltipMetric label={language === "vi" ? "Kết quả chính" : "Primary results"} value={formatMetric(row.results, "number", currency)} />
        <TooltipMetric label={language === "vi" ? "Tỷ trọng chi tiêu" : "Spend share"} value={formatSharePct(row.spendShare, currency)} />
        <TooltipMetric label={language === "vi" ? "Tỷ trọng kết quả" : "Result share"} value={formatSharePct(row.resultShare, currency)} />
      </div>
      <div className="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">{row.diagnosis}</div>
    </div>
  );
}

function TooltipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ChartAnnotationHeader({ annotations }: { annotations: BreakdownChartAnnotations }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-foreground">{annotations.title}</span>
      <span className="text-[11px] leading-snug text-muted-foreground">{annotations.subtitle}</span>
    </div>
  );
}

function ChartAnnotationLegend({ annotations }: { annotations: BreakdownChartAnnotations }) {
  if (!annotations.legend.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {annotations.legend.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function breakdownChartDataKey(mode: BreakdownMetricMode) {
  if (mode === "results") return "results";
  if (mode === "efficiency") return "efficiencyValue";
  return "spend";
}

function breakdownBarFill(mode: BreakdownMetricMode) {
  if (mode === "results") return "var(--color-result)";
  if (mode === "efficiency") return "var(--color-costPerMessage)";
  return "var(--color-spend)";
}

function breakdownMetricCopy(language: ReportLanguage) {
  return language === "vi"
    ? { spend: "Chi tiêu", results: "Kết quả", efficiency: "Chi phí/kết quả" }
    : { spend: "Spend", results: "Results", efficiency: "Cost per result" };
}

function paddedPositiveDomain(referenceValue: number | null = null) {
  return ([dataMin, dataMax]: readonly [number, number]): [number, number] => {
    const safeMin = Number.isFinite(dataMin) ? dataMin : 0;
    const safeMax = Math.max(Number.isFinite(dataMax) ? dataMax : 0, referenceValue || 0);
    return [Math.min(0, safeMin), safeMax > 0 ? safeMax * 1.15 : 1];
  };
}

function PerformanceCharts({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
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

function ChartEmpty({ language }: { language: ReportLanguage }) {
  return <div className="flex h-56 items-center justify-center rounded-lg border text-sm text-muted-foreground">{uiCopy[language].empty.chart}</div>;
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
  language: ReportLanguage;
  daily?: boolean;
  pack?: KpiPack;
}) {
  const copy = uiCopy[language];
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

function diagnosticAccentClass(variant: "default" | "secondary" | "destructive" | "outline"): string | undefined {
  return variant === "destructive" ? "border-l-4 border-l-destructive" : undefined;
}

function toneFromVariant(variant: "default" | "secondary" | "destructive" | "outline"): DiagnosticTone {
  if (variant === "destructive") return "critical";
  if (variant === "outline") return "warning";
  return "ok";
}

function DiagnosticNextStep({ kind, tone, language }: { kind: DiagnosticKind; tone: DiagnosticTone; language: ReportLanguage }) {
  return (
    <p className="mt-1 border-t pt-2 text-xs">
      <span className="font-medium text-foreground">{language === "vi" ? "Bước tiếp theo: " : "Next step: "}</span>
      <span className="text-muted-foreground">{diagnosticNextStep(kind, tone, language)}</span>
    </p>
  );
}

function HealthTriageCard({ summary, language }: { summary: HealthScoreSummary; language: ReportLanguage }) {
  const activeItems = summary.items.filter((item) => item.severity !== "healthy").slice(0, 4);
  const healthyItems = summary.items.filter((item) => item.severity === "healthy");
  const variant = summary.severity === "danger" ? "destructive" : summary.severity === "warning" ? "outline" : "secondary";
  const healthyCopy = language === "vi" ? `${summary.counts.healthy} kiểm tra khỏe mạnh` : `${summary.counts.healthy} healthy checks`;

  return (
    <div data-print-flow className={`${summary.severity === "danger" ? "border-l-4 border-l-destructive" : ""} rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Phân loại sức khỏe" : "Health Triage"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{language === "vi" ? "Điểm sức khỏe & ưu tiên" : "Health score & priorities"}</h2>
          <p className="text-sm text-muted-foreground">
            {language === "vi" ? "Tổng hợp các kiểm tra quan trọng thành một hàng đợi xử lý." : "Rolls key checks into one prioritized action queue."}
          </p>
        </div>
        <Badge variant={variant}>{summary.label[language]}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4 rounded-xl border bg-background/50 p-4">
          <div>
            <div className="text-4xl font-semibold tabular-nums">{summary.score}/100</div>
            <p className="text-sm text-muted-foreground">{summary.summary[language]}</p>
          </div>
          <Badge variant={variant}>{language === "vi" ? "Hạng" : "Grade"} {summary.grade}</Badge>
        </div>
        <Separator />
        {activeItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            {activeItems.map((item) => (
              <div key={item.id} className={`rounded-xl border px-3 py-2.5 ${item.severity === "danger" ? "border-destructive/30 bg-destructive/5" : "bg-background/50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-sm font-medium ${item.severity === "danger" ? "text-destructive" : ""}`}>{item.title[language]}</div>
                  <Badge variant={item.severity === "danger" ? "destructive" : "outline"}>{item.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail[language]}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{language === "vi" ? "Không có vấn đề ưu tiên cần xử lý." : "No priority issues to review."}</p>
        )}
        {healthyItems.length > 0 ? (
          <>
            <details className="rounded-xl border bg-background/50 p-3 text-sm text-muted-foreground" data-print-hidden>
              <summary className="cursor-pointer font-medium text-foreground">{healthyCopy}</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {healthyItems.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-2 text-xs">
                    <span>{item.title[language]}</span>
                    <span className="text-muted-foreground">{item.detail[language]}</span>
                  </li>
                ))}
              </ul>
            </details>
            <div className="rounded-xl border bg-background/50 p-3 text-sm text-muted-foreground" data-print-only>
              <div className="font-medium text-foreground">{healthyCopy}</div>
              <ul className="mt-2 flex flex-col gap-1">
                {healthyItems.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-2 text-xs">
                    <span>{item.title[language]}</span>
                    <span className="text-muted-foreground">{item.detail[language]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
        <DiagnosticNextStep kind="healthTriage" tone={toneFromVariant(variant)} language={language} />
      </div>
    </div>
  );
}

function DailyDiagnosisCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const diagnosis = diagnoseDailyChange({ dailyRows: report.dailyRows, selectedPack: report.selectedPack });
  const hasDanger = diagnosis.causes.some((cause) => cause.severity === "danger");
  const title = language === "vi" ? "Vì sao có thay đổi?" : "Why did this change?";
  const description =
    language === "vi"
      ? "Chẩn đoán nguyên nhân gốc từ xu hướng theo ngày trong báo cáo này."
      : "Root-cause diagnosis from the daily trend inside this report.";
  const badge =
    diagnosis.status === "causes_found"
      ? { variant: (hasDanger ? "destructive" : "outline") as "destructive" | "outline", text: language === "vi" ? `${diagnosis.causes.length} nguyên nhân` : `${diagnosis.causes.length} cause${diagnosis.causes.length > 1 ? "s" : ""}` }
      : diagnosis.status === "stable"
        ? { variant: "secondary" as const, text: language === "vi" ? "Ổn định" : "Stable" }
        : { variant: "outline" as const, text: language === "vi" ? "Chưa đủ dữ liệu" : "Need more data" };

  return (
    <div data-print-flow className={`${hasDanger ? "border-l-4 border-l-destructive" : ""} rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Nguyên nhân gốc" : "Root Cause"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant={badge.variant}>{badge.text}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <p className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">{diagnosis.summary[language]}</p>
        {diagnosis.causes.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {diagnosis.causes.map((cause) => (
              <li
                key={cause.id}
                className={`flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 ${cause.severity === "danger" ? "border-destructive/30 bg-destructive/5" : "bg-background/50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${cause.severity === "danger" ? "text-destructive" : ""}`}>{cause.title[language]}</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {cause.evidence.map((line) => (
                      <Badge key={line.en} variant="outline" className="tabular-nums">{line[language]}</Badge>
                    ))}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{cause.action[language]}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <DiagnosticNextStep
          kind="dailyDiagnosis"
          tone={diagnosis.status === "insufficient_data" ? "insufficient" : diagnosis.status === "stable" ? "ok" : hasDanger ? "critical" : "warning"}
          language={language}
        />
      </div>
    </div>
  );
}

function ExperimentReadinessCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const readiness = assessExperimentReadiness(report);
  const items = readiness.blockers[language].length > 0 ? readiness.blockers[language] : [readiness.nextAction[language]];
  return (
    <div data-print-flow className={`${diagnosticAccentClass(readiness.variant)} rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Cổng thử nghiệm" : "Experiment Gate"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{copy.readiness}</h2>
          <p className="text-sm text-muted-foreground">{copy.readinessDescription}</p>
        </div>
        <Badge variant={readiness.variant}>{readiness.label[language]}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <div className="rounded-xl border bg-background/50 p-4">
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {items.map((item) => (
              <li key={item} className="rounded-xl border bg-card/70 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <DiagnosticNextStep kind="experimentReadiness" tone={toneFromVariant(readiness.variant)} language={language} />
      </div>
    </div>
  );
}

function DecisionConfidenceCard({ report, language, targets }: { report: DashboardReport; language: ReportLanguage; targets: DecisionTargets }) {
  const rows = (report.adsetRows.length > 0 ? report.adsetRows : report.campaignRows).filter((row) => row.spend > 0);
  const assessments = rows.map((row) => ({ row, confidence: assessDecisionConfidence(row, report.selectedPack, language, targets) }));
  const blocked = assessments.filter((item) => !item.confidence.actionable);
  const actionable = assessments.filter((item) => item.confidence.actionable);
  const topBlocked = blocked.slice(0, 3);
  const isVietnamese = language === "vi";
  const variant = rows.length === 0 ? "outline" : blocked.length > actionable.length ? "destructive" : blocked.length > 0 ? "outline" : "secondary";

  return (
    <div data-print-flow className={`${diagnosticAccentClass(variant)} rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {isVietnamese ? "Cổng bằng chứng" : "Evidence Gate"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{isVietnamese ? "Độ tin cậy quyết định" : "Decision confidence"}</h2>
          <p className="text-sm text-muted-foreground">
            {isVietnamese ? "Chặn kill/scale khi dữ liệu còn mỏng hoặc delivery chưa đủ ổn định." : "Downgrades kill/scale advice when evidence is thin or delivery is unstable."}
          </p>
        </div>
        <Badge variant={variant}>{actionable.length}/{rows.length || 0} {isVietnamese ? "actionable" : "actionable"}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <p className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">
          {rows.length === 0
            ? isVietnamese ? "Chưa có dòng có chi tiêu để đánh giá." : "No spent rows are available for confidence checks."
            : isVietnamese
              ? `${blocked.length} dòng đang bị hạ cấp vì chưa đủ bằng chứng quyết định.`
              : `${blocked.length} rows are downgraded because decision evidence is not strong enough.`}
        </p>
        {topBlocked.length > 0 ? (
          <div className="flex flex-col gap-2">
            {topBlocked.map(({ row, confidence }) => (
              <div key={row.id} className="rounded-xl border bg-background/50 px-3 py-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 truncate font-medium">{row.name}</div>
                  <Badge variant={confidence.variant} className="shrink-0">{confidence.label[language]}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{confidence.reasons[language][0]}</p>
              </div>
            ))}
          </div>
        ) : null}
        <DiagnosticNextStep kind="decisionConfidence" tone={rows.length === 0 ? "insufficient" : toneFromVariant(variant)} language={language} />
      </div>
    </div>
  );
}

function CreativeVolumeCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const assessment = assessCreativeVolume(report.adRows);
  const isVietnamese = language === "vi";
  const visibleAdsets = assessment.adsets.filter((adset) => adset.status !== "healthy").slice(0, 3);
  const displayAdsets = visibleAdsets.length > 0 ? visibleAdsets : assessment.adsets.slice(0, 2);

  return (
    <div data-print-flow className={`${diagnosticAccentClass(assessment.variant)} rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {isVietnamese ? "Năng lực creative" : "Creative Capacity"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{isVietnamese ? "Volume creative" : "Creative volume"}</h2>
          <p className="text-sm text-muted-foreground">
            {isVietnamese ? "Proxy số creative có chạy/chi tiêu trong mỗi ad set; chưa đo similarity hoặc Advantage+." : "Proxy for active/spent creative count per ad set; does not measure similarity or Advantage+ type yet."}
          </p>
        </div>
        <Badge variant={assessment.variant}>{assessment.label[language]}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <p className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">{assessment.summary[language]}</p>
        {displayAdsets.length > 0 ? (
          <div className="flex flex-col gap-2">
            {displayAdsets.map((adset) => (
              <div key={adset.adsetId} className="rounded-xl border bg-background/50 px-3 py-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 truncate font-medium">{adset.adsetName}</div>
                  <Badge variant={adset.variant} className="shrink-0 tabular-nums">{adset.creativeCount}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{adset.reason[language]}</p>
              </div>
            ))}
          </div>
        ) : null}
        <DiagnosticNextStep kind="creativeVolume" tone={assessment.status === "insufficient_data" ? "insufficient" : toneFromVariant(assessment.variant)} language={language} />
      </div>
    </div>
  );
}

function BudgetMoveEngineCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const engine = recommendBudgetMoves(report);
  const reasons = engine.holdReasons[language];
  return (
    <div data-print-flow className={`${diagnosticAccentClass(engine.variant)} rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Động cơ ngân sách" : "Budget Engine"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{copy.budgetMoveEngine}</h2>
          <p className="text-sm text-muted-foreground">{copy.budgetMoveEngineDescription}</p>
        </div>
        <Badge variant={engine.variant}>{engine.label[language]}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <p className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">{engine.summary[language]}</p>
        {engine.recommendations.length > 0 ? (
          <div className="flex flex-col gap-2">
            {engine.recommendations.map((recommendation) => (
              <div key={recommendation.id} className="flex flex-col gap-2 rounded-xl border bg-background/50 px-3 py-2.5 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{recommendation.summary[language]}</div>
                  <Badge variant="outline" className="shrink-0 tabular-nums">{recommendation.suggestedMovePercent}%</Badge>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <div className="font-medium text-foreground">Target: {recommendation.targetRowName}</div>
                    <ul className="mt-1 flex flex-col gap-1">
                      {recommendation.targetReasons.flatMap((reason) => reason.reasons).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Source: {recommendation.sourceRowName}</div>
                    <ul className="mt-1 flex flex-col gap-1">
                      {recommendation.sourceReasons.flatMap((reason) => reason.reasons).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Max target increase +{recommendation.maxIncreasePercent}%; max source reduction {recommendation.maxReductionPercent}%.
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-background/50 p-4">
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        )}
        <DiagnosticNextStep kind="budgetMove" tone={toneFromVariant(engine.variant)} language={language} />
      </div>
    </div>
  );
}

function FunnelLeakageCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const currency = report.account.currency || "VND";
  const leakage = assessFunnelLeakage(report.totals);
  const items = leakage.blockers[language].length > 0 ? leakage.blockers[language] : [leakage.summary[language]];
  const stages = [
    { key: "clicks", label: language === "vi" ? "Click link" : "Link clicks", value: report.totals.linkClicks, benchmark: null },
    { key: "cart", label: language === "vi" ? "Thêm giỏ" : "Add to cart", value: report.totals.addToCart, benchmark: FUNNEL_BENCHMARKS.clickToCart },
    { key: "checkout", label: language === "vi" ? "Checkout" : "Checkout", value: report.totals.initiateCheckout, benchmark: FUNNEL_BENCHMARKS.cartToCheckout },
    { key: "purchase", label: language === "vi" ? "Mua hàng" : "Purchase", value: report.totals.purchases, benchmark: FUNNEL_BENCHMARKS.checkoutToPurchase },
  ];
  const maxStage = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <div data-print-flow className={`${diagnosticAccentClass(leakage.variant)} rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Chẩn đoán phễu" : "Funnel Diagnostics"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{copy.funnelLeakage}</h2>
          <p className="text-sm text-muted-foreground">{copy.funnelLeakageDescription}</p>
        </div>
        <Badge variant={leakage.variant}>
          {leakage.status === "clean" ? leakage.label[language] : `${leakage.score}/100`}
        </Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {leakage.status !== "insufficient_data" ? (
          <div className="flex flex-col gap-2 rounded-xl border bg-background/50 p-4">
            {stages.map((stage, index) => {
              const previous = index > 0 ? stages[index - 1] : null;
              const width = Math.max(8, (stage.value / maxStage) * 100);
              const drop = previous && previous.value > 0 ? 100 - (stage.value / previous.value) * 100 : 0;
              return (
                <div key={stage.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{stage.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US").format(stage.value)}
                      {previous ? ` · ${formatSharePct(Math.max(0, drop), currency)} ${language === "vi" ? "rơi" : "drop"}` : ""}
                      {stage.benchmark ? ` · ${language === "vi" ? "mốc" : "bench"} ${formatSharePct(stage.benchmark, currency)}` : ""}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted">
                    <div
                      className={`h-3 rounded-full ${index === 0 ? "bg-chart-1" : index === stages.length - 1 && leakage.status === "leakage_detected" ? "bg-destructive" : "bg-chart-2"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">{leakage.summary[language]}</div>
        )}
        <div className="rounded-xl border bg-background/50 p-4">
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <DiagnosticNextStep
          kind="funnelLeakage"
          tone={leakage.status === "insufficient_data" ? "insufficient" : toneFromVariant(leakage.variant)}
          language={language}
        />
      </div>
    </div>
  );
}

function AudienceOverlapCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const currency = report.account.currency || "VND";
  const overlap = assessAudienceOverlap(report.adsetRows);
  return (
    <div data-print-flow className={`${diagnosticAccentClass(overlap.variant)} rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Bản đồ đối tượng" : "Audience Map"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{copy.audienceOverlap}</h2>
          <p className="text-sm text-muted-foreground">{copy.audienceOverlapDescription}</p>
        </div>
        <Badge variant={overlap.variant}>{overlap.label[language]}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <p className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">{overlap.summary[language]}</p>
        {overlap.pairs.length > 0 ? (
          <div className="flex flex-col gap-2">
            {overlap.pairs.map((pair) => (
              <div key={`${pair.name1}-${pair.name2}`} className="flex flex-col gap-1 rounded-xl border bg-background/50 px-3 py-2.5 text-sm">
                <div className="font-medium tabular-nums">{formatSharePct(pair.similarity, currency)} similarity</div>
                <div className="truncate text-xs text-muted-foreground">{pair.name1}</div>
                <div className="truncate text-xs text-muted-foreground">{pair.name2}</div>
              </div>
            ))}
          </div>
        ) : null}
        <DiagnosticNextStep
          kind="audienceOverlap"
          tone={overlap.status === "insufficient_data" ? "insufficient" : toneFromVariant(overlap.variant)}
          language={language}
        />
      </div>
    </div>
  );
}

function TargetingExclusionsCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const assessment = assessTargetingExclusions(report.adsetRows);
  return (
    <Card data-print-flow className={diagnosticAccentClass(assessment.variant)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{copy.targetingExclusions}</CardTitle>
            <CardDescription>{copy.targetingExclusionsDescription}</CardDescription>
          </div>
          <Badge variant={assessment.variant}>{assessment.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{assessment.summary[language]}</p>
        {assessment.flaggedAdsets.length > 0 ? (
          <div className="flex flex-col gap-2">
            {assessment.flaggedAdsets.map((adset) => (
              <div key={adset.adsetId} className="flex flex-col gap-1 rounded-lg border p-2 text-sm">
                <div className="font-medium truncate text-xs text-muted-foreground">Ad Set: {adset.adsetName}</div>
                <div className="text-xs text-destructive flex items-center gap-1 font-semibold">
                  Matched Keyword: &quot;{adset.keyword}&quot;
                </div>
                <div className="text-xs text-muted-foreground mt-1">{adset.reason[language]}</div>
              </div>
            ))}
          </div>
        ) : null}
        <DiagnosticNextStep kind="targetingExclusions" tone={toneFromVariant(assessment.variant)} language={language} />
      </CardContent>
    </Card>
  );
}

function CreativeStarvationCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const currency = report.account.currency || "VND";
  const assessment = assessCreativeStarvation(report.adRows);
  return (
    <Card data-print-flow className={diagnosticAccentClass(assessment.variant)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{copy.creativeStarvation}</CardTitle>
            <CardDescription>{copy.creativeStarvationDescription}</CardDescription>
          </div>
          <Badge variant={assessment.variant}>{assessment.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{assessment.summary[language]}</p>
        {assessment.adsets.length > 0 ? (
          <div className="flex flex-col gap-2">
            {assessment.adsets.map((adset) => (
              <div key={adset.adsetId} className="flex flex-col gap-2 rounded-lg border p-2 text-sm">
                <div className="font-semibold truncate text-xs text-muted-foreground">Ad Set: {adset.adsetName}</div>
                <div className="text-xs text-muted-foreground">{adset.reason[language]}</div>
                <div className="flex flex-col gap-1 mt-1 border-t pt-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Starved creatives:</span>
                  {adset.starvedAds.map((ad) => (
                    <div key={ad.adId} className="flex items-center justify-between text-xs text-muted-foreground pl-2 border-l-2 border-primary/30">
                      <span className="truncate max-w-[180px]">{ad.adName}</span>
                      <span className="tabular-nums shrink-0 ml-2">{formatSharePct(ad.spendShare, currency)} spend</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <DiagnosticNextStep
          kind="creativeStarvation"
          tone={assessment.status === "insufficient_data" ? "insufficient" : toneFromVariant(assessment.variant)}
          language={language}
        />
      </CardContent>
    </Card>
  );
}

function BreakdownWasteCard({
  report,
  language,
  rows,
  chartRows,
  dimensionLabel,
}: {
  report: DashboardReport;
  language: ReportLanguage;
  rows: NormalizedRow[];
  chartRows: BreakdownChartRow[];
  dimensionLabel: string;
}) {
  const copy = uiCopy[language].performance;
  const currency = report.account.currency || "VND";
  const waste = assessBreakdownWaste(rows, report.selectedPack);
  const description = language === "vi"
    ? `${dimensionLabel}: phân bổ chi tiêu và kết quả.`
    : `${dimensionLabel}: spend and result allocation.`;
  const topRows = chartRows.slice(0, 3);
  return (
    <div data-print-flow className={`${diagnosticAccentClass(waste.variant)} min-w-0 self-start rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {language === "vi" ? "Rủi ro phân bổ" : "Allocation Risk"}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{copy.breakdownWaste}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant={waste.variant} className="shrink-0">{waste.label[language]}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{waste.summary[language]}</p>
        {waste.rows.length > 0 ? (
          <div className="flex flex-col gap-2">
            {waste.rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border bg-background/50 px-3 py-2 text-sm">
                <span className="truncate font-medium">{row.name}</span>
                <span className="text-muted-foreground tabular-nums">{formatSharePct(row.spendShare, currency)} spend</span>
              </div>
            ))}
          </div>
        ) : null}
        {topRows.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">{language === "vi" ? "Phân khúc chi tiêu lớn" : "Top spend segments"}</div>
            {topRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border bg-background/50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatSharePct(row.spendShare, currency)} {language === "vi" ? "chi tiêu" : "spend"} · {formatSharePct(row.resultShare, currency)} {language === "vi" ? "kết quả" : "results"}
                  </div>
                </div>
                <div className="text-right text-xs tabular-nums text-muted-foreground">
                  {formatMetric(row.spend, "currency", currency)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <DiagnosticNextStep kind="breakdownWaste" tone={waste.status === "insufficient_data" ? "insufficient" : toneFromVariant(waste.variant)} language={language} />
      </div>
    </div>
  );
}

function ResultConcentrationCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const currency = report.account.currency || "VND";
  const concentration = assessResultConcentration(report.adRows.length > 0 ? report.adRows : report.adsetRows.length > 0 ? report.adsetRows : report.campaignRows, report.selectedPack);
  return (
    <Card data-print-flow className={diagnosticAccentClass(concentration.variant)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{copy.concentration}</CardTitle>
            <CardDescription>{copy.concentrationDescription}</CardDescription>
          </div>
          <Badge variant={concentration.variant}>{concentration.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{concentration.summary[language]}</p>
        {concentration.topRows.length > 0 ? (
          <div className="flex flex-col gap-2">
            {concentration.topRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 text-sm">
                <span className="truncate font-medium">{row.name}</span>
                <span className="text-muted-foreground tabular-nums">{formatSharePct(row.resultShare || row.spendShare, currency)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <DiagnosticNextStep kind="resultConcentration" tone={concentration.status === "insufficient_data" ? "insufficient" : toneFromVariant(concentration.variant)} language={language} />
      </CardContent>
    </Card>
  );
}

function SpendPacingCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const isVietnamese = language === "vi";
  const currency = report.account.currency || "VND";
  const dateRange = report.dateRange;
  const days = Math.max(1, (new Date(dateRange.until).getTime() - new Date(dateRange.since).getTime()) / (86400 * 1000) + 1);
  const pacing = assessSpendPacing(report.campaignRows, days);
  return (
    <Card data-print-flow className={diagnosticAccentClass(pacing.variant)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{isVietnamese ? "Tốc độ chi tiêu" : "Spend pacing"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "So sánh chi tiêu thực tế với ngân sách kỳ vọng theo kỳ báo cáo."
                : "Compares actual spend against expected budget over the report period."}
            </CardDescription>
          </div>
          <Badge variant={pacing.variant}>{pacing.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{pacing.summary[language]}</p>
        {pacing.campaigns.length > 0 && pacing.status !== "on_pace" && (
          <div className="flex flex-col gap-2">
            {pacing.campaigns
              .filter((c) => c.status !== "on_pace")
              .slice(0, 5)
              .map((c) => (
                <div key={c.id} className="rounded-lg border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{c.name}</span>
                    <Badge variant={c.status === "severely_underpacing" ? "destructive" : "outline"} className="tabular-nums">
                      {formatSharePct(c.pacePercent, currency)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isVietnamese
                      ? `Chi tiêu ${formatMetric(c.spend, "currency", currency)} / kỳ vọng ${formatMetric(c.expectedSpend, "currency", currency)}`
                      : `Spent ${formatMetric(c.spend, "currency", currency)} / expected ${formatMetric(c.expectedSpend, "currency", currency)}`}
                  </p>
                </div>
              ))}
          </div>
        )}
        <DiagnosticNextStep kind="spendPacing" tone={pacing.status === "no_budget_data" ? "insufficient" : toneFromVariant(pacing.variant)} language={language} />
      </CardContent>
    </Card>
  );
}

function ConsolidationPressureCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const isVietnamese = language === "vi";
  const currency = report.account.currency || "VND";
  const dateRange = report.dateRange;
  const days = Math.max(1, (new Date(dateRange.until).getTime() - new Date(dateRange.since).getTime()) / (86400 * 1000) + 1);
  const assessment = assessConsolidationPressure(report.adsetRows, report.selectedPack, days);
  return (
    <Card data-print-flow className={diagnosticAccentClass(assessment.variant)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{isVietnamese ? "Áp lực hợp nhất" : "Consolidation pressure"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "Kiểm tra xem số chuyển đổi/ad set/tuần có đủ để thoát learning phase không."
                : "Checks if conversions per ad set per week are sufficient to exit the learning phase."}
            </CardDescription>
          </div>
          <Badge variant={assessment.variant}>{assessment.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{assessment.summary[language]}</p>
        {assessment.status !== "insufficient_data" && (
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{isVietnamese ? "Ad set active:" : "Active ad sets:"} </span>
              <span className="font-medium tabular-nums">{formatCompactNumber(assessment.activeAdsets, currency)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{isVietnamese ? "CV/ad set/tuần:" : "Conv/adset/week:"} </span>
              <span className="font-medium tabular-nums">{assessment.conversionsPerAdset.toLocaleString(currency === "VND" ? "vi-VN" : "en-US", { maximumFractionDigits: 1 })}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{isVietnamese ? "Ngưỡng:" : "Threshold:"} </span>
              <span className="font-medium tabular-nums">{formatCompactNumber(assessment.weeklyThreshold, currency)}</span>
            </div>
          </div>
        )}
        <DiagnosticNextStep kind="consolidationPressure" tone={assessment.status === "insufficient_data" ? "insufficient" : toneFromVariant(assessment.variant)} language={language} />
      </CardContent>
    </Card>
  );
}

function CostCapDeliveryCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const isVietnamese = language === "vi";
  const currency = report.account.currency || "VND";
  const dateRange = report.dateRange;
  const days = Math.max(1, (new Date(dateRange.until).getTime() - new Date(dateRange.since).getTime()) / (86400 * 1000) + 1);
  const assessment = assessCostCapDelivery(report.campaignRows, days);
  return (
    <Card data-print-flow className={diagnosticAccentClass(assessment.variant)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{isVietnamese ? "Phân phối cost cap" : "Cost cap delivery"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "Phát hiện campaign bị hạn chế phân phối bởi cost cap hoặc bid cap quá thấp."
                : "Detects campaigns constrained by an overly restrictive cost cap or bid cap."}
            </CardDescription>
          </div>
          <Badge variant={assessment.variant}>{assessment.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{assessment.summary[language]}</p>
        {assessment.underdelivering.length > 0 && (
          <div className="flex flex-col gap-2">
            {assessment.underdelivering.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{item.name}</span>
                  <Badge variant={item.spendRate < 0.6 ? "destructive" : "outline"} className="tabular-nums">
                    {formatSharePct(item.spendRate, currency)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isVietnamese
                    ? `Chi tiêu ${formatMetric(item.spend, "currency", currency)} / ngân sách ngày ${formatMetric(item.dailyBudget, "currency", currency)}`
                    : `Spent ${formatMetric(item.spend, "currency", currency)} / daily budget ${formatMetric(item.dailyBudget, "currency", currency)}`}
                </p>
              </div>
            ))}
          </div>
        )}
        <DiagnosticNextStep kind="costCapDelivery" tone={assessment.status === "no_cap_data" ? "insufficient" : toneFromVariant(assessment.variant)} language={language} />
      </CardContent>
    </Card>
  );
}

function MeasurementQualityCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const quality = assessMeasurementQuality(report);
  return (
    <Card data-print-flow className={diagnosticAccentClass(quality.variant)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{copy.measurement}</CardTitle>
            <CardDescription>{copy.measurementDescription}</CardDescription>
          </div>
          <Badge variant={quality.variant}>{quality.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {quality.reasons[language].map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <DiagnosticNextStep kind="measurementQuality" tone={quality.status === "not_applicable" ? "insufficient" : toneFromVariant(quality.variant)} language={language} />
      </CardContent>
    </Card>
  );
}

function BarList({ rows, metric, currency, language }: { rows: NormalizedRow[]; metric: "spend" | "leads"; currency: string; language: ReportLanguage }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[metric] || 0)));
  const sorted = [...rows].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0)).slice(0, 6);
  if (!sorted.length) return <p className="text-sm text-muted-foreground">{uiCopy[language].empty.breakdown}</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {sorted.map((row) => {
        const label = row.platform || [row.age, row.gender].filter(Boolean).join(" / ") || row.name;
        const value = Number(row[metric] || 0);
        const pct = Math.max(4, (value / max) * 100);
        return (
          <div key={`${label}-${value}`} className="grid grid-cols-[minmax(80px,150px)_1fr_auto] items-center gap-3 text-sm">
            <div className="truncate font-medium">{label}</div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full w-full origin-left rounded-full bg-primary/70"
                style={{ transform: `scaleX(${pct / 100})` }}
              />
            </div>
            <div className="min-w-[4.5rem] text-right tabular-nums text-muted-foreground">
              {metric === "spend" ? formatMetric(value, "currency", currency) : formatMetric(value, "number")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VerdictCard({ verdict, language }: { verdict: Verdict; language: ReportLanguage }) {
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
