"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  ClipboardListIcon,
  DownloadIcon,
  FileChartColumnIncreasingIcon,
  GitCompareArrowsIcon,
  LayoutGridIcon,
  Layers3Icon,
  ListIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Label as HeroLabel, Switch as HeroSwitch } from "@heroui/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { inclusiveDays, isPeriodPreset } from "@/lib/period-scope";
import type { HealthScoreSummary } from "@/lib/health-score";
import type { ClientReportPdfFile } from "@/lib/client-report";
import { formatComparisonChangePct, metricMovementIsBad, type MetricComparisonDelta } from "@/lib/metric-comparison";
import { formatMetric } from "@/lib/metrics";
import { buildPerformanceStages, type PerformanceStage, type PerformanceStageKey } from "@/lib/performance-stages";
import { buildPlatformEfficiencyPoints } from "@/lib/segment-efficiency";
import { SAMPLE_CAMPAIGNS } from "@/lib/sample-report";
import type { AiInsightTable, CompareMode, DashboardReport, InterfaceLanguage, KpiCard, KpiPack, MetaCampaign, NormalizedRow, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ActionPlanSheet,
  CampaignScopeDialog,
  ComparisonDialog,
  CreativeComparisonDialog,
  EntityDetailSheet,
  ExportDiagnosisDialog,
  KpiPackDialog,
  PeriodScopeDialog,
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
  campaigns: MetaCampaign[];
  selectedCampaignIds: string[];
  since: string;
  until: string;
  pack: KpiPack | "auto";
  compareMode: CompareMode;
  funnelStageKeys: PerformanceStageKey[] | null;
  exporting: boolean;
  reviewing: boolean;
  reportLoading: boolean;
  customizeAction?: React.ReactNode;
  driversExtra?: React.ReactNode;
  creativesExtra?: React.ReactNode;
  evidenceExtra?: React.ReactNode;
  onEditScope: () => void;
  onRefresh: () => void;
  onExport: () => Promise<ClientReportPdfFile>;
  onReviewActions: () => void;
  onApplyScope: (patch: Partial<{ selectedCampaignIds: string[]; since: string; until: string; pack: KpiPack | "auto"; compareMode: CompareMode }>) => Promise<void>;
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
  campaigns,
  selectedCampaignIds,
  since,
  until,
  pack,
  compareMode,
  funnelStageKeys,
  exporting,
  reviewing,
  reportLoading,
  customizeAction,
  driversExtra,
  creativesExtra,
  evidenceExtra,
  onEditScope,
  onRefresh,
  onExport,
  onReviewActions,
  onApplyScope,
}: PerformanceV2Props) {
  const isVietnamese = language === "vi";
  const [activeTab, setActiveTab] = React.useState<(typeof tabValues)[number]>("overview");
  const [campaignsOpen, setCampaignsOpen] = React.useState(false);
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [comparisonOpen, setComparisonOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [actionPlanOpen, setActionPlanOpen] = React.useState(false);
  const [selectedStage, setSelectedStage] = React.useState<Stage | null>(null);
  const [selectedEntity, setSelectedEntity] = React.useState<NormalizedRow | null>(null);
  const [creativeComparisonOpen, setCreativeComparisonOpen] = React.useState(false);
  const [selectedCreativeIds, setSelectedCreativeIds] = React.useState<string[]>([]);
  const currency = report.account.currency || "VND";
  const scopeCampaigns = campaigns.length
    ? campaigns
    : report.account.id === "act_sample_demo"
      ? SAMPLE_CAMPAIGNS
      : report.campaignRows.map((row) => ({
          id: row.id,
          name: row.name,
          status: "ACTIVE",
          effective_status: "ACTIVE",
        }));
  const stages = buildPerformanceStages({ report, previousReport, compareMode, language, stageKeys: funnelStageKeys });
  const primary = primaryResult(report, language);
  const risks = healthSummary?.items.filter((item) => item.severity !== "healthy") || [];
  const inclusivePeriodDays = inclusiveDays({ since, until });
  const periodDays = isPeriodPreset(inclusivePeriodDays) ? inclusivePeriodDays : 0;
  const activeCampaignCount = scopeCampaigns.filter((campaign) => String(campaign.effective_status || campaign.status || "").toUpperCase() === "ACTIVE").length;
  const campaignComparisonAvailable = selectedCampaignIds.length > 0 && selectedCampaignIds.length < activeCampaignCount;

  const openActionPlan = React.useCallback(() => setActionPlanOpen(true), []);

  React.useEffect(() => {
    const openExport = () => setExportOpen(true);
    const refresh = () => onRefresh();
    window.addEventListener("v2:open-export", openExport);
    window.addEventListener("v2:refresh-report", refresh);
    return () => {
      window.removeEventListener("v2:open-export", openExport);
      window.removeEventListener("v2:refresh-report", refresh);
    };
  }, [onRefresh]);

  React.useEffect(() => {
    const availableIds = new Set(report.adRows.map((row) => row.id));
    setSelectedCreativeIds((current) => current.filter((id) => availableIds.has(id)).slice(0, 2));
  }, [report.adRows]);

  async function applyPeriod(range: { since: string; until: string }) {
    await onApplyScope(range);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-[28px]">
            {isVietnamese ? "Điều gì cần thay đổi tiếp theo?" : "What should change next?"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isVietnamese ? "Theo dõi chi tiêu từ lượt tiếp cận đến kết quả, rồi xử lý điểm nghẽn lớn nhất." : "Trace spend from reach to result, then fix the biggest constraint."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEditScope}>
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
        <div className="flex flex-col gap-3 border-b border-border pb-3 xl:flex-row xl:items-center xl:justify-between">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none bg-transparent p-0 xl:w-auto">
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

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {customizeAction}
            <button type="button" className="v2-subtle-panel max-w-[280px] truncate px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground" title={accountLabel} onClick={() => setCampaignsOpen(true)}><b className="font-medium text-foreground">Account:</b> {accountLabel}</button>
            <button type="button" className="v2-subtle-panel px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground" aria-label={`${isVietnamese ? "Đổi khoảng ngày" : "Change date range"}: ${periodLabel}`} onClick={() => setPeriodOpen(true)}><b className="font-medium text-foreground">{isVietnamese ? "Ngày:" : "Dates:"}</b> {periodLabel}</button>
            <button type="button" className="v2-subtle-panel flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground" onClick={() => setComparisonOpen(true)}><GitCompareArrowsIcon className="size-3.5" /><b className="font-medium text-foreground">{isVietnamese ? "So sánh:" : "Compare:"}</b> {comparisonLabel(compareMode)}</button>
            <button type="button" className="h-7" onClick={() => setKpiOpen(true)}><Badge variant="secondary" className="h-7">{isVietnamese ? "KPI:" : "KPI:"} {scopeLabel}</Badge></button>
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
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCwIcon data-icon="inline-start" />
          {isVietnamese ? "Làm mới" : "Refresh"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setExportOpen(true)} disabled={exporting}>
          <DownloadIcon data-icon="inline-start" />
          {exporting ? (isVietnamese ? "Đang xuất" : "Exporting") : (isVietnamese ? "Xuất báo cáo" : "Export report")}
        </Button>
      </div>

      <CampaignScopeDialog open={campaignsOpen} onOpenChange={setCampaignsOpen} campaigns={scopeCampaigns} selectedIds={selectedCampaignIds} currency={currency} busy={reportLoading} onApply={(ids) => onApplyScope({ selectedCampaignIds: ids })} />
      <PeriodScopeDialog open={periodOpen} onOpenChange={setPeriodOpen} currentDays={periodDays} since={since} until={until} busy={reportLoading} onApply={applyPeriod} />
      <KpiPackDialog open={kpiOpen} onOpenChange={setKpiOpen} current={pack} busy={reportLoading} onApply={(nextPack) => onApplyScope({ pack: nextPack })} />
      <ComparisonDialog open={comparisonOpen} onOpenChange={setComparisonOpen} current={compareMode} campaignComparisonAvailable={campaignComparisonAvailable} busy={reportLoading} onApply={(nextMode) => onApplyScope({ compareMode: nextMode })} />
      <ExportDiagnosisDialog open={exportOpen} onOpenChange={setExportOpen} report={report} accountLabel={accountLabel} periodLabel={periodLabel} exporting={exporting} onPreparePdf={onExport} />
      <ActionPlanSheet open={actionPlanOpen} onOpenChange={setActionPlanOpen} report={report} verdict={verdict} healthSummary={healthSummary} loading={reviewing} onGenerate={onReviewActions} onExport={() => setExportOpen(true)} />
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
  const decisionTitle = compactSentence(verdict?.verdict || primary.decision, 150);
  const actionRows = verdict ? [...verdict.budget_moves, ...verdict.tests].filter(Boolean).slice(0, 2) : risks.slice(0, 2).map((item) => item.detail[language]);
  const totalChecks = healthSummary?.items.length || report.health.checks.length;
  const passedChecks = healthSummary?.counts.healthy ?? report.health.checks.filter((check) => check.status === "pass").length;
  const blockingCount = healthSummary?.counts.danger ?? report.health.checks.filter((check) => check.status === "fail").length;
  const watchCount = healthSummary?.counts.warning ?? report.health.checks.filter((check) => check.status === "warning").length;
  const primaryRisk = risks[0];
  const constraintTitle = primaryRisk?.title[language] || (isVietnamese ? "Không có rào cản nghiêm trọng" : "No critical constraint detected");
  const constraintDetail = primaryRisk?.detail[language] || healthSummary?.summary[language] || report.packReason;
  const guardedAction = actionRows[0] || decisionTitle;

  return (
    <div className="grid gap-4">
      <div className="v2-primary-constraint" data-severity={blockingCount > 0 ? "danger" : watchCount > 0 ? "warning" : "healthy"}>
        <div className="v2-primary-constraint-main">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={blockingCount > 0 ? "destructive" : watchCount > 0 ? "outline" : "success"}>
              {blockingCount > 0 ? (isVietnamese ? "Rào cản chính" : "Primary constraint") : watchCount > 0 ? (isVietnamese ? "Ưu tiên rà soát" : "Review priority") : (isVietnamese ? "Không có blocker" : "No blocker")}
            </Badge>
            <span className="v2-primary-constraint-score">{healthSummary?.score ?? report.health.score}/100 health</span>
          </div>
          <h2>{constraintTitle}</h2>
          <p>{constraintDetail}</p>
          <div className="v2-primary-constraint-evidence">
            <span><b>{passedChecks}/{Math.max(totalChecks, 1)}</b>{isVietnamese ? " kiểm tra sức khỏe đạt" : " health checks passed"}</span>
            <span><b>{primary.label}</b>{isVietnamese ? " chỉ số kết quả chính" : " primary result metric"}</span>
            <span><b>{packLabel(report.selectedPack)}</b>{isVietnamese ? " bộ quy tắc KPI" : " KPI ruleset"}</span>
          </div>
          <button type="button" className="v2-primary-verdict" onClick={onReviewActions}>
            <span>{isVietnamese ? "Verdict hiện tại" : "Current Verdict"}</span>
            <strong>{decisionTitle}</strong>
            <ArrowRightIcon />
          </button>
        </div>

        <aside className="v2-primary-action">
          <span className="v2-primary-action-label">{isVietnamese ? "Hành động có guardrail" : "Guarded next action"}</span>
          <h3>{guardedAction}</h3>
          <p>{isVietnamese ? "Rà evidence trước khi áp dụng. Mọi thay đổi ngân sách đều bị giới hạn ở 20% mỗi bước." : "Review the evidence before applying it. Every budget change stays within the 20% per-step guardrail."}</p>
          <div className="v2-primary-action-guardrail"><ShieldAlertIcon /><span><b>20%</b>{isVietnamese ? " trần thay đổi ngân sách" : " budget-move ceiling"}</span></div>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <Button type="button" size="sm" onClick={onReviewActions}>{isVietnamese ? "Rà hành động" : "Review action"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={onOpenEvidence}>{isVietnamese ? "Mở evidence" : "Open evidence"}</Button>
          </div>
        </aside>

        <div className="v2-primary-metrics">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {effectiveKpis.map((kpi) => (
              <MetricTile
                key={kpi.key}
                label={kpi.label}
                value={formatKpi(report, kpi, currency)}
                tone={kpi.intent === "danger" ? "warning" : kpi.intent === "good" ? "success" : "primary"}
                comparison={kpi.key === "healthScore" ? undefined : kpiComparisons?.get(kpi.key)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="v2-panel p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="v2-section-title">{isVietnamese ? "Sức khỏe phễu" : "Funnel health"}</h2>
            <p className="v2-section-copy">{isVietnamese ? "Volume, chi phí và chuyển động theo kỳ — mở điểm rò rỉ để xem evidence." : "Stage rate, cost and period movement — open the highlighted leak for evidence."}</p>
          </div>
          <button type="button" className="text-xs font-medium text-primary" onClick={onOpenFunnel}>{isVietnamese ? "Mở phễu" : "Open funnel"}</button>
        </div>
        <StageGrid stages={stages} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)]">
        <TrendPanel language={language} report={report} primary={primary} />
        <div className="v2-panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="v2-section-title">{isVietnamese ? "Hành động đề xuất" : "Recommended actions"}</h2>
            <Badge variant="success">{actionRows.length} {isVietnamese ? "sẵn sàng" : "ready"}</Badge>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {actionRows.length ? actionRows.map((row, index) => (
              <div key={`${row}-${index}`}>
                <div className="text-sm font-medium">{index === 0 ? (isVietnamese ? "Xử lý rào cản chính" : "Address the primary constraint") : (isVietnamese ? "Bảo vệ lần scale tiếp theo" : "Protect the next scale move")}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{row}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">{isVietnamese ? "Tạo Verdict để nhận action plan có evidence." : "Generate a Verdict to get an evidence-backed action plan."}</p>
            )}
          </div>
          {insights?.rows?.[0] ? <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">{insights.rows[0].insight}</p> : null}
          <Button type="button" size="sm" className="mt-4 w-full" onClick={onReviewActions}>{isVietnamese ? "Mở action plan" : "Open action plan"}</Button>
        </div>
      </div>
    </div>
  );
}

function FunnelTab({ language, report, stages, currency, onOpenEvidence, onSelectStage }: { language: InterfaceLanguage; report: DashboardReport; stages: Stage[]; currency: string; onOpenEvidence: () => void; onSelectStage: (stage: Stage) => void }) {
  const isVietnamese = language === "vi";
  const leakStage = [...stages].reverse().find((stage) => stage.tone === "warning");
  const focusStage = leakStage || [...stages].reverse().find((stage) => stage.tone === "primary") || stages.at(-1)!;
  const hasLeak = Boolean(leakStage);
  const rows = [...report.adsetRows].sort((left, right) => right.spend - left.spend).slice(0, 3);

  return (
    <div className="grid gap-4">
      <div className="v2-panel p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="v2-section-title">{isVietnamese ? "Phễu thích ứng" : "Adaptive performance funnel"}</h2>
            <p className="v2-section-copy">{isVietnamese ? "Mỗi bước kết hợp volume với metric hiệu quả có thể hành động." : "Every stage pairs volume with the efficiency metric that can actually be acted on."}</p>
          </div>
          <Badge variant="secondary">{packLabel(report.selectedPack)}</Badge>
        </div>
        <StageGrid stages={stages} large onSelect={onSelectStage} />
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
            <ReportStat label={isVietnamese ? "Volume" : "Volume"} value={stageValue(focusStage)} />
            <ReportStat label={isVietnamese ? "Độ tin cậy" : "Confidence"} value={report.health.score >= 75 ? (isVietnamese ? "Cao" : "High") : (isVietnamese ? "Vừa" : "Medium")} />
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
          <div className="mt-4 flex flex-col gap-4">
            {rows.map((row) => (
              <div key={row.id}>
                <div className="text-sm font-medium">{row.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{currencyValue(row.spend, currency)} · CTR {row.ctr.toFixed(2)}% · {primaryRowCost(row, report.selectedPack, currency)}</div>
              </div>
            ))}
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
  const topShare = rows.reduce((sum, row) => sum + Number(row[primaryKey] || 0), 0);
  const segmentPoints = buildPlatformEfficiencyPoints(report.platformRows, primaryKey);
  const strongestSegment = [...segmentPoints].sort((left, right) => right.efficiency - left.efficiency)[0];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <SignalCard eyebrow={isVietnamese ? "Lực cản lớn nhất" : "Largest drag"} title={weakest?.name || "—"} detail={weakest ? `${currencyValue(weakest.spend, currency)} · ${primaryRowCost(weakest, report.selectedPack, currency)}` : "—"} tone="warning" />
        <SignalCard eyebrow={isVietnamese ? "Tăng trưởng mạnh nhất" : "Strongest gain"} title={strongest?.name || "—"} detail={strongest ? `${compact(Number(strongest[primaryKey] || 0))} ${primaryLabel(report.selectedPack, language)}` : "—"} tone="success" />
        <SignalCard eyebrow={isVietnamese ? "Tín hiệu quyết định" : "Decision signal"} title={`${Math.min(3, rows.length)} ${isVietnamese ? "hàng giải thích" : "rows explain"} ${topShare > 0 ? "most results" : "the spend"}`} detail={isVietnamese ? "Đủ dữ liệu khớp để hành động" : "Enough matching data to act"} tone="primary" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.72fr)]">
        <div className="v2-panel overflow-hidden p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="v2-section-title">{isVietnamese ? "Xếp hạng đóng góp entity" : "Entity contribution ranking"}</h2>
              <p className="v2-section-copy">{isVietnamese ? "Xếp theo đóng góp cho outcome chính." : "Ranked by contribution to the selected outcome."}</p>
            </div>
            <div className="flex items-center gap-2"><Badge variant="outline">{packLabel(report.selectedPack)}</Badge><Button type="button" variant="outline" size="sm" onClick={() => { downloadRowsCsv(rows, `performance-drivers-${report.dateRange.until}.csv`); toast.success("Driver CSV export started", { description: `${rows.length} ranked entities preserve the current KPI pack and scope.` }); }}><DownloadIcon data-icon="inline-start" />Export CSV</Button></div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                <tr><th className="pb-3 font-medium">Entity</th><th className="pb-3 font-medium">Spend</th><th className="pb-3 font-medium">CTR</th><th className="pb-3 font-medium">{primaryLabel(report.selectedPack, language)}</th><th className="pb-3 font-medium">Cost</th><th className="pb-3 font-medium">State</th></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/40" onClick={() => onSelectEntity(row)}>
                    <td className="py-3 pr-4"><button type="button" className="text-left"><div className="font-medium">{row.name}</div><div className="mt-0.5 text-muted-foreground">{row.campaignName || row.level}</div></button></td>
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
  const fatigueCount = rows.filter((row) => row.frequency >= 3).length;
  const concentration = rows.length ? (rows.slice(0, 2).reduce((sum, row) => sum + row.spend, 0) / Math.max(rows.reduce((sum, row) => sum + row.spend, 0), 1)) * 100 : 0;

  const visibleRows = showAll ? rows : rows.slice(0, 6);
  const hashedAssets = report.creativeHashing?.hashedAssets ?? rows.length;
  const totalAssets = report.creativeHashing?.totalAssets ?? rows.length;
  const concentrationStatus = concentration >= 65 ? (isVietnamese ? "Quá tập trung" : "Concentrated") : concentration >= 45 ? (isVietnamese ? "Cần theo dõi" : "Watch") : (isVietnamese ? "Cân bằng" : "Balanced");

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
        <SignalCard eyebrow={isVietnamese ? "Creative hiệu quả nhất" : "Best performer"} title={rows[0]?.name || "—"} detail={rows[0] ? `${primaryRowCost(rows[0], report.selectedPack, currency)} per result` : "No delivery"} tone="success" />
        <SignalCard eyebrow={isVietnamese ? "Cần làm mới" : "Needs refresh"} title={`${fatigueCount} / ${rows.length}`} detail={fatigueCount ? (isVietnamese ? "Frequency từ 3.0 trở lên" : "Frequency is 3.0 or higher") : (isVietnamese ? "Chưa thấy fatigue" : "No fatigue threshold reached")} tone={fatigueCount ? "warning" : "success"} />
        <SignalCard eyebrow={isVietnamese ? "Có thể xem preview" : "Preview available"} title={`${hashedAssets} / ${totalAssets}`} detail={hashedAssets === totalAssets ? (isVietnamese ? "Tất cả creative đều xem được" : "All creative previews are available") : (isVietnamese ? "Một số asset chưa có preview" : "Some assets have no returned preview")} tone={hashedAssets === totalAssets ? "success" : "primary"} />
        <SignalCard eyebrow={isVietnamese ? "Phân bổ chi tiêu" : "Spend distribution"} title={concentrationStatus} detail={`${concentration.toFixed(0)}% ${isVietnamese ? "nằm ở 2 creative đầu" : "is held by the top two creatives"}`} tone={concentration >= 65 ? "warning" : "primary"} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.48fr)]">
        <div className="v2-panel p-4 sm:p-5">
          <div className="flex flex-col gap-3"><div><h2 className="v2-section-title">{isVietnamese ? "Hiệu quả creative" : "Creative performance"}</h2><p className="v2-section-copy">{comparisonMode ? (isVietnamese ? "Chọn đúng hai creative để so sánh." : "Select exactly two creatives to compare.") : (isVietnamese ? "Chọn một creative để xem chi tiết. Bật so sánh khi cần." : "Choose one creative to inspect. Turn on compare mode only when needed.")}</p></div><div className="flex flex-wrap items-center gap-2">
            <HeroSwitch isSelected={comparisonMode} onChange={(next) => { setComparisonMode(next); if (!next) onSelectionChange([]); }} size="sm"><HeroSwitch.Control><HeroSwitch.Thumb /></HeroSwitch.Control><HeroLabel>{isVietnamese ? "Chế độ so sánh" : "Compare mode"}</HeroLabel></HeroSwitch>
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

  React.useEffect(() => setAllRowsVisible(false), [level, report]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard eyebrow={isVietnamese ? "Nguồn" : "Source"} title={report.source === "sample" ? (isVietnamese ? "Dữ liệu mẫu" : "Sample data") : "Meta API"} detail={isVietnamese ? "Dữ liệu account có thể truy vết" : "Traceable account data"} tone="success" />
        <SignalCard eyebrow={isVietnamese ? "Độ mới" : "Freshness"} title={relativeTime(report.pulledAt, language)} detail={new Date(report.pulledAt).toLocaleString()} tone="success" />
        <SignalCard eyebrow="KPI pack" title={packLabel(report.selectedPack)} detail={isVietnamese ? "Tự nhận diện · có thể chỉnh" : "Auto-detected · editable"} tone="primary" />
        <SignalCard eyebrow={isVietnamese ? "Sức khỏe" : "Health"} title={`${healthSummary?.score ?? report.health.score} / 100`} detail={`${report.health.checks.filter((item) => item.status === "pass").length} pass · ${report.health.checks.filter((item) => item.status !== "pass").length} warning`} tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.72fr)]">
        <div className="v2-panel overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="v2-section-title">{isVietnamese ? "Evidence hiệu quả thô" : "Raw performance evidence"}</h2><p className="v2-section-copy">{isVietnamese ? "Mọi kết luận đều có thể truy về hàng Meta đã chuẩn hóa." : "Every conclusion remains traceable to normalized Meta rows."}</p></div><Button type="button" variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event("v2:open-custom-chart"))}><FileChartColumnIncreasingIcon data-icon="inline-start" />{isVietnamese ? "Biểu đồ tùy chỉnh" : "Custom chart"}</Button></div>
          <div className="mt-4 flex gap-1 border-b border-border">
            {(["campaign", "adset", "ad", "daily"] as const).map((value) => <button key={value} type="button" className={cn("border-b-2 px-3 py-2 text-xs capitalize", level === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground")} onClick={() => setLevel(value)}>{value === "adset" ? "Ad sets" : value === "ad" ? "Ads" : value === "daily" ? (isVietnamese ? "Ngày" : "Daily") : (isVietnamese ? "Campaign" : "Campaigns")}</button>)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-[0.05em] text-muted-foreground"><tr><th className="py-3 font-medium">Entity</th><th className="py-3 font-medium">Spend</th><th className="py-3 font-medium">Impressions</th><th className="py-3 font-medium">Link clicks</th><th className="py-3 font-medium">{primaryLabel(report.selectedPack, language)}</th><th className="py-3 font-medium">CPA</th><th className="py-3 font-medium">ROAS</th></tr></thead>
              <tbody>{visibleRows.map((row) => <tr key={`${row.id}-${row.date || ""}`} className="border-b border-border/55 last:border-0"><td className="py-3 pr-4"><div className="font-medium">{level === "daily" ? row.date : row.name}</div><div className="mt-0.5 text-muted-foreground">{row.level} · {row.date || "Active"}</div></td><td className="py-3 pr-4 tabular-nums">{currencyValue(row.spend, currency)}</td><td className="py-3 pr-4 tabular-nums">{compact(row.impressions)}</td><td className="py-3 pr-4 tabular-nums">{compact(row.linkClicks)}</td><td className="py-3 pr-4 tabular-nums">{compact(Number(row[primaryKey] || 0))}</td><td className="py-3 pr-4 tabular-nums">{primaryRowCost(row, report.selectedPack, currency)}</td><td className="py-3 tabular-nums">{row.roas.toFixed(1)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">{visibleRows.length}/{rows.length} {isVietnamese ? "hàng đang hiển thị" : "rows shown"} · {report.account.currency || "VND"} · {report.account.timezone_name || "account timezone"}</div>
            {rows.length > 8 ? <Button type="button" variant="ghost" size="sm" onClick={() => setAllRowsVisible((current) => !current)}>{allRowsVisible ? (isVietnamese ? "Thu gọn" : "Show less") : (isVietnamese ? `Hiện tất cả ${rows.length}` : `Show all ${rows.length}`)}</Button> : null}
          </div>
        </div>

        <div className="v2-panel p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="v2-section-title">{isVietnamese ? "Chẩn đoán" : "Diagnostics"}</h2><Badge variant="outline">{report.health.checks.filter((item) => item.status !== "pass").length} {isVietnamese ? "cảnh báo" : "warnings"}</Badge></div>
          <div className="mt-4 flex flex-col gap-4">
            {report.health.checks.slice(0, 5).map((check) => <div key={check.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5">{check.status === "pass" ? <CheckCircle2Icon className="mt-0.5 size-4 text-success" /> : check.status === "fail" ? <ShieldAlertIcon className="mt-0.5 size-4 text-destructive" /> : <TriangleAlertIcon className="mt-0.5 size-4 text-warning" />}<div><div className="text-sm font-medium">{check.label}</div><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{check.detail}</p></div></div>)}
          </div>
          <div className="mt-5 border-t border-border pt-4"><div className="text-sm font-medium">{isVietnamese ? "Nguồn gốc dữ liệu" : "Data provenance"}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Meta Marketing API · account, campaign, ad set, ad, daily and breakdown rows. Provider output never replaces source evidence.</p></div>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {(methodologyOpen ? [
              ["Metric definitions", "Link CPC uses spend ÷ link clicks; CPA uses spend ÷ purchases."],
              ["Data sufficiency", "Leakage requires at least 100 link clicks and downstream events."],
              ["Comparison logic", "Rows are matched by entity ID before period movement is attributed."],
              ["Pack detection", "Selected pack is adaptive and may differ from the auto-detected pack."],
              ["Provider assumptions", "Local deterministic diagnostics remain available without an AI provider."],
              ["Known limitations", "Raw attributed revenue is not stored; ROAS is shown without fabricated revenue."],
            ] : [
              ["Metric definitions", "Each result and efficiency metric follows the active KPI pack and normalized Meta action mapping."],
              ["Data sufficiency", "Unavailable values remain unavailable; the interface never converts missing tracking into zero."],
            ]).map(([label, detail]) => <div key={label} className="py-3"><div className="text-xs font-medium">{label}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></div>)}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setMethodologyOpen((value) => !value)}>{methodologyOpen ? "Collapse methodology" : "Full methodology"}</Button>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(report.prompt); toast.success("Evidence copied", { description: "The active scope, methodology and missing-data labels are included." }); }}><ClipboardListIcon data-icon="inline-start" />Copy evidence</Button><Button type="button" size="sm" onClick={() => window.dispatchEvent(new Event("v2:open-export"))}><DownloadIcon data-icon="inline-start" />Export report</Button></div>
        </div>
      </div>
    </div>
  );
}

function StageGrid({ stages, large = false, onSelect }: { stages: Stage[]; large?: boolean; onSelect?: (stage: Stage) => void }) {
  const columns = stages.length === 2 ? "xl:grid-cols-2" : stages.length === 3 ? "xl:grid-cols-3" : stages.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-5";
  return (
    <div className={cn("mt-4 grid gap-2 sm:grid-cols-2", columns)}>
      {stages.map((stage) => (
        <button key={stage.key} type="button" disabled={!onSelect} onClick={() => onSelect?.(stage)} className={cn("v2-subtle-panel relative overflow-hidden p-3 text-left", large && "min-h-32", stage.tone === "warning" && "border-warning/70", onSelect && "cursor-pointer transition-colors hover:border-primary/60 hover:bg-primary/5")}>
          {stage.tone === "warning" ? <span className="absolute inset-x-0 top-0 h-0.5 bg-warning" /> : null}
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{stage.label}</span><Badge variant={stage.tone === "success" ? "success" : stage.tone === "warning" ? "outline" : "secondary"}>{stage.statusLabel}</Badge></div>
          <div className="mt-3 flex items-end gap-2"><span className="text-lg font-semibold tabular-nums">{stage.value === null ? "Not tracked" : compact(stage.value)}</span>{stage.value === null ? null : <span className="pb-0.5 text-[10px] text-muted-foreground">{stage.unit}</span>}</div>
          <div className="mt-2 text-xs">{stage.efficiency}</div>
          <div className={cn("mt-1 text-[11px]", stage.tone === "warning" ? "text-warning" : stage.tone === "success" ? "text-success" : "text-primary")}>{stage.movement}</div>
        </button>
      ))}
    </div>
  );
}

function TrendPanel({ language, report, primary, embedded = false }: { language: InterfaceLanguage; report: DashboardReport; primary: ReturnType<typeof primaryResult>; embedded?: boolean }) {
  const isVietnamese = language === "vi";
  const data = report.dailyRows.map((row) => ({
    date: row.date?.slice(5) || "",
    value: Number(row[primary.key] || 0),
    efficiency: primary.costKey ? Number(row[primary.costKey] || 0) : row.cpc,
  }));
  const chart = (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 780, height: 192 }}>
        <LineChart data={data} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} strokeOpacity={0.75} />
          <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="value" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="efficiency" orientation="right" hide />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
            formatter={(value, name) => [name === "efficiency" ? currencyValue(Number(value), report.account.currency || "VND") : compact(Number(value)), name === "efficiency" ? primary.costLabel : primary.label]}
          />
          <Line yAxisId="value" type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line yAxisId="efficiency" type="monotone" dataKey="efficiency" stroke="var(--warning)" strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
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

function SignalCard({ eyebrow, title, detail, tone }: { eyebrow: string; title: string; detail: string; tone: "success" | "warning" | "primary" }) {
  return (
    <div className="v2-panel min-w-0 p-4">
      <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{eyebrow}</span><span className={cn("size-1.5 rounded-full", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary")} /></div>
      <div className="mt-3 truncate text-sm font-semibold" title={title}>{title}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
    </div>
  );
}

function MetricTile({ label, value, tone, comparison }: { label: string; value: string; tone: "success" | "warning" | "primary"; comparison?: MetricComparisonDelta }) {
  const comparisonBad = comparison ? metricMovementIsBad(comparison.key, comparison.change) : false;
  return <div className="v2-subtle-panel min-w-20 p-3"><div className="text-[9px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>{comparison ? <div className={cn("mt-1 text-[10px] font-medium", comparison.change === 0 ? "text-muted-foreground" : comparisonBad ? "text-warning" : "text-success")}>{comparison.change > 0 ? "↑ " : comparison.change < 0 ? "↓ " : "→ "}{formatComparisonChangePct(comparison.changePct)} <span className="font-normal">{comparison.descriptor}</span></div> : <div className={cn("mt-1 h-0.5 w-6 rounded-full", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary")} />}</div>;
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

function stageValue(stage: Stage) {
  return stage.value === null ? "Not tracked" : `${compact(stage.value)} ${stage.unit}`;
}

function formatKpi(report: DashboardReport, kpi: KpiCard, currency: string) {
  if (kpi.key === "healthScore") return `${report.health.score}/100`;
  return formatMetric(Number(report.totals[kpi.key] || 0), kpi.format, currency);
}

function tabLabel(tab: (typeof tabValues)[number], language: InterfaceLanguage) {
  const labels = { overview: { en: "Overview", vi: "Tổng quan" }, funnel: { en: "Funnel", vi: "Phễu" }, drivers: { en: "Drivers", vi: "Động lực" }, setup: { en: "Setup", vi: "Thiết lập" }, creatives: { en: "Creatives", vi: "Creative" }, evidence: { en: "Evidence", vi: "Evidence" } };
  return labels[tab][language];
}

function comparisonLabel(mode: CompareMode) {
  if (mode === "off") return "No comparison";
  if (mode === "campaign") return "Campaign group";
  return "Previous period";
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

function packLabel(pack: DashboardReport["selectedPack"]) {
  if (pack === "sales_roas") return "Sales · ROAS";
  if (pack === "lead_gen") return "Lead generation";
  if (pack === "messages") return "Messages";
  if (pack === "traffic") return "Traffic";
  return "Awareness";
}

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
}

function compactSentence(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength - 1).replace(/\s+\S*$/, "");
  return `${shortened || normalized.slice(0, maxLength - 1)}…`;
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
