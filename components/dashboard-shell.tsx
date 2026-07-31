"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  BellIcon,
  BotMessageSquareIcon,
  CalendarClockIcon,
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FilterIcon,
  GaugeIcon,
  GitCompareArrowsIcon,
  HomeIcon,
  KeyRoundIcon,
  LanguagesIcon,
  LogOutIcon,
  MoonIcon,
  RefreshCcwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SunIcon,
  UserRoundIcon,
  WaypointsIcon,
  XIcon,
} from "lucide-react";
import { AppSidebar, type AppSidebarItem, type WorkflowSidebarItem } from "@/components/dashboard/app-sidebar";
import { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { IntelligenceWorkspace } from "@/components/dashboard/intelligence-workspace";
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
import { buildClientReportViewModel, type ClientReportPdfFile } from "@/lib/client-report";
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
import type { CompetitorEvidenceStatus, CompetitorFetchResult, CompetitorPlatform, CompetitorSpyResult, KpiCard, MetaAccount, MetaCampaign, TikTokLibraryReport, TikTokProfile, TikTokProfileResult, TikTokVideo } from "@/lib/types";
import { buildWorkflowSteps, type DashboardWorkflowStep } from "@/lib/dashboard-workflow";
import { canOpenDashboardView, initialDashboardViewFromSearch, shouldLoadAdsWorkspaceData, type DashboardView } from "@/lib/dashboard-access";
import { buildSampleReport, SAMPLE_CAMPAIGNS } from "@/lib/sample-report";
import { buildUnknownCapabilitySnapshot, type CapabilityStatus } from "@/lib/capabilities";
import { jsonFetch } from "@/lib/api-client";
import { hasReportSignal } from "@/lib/data-sufficiency";
import { readStorageSlot } from "@/lib/storage-slot";
import { summarizeHealth } from "@/lib/health-score";
import type { DecisionTargets } from "@/lib/decision-confidence";
import { normalizeCompetitorNames, normalizeCompetitorUrls } from "@/lib/competitor-input";
import { normalizeTikTokProfiles } from "@/lib/tiktok-input";
import { searchCreativeCatalog } from "@/lib/creative-search";
import type { TikTokAcceptanceSnapshot } from "@/lib/tiktok-acceptance";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceAuth, type WorkspaceSessionStatus } from "@/components/workspace-auth";
import { MetaConnectDialog } from "@/components/meta-connect-dialog";
import { AccountWorkspaceSettingsDialog, type SettingsTab } from "@/components/account-workspace-settings-dialog";

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
  { label: "Intelligence", value: "intelligence", icon: GitCompareArrowsIcon },
  { label: "Publishing", value: "publisher", icon: CalendarClockIcon },
] as const;

type ActiveView = DashboardView;

type TikTokWorkspaceState = {
  profilesInput: string;
  profileLimit: number;
  profileResult: TikTokProfileResult | null;
  profileError: string;
  profileLoading: boolean;
  adQuery: string;
  adRegion: string;
  adQueryType: "1" | "2" | "url";
  adStartDate: string;
  adEndDate: string;
  adMaxAds: number;
  adFetchDetails: boolean;
  adFormat: string;
  adObjective: string;
  adIndustry: string;
  adPerformanceTier: "all" | "top" | "strong" | "standard";
  adReport: TikTokLibraryReport | null;
  adError: string;
  adLoading: boolean;
};

const languageValues = ["en", "vi"] as const;

type ReportLanguage = (typeof languageValues)[number];
const COMPETITOR_SPY_TIMEOUT_MS = 5 * 60 * 1000;
const LANGUAGE_STORAGE_KEY = "decision-workspace-language";
const THEME_STORAGE_KEY = "decision-workspace-theme";

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
      aiStatusTitle: "AI enhancement",
      clearSession: "Clear session",
      clearSessionTitle: "Clear this session?",
      clearSessionDescription: "You will be signed out and the saved Meta session will be removed from this browser.",
      clearSessionCancel: "Keep session",
      clearSessionConfirm: "Clear session",
      overview: "Overview",
      ads: "Performance",
      competitor: "Competitor evidence",
      tiktok: "TikTok tracker",
      intelligence: "Intelligence",
      publisher: "Publishing",
      connect: "Connect",
      select: "Select",
      analyze: "Analyze",
      verdict: "Verdict",
    },
    header: {
      overviewCrumb: "Meta Ads",
      overviewDetail: "Tien Duong",
      adsCrumb: "Meta Graph API",
      adsDetail: "campaign-first analysis",
      competitorCrumb: "Verified research",
      competitorDetail: "Apify evidence review",
      tiktokCrumb: "TikTok public intelligence",
      tiktokDetail: "Apify profiles and ad intelligence",
      publisherCrumb: "Meta Pages API",
      publisherDetail: "server-side Page publishing",
      overviewTitle: "Decision command center",
      adsTitle: "Performance diagnosis",
      competitorTitle: "Competitor evidence",
      tiktokTitle: "TikTok tracker",
      intelligenceCrumb: "Canonical data layer",
      intelligenceDetail: "owned performance and public intelligence",
      intelligenceTitle: "Cross-channel intelligence",
      publisherTitle: "Publishing operations",
      session: "HttpOnly token session",
      connected: "Meta connected",
      sample: "Sample data",
      worksWithoutMeta: "Works without Meta",
      notConnected: "Meta not connected",
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
      aiStatusTitle: "Tăng cường AI",
      clearSession: "Xóa session",
      clearSessionTitle: "Xóa session này?",
      clearSessionDescription: "Bạn sẽ được đăng xuất và session Meta đã lưu sẽ bị xóa khỏi trình duyệt này.",
      clearSessionCancel: "Giữ session",
      clearSessionConfirm: "Xóa session",
      overview: "Tổng quan",
      ads: "Hiệu quả",
      competitor: "Evidence đối thủ",
      tiktok: "Theo dõi TikTok",
      intelligence: "Intelligence đa kênh",
      publisher: "Vận hành đăng bài",
      connect: "Kết nối",
      select: "Chọn phạm vi",
      analyze: "Phân tích",
      verdict: "Verdict",
    },
    header: {
      overviewCrumb: "Meta Ads",
      overviewDetail: "Tien Duong",
      adsCrumb: "Meta Graph API",
      adsDetail: "phân tích theo campaign",
      competitorCrumb: "Nghiên cứu công khai",
      competitorDetail: "duyệt evidence Apify",
      tiktokCrumb: "Tình báo public TikTok",
      tiktokDetail: "profile và ad intelligence qua Apify",
      publisherCrumb: "Meta Pages API",
      publisherDetail: "đăng Page qua server",
      overviewTitle: "Decision command center",
      adsTitle: "Chẩn đoán hiệu quả",
      competitorTitle: "Evidence đối thủ",
      tiktokTitle: "Theo dõi TikTok",
      intelligenceCrumb: "Canonical data layer",
      intelligenceDetail: "hiệu quả owned và intelligence public",
      intelligenceTitle: "Intelligence đa kênh",
      publisherTitle: "Vận hành đăng bài",
      session: "Session token HttpOnly",
      connected: "Đã kết nối Meta",
      sample: "Dữ liệu mẫu",
      worksWithoutMeta: "Không cần Meta",
      notConnected: "Chưa kết nối Meta",
      pulled: "Đã kéo",
      exportPdf: "Xuất PDF",
      actionFailed: "Thao tác lỗi",
    },
  },
} as const;

export function DashboardShell() {
  const [workspaceSession, setWorkspaceSession] = React.useState<WorkspaceSessionStatus | null>(null);
  const [workspaceAuthError, setWorkspaceAuthError] = React.useState("");
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
  const [theme, setTheme] = React.useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  });
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTab, setSettingsTab] = React.useState<SettingsTab>("profile");
  const [metaConnectOpen, setMetaConnectOpen] = React.useState(false);
  const [pendingMetaView, setPendingMetaView] = React.useState<"ads" | "publisher">("ads");
  const accountMenuRef = React.useRef<HTMLDivElement>(null);
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
    adQuery: "",
    adRegion: "VN",
    adQueryType: "2",
    adStartDate: "",
    adEndDate: "",
    adMaxAds: 20,
    adFetchDetails: false,
    adFormat: "",
    adObjective: "",
    adIndustry: "",
    adPerformanceTier: "all",
    adReport: null,
    adError: "",
    adLoading: false,
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
  const overviewReport = React.useMemo(() => {
    if (report) return report;
    const sample = buildSampleReport();
    return { ...sample, selectedCampaigns: [SAMPLE_CAMPAIGNS[1]] };
  }, [report]);
  const overviewHealthSummary = React.useMemo(() => summarizeHealth(overviewReport), [overviewReport]);
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
    if (view === "intelligence") {
      return buildOverviewChatContext({ workspaceLabel, authenticated: Boolean(authenticated), capabilities });
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
        ? "Kéo profile, video và ad intelligence TikTok public để nghiên cứu creative và đối thủ."
        : "Pull public TikTok profiles, videos, and ad intelligence for creative and competitor research.",
    },
    intelligence: {
      badge: copy.header.intelligenceCrumb,
      detail: copy.header.intelligenceDetail,
      title: copy.header.intelligenceTitle,
      description: language === "vi"
        ? "So sánh các nguồn dữ liệu theo schema chung và nhìn rõ ranh giới giữa hiệu quả owned với creative intelligence public."
        : "Compare sources through one canonical schema while keeping owned performance separate from public creative intelligence.",
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
  const headerSession = authenticated
    ? { label: copy.header.connected, variant: "success" as const }
    : activeView === "overview"
      ? { label: copy.header.sample, variant: "secondary" as const }
      : activeView === "competitor" || activeView === "tiktok" || activeView === "intelligence"
      ? { label: copy.header.worksWithoutMeta, variant: "secondary" as const }
      : sampleReportActive && activeView === "ads"
        ? { label: copy.header.sample, variant: "secondary" as const }
        : { label: copy.header.notConnected, variant: "secondary" as const };
  const aiStatusState = capabilities.find((capability) => capability.key === "ai_enhancement")?.state || "unknown";

  React.useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  React.useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  React.useEffect(() => {
    let cancelled = false;
    jsonFetch<WorkspaceSessionStatus>("/api/workspace/session", { timeoutMs: 8000 })
      .then((data) => {
        if (!cancelled) setWorkspaceSession(data);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceSession({
            authenticated: false,
            configured: false,
            required: true,
            googleConfigured: false,
            googleAuthUrl: null,
            user: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [accountMenuOpen]);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get("auth_error");
    if (!authError) return;
    setWorkspaceAuthError(authError);
    setError(authError);
    url.searchParams.delete("auth_error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const requestedSettings = url.searchParams.get("settings");
    if (requestedSettings !== "profile" && requestedSettings !== "workspace") return;
    setSettingsTab(requestedSettings);
    setSettingsOpen(true);
    url.searchParams.delete("settings");
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

  async function validateMetaToken() {
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
      if (settingsOpen || shouldLoadAdsWorkspaceData({ authenticated: true, activeView: pendingMetaView })) await loadAccounts();
      setMetaConnectOpen(false);
      if (!settingsOpen) setActiveView(pendingMetaView);
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
    const [, workspaceResponse] = await Promise.all([
      fetch("/api/session", { method: "DELETE" }),
      fetch("/api/workspace/session", { method: "DELETE" }),
    ]);
    const nextWorkspaceSession = await workspaceResponse.json().catch(() => null) as WorkspaceSessionStatus | null;
    if (nextWorkspaceSession) setWorkspaceSession(nextWorkspaceSession);
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

  async function exportPdf(): Promise<ClientReportPdfFile> {
    if (!report || !reportHasData || !healthSummary) throw new Error("A report with analyzable data is required before export.");
    setError("");
    setExportingPdf(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 0)));
      const model = buildClientReportViewModel({
        report,
        previousReport: adsWorkspace.previousReport,
        compareMode: adsWorkspace.compareMode,
        verdict: adsWorkspace.verdict,
        insights: adsWorkspace.insights,
        language,
        kpis: effectiveKpis,
        decisionTargets,
        customCharts: adsWorkspace.customCharts,
      });
      return await buildClientReportPdf(model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export a consistent report.");
      throw err;
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

  function exitSampleReport() {
    setSampleReportActive(false);
    setAdsWorkspace(initialAdsWorkspaceState());
  }

  function viewSampleReport() {
    setError("");
    const sampleState = initialAdsWorkspaceState();
    setAdsWorkspace({
      ...sampleState,
      report: buildSampleReport({ dateRange: { since: sampleState.since, until: sampleState.until } }),
    });
    setSampleReportActive(true);
    setMetaConnectOpen(false);
    setActiveView("ads");
  }

  function requestView(view: ActiveView) {
    if (!canOpenDashboardView({ authenticated: Boolean(authenticated), activeView: view }) && !(view === "ads" && sampleReportActive)) {
      setPendingMetaView(view === "publisher" ? "publisher" : "ads");
      setMetaConnectOpen(true);
      return;
    }
    setActiveView(view);
  }

  React.useEffect(() => {
    if (authenticated !== false || sampleReportActive || canOpenDashboardView({ authenticated: false, activeView })) return;
    setPendingMetaView(activeView === "publisher" ? "publisher" : "ads");
    setMetaConnectOpen(true);
    setActiveView("overview");
  }, [activeView, authenticated, sampleReportActive]);

  if (workspaceSession === null) {
    return <LoadingScreen language={language} />;
  }

  if (!workspaceSession.authenticated) {
    return (
      <WorkspaceAuth
        status={workspaceSession}
        theme={theme}
        initialError={workspaceAuthError}
        onThemeChange={() => setTheme((current) => current === "dark" ? "light" : "dark")}
        onAuthenticated={(next) => {
          setWorkspaceAuthError("");
          setWorkspaceSession(next);
        }}
      />
    );
  }

  if (authenticated === null) {
    return <LoadingScreen language={language} />;
  }

  const gateBlocked =
    !canOpenDashboardView({ authenticated, activeView }) && !(activeView === "ads" && sampleReportActive);

  return (
    <>
      <div className="v2-shell">
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
          aiStatusTitle={copy.nav.aiStatusTitle}
          aiStatusState={aiStatusState}
          assistantOpen={chatOpen}
          onActiveViewChange={requestView}
          onOpenAssistant={() => setChatOpen((current) => !current)}
          onLogout={logout}
          clearSessionTitle={copy.nav.clearSessionTitle}
          clearSessionDescription={copy.nav.clearSessionDescription}
          clearSessionCancel={copy.nav.clearSessionCancel}
          clearSessionConfirm={copy.nav.clearSessionConfirm}
        />

        <div className="v2-app-main">
          <header className="v2-topbar" data-print-hidden>
            <div className="v2-topbar-copy">
              <div className="min-w-0">
                <div className="v2-topbar-eyebrow">{headerMode.badge} · {headerMode.detail}</div>
                <div className="v2-topbar-title">{headerMode.title}</div>
              </div>
              <span className="v2-live-chip">{headerSession.label}</span>
            </div>

            <div className="v2-topbar-actions">
              {activeView === "overview" ? (
                <>
                  <button type="button" className="v2-icon-button" aria-label="Search" onClick={() => toast.info(language === "vi" ? "Tìm kiếm sẽ có trong bản cập nhật tiếp theo." : "Workspace search is coming next.") }>
                    <SearchIcon />
                  </button>
                  <button type="button" className="v2-icon-button" aria-label="Notifications" onClick={() => toast.info(language === "vi" ? "Không có thông báo mới." : "No new notifications.") }>
                    <BellIcon />
                  </button>
                </>
              ) : null}
              {activeView === "ads" && reportHasData ? (
                <>
                  <button type="button" className="v2-icon-button" aria-label={language === "vi" ? "Làm mới báo cáo" : "Refresh report"} onClick={() => window.dispatchEvent(new Event("v2:refresh-report"))}>
                    <RefreshCcwIcon />
                  </button>
                  <Button type="button" variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event("v2:open-export"))} disabled={exportingPdf}>
                    {exportingPdf ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
                    {language === "vi" ? "Xuất" : "Export"}
                  </Button>
                </>
              ) : null}
              <LanguageToggle language={language} onChange={setLanguage} />
              <div ref={accountMenuRef} className="relative">
                <button type="button" className="v2-account-chip" aria-label={`${workspaceSession.user?.name || "Workspace owner"}, ${workspaceSession.user?.role || "Workspace owner"}`} aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((current) => !current)}>
                  <span className="v2-account-avatar">{workspaceSession.user?.initials || "DW"}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="v2-account-name block">{workspaceSession.user?.name || "Workspace owner"}</span>
                    <span className="v2-account-role block">{workspaceSession.user?.role || "Workspace owner"}</span>
                  </span>
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </button>
                {accountMenuOpen ? (
                  <div className="v2-account-menu">
                    <button type="button" className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground" aria-label="Close account menu" onClick={() => setAccountMenuOpen(false)}><XIcon className="size-4" /></button>
                    <div className="flex items-center gap-3 border-b border-border pb-4 pr-10">
                      <span className="v2-account-avatar">{workspaceSession.user?.initials || "DW"}</span>
                      <div><div className="text-sm font-semibold">{workspaceSession.user?.name || "Workspace owner"}</div><div className="text-xs text-muted-foreground">{workspaceSession.user?.role || "Workspace owner"} · {workspaceSession.user?.email || "Workspace session"}</div></div>
                    </div>
                    <div className="mt-4 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Account</div>
                    <button type="button" className="v2-account-menu-row" onClick={() => { setAccountMenuOpen(false); setSettingsTab("profile"); setSettingsOpen(true); }}><UserRoundIcon /><span><b>Profile</b><small>Identity, alerts and personal defaults</small></span></button>
                    <button type="button" className="v2-account-menu-row" onClick={() => { setAccountMenuOpen(false); setSettingsTab("workspace"); setSettingsOpen(true); }}><Settings2Icon /><span><b>Workspace settings</b><small>Sources, rules and team access</small></span></button>
                    <div className="my-3 flex items-center gap-2 border-y border-border py-3 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-success" />{workspaceSession.signedInAt ? `Secure session · signed in ${new Date(workspaceSession.signedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Secure local workspace"}</div>
                    <Button type="button" variant="destructive" className="w-full" onClick={() => void logout()}><LogOutIcon data-icon="inline-start" />Sign out</Button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="v2-icon-button"
                aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
                onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
          </header>

          <main className="v2-page" data-print-page>

          {error && !metaConnectOpen ? (
            <Alert variant="destructive">
              <AlertTitle>{copy.header.actionFailed}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {gateBlocked ? (
            <div className="min-h-[480px]" aria-hidden="true" />
          ) : activeView === "overview" ? (
            <WorkspaceOverview
              authenticated={authenticated}
              capabilities={capabilities}
              language={language}
              workspaceLabel={accounts.find((account) => account.id === accountId)?.name}
              report={overviewReport}
              healthSummary={overviewHealthSummary}
              onOpen={requestView}
              onEditScope={() => {
                if (authenticated) setAdsWorkspace((current) => ({ ...current, scopeExpanded: true }));
                requestView("ads");
              }}
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
                  <Button type="button" size="sm" variant="outline" onClick={() => { exitSampleReport(); setPendingMetaView("ads"); setMetaConnectOpen(true); }}>
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
              onCancelInitialScope={() => setActiveView("overview")}
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
          ) : activeView === "intelligence" ? (
            <IntelligenceWorkspace report={report} tiktokReport={tiktokWorkspace.adReport} language={language} />
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
          </main>
        </div>
      </div>
      <ContextChat
        ref={contextChatRef}
        activeView={activeView}
        language={language}
        available={nineRouterAvailable}
        open={chatOpen}
        showStandaloneLauncher={false}
        getContext={getChatContext}
        onOpenChange={setChatOpen}
      />
      <AccountWorkspaceSettingsDialog
        open={settingsOpen}
        initialTab={settingsTab}
        session={workspaceSession}
        metaConnected={Boolean(authenticated)}
        onOpenChange={setSettingsOpen}
        onOpenMeta={() => {
          setError("");
          setPendingMetaView("ads");
          setMetaConnectOpen(true);
        }}
        onProfileSaved={({ name, initials }) => {
          setWorkspaceSession((current) => current?.user
            ? { ...current, user: { ...current.user, name, initials } }
            : current);
        }}
      />
      <MetaConnectDialog
        open={metaConnectOpen}
        onOpenChange={(open) => { setMetaConnectOpen(open); if (!open) setError(""); }}
        oauthConfigured={facebookOAuthConfigured}
        returnTo={settingsOpen ? "settings" : pendingMetaView}
        token={token}
        loading={loading === "session"}
        error={error}
        onTokenChange={setToken}
        onConnectToken={validateMetaToken}
        onUseSample={viewSampleReport}
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
    <section className="v2-panel grid min-h-[640px] overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
      <div className="relative flex min-h-[420px] flex-col overflow-hidden border-b border-border p-6 sm:p-9 lg:min-h-0 lg:border-r lg:border-b-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_56%,rgba(4,133,247,0.78),rgba(4,133,247,0.2)_28%,transparent_58%)] opacity-90" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(6,6,7,0.18),rgba(6,6,7,0.88))]" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary"><WaypointsIcon className="size-5" /></span>
          <div><div className="text-sm font-semibold">Decision Workspace</div><div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Read agency / operations</div></div>
        </div>

        <div className="relative my-auto max-w-2xl py-12">
          <Badge variant="secondary">{isVietnamese ? "AI performance intelligence" : "AI performance intelligence"}</Badge>
          <h1 className="mt-5 text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.06em]">
            {isVietnamese ? "Biến dữ liệu quảng cáo thành bước đi tiếp theo." : "Turn ad data into next moves."}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            {isVietnamese ? "Một command center tập trung để đọc hiệu quả, tìm rủi ro và biến mọi review thành một quyết định." : "A focused command center for reading performance, finding risk, and leaving every review with a decision."}
          </p>
          <div className="mt-12 max-w-xl rounded-2xl border border-border bg-card/90 p-4 backdrop-blur">
            <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Decision pulse</div>
            <div className="mt-1 text-sm font-medium">{isVietnamese ? "3 tín hiệu sẵn sàng xem xét" : "3 signals ready for review"}</div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{isVietnamese ? "Hiệu quả đang ổn định. Creative fatigue bắt đầu xuất hiện. Một campaign đã sẵn sàng để scale." : "Efficiency is stable. Creative fatigue is emerging. One campaign is ready to scale."}</p>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheckIcon className="size-4 text-success" />{isVietnamese ? "Workspace bảo mật · nguồn đã kết nối luôn riêng tư" : "Secure workspace · connected sources stay private"}</div>
      </div>

      <div className="flex items-center justify-center bg-background/70 p-5 sm:p-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/20 sm:p-7">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRoundIcon className="size-5" /></span>
          <CardDescription className="mt-4">{destination}</CardDescription>
          <CardTitle className="mt-1 text-2xl">{isVietnamese ? "Kết nối workspace của bạn" : "Connect your workspace"}</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {publishing
              ? isVietnamese ? "Xác minh Page và quyền tạo nội dung để tiếp tục vận hành đăng bài." : "Verify Page access and content permissions to continue publishing operations."
              : isVietnamese ? "Xác minh account, campaign và insight để tạo chẩn đoán có evidence." : "Verify account, campaign, and insight access to produce an evidence-backed diagnosis."}
          </p>

          {props.error ? <Alert variant="destructive" className="mt-5"><AlertTitle>{copy.rejected}</AlertTitle><AlertDescription>{props.error}</AlertDescription></Alert> : null}

          {props.facebookOAuthConfigured === true ? (
            <div className="mt-6">
              <Button type="button" className="w-full" onClick={() => { window.location.href = `/api/auth/facebook/start?returnTo=${oauthReturnTo}`; }}>
                <ShieldCheckIcon data-icon="inline-start" />
                {copy.facebookLogin}
              </Button>
              <FieldDescription className="mt-2 break-words">{copy.facebookHelp}</FieldDescription>
            </div>
          ) : (
            <Alert className="mt-6"><AlertTitle>{props.facebookOAuthConfigured === null ? (isVietnamese ? "Đang kiểm tra Facebook Login…" : "Checking Facebook Login availability…") : (isVietnamese ? "Dùng Meta access token" : "Use a Meta access token")}</AlertTitle><AlertDescription>{props.facebookOAuthConfigured === null ? (isVietnamese ? "Bạn vẫn có thể dùng token bên dưới." : "You can still use a token below.") : (isVietnamese ? "Facebook Login chưa khả dụng trên bản triển khai này." : "Facebook Login is not available on this deployment.")}</AlertDescription></Alert>
          )}

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.06em] text-muted-foreground"><Separator className="flex-1" />{copy.manualToken}<Separator className="flex-1" /></div>

          <form onSubmit={props.onSubmit} className="flex min-w-0 flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={tokenInputId}>{copy.field}</FieldLabel>
                <Input id={tokenInputId} value={props.token} onChange={(event) => props.onTokenChange(event.target.value)} type="password" autoComplete="off" minLength={20} placeholder={copy.placeholder} className="w-full" required />
                <FieldDescription className="break-words">{publishing ? (isVietnamese ? "Dùng để kiểm tra Page và quyền CREATE_CONTENT." : "Used to verify Pages and CREATE_CONTENT permissions.") : (isVietnamese ? "Dùng để đọc account, campaign và insight cho KPI và verdict." : "Used to read account, campaign, and insight data for KPIs and Verdicts.")}</FieldDescription>
              </Field>
            </FieldGroup>
            <Button type="submit" disabled={props.loading || props.token.trim().length < 20} className="w-full">
              {props.loading ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
              {copy.submit}
            </Button>
          </form>

          <div className="mt-5 flex flex-col gap-2">
            {props.onViewSample ? <Button type="button" variant="outline" onClick={props.onViewSample} className="w-full"><BarChart3Icon data-icon="inline-start" />{isVietnamese ? "Xem báo cáo mẫu" : "View a sample report"}</Button> : null}
            <Button type="button" variant="ghost" onClick={props.onUseCompetitor} className="w-full"><SearchIcon data-icon="inline-start" />{isVietnamese ? "Mở evidence đối thủ" : "Open competitor evidence"}</Button>
          </div>

          <div className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            <span className="flex items-start gap-2"><CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" />{copy.storage}</span>
          </div>
        </div>
      </div>
    </section>
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
  const nextLanguage = language === "en" ? "vi" : "en";
  const label = language === "vi" ? "Chuyển sang tiếng Anh" : "Switch to Vietnamese";
  return (
    <Button type="button" variant="outline" size="sm" aria-label={label} title={label} onClick={() => onChange(nextLanguage)} data-print-hidden>
      <LanguagesIcon data-icon="inline-start" />
      {language.toUpperCase()}
    </Button>
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
  const {
    profilesInput,
    profileLimit,
    profileResult,
    profileError,
    profileLoading,
    adQuery,
    adRegion,
    adQueryType,
    adStartDate,
    adEndDate,
    adMaxAds,
    adFetchDetails,
    adFormat,
    adObjective,
    adIndustry,
    adPerformanceTier,
    adReport,
    adError,
    adLoading,
  } = state;
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
  const [watchlist, setWatchlist] = React.useState<string[]>([]);
  const [watchlistInput, setWatchlistInput] = React.useState("");
  const [newCreativeCount, setNewCreativeCount] = React.useState(0);
  const [acceptance, setAcceptance] =
    React.useState<TikTokAcceptanceSnapshot | null>(null);
  const [acceptanceLoading, setAcceptanceLoading] = React.useState(false);

  const refreshAcceptance = React.useCallback(async () => {
    setAcceptanceLoading(true);
    try {
      const data = await jsonFetch<{ acceptance: TikTokAcceptanceSnapshot }>(
        "/api/tiktok/acceptance",
        { timeoutMs: 5000 },
      );
      setAcceptance(data.acceptance);
    } catch {
      setAcceptance(null);
    } finally {
      setAcceptanceLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void jsonFetch<{ watchlist: { handles: string[] } }>("/api/tiktok/watchlist", { timeoutMs: 5000 })
      .then((data) => setWatchlist(data.watchlist.handles.slice(0, 50)))
      .catch(() => setWatchlist([]));
  }, []);

  React.useEffect(() => {
    void refreshAcceptance();
  }, [refreshAcceptance]);

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

  async function fetchAds() {
    if (!adQuery.trim()) {
      updateState({ adError: isVietnamese ? "Nhập keyword hoặc advertiser trước khi tìm." : "Add a keyword or advertiser before searching." });
      return;
    }
    updateState({ adError: "", adLoading: true });
    try {
      const data = await jsonFetch<{ report: TikTokLibraryReport }>("/api/tiktok/ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          region: adRegion,
          queryType: adQueryType,
          query: adQuery.trim(),
          startDate: adStartDate || undefined,
          endDate: adEndDate || undefined,
          maxAds: clampWholeNumber(adMaxAds, 1, 500),
          fetchDetails: adFetchDetails,
          format: adFormat || undefined,
          objective: adObjective || undefined,
          industry: adIndustry || undefined,
          performanceTier: adPerformanceTier === "all" ? undefined : adPerformanceTier,
        }),
        timeoutMs: 300000,
      });
      const priorIds = new Set((adReport?.rows || []).map((row) => row.id));
      setNewCreativeCount(data.report.rows.filter((row) => !priorIds.has(row.id)).length);
      updateState({ adReport: data.report });
      await refreshAcceptance();
    } catch (error) {
      updateState({ adError: error instanceof Error ? error.message : (isVietnamese ? "Không kéo được TikTok Ad Library." : "Could not fetch TikTok Ad Library.") });
    } finally {
      updateState({ adLoading: false });
    }
  }

  async function saveWatchlist() {
    const handles = watchlistInput
      .split(/[\n,]/u)
      .map((value) => value.trim().replace(/^@/u, ""))
      .filter(Boolean);
    const next = Array.from(new Set([...watchlist, ...handles])).slice(0, 50);
    setWatchlist(next);
    await jsonFetch("/api/tiktok/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ handles: next }), timeoutMs: 5000 });
    setWatchlistInput("");
  }

  async function removeWatchlist(handle: string) {
    const next = watchlist.filter((item) => item !== handle);
    setWatchlist(next);
    await jsonFetch("/api/tiktok/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ handles: next }), timeoutMs: 5000 });
  }

  const visibleAdRows = searchCreativeCatalog(adReport?.rows || [], {
    keyword: adQuery,
    startDate: adStartDate || undefined,
    endDate: adEndDate || undefined,
    format: (adFormat || undefined) as Parameters<typeof searchCreativeCatalog>[1]["format"],
    objective: adObjective || undefined,
    industry: adIndustry || undefined,
    performanceTier: adPerformanceTier === "all" ? undefined : adPerformanceTier,
  });

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

        <Card>
          <CardHeader>
            <CardTitle>{isVietnamese ? "TikTok Ad Library" : "TikTok Ad Library"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "Apify tự định tuyến CCL ở EU/UK/CH và Creative Center cho các thị trường khác."
                : "Apify routes EU/UK/CH to the Commercial Content Library and other markets to Creative Center."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void fetchAds();
              }}
              className="flex flex-col gap-4"
            >
              <Field>
                <FieldLabel htmlFor={`${id}-ad-query`}>{isVietnamese ? "Keyword hoặc advertiser" : "Keyword or advertiser"}</FieldLabel>
                <Input
                  id={`${id}-ad-query`}
                  value={adQuery}
                  onChange={(event) => updateState({ adQuery: event.target.value })}
                  placeholder={isVietnamese ? "VD: Nike, serum, lead gen" : "Example: Nike, serum, lead gen"}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${id}-ad-query-type`}>{isVietnamese ? "Kiểu tìm" : "Search type"}</FieldLabel>
                  <select
                    id={`${id}-ad-query-type`}
                    value={adQueryType}
                    onChange={(event) => updateState({ adQueryType: event.target.value as TikTokWorkspaceState["adQueryType"] })}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="2">{isVietnamese ? "Keyword / creative" : "Keyword / creative"}</option>
                    <option value="1">{isVietnamese ? "Advertiser" : "Advertiser"}</option>
                    <option value="url">URL / ad detail</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-ad-region`}>{isVietnamese ? "Thị trường" : "Market"}</FieldLabel>
                  <Input
                    id={`${id}-ad-region`}
                    value={adRegion}
                    onChange={(event) => updateState({ adRegion: event.target.value.toUpperCase() })}
                    placeholder="VN"
                    maxLength={8}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${id}-ad-start`}>{isVietnamese ? "Từ ngày" : "Start date"}</FieldLabel>
                  <Input id={`${id}-ad-start`} type="date" value={adStartDate} onChange={(event) => updateState({ adStartDate: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-ad-end`}>{isVietnamese ? "Đến ngày" : "End date"}</FieldLabel>
                  <Input id={`${id}-ad-end`} type="date" value={adEndDate} onChange={(event) => updateState({ adEndDate: event.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${id}-ad-format`}>{isVietnamese ? "Format" : "Format"}</FieldLabel>
                  <Input id={`${id}-ad-format`} value={adFormat} onChange={(event) => updateState({ adFormat: event.target.value })} placeholder="video / image" />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-ad-limit`}>{isVietnamese ? "Số creative" : "Creative limit"}</FieldLabel>
                  <Input id={`${id}-ad-limit`} type="number" min={1} max={500} value={adMaxAds} onChange={(event) => updateState({ adMaxAds: clampWholeNumber(Number(event.target.value), 1, 500) })} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${id}-ad-objective`}>{isVietnamese ? "Objective (tuỳ chọn)" : "Objective (optional)"}</FieldLabel>
                  <Input id={`${id}-ad-objective`} value={adObjective} onChange={(event) => updateState({ adObjective: event.target.value })} placeholder="conversions" />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-ad-industry`}>{isVietnamese ? "Industry (tuỳ chọn)" : "Industry (optional)"}</FieldLabel>
                  <Input id={`${id}-ad-industry`} value={adIndustry} onChange={(event) => updateState({ adIndustry: event.target.value })} placeholder="beauty_personal_care" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={adFetchDetails} onChange={(event) => updateState({ adFetchDetails: event.target.checked })} />
                {isVietnamese ? "Kéo detail, retention và targeting khi actor hỗ trợ" : "Include detail, retention, and targeting enrichment when supported"}
              </label>
              {adError ? <Alert variant="destructive"><AlertTitle>{isVietnamese ? "Ad Library lỗi" : "Ad Library failed"}</AlertTitle><AlertDescription>{adError}</AlertDescription></Alert> : null}
              <Button type="submit" disabled={adLoading || !adQuery.trim()}>
                {adLoading ? <Spinner data-icon="inline-start" /> : <FilterIcon data-icon="inline-start" />}
                {adLoading ? (isVietnamese ? "Đang tìm..." : "Searching...") : (isVietnamese ? "Tìm creative" : "Search creatives")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isVietnamese ? "Watchlist advertiser" : "Advertiser watchlist"}</CardTitle>
            <CardDescription>{isVietnamese ? "Lưu tối đa 50 handle cho các lần pull tiếp theo." : "Save up to 50 handles for the next pull."}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input value={watchlistInput} onChange={(event) => setWatchlistInput(event.target.value)} placeholder="brand_a, brand_b" aria-label={isVietnamese ? "Handle watchlist" : "Watchlist handles"} />
              <Button type="button" variant="outline" onClick={saveWatchlist} disabled={!watchlistInput.trim()}>Save</Button>
            </div>
            {watchlist.length ? (
              <div className="flex flex-wrap gap-2">
                {watchlist.map((handle) => <Button key={handle} type="button" size="xs" variant="secondary" onClick={() => removeWatchlist(handle)}>@{handle} ×</Button>)}
              </div>
            ) : <p className="text-xs text-muted-foreground">{isVietnamese ? "Chưa có handle nào." : "No handles saved yet."}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>
                  {isVietnamese ? "Live acceptance" : "Live acceptance"}
                </CardTitle>
                <CardDescription>
                  {isVietnamese
                    ? "Evidence production cho 5 gate TikTok, tách biệt với trạng thái đã code."
                    : "Production evidence for the five TikTok gates, separate from implementation status."}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => void refreshAcceptance()}
                disabled={acceptanceLoading}
                aria-label={isVietnamese ? "Làm mới acceptance" : "Refresh acceptance"}
              >
                {acceptanceLoading ? <Spinner /> : <RefreshCcwIcon />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {acceptance ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {acceptance.passedCount}/{acceptance.totalGates}{" "}
                    {isVietnamese ? "gate đã chứng minh" : "gates proven"}
                  </span>
                  <Badge
                    variant={
                      acceptance.passedCount === acceptance.totalGates
                        ? "success"
                        : "outline"
                    }
                  >
                    {acceptance.passedCount === acceptance.totalGates
                      ? isVietnamese
                        ? "Sẵn sàng"
                        : "Ready"
                      : isVietnamese
                        ? "Cần evidence"
                        : "Evidence needed"}
                  </Badge>
                </div>
                <div className="divide-y rounded-xl border">
                  {acceptance.gates.map((gate) => (
                    <div key={gate.id} className="flex flex-col gap-1 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {gate.id} · {gate.title}
                        </span>
                        <Badge
                          variant={
                            gate.state === "passed"
                              ? "success"
                              : gate.state === "failed"
                                ? "destructive"
                                : gate.state === "blocked"
                                  ? "outline"
                                  : "secondary"
                          }
                        >
                          {gate.state === "passed"
                            ? isVietnamese
                              ? "Đạt"
                              : "Passed"
                            : gate.state === "failed"
                              ? isVietnamese
                                ? "Chưa đạt"
                                : "Failed"
                              : gate.state === "blocked"
                                ? isVietnamese
                                  ? "Bị chặn"
                                  : "Blocked"
                                : isVietnamese
                                  ? "Chờ evidence"
                                  : "Awaiting evidence"}
                        </Badge>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {gate.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {acceptanceLoading
                  ? isVietnamese
                    ? "Đang đọc acceptance..."
                    : "Loading acceptance..."
                  : isVietnamese
                    ? "Không đọc được acceptance snapshot."
                    : "Acceptance snapshot is unavailable."}
              </p>
            )}
          </CardContent>
        </Card>

        <Alert>
          <AlertTitle>{isVietnamese ? "Public intelligence, không phải Ads Manager" : "Public intelligence, not Ads Manager"}</AlertTitle>
          <AlertDescription>
            {isVietnamese
              ? "Creative, reach, spend và retention là tín hiệu public. Không dùng chúng cho Budget Moves của Meta."
              : "Creative, reach, spend, and retention are public signals. They never feed Meta Budget Moves."}
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

        {adReport ? (
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-heading text-base font-semibold">{isVietnamese ? "Creative đã thu thập" : "Collected creatives"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {adReport.rows.length} {isVietnamese ? "creative chuẩn hoá" : "normalized creatives"}
                  {newCreativeCount ? ` · ${newCreativeCount} ${isVietnamese ? "creative mới" : "new since last pull"}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{adReport.actorId}</Badge>
                {adReport.pipelineDurationMs !== undefined ? <Badge variant={adReport.pipelineDurationMs < 15 * 60 * 1000 ? "success" : "outline"}>{(adReport.pipelineDurationMs / 1000).toFixed(1)}s pipeline</Badge> : null}
                {adReport.deduplicationIntegrity !== undefined ? <Badge variant={adReport.deduplicationIntegrity > 0.99 ? "success" : "outline"}>{(adReport.deduplicationIntegrity * 100).toFixed(1)}% dedup</Badge> : null}
                {adReport.acceptance?.deduplicationAbove99Percent === null ? <Badge variant="outline">{isVietnamese ? "Dedup cần cohort gắn nhãn" : "Dedup needs labeled cohort"}</Badge> : null}
                <select
                  value={adPerformanceTier}
                  onChange={(event) => updateState({ adPerformanceTier: event.target.value as TikTokWorkspaceState["adPerformanceTier"] })}
                  aria-label={isVietnamese ? "Lọc performance tier" : "Filter performance tier"}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">{isVietnamese ? "Tất cả tier" : "All tiers"}</option>
                  <option value="top">Top</option>
                  <option value="strong">Strong</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
            </div>
            {adReport.matchedAdvertisers !== undefined ? (
              <Alert>
                <GaugeIcon />
                <AlertTitle>{isVietnamese ? "Độ khớp advertiser" : "Advertiser match coverage"}</AlertTitle>
                <AlertDescription>
                  {adReport.matchedAdvertisers}/{adReport.rows.length} {isVietnamese ? "row có advertiser khớp query." : "rows have an advertiser matching the query."}
                </AlertDescription>
              </Alert>
            ) : null}
            {adReport.warnings.slice(0, 3).map((warning, index) => (
              <Alert key={`${warning}-${index}`}>
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ))}
            {visibleAdRows.length ? (
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="grid grid-cols-[minmax(0,1fr)_110px_110px] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground max-sm:grid-cols-[minmax(0,1fr)_84px]">
                  <span>{isVietnamese ? "Creative" : "Creative"}</span>
                  <span className="max-sm:hidden">{isVietnamese ? "Signal" : "Signal"}</span>
                  <span>{isVietnamese ? "Nguồn" : "Source"}</span>
                </div>
                {visibleAdRows.map((row) => (
                  <article key={row.id} className="grid grid-cols-[minmax(0,1fr)_110px_110px] gap-3 border-b px-4 py-4 last:border-b-0 max-sm:grid-cols-[minmax(0,1fr)_84px]">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground" aria-hidden="true">{row.format === "video" ? "▶" : "▧"}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-medium">{row.advertiserName || (isVietnamese ? "Advertiser chưa xác định" : "Unknown advertiser")}</h3>
                          <Badge variant={row.performanceTier === "top" ? "success" : "secondary"}>{row.performanceScore ?? "--"}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.caption || row.adTitle || (isVietnamese ? "Không có caption" : "No caption")}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{row.format}</span>
                          {row.durationSeconds ? <span>{row.durationSeconds.toFixed(1)}s</span> : null}
                          {row.ctr !== undefined ? <span>CTR {(row.ctr * 100).toFixed(1)}%</span> : null}
                          {row.firstSeen ? <span>{row.firstSeen}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground max-sm:hidden">
                      <span>{row.performanceTier || "unknown"}</span>
                      {row.hookRetention !== undefined ? <span>Hook {Math.round(row.hookRetention * 100)}%</span> : null}
                      {row.likeCount !== undefined ? <span>{formatCompactNumber(row.likeCount)} likes</span> : null}
                    </div>
                    <div className="flex items-start justify-end">
                      {row.previewUrl || row.landingUrl || row.videoUrl || row.imageUrl ? <a href={row.previewUrl || row.landingUrl || row.videoUrl || row.imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><ExternalLinkIcon className="size-3.5" />{isVietnamese ? "Mở" : "Open"}</a> : <span className="text-xs text-muted-foreground">--</span>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty className="min-h-48 rounded-xl border bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FilterIcon /></EmptyMedia>
                  <EmptyTitle>{isVietnamese ? "Không có creative trong filter này" : "No creatives match this filter"}</EmptyTitle>
                  <EmptyDescription>{isVietnamese ? "Đổi performance tier hoặc tìm lại với query rộng hơn." : "Change the performance tier or search with a broader query."}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>
        ) : null}

        {!profileResult && !adReport ? (
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
        position="inline"
        className="col-span-full px-0"
        contextLabel={isVietnamese ? "TikTok tracker" : "TikTok tracker"}
        status={profileLoading || adLoading ? "working" : adQuery.trim() || profiles.length ? "ready" : "blocked"}
        statusLabel={adLoading
          ? isVietnamese ? "Đang tìm creative" : "Searching creatives"
          : profileLoading
            ? isVietnamese ? "Đang kéo profile" : "Fetching profiles"
            : adQuery.trim()
              ? isVietnamese ? "Query Ad Library sẵn sàng" : "Ad Library query ready"
              : profiles.length
                ? isVietnamese ? `${profiles.length} profile sẵn sàng` : `${profiles.length} profiles ready`
                : isVietnamese ? "Cần query hoặc username" : "Add a query or usernames"}
        primaryAction={{
          id: adQuery.trim() ? "fetch-tiktok-ads" : "fetch-tiktok-profiles",
          label: adQuery.trim()
            ? isVietnamese ? "Tìm TikTok creative" : "Search TikTok creatives"
            : profileResult
              ? isVietnamese ? "Làm mới profile" : "Refresh profiles"
              : isVietnamese ? "Kéo profile" : "Fetch profiles",
          shortLabel: adQuery.trim() ? (isVietnamese ? "Tìm creative" : "Search ads") : (isVietnamese ? "Kéo profile" : "Fetch profiles"),
          icon: RefreshCcwIcon,
          onSelect: adQuery.trim() ? fetchAds : fetchProfiles,
          disabled: !adQuery.trim() && !profiles.length,
          disabledReason: isVietnamese ? "Nhập query Ad Library hoặc username TikTok." : "Add an Ad Library query or TikTok username.",
          loading: profileLoading || adLoading,
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
