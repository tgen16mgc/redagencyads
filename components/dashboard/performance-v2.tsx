"use client";

import * as React from "react";
import { analyticsNumber, selectAnalyticsRows } from "@/lib/analytics-table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  DownloadIcon,
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
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FATIGUE_FREQUENCY_THRESHOLD, buildCreativeSignals } from "@/lib/creative-signals";
import type { HealthScoreSummary } from "@/lib/health-score";
import type { ClientReportPdfFile } from "@/lib/client-report";
import { formatComparisonChangePct, metricMovementIsBad, type MetricComparisonDelta } from "@/lib/metric-comparison";
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
    <section className="flex flex-col gap-4" data-current-report-scope data-account-id={report.account.id} data-campaign-ids={selectedCampaignIds.join(",")} data-since={since} data-until={until} data-compare-mode={compareMode} data-comparison-campaign-ids={previousReport?.selectedCampaigns.map((campaign) => campaign.id).join(",") || ""} data-comparison-since={previousReport?.dateRange.since || ""} data-comparison-until={previousReport?.dateRange.until || ""}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-[28px]">
            {isVietnamese ? "Điều gì cần thay đổi tiếp theo?" : "Performance"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isVietnamese ? "Theo dõi chi tiêu từ lượt tiếp cận đến kết quả, rồi xử lý điểm nghẽn lớn nhất." : "Review results, compare periods, and inspect spend."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" data-edit-report-scope variant="outline" size="sm" onClick={onEditScope} disabled={reportLoading}>
            <SlidersHorizontalIcon data-icon="inline-start" />
            {isVietnamese ? "Sửa phạm vi" : "Edit scope"}
          </Button>

        </div>
      </div>

      {compareMode !== "off" && !previousReport ? <p role="status" className="text-sm text-muted-foreground">{isVietnamese ? "Chưa có dữ liệu so sánh. Chỉ hiển thị kỳ hiện tại." : "Comparison data is unavailable. Showing the current period only."}</p> : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof tabValues)[number])}>
        <div className="flex flex-col gap-3 border-b border-border pb-3 xl:flex-row xl:items-center xl:justify-between">
          <ScrollShadow hideScrollBar orientation="horizontal" size={28} className="w-full min-w-0 xl:max-w-[430px]">
            <TabsList className="h-auto min-w-max justify-start rounded-none bg-transparent p-0">
              {tabValues.filter((value) => value !== "setup" && value !== "creatives").map((value) => (
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
  return (
    <div className="grid min-w-0 gap-5">
      <div className="analytics-kpis">
        {[{ key: "spend", label: isVietnamese ? "Chi tiêu" : "Spend", format: "currency" } as KpiCard, ...effectiveKpis.filter((kpi) => kpi.key !== "healthScore" && kpi.key !== "spend")].slice(0, 6).map((kpi) => <MetricTile key={kpi.key} label={kpi.label} value={formatKpi(report, kpi, currency)} tone="primary" comparison={kpi.key === "healthScore" ? undefined : kpiComparisons?.get(kpi.key)} />)}
      </div>
      <TrendPanel language={language} report={report} primary={primary} />
      <EvidenceTab language={language} report={report} healthSummary={healthSummary} currency={currency} />
    </div>
  );
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
  const vi = language === "vi";
  const [level, setLevel] = React.useState<"campaign" | "adset" | "ad" | "daily">("campaign");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [waste, setWaste] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<keyof NormalizedRow>("spend");
  const [direction, setDirection] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(0);
  const key = resultKey(report.selectedPack);
  const source = level === "campaign" ? report.campaignRows : level === "adset" ? report.adsetRows : level === "ad" ? report.adRows : report.dailyRows;
  const selected = source.find((row) => row.id === selectedId);
  React.useEffect(() => setSelectedId(null), [level, report]);
  const rows = selectAnalyticsRows(source, query, key, waste, sortKey, direction);
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const currentPage = Math.min(page, pages - 1);
  const visible = rows.slice(currentPage * 25, (currentPage + 1) * 25);
  React.useEffect(() => setPage(0), [level, query, waste, sortKey, direction, report]);
  const columns: [keyof NormalizedRow, string][] = [[level === "daily" ? "date" : "name", vi ? "Tên" : "Name"], ["spend", vi ? "Chi tiêu" : "Spend"], ["impressions", "Impressions"], ["linkClicks", "Link clicks"], [key, primaryLabel(report.selectedPack, language)], ["roas", "ROAS"]];
  const issues = healthSummary?.items.filter((item) => item.severity !== "healthy") || [];
  return <section className="v2-panel min-w-0" aria-label={vi ? "Bảng hiệu quả" : "Performance table"}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <h2 className="v2-section-title">{vi ? "Chi tiết hiệu quả" : "Performance details"}</h2>
      <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadRowsCsv(rows, `meta-${level}.csv`)}>Export CSV</Button>
    </div>
    <div className="flex flex-wrap gap-1 border-b border-border px-4" role="group" aria-label="Entity level">
      {(["campaign", "adset", "ad", "daily"] as const).map((value) => <button key={value} type="button" aria-pressed={level === value} className={cn("border-b-2 px-3 py-3 text-xs", level === value ? "border-primary font-semibold" : "border-transparent text-muted-foreground")} onClick={() => setLevel(value)}>{({ campaign: "Campaigns", adset: "Ad sets", ad: "Ads", daily: "Daily" })[value]}</button>)}
    </div>
    <div className="flex flex-wrap items-center gap-4 p-4">
      <Input className="max-w-sm" aria-label="Search entities" placeholder={vi ? "Tìm tên hoặc ID…" : "Search name or ID…"} value={query} onChange={(event) => setQuery(event.target.value)} />
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={waste} onChange={(event) => setWaste(event.target.checked)} />{vi ? "Chi tiêu không có kết quả" : "Spend without results"}</label>
      <span className="text-xs text-muted-foreground">{rows.length} {vi ? "hàng" : "rows"}</span>
    </div>
    {selected ? <aside className="mx-4 mb-4 border border-border p-4" aria-label="Entity details">
      <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">{selected.name}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{selected.id}</p></div><Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>Close</Button></div>
      <p className="mt-2 text-xs text-muted-foreground">{[selected.campaignName, selected.adsetName].filter(Boolean).join(" / ")}</p>
      <div className="mt-3 flex flex-wrap gap-5 text-xs"><span>CTR: {analyticsNumber(selected.ctr)}%</span><span>Frequency: {analyticsNumber(selected.frequency)}</span><span>Reach: {analyticsNumber(selected.reach)}</span></div>
      {level === "campaign" || level === "adset" ? <Button className="mt-3" size="sm" variant="outline" onClick={() => { setQuery(selected.id); setLevel(level === "campaign" ? "adset" : "ad"); }}>View {level === "campaign" ? "ad sets" : "ads"}</Button> : null}
    </aside> : null}
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable performance data">
      <table className="analytics-table w-full min-w-[760px] text-xs">
        <thead><tr>{columns.map(([field, label]) => <th key={field} aria-sort={sortKey === field ? direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => { setSortKey(field); setDirection(sortKey === field && direction === "desc" ? "asc" : "desc"); }}>{label}{sortKey === field ? direction === "asc" ? " ↑" : " ↓" : ""}</button></th>)}<th>{evidenceCostLabel(report.selectedPack, language)}</th></tr></thead>
        <tbody>{visible.map((row) => <tr key={`${row.id}-${row.date || ""}`}><td><button type="button" className="max-w-[320px] truncate text-left font-medium hover:underline" title={row.name} aria-expanded={selectedId === row.id} onClick={() => setSelectedId(selectedId === row.id ? null : row.id)}>{level === "daily" ? row.date : row.name}</button><div className="mt-1 max-w-[320px] truncate text-muted-foreground">{level === "daily" ? "" : row.id}</div></td><td>{analyticsNumber(row.spend, currency)}</td><td>{analyticsNumber(row.impressions)}</td><td>{analyticsNumber(row.linkClicks)}</td><td>{(row.metricAvailability as Record<string, string> | undefined)?.[key] === "not_tracked" ? (vi ? "Chưa theo dõi" : "Not tracked") : analyticsNumber(Number(row[key]))}</td><td>{trackedOutcomeValue(row, "purchases", Number.isFinite(row.roas) ? `${row.roas.toFixed(2)}x` : "—", language)}</td><td>{Number(row[key]) > 0 ? primaryRowCost(row, report.selectedPack, currency) : "—"}</td></tr>)}</tbody>
      </table>
      {!visible.length ? <p className="p-8 text-center text-sm text-muted-foreground" role="status">{vi ? "Không có hàng phù hợp với bộ lọc." : "No rows match these filters."}</p> : null}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3 text-xs text-muted-foreground">
      <span>{currency} · {report.account.timezone_name || "Account timezone"} · {report.source === "sample" ? "Sample data" : "Meta Marketing API"}</span>
      <div className="flex items-center gap-3"><Button size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>{currentPage + 1} / {pages}</span><Button size="sm" variant="ghost" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
    </div>
    {issues.length ? <details className="border-t border-border p-4"><summary className="cursor-pointer text-xs font-medium">{issues.length} {vi ? "kiểm tra cần xem" : "diagnostic checks to review"}</summary><div className="mt-3 divide-y divide-border">{issues.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">{item.title[language]}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail[language]}</p></div>)}</div></details> : null}
  </section>;
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

function TrendPanel({ language, report, primary, embedded = false }: { language: InterfaceLanguage; report: DashboardReport; primary: ReturnType<typeof primaryResult>; embedded?: boolean }) {
  const isVietnamese = language === "vi";
  const data = [...report.dailyRows].sort((a, b) => (a.date || "").localeCompare(b.date || "")).map((row) => ({
    date: row.date?.slice(5) || "",
    value: Number.isFinite(Number(row[primary.key])) ? Number(row[primary.key]) : null,
    efficiency: Number(row[primary.key]) > 0 && Number.isFinite(Number(row[primary.costKey])) ? (primary.costKey ? Number(row[primary.costKey]) : row.cpc) : null,
  }));
  const chart = (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 780, height: 192 }}>
        <LineChart data={data} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} strokeOpacity={0.75} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="value" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="efficiency" orientation="right" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12 }}
            formatter={(value, name) => [name === "efficiency" ? currencyValue(Number(value), report.account.currency || "VND") : compact(Number(value)), name === "efficiency" ? primary.costLabel : primary.label]}
          />
          <Line yAxisId="value" type="linear" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line yAxisId="efficiency" type="linear" dataKey="efficiency" stroke="var(--warning)" strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </LineChart>
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

function MetricTile({ label, value, tone, comparison }: { label: string; value: string; tone: "success" | "warning" | "primary"; comparison?: MetricComparisonDelta }) {
  const comparisonBad = comparison ? metricMovementIsBad(comparison.key, comparison.change) : false;
  return <div className="v2-subtle-panel min-w-20 p-3"><div className="text-[9px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>{comparison ? <div className={cn("mt-1 text-[10px] font-medium", (comparison.change === 0 || comparison.key === "spend") ? "text-muted-foreground" : comparisonBad ? "text-warning" : "text-success")}>{comparison.change > 0 ? "↑ " : comparison.change < 0 ? "↓ " : "→ "}{formatComparisonChangePct(comparison.changePct)} <span className="font-normal">{comparison.descriptor}</span></div> : <div className={cn("mt-1 h-0.5 w-6 rounded-full", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary")} />}</div>;
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
  const availability = report.totals.metricAvailability as Record<string, string> | undefined;
  if (availability?.[kpi.key] === "not_tracked") return "Not tracked";
  const value = Number(report.totals[kpi.key]);
  if (!Number.isFinite(value)) return "—";
  if (kpi.format === "currency") return analyticsNumber(value, currency);
  if (kpi.format === "percent") return `${analyticsNumber(value)}%`;
  if (kpi.format === "ratio") return `${analyticsNumber(value)}x`;
  return analyticsNumber(value);
}

function tabLabel(tab: (typeof tabValues)[number], language: InterfaceLanguage) {
  const labels = { overview: { en: "Overview", vi: "Tổng quan" }, funnel: { en: "Funnel", vi: "Phễu" }, drivers: { en: "Drivers", vi: "Động lực" }, setup: { en: "Setup", vi: "Thiết lập" }, creatives: { en: "Creatives", vi: "Creative" }, evidence: { en: "Campaigns & ads", vi: "Chiến dịch & quảng cáo" } };
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
  const headers = ["id", "date", "name", "campaignName", "adsetName", "level", "spend", "impressions", "reach", "linkClicks", "ctr", "cpc", "cpm", "frequency", "leads", "messages", "purchases", "cpaPurchase", "roas"] as const;
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
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
}

function currencyValue(value: number, currency: string) {
  return analyticsNumber(value, currency);
}


function relativeTime(value: string, language: InterfaceLanguage) {
  if (!Number.isFinite(new Date(value).getTime())) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return language === "vi" ? "Vừa xong" : "Just now";
  if (minutes < 60) return `${minutes} ${language === "vi" ? "phút trước" : "min ago"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${language === "vi" ? "giờ trước" : "hr ago"}`;
}
