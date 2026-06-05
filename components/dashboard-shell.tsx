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
  BarChart3Icon,
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  KeyRoundIcon,
  LanguagesIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { AppSidebar, type AppSidebarItem, type WorkflowSidebarItem } from "@/components/dashboard/app-sidebar";
import type { AdSetWithPreviews, AiInsightTable, CompareMode, CompetitorFetchResult, CompetitorFetchSource, CompetitorPlatform, CompetitorSpyAd, CompetitorSpyResult, DashboardReport, KpiPack, MetaAccount, MetaCampaign, NormalizedRow, Verdict } from "@/lib/types";
import { buildWorkflowSteps, type DashboardWorkflowStep } from "@/lib/dashboard-workflow";
import { canOpenDashboardView, initialDashboardViewFromSearch } from "@/lib/dashboard-access";
import { getCompareRange } from "@/lib/report-ranges";
import { classifyCreativeFatigue } from "@/lib/creative-fatigue";
import { assessExperimentReadiness } from "@/lib/experiment-readiness";
import { assessMeasurementQuality } from "@/lib/measurement-quality";
import { assessResultConcentration } from "@/lib/result-concentration";
import { assessBreakdownWaste } from "@/lib/breakdown-waste";
import { rowDecision } from "@/lib/row-decision";
import {
  normalizeCompetitorCountry,
  normalizeCompetitorLimit,
  normalizeCompetitorNames,
  normalizeCompetitorUrls,
} from "@/lib/competitor-input";
import { shouldFetchBeforeCompetitorAnalysis } from "@/lib/competitor-workflow";
import { performanceChartConfig } from "@/lib/chart-palette";
import {
  compactDate,
  formatChartValue,
  getPackChartSpec,
  metricValue,
  roundForFormat,
  roundMetric,
  sortByDrilldown,
  truncateLabel,
  type ChartKey,
} from "@/lib/chart-spec";
import { buildCompetitorSpyPrompt, buildInsightPrompt, comparisonDeltas, formatMetric } from "@/lib/metrics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
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
  { label: "Ads analysis", value: "ads", icon: BarChart3Icon },
  { label: "Competitor spy", value: "competitor", icon: SearchIcon },
] as const;

type ActiveView = (typeof appSections)[number]["value"];

const packItems: { label: string; value: KpiPack }[] = [
  { label: "Auto: lead/message", value: "lead_gen" },
  { label: "Messages", value: "messages" },
  { label: "Sales / ROAS", value: "sales_roas" },
  { label: "Traffic", value: "traffic" },
  { label: "Awareness", value: "awareness" },
];

const providerItems = [
  { label: "Auto: 9router", value: "auto" },
  { label: "9router", value: "9router" },
  { label: "Local rules only", value: "prompt" },
] as const;

type Provider = (typeof providerItems)[number]["value"];

const languageValues = ["en", "vi"] as const;

type ReportLanguage = (typeof languageValues)[number];
const COMPETITOR_SPY_TIMEOUT_MS = 5 * 60 * 1000;
const LANGUAGE_STORAGE_KEY = "redagencyads-language";

const compareItems: { label: string; value: CompareMode }[] = [
  { label: "No compare", value: "off" },
  { label: "WoW", value: "wow" },
  { label: "MoM", value: "mom" },
  { label: "YoY", value: "yoy" },
];

const uiCopy = {
  en: {
    token: {
      title: "Red Agency Ads Tool",
      description: "Connect Meta access token.",
      storage: "Token is validated server-side, encrypted, and stored only in an HttpOnly session cookie.",
      rejected: "Token rejected",
      field: "Access token",
      placeholder: "Paste Meta access token",
      help: "Do not use shared tokens for hosted public deployments. Rotate any token pasted into chat.",
      submit: "Validate token",
    },
    loading: {
      title: "Loading session",
      description: "Checking encrypted cookie state.",
    },
    nav: {
      functions: "Functions",
      workflow: "Workflow",
      aiSetup: "AI setup",
      clearSession: "Clear session",
      ads: "Ads analysis",
      competitor: "Competitor spy",
      connect: "Connect",
      select: "Select",
      analyze: "Analyze",
      verdict: "Verdict",
    },
    header: {
      adsCrumb: "Meta Graph API",
      adsDetail: "campaign-first analysis",
      competitorCrumb: "Ad library notes",
      competitorDetail: "competitor intelligence",
      adsTitle: "Ads analysis dashboard",
      competitorTitle: "Competitor spy",
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
      concentration: "Result concentration",
      concentrationDescription: "Checks whether spend or primary results depend on too few rows.",
      breakdownWaste: "Breakdown waste",
      breakdownWasteDescription: "Checks platform and demographic breakdown segments for high-spend waste.",
      grade: "Grade",
      breakdowns: "Breakdowns",
      breakdownsDescription: "Platform and age/gender signal for diagnosis.",
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
      start: "Start",
    },
  },
  vi: {
    token: {
      title: "Red Agency Ads Tool",
      description: "Kết nối Meta access token.",
      storage: "Token được kiểm tra trên server, mã hóa và chỉ lưu trong HttpOnly session cookie.",
      rejected: "Token bị từ chối",
      field: "Access token",
      placeholder: "Dán Meta access token",
      help: "Không dùng token dùng chung cho bản public. Hãy rotate mọi token từng dán vào chat.",
      submit: "Xác thực token",
    },
    loading: {
      title: "Đang tải session",
      description: "Đang kiểm tra cookie đã mã hóa.",
    },
    nav: {
      functions: "Chức năng",
      workflow: "Quy trình",
      aiSetup: "Thiết lập AI",
      clearSession: "Xóa session",
      ads: "Phân tích ads",
      competitor: "Theo dõi đối thủ",
      connect: "Kết nối",
      select: "Chọn phạm vi",
      analyze: "Phân tích",
      verdict: "Verdict",
    },
    header: {
      adsCrumb: "Meta Graph API",
      adsDetail: "phân tích theo campaign",
      competitorCrumb: "Ghi chú ad library",
      competitorDetail: "tình báo đối thủ",
      adsTitle: "Dashboard phân tích ads",
      competitorTitle: "Theo dõi đối thủ",
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
      concentration: "Độ tập trung kết quả",
      concentrationDescription: "Kiểm tra chi tiêu hoặc kết quả chính có phụ thuộc vào quá ít dòng hay không.",
      breakdownWaste: "Lãng phí breakdown",
      breakdownWasteDescription: "Kiểm tra lãng phí chi tiêu trên các phân khúc nền tảng hoặc nhân khẩu học.",
      grade: "Hạng",
      breakdowns: "Breakdown",
      breakdownsDescription: "Tín hiệu theo nền tảng và tuổi/giới tính để chẩn đoán.",
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

const competitorFetchItems: { label: string; value: CompetitorFetchSource }[] = [
  { label: "Public scrape (no key)", value: "public" },
  { label: "Apify scraper", value: "apify" },
  { label: "Meta official API", value: "meta_official" },
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
  const [provider, setProvider] = React.useState<Provider>("auto");
  const [language, setLanguage] = React.useState<ReportLanguage>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === "vi" || stored === "en" ? stored : "en";
  });
  const [activeView, setActiveView] = React.useState<ActiveView>(() =>
    typeof window === "undefined" ? "ads" : initialDashboardViewFromSearch(window.location.search),
  );
  const [report, setReport] = React.useState<DashboardReport | null>(null);
  const [previousReport, setPreviousReport] = React.useState<DashboardReport | null>(null);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [insights, setInsights] = React.useState<AiInsightTable | null>(null);
  const [competitorNames, setCompetitorNames] = React.useState("");
  const [competitorMarket, setCompetitorMarket] = React.useState("");
  const [competitorPlatform, setCompetitorPlatform] = React.useState<CompetitorPlatform>("meta");
  const [competitorNotes, setCompetitorNotes] = React.useState("");
  const [competitorResult, setCompetitorResult] = React.useState<CompetitorSpyResult | null>(null);
  const [competitorFetchSource, setCompetitorFetchSource] = React.useState<CompetitorFetchSource>("public");
  const [competitorCountry, setCompetitorCountry] = React.useState("VN");
  const [competitorLimit, setCompetitorLimit] = React.useState(20);
  const [competitorLibraryUrls, setCompetitorLibraryUrls] = React.useState("");
  const [competitorAds, setCompetitorAds] = React.useState<CompetitorSpyAd[]>([]);
  const [competitorFetchWarnings, setCompetitorFetchWarnings] = React.useState<string[]>([]);
  const [competitorFetchedAt, setCompetitorFetchedAt] = React.useState("");
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [copiedCompetitorPrompt, setCopiedCompetitorPrompt] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState({ verdict: false, insights: false });
  const verdictProgress = useTimedProgress(aiLoading.verdict);
  const insightProgress = useTimedProgress(aiLoading.insights);
  const copy = uiCopy[language];
  const workflowSteps = React.useMemo(
    () => buildWorkflowSteps({ hasAccount: Boolean(accountId), hasReport: Boolean(report), hasVerdict: Boolean(verdict) }),
    [accountId, report, verdict],
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

  React.useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const loadAccounts = React.useCallback(async () => {
    setLoading("accounts");
    try {
      const data = await jsonFetch<{ accounts: MetaAccount[] }>("/api/meta/accounts");
      setAccounts(data.accounts);
      const eric = data.accounts.find((account) => /eric/i.test(account.name));
      setAccountId((eric || data.accounts[0])?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load ad accounts.");
    } finally {
      setLoading("");
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    jsonFetch<{ authenticated: boolean }>("/api/session", { timeoutMs: 8000 })
      .then(async (data) => {
        if (cancelled) return;
        setAuthenticated(data.authenticated);
        if (data.authenticated) void loadAccounts();
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not check session.");
        setAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAccounts]);

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
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not validate token.");
    } finally {
      setLoading("");
    }
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setAuthenticated(false);
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
    if (!report || aiLoading.verdict) return;
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
    if (!report || aiLoading.insights) return;
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

  function competitorUrlList() {
    return normalizeCompetitorUrls(competitorLibraryUrls);
  }

  function competitorPrompt(adsOverride = competitorAds) {
    return withReportLanguage(
      buildCompetitorSpyPrompt({
        competitors: competitorList(),
        market: competitorMarket,
        platform: competitorPlatform,
        notes: competitorNotes,
        extractedAds: adsOverride,
        report,
      }),
      language,
      "competitor",
    );
  }

  async function loadSpyAds(competitors: string[], libraryUrls: string[]) {
    const data = await jsonFetch<{ result: CompetitorFetchResult }>("/api/spy/meta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: competitorFetchSource,
        competitors,
        country: normalizeCompetitorCountry(competitorCountry),
        limit: normalizeCompetitorLimit(competitorLimit),
        libraryUrls,
      }),
      timeoutMs: COMPETITOR_SPY_TIMEOUT_MS,
    });
    setCompetitorAds(data.result.ads);
    setCompetitorFetchWarnings(data.result.warnings);
    setCompetitorFetchedAt(data.result.fetchedAt);
    return data.result;
  }

  async function fetchSpyAds() {
    const competitors = competitorList();
    const libraryUrls = competitorUrlList();
    if (!competitors.length && !libraryUrls.length) {
      setError("Add competitor names or Meta Ad Library URLs before fetching ads.");
      return;
    }
    setError("");
    setLoading("spy-fetch");
    try {
      const result = await loadSpyAds(competitors, libraryUrls);
      if (!result.ads.length) setError(result.warnings[0] || "No competitor ads returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch competitor ads.");
    } finally {
      setLoading("");
    }
  }

  async function runCompetitorSpy() {
    const competitors = competitorList();
    const libraryUrls = competitorUrlList();
    if (!competitors.length && !libraryUrls.length && !competitorAds.length) {
      setError("Add competitors or fetch ads first.");
      return;
    }
    setError("");
    setLoading("competitor");
    try {
      let adsForPrompt = competitorAds;
      if (shouldFetchBeforeCompetitorAnalysis({ competitors, libraryUrls, fetchedAdCount: competitorAds.length })) {
        const result = await loadSpyAds(competitors, libraryUrls);
        adsForPrompt = result.ads;
      }
      const data = await jsonFetch<{ competitor: CompetitorSpyResult }>("/api/ai/competitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: competitorPrompt(adsForPrompt), provider }),
        timeoutMs: COMPETITOR_SPY_TIMEOUT_MS,
      });
      setCompetitorResult(data.competitor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate competitor spy report.");
    } finally {
      setLoading("");
    }
  }

  async function copyCompetitorPrompt() {
    const competitors = competitorList();
    if (!competitors.length && !competitorAds.length) {
      setError("Add competitors or fetch ads before copying the prompt.");
      return;
    }
    await navigator.clipboard.writeText(competitorPrompt());
    setCopiedCompetitorPrompt(true);
    window.setTimeout(() => setCopiedCompetitorPrompt(false), 1500);
  }

  async function copyPrompt() {
    if (!report) return;
    await navigator.clipboard.writeText(report.prompt);
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 1500);
  }

  function exportPdf() {
    window.print();
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
      <TokenScreen
        error={error}
        token={token}
        loading={loading === "session"}
        language={language}
        onLanguageChange={setLanguage}
        onTokenChange={setToken}
        onUseCompetitor={() => setActiveView("competitor")}
        onSubmit={connectToken}
      />
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        activeView={activeView}
        aiProviderLabel={providerLabel(provider, language)}
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
        <main className="flex min-h-svh flex-col gap-4 p-4 md:p-6" data-print-page>
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-print-hidden />
              <img src="/red-agency-logo.png" alt="Red Agency" className="size-11 rounded-lg object-contain" />
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {activeView === "ads" ? copy.header.adsCrumb : copy.header.competitorCrumb} <ChevronRightIcon />{" "}
                  {activeView === "ads" ? copy.header.adsDetail : copy.header.competitorDetail}
                </div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                  {activeView === "ads" ? copy.header.adsTitle : copy.header.competitorTitle}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LanguageToggle language={language} onChange={setLanguage} />
              <Badge variant="secondary">
                <ShieldCheckIcon />
                {authenticated ? copy.header.session : activeView === "competitor" ? "No-token spy mode" : copy.header.session}
              </Badge>
              {activeView === "ads" && report ? <Badge variant="outline">{copy.header.pulled} {new Date(report.pulledAt).toLocaleString()}</Badge> : null}
              {activeView === "ads" ? (
                <Button type="button" variant="outline" onClick={exportPdf} disabled={!report} data-print-hidden>
                  <DownloadIcon data-icon="inline-start" />
                  {copy.header.exportPdf}
                </Button>
              ) : null}
            </div>
          </header>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{copy.header.actionFailed}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {activeView === "ads" ? (
            <>
          <Card>
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
                      <SelectValue placeholder={copy.scope.chooseAccount} />
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
                <Field>
                  <FieldLabel>{copy.scope.compare}</FieldLabel>
                  <Select
                    items={compareItems}
                    value={compareMode}
                    onValueChange={(value) => {
                      if (value) setCompareMode(value as CompareMode);
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
                  <Button onClick={pullReport} disabled={!accountId || loading === "report"} className="w-full">
                    {loading === "report" ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
                    {copy.scope.pullReport}
                  </Button>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {loading === "report" ? <ReportSkeleton /> : null}
          {!report && loading !== "report" ? <EmptyState language={language} /> : null}
          {report ? (
            <>
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {report.kpis.map((kpi) => (
                  <Card key={kpi.label} size="sm">
                    <CardHeader>
                      <CardDescription>{kpi.label}</CardDescription>
                      <CardTitle className="text-2xl font-semibold tabular-nums">
                        {formatMetric(Number(report.totals[kpi.key as keyof NormalizedRow] || 0), kpi.format, report.account.currency || "VND")}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </section>

              <PerformanceCharts report={report} language={language} />

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

              <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
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

                <div className="flex flex-col gap-4">
                  <ExperimentReadinessCard report={report} language={language} />
                  <ResultConcentrationCard report={report} language={language} />
                  <BreakdownWasteCard report={report} language={language} />
                  <MeasurementQualityCard report={report} language={language} />
                  <Card>
                    <CardHeader>
                      <CardTitle>{copy.performance.health}</CardTitle>
                      <CardDescription>{copy.performance.healthDescription}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex items-end justify-between">
                        <div className="text-4xl font-semibold">{report.health.score}/100</div>
                        <Badge variant={report.health.score >= 75 ? "secondary" : "destructive"}>{copy.performance.grade} {report.health.grade}</Badge>
                      </div>
                      <Separator />
                      <div className="flex flex-col gap-2">
                        {report.health.checks.map((check) => (
                          <div key={check.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium">{check.label}</div>
                              <Badge variant={check.status === "fail" ? "destructive" : "outline"}>{check.status}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{check.detail}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              <section>
                <Card>
                  <CardHeader>
                    <CardTitle>{copy.performance.breakdowns}</CardTitle>
                    <CardDescription>{copy.performance.breakdownsDescription}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 xl:grid-cols-2">
                    <BarList rows={report.platformRows} metric="spend" currency={report.account.currency || "VND"} language={language} />
                    <BarList rows={report.ageGenderRows} metric="leads" currency={report.account.currency || "VND"} language={language} />
                  </CardContent>
                </Card>
              </section>
            </>
          ) : null}
            </>
          ) : (
            <CompetitorSpyPanel
              names={competitorNames}
              market={competitorMarket}
              platform={competitorPlatform}
              result={competitorResult}
              notes={competitorNotes}
              fetchSource={competitorFetchSource}
              country={competitorCountry}
              limit={competitorLimit}
              libraryUrls={competitorLibraryUrls}
              ads={competitorAds}
              fetchWarnings={competitorFetchWarnings}
              fetchedAt={competitorFetchedAt}
              loading={loading === "competitor"}
              fetchLoading={loading === "spy-fetch"}
              language={language}
              provider={provider}
              copiedPrompt={copiedCompetitorPrompt}
              onNamesChange={setCompetitorNames}
              onMarketChange={setCompetitorMarket}
              onPlatformChange={setCompetitorPlatform}
              onNotesChange={setCompetitorNotes}
              onFetchSourceChange={setCompetitorFetchSource}
              onCountryChange={setCompetitorCountry}
              onLimitChange={setCompetitorLimit}
              onLibraryUrlsChange={setCompetitorLibraryUrls}
              onProviderChange={setProvider}
              onFetchAds={fetchSpyAds}
              onGenerate={runCompetitorSpy}
              onCopyPrompt={copyCompetitorPrompt}
            />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function TokenScreen(props: {
  token: string;
  error: string;
  loading: boolean;
  language: ReportLanguage;
  onLanguageChange: (value: ReportLanguage) => void;
  onTokenChange: (value: string) => void;
  onUseCompetitor: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const copy = uiCopy[props.language].token;
  return (
    <main className="grid min-h-svh w-full place-items-center p-4">
      <Card className="min-w-0 w-full max-w-[22.5rem] justify-self-start sm:max-w-3xl sm:justify-self-center">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/red-agency-logo.png" alt="Red Agency" className="size-12 rounded-lg object-contain" />
              <div className="min-w-0">
                <CardTitle>{copy.title}</CardTitle>
                <CardDescription>{copy.description}</CardDescription>
              </div>
            </div>
            <LanguageToggle language={props.language} onChange={props.onLanguageChange} />
          </div>
          <CardDescription className="break-words">{copy.storage}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={props.onSubmit} className="flex min-w-0 flex-col gap-4">
            {props.error ? (
              <Alert variant="destructive">
                <AlertTitle>{copy.rejected}</AlertTitle>
                <AlertDescription>{props.error}</AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel>{copy.field}</FieldLabel>
                <Input
                  value={props.token}
                  onChange={(event) => props.onTokenChange(event.target.value)}
                  type="password"
                  autoComplete="off"
                  placeholder={copy.placeholder}
                  className="w-full"
                  required
                />
                <FieldDescription className="break-words">{copy.help}</FieldDescription>
              </Field>
            </FieldGroup>
            <Button type="submit" disabled={props.loading} className="w-full">
              {props.loading ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
              {copy.submit}
            </Button>
            <Button type="button" variant="outline" onClick={props.onUseCompetitor} className="w-full">
              <SearchIcon data-icon="inline-start" />
              {props.language === "vi" ? "Dùng competitor spy không cần token" : "Use competitor spy without token"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function LoadingScreen({ language }: { language: ReportLanguage }) {
  const copy = uiCopy[language].loading;
  return (
    <main className="grid min-h-svh place-items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
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

function ReportSkeleton() {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-28" />
      ))}
    </section>
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
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/5"
                      >
                        <span className="flex size-5 items-center justify-center rounded-md border text-primary">
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
    <Card className="w-full" data-print-flow>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-6 ${hasMultipleAdSets ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1"}`}>
          {hasMultipleAdSets && (
            <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {isVietnamese ? "Chọn Ad Set" : "Select Ad Set"}
              </div>
              <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2">
                {adsets.map((adset) => (
                  <Button
                    key={adset.id}
                    variant={selectedAdSetId === adset.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedAdSetId(adset.id)}
                    className={`justify-start text-left w-full h-auto py-3 px-4 flex flex-col items-start gap-1 font-normal border transition-all ${
                      selectedAdSetId === adset.id
                        ? "bg-accent border-accent text-accent-foreground font-medium"
                        : "bg-background hover:bg-muted/50 border-transparent text-muted-foreground"
                    }`}
                  >
                    <span className="line-clamp-2 text-sm">{adset.name}</span>
                    <span className="text-xs opacity-70">{formatAdSetBudget(adset, currency, language)}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className={hasMultipleAdSets ? "md:col-span-8 lg:col-span-9 flex flex-col gap-4" : "flex flex-col gap-4"}>
            <div className="rounded-lg border p-4 bg-muted/5">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 mb-4">
                <div>
                  <h3 className="font-heading text-lg font-semibold">{selectedAdSet.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isVietnamese ? "Campaign: " : "Campaign: "}{selectedAdSet.campaignName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{formatAdSetBudget(selectedAdSet, currency, language)}</Badge>
                  <Badge variant="secondary">{selectedAdSet.status}</Badge>
                </div>
              </div>

              {selectedAdSet.ads && selectedAdSet.ads.length > 0 ? (
                <>
                  {selectedAdSet.ads.length > 1 && (
                    <div className="flex flex-wrap gap-2 border-b pb-3 mb-4">
                      {selectedAdSet.ads.map((ad, idx) => (
                        <Button
                          key={ad.id}
                          variant={selectedAdId === ad.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedAdId(ad.id)}
                          className="text-xs"
                        >
                          {ad.name || `Creative ${idx + 1}`}
                        </Button>
                      ))}
                    </div>
                  )}

                  {selectedAd ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
                        <div className="font-semibold text-sm truncate">{selectedAd.name}</div>
                        <Badge variant="outline" className="text-xs">ID: {selectedAd.id}</Badge>
                      </div>
                      {selectedAd.previewHtml ? (
                        <div className="w-full flex justify-center bg-muted/10 p-2 rounded-md">
                          <div
                            className="w-full max-w-[500px] overflow-hidden rounded-md border p-1 bg-white max-h-[600px] overflow-y-auto"
                            dangerouslySetInnerHTML={{ __html: selectedAd.previewHtml }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-md border bg-muted/10 text-xs text-muted-foreground">
                          {isVietnamese ? "Không tải được bản xem trước" : "Unable to load ad preview"}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {isVietnamese ? "Không có ad nào hoạt động trong ad set này." : "No active ads found in this ad set."}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
  const currency = current.account.currency || "VND";
  const isVietnamese = language === "vi";
  const deltas = comparisonDeltas(current, previous).filter((item) =>
    ["spend", "messages", "leads", "purchases", "linkClicks", "ctr", "frequency", "costPerMessage", "cpl", "roas"].includes(item.key),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{isVietnamese ? "Chế độ so sánh" : "Compare mode"}: {modeLabel(mode, language)}</CardTitle>
        <CardDescription>
          {isVietnamese ? "Hiện tại" : "Current"} {current.dateRange.since} {isVietnamese ? "đến" : "to"} {current.dateRange.until}.{" "}
          {isVietnamese ? "Kỳ trước" : "Previous"} {previous.dateRange.since} {isVietnamese ? "đến" : "to"} {previous.dateRange.until}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {deltas.slice(0, 10).map((delta) => (
            <div key={delta.key} className="rounded-lg border p-3">
              <div className="text-xs font-medium text-muted-foreground">{metricLabel(delta.key, language)}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{formatComparisonMetric(delta.key, delta.current, currency)}</div>
              <Badge variant={delta.change >= 0 ? "secondary" : "destructive"} className="mt-2 tabular-nums">
                {formatSignedPct(delta.change_pct, language)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress.percent}%` }} />
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
    <Card data-print-break data-print-flow>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Verdict</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "Verdict local có thể chạy không cần model; auto dùng 9router để enhancement khi có key."
                : "Local Verdict works without a model call; auto uses 9router for enhancement when a key exists."}
            </CardDescription>
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
            <Button onClick={onGenerate} disabled={loading}>
              {loading ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              {copy.generate}
            </Button>
            <Button type="button" variant="outline" onClick={onCopyPrompt}>
              <ClipboardIcon data-icon="inline-start" />
              {copiedPrompt ? copy.copied : copy.copyPrompt}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <AiProgressStatus kind="verdict" provider={provider} progress={progress} language={language} /> : null}
        {verdict ? (
          <VerdictCard verdict={verdict} language={language} />
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{copy.emptyTitle}</EmptyTitle>
              <EmptyDescription>{copy.emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
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
    <Card data-print-flow>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{isVietnamese ? "Tóm tắt insight AI" : "AI insight brief"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? compareMode !== "off" && hasComparison
                  ? "Các thay đổi chính, nguyên nhân và hành động đề xuất."
                  : "Các hành động ưu tiên. Dữ liệu chi tiết nằm trong bảng drilldown."
                : compareMode !== "off" && hasComparison
                  ? "Top comparison deltas, causes, and actions."
                  : "Top action items. Full raw performance stays in drilldown tables."}
            </CardDescription>
          </div>
          <Button type="button" onClick={onGenerate} disabled={loading} data-print-hidden>
            {loading ? <Spinner data-icon="inline-start" /> : <FileTextIcon data-icon="inline-start" />}
            {isVietnamese ? "Tạo insight" : "Generate insights"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <AiProgressStatus kind="insights" provider={provider} progress={progress} language={language} /> : null}
        {insights ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{insights.provider}</Badge>
              <Badge variant="outline">{insights.confidence} confidence</Badge>
              <span className="text-sm text-muted-foreground">{insights.summary}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {visibleRows.map((row, index) => (
                <div key={`${row.area}-${index}`} className="rounded-lg border bg-background p-3" data-print-expand>
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
                  <Separator className="my-2" />
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
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{isVietnamese ? "Chưa có insight AI" : "No insight table yet"}</EmptyTitle>
              <EmptyDescription>
                {isVietnamese ? "Tạo sau khi kéo báo cáo. Nội dung sẽ theo chế độ so sánh." : "Generate after report pull. It adapts to compare mode."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitorSpyPanel({
  names,
  market,
  platform,
  notes,
  fetchSource,
  country,
  limit,
  libraryUrls,
  ads,
  fetchWarnings,
  fetchedAt,
  result,
  loading,
  fetchLoading,
  language,
  provider,
  copiedPrompt,
  onNamesChange,
  onMarketChange,
  onPlatformChange,
  onNotesChange,
  onFetchSourceChange,
  onCountryChange,
  onLimitChange,
  onLibraryUrlsChange,
  onProviderChange,
  onFetchAds,
  onGenerate,
  onCopyPrompt,
}: {
  names: string;
  market: string;
  platform: CompetitorPlatform;
  notes: string;
  fetchSource: CompetitorFetchSource;
  country: string;
  limit: number;
  libraryUrls: string;
  ads: CompetitorSpyAd[];
  fetchWarnings: string[];
  fetchedAt: string;
  result: CompetitorSpyResult | null;
  loading: boolean;
  fetchLoading: boolean;
  language: ReportLanguage;
  provider: Provider;
  copiedPrompt: boolean;
  onNamesChange: (value: string) => void;
  onMarketChange: (value: string) => void;
  onPlatformChange: (value: CompetitorPlatform) => void;
  onNotesChange: (value: string) => void;
  onFetchSourceChange: (value: CompetitorFetchSource) => void;
  onCountryChange: (value: string) => void;
  onLimitChange: (value: number) => void;
  onLibraryUrlsChange: (value: string) => void;
  onProviderChange: (value: Provider) => void;
  onFetchAds: () => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
}) {
  const isVietnamese = language === "vi";
  const id = React.useId();
  const hasCompetitors = names
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean).length > 0;
  const hasLibraryUrls = libraryUrls
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean).length > 0;
  const canFetch = hasCompetitors || hasLibraryUrls;
  const canAnalyze = canFetch || ads.length > 0;
  const themeRows = result?.themes.slice(0, 4) || [];
  const briefs = result?.test_briefs.slice(0, 4) || [];
  const competitors = result?.competitors.slice(0, 4) || [];
  const verdictCopy = uiCopy[language].verdict;
  const spyCopy = uiCopy[language].spy;

  return (
    <Card data-print-flow>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{isVietnamese ? "Theo dõi đối thủ" : "Competitor spy"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "Biến tên đối thủ hoặc ghi chú từ thư viện quảng cáo thành theme, gap và brief test mới."
                : "Turn competitor names or ad-library notes into themes, gaps, and original test briefs."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2" data-print-hidden>
            <Button type="button" variant="outline" onClick={onFetchAds} disabled={fetchLoading || !canFetch} aria-busy={fetchLoading}>
              {fetchLoading ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
              {fetchLoading ? (isVietnamese ? "Đang lấy ads..." : "Fetching ads...") : isVietnamese ? "Lấy ads" : "Fetch ads"}
            </Button>
            <Button type="button" onClick={onGenerate} disabled={loading || !canAnalyze} aria-busy={loading}>
              {loading ? <Spinner data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}
              {loading ? (isVietnamese ? "Đang phân tích sâu..." : "Deep scan running...") : isVietnamese ? "Phân tích đối thủ" : "Analyze competitors"}
            </Button>
            <Button type="button" variant="outline" onClick={onCopyPrompt} disabled={!canAnalyze}>
              <ClipboardIcon data-icon="inline-start" />
              {copiedPrompt ? verdictCopy.copied : spyCopy.copyPrompt}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3" data-print-hidden>
          <Field>
            <FieldLabel htmlFor={`${id}-competitors`}>{isVietnamese ? "Đối thủ" : "Competitors"}</FieldLabel>
            <Textarea
              id={`${id}-competitors`}
              value={names}
              onChange={(event) => onNamesChange(event.target.value)}
              placeholder={isVietnamese ? "VD:\nSeoul Spa\nKangnam\nNha khoa Paris" : "Example:\nCompetitor A\nCompetitor B\nCompetitor C"}
              className="min-h-24 resize-none"
              aria-describedby={`${id}-competitors-help`}
            />
            <FieldDescription id={`${id}-competitors-help`}>
              {isVietnamese ? "Nhập 1 đối thủ mỗi dòng hoặc ngăn cách bằng dấu phẩy." : "Enter one competitor per line or comma-separated."}
            </FieldDescription>
          </Field>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <Field>
              <FieldLabel htmlFor={`${id}-market`}>{isVietnamese ? "Thị trường / offer" : "Market / offer"}</FieldLabel>
              <Input
                id={`${id}-market`}
                value={market}
                onChange={(event) => onMarketChange(event.target.value)}
                placeholder={isVietnamese ? "VD: trị nám HCM, tư vấn qua inbox" : "Example: acne clinic leads, free consult"}
                aria-describedby={`${id}-market-help`}
              />
              <FieldDescription id={`${id}-market-help`}>
                {isVietnamese ? "Nêu ngành, địa bàn, offer chính hoặc funnel." : "Add category, geo, core offer, or funnel."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel id={`${id}-platform-label`}>{isVietnamese ? "Nền tảng" : "Platform"}</FieldLabel>
              <Select
                items={competitorPlatformItems}
                value={platform}
                onValueChange={(value) => {
                  if (value) onPlatformChange(value as CompetitorPlatform);
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby={`${id}-platform-label`} aria-describedby={`${id}-platform-help`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {competitorPlatformItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription id={`${id}-platform-help`}>
                {isVietnamese ? "Chọn nền tảng muốn phân tích." : "Choose the platform to analyze."}
              </FieldDescription>
            </Field>
          </div>
          <Separator />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <Field>
              <FieldLabel id={`${id}-source-label`}>{isVietnamese ? "Công cụ lấy ads" : "Ads spy tool"}</FieldLabel>
              <Select
                items={competitorFetchItems}
                value={fetchSource}
                onValueChange={(value) => {
                  if (value) onFetchSourceChange(value as CompetitorFetchSource);
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby={`${id}-source-label`} aria-describedby={`${id}-source-help`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {competitorFetchItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription id={`${id}-source-help`}>
                {isVietnamese
                  ? "Public scrape chạy không cần key, thử Chrome local rồi giữ link dự phòng. Apify/API chỉ dùng khi đã cấu hình token."
                  : "Public scrape works without keys, tries local Chrome, then keeps links as fallback. Use Apify/API only after tokens are configured."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-country`}>{isVietnamese ? "Quốc gia" : "Country"}</FieldLabel>
              <Input
                id={`${id}-country`}
                value={country}
              onChange={(event) => onCountryChange(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
              placeholder="VN"
              aria-describedby={`${id}-country-help`}
            />
              <FieldDescription id={`${id}-country-help`}>
                {isVietnamese ? "Mã 2 chữ cái. VD: VN, US, SG." : "Two-letter code. Example: VN, US, SG."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-limit`}>{isVietnamese ? "Số ads tối đa" : "Max ads"}</FieldLabel>
              <Input
                id={`${id}-limit`}
                type="number"
                min={1}
                max={80}
                value={limit}
                onChange={(event) => onLimitChange(normalizeCompetitorLimit(Number(event.target.value)))}
                aria-describedby={`${id}-limit-help`}
              />
              <FieldDescription id={`${id}-limit-help`}>
                {isVietnamese ? "Khuyên dùng 20-40 để không timeout." : "Use 20-40 to avoid timeout."}
              </FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-urls`}>{isVietnamese ? "Meta Ad Library URLs" : "Meta Ad Library URLs"}</FieldLabel>
            <Textarea
              id={`${id}-urls`}
              value={libraryUrls}
              onChange={(event) => onLibraryUrlsChange(event.target.value)}
              placeholder="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=VN&view_all_page_id=..."
              className="min-h-20 resize-none"
              aria-describedby={`${id}-urls-help`}
            />
            <FieldDescription id={`${id}-urls-help`}>
              {isVietnamese ? "Tùy chọn. Paste URL page/search từ Meta Ad Library, mỗi dòng 1 URL." : "Optional. Paste page/search URLs from Meta Ad Library, one per line."}
            </FieldDescription>
          </Field>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <Field>
              <FieldLabel id={`${id}-provider-label`}>{verdictCopy.provider}</FieldLabel>
              <Select
                items={providerItems}
                value={provider}
                onValueChange={(value) => {
                  if (value) onProviderChange(value as Provider);
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby={`${id}-provider-label`}>
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
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-notes`}>{isVietnamese ? "Ghi chú ads library" : "Ad-library notes"}</FieldLabel>
            <Textarea
              id={`${id}-notes`}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={
                isVietnamese
                  ? "VD: Kangnam - video before/after, CTA Nhắn tin, offer soi da miễn phí, hook trị nám 7 ngày..."
                  : "Example: Competitor A - UGC video, Send Message CTA, free audit offer, proof-led hook..."
              }
              className="min-h-28 resize-none"
              aria-describedby={`${id}-notes-help`}
            />
            <FieldDescription id={`${id}-notes-help`}>
              {isVietnamese
                ? "Paste copy, CTA, format, offer, link. Có dữ liệu thật -> confidence cao hơn. Vercel Hobby tối đa khoảng 5 phút."
                : "Paste copy, CTA, format, offer, link. Real data -> higher confidence. Vercel Hobby max roughly 5 minutes."}
            </FieldDescription>
          </Field>
        </div>

        {result ? (
          <div className="flex flex-col gap-3" data-print-expand>
            <SpyAdsPanel ads={ads} warnings={fetchWarnings} fetchedAt={fetchedAt} language={language} />
            <div className="rounded-lg border bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{result.provider}</Badge>
                <Badge variant="outline">{platformLabel(platform)}</Badge>
                <span className="text-sm font-medium">{compactText(result.summary, 260)}</span>
              </div>
            </div>

            {competitors.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {competitors.map((competitor) => (
                  <div key={competitor.name} className="rounded-lg border bg-background p-3">
                    <div className="text-sm font-semibold">{competitor.name}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{compactText(competitor.likely_positioning, 150)}</p>
                    <p className="mt-2 text-sm">{compactText(competitor.gap, 150)}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr]">
              <div className="rounded-lg border bg-background p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  {isVietnamese ? "Theme đối thủ" : "Competitor themes"}
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {themeRows.map((theme, index) => (
                    <div key={`${theme.theme}-${index}`} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium">{theme.theme}</div>
                        <Badge variant="outline">{theme.confidence}</Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground" data-print-expand>
                        {theme.evidence}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm" data-print-expand>
                        {theme.opportunity}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  {isVietnamese ? "Gap sáng tạo" : "Creative gaps"}
                </div>
                <CompactList
                  rows={result.creative_gaps.slice(0, 5)}
                  emptyLabel={isVietnamese ? "Chưa có gap rõ ràng." : "No clear gaps yet."}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">
                {isVietnamese ? "Brief test mới" : "Original test briefs"}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {briefs.map((brief, index) => (
                  <div key={`${brief.angle}-${index}`} className="rounded-md border p-3">
                    <div className="text-sm font-semibold">{brief.angle}</div>
                    <p className="mt-2 line-clamp-2 text-sm" data-print-expand>
                      {brief.hook}
                    </p>
                    <Badge variant="outline" className="mt-2">
                      {brief.format}
                    </Badge>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground" data-print-expand>
                      {brief.why}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">
                {isVietnamese ? "Hành động tiếp theo" : "Next actions"}
              </div>
              <CompactList rows={result.next_actions.slice(0, 4)} emptyLabel={isVietnamese ? "Chưa có hành động." : "No actions yet."} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SpyAdsPanel ads={ads} warnings={fetchWarnings} fetchedAt={fetchedAt} language={language} />
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{isVietnamese ? "Chưa có phân tích AI" : "No AI analysis yet"}</EmptyTitle>
                <EmptyDescription>
                  {isVietnamese
                    ? "Lấy ads hoặc paste ghi chú, rồi phân tích."
                    : "Fetch ads or paste notes, then analyze."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function platformLabel(platform: CompetitorPlatform) {
  return competitorPlatformItems.find((item) => item.value === platform)?.label || platform;
}

function SpyAdsPanel({
  ads,
  warnings,
  fetchedAt,
  language,
}: {
  ads: CompetitorSpyAd[];
  warnings: string[];
  fetchedAt: string;
  language: ReportLanguage;
}) {
  const isVietnamese = language === "vi";
  const copy = uiCopy[language].spy;
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">
            {isVietnamese ? "Ads đã lấy" : "Fetched ads"}
          </div>
          <p className="text-sm text-muted-foreground">
            {ads.length
              ? isVietnamese
                ? `${ads.length} ads trong session${fetchedAt ? ` - ${new Date(fetchedAt).toLocaleString()}` : ""}.`
                : `${ads.length} ads in session${fetchedAt ? ` - ${new Date(fetchedAt).toLocaleString()}` : ""}.`
              : isVietnamese
                ? "Chưa lấy ads."
                : "No ads fetched yet."}
          </p>
        </div>
        {ads.length ? <Badge variant="secondary">{ads.length} ads</Badge> : null}
      </div>
      {warnings.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {warnings.slice(0, 3).map((warning, index) => (
            <Alert key={`${warning}-${index}`}>
              <AlertTitle>{isVietnamese ? "Lưu ý nguồn dữ liệu" : "Data source note"}</AlertTitle>
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}
      {ads.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ads.slice(0, 12).map((ad, index) => (
            <div key={`${ad.source}-${ad.id}-${index}`} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{ad.pageName || ad.competitorName || copy.unknownAdvertiser}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">{ad.source}</Badge>
                    {ad.platform ? <Badge variant="secondary">{compactText(ad.platform, 24)}</Badge> : null}
                    {ad.format ? <Badge variant="outline">{compactText(ad.format, 18)}</Badge> : null}
                  </div>
                </div>
                {ad.snapshotUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => window.open(ad.snapshotUrl, "_blank", "noopener,noreferrer")}>
                    {copy.view}
                  </Button>
                ) : null}
              </div>
              {ad.imageUrl ? (
                <img src={ad.imageUrl} alt="" className="mt-3 aspect-video w-full rounded-md border object-cover" loading="lazy" />
              ) : null}
              <p className="mt-3 line-clamp-2 text-sm font-medium" data-print-expand>
                {compactText(ad.headline || ad.body || copy.noCopy, 160)}
              </p>
              {ad.description || ad.body ? (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground" data-print-expand>
                  {compactText(ad.description || ad.body || "", 220)}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {ad.cta ? <span>CTA: {compactText(ad.cta, 28)}</span> : null}
                {ad.startDate ? <span>{copy.start}: {ad.startDate.slice(0, 10)}</span> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function appSectionLabel(value: ActiveView, language: ReportLanguage) {
  return value === "ads" ? uiCopy[language].nav.ads : uiCopy[language].nav.competitor;
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

function providerLabel(provider: Provider, language: ReportLanguage) {
  if (provider === "9router") return "9router";
  if (provider === "prompt") return language === "vi" ? "Luật local" : "Local rules only";
  return language === "vi" ? "Auto 9router" : "Auto 9router";
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

function formatComparisonMetric(key: string, value: number, currency: string) {
  if (["spend", "costPerMessage", "cpl"].includes(key)) return formatMetric(value, "currency", currency);
  if (["ctr"].includes(key)) return formatMetric(value, "percent", currency);
  if (["frequency", "roas"].includes(key)) return formatMetric(value, "ratio", currency);
  return formatMetric(value, "number", currency);
}

function formatSignedPct(value: number | null, language: ReportLanguage = "en") {
  if (value === null) return language === "vi" ? "mới" : "new";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function PerformanceCharts({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const currency = report.account.currency || "VND";
  const spec = getPackChartSpec(report.selectedPack, language);
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

  if (!dailyData.length && !adsetData.length) return null;

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>{spec.trendTitle}</CardTitle>
          <CardDescription>{spec.trendDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length ? (
            <ChartContainer config={performanceChartConfig} className="h-[280px] w-full">
              <ComposedChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                <YAxis yAxisId="spend" hide />
                <YAxis yAxisId="outcomes" orientation="right" hide />
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
                  <Line key={key} yAxisId="outcomes" type="monotone" dataKey={key} stroke={`var(--color-${key})`} strokeWidth={2} dot={false} />
                ))}
              </ComposedChart>
            </ChartContainer>
          ) : (
            <ChartEmpty language={language} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{spec.efficiencyTitle}</CardTitle>
          <CardDescription>{spec.efficiencyDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length ? (
            <ChartContainer config={performanceChartConfig} className="h-[280px] w-full">
              <LineChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                <YAxis hide />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{spec.diagnosticTitle}</CardTitle>
          <CardDescription>{spec.diagnosticDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length ? (
            <ChartContainer config={performanceChartConfig} className="h-[240px] w-full">
              <LineChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} />
                <YAxis hide />
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
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>{spec.drilldownTitle}</CardTitle>
          <CardDescription>{spec.drilldownDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {adsetData.length ? (
            <ChartContainer config={performanceChartConfig} className="h-[240px] w-full">
              <BarChart data={adsetData} layout="vertical" margin={{ left: 12, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
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
        </CardContent>
      </Card>
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
          {!daily ? <TableHead>{copy.table.creativeFatigue}</TableHead> : null}
          {pack ? <TableHead>{copy.table.action}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const action = pack ? rowDecision(row, pack, language) : null;
          const creativeSignal = daily ? null : classifyCreativeFatigue(row);
          return (
            <TableRow key={`${row.level}-${row.id}-${row.date || ""}`}>
              <TableCell className="max-w-72 truncate font-medium">{daily ? row.date : row.name}</TableCell>
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
                  <Badge variant={action.intent === "danger" ? "destructive" : action.intent === "good" ? "secondary" : "outline"}>
                    {action.label}
                  </Badge>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ExperimentReadinessCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const readiness = assessExperimentReadiness(report);
  const items = readiness.blockers[language].length > 0 ? readiness.blockers[language] : [readiness.nextAction[language]];
  return (
    <Card data-print-flow>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{copy.readiness}</CardTitle>
            <CardDescription>{copy.readinessDescription}</CardDescription>
          </div>
          <Badge variant={readiness.variant}>{readiness.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function BreakdownWasteCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const combinedRows = [...report.platformRows, ...report.ageGenderRows];
  const waste = assessBreakdownWaste(combinedRows, report.selectedPack);
  return (
    <Card data-print-flow>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{copy.breakdownWaste}</CardTitle>
            <CardDescription>{copy.breakdownWasteDescription}</CardDescription>
          </div>
          <Badge variant={waste.variant}>{waste.label[language]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{waste.summary[language]}</p>
        {waste.rows.length > 0 ? (
          <div className="flex flex-col gap-2">
            {waste.rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 text-sm">
                <span className="truncate font-medium">{row.name}</span>
                <span className="text-muted-foreground tabular-nums">{((row.spendShare) * 100).toFixed(0)}% spend</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResultConcentrationCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const concentration = assessResultConcentration(report.adRows.length > 0 ? report.adRows : report.adsetRows.length > 0 ? report.adsetRows : report.campaignRows, report.selectedPack);
  return (
    <Card data-print-flow>
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
                <span className="text-muted-foreground tabular-nums">{((row.resultShare || row.spendShare) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MeasurementQualityCard({ report, language }: { report: DashboardReport; language: ReportLanguage }) {
  const copy = uiCopy[language].performance;
  const quality = assessMeasurementQuality(report);
  return (
    <Card data-print-flow>
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
      </CardContent>
    </Card>
  );
}

function BarList({ rows, metric, currency, language }: { rows: NormalizedRow[]; metric: "spend" | "leads"; currency: string; language: ReportLanguage }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[metric] || 0)));
  const sorted = [...rows].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0)).slice(0, 6);
  if (!sorted.length) return <p className="text-sm text-muted-foreground">{uiCopy[language].empty.breakdown}</p>;
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((row) => {
        const label = row.platform || [row.age, row.gender].filter(Boolean).join(" / ") || row.name;
        const value = Number(row[metric] || 0);
        return (
          <div key={`${label}-${value}`} className="grid grid-cols-[minmax(80px,160px)_1fr_auto] items-center gap-2 text-sm">
            <div className="truncate font-medium">{label}</div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </div>
            <div className="tabular-nums text-muted-foreground">
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
            <Badge variant="outline">{verdict.provider}</Badge>
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
      <div className="text-xs font-medium uppercase text-muted-foreground">{title}</div>
      {visibleRows.length ? (
        <ul className="mt-2 flex flex-col gap-2">
          {visibleRows.map((row, index) => (
            <li key={`${row}-${index}`} className="grid grid-cols-[18px_1fr] gap-2 text-sm leading-5">
              <span className="mt-1 size-1.5 rounded-full bg-primary" />
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
        <li key={`${row}-${index}`} className="grid grid-cols-[20px_1fr] gap-2 text-sm leading-5">
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
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
