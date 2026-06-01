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
  LogOutIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import type { AiInsightTable, AiVerdict, CompareMode, CompetitorPlatform, CompetitorSpyResult, DashboardReport, KpiPack, MetaAccount, MetaCampaign, NormalizedRow } from "@/lib/types";
import { buildCompetitorSpyPrompt, buildInsightPrompt, comparisonDeltas, formatMetric } from "@/lib/metrics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const workflowItems = [
  { label: "Connect", icon: KeyRoundIcon },
  { label: "Select", icon: DatabaseIcon },
  { label: "Analyze", icon: BarChart3Icon },
  { label: "Verdict", icon: BrainIcon },
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
  { label: "Auto provider", value: "auto" },
  { label: "OpenAI", value: "openai" },
  { label: "OpenRouter", value: "openrouter" },
  { label: "Prompt only", value: "prompt" },
] as const;

type Provider = (typeof providerItems)[number]["value"];

const languageItems = [
  { label: "English", value: "en" },
  { label: "Tiếng Việt", value: "vi" },
] as const;

type ReportLanguage = (typeof languageItems)[number]["value"];
const COMPETITOR_SPY_TIMEOUT_MS = 5 * 60 * 1000;

const compareItems: { label: string; value: CompareMode }[] = [
  { label: "No compare", value: "off" },
  { label: "WoW", value: "wow" },
  { label: "MoM", value: "mom" },
  { label: "YoY", value: "yoy" },
];

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
  const [language, setLanguage] = React.useState<ReportLanguage>("en");
  const [activeView, setActiveView] = React.useState<ActiveView>("ads");
  const [report, setReport] = React.useState<DashboardReport | null>(null);
  const [previousReport, setPreviousReport] = React.useState<DashboardReport | null>(null);
  const [verdict, setVerdict] = React.useState<AiVerdict | null>(null);
  const [insights, setInsights] = React.useState<AiInsightTable | null>(null);
  const [competitorNames, setCompetitorNames] = React.useState("");
  const [competitorMarket, setCompetitorMarket] = React.useState("");
  const [competitorPlatform, setCompetitorPlatform] = React.useState<CompetitorPlatform>("meta");
  const [competitorNotes, setCompetitorNotes] = React.useState("");
  const [competitorResult, setCompetitorResult] = React.useState<CompetitorSpyResult | null>(null);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [copiedCompetitorPrompt, setCopiedCompetitorPrompt] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState("");

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
    if (!report) return;
    setError("");
    setLoading("ai");
    try {
      const data = await jsonFetch<{ verdict: AiVerdict }>("/api/ai/verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: withReportLanguage(report.prompt, language, "verdict"), provider }),
        timeoutMs: 90000,
      });
      setVerdict(data.verdict);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate AI verdict.");
    } finally {
      setLoading("");
    }
  }

  async function runInsights() {
    if (!report) return;
    setError("");
    setLoading("insights");
    try {
      const prompt = withReportLanguage(buildInsightPrompt({ report, previousReport, compareMode }), language, "insights");
      const data = await jsonFetch<{ insights: AiInsightTable }>("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, provider }),
        timeoutMs: 90000,
      });
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate insights.");
    } finally {
      setLoading("");
    }
  }

  function competitorList() {
    return competitorNames
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  function competitorPrompt() {
    return withReportLanguage(
      buildCompetitorSpyPrompt({
        competitors: competitorList(),
        market: competitorMarket,
        platform: competitorPlatform,
        notes: competitorNotes,
        report,
      }),
      language,
      "competitor",
    );
  }

  async function runCompetitorSpy() {
    const competitors = competitorList();
    if (!competitors.length) {
      setError("Add at least one competitor name.");
      return;
    }
    setError("");
    setLoading("competitor");
    try {
      const data = await jsonFetch<{ competitor: CompetitorSpyResult }>("/api/ai/competitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: competitorPrompt(), provider }),
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
    if (!competitors.length) {
      setError("Add at least one competitor name before copying the prompt.");
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
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return (
      <TokenScreen
        error={error}
        token={token}
        loading={loading === "session"}
        onTokenChange={setToken}
        onSubmit={connectToken}
      />
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" data-print-hidden>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <img src="/red-agency-logo.png" alt="Red Agency" className="size-5 rounded-sm object-contain" />
                <span>Meta Ads Console</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Functions</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {appSections.map(({ label, value, icon: Icon }) => (
                  <SidebarMenuItem key={value}>
                    <SidebarMenuButton
                      isActive={activeView === value}
                      onClick={() => setActiveView(value)}
                      aria-current={activeView === value ? "page" : undefined}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {activeView === "ads" ? (
            <SidebarGroup>
              <SidebarGroupLabel>Workflow</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workflowItems.map(({ label, icon: Icon }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton isActive={label === "Analyze"}>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          <SidebarGroup>
            <SidebarGroupLabel>AI setup</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <SparklesIcon />
                    <span>{provider === "openrouter" ? "OpenRouter" : provider === "openai" ? "OpenAI" : provider === "prompt" ? "Prompt only" : "Auto provider"}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout}>
                <LogOutIcon />
                <span>Clear session</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="flex min-h-svh flex-col gap-4 p-4 md:p-6" data-print-page>
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-print-hidden />
              <img src="/red-agency-logo.png" alt="Red Agency" className="size-11 rounded-lg object-contain" />
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {activeView === "ads" ? "Meta Graph API" : "Ad library notes"} <ChevronRightIcon />{" "}
                  {activeView === "ads" ? "campaign-first analysis" : "competitor intelligence"}
                </div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                  {activeView === "ads" ? "Ads analysis dashboard" : "Competitor spy"}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <ShieldCheckIcon />
                HttpOnly token session
              </Badge>
              {activeView === "ads" && report ? <Badge variant="outline">Pulled {new Date(report.pulledAt).toLocaleString()}</Badge> : null}
              {activeView === "ads" ? (
                <Button type="button" variant="outline" onClick={exportPdf} disabled={!report} data-print-hidden>
                  <DownloadIcon data-icon="inline-start" />
                  Export PDF
                </Button>
              ) : null}
            </div>
          </header>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {activeView === "ads" ? (
            <>
          <Card>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
              <CardDescription>Choose account, campaign scope, date range, and KPI pack.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <Field className="xl:col-span-2">
                  <FieldLabel>Ad account</FieldLabel>
                  <Select
                    items={accounts.map((item) => ({ label: item.name, value: item.id }))}
                    value={accountId}
                    onValueChange={(value) => {
                      if (value) setAccountId(value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose account" />
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
                  loading={loading === "campaigns"}
                  selectedIds={selectedCampaignIds}
                  onChange={setSelectedCampaignIds}
                />
                <Field>
                  <FieldLabel>Since</FieldLabel>
                  <Input type="date" value={since} onChange={(event) => setSince(event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel>Until</FieldLabel>
                  <Input type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
                </Field>
                <Field className="xl:col-span-2">
                  <FieldLabel>KPI pack</FieldLabel>
                  <Select
                    items={[{ label: "Auto-detect", value: "auto" }, ...packItems]}
                    value={pack}
                    onValueChange={(value) => {
                      if (value) setPack(value as KpiPack | "auto");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="KPI pack" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="auto">Auto-detect</SelectItem>
                        {packItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>Objective/name/actions decide default; override anytime.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Compare</FieldLabel>
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
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="justify-end">
                  <FieldLabel className="sr-only">Pull data</FieldLabel>
                  <Button onClick={pullReport} disabled={!accountId || loading === "report"} className="w-full">
                    {loading === "report" ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
                    Pull report
                  </Button>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {loading === "report" ? <ReportSkeleton /> : null}
          {!report && loading !== "report" ? <EmptyState /> : null}
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

              <PerformanceCharts report={report} />

              {previousReport ? <ComparisonPanel current={report} previous={previousReport} mode={compareMode} /> : null}

              <AiVerdictPanel
                provider={provider}
                loading={loading === "ai"}
                verdict={verdict}
                copiedPrompt={copiedPrompt}
                language={language}
                onProviderChange={setProvider}
                onLanguageChange={setLanguage}
                onGenerate={runAi}
                onCopyPrompt={copyPrompt}
              />

              <InsightPanel
                insights={insights}
                loading={loading === "insights"}
                compareMode={compareMode}
                hasComparison={Boolean(previousReport)}
                language={language}
                onGenerate={runInsights}
              />

              <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance view</CardTitle>
                    <CardDescription>
                      Detected pack: {report.detectedPack}. Active pack: {report.selectedPack}. {report.packReason}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="campaigns">
                      <TabsList>
                        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                        <TabsTrigger value="adsets">Ad sets</TabsTrigger>
                        <TabsTrigger value="ads">Ads</TabsTrigger>
                        <TabsTrigger value="daily">Daily</TabsTrigger>
                      </TabsList>
                      <TabsContent value="campaigns" className="mt-3">
                        <PerformanceTable
                          rows={report.campaignRows}
                          currency={report.account.currency || "VND"}
                          pack={report.selectedPack}
                        />
                      </TabsContent>
                      <TabsContent value="adsets" className="mt-3">
                        <PerformanceTable
                          rows={report.adsetRows}
                          currency={report.account.currency || "VND"}
                          pack={report.selectedPack}
                        />
                      </TabsContent>
                      <TabsContent value="ads" className="mt-3">
                        <PerformanceTable
                          rows={report.adRows}
                          currency={report.account.currency || "VND"}
                          pack={report.selectedPack}
                        />
                      </TabsContent>
                      <TabsContent value="daily" className="mt-3">
                        <PerformanceTable rows={report.dailyRows} currency={report.account.currency || "VND"} daily />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Account health</CardTitle>
                    <CardDescription>Ads-skill checks: creative, CTR, frequency, consolidation.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-end justify-between">
                      <div className="text-4xl font-semibold">{report.health.score}/100</div>
                      <Badge variant={report.health.score >= 75 ? "secondary" : "destructive"}>Grade {report.health.grade}</Badge>
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
              </section>

              <section>
                <Card>
                  <CardHeader>
                    <CardTitle>Breakdowns</CardTitle>
                    <CardDescription>Platform and age/gender signal for diagnosis.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 xl:grid-cols-2">
                    <BarList rows={report.platformRows} metric="spend" currency={report.account.currency || "VND"} />
                    <BarList rows={report.ageGenderRows} metric="leads" currency={report.account.currency || "VND"} />
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
              loading={loading === "competitor"}
              language={language}
              provider={provider}
              copiedPrompt={copiedCompetitorPrompt}
              onNamesChange={setCompetitorNames}
              onMarketChange={setCompetitorMarket}
              onPlatformChange={setCompetitorPlatform}
              onNotesChange={setCompetitorNotes}
              onLanguageChange={setLanguage}
              onProviderChange={setProvider}
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
  onTokenChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src="/red-agency-logo.png" alt="Red Agency" className="size-12 rounded-lg object-contain" />
            <div>
              <CardTitle>Red Agency Ads Tool</CardTitle>
              <CardDescription>Connect Meta access token.</CardDescription>
            </div>
          </div>
          <CardDescription>
            Token is validated server-side, encrypted, and stored only in an HttpOnly session cookie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={props.onSubmit} className="flex flex-col gap-4">
            {props.error ? (
              <Alert variant="destructive">
                <AlertTitle>Token rejected</AlertTitle>
                <AlertDescription>{props.error}</AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel>Access token</FieldLabel>
                <Input
                  value={props.token}
                  onChange={(event) => props.onTokenChange(event.target.value)}
                  type="password"
                  autoComplete="off"
                  placeholder="Paste Meta access token"
                  required
                />
                <FieldDescription>Do not use shared tokens for hosted public deployments. Rotate any token pasted into chat.</FieldDescription>
              </Field>
            </FieldGroup>
            <Button type="submit" disabled={props.loading}>
              {props.loading ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
              Validate token
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-svh place-items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Loading session</CardTitle>
          <CardDescription>Checking encrypted cookie state.</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    </main>
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

function EmptyState() {
  return (
    <Empty className="min-h-80 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ActivityIcon />
        </EmptyMedia>
        <EmptyTitle>No report loaded</EmptyTitle>
        <EmptyDescription>Choose account and campaign scope, then pull report from Meta Graph API.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function CampaignPicker({
  campaigns,
  currency,
  loading,
  selectedIds,
  onChange,
}: {
  campaigns: MetaCampaign[];
  currency: string;
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
  const summary = selectedIds.length ? `${selectedIds.length} selected` : `All active (${activeCampaigns.length})`;

  function toggleCampaign(id: string) {
    const current = selectedIds.length ? selectedIds : [];
    onChange(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <Field className="xl:col-span-2">
      <FieldLabel>Campaigns</FieldLabel>
      <div className="rounded-lg border bg-background p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="secondary">{summary}</Badge>
            <span className="text-xs text-muted-foreground">{effectiveCount} in report scope</span>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onChange([])} disabled={loading}>
              All active
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((value) => !value)}
              disabled={loading || !campaigns.length}
            >
              {expanded ? <ChevronUpIcon data-icon="inline-start" /> : <ChevronDownIcon data-icon="inline-start" />}
              {expanded ? "Hide" : "Edit"}
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
                placeholder="Search campaigns"
                disabled={loading}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => onChange(campaigns.map((campaign) => campaign.id))} disabled={loading || !campaigns.length}>
                All
              </Button>
            </div>
            <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-auto pr-1">
              {loading ? (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                  <Spinner data-icon="inline-start" />
                  Loading campaigns
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
                            {campaign.objective || "No objective"} {formatCampaignBudget(campaign, currency)}
                          </span>
                        </span>
                        <Badge variant={status === "ACTIVE" ? "secondary" : status === "PAUSED" ? "outline" : "destructive"}>{status}</Badge>
                      </button>
                    );
                  })
                : null}
              {!loading && !visibleCampaigns.length ? <div className="py-6 text-center text-sm text-muted-foreground">No campaigns found.</div> : null}
            </div>
          </>
        ) : null}
      </div>
      <FieldDescription>Click campaigns to build a custom scope. Leave empty to pull all active campaigns.</FieldDescription>
    </Field>
  );
}

function campaignStatus(campaign: MetaCampaign) {
  return campaign.effective_status || campaign.status || "UNKNOWN";
}

function isActiveCampaign(campaign: MetaCampaign) {
  return campaignStatus(campaign) === "ACTIVE";
}

function formatCampaignBudget(campaign: MetaCampaign, currency: string) {
  const daily = Number(campaign.daily_budget || 0);
  const lifetime = Number(campaign.lifetime_budget || 0);
  if (daily > 0) return `- ${formatMetric(daily / 100, "currency", currency)}/day`;
  if (lifetime > 0) return `- ${formatMetric(lifetime / 100, "currency", currency)} lifetime`;
  return "";
}

function ComparisonPanel({ current, previous, mode }: { current: DashboardReport; previous: DashboardReport; mode: CompareMode }) {
  const currency = current.account.currency || "VND";
  const deltas = comparisonDeltas(current, previous).filter((item) =>
    ["spend", "messages", "leads", "purchases", "linkClicks", "ctr", "frequency", "costPerMessage", "cpl", "roas"].includes(item.key),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare mode: {modeLabel(mode)}</CardTitle>
        <CardDescription>
          Current {current.dateRange.since} to {current.dateRange.until}. Previous {previous.dateRange.since} to {previous.dateRange.until}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {deltas.slice(0, 10).map((delta) => (
            <div key={delta.key} className="rounded-lg border p-3">
              <div className="text-xs font-medium text-muted-foreground">{metricLabel(delta.key)}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{formatComparisonMetric(delta.key, delta.current, currency)}</div>
              <div className={delta.change >= 0 ? "text-xs tabular-nums text-emerald-700" : "text-xs tabular-nums text-destructive"}>
                {formatSignedPct(delta.change_pct)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AiVerdictPanel({
  provider,
  loading,
  verdict,
  copiedPrompt,
  language,
  onProviderChange,
  onLanguageChange,
  onGenerate,
  onCopyPrompt,
}: {
  provider: Provider;
  loading: boolean;
  verdict: AiVerdict | null;
  copiedPrompt: boolean;
  language: ReportLanguage;
  onProviderChange: (value: Provider) => void;
  onLanguageChange: (value: ReportLanguage) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
}) {
  const isVietnamese = language === "vi";
  return (
    <Card data-print-break data-print-flow>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{isVietnamese ? "Báo cáo AI" : "AI verdict"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "Phân tích hiệu quả và đề xuất tối ưu bằng AI. Prompt fallback luôn khả dụng."
                : "AI-powered monthly analysis and next-period recommendations. Prompt fallback stays available."}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-end" data-print-hidden>
            <Field className="md:w-40">
              <FieldLabel>{isVietnamese ? "Ngôn ngữ" : "Language"}</FieldLabel>
              <Select
                items={languageItems}
                value={language}
                onValueChange={(value) => {
                  if (value) onLanguageChange(value as ReportLanguage);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {languageItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:w-56">
              <FieldLabel>Provider</FieldLabel>
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
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Button onClick={onGenerate} disabled={loading}>
              {loading ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              Generate verdict
            </Button>
            <Button type="button" variant="outline" onClick={onCopyPrompt}>
              <ClipboardIcon data-icon="inline-start" />
              {copiedPrompt ? "Copied" : "Copy prompt"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {verdict ? (
          <VerdictCard verdict={verdict} language={language} />
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No AI verdict yet</EmptyTitle>
              <EmptyDescription>Generate after pulling report. Export will include this section once available.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

function InsightPanel({
  insights,
  loading,
  compareMode,
  hasComparison,
  language,
  onGenerate,
}: {
  insights: AiInsightTable | null;
  loading: boolean;
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
  result,
  loading,
  language,
  provider,
  copiedPrompt,
  onNamesChange,
  onMarketChange,
  onPlatformChange,
  onNotesChange,
  onLanguageChange,
  onProviderChange,
  onGenerate,
  onCopyPrompt,
}: {
  names: string;
  market: string;
  platform: CompetitorPlatform;
  notes: string;
  result: CompetitorSpyResult | null;
  loading: boolean;
  language: ReportLanguage;
  provider: Provider;
  copiedPrompt: boolean;
  onNamesChange: (value: string) => void;
  onMarketChange: (value: string) => void;
  onPlatformChange: (value: CompetitorPlatform) => void;
  onNotesChange: (value: string) => void;
  onLanguageChange: (value: ReportLanguage) => void;
  onProviderChange: (value: Provider) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
}) {
  const isVietnamese = language === "vi";
  const id = React.useId();
  const hasCompetitors = names
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean).length > 0;
  const themeRows = result?.themes.slice(0, 4) || [];
  const briefs = result?.test_briefs.slice(0, 4) || [];
  const competitors = result?.competitors.slice(0, 4) || [];

  return (
    <Card data-print-flow>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{isVietnamese ? "Competitor spy" : "Competitor spy"}</CardTitle>
            <CardDescription>
              {isVietnamese
                ? "Biến tên đối thủ hoặc ghi chú từ thư viện quảng cáo thành theme, gap và brief test mới."
                : "Turn competitor names or ad-library notes into themes, gaps, and original test briefs."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2" data-print-hidden>
            <Button type="button" onClick={onGenerate} disabled={loading || !hasCompetitors} aria-busy={loading}>
              {loading ? <Spinner data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}
              {loading ? (isVietnamese ? "Đang phân tích sâu..." : "Deep scan running...") : isVietnamese ? "Phân tích đối thủ" : "Analyze competitors"}
            </Button>
            <Button type="button" variant="outline" onClick={onCopyPrompt} disabled={!hasCompetitors}>
              <ClipboardIcon data-icon="inline-start" />
              {copiedPrompt ? "Copied" : "Copy spy prompt"}
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
                {isVietnamese ? "Chọn nguồn ghi chú quảng cáo." : "Choose source for pasted ad notes."}
              </FieldDescription>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <Field>
              <FieldLabel id={`${id}-language-label`}>{isVietnamese ? "Ngôn ngữ" : "Language"}</FieldLabel>
              <Select
                items={languageItems}
                value={language}
                onValueChange={(value) => {
                  if (value) onLanguageChange(value as ReportLanguage);
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby={`${id}-language-label`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {languageItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel id={`${id}-provider-label`}>Provider</FieldLabel>
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
                        {item.label}
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
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{isVietnamese ? "Chưa có competitor spy" : "No competitor spy yet"}</EmptyTitle>
              <EmptyDescription>
                {isVietnamese
                  ? "Nhập đối thủ, paste ghi chú từ Meta Ad Library nếu có, rồi phân tích."
                  : "Add competitors, paste Meta Ad Library notes when available, then analyze."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

function platformLabel(platform: CompetitorPlatform) {
  return competitorPlatformItems.find((item) => item.value === platform)?.label || platform;
}

function getCompareRange(range: { since: string; until: string }, mode: CompareMode) {
  if (mode === "off") return range;
  const sinceDate = parseDate(range.since);
  const untilDate = parseDate(range.until);
  if (mode === "wow") {
    sinceDate.setDate(sinceDate.getDate() - 7);
    untilDate.setDate(untilDate.getDate() - 7);
  }
  if (mode === "mom") {
    sinceDate.setMonth(sinceDate.getMonth() - 1);
    untilDate.setMonth(untilDate.getMonth() - 1);
  }
  if (mode === "yoy") {
    sinceDate.setFullYear(sinceDate.getFullYear() - 1);
    untilDate.setFullYear(untilDate.getFullYear() - 1);
  }
  return { since: toDateInput(sinceDate), until: toDateInput(untilDate) };
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function modeLabel(mode: CompareMode) {
  if (mode === "wow") return "WoW";
  if (mode === "mom") return "MoM";
  if (mode === "yoy") return "YoY";
  return "Off";
}

function metricLabel(key: string) {
  const labels: Record<string, string> = {
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
  };
  return labels[key] || key;
}

function formatComparisonMetric(key: string, value: number, currency: string) {
  if (["spend", "costPerMessage", "cpl"].includes(key)) return formatMetric(value, "currency", currency);
  if (["ctr"].includes(key)) return formatMetric(value, "percent", currency);
  if (["frequency", "roas"].includes(key)) return formatMetric(value, "ratio", currency);
  return formatMetric(value, "number", currency);
}

function formatSignedPct(value: number | null) {
  if (value === null) return "new";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

const performanceChartConfig = {
  spend: { label: "Spend", color: "var(--chart-1)" },
  messages: { label: "Messages", color: "var(--chart-2)" },
  replies: { label: "Replies", color: "var(--chart-3)" },
  leads: { label: "Leads", color: "var(--chart-2)" },
  purchases: { label: "Purchases", color: "var(--chart-3)" },
  linkClicks: { label: "Link clicks", color: "var(--chart-2)" },
  clicks: { label: "Clicks", color: "var(--chart-3)" },
  impressions: { label: "Impressions", color: "var(--chart-2)" },
  reach: { label: "Reach", color: "var(--chart-3)" },
  costPerMessage: { label: "Cost/msg", color: "var(--chart-1)" },
  costPerReply: { label: "Cost/reply", color: "var(--chart-2)" },
  cpl: { label: "CPL", color: "var(--chart-1)" },
  cpaPurchase: { label: "CPA purchase", color: "var(--chart-1)" },
  cpc: { label: "CPC", color: "var(--chart-1)" },
  cpm: { label: "CPM", color: "var(--chart-2)" },
  roas: { label: "ROAS", color: "var(--chart-2)" },
  ctr: { label: "CTR", color: "var(--chart-2)" },
  frequency: { label: "Frequency", color: "var(--chart-1)" },
  result: { label: "Result metric", color: "var(--chart-2)" },
} satisfies ChartConfig;

function PerformanceCharts({ report }: { report: DashboardReport }) {
  const currency = report.account.currency || "VND";
  const spec = getPackChartSpec(report.selectedPack);
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
            <ChartEmpty />
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
            <ChartEmpty />
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
                {spec.diagnosticKeys.includes("ctr") ? <ReferenceLine y={1} stroke="var(--chart-2)" strokeDasharray="2 4" /> : null}
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
            <ChartEmpty />
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
            <ChartEmpty />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

type ChartKey =
  | "messages"
  | "replies"
  | "leads"
  | "purchases"
  | "linkClicks"
  | "clicks"
  | "impressions"
  | "reach"
  | "costPerMessage"
  | "costPerReply"
  | "cpl"
  | "cpaPurchase"
  | "cpc"
  | "cpm"
  | "roas"
  | "ctr"
  | "frequency";

type ChartFormat = "number" | "currency" | "percent" | "ratio";

type PackChartSpec = {
  operatorQuestion: string;
  trendTitle: string;
  trendDescription: string;
  trendKeys: ChartKey[];
  efficiencyTitle: string;
  efficiencyDescription: string;
  efficiencyKeys: ChartKey[];
  diagnosticTitle: string;
  diagnosticDescription: string;
  diagnosticKeys: ChartKey[];
  referenceLine?: { value: number };
  drilldownTitle: string;
  drilldownDescription: string;
  drilldownKey: ChartKey;
  drilldownFormat: ChartFormat;
  higherIsBetter: boolean;
  metricFormats: Partial<Record<ChartKey, ChartFormat>>;
};

function getPackChartSpec(pack: KpiPack): PackChartSpec {
  const shared = {
    diagnosticTitle: "Fatigue guardrail",
    diagnosticDescription: "Frequency plus CTR is a common quick fatigue proxy. True creative fatigue needs creative-level CTR drop over time.",
    diagnosticKeys: ["frequency", "ctr"] as ChartKey[],
    referenceLine: { value: 3 },
  };

  if (pack === "messages") {
    return {
      ...shared,
      operatorQuestion: "Are message conversations scaling without reply quality or fatigue breaking?",
      trendTitle: "Message trend",
      trendDescription: "Spend against messages and replies, the core signal for DM campaigns.",
      trendKeys: ["messages", "replies"],
      efficiencyTitle: "Message cost",
      efficiencyDescription: "Cost per message and reply drift. Use this before scaling.",
      efficiencyKeys: ["costPerMessage", "costPerReply"],
      drilldownTitle: "Ad set cost per message",
      drilldownDescription: "Ad sets ranked by cost per message, with spend beside it.",
      drilldownKey: "costPerMessage",
      drilldownFormat: "currency",
      higherIsBetter: false,
      metricFormats: { messages: "number", replies: "number", costPerMessage: "currency", costPerReply: "currency", frequency: "ratio", ctr: "percent" },
    };
  }

  if (pack === "sales_roas") {
    return {
      ...shared,
      operatorQuestion: "Is spend creating purchases at enough ROAS to scale?",
      trendTitle: "Sales trend",
      trendDescription: "Spend against purchases and ROAS. Platform ROAS should still be treated as directional.",
      trendKeys: ["purchases", "roas"],
      efficiencyTitle: "Sales efficiency",
      efficiencyDescription: "CPA purchase and ROAS. Watch for rising CPA after budget changes.",
      efficiencyKeys: ["cpaPurchase", "roas"],
      drilldownTitle: "Ad set ROAS",
      drilldownDescription: "Ad sets ranked by reported ROAS, with spend beside it.",
      drilldownKey: "roas",
      drilldownFormat: "ratio",
      higherIsBetter: true,
      metricFormats: { purchases: "number", roas: "ratio", cpaPurchase: "currency", frequency: "ratio", ctr: "percent" },
    };
  }

  if (pack === "traffic") {
    return {
      ...shared,
      operatorQuestion: "Are clicks cheap enough without CTR quality collapsing?",
      trendTitle: "Traffic trend",
      trendDescription: "Spend against link clicks and clicks. Useful for spotting cheap but low-intent delivery.",
      trendKeys: ["linkClicks", "clicks"],
      efficiencyTitle: "Traffic cost",
      efficiencyDescription: "CPC and CPM drift. CTR is checked separately for quality.",
      efficiencyKeys: ["cpc", "cpm"],
      drilldownTitle: "Ad set CPC",
      drilldownDescription: "Ad sets ranked by CPC, with spend beside it.",
      drilldownKey: "cpc",
      drilldownFormat: "currency",
      higherIsBetter: false,
      metricFormats: { linkClicks: "number", clicks: "number", cpc: "currency", cpm: "currency", frequency: "ratio", ctr: "percent" },
    };
  }

  if (pack === "awareness") {
    return {
      operatorQuestion: "Is reach expanding before CPM and frequency show saturation?",
      trendTitle: "Reach trend",
      trendDescription: "Spend against reach and impressions. Awareness needs delivery scale plus controlled frequency.",
      trendKeys: ["reach", "impressions"],
      efficiencyTitle: "Awareness cost",
      efficiencyDescription: "CPM and frequency. Rising CPM with rising frequency usually signals saturation.",
      efficiencyKeys: ["cpm", "frequency"],
      diagnosticTitle: "Delivery saturation",
      diagnosticDescription: "Frequency plus CTR is a delivery saturation guardrail. Frequency over 4 deserves review for awareness campaigns.",
      diagnosticKeys: ["frequency", "ctr"],
      referenceLine: { value: 4 },
      drilldownTitle: "Ad set CPM",
      drilldownDescription: "Ad sets ranked by CPM, with spend beside it.",
      drilldownKey: "cpm",
      drilldownFormat: "currency",
      higherIsBetter: false,
      metricFormats: { reach: "number", impressions: "number", cpm: "currency", frequency: "ratio", ctr: "percent" },
    };
  }

  return {
    ...shared,
    operatorQuestion: "Are leads coming in at a cost worth scaling?",
    trendTitle: "Lead trend",
    trendDescription: "Spend against leads and messages. This keeps both direct lead and DM-led funnels visible.",
    trendKeys: ["leads", "messages"],
    efficiencyTitle: "Lead cost",
    efficiencyDescription: "CPL and cost per message. Use this for the 3x kill-rule check.",
    efficiencyKeys: ["cpl", "costPerMessage"],
    drilldownTitle: "Ad set CPL",
    drilldownDescription: "Ad sets ranked by CPL, with spend beside it.",
    drilldownKey: "cpl",
    drilldownFormat: "currency",
    higherIsBetter: false,
    metricFormats: { leads: "number", messages: "number", cpl: "currency", costPerMessage: "currency", frequency: "ratio", ctr: "percent" },
  };
}

function metricValue(row: NormalizedRow, key: ChartKey) {
  return Number(row[key] || 0);
}

function sortByDrilldown(a: NormalizedRow, b: NormalizedRow, key: ChartKey, higherIsBetter: boolean) {
  const left = metricValue(a, key);
  const right = metricValue(b, key);
  if (left === 0 && right === 0) return b.spend - a.spend;
  if (left === 0) return 1;
  if (right === 0) return -1;
  return higherIsBetter ? right - left : left - right;
}

function roundForFormat(value: number, format: ChartFormat) {
  if (format === "number" || format === "currency") return Math.round(value);
  return roundMetric(value);
}

function formatChartValue(value: number, format: ChartFormat, currency: string) {
  return formatMetric(value, format, currency);
}

function ChartEmpty() {
  return <div className="flex h-56 items-center justify-center rounded-lg border text-sm text-muted-foreground">No chart data returned.</div>;
}

function compactDate(date?: string) {
  if (!date) return "";
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[2])}/${Number(parts[1])}`;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function truncateLabel(value: string) {
  return value.length > 22 ? `${value.slice(0, 19)}...` : value;
}

function PerformanceTable({
  rows,
  currency,
  daily = false,
  pack,
}: {
  rows: NormalizedRow[];
  currency: string;
  daily?: boolean;
  pack?: KpiPack;
}) {
  if (!rows.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No rows</EmptyTitle>
          <EmptyDescription>Meta returned no insight rows for this scope.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{daily ? "Date" : "Name"}</TableHead>
          <TableHead className="text-right">Spend</TableHead>
          <TableHead className="text-right">Impr.</TableHead>
          <TableHead className="text-right">CTR</TableHead>
          <TableHead className="text-right">Messages</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          <TableHead className="text-right">Cost/msg</TableHead>
          <TableHead className="text-right">CPL</TableHead>
          {pack ? <TableHead>Action</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const action = pack ? rowDecision(row, pack) : null;
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

function rowDecision(row: NormalizedRow, pack: KpiPack) {
  const result = primaryResult(row, pack);
  const freqLimit = pack === "awareness" ? 4 : 3;
  if (row.frequency >= freqLimit && row.ctr < 1) {
    return { label: "Fix creative", reason: `Frequency >= ${freqLimit} and CTR below 1%.`, intent: "danger" as const };
  }
  if (row.ctr < 0.5 && row.impressions > 1000) {
    return { label: "Fix creative", reason: "CTR below Meta fail threshold.", intent: "warning" as const };
  }
  if (result > 0 && row.ctr >= 1 && row.frequency < freqLimit) {
    return { label: "Healthy", reason: "Has result signal with CTR and frequency in guardrail.", intent: "good" as const };
  }
  if (row.spend > 0 && result === 0) {
    return { label: "Review", reason: "Spend exists but primary result is zero.", intent: "warning" as const };
  }
  return { label: "Watch", reason: "No hard scale or kill signal.", intent: "neutral" as const };
}

function primaryResult(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "lead_gen") return row.leads;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  return row.reach;
}

function BarList({ rows, metric, currency }: { rows: NormalizedRow[]; metric: "spend" | "leads"; currency: string }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[metric] || 0)));
  const sorted = [...rows].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0)).slice(0, 6);
  if (!sorted.length) return <p className="text-sm text-muted-foreground">No breakdown rows returned.</p>;
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

function VerdictCard({ verdict, language }: { verdict: AiVerdict; language: ReportLanguage }) {
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
            {isVietnamese ? "Phân tích và đánh giá hiệu quả tháng - AI powered" : "Monthly performance analysis - AI powered"}
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
