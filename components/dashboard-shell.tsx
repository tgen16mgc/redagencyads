"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  BotMessageSquareIcon,
  CalendarClockIcon,
  BrainIcon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  HomeIcon,
  KeyRoundIcon,
  LanguagesIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  WaypointsIcon,
} from "lucide-react";
import { AppSidebar, type AppSidebarItem, type WorkflowSidebarItem } from "@/components/dashboard/app-sidebar";
import { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { StickyActionDock } from "@/components/dashboard/sticky-action-dock";
import { ContextChat, type ContextChatHandle } from "@/components/dashboard/context-chat";
import { CONTEXT_CHAT_PANEL_ID } from "@/components/dashboard/context-chat-copy";
import { CompetitorEvidenceWorkspace } from "@/components/dashboard/competitor-evidence-workspace";
import {
  AdsWorkspace,
  initialAdsWorkspaceState,
  providerLabel,
  resetAdsWorkspaceOnLogout,
  type AdsWorkspaceState,
  type Provider,
} from "@/components/dashboard/ads-workspace";
import { assertClientReportHealthParity, buildClientReportViewModel, downloadClientReportPdf } from "@/lib/client-report";
import { buildClientReportPdf } from "@/lib/client-report-pdf";
import { PagePublisherPanel, type PagePublisherContextHandle } from "@/components/dashboard/page-publisher-panel";
import type { ChatContext } from "@/lib/ai/chat-contract";
import {
  buildCompetitorChatContext,
  buildOverviewChatContext,
  buildPerformanceChatContext,
  buildPublisherChatContext,
  buildTikTokChatContext,
} from "@/lib/ai/chat-context";
import type { CompetitorEvidenceStatus, CompetitorFetchResult, CompetitorPlatform, CompetitorSpyResult, KpiCard, MetaAccount, MetaCampaign, TikTokProfile, TikTokProfileResult, TikTokVideo } from "@/lib/types";
import { buildWorkflowSteps, type DashboardWorkflowStep } from "@/lib/dashboard-workflow";
import { canOpenDashboardView, initialDashboardViewFromSearch, shouldLoadAdsWorkspaceData, type DashboardView } from "@/lib/dashboard-access";
import { buildSampleReport } from "@/lib/sample-report";
import { buildUnknownCapabilitySnapshot, type CapabilityStatus } from "@/lib/capabilities";
import { jsonFetch } from "@/lib/api-client";
import { hasReportSignal } from "@/lib/data-sufficiency";
import { readStorageSlot } from "@/lib/storage-slot";
import { summarizeHealth } from "@/lib/health-score";
import type { DecisionTargets } from "@/lib/decision-confidence";
import { normalizeCompetitorNames, normalizeCompetitorUrls } from "@/lib/competitor-input";
import { normalizeTikTokProfiles } from "@/lib/tiktok-input";
import { canVerifyCompetitorEvidence, competitorInputChangeEffects, deriveCompetitorEvidenceModel, type CompetitorInputField } from "@/lib/competitor-evidence";
import {
  buildCustomKpiCards,
  CUSTOM_KPI_SET_STORAGE_KEY,
  LEGACY_CUSTOM_KPI_SET_STORAGE_KEY,
  type CustomKpiKey,
  deserializeCustomKpiSet,
  serializeCustomKpiSet,
} from "@/lib/custom-kpi-set";
import { buildCompetitorSpyPrompt, formatCompactNumber } from "@/lib/metrics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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

const languageValues = ["en", "vi"] as const;

type ReportLanguage = (typeof languageValues)[number];
const COMPETITOR_SPY_TIMEOUT_MS = 5 * 60 * 1000;
const LANGUAGE_STORAGE_KEY = "decision-workspace-language";

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
      description: "Restoring your saved session.",
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
      description: "Đang khôi phục phiên đăng nhập của bạn.",
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
  },
} as const;

export function DashboardShell() {
  const [authenticated, setAuthenticated] = React.useState<boolean | null>(null);
  const [accounts, setAccounts] = React.useState<MetaAccount[]>([]);
  const [accountId, setAccountId] = React.useState("");
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
  const [adsWorkspace, setAdsWorkspace] = React.useState<AdsWorkspaceState>(initialAdsWorkspaceState);
  const [sampleReportActive, setSampleReportActive] = React.useState(false);
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
  const [copiedCompetitorPrompt, setCopiedCompetitorPrompt] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState("");
  const [exportingPdf, setExportingPdf] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const contextChatRef = React.useRef<ContextChatHandle>(null);
  const publisherContextRef = React.useRef<PagePublisherContextHandle>(null);
  const historyInitializedRef = React.useRef(false);
  const report = adsWorkspace.report;
  const effectiveKpis = React.useMemo<KpiCard[]>(() => {
    if (!report) return [];
    return adsWorkspace.customKpiKeys?.length ? buildCustomKpiCards(adsWorkspace.customKpiKeys) : report.kpis;
  }, [adsWorkspace.customKpiKeys, report]);
  const healthSummary = React.useMemo(() => report ? summarizeHealth(report) : null, [report]);
  const reportHasData = report ? hasReportSignal(report.totals) : false;

  const decisionTargets = React.useMemo<DecisionTargets>(() => {
    const cpa = Number(adsWorkspace.targetCpa);
    const roas = Number(adsWorkspace.targetRoas);
    return {
      targetCpa: Number.isFinite(cpa) && cpa > 0 ? cpa : undefined,
      targetRoas: Number.isFinite(roas) && roas > 0 ? roas : undefined,
    };
  }, [adsWorkspace.targetCpa, adsWorkspace.targetRoas]);
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
        previousReport: adsWorkspace.previousReport,
        compareMode: adsWorkspace.compareMode,
        targets: decisionTargets,
        verdict: adsWorkspace.verdict,
        insights: adsWorkspace.insights,
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
    adsWorkspace.compareMode,
    adsWorkspace.insights,
    adsWorkspace.previousReport,
    adsWorkspace.verdict,
    authenticated,
    capabilities,
    competitorEvidence,
    competitorMarket,
    competitorNames,
    competitorPlatform,
    competitorResult,
    decisionTargets,
    report,
    tiktokWorkspace.profileResult,
    tiktokWorkspace.profilesInput,
    workspaceLabel,
  ]);
  const hasWorkspaceDock = activeView === "competitor"
    || activeView === "tiktok"
    || activeView === "publisher"
    || (activeView === "ads" && Boolean(report && reportHasData));
  const copy = uiCopy[language];
  const workflowSteps = React.useMemo(
    () => buildWorkflowSteps({ hasAccount: Boolean(accountId), hasReport: reportHasData, hasVerdict: Boolean(adsWorkspace.verdict) }),
    [accountId, reportHasData, adsWorkspace.verdict],
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
    const keys = readStorageSlot(window.localStorage, {
      key: CUSTOM_KPI_SET_STORAGE_KEY,
      legacyKey: LEGACY_CUSTOM_KPI_SET_STORAGE_KEY,
      deserialize: (raw) => deserializeCustomKpiSet(raw, report.kpis),
    });
    setAdsWorkspace((current) => ({ ...current, customKpiKeys: keys }));
  }, [report]);

  function saveCustomKpis(keys: CustomKpiKey[]) {
    window.localStorage.setItem(CUSTOM_KPI_SET_STORAGE_KEY, serializeCustomKpiSet(keys));
    setAdsWorkspace((current) => ({ ...current, customKpiKeys: keys }));
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
        setAdsWorkspace((current) => ({ ...current, campaigns: data.campaigns, selectedCampaignIds: [] }));
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

  function resetCompetitorWorkspaceOnLogout() {
    setCompetitorResult(null);
  }

  async function logout() {
    contextChatRef.current?.clearAll();
    setChatOpen(false);
    await fetch("/api/session", { method: "DELETE" });
    setAuthenticated(false);
    setActiveView("overview");
    void loadCapabilities();
    setAccounts([]);
    setAdsWorkspace(resetAdsWorkspaceOnLogout);
    resetCompetitorWorkspaceOnLogout();
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

  function competitorInputChangeReason(field: CompetitorInputField) {
    if (field === "names") return language === "vi" ? "Danh sách đối thủ đã thay đổi." : "The competitor list changed.";
    if (field === "market") return language === "vi" ? "Thị trường hoặc offer đã thay đổi." : "The market or offer changed.";
    if (field === "platform") return language === "vi" ? "Nền tảng research đã thay đổi." : "The research platform changed.";
    if (field === "notes") return language === "vi" ? "Evidence thủ công đã thay đổi." : "Manual evidence changed.";
    return language === "vi" ? "Nguồn Meta Ad Library đã thay đổi." : "Meta Ad Library sources changed.";
  }

  function applyCompetitorInput(field: CompetitorInputField, apply: () => void) {
    const effects = competitorInputChangeEffects(field);
    if (effects.invalidatesBrief) invalidateCompetitorBrief(competitorInputChangeReason(field));
    apply();
    if (effects.clearsCollectedEvidence) setCompetitorEvidence(null);
  }

  function competitorEvidenceModel() {
    return deriveCompetitorEvidenceModel({
      competitors: competitorList(),
      notes: competitorNotes,
      evidence: competitorEvidence,
      collectionAvailable: capabilities.find((item) => item.key === "competitor_evidence")?.state === "available",
      collecting: competitorCollecting,
      analyzing: competitorAnalyzing,
    });
  }

  function competitorSpyInput() {
    const manualEvidence = competitorEvidenceModel().manualRows.filter((row) => row.status === "accepted");
    return {
      competitors: competitorList(),
      market: competitorMarket,
      platform: competitorPlatform,
      notes: manualEvidence.map((row) => row.text).join("\n"),
      manualEvidence,
      extractedAds: competitorEvidence?.ads || [],
      report,
      language,
    };
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
    if (status === "accepted" && !canVerifyCompetitorEvidence(target?.evidence)) {
      toast.warning(language === "vi" ? "Không thể xác minh evidence này" : "Cannot verify this evidence", {
        description: language === "vi"
          ? "Cần advertiser khớp và nguồn Meta Ad Library mở được trước khi xác minh."
          : "Verification needs a matched advertiser and an openable Meta Ad Library source.",
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
    if (!competitorList().length || competitorEvidenceModel().analyzableCount === 0) {
      setCompetitorError("Collect and accept at least one advertiser-linked ad before analyzing.");
      return;
    }
    setCompetitorError("");
    setCompetitorAnalyzing(true);
    try {
      const data = await jsonFetch<{ competitor: CompetitorSpyResult }>("/api/ai/competitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...competitorSpyInput(), provider }),
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
    if (!competitorList().length || competitorEvidenceModel().analyzableCount === 0) {
      setCompetitorError("Accept at least one advertiser-linked ad before copying the prompt.");
      return;
    }
    await navigator.clipboard.writeText(buildCompetitorSpyPrompt(competitorSpyInput()));
    setCopiedCompetitorPrompt(true);
    window.setTimeout(() => setCopiedCompetitorPrompt(false), 1500);
  }

  async function exportPdf() {
    if (!report || !reportHasData || !healthSummary) return;
    setError("");
    setExportingPdf(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 0)));
      const model = buildClientReportViewModel({
        report,
        healthSummary,
        previousReport: adsWorkspace.previousReport,
        compareMode: adsWorkspace.compareMode,
        verdict: adsWorkspace.verdict,
        insights: adsWorkspace.insights,
        language,
        kpis: effectiveKpis,
      });
      assertClientReportHealthParity(model, healthSummary);
      downloadClientReportPdf(await buildClientReportPdf(model), {
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

  React.useEffect(() => {
    if (authenticated && sampleReportActive) {
      setSampleReportActive(false);
      setAdsWorkspace(initialAdsWorkspaceState());
    }
  }, [authenticated, sampleReportActive]);

  function viewSampleReport() {
    setError("");
    setAdsWorkspace({ ...initialAdsWorkspaceState(), report: buildSampleReport() });
    setSampleReportActive(true);
    setActiveView("ads");
  }

  function exitSampleReport() {
    setSampleReportActive(false);
    setAdsWorkspace(initialAdsWorkspaceState());
  }

  if (authenticated === null) {
    return <LoadingScreen language={language} />;
  }

  const gateBlocked =
    !canOpenDashboardView({ authenticated, activeView }) && !(activeView === "ads" && sampleReportActive);

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
                      ? language === "vi" ? "Không cần Meta" : "Works without Meta"
                      : sampleReportActive && activeView === "ads"
                        ? language === "vi" ? "Dữ liệu mẫu" : "Sample data"
                        : language === "vi" ? "Chưa kết nối Meta" : "Meta not connected"}
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

          {gateBlocked ? (
            <TokenScreen
              embedded
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
              onViewSample={viewSampleReport}
              onSubmit={connectToken}
            />
          ) : activeView === "overview" ? (
            <WorkspaceOverview
              authenticated={authenticated}
              capabilities={capabilities}
              language={language}
              workspaceLabel={accounts.find((account) => account.id === accountId)?.name}
              onOpen={setActiveView}
            />
          ) : activeView === "ads" ? (
            <>
            {sampleReportActive ? (
              <Alert>
                <BarChart3Icon />
                <AlertTitle>{language === "vi" ? "Bạn đang xem báo cáo mẫu" : "You're viewing a sample report"}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  <span>
                    {language === "vi"
                      ? "Dữ liệu demo của một tài khoản thẩm mỹ viện. Kết nối Meta để phân tích tài khoản của bạn."
                      : "Demo data from a sample beauty-clinic account. Connect Meta to analyze your own account."}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={exitSampleReport}>
                    <ShieldCheckIcon data-icon="inline-start" />
                    {language === "vi" ? "Kết nối Meta" : "Connect Meta"}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <AdsWorkspace
              language={language}
              provider={provider}
              accounts={accounts}
              accountId={accountId}
              loading={loading}
              state={adsWorkspace}
              effectiveKpis={effectiveKpis}
              healthSummary={healthSummary}
              reportHasData={reportHasData}
              decisionTargets={decisionTargets}
              exportingPdf={exportingPdf}
              chatShortcutsDisabled={chatOpen}
              onProviderChange={setProvider}
              onAccountIdChange={setAccountId}
              onLoadingChange={setLoading}
              onError={setError}
              onStateChange={setAdsWorkspace}
              onSaveCustomKpis={saveCustomKpis}
              onExportPdf={exportPdf}
              onOpenAssistant={() => setChatOpen((current) => !current)}
            />
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
            <CompetitorEvidenceWorkspace
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
              onNamesChange={(value) => applyCompetitorInput("names", () => setCompetitorNames(value))}
              onMarketChange={(value) => applyCompetitorInput("market", () => setCompetitorMarket(value))}
              onPlatformChange={(value) => applyCompetitorInput("platform", () => setCompetitorPlatform(value))}
              onNotesChange={(value) => applyCompetitorInput("notes", () => setCompetitorNotes(value))}
              onLibraryUrlsChange={(value) => applyCompetitorInput("libraryUrls", () => setCompetitorLibraryUrls(value))}
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

function TokenScreen(props: {
  token: string;
  error: string;
  loading: boolean;
  language: ReportLanguage;
  intendedView: ActiveView;
  facebookOAuthConfigured: boolean | null;
  embedded?: boolean;
  onLanguageChange: (value: ReportLanguage) => void;
  onBack: () => void;
  onTokenChange: (value: string) => void;
  onUseCompetitor: () => void;
  onViewSample?: () => void;
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

  const gateCard = (
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
              <div className="mt-auto flex flex-col gap-2">
                {props.onViewSample ? (
                  <Button
                    type="button"
                    variant={props.facebookOAuthConfigured === true ? "outline" : "default"}
                    onClick={props.onViewSample}
                    className="w-full"
                  >
                    <BarChart3Icon data-icon="inline-start" />
                    {isVietnamese ? "Xem báo cáo mẫu" : "View a sample report"}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={props.onUseCompetitor} className="w-full">
                  <SearchIcon data-icon="inline-start" />
                  {isVietnamese ? "Mở evidence đối thủ" : "Open competitor evidence"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
  );

  if (props.embedded) return gateCard;

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
        {gateCard}
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
          {isVietnamese ? "Đang chuẩn bị workspace..." : "Preparing your workspace..."}
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
  const profiles = normalizeTikTokProfiles(profilesInput);
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
              ? "Chỉ profile và video tracker đang hoạt động. Ad Library tạm dừng trong lúc kiểm định nguồn dữ liệu và sẽ tự mở lại khi đạt chuẩn."
              : "Only profile and video tracking is active. Ad Library research is paused while its data source is being verified; it returns automatically once it passes."}
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

function compactText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength).trim();
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  return `${(sentenceEnd > maxLength * 0.55 ? clipped.slice(0, sentenceEnd + 1) : clipped).trim()}...`;
}
