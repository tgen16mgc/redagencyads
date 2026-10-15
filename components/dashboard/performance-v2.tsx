"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  DownloadIcon,
  FileChartColumnIncreasingIcon,
  GitCompareArrowsIcon,
  LayoutGridIcon,
  ListIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Label as HeroLabel, ScrollShadow, Switch as HeroSwitch } from "@heroui/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FATIGUE_FREQUENCY_THRESHOLD, buildCreativeSignals } from "@/lib/creative-signals";
import { conciseVerdict } from "@/lib/verdict-summary";
import { localizeHealthCheck, type HealthScoreSummary } from "@/lib/health-score";
import type { ClientReportPdfFile } from "@/lib/client-report";
import { formatComparisonChangePct, metricMovementIsBad, type MetricComparisonDelta } from "@/lib/metric-comparison";
import { formatMetric } from "@/lib/metrics";
import { buildDriverConcentration, evidenceCostLabel, selectStageContributors, trackedOutcomeValue } from "@/lib/performance-display";
import { buildPerformanceStages, type PerformanceStage, type PerformanceStageKey } from "@/lib/performance-stages";
import { buildPlatformEfficiencyPoints } from "@/lib/segment-efficiency";
import { buildReportRequestKey, type ReportExecutionScope } from "@/lib/report-refresh";
import type { AiInsightTable, CompareMode, DashboardReport, InterfaceLanguage, KpiCard, NormalizedRow, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ActionPlanModal,
  CreativeComparisonDialog,
  EntityDetailSheet,
  ExportDiagnosisDialog,
  StageEvidenceSheet,
} from "@/components/dashboard/performance-v2-overlays";
import { MetaCreativeCover, MetaCreativeFocusPreview } from "@/components/dashboard/meta-creative-media";
import { CampaignSetupTab } from "@/components/dashboard/campaign-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PerformanceV2Props = {
  language: InterfaceLanguage;
  report: DashboardReport;
  previousReport: DashboardReport | null;
  kpiComparisons: Map<keyof NormalizedRow, MetricComparisonDelta> | null;
  effectiveKpis: KpiCard[];
  healthSummary: HealthScoreSummary | null;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  accountLabel: string;
  periodLabel: string;
  scopeLabel: string;
  selectedCampaignIds: string[];
  since: string;
  until: string;
  compareMode: CompareMode;
  funnelStageKeys: PerformanceStageKey[] | null;
  exporting: boolean;
  reviewing: boolean;
  reportLoading: boolean;
  customizeAction?: React.ReactNode;
  driversExtra?: React.ReactNode;
  creativesExtra?: React.ReactNode;
  evidenceExtra?: React.ReactNode;
  initialTab?: "overview" | "creatives" | "evidence" | "actions";
  initialTabKey?: number;
  onEditScope: () => void;
  onRefresh: (scope?: ReportExecutionScope) => void;
  onExport: () => Promise<ClientReportPdfFile>;
  onReviewActions: () => void;
};

type Stage = PerformanceStage;

const tabValues = ["overview", "funnel", "drivers", "setup", "creatives", "evidence"] as const;

export function PerformanceV2({
  language,
  report,
  previousReport,
  kpiComparisons,
  effectiveKpis,
  healthSummary,
  verdict,
  insights,
  accountLabel,
  periodLabel,
  scopeLabel,
  selectedCampaignIds,
  since,
  until,
  compareMode,
  funnelStageKeys,
  exporting,
  reviewing,
  reportLoading,
  customizeAction,
  driversExtra,
  creativesExtra,
  evidenceExtra,
  initialTab = "overview",
  initialTabKey = 0,
  onEditScope,
  onRefresh,
  onExport,
  onReviewActions,
}: PerformanceV2Props) {
  const isVietnamese = language === "vi";
  const [activeTab, setActiveTab] = React.useState<(typeof tabValues)[number]>(initialTab === "actions" ? "overview" : initialTab);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [actionPlanOpen, setActionPlanOpen] = React.useState(false);
  const [selectedStage, setSelectedStage] = React.useState<Stage | null>(null);
  const [selectedEntity, setSelectedEntity] = React.useState<NormalizedRow | null>(null);
  const [creativeComparisonOpen, setCreativeComparisonOpen] = React.useState(false);
  const [selectedCreativeIds, setSelectedCreativeIds] = React.useState<string[]>([]);
  const currency = report.account.currency || "VND";
  const stages = buildPerformanceStages({ report, previousReport, compareMode, language, stageKeys: funnelStageKeys });
  const primary = primaryResult(report, language);
  const risks = healthSummary?.items.filter((item) => item.severity !== "healthy") || [];

  const openActionPlan = React.useCallback(() => setActionPlanOpen(true), []);

  React.useEffect(() => {
    const openExport = () => setExportOpen(true);
    const refresh = (event: Event) => {
      const command = (event as CustomEvent<{ key: string; scope: ReportExecutionScope }>).detail;
      if (command?.key === buildReportRequestKey(command.scope)) onRefresh(command.scope);
    };
    window.addEventListener("v2:open-export", openExport);
    window.addEventListener("v2:refresh-report-scope", refresh);
    return () => {
      window.removeEventListener("v2:open-export", openExport);
      window.removeEventListener("v2:refresh-report-scope", refresh);
    };
  }, [onRefresh]);

  React.useEffect(() => {
    if (initialTab === "actions") {
      setActiveTab("overview");
      setActionPlanOpen(true);
      return;
    }
    setActiveTab(initialTab);
  }, [initialTab, initialTabKey]);

  React.useEffect(() => {
    const availableIds = new Set(report.adRows.map((row) => row.id));
    setSelectedCreativeIds((current) => current.filter((id) => availableIds.has(id)).slice(0, 2));
  }, [report.adRows]);

  return (
    <section className="plain-performance flex flex-col gap-4" data-current-report-scope data-account-id={report.account.id} data-campaign-ids={selectedCampaignIds.join(",")} data-since={since} data-until={until} data-compare-mode={compareMode} data-comparison-campaign-ids={previousReport?.selectedCampaigns.map((campaign) => campaign.id).join(",") || ""} data-comparison-since={previousReport?.dateRange.since || ""} data-comparison-until={previousReport?.dateRange.until || ""}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-[28px]">
            {isVietnamese ? "Phân tích hiệu suất" : "Performance insights"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isVietnamese ? "Theo dõi chi tiêu từ lượt tiếp cận đến kết quả, rồi xử lý điểm nghẽn lớn nhất." : "Trace spend from reach to result, then fix the biggest constraint."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" data-edit-report-scope variant="outline" size="sm" onClick={onEditScope} disabled={reportLoading}>
            <SlidersHorizontalIcon data-icon="inline-start" />
            {isVietnamese ? "Sửa phạm vi" : "Edit scope"}
          </Button>
          <Button type="button" size="sm" onClick={openActionPlan}>
            <SparklesIcon data-icon="inline-start" />
            {reviewing ? (isVietnamese ? "Đang phân tích" : "Reviewing") : (isVietnamese ? "Xem hành động" : "Review actions")}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof tabValues)[number])}>
        <div className="plain-performance-toolbar flex flex-col gap-3">
          <ScrollShadow hideScrollBar orientation="horizontal" size={28} className="w-full min-w-0 xl:max-w-[430px]">
            <TabsList className="h-auto min-w-max justify-start rounded-none bg-transparent p-0">
              {tabValues.map((value) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="min-w-max rounded-none border border-transparent px-3 py-2 text-xs capitalize text-muted-foreground data-[selected]:border-border data-[selected]:bg-secondary/35 data-[selected]:text-foreground"
                >
                  {tabLabel(value, language)}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollShadow>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {customizeAction}
            <button type="button" disabled={reportLoading} className="v2-subtle-panel max-w-[280px] truncate px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" title={accountLabel} onClick={onEditScope}><b className="font-medium text-foreground">Account:</b> {accountLabel}</button>
            <button type="button" disabled={reportLoading} className="v2-subtle-panel px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" aria-label={`${isVietnamese ? "Đổi khoảng ngày" : "Change date range"}: ${periodLabel}`} onClick={onEditScope}><b className="font-medium text-foreground">{isVietnamese ? "Ngày:" : "Dates:"}</b> {periodLabel}</button>
            <button type="button" disabled={reportLoading} className="v2-subtle-panel flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" onClick={onEditScope}><GitCompareArrowsIcon className="size-3.5" /><b className="font-medium text-foreground">{isVietnamese ? "So sánh:" : "Compare:"}</b> {comparisonLabel(compareMode, language)}</button>
            <button type="button" disabled={reportLoading} className="h-7 disabled:cursor-not-allowed disabled:opacity-50" onClick={onEditScope}><Badge variant="secondary" className="h-7">{isVietnamese ? "KPI:" : "KPI:"} {scopeLabel}</Badge></button>
          </div>
        </div>

        <TabsContent value="overview" className="mt-4">
          {activeTab === "overview" ? <OverviewTab
            language={language}
            report={report}
            effectiveKpis={effectiveKpis}
            kpiComparisons={kpiComparisons}
            healthSummary={healthSummary}
            verdict={verdict}
            insights={insights}
            stages={stages}
            primary={primary}
            risks={risks}
            currency={currency}
            onOpenEvidence={() => setActiveTab("evidence")}
            onOpenFunnel={() => setActiveTab("funnel")}
            onReviewActions={openActionPlan}
          /> : null}
        </TabsContent>

        <TabsContent value="funnel" className="mt-4">
          {activeTab === "funnel" ? <FunnelTab
            language={language}
            report={report}
            healthSummary={healthSummary}
            stages={stages}
            currency={currency}
            onOpenEvidence={() => setSelectedStage(stages.find((stage) => stage.tone === "warning") || stages.at(-1) || null)}
            onSelectStage={setSelectedStage}
          /> : null}
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          {activeTab === "drivers" ? <><DriversTab language={language} report={report} currency={currency} onSelectEntity={setSelectedEntity} />
          {driversExtra ? <div className="mt-4">{driversExtra}</div> : null}</> : null}
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          {activeTab === "setup" ? <CampaignSetupTab language={language} report={report} /> : null}
        </TabsContent>

        <TabsContent value="creatives" className="mt-4">
          {activeTab === "creatives" ? <><CreativesTab language={language} report={report} currency={currency} selectedIds={selectedCreativeIds} onSelectionChange={setSelectedCreativeIds} onCompare={() => setCreativeComparisonOpen(true)} onOpenEvidence={() => setActiveTab("evidence")} />
          {creativesExtra ? <div className="mt-4">{creativesExtra}</div> : null}</> : null}
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          {activeTab === "evidence" ? <><EvidenceTab language={language} report={report} healthSummary={healthSummary} currency={currency} />
          {evidenceExtra ? <div className="mt-4 flex flex-col gap-4">{evidenceExtra}</div> : null}</> : null}
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3" data-print-hidden>
        <Button type="button" data-report-refresh="true" data-pending={reportLoading || undefined} variant="ghost" size="sm" onClick={() => onRefresh()} disabled={reportLoading}>
          <RefreshCwIcon data-icon="inline-start" />
          {reportLoading ? (isVietnamese ? "Đang làm mới" : "Refreshing") : (isVietnamese ? "Làm mới" : "Refresh")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setExportOpen(true)} disabled={exporting}>
          <DownloadIcon data-icon="inline-start" />
          {exporting ? (isVietnamese ? "Đang xuất" : "Exporting") : (isVietnamese ? "Xuất báo cáo" : "Export report")}
        </Button>
      </div>

      <ExportDiagnosisDialog open={exportOpen} onOpenChange={setExportOpen} report={report} accountLabel={accountLabel} periodLabel={periodLabel} language={language} exporting={exporting} onPreparePdf={onExport} />
      <ActionPlanModal open={actionPlanOpen} onOpenChange={setActionPlanOpen} report={report} verdict={verdict} healthSummary={healthSummary} language={language} loading={reviewing} onGenerate={onReviewActions} onExport={() => setExportOpen(true)} />
      <StageEvidenceSheet stage={selectedStage} onOpenChange={(open) => !open && setSelectedStage(null)} report={report} onReviewAction={() => { setSelectedStage(null); setActionPlanOpen(true); }} />
      <EntityDetailSheet row={selectedEntity} onOpenChange={(open) => !open && setSelectedEntity(null)} report={report} onOpenAction={() => { setSelectedEntity(null); setActionPlanOpen(true); }} />
      <CreativeComparisonDialog open={creativeComparisonOpen} onOpenChange={setCreativeComparisonOpen} rows={selectedCreativeIds.map((id) => report.adRows.find((row) => row.id === id)).filter((row): row is NormalizedRow => Boolean(row))} report={report} onOpenEvidence={() => { setCreativeComparisonOpen(false); setActiveTab("evidence"); }} />
    </section>
  );
}

function OverviewTab({
  language,
  report,
  effectiveKpis,
  kpiComparisons,
  healthSummary,
  verdict,
  insights,
  stages,
  primary,
  risks,
  currency,
  onOpenEvidence,
  onOpenFunnel,
  onReviewActions,
}: {
  language: InterfaceLanguage;
  report: DashboardReport;
  effectiveKpis: KpiCard[];
  kpiComparisons: Map<keyof NormalizedRow, MetricComparisonDelta> | null;
  healthSummary: HealthScoreSummary | null;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  stages: Stage[];
  primary: ReturnType<typeof primaryResult>;
  risks: HealthScoreSummary["items"];
  currency: string;
  onOpenEvidence: () => void;
  onOpenFunnel: () => void;
  onReviewActions: () => void;
}) {
  const isVietnamese = language === "vi";
  const decisionTitle = conciseVerdict(verdict?.verdict || primary.decision);
  const actionRows = verdict ? [...verdict.budget_moves, ...verdict.tests].filter(Boolean).slice(0, 2) : risks.slice(0, 2).map((item) => item.detail[language]);
  const totalChecks = healthSummary?.items.length || report.health.checks.length;
  const passedChecks = healthSummary?.counts.healthy ?? report.health.checks.filter((check) => check.status === "pass").length;
  const blockingCount = healthSummary?.counts.danger ?? report.health.checks.filter((check) => check.status === "fail").length;
  const watchCount = healthSummary?.counts.warning ?? report.health.checks.filter((check) => check.status === "warning").length;
  const primaryRisk = risks[0];
  const constraintTitle = primaryRisk?.title[language] || (isVietnamese ? "Không có rào cản nghiêm trọng" : "No critical constraint detected");
  const constraintDetail = primaryRisk?.detail[language] || healthSummary?.summary[language] || report.packReason;
  const guardedAction = actionRows[0] || decisionTitle;

  const period = `${report.dateRange.since} – ${report.dateRange.until}`;

  return (
    <div className="plain-overview">
      <section className="plain-panel" aria-label={isVietnamese ? "Tổng quan chỉ số" : "Metrics overview"}>
        <div className="plain-panel-heading">
          <h2>{isVietnamese ? "Tổng quan" : "Overview"}</h2>
          <span className="plain-period">{period}</span>
        </div>
        <div className="plain-featured-metrics">
          {effectiveKpis.slice(0, 3).map((kpi) => (
            <OverviewMetric key={kpi.key} kpi={kpi} report={report} healthSummary={healthSummary} comparison={kpi.key === "healthScore" ? undefined : kpiComparisons?.get(kpi.key)} language={language} featured />
          ))}
        </div>
        {effectiveKpis.length > 3 ? <div className="plain-secondary-metrics">
          {effectiveKpis.slice(3).map((kpi) => (
            <OverviewMetric key={kpi.key} kpi={kpi} report={report} healthSummary={healthSummary} comparison={kpi.key === "healthScore" ? undefined : kpiComparisons?.get(kpi.key)} language={language} />
          ))}
        </div> : null}
        {!effectiveKpis.length ? <p className="plain-empty">{isVietnamese ? "Chọn chỉ số trong Tùy chỉnh KPI để hiển thị tổng quan." : "Choose metrics in Customize KPIs to populate this overview."}</p> : null}
      </section>

      <section className="plain-panel plain-volume">
        <div className="plain-panel-heading">
          <h2>{isVietnamese ? "Kết quả theo thời gian" : "Performance over time"}</h2>
          <span className="plain-period">{period}</span>
        </div>
        <div className="plain-volume-summary">
          <div><span>{primary.label}</span><strong>{formatMetric(Number(report.totals[primary.key] || 0), "number", currency)}</strong></div>
          <div className="plain-chart-legend"><span><i />{primary.label}</span><span><i />{primary.costLabel}</span></div>
        </div>
        <TrendPanel language={language} report={report} primary={primary} embedded overview />
      </section>

      <div className="plain-diagnostics">
        <section className="plain-panel">
          <div className="plain-panel-heading">
            <h2>{isVietnamese ? "Chẩn đoán" : "Diagnosis"}</h2>
            <Badge variant={blockingCount > 0 ? "destructive" : watchCount > 0 ? "outline" : "success"}>{healthSummary?.score ?? report.health.score}/100</Badge>
          </div>
          <h3 className="plain-diagnosis-title">{constraintTitle}</h3>
          <p className="plain-body">{constraintDetail}</p>
          <div className="plain-diagnosis-meta"><span>{passedChecks}/{Math.max(totalChecks, 1)} {isVietnamese ? "kiểm tra đạt" : "checks passed"}</span><span>{packLabel(report.selectedPack, language)}</span></div>
          <button type="button" className="plain-verdict" onClick={onReviewActions}><span>{decisionTitle}</span><ArrowRightIcon size={16} /></button>
        </section>
        <section className="plain-panel">
          <div className="plain-panel-heading"><h2>{isVietnamese ? "Hành động tiếp theo" : "Next action"}</h2><ShieldAlertIcon size={17} className="text-muted-foreground" /></div>
          <h3 className="plain-diagnosis-title">{guardedAction}</h3>
          <p className="plain-body">{isVietnamese ? "Rà soát bằng chứng trước khi áp dụng. Giới hạn thay đổi ngân sách: 20% mỗi bước." : "Review the evidence before applying. Budget changes are limited to 20% per step."}</p>
          {actionRows[1] ? <p className="plain-body plain-followup">{actionRows[1]}</p> : null}
          {insights?.rows?.[0] ? <p className="plain-body plain-followup">{insights.rows[0].insight}</p> : null}
          <div className="plain-panel-actions"><Button type="button" size="sm" onClick={onReviewActions}>{isVietnamese ? "Rà hành động" : "Review action"}</Button><Button type="button" size="sm" variant="outline" onClick={onOpenEvidence}>{isVietnamese ? "Mở bằng chứng" : "Open evidence"}</Button></div>
        </section>
      </div>
      <section className="plain-panel plain-funnel">
        <div className="plain-panel-heading"><h2>{isVietnamese ? "Sức khỏe phễu" : "Funnel health"}</h2><button type="button" className="plain-text-action" onClick={onOpenFunnel}>{isVietnamese ? "Mở phễu" : "Open funnel"}<ArrowRightIcon size={14} /></button></div>
        <StageGrid stages={stages} language={language} />
      </section>
    </div>
  );
}

function OverviewMetric({ kpi, report, healthSummary, comparison, language, featured = false }: {
  kpi: KpiCard;
  report: DashboardReport;
  healthSummary: HealthScoreSummary | null;
  comparison?: MetricComparisonDelta;
  language: InterfaceLanguage;
  featured?: boolean;
}) {
  const gradientId = React.useId().replace(/:/g, "");
  const currency = report.account.currency || "VND";
  const isVietnamese = language === "vi";
  const data = kpi.key === "healthScore" ? [] : report.dailyRows.map((row) => ({ date: row.date, value: typeof row[kpi.key as keyof NormalizedRow] === "number" ? Number(row[kpi.key as keyof NormalizedRow]) : null }));
  const hasData = data.some((row) => row.value !== null && Number.isFinite(row.value));
  const value = kpi.key === "healthScore" ? `${healthSummary?.score ?? report.health.score}/100` : formatKpi(report, kpi, currency);
  const bad = comparison ? metricMovementIsBad(comparison.key, comparison.change) : false;
  return <article className="plain-metric">
    <h3>{kpi.label}</h3>
    <div className="plain-metric-value">{value}</div>
    <div className="plain-metric-comparison" data-tone={comparison && comparison.change !== 0 ? bad ? "negative" : "positive" : "neutral"}>
      {comparison ? <><span>{formatComparisonChangePct(comparison.changePct, language)}</span> {comparison.descriptor}</> : <span>{isVietnamese ? "Trong kỳ đã chọn" : "In selected period"}</span>}
    </div>
    {featured ? hasData ? <div className="plain-metric-chart" role="img" aria-label={`${kpi.label}: ${isVietnamese ? "xu hướng theo ngày" : "daily trend"}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--plain-chart)" stopOpacity={0.2} /><stop offset="100%" stopColor="var(--plain-chart)" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis dataKey="date" tickFormatter={(date: string) => date?.slice(5) || ""} axisLine={false} tickLine={false} minTickGap={45} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
          <YAxis orientation="right" width={42} axisLine={false} tickLine={false} tickCount={3} tickFormatter={(value: number) => compact(value)} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
          <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(value) => [formatMetric(Number(value), kpi.format, currency), kpi.label]} />
          <Area type="monotone" dataKey="value" stroke="var(--plain-chart)" strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} connectNulls={false} activeDot={{ r: 3, strokeWidth: 2, fill: "var(--card)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div> : <div className="plain-metric-chart plain-empty">{isVietnamese ? "Chưa có dữ liệu theo ngày" : "Daily trend unavailable"}</div> : null}
  </article>;
}

function FunnelTab({ language, report, healthSummary, stages, currency, onOpenEvidence, onSelectStage }: { language: InterfaceLanguage; report: DashboardReport; healthSummary: HealthScoreSummary | null; stages: Stage[]; currency: string; onOpenEvidence: () => void; onSelectStage: (stage: Stage) => void }) {
  const isVietnamese = language === "vi";
  const leakStage = [...stages].reverse().find((stage) => stage.tone === "warning");
  const focusStage = leakStage || [...stages].reverse().find((stage) => stage.tone === "primary") || stages.at(-1)!;
  const hasLeak = Boolean(leakStage);
  const contributorSelection = selectStageContributors(report.adsetRows, focusStage.key);
  const rows = contributorSelection.rows;
  const contributorBasisLabel = stageContributorLabel(contributorSelection.basis, language);

  return (
    <div className="grid gap-4">
      <div className="v2-panel p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="v2-section-title">{isVietnamese ? "Phễu thích ứng" : "Adaptive performance funnel"}</h2>
            <p className="v2-section-copy">{isVietnamese ? "Mỗi bước kết hợp volume với metric hiệu quả có thể hành động." : "Every stage pairs volume with the efficiency metric that can actually be acted on."}</p>
          </div>
          <Badge variant="secondary">{packLabel(report.selectedPack, language)}</Badge>
        </div>
        <StageGrid stages={stages} language={language} large onSelect={onSelectStage} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)]">
        <div className="v2-panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="v2-section-title">
                {hasLeak
                  ? `${focusStage.label} ${isVietnamese ? "— chẩn đoán" : "stage diagnosis"}`
                  : isVietnamese ? "Không phát hiện rò rỉ nghiêm trọng" : "No critical leak detected"}
              </h2>
              <p className="v2-section-copy">
                {hasLeak
                  ? isVietnamese ? "Tín hiệu hiệu quả phía trên nhưng mất mát tăng ở bước được đánh dấu." : "Upstream delivery is intact, but loss concentrates at the highlighted step."
                  : isVietnamese ? "Tất cả các bước đang nằm trong ngưỡng hiện tại; tiếp tục theo dõi evidence trước khi scale." : "Every monitored stage is within its current threshold; keep watching the evidence before scaling."}
              </p>
            </div>
            <Badge variant={hasLeak ? "outline" : "success"}>
              {hasLeak ? (isVietnamese ? "Rò rỉ lớn nhất" : "Largest leak") : (isVietnamese ? "Luồng khỏe" : "Healthy flow")}
            </Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ReportStat
              label={hasLeak ? (isVietnamese ? "Tỷ lệ bước" : "Stage rate") : (isVietnamese ? "Bước khỏe" : "Healthy stages")}
              value={hasLeak ? focusStage.efficiency : `${stages.length}/${stages.length}`}
            />
            <ReportStat label={isVietnamese ? "Volume" : "Volume"} value={stageValue(focusStage, language)} />
            <ReportStat label={isVietnamese ? "Độ tin cậy" : "Confidence"} value={(healthSummary?.score ?? report.health.score) >= 75 ? (isVietnamese ? "Cao" : "High") : (isVietnamese ? "Vừa" : "Medium")} />
          </div>
          <div className="mt-5">
            <TrendPanel language={language} report={report} primary={primaryResult(report, language)} embedded />
          </div>
        </div>

        <div className="v2-panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="v2-section-title">{isVietnamese ? "Evidence theo phân khúc" : "Stage evidence"}</h2>
            <Badge variant="outline">{rows.length} {isVietnamese ? "đóng góp" : "contributors"}</Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{isVietnamese ? `Xếp hạng theo ${contributorBasisLabel}` : `Ranked by ${contributorBasisLabel}`}</p>
          <div className="mt-4 flex flex-col gap-4">
            {rows.length ? rows.map((row) => (
              <div key={row.id}>
                <div className="text-sm font-medium">{row.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stageContributorDetail(row, contributorSelection.basis, currency, language)}</div>
              </div>
            )) : <p className="text-xs leading-5 text-muted-foreground">{isVietnamese ? "Chưa có dữ liệu ad set cho bước này." : "No ad-set evidence is available for this stage."}</p>}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <div className="text-sm font-medium">{isVietnamese ? "Guardrail quyết định" : "Decision guardrail"}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{isVietnamese ? "Giữ chi tiêu ổn định cho đến khi tỷ lệ bước cải thiện qua ba kỳ liên tiếp." : "Hold the next scale move until the weak stage improves for three consecutive periods."}</p>
          </div>
          <Button type="button" size="sm" className="mt-5" onClick={onOpenEvidence}>{isVietnamese ? "Mở evidence" : "Open evidence"}</Button>
        </div>
      </div>
    </div>
  );
}

function DriversTab({ language, report, currency, onSelectEntity }: { language: InterfaceLanguage; report: DashboardReport; currency: string; onSelectEntity: (row: NormalizedRow) => void }) {
  const isVietnamese = language === "vi";
  const primaryKey = resultKey(report.selectedPack);
  const rows = [...report.adsetRows]
    .sort((left, right) => contributionScore(right, primaryKey) - contributionScore(left, primaryKey))
    .slice(0, 8);
  const strongest = [...rows].sort((left, right) => rowEfficiency(right, primaryKey) - rowEfficiency(left, primaryKey))[0];
  const weakest = [...rows].sort((left, right) => rowEfficiency(left, primaryKey) - rowEfficiency(right, primaryKey))[0];
  const concentration = buildDriverConcentration(report.adsetRows, primaryKey);
  const segmentPoints = buildPlatformEfficiencyPoints(report.platformRows, primaryKey);
  const strongestSegment = [...segmentPoints].sort((left, right) => right.efficiency - left.efficiency)[0];
  const concentrationBasis = concentration.basis === "results"
    ? (isVietnamese ? "kết quả" : "results")
    : (isVietnamese ? "chi tiêu" : "spend");
  const concentrationTitle = isVietnamese
    ? `${concentration.count} hàng đầu đóng góp ${concentration.share.toFixed(0)}% ${concentrationBasis}`
    : `Top ${concentration.count} rows drive ${concentration.share.toFixed(0)}% of ${concentrationBasis}`;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <SignalCard eyebrow={isVietnamese ? "Lực cản lớn nhất" : "Largest drag"} title={weakest?.name || "—"} detail={weakest ? `${currencyValue(weakest.spend, currency)} · ${primaryRowCost(weakest, report.selectedPack, currency)}` : "—"} tone="warning" />
        <SignalCard eyebrow={isVietnamese ? "Tăng trưởng mạnh nhất" : "Strongest gain"} title={strongest?.name || "—"} detail={strongest ? `${compact(Number(strongest[primaryKey] || 0))} ${primaryLabel(report.selectedPack, language)}` : "—"} tone="success" />
        <SignalCard eyebrow={isVietnamese ? "Mức độ tập trung" : "Concentration"} title={concentrationTitle} detail={isVietnamese ? "Được tính trực tiếp từ phạm vi ad set hiện tại" : "Measured directly from the current ad-set scope"} tone="primary" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.72fr)]">
        <div className="v2-panel overflow-hidden p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="v2-section-title">{isVietnamese ? "Xếp hạng đóng góp entity" : "Entity contribution ranking"}</h2>
              <p className="v2-section-copy">{isVietnamese ? "Xếp theo đóng góp cho outcome chính." : "Ranked by contribution to the selected outcome."}</p>
            </div>
            <div className="flex items-center gap-2"><Badge variant="outline">{packLabel(report.selectedPack, language)}</Badge><Button type="button" variant="outline" size="sm" onClick={() => { downloadRowsCsv(rows, `performance-drivers-${report.dateRange.until}.csv`); toast.success(isVietnamese ? "Đã bắt đầu xuất CSV động lực" : "Driver CSV export started", { description: isVietnamese ? `${rows.length} entity được xếp hạng giữ nguyên KPI pack và phạm vi hiện tại.` : `${rows.length} ranked entities preserve the current KPI pack and scope.` }); }}><DownloadIcon data-icon="inline-start" />{isVietnamese ? "Xuất CSV" : "Export CSV"}</Button></div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                <tr><th className="pb-3 font-medium">Entity</th><th className="pb-3 font-medium">Spend</th><th className="pb-3 font-medium">CTR</th><th className="pb-3 font-medium">{primaryLabel(report.selectedPack, language)}</th><th className="pb-3 font-medium">Cost</th><th className="pb-3 font-medium">State</th></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    aria-label={`${isVietnamese ? "Mở chi tiết" : "Open details"}: ${row.name}`}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    onClick={() => onSelectEntity(row)}
                    onKeyDown={(event) => {
                      if (event.currentTarget !== event.target || (event.key !== "Enter" && event.key !== " ")) return;
                      event.preventDefault();
                      onSelectEntity(row);
                    }}
                  >
                    <td className="py-3 pr-4"><button type="button" className="text-left" onClick={(event) => { event.stopPropagation(); onSelectEntity(row); }}><div className="font-medium">{row.name}</div><div className="mt-0.5 text-muted-foreground">{row.campaignName || row.level}</div></button></td>
                    <td className="py-3 pr-4 tabular-nums">{currencyValue(row.spend, currency)}</td>
                    <td className="py-3 pr-4 tabular-nums">{row.ctr.toFixed(2)}%</td>
                    <td className="py-3 pr-4 tabular-nums">{compact(Number(row[primaryKey] || 0))}</td>
                    <td className="py-3 pr-4 tabular-nums">{primaryRowCost(row, report.selectedPack, currency)}</td>
                    <td className="py-3"><Badge variant={index < 2 ? "success" : index > 4 ? "outline" : "secondary"}>{index < 2 ? (isVietnamese ? "Scale" : "Scale") : index > 4 ? (isVietnamese ? "Xem lại" : "Review") : (isVietnamese ? "Theo dõi" : "Watch")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="v2-panel p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="v2-section-title">{isVietnamese ? "Hiệu quả phân khúc" : "Segment efficiency"}</h2><Badge variant="secondary">{segmentPoints.length} {isVietnamese ? "nền tảng" : "platforms"}</Badge></div>
          <p className="mt-2 text-xs text-muted-foreground">{isVietnamese ? "Mỗi điểm gộp dữ liệu Meta thật theo platform. Bên phải hiệu quả hơn; cao hơn tốn kém hơn." : "Each point aggregates real Meta rows by platform. Right is more efficient; higher is more costly."}</p>
          {segmentPoints.length ? (
            <>
              <div className="relative mt-5 h-48 border-b border-l border-border" aria-label="Platform efficiency chart">
                {[25, 50, 75].map((offset) => <span key={offset} className="absolute inset-x-0 border-t border-border/70" style={{ top: `${offset}%` }} />)}
                <span className="absolute -left-2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[9px] text-muted-foreground">{isVietnamese ? "Chi phí / kết quả" : "Cost / result"}</span>
                <span className="absolute bottom-[-18px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-muted-foreground">{isVietnamese ? "Kết quả / chi tiêu" : "Results / spend"}</span>
                {segmentPoints.map(({ row, label, left, bottom, tone, unitCost }) => (
                  <div key={row.id} className="absolute -translate-x-1/2 translate-y-1/2" style={{ left: `${left}%`, bottom: `${bottom}%` }} title={`${label}: ${compact(Number(row[primaryKey] || 0))} ${primaryLabel(report.selectedPack, language)} · ${currencyValue(unitCost, currency)} / result`}>
                    <span className={cn("block size-3.5 rounded-full border-2 border-card", tone === "warning" ? "bg-warning" : "bg-primary")} />
                    <span className={cn("absolute top-0 -translate-y-0.5 whitespace-nowrap text-[9px] text-muted-foreground", left > 68 ? "right-4" : "left-4")}>{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                {segmentPoints.map((point) => <span key={`${point.row.id}-legend`}><b className="font-medium text-foreground">{point.label}</b> · {compact(Number(point.row[primaryKey] || 0))} · {currencyValue(point.unitCost, currency)}/{isVietnamese ? "kết quả" : "result"}</span>)}
              </div>
            </>
          ) : (
            <div className="mt-5 flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 px-6 text-center text-xs leading-5 text-muted-foreground">
              {isVietnamese ? "Không có kết quả theo platform được theo dõi cho KPI pack này. Dữ liệu thiếu không được thay bằng điểm giả." : "No tracked platform outcomes are available for this KPI pack. Missing data is not replaced with synthetic points."}
            </div>
          )}
          <div className="mt-5">
            <div className="text-sm font-medium">{isVietnamese ? "Insight chính" : "Top insight"}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{strongestSegment ? `${strongestSegment.label}: ${compact(Number(strongestSegment.row[primaryKey] || 0))} ${primaryLabel(report.selectedPack, language)} · ${currencyValue(strongestSegment.unitCost, currency)} ${isVietnamese ? "mỗi kết quả." : "per result."}` : (isVietnamese ? "Chưa đủ dữ liệu platform để xếp hạng hiệu quả." : "Not enough platform data to rank efficiency.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreativesTab({ language, report, currency, selectedIds, onSelectionChange, onCompare, onOpenEvidence }: { language: InterfaceLanguage; report: DashboardReport; currency: string; selectedIds: string[]; onSelectionChange: (ids: string[]) => void; onCompare: () => void; onOpenEvidence: () => void }) {
  const isVietnamese = language === "vi";
  const primaryKey = resultKey(report.selectedPack);
  const rows = [...report.adRows]
    .sort((left, right) => rowEfficiency(right, primaryKey) - rowEfficiency(left, primaryKey));
  const [selectedId, setSelectedId] = React.useState(rows[0]?.id || "");
  const [comparisonMode, setComparisonMode] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [showAll, setShowAll] = React.useState(false);
  const selected = rows.find((row) => row.id === selectedId) || rows[0];
  const signals = buildCreativeSignals(rows);
  const fatigueCount = signals.fatigueCount;
  const concentration = signals.concentration;

  const visibleRows = showAll ? rows : rows.slice(0, 6);
  const hashedAssets = report.creativeHashing?.hashedAssets ?? rows.length;
  const totalAssets = report.creativeHashing?.totalAssets ?? rows.length;
  const concentrationLabel = signals.concentrationStatus === "concentrated"
    ? (isVietnamese ? "Quá tập trung" : "Concentrated")
    : signals.concentrationStatus === "watch"
      ? (isVietnamese ? "Cần theo dõi" : "Watch")
      : (isVietnamese ? "Cân bằng" : "Balanced");

  function activateCreative(row: NormalizedRow) {
    setSelectedId(row.id);
    if (!comparisonMode) return;
    if (selectedIds.includes(row.id)) {
      onSelectionChange(selectedIds.filter((id) => id !== row.id));
      return;
    }
    onSelectionChange(selectedIds.length < 2 ? [...selectedIds, row.id] : [selectedIds[0], row.id]);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard eyebrow={isVietnamese ? "Creative hiệu quả nhất" : "Best performer"} title={rows[0]?.name || "—"} detail={rows[0] ? `${primaryRowCost(rows[0], report.selectedPack, currency)} ${isVietnamese ? `mỗi ${primaryLabel(report.selectedPack, language).toLowerCase()}` : `per ${primaryLabel(report.selectedPack, language).toLowerCase()}`}` : (isVietnamese ? "Chưa phân phối" : "No delivery yet")} tone="success" />
        <SignalCard eyebrow={isVietnamese ? "Cần làm mới" : "Needs refresh"} title={`${fatigueCount} / ${rows.length}`} detail={fatigueCount ? (isVietnamese ? `Frequency từ ${FATIGUE_FREQUENCY_THRESHOLD.toFixed(1)} trở lên` : `Frequency at or above ${FATIGUE_FREQUENCY_THRESHOLD.toFixed(1)}`) : (isVietnamese ? `Chưa creative nào chạm ${FATIGUE_FREQUENCY_THRESHOLD.toFixed(1)}` : `No creative has reached ${FATIGUE_FREQUENCY_THRESHOLD.toFixed(1)}`)} tone={fatigueCount ? "warning" : "success"} />
        <SignalCard eyebrow={isVietnamese ? "Có thể xem preview" : "Preview available"} title={`${hashedAssets} / ${totalAssets}`} detail={hashedAssets === totalAssets ? (isVietnamese ? "Mọi creative đều có preview" : "Every creative has a preview") : (isVietnamese ? `${totalAssets - hashedAssets} creative chưa được Meta trả preview` : `Meta returned no preview for ${totalAssets - hashedAssets}`)} tone={hashedAssets === totalAssets ? "success" : "primary"} />
        <SignalCard eyebrow={isVietnamese ? "Phân bổ chi tiêu" : "Spend distribution"} title={concentrationLabel} detail={`${concentration.toFixed(0)}% ${isVietnamese ? `chi tiêu nằm ở ${signals.topSpendShareCount} creative chi nhiều nhất` : `of spend sits in the top ${signals.topSpendShareCount} creatives`}`} tone={concentration >= 65 ? "warning" : "primary"} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
        <div className="v2-panel p-4 sm:p-5">
          <div className="flex flex-col gap-3"><div><h2 className="v2-section-title">{isVietnamese ? "Hiệu quả creative" : "Creative performance"}</h2><p className="v2-section-copy">{comparisonMode ? (isVietnamese ? "Chọn đúng hai creative để so sánh." : "Select exactly two creatives to compare.") : (isVietnamese ? "Chọn một creative để xem chi tiết. Bật so sánh khi cần." : "Choose one creative to inspect. Turn on compare mode only when needed.")}</p></div><div className="flex flex-wrap items-center gap-2">
            <HeroSwitch className="performance-heroui-control" isSelected={comparisonMode} onChange={(next) => { setComparisonMode(next); if (!next) onSelectionChange([]); }} size="sm"><HeroSwitch.Content><HeroSwitch.Control><HeroSwitch.Thumb /></HeroSwitch.Control><HeroLabel>{isVietnamese ? "Chế độ so sánh" : "Compare mode"}</HeroLabel></HeroSwitch.Content></HeroSwitch>
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-border p-1"><button type="button" className={cn("rounded-lg p-1.5", viewMode === "grid" && "bg-secondary text-foreground")} aria-label="Grid view" onClick={() => setViewMode("grid")}><LayoutGridIcon className="size-4" /></button><button type="button" className={cn("rounded-lg p-1.5", viewMode === "list" && "bg-secondary text-foreground")} aria-label="List view" onClick={() => setViewMode("list")}><ListIcon className="size-4" /></button></div>
            {comparisonMode ? <><Badge variant={selectedIds.length === 2 ? "success" : "outline"}>{selectedIds.length}/2 {isVietnamese ? "đã chọn" : "selected"}</Badge><Button type="button" size="sm" variant="outline" disabled={selectedIds.length !== 2} onClick={onCompare}><GitCompareArrowsIcon data-icon="inline-start" />{isVietnamese ? "So sánh" : "Compare"}</Button></> : null}
          </div></div>
          <div className={cn("mt-5 grid gap-3", viewMode === "grid" && "sm:grid-cols-2")}>
            {visibleRows.map((row) => {
              const selectionIndex = selectedIds.indexOf(row.id);
              return (
              <button key={row.id} type="button" aria-pressed={comparisonMode ? selectedIds.includes(row.id) : selected?.id === row.id} className={cn("relative grid min-w-0 gap-3 rounded-xl border p-2 text-left transition-colors", viewMode === "list" && "grid-cols-[82px_minmax(0,1fr)]", comparisonMode && selectedIds.includes(row.id) ? "border-primary/60 bg-primary/5" : selected?.id === row.id ? "border-border bg-secondary/25" : "border-transparent hover:border-border hover:bg-secondary/35")} onClick={() => activateCreative(row)}>
                <MetaCreativeCover report={report} row={row} className={viewMode === "grid" ? "h-32 w-full" : "h-24"} />
                <div className="min-w-0 py-1">
                  <div className="flex items-start justify-between gap-2"><div className="truncate text-sm font-medium">{row.name}</div>{comparisonMode ? (selectionIndex >= 0 ? <Badge variant={selectionIndex === 0 ? "success" : "secondary"}>{selectionIndex === 0 ? "Control 1" : "Challenger 2"}</Badge> : <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border" />) : null}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{row.adsetName || row.campaignName}</div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
                    <span>Spend <b className="block text-xs font-medium normal-case text-foreground">{currencyValue(row.spend, currency)}</b></span>
                    <span>CTR <b className="block text-xs font-medium normal-case text-foreground">{row.ctr.toFixed(2)}%</b></span>
                    <span>{primaryLabel(report.selectedPack, language)} <b className="block text-xs font-medium normal-case text-foreground">{compact(Number(row[primaryKey] || 0))}</b></span>
                    <span>Cost <b className="block text-xs font-medium normal-case text-foreground">{primaryRowCost(row, report.selectedPack, currency)}</b></span>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
          {rows.length > 6 ? <Button type="button" variant="ghost" size="sm" className="mt-4 w-full" onClick={() => setShowAll((current) => !current)}>{showAll ? (isVietnamese ? "Thu gọn" : "Show less") : (isVietnamese ? `Xem thêm ${rows.length - 6} creative` : `Show ${rows.length - 6} more creatives`)}</Button> : null}
        </div>

        <div className="v2-panel min-w-0 p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="v2-section-title">{isVietnamese ? "Creative đang xem" : "Creative in focus"}</h2><Badge variant={selected?.frequency && selected.frequency >= 3 ? "outline" : "success"}>{selected?.frequency && selected.frequency >= 3 ? (isVietnamese ? "Theo dõi" : "Watch") : (isVietnamese ? "Mới" : "Fresh")}</Badge></div>
          {selected ? <div className="mt-4"><MetaCreativeFocusPreview report={report} row={selected} language={language} /></div> : null}
          {selected ? (
            <>
              <h3 className="mt-4 text-sm font-semibold">{selected.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{selected.adsetName || selected.campaignName}</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <ReportStat label="Spend" value={currencyValue(selected.spend, currency)} />
                <ReportStat label="CTR" value={`${selected.ctr.toFixed(2)}%`} />
                <ReportStat label="Frequency" value={selected.frequency.toFixed(1)} />
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-sm font-medium">{isVietnamese ? "Chẩn đoán" : "Diagnosis"}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{selected.frequency >= 3 ? (isVietnamese ? "Creative đang tích lũy fatigue. Giữ hook và thử opening mới trước khi frequency tăng thêm." : "Creative is accumulating fatigue. Keep the hook and test new openings before frequency rises further.") : (isVietnamese ? "Tín hiệu click và outcome còn ổn định. Giữ creative trong mix hiện tại." : "Click and outcome signals remain stable. Keep this creative in the active mix.")}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={onOpenEvidence}>{isVietnamese ? "Mở evidence" : "Open evidence"}</Button>
                {comparisonMode ? <Button type="button" size="sm" variant="outline" disabled={selectedIds.length !== 2} onClick={onCompare}>{isVietnamese ? `So sánh (${selectedIds.length}/2)` : `Compare (${selectedIds.length}/2)`}</Button> : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EvidenceTab({ language, report, healthSummary, currency }: { language: InterfaceLanguage; report: DashboardReport; healthSummary: HealthScoreSummary | null; currency: string }) {
  const isVietnamese = language === "vi";
  const [level, setLevel] = React.useState<"campaign" | "adset" | "ad" | "daily">("campaign");
  const [methodologyOpen, setMethodologyOpen] = React.useState(false);
  const [allRowsVisible, setAllRowsVisible] = React.useState(false);
  const rows = level === "campaign" ? report.campaignRows : level === "adset" ? report.adsetRows : level === "ad" ? report.adRows : report.dailyRows;
  const visibleRows = allRowsVisible ? rows : rows.slice(0, 8);
  const primaryKey = resultKey(report.selectedPack);
  const costLabel = evidenceCostLabel(report.selectedPack, language);
  const methodologyItems = methodologyOpen
    ? (isVietnamese ? [
        ["Định nghĩa chỉ số", "Link CPC = chi tiêu ÷ click link; chi phí outcome theo KPI pack = chi tiêu ÷ outcome được theo dõi."],
        ["Mức đủ dữ liệu", "Phân tích rò rỉ cần ít nhất 100 click link và các sự kiện ở bước sau."],
        ["Logic so sánh", "Các hàng được khớp theo ID entity trước khi quy biến động theo kỳ."],
        ["Nhận diện KPI pack", "KPI pack được chọn có thể khác với pack tự động nhận diện."],
        ["Giả định provider", "Chẩn đoán xác định cục bộ vẫn hoạt động khi không có AI provider."],
        ["Giới hạn đã biết", "Không lưu doanh thu quy gán thô; ROAS chỉ hiển thị khi có tracking mua hàng."],
      ] : [
        ["Metric definitions", "Link CPC uses spend ÷ link clicks; active outcome cost uses spend ÷ the tracked KPI-pack outcome."],
        ["Data sufficiency", "Leakage requires at least 100 link clicks and downstream events."],
        ["Comparison logic", "Rows are matched by entity ID before period movement is attributed."],
        ["Pack detection", "The selected pack may differ from the auto-detected pack."],
        ["Provider assumptions", "Local deterministic diagnostics remain available without an AI provider."],
        ["Known limitations", "Raw attributed revenue is not stored; ROAS appears only when purchase tracking is available."],
      ])
    : (isVietnamese ? [
        ["Định nghĩa chỉ số", "Mỗi chỉ số kết quả và hiệu quả tuân theo KPI pack hiện tại cùng ánh xạ action Meta đã chuẩn hóa."],
        ["Mức đủ dữ liệu", "Giá trị không khả dụng vẫn được ghi là chưa theo dõi; giao diện không đổi dữ liệu thiếu thành số 0."],
      ] : [
        ["Metric definitions", "Each result and efficiency metric follows the active KPI pack and normalized Meta action mapping."],
        ["Data sufficiency", "Unavailable values remain unavailable; the interface never converts missing tracking into zero."],
      ]);
  const diagnostics = healthSummary?.items || report.health.checks.map((check) => {
    const vietnamese = localizeHealthCheck(check, "vi");
    return {
      id: `health-${check.id}`,
      severity: check.status === "fail" ? "danger" as const : check.status === "warning" ? "warning" as const : "healthy" as const,
      title: { en: check.label, vi: vietnamese.label },
      detail: { en: check.detail, vi: vietnamese.detail },
    };
  });
  const healthyCount = healthSummary?.counts.healthy ?? report.health.checks.filter((item) => item.status === "pass").length;
  const issueCount = healthSummary
    ? healthSummary.counts.danger + healthSummary.counts.warning
    : report.health.checks.filter((item) => item.status !== "pass").length;
  const healthSeverity = healthSummary?.severity
    ?? (report.health.checks.some((item) => item.status === "fail") ? "danger" : report.health.checks.some((item) => item.status === "warning") ? "warning" : "healthy");
  const packDetail = report.selectedPack === report.detectedPack
    ? (isVietnamese ? "Tự nhận diện · có thể chỉnh" : "Auto-detected · editable")
    : (isVietnamese ? `Đã chọn thủ công · tự nhận diện ${packLabel(report.detectedPack, language)}` : `Manual override · detected ${packLabel(report.detectedPack, language)}`);
  const sourceDetail = report.source === "sample"
    ? (isVietnamese ? "Dữ liệu minh họa · không phải evidence Meta trực tiếp" : "Illustrative data · not live Meta evidence")
    : (isVietnamese ? "Dữ liệu account có thể truy vết" : "Traceable account data");

  React.useEffect(() => setAllRowsVisible(false), [level, report]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard eyebrow={isVietnamese ? "Nguồn" : "Source"} title={report.source === "sample" ? (isVietnamese ? "Dữ liệu mẫu" : "Sample data") : "Meta API"} detail={sourceDetail} tone={report.source === "sample" ? "warning" : "success"} />
        <SignalCard eyebrow={isVietnamese ? "Độ mới" : "Freshness"} title={relativeTime(report.pulledAt, language)} detail={new Date(report.pulledAt).toLocaleString(isVietnamese ? "vi-VN" : "en-US")} tone="success" />
        <SignalCard eyebrow="KPI pack" title={packLabel(report.selectedPack, language)} detail={packDetail} tone="primary" />
        <SignalCard eyebrow={isVietnamese ? "Sức khỏe" : "Health"} title={`${healthSummary?.score ?? report.health.score} / 100`} detail={isVietnamese ? `${healthyCount} đạt · ${issueCount} cần xem` : `${healthyCount} pass · ${issueCount} to review`} tone={healthSeverity === "healthy" ? "success" : healthSeverity === "danger" ? "danger" : "warning"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.72fr)]">
        <div className="v2-panel overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="v2-section-title">{isVietnamese ? "Evidence hiệu quả thô" : "Raw performance evidence"}</h2><p className="v2-section-copy">{isVietnamese ? "Mọi kết luận đều có thể truy về hàng Meta đã chuẩn hóa." : "Every conclusion remains traceable to normalized Meta rows."}</p></div><Button type="button" variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event("v2:open-custom-chart"))}><FileChartColumnIncreasingIcon data-icon="inline-start" />{isVietnamese ? "Biểu đồ tùy chỉnh" : "Custom chart"}</Button></div>
          <div className="mt-4 flex gap-1 border-b border-border">
            {(["campaign", "adset", "ad", "daily"] as const).map((value) => <button key={value} type="button" className={cn("border-b-2 px-3 py-2 text-xs capitalize", level === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground")} onClick={() => setLevel(value)}>{value === "adset" ? "Ad sets" : value === "ad" ? "Ads" : value === "daily" ? (isVietnamese ? "Ngày" : "Daily") : (isVietnamese ? "Campaign" : "Campaigns")}</button>)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.05em] text-muted-foreground"><tr><th className="py-3 font-medium">{isVietnamese ? "Đối tượng" : "Entity"}</th><th className="py-3 font-medium">{isVietnamese ? "Chi tiêu" : "Spend"}</th><th className="py-3 font-medium">{isVietnamese ? "Lượt hiển thị" : "Impressions"}</th><th className="py-3 font-medium">{isVietnamese ? "Click link" : "Link clicks"}</th><th className="py-3 font-medium">{primaryLabel(report.selectedPack, language)}</th><th className="py-3 font-medium">{costLabel}</th><th className="py-3 font-medium">ROAS</th></tr></thead>
              <tbody>{visibleRows.map((row) => <tr key={`${row.id}-${row.date || ""}`} className="border-b border-border/55 last:border-0"><td className="py-3 pr-4"><div className="font-medium">{level === "daily" ? row.date : row.name}</div><div className="mt-0.5 text-muted-foreground">{entityLevelLabel(row.level, language)} · {row.date || (isVietnamese ? "Đang hoạt động" : "Active")}</div></td><td className="py-3 pr-4 tabular-nums">{currencyValue(row.spend, currency)}</td><td className="py-3 pr-4 tabular-nums">{compact(row.impressions)}</td><td className="py-3 pr-4 tabular-nums">{compact(row.linkClicks)}</td><td className="py-3 pr-4 tabular-nums">{compact(Number(row[primaryKey] || 0))}</td><td className="py-3 pr-4 tabular-nums">{primaryRowCost(row, report.selectedPack, currency)}</td><td className="py-3 tabular-nums">{trackedOutcomeValue(row, "purchases", row.roas.toFixed(1), language)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">{visibleRows.length}/{rows.length} {isVietnamese ? "hàng đang hiển thị" : "rows shown"} · {report.account.currency || "VND"} · {report.account.timezone_name || (isVietnamese ? "múi giờ tài khoản" : "account timezone")}</div>
            {rows.length > 8 ? <Button type="button" variant="ghost" size="sm" onClick={() => setAllRowsVisible((current) => !current)}>{allRowsVisible ? (isVietnamese ? "Thu gọn" : "Show less") : (isVietnamese ? `Hiện tất cả ${rows.length}` : `Show all ${rows.length}`)}</Button> : null}
          </div>
        </div>

        <div className="v2-panel p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="v2-section-title">{isVietnamese ? "Chẩn đoán" : "Diagnostics"}</h2><Badge variant="outline">{issueCount} {isVietnamese ? "cần xem" : "to review"}</Badge></div>
          <div className="mt-4 flex flex-col gap-4">
            {diagnostics.slice(0, 5).map((check) => <div key={check.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5">{check.severity === "healthy" ? <CheckCircle2Icon className="mt-0.5 size-4 text-success" /> : check.severity === "danger" ? <ShieldAlertIcon className="mt-0.5 size-4 text-destructive" /> : <TriangleAlertIcon className="mt-0.5 size-4 text-warning" />}<div><div className="text-sm font-medium">{check.title[language]}</div><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{check.detail[language]}</p></div></div>)}
          </div>
          <div className="mt-5 border-t border-border pt-4"><div className="text-sm font-medium">{isVietnamese ? "Nguồn gốc dữ liệu" : "Data provenance"}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{isVietnamese ? "Meta Marketing API · hàng account, campaign, ad set, ad, ngày và breakdown. Kết quả từ provider không thay thế evidence nguồn." : "Meta Marketing API · account, campaign, ad set, ad, daily and breakdown rows. Provider output never replaces source evidence."}</p></div>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {methodologyItems.map(([label, detail]) => <div key={label} className="py-3"><div className="text-xs font-medium">{label}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></div>)}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setMethodologyOpen((value) => !value)}>{methodologyOpen ? (isVietnamese ? "Thu gọn phương pháp" : "Collapse methodology") : (isVietnamese ? "Xem đầy đủ phương pháp" : "Full methodology")}</Button>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(report.prompt); toast.success(isVietnamese ? "Đã sao chép evidence" : "Evidence copied", { description: isVietnamese ? "Phạm vi, phương pháp và nhãn dữ liệu thiếu hiện tại đã được bao gồm." : "The active scope, methodology and missing-data labels are included." }); }}><ClipboardListIcon data-icon="inline-start" />{isVietnamese ? "Sao chép evidence" : "Copy evidence"}</Button><Button type="button" size="sm" onClick={() => window.dispatchEvent(new Event("v2:open-export"))}><DownloadIcon data-icon="inline-start" />{isVietnamese ? "Xuất báo cáo" : "Export report"}</Button></div>
        </div>
      </div>
    </div>
  );
}

function StageGrid({ stages, language, large = false, onSelect }: { stages: Stage[]; language: InterfaceLanguage; large?: boolean; onSelect?: (stage: Stage) => void }) {
  const columns = stages.length === 2 ? "xl:grid-cols-2" : stages.length === 3 ? "xl:grid-cols-3" : stages.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-5";
  return (
    <div className={cn("mt-4 grid gap-2 sm:grid-cols-2", columns)}>
      {stages.map((stage) => {
        const content = <>
          {stage.tone === "warning" ? <span className="absolute inset-x-0 top-0 h-0.5 bg-warning" /> : null}
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{stage.label}</span><Badge variant={stage.tone === "success" ? "success" : stage.tone === "warning" ? "outline" : "secondary"}>{stage.statusLabel}</Badge></div>
          <div className="mt-3 flex items-end gap-2"><span className="text-lg font-semibold tabular-nums">{stage.value === null ? (language === "vi" ? "Chưa theo dõi" : "Not tracked") : compact(stage.value)}</span>{stage.value === null ? null : <span className="pb-0.5 text-[10px] text-muted-foreground">{stage.unit}</span>}</div>
          <div className="mt-2 text-xs">{stage.efficiency}</div>
          <div className={cn("mt-1 text-[11px]", stage.tone === "warning" ? "text-warning" : stage.tone === "success" ? "text-success" : "text-primary")}>{stage.movement}</div>
        </>;
        const className = cn("v2-subtle-panel relative overflow-hidden p-3 text-left", large && "min-h-32", stage.tone === "warning" && "border-warning/70", onSelect && "cursor-pointer transition-colors hover:border-primary/60 hover:bg-primary/5");
        return onSelect
          ? <button key={stage.key} type="button" onClick={() => onSelect(stage)} className={className}>{content}</button>
          : <div key={stage.key} className={className}>{content}</div>;
      })}
    </div>
  );
}

function TrendPanel({ language, report, primary, embedded = false, overview = false }: { language: InterfaceLanguage; report: DashboardReport; primary: ReturnType<typeof primaryResult>; embedded?: boolean; overview?: boolean }) {
  const isVietnamese = language === "vi";
  const data = report.dailyRows.map((row) => ({
    date: row.date?.slice(5) || "",
    value: Number(row[primary.key] || 0),
    efficiency: primary.costKey ? Number(row[primary.costKey] || 0) : row.cpc,
  }));
  const gradientId = React.useId().replace(/:/g, "");
  const chart = !data.length ? <div className="plain-empty">{isVietnamese ? "Chưa có dữ liệu theo ngày" : "Daily trend unavailable"}</div> : (
    <div className={overview ? "plain-volume-chart" : "h-48 w-full"}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 780, height: 192 }}>
        <AreaChart data={data} margin={{ top: 12, right: 4, left: overview ? 0 : -24, bottom: 0 }}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={overview ? "var(--plain-chart)" : "var(--primary)"} stopOpacity={0.2} /><stop offset="100%" stopColor={overview ? "var(--plain-chart)" : "var(--primary)"} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="var(--border)" vertical={overview} horizontal={!overview} strokeOpacity={0.4} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="value" orientation={overview ? "right" : "left"} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="efficiency" orientation="right" hide />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
            formatter={(value, name) => [name === "efficiency" ? currencyValue(Number(value), report.account.currency || "VND") : compact(Number(value)), name === "efficiency" ? primary.costLabel : primary.label]}
          />
          <Area yAxisId="value" type="monotone" dataKey="value" fill={`url(#${gradientId})`} stroke={overview ? "var(--plain-chart)" : "var(--primary)"} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Area yAxisId="efficiency" type="monotone" dataKey="efficiency" fill="none" stroke={overview ? "var(--plain-chart-secondary)" : "var(--warning)"} strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
  if (embedded) return chart;
  return (
    <div className="v2-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="v2-section-title">{isVietnamese ? "Kết quả chính + hiệu quả" : "Primary result + efficiency"}</h2><p className="v2-section-copy">{isVietnamese ? "Kết quả và chi phí trên cùng một trục thời gian." : "Result volume and cost movement on one timeline."}</p></div><Badge variant="secondary">{primary.label}</Badge></div>
      <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-primary" />{primary.label}</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-warning" />{primary.costLabel}</span></div>
      <div className="mt-2">{chart}</div>
    </div>
  );
}

function SignalCard({ eyebrow, title, detail, tone }: { eyebrow: string; title: string; detail: string; tone: "success" | "warning" | "danger" | "primary" }) {
  return (
    <div className="v2-panel min-w-0 p-4">
      <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{eyebrow}</span><span className={cn("size-1.5 rounded-full", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-destructive" : "bg-primary")} /></div>
      <div className="mt-3 truncate text-sm font-semibold" title={title}>{title}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold tabular-nums">{value}</div></div>;
}

function primaryResult(report: DashboardReport, language: InterfaceLanguage) {
  const isVietnamese = language === "vi";
  if (report.selectedPack === "sales_roas") return { key: "purchases" as keyof NormalizedRow, costKey: "cpaPurchase" as keyof NormalizedRow, label: isVietnamese ? "Mua hàng" : "Purchases", costLabel: "CPA", decision: isVietnamese ? "Bảo vệ ngân sách. Xử lý điểm rò rỉ trước khi scale." : "Protect budget. Fix the weakest conversion step before scaling." };
  if (report.selectedPack === "messages") return { key: "messages" as keyof NormalizedRow, costKey: "costPerMessage" as keyof NormalizedRow, label: isVietnamese ? "Tin nhắn" : "Messages", costLabel: "Cost / message", decision: isVietnamese ? "Bảo vệ chất lượng hội thoại trước khi tăng delivery." : "Protect conversation quality before increasing delivery." };
  if (report.selectedPack === "lead_gen") return { key: "leads" as keyof NormalizedRow, costKey: "cpl" as keyof NormalizedRow, label: "Leads", costLabel: "CPL", decision: isVietnamese ? "Giữ volume lead, xử lý nguồn chất lượng thấp trước khi scale." : "Hold lead volume. Fix the lowest-quality source before scaling." };
  if (report.selectedPack === "traffic") return { key: "linkClicks" as keyof NormalizedRow, costKey: "cpc" as keyof NormalizedRow, label: isVietnamese ? "Click link" : "Link clicks", costLabel: "CPC", decision: isVietnamese ? "Giảm CPC nhưng không đánh đổi chất lượng traffic." : "Reduce CPC without trading away traffic quality." };
  return { key: "reach" as keyof NormalizedRow, costKey: "cpm" as keyof NormalizedRow, label: isVietnamese ? "Tiếp cận" : "Reach", costLabel: "CPM", decision: isVietnamese ? "Mở rộng reach trong khi giữ frequency dưới ngưỡng fatigue." : "Expand reach while keeping frequency below fatigue risk." };
}

function stageValue(stage: Stage, language: InterfaceLanguage) {
  return stage.value === null ? (language === "vi" ? "Chưa theo dõi" : "Not tracked") : `${compact(stage.value)} ${stage.unit}`;
}

function stageContributorLabel(basis: keyof NormalizedRow, language: InterfaceLanguage) {
  const labels: Partial<Record<keyof NormalizedRow, Record<InterfaceLanguage, string>>> = {
    spend: { en: "spend", vi: "chi tiêu" },
    reach: { en: "reach", vi: "tiếp cận" },
    impressions: { en: "impressions", vi: "lượt hiển thị" },
    linkClicks: { en: "link clicks", vi: "click link" },
    addToCart: { en: "add to carts", vi: "lượt thêm giỏ" },
    initiateCheckout: { en: "checkouts", vi: "lượt checkout" },
    purchases: { en: "purchases", vi: "mua hàng" },
    leads: { en: "leads", vi: "lead" },
    messages: { en: "conversations", vi: "hội thoại" },
    replies: { en: "replies", vi: "phản hồi" },
    frequency: { en: "frequency", vi: "tần suất" },
  };
  return labels[basis]?.[language] || String(basis);
}

function stageContributorDetail(row: NormalizedRow, basis: keyof NormalizedRow, currency: string, language: InterfaceLanguage) {
  const label = stageContributorLabel(basis, language);
  if (basis === "spend") return `${label} ${currencyValue(row.spend, currency)} · CTR ${row.ctr.toFixed(2)}%`;
  const value = basis === "frequency" ? Number(row.frequency || 0).toFixed(1) : compact(Number(row[basis] || 0));
  return `${label} ${value} · ${language === "vi" ? "chi tiêu" : "spend"} ${currencyValue(row.spend, currency)}`;
}

function entityLevelLabel(level: NormalizedRow["level"], language: InterfaceLanguage) {
  if (language === "en") return level === "daily" ? "Day" : level === "adset" ? "Ad set" : level === "ad" ? "Ad" : level === "campaign" ? "Campaign" : "Account";
  return level === "daily" ? "Ngày" : level === "adset" ? "Ad set" : level === "ad" ? "Quảng cáo" : level === "campaign" ? "Campaign" : "Tài khoản";
}

function formatKpi(report: DashboardReport, kpi: KpiCard, currency: string) {
  if (kpi.key === "healthScore") return `${report.health.score}/100`;
  return formatMetric(Number(report.totals[kpi.key] || 0), kpi.format, currency);
}

function tabLabel(tab: (typeof tabValues)[number], language: InterfaceLanguage) {
  const labels = { overview: { en: "Overview", vi: "Tổng quan" }, funnel: { en: "Funnel", vi: "Phễu" }, drivers: { en: "Drivers", vi: "Động lực" }, setup: { en: "Setup", vi: "Thiết lập" }, creatives: { en: "Creatives", vi: "Creative" }, evidence: { en: "Evidence", vi: "Evidence" } };
  return labels[tab][language];
}

function comparisonLabel(mode: CompareMode, language: InterfaceLanguage) {
  if (mode === "off") return language === "vi" ? "Không so sánh" : "No comparison";
  if (mode === "campaign") return language === "vi" ? "Nhóm campaign" : "Campaign group";
  return language === "vi" ? "Kỳ trước" : "Previous period";
}

function resultKey(pack: DashboardReport["selectedPack"]): keyof NormalizedRow {
  if (pack === "sales_roas") return "purchases";
  if (pack === "messages") return "messages";
  if (pack === "lead_gen") return "leads";
  if (pack === "traffic") return "linkClicks";
  return "reach";
}

function primaryLabel(pack: DashboardReport["selectedPack"], language: InterfaceLanguage) {
  if (pack === "sales_roas") return language === "vi" ? "Mua hàng" : "Purchases";
  if (pack === "messages") return language === "vi" ? "Tin nhắn" : "Messages";
  if (pack === "lead_gen") return "Leads";
  if (pack === "traffic") return language === "vi" ? "Click link" : "Link clicks";
  return language === "vi" ? "Tiếp cận" : "Reach";
}

function rowEfficiency(row: NormalizedRow, key: keyof NormalizedRow) {
  const result = Number(row[key] || 0);
  return result > 0 ? result / Math.max(row.spend, 1) : 0;
}

function contributionScore(row: NormalizedRow, key: keyof NormalizedRow) {
  return Number(row[key] || 0) * 0.7 + row.spend * 0.000001 * 0.3;
}

function primaryRowCost(row: NormalizedRow, pack: DashboardReport["selectedPack"], currency: string) {
  if (pack === "sales_roas") return currencyValue(row.cpaPurchase, currency);
  if (pack === "messages") return currencyValue(row.costPerMessage, currency);
  if (pack === "lead_gen") return currencyValue(row.cpl, currency);
  if (pack === "traffic") return currencyValue(row.cpc, currency);
  return currencyValue(row.cpm, currency);
}

function downloadRowsCsv(rows: NormalizedRow[], filename: string) {
  const headers = ["name", "campaignName", "adsetName", "level", "spend", "impressions", "reach", "linkClicks", "ctr", "cpc", "cpm", "frequency", "leads", "messages", "purchases", "cpaPurchase", "roas"] as const;
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function packLabel(pack: DashboardReport["selectedPack"], language: InterfaceLanguage) {
  if (pack === "sales_roas") return "Sales · ROAS";
  if (pack === "lead_gen") return language === "vi" ? "Tạo lead" : "Lead generation";
  if (pack === "messages") return language === "vi" ? "Tin nhắn" : "Messages";
  if (pack === "traffic") return language === "vi" ? "Lưu lượng" : "Traffic";
  return language === "vi" ? "Nhận diện" : "Awareness";
}

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
}

function currencyValue(value: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency || "VND", notation: "compact", maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
}

function relativeTime(value: string, language: InterfaceLanguage) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return language === "vi" ? "Vừa xong" : "Just now";
  if (minutes < 60) return `${minutes} ${language === "vi" ? "phút trước" : "min ago"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${language === "vi" ? "giờ trước" : "hr ago"}`;
}
