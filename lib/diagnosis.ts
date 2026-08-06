import type { DashboardReport, KpiPack, NormalizedRow } from "@/lib/types";
import { assessAudienceOverlap } from "@/lib/audience-overlap";
import { assessBreakdownWaste, type BreakdownWaste } from "@/lib/breakdown-waste";
import { recommendBudgetMoves, type BudgetMoveEngineResult } from "@/lib/budget-move-engine";
import { assessConsolidationPressure } from "@/lib/consolidation-pressure";
import { assessCostCapDelivery } from "@/lib/cost-cap-delivery";
import { assessCreativeStarvation, type CreativeStarvationAssessment } from "@/lib/creative-starvation";
import { assessCreativeVolume } from "@/lib/creative-volume";
import { diagnoseDailyChange, type DailyDiagnosis } from "@/lib/daily-diagnosis";
import { assessDecisionConfidence, type DecisionTargets } from "@/lib/decision-confidence";
import { assessExperimentReadiness } from "@/lib/experiment-readiness";
import { assessFunnelLeakage, FUNNEL_BENCHMARKS, type FunnelLeakage } from "@/lib/funnel-leakage";
import { summarizeHealth, type HealthScoreSummary } from "@/lib/health-score";
import { assessMeasurementQuality } from "@/lib/measurement-quality";
import { assessResultConcentration } from "@/lib/result-concentration";
import { assessSpendPacing } from "@/lib/spend-pacing";
import { assessTargetingExclusions } from "@/lib/targeting-exclusions";
import type { BreakdownChartRow } from "@/lib/breakdown-view-model";
import { diagnosticNextStep } from "@/lib/diagnostic-next-step";
import { formatCompactNumber, formatMetric, formatSharePct } from "@/lib/metrics";

export type DiagnosticSeverity = "ok" | "watch" | "risk" | "insufficient";

export type Bilingual = { en: string; vi: string };

export type DiagnosticItem = {
  id: string;
  title?: Bilingual;
  value?: Bilingual;
  badge?: { text: Bilingual; severity: DiagnosticSeverity };
  lines: Bilingual[];
};

export type FunnelStage = {
  key: string;
  label: Bilingual;
  value: number;
  benchmark: number | null;
};

type DiagnosticBase = {
  severity: DiagnosticSeverity;
  eyebrow: Bilingual | null;
  title: Bilingual;
  description: Bilingual;
  badge: Bilingual;
  summary: Bilingual | null;
  items: DiagnosticItem[];
  nextStep: Bilingual;
};

export type Diagnostic = DiagnosticBase &
  (
    | { id: "healthTriage"; health: HealthScoreSummary }
    | { id: "dailyDiagnosis"; daily: DailyDiagnosis }
    | { id: "experimentReadiness" }
    | { id: "decisionConfidence" }
    | { id: "spendPacing" }
    | { id: "consolidationPressure" }
    | { id: "costCapDelivery" }
    | { id: "creativeVolume" }
    | { id: "creativeStarvation"; starvation: CreativeStarvationAssessment }
    | { id: "budgetMove"; engine: BudgetMoveEngineResult }
    | { id: "resultConcentration" }
    | { id: "funnelLeakage"; leakage: FunnelLeakage; stages: FunnelStage[] }
    | { id: "audienceOverlap" }
    | { id: "targetingExclusions" }
    | { id: "measurementQuality" }
    | { id: "breakdownWaste"; waste: BreakdownWaste; topSegments: BreakdownChartRow[] }
  );

export type DiagnosticId = Diagnostic["id"];

function both(text: string): Bilingual {
  return { en: text, vi: text };
}

function zipLines(lines: { en: string[]; vi: string[] }): Bilingual[] {
  return lines.en.map((en, index) => ({ en, vi: lines.vi[index] }));
}

function withNextStep<T extends { id: DiagnosticId; severity: DiagnosticSeverity }>(diagnostic: T): T & { nextStep: Bilingual } {
  return {
    ...diagnostic,
    nextStep: {
      en: diagnosticNextStep(diagnostic.id, diagnostic.severity, "en"),
      vi: diagnosticNextStep(diagnostic.id, diagnostic.severity, "vi"),
    },
  };
}

function reportDays(report: DashboardReport): number {
  return Math.max(1, (new Date(report.dateRange.until).getTime() - new Date(report.dateRange.since).getTime()) / (86400 * 1000) + 1);
}

function healthTriageDiagnostic(report: DashboardReport): Diagnostic {
  const health = summarizeHealth(report);
  return withNextStep({
    id: "healthTriage",
    severity: health.severity === "danger" ? "risk" : health.severity === "warning" ? "watch" : "ok",
    eyebrow: { en: "Health Triage", vi: "Phân loại sức khỏe" },
    title: { en: "Health score & priorities", vi: "Điểm sức khỏe & ưu tiên" },
    description: {
      en: "Rolls key checks into one prioritized action queue.",
      vi: "Tổng hợp các kiểm tra quan trọng thành một hàng đợi xử lý.",
    },
    badge: health.label,
    summary: null,
    items: [],
    health,
  });
}

function dailyDiagnosisDiagnostic(report: DashboardReport): Diagnostic {
  const daily = diagnoseDailyChange({ dailyRows: report.dailyRows, selectedPack: report.selectedPack });
  const hasDanger = daily.causes.some((cause) => cause.severity === "danger");
  const badge =
    daily.status === "causes_found"
      ? { en: `${daily.causes.length} cause${daily.causes.length > 1 ? "s" : ""}`, vi: `${daily.causes.length} nguyên nhân` }
      : daily.status === "stable"
        ? { en: "Stable", vi: "Ổn định" }
        : { en: "Need more data", vi: "Chưa đủ dữ liệu" };
  return withNextStep({
    id: "dailyDiagnosis",
    severity: daily.status === "insufficient_data" ? "insufficient" : daily.status === "stable" ? "ok" : hasDanger ? "risk" : "watch",
    eyebrow: { en: "Root Cause", vi: "Nguyên nhân gốc" },
    title: { en: "Why did this change?", vi: "Vì sao có thay đổi?" },
    description: {
      en: "Root-cause diagnosis from the daily trend inside this report.",
      vi: "Chẩn đoán nguyên nhân gốc từ xu hướng theo ngày trong báo cáo này.",
    },
    badge,
    summary: daily.summary,
    items: [],
    daily,
  });
}

function experimentReadinessDiagnostic(report: DashboardReport): Diagnostic {
  const readiness = assessExperimentReadiness(report);
  const lines = readiness.blockers.en.length > 0 ? zipLines(readiness.blockers) : [readiness.nextAction];
  return withNextStep({
    id: "experimentReadiness",
    severity: readiness.severity,
    eyebrow: { en: "Experiment Gate", vi: "Cổng thử nghiệm" },
    title: { en: "Experiment readiness", vi: "Sẵn sàng thử nghiệm" },
    description: {
      en: "Combines measurement, account health, and creative signals before launch decisions.",
      vi: "Kết hợp đo lường, sức khỏe tài khoản và tín hiệu mẫu quảng cáo trước quyết định khởi chạy.",
    },
    badge: readiness.label,
    summary: null,
    items: lines.map((line) => ({ id: line.en, lines: [line] })),
  });
}

function decisionConfidenceDiagnostic(report: DashboardReport, targets: DecisionTargets): Diagnostic {
  const rows = (report.adsetRows.length > 0 ? report.adsetRows : report.campaignRows).filter((row) => row.spend > 0);
  const assessments = rows.map((row) => ({ row, confidence: assessDecisionConfidence(row, report.selectedPack, "en", targets) }));
  const blocked = assessments.filter((item) => !item.confidence.actionable);
  const actionable = assessments.filter((item) => item.confidence.actionable);
  return withNextStep({
    id: "decisionConfidence",
    severity: rows.length === 0 ? "insufficient" : blocked.length > actionable.length ? "risk" : blocked.length > 0 ? "watch" : "ok",
    eyebrow: { en: "Evidence Gate", vi: "Cổng bằng chứng" },
    title: { en: "Decision confidence", vi: "Độ tin cậy quyết định" },
    description: {
      en: "Downgrades kill/scale advice when evidence is thin or delivery is unstable.",
      vi: "Chặn khuyến nghị dừng hoặc tăng ngân sách khi dữ liệu còn mỏng hoặc phân phối chưa ổn định.",
    },
    badge: { en: `${actionable.length}/${rows.length || 0} actionable`, vi: `${actionable.length}/${rows.length || 0} có thể hành động` },
    summary:
      rows.length === 0
        ? { en: "No spent rows are available for confidence checks.", vi: "Chưa có dòng có chi tiêu để đánh giá." }
        : {
            en: `${blocked.length} ${blocked.length === 1 ? "row is" : "rows are"} downgraded because decision evidence is not strong enough.`,
            vi: `${blocked.length} dòng đang bị hạ cấp vì chưa đủ bằng chứng quyết định.`,
          },
    items: blocked.slice(0, 3).map(({ row, confidence }) => ({
      id: row.id,
      title: both(row.name),
      badge: { text: confidence.label, severity: confidence.severity },
      lines: [{ en: confidence.reasons.en[0], vi: confidence.reasons.vi[0] }],
    })),
  });
}

function spendPacingDiagnostic(report: DashboardReport, currency: string): Diagnostic {
  const pacing = assessSpendPacing(report.campaignRows, reportDays(report));
  const offPace = pacing.status === "on_pace" ? [] : pacing.campaigns.filter((campaign) => campaign.status !== "on_pace").slice(0, 5);
  return withNextStep({
    id: "spendPacing",
    severity: pacing.severity,
    eyebrow: null,
    title: { en: "Spend pacing", vi: "Tốc độ chi tiêu" },
    description: {
      en: "Compares actual spend against expected budget over the report period.",
      vi: "So sánh chi tiêu thực tế với ngân sách kỳ vọng theo kỳ báo cáo.",
    },
    badge: pacing.label,
    summary: pacing.summary,
    items: offPace.map((campaign) => ({
      id: campaign.id,
      title: both(campaign.name),
      badge: { text: both(formatSharePct(campaign.pacePercent, currency)), severity: campaign.status === "severely_underpacing" ? "risk" : "watch" },
      lines: [
        {
          en: `Spent ${formatMetric(campaign.spend, "currency", currency)} / expected ${formatMetric(campaign.expectedSpend, "currency", currency)}`,
          vi: `Chi tiêu ${formatMetric(campaign.spend, "currency", currency)} / kỳ vọng ${formatMetric(campaign.expectedSpend, "currency", currency)}`,
        },
      ],
    })),
  });
}

function consolidationPressureDiagnostic(report: DashboardReport, currency: string): Diagnostic {
  const assessment = assessConsolidationPressure(report.adsetRows, report.selectedPack, reportDays(report));
  const conversionsText = assessment.conversionsPerAdset.toLocaleString(currency === "VND" ? "vi-VN" : "en-US", { maximumFractionDigits: 1 });
  const items: DiagnosticItem[] =
    assessment.status === "insufficient_data"
      ? []
      : [
          {
            id: "active-adsets",
            lines: [
              {
                en: `Active ad sets: ${formatCompactNumber(assessment.activeAdsets, currency)}`,
                vi: `Ad set active: ${formatCompactNumber(assessment.activeAdsets, currency)}`,
              },
            ],
          },
          {
            id: "conversions-per-adset",
            lines: [{ en: `Conv/adset/week: ${conversionsText}`, vi: `CV/ad set/tuần: ${conversionsText}` }],
          },
          {
            id: "threshold",
            lines: [
              {
                en: `Threshold: ${formatCompactNumber(assessment.weeklyThreshold, currency)}`,
                vi: `Ngưỡng: ${formatCompactNumber(assessment.weeklyThreshold, currency)}`,
              },
            ],
          },
        ];
  return withNextStep({
    id: "consolidationPressure",
    severity: assessment.severity,
    eyebrow: null,
    title: { en: "Consolidation pressure", vi: "Áp lực hợp nhất" },
    description: {
      en: "Checks if conversions per ad set per week are sufficient to exit the learning phase.",
      vi: "Kiểm tra số chuyển đổi trên mỗi nhóm quảng cáo mỗi tuần có đủ để thoát giai đoạn học hay không.",
    },
    badge: assessment.label,
    summary: assessment.summary,
    items,
  });
}

function costCapDeliveryDiagnostic(report: DashboardReport, currency: string): Diagnostic {
  const assessment = assessCostCapDelivery(report.campaignRows, reportDays(report));
  return withNextStep({
    id: "costCapDelivery",
    severity: assessment.severity,
    eyebrow: null,
    title: { en: "Cost cap delivery", vi: "Phân phối theo giới hạn chi phí" },
    description: {
      en: "Detects campaigns constrained by an overly restrictive cost cap or bid cap.",
      vi: "Phát hiện chiến dịch bị hạn chế phân phối do giới hạn chi phí hoặc giá thầu quá thấp.",
    },
    badge: assessment.label,
    summary: assessment.summary,
    items: assessment.underdelivering.slice(0, 5).map((item) => ({
      id: item.id,
      title: both(item.name),
      badge: { text: both(formatSharePct(item.spendRate, currency)), severity: item.spendRate < 0.6 ? "risk" : "watch" },
      lines: [
        {
          en: `Spent ${formatMetric(item.spend, "currency", currency)} / daily budget ${formatMetric(item.dailyBudget, "currency", currency)}`,
          vi: `Chi tiêu ${formatMetric(item.spend, "currency", currency)} / ngân sách ngày ${formatMetric(item.dailyBudget, "currency", currency)}`,
        },
      ],
    })),
  });
}

function creativeVolumeDiagnostic(report: DashboardReport): Diagnostic {
  const assessment = assessCreativeVolume(report.adRows);
  const visibleAdsets = assessment.adsets.filter((adset) => adset.status !== "healthy").slice(0, 3);
  const displayAdsets = visibleAdsets.length > 0 ? visibleAdsets : assessment.adsets.slice(0, 2);
  return withNextStep({
    id: "creativeVolume",
    severity: assessment.severity,
    eyebrow: { en: "Creative Capacity", vi: "Năng lực mẫu quảng cáo" },
    title: { en: "Creative coverage", vi: "Độ phủ mẫu quảng cáo" },
    description: {
      en: "Proxy for active/spent creative count per ad set; does not measure similarity or Advantage+ type yet.",
      vi: "Ước tính số mẫu quảng cáo có phân phối hoặc chi tiêu trong mỗi nhóm quảng cáo; chưa đo mức độ tương đồng hoặc loại Advantage+.",
    },
    badge: assessment.label,
    summary: assessment.summary,
    items: displayAdsets.map((adset) => ({
      id: adset.adsetId,
      title: both(adset.adsetName),
      badge: { text: both(String(adset.creativeCount)), severity: adset.severity },
      lines: [adset.reason],
    })),
  });
}

function creativeStarvationDiagnostic(report: DashboardReport): Diagnostic {
  const starvation = assessCreativeStarvation(report.adRows);
  return withNextStep({
    id: "creativeStarvation",
    severity: starvation.severity,
    eyebrow: null,
    title: { en: "Creative starvation", vi: "Mẫu quảng cáo thiếu phân phối" },
    description: {
      en: "Checks if a fatigued creative dominates spend and blocks fresh creative testing.",
      vi: "Kiểm tra liệu mẫu quảng cáo đã suy giảm có chiếm phần lớn ngân sách và cản trở thử nghiệm mẫu mới hay không.",
    },
    badge: starvation.label,
    summary: starvation.summary,
    items: [],
    starvation,
  });
}

function budgetMoveDiagnostic(report: DashboardReport): Diagnostic {
  const engine = recommendBudgetMoves(report);
  return withNextStep({
    id: "budgetMove",
    severity: engine.severity,
    eyebrow: { en: "Budget Engine", vi: "Động cơ ngân sách" },
    title: { en: "Budget Move Engine", vi: "Điều chuyển ngân sách" },
    description: {
      en: "Recommends guarded budget transfers only when current row performance supports it.",
      vi: "Chỉ đề xuất chuyển ngân sách có kiểm soát khi hiệu quả hiện tại đủ hỗ trợ.",
    },
    badge: engine.label,
    summary: engine.summary,
    items: engine.recommendations.length > 0 ? [] : zipLines(engine.holdReasons).map((line) => ({ id: line.en, lines: [line] })),
    engine,
  });
}

function resultConcentrationDiagnostic(report: DashboardReport, currency: string): Diagnostic {
  const rows = report.adRows.length > 0 ? report.adRows : report.adsetRows.length > 0 ? report.adsetRows : report.campaignRows;
  const concentration = assessResultConcentration(rows, report.selectedPack);
  return withNextStep({
    id: "resultConcentration",
    severity: concentration.severity,
    eyebrow: null,
    title: { en: "Result concentration", vi: "Độ tập trung kết quả" },
    description: {
      en: "Checks whether spend or primary results depend on too few rows.",
      vi: "Kiểm tra chi tiêu hoặc kết quả chính có phụ thuộc vào quá ít dòng hay không.",
    },
    badge: concentration.label,
    summary: concentration.summary,
    items: concentration.topRows.map((row) => ({
      id: row.id,
      title: both(row.name),
      value: both(formatSharePct(row.resultShare || row.spendShare, currency)),
      lines: [],
    })),
  });
}

function funnelLeakageDiagnostic(report: DashboardReport): Diagnostic {
  const leakage = assessFunnelLeakage(report.totals);
  const stages: FunnelStage[] = [
    { key: "clicks", label: { en: "Link clicks", vi: "Click link" }, value: report.totals.linkClicks, benchmark: null },
    { key: "cart", label: { en: "Add to cart", vi: "Thêm giỏ" }, value: report.totals.addToCart, benchmark: FUNNEL_BENCHMARKS.clickToCart },
    { key: "checkout", label: { en: "Checkout", vi: "Checkout" }, value: report.totals.initiateCheckout, benchmark: FUNNEL_BENCHMARKS.cartToCheckout },
    { key: "purchase", label: { en: "Purchase", vi: "Mua hàng" }, value: report.totals.purchases, benchmark: FUNNEL_BENCHMARKS.checkoutToPurchase },
  ];
  return withNextStep({
    id: "funnelLeakage",
    severity: leakage.severity,
    eyebrow: { en: "Funnel Diagnostics", vi: "Chẩn đoán phễu" },
    title: { en: "Funnel leakage", vi: "Rò rỉ phễu chuyển đổi" },
    description: {
      en: "Evaluates clicks, carts, checkouts, and purchases against standard benchmarks.",
      vi: "Đánh giá tỷ lệ click, thêm giỏ hàng, checkout và mua hàng so với mốc tiêu chuẩn.",
    },
    badge: leakage.status === "clean" ? leakage.label : both(`${leakage.score}/100`),
    summary: null,
    items: [],
    leakage,
    stages,
  });
}

function audienceOverlapDiagnostic(report: DashboardReport, currency: string): Diagnostic {
  const overlap = assessAudienceOverlap(report.adsetRows);
  return withNextStep({
    id: "audienceOverlap",
    severity: overlap.severity,
    eyebrow: { en: "Audience Map", vi: "Bản đồ đối tượng" },
    title: { en: "Audience overlap", vi: "Trùng lặp đối tượng" },
    description: {
      en: "Checks for similar ad set naming that suggests target audience overlap.",
      vi: "Kiểm tra sự trùng lặp đối tượng nhắm mục tiêu dựa trên tên ad set tương đồng.",
    },
    badge: overlap.label,
    summary: overlap.summary,
    items: overlap.pairs.map((pair) => ({
      id: `${pair.name1}-${pair.name2}`,
      title: both(`${formatSharePct(pair.similarity, currency)} similarity`),
      lines: [both(pair.name1), both(pair.name2)],
    })),
  });
}

function targetingExclusionsDiagnostic(report: DashboardReport): Diagnostic {
  const assessment = assessTargetingExclusions(report.adsetRows);
  return withNextStep({
    id: "targetingExclusions",
    severity: assessment.severity,
    eyebrow: null,
    title: { en: "Targeting exclusions", vi: "Loại trừ nhắm mục tiêu" },
    description: {
      en: "Verify setup of custom audience exclusions against deprecated detailed exclusions.",
      vi: "Xác minh cấu hình loại trừ bằng Custom Audience thay vì loại trừ chi tiết đã bị bãi bỏ.",
    },
    badge: assessment.label,
    summary: assessment.summary,
    items: assessment.flaggedAdsets.map((adset) => ({
      id: adset.adsetId,
      title: both(`Ad Set: ${adset.adsetName}`),
      lines: [both(`Matched Keyword: "${adset.keyword}"`), adset.reason],
    })),
  });
}

function measurementQualityDiagnostic(report: DashboardReport): Diagnostic {
  const quality = assessMeasurementQuality(report);
  return withNextStep({
    id: "measurementQuality",
    severity: quality.severity,
    eyebrow: null,
    title: { en: "Measurement quality", vi: "Chất lượng đo lường" },
    description: {
      en: "Checks whether the current dataset supports confident optimization decisions.",
      vi: "Kiểm tra dữ liệu hiện tại có đủ tin cậy để ra quyết định tối ưu hay không.",
    },
    badge: quality.label,
    summary: null,
    items: zipLines(quality.reasons).map((line) => ({ id: line.en, lines: [line] })),
  });
}

export function breakdownWasteDiagnostic({
  rows,
  pack,
  chartRows,
  dimensionLabel,
}: {
  rows: NormalizedRow[];
  pack: KpiPack;
  chartRows: BreakdownChartRow[];
  dimensionLabel: string;
}): Extract<Diagnostic, { id: "breakdownWaste" }> {
  const waste = assessBreakdownWaste(rows, pack);
  return withNextStep({
    id: "breakdownWaste",
    severity: waste.severity,
    eyebrow: { en: "Allocation Risk", vi: "Rủi ro phân bổ" },
    title: { en: "Breakdown waste", vi: "Lãng phí theo phân nhóm" },
    description: {
      en: `${dimensionLabel}: spend and result allocation.`,
      vi: `${dimensionLabel}: phân bổ chi tiêu và kết quả.`,
    },
    badge: waste.label,
    summary: waste.summary,
    items: [],
    waste,
    topSegments: chartRows.slice(0, 3),
  });
}

export function runDiagnostics(report: DashboardReport, targets: DecisionTargets = {}): Diagnostic[] {
  const currency = report.account.currency || "VND";
  return [
    healthTriageDiagnostic(report),
    dailyDiagnosisDiagnostic(report),
    experimentReadinessDiagnostic(report),
    decisionConfidenceDiagnostic(report, targets),
    spendPacingDiagnostic(report, currency),
    consolidationPressureDiagnostic(report, currency),
    costCapDeliveryDiagnostic(report, currency),
    creativeVolumeDiagnostic(report),
    creativeStarvationDiagnostic(report),
    budgetMoveDiagnostic(report),
    resultConcentrationDiagnostic(report, currency),
    funnelLeakageDiagnostic(report),
    audienceOverlapDiagnostic(report, currency),
    targetingExclusionsDiagnostic(report),
    measurementQualityDiagnostic(report),
  ];
}
