import { analyzeComparisonRootCauses, type ComparisonRootCauseStatus } from "@/lib/comparison-root-cause";
import { buildCustomChartData, metricFormat, metricLabel, type CustomChartSpec } from "@/lib/custom-chart";
import { type DecisionTargets } from "@/lib/decision-confidence";
import { runDiagnostics, type Diagnostic, type DiagnosticSeverity } from "@/lib/diagnosis";
import { summarizeHealth, type HealthScoreSummary } from "@/lib/health-score";
import { buildKpiComparisons, comparisonFootnote, formatComparisonChangePct, metricMovementIsBad } from "@/lib/metric-comparison";
import { formatMetric } from "@/lib/metrics";
import { primaryResultSpec } from "@/lib/primary-result";
import { recommendBudgetMoves, type BudgetMoveEngineStatus } from "@/lib/budget-move-engine";
import { buildLocalVerdict } from "@/lib/verdict-rules";
import type { AiInsightTable, AiProvider, CompareMode, DashboardReport, InterfaceLanguage, KpiCard, KpiPack, NormalizedRow, Verdict } from "@/lib/types";

export type ClientReportKpi = {
  key: string;
  label: string;
  value: string;
  delta?: string;
  movement: "good" | "bad" | "neutral";
};

export type ClientReportAction = {
  kind: "budget" | "test" | "insight";
  title: string;
  detail: string;
};

export type ClientReportTableColumn = {
  key: string;
  label: string;
  weight: number;
  align: "left" | "right";
};

export type ClientReportTableRow = {
  id: string;
  cells: Record<string, string>;
};

export type ClientReportTable = {
  title: string;
  columns: ClientReportTableColumn[];
  rows: ClientReportTableRow[];
};

export type ClientReportDriver = {
  id: string;
  name: string;
  level: NormalizedRow["level"];
  spend: number;
  spendLabel: string;
  spendShare: number;
  primary: number;
  primaryLabel: string;
  primaryShare: number;
  efficiency: number;
  efficiencyLabel: string;
  efficiencyValue: string;
};

export type ClientReportDiagnostic = {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  badge: string;
  summary: string;
  evidence: string[];
  nextStep: string;
};

export type ClientReportComparison = {
  status: ComparisonRootCauseStatus | "off";
  summary: string;
  drivers: Array<{
    id: string;
    name: string;
    direction: "positive" | "negative";
    evidence: string[];
    action: string;
  }>;
};

export type ClientReportCustomChart = {
  id: string;
  title: string;
  type: CustomChartSpec["type"];
  series: Array<{
    key: CustomChartSpec["series"][number]["key"];
    label: string;
    axis: CustomChartSpec["series"][number]["axis"];
    format: ReturnType<typeof metricFormat>;
  }>;
  data: Array<Record<string, number | string>>;
};

export type ClientReportBudgetMove = {
  status: BudgetMoveEngineStatus;
  severity: DiagnosticSeverity;
  label: string;
  summary: string;
  holdReasons: string[];
  recommendations: Array<{
    id: string;
    summary: string;
    sourceName: string;
    targetName: string;
    movePercent: number;
    evidence: string[];
  }>;
};

export type ClientReportViewModel = {
  accountName: string;
  dateRange: DashboardReport["dateRange"];
  dateRangeLabel: string;
  generatedLabel: string;
  pulledLabel: string;
  currency: string;
  language: InterfaceLanguage;
  copy: {
    title: string;
    subtitle: string;
    preparedBy: string;
    source: string;
    verdictLabel: string;
    executiveSummary: string;
    kpiScorecard: string;
    performanceStory: string;
    recommendations: string;
    appendixCharts: string;
    appendixTables: string;
    appendixDiagnostics: string;
    wins: string;
    losers: string;
    risks: string;
    assumptions: string;
    nextMoves: string;
    selectedPack: string;
    primaryResult: string;
    confidence: string;
    dataPulled: string;
    comparisonDrivers: string;
    dailyDiagnosis: string;
    customCharts: string;
    footnoteSource: string;
    footnoteComparison: string;
    footnoteRecommendations: string;
  };
  verdict: Verdict;
  verdictText: string;
  verdictConfidenceLabel: string;
  healthScore: number;
  healthGrade: string;
  healthLabel: string;
  healthStatus: HealthScoreSummary["severity"];
  healthStatusLabel: string;
  healthSummaryText: string;
  decisionProvider: AiProvider;
  decisionProviderLabel: string;
  selectedPack: KpiPack;
  selectedPackLabel: string;
  selectedPackReason: string;
  primaryResultKey: keyof NormalizedRow;
  primaryResultLabel: string;
  primaryResultExplanation: string;
  primaryCostKey?: keyof NormalizedRow;
  primaryCostLabel: string;
  efficiencyLabel: string;
  kpis: ClientReportKpi[];
  wins: string[];
  losers: string[];
  risks: string[];
  assumptions: string[];
  actions: ClientReportAction[];
  budgetMove: ClientReportBudgetMove;
  insightSummary: string | null;
  dailyDiagnosis: {
    severity: DiagnosticSeverity;
    summary: string;
    causes: Array<{ title: string; evidence: string[]; action: string }>;
  };
  dailyTrend: Array<{ label: string; spend: number; primary: number; efficiency: number }>;
  topCampaigns: ClientReportDriver[];
  topAdsets: ClientReportDriver[];
  comparison: ClientReportComparison;
  customCharts: ClientReportCustomChart[];
  breakdowns: {
    platforms: NormalizedRow[];
    regions: NormalizedRow[];
    ageGender: NormalizedRow[];
  };
  tables: ClientReportTable[];
  diagnostics: ClientReportDiagnostic[];
  creativeDetails: Array<{
    name: string;
    campaignName: string;
    status: string;
    adCount: number;
    adCountLabel: string;
    summary: string;
    ads: string[];
  }>;
};

const copy = {
  en: {
    title: "Meta Ads Performance Report",
    subtitle: "A client-ready decision record: outcomes, drivers, evidence quality, and the next guarded moves.",
    preparedBy: "Prepared in Decision Workspace",
    source: "Meta Ads API",
    verdictLabel: "Performance verdict",
    executiveSummary: "Executive summary",
    kpiScorecard: "KPI scorecard",
    performanceStory: "Performance story",
    recommendations: "Recommendations",
    appendixCharts: "Appendix A: Charts and breakdowns",
    appendixTables: "Appendix B: Performance tables",
    appendixDiagnostics: "Appendix C: Diagnostics and creative detail",
    wins: "Winners",
    losers: "Losers",
    risks: "Risks",
    assumptions: "Assumptions",
    nextMoves: "Next moves",
    selectedPack: "Selected KPI Pack",
    primaryResult: "Primary Result",
    confidence: "Verdict Confidence",
    dataPulled: "Data pulled",
    comparisonDrivers: "Period-over-period drivers",
    dailyDiagnosis: "Daily diagnosis",
    customCharts: "Saved Custom Charts",
    footnoteSource: "Values use the selected dashboard reporting period and campaign scope. Data source: Meta Ads API.",
    footnoteComparison: "Comparison deltas appear when a previous report is available.",
    footnoteRecommendations: "Budget Moves come from the guarded Budget Move Engine; generated wording cannot expand those claims.",
  },
  vi: {
    title: "Báo cáo hiệu quả Meta Ads",
    subtitle: "Hồ sơ quyết định dành cho khách hàng: kết quả, động lực, chất lượng bằng chứng và bước đi có guardrail tiếp theo.",
    preparedBy: "Chuẩn bị trong Decision Workspace",
    source: "Meta Ads API",
    verdictLabel: "Kết luận hiệu quả",
    executiveSummary: "Tóm tắt điều hành",
    kpiScorecard: "Bảng điểm KPI",
    performanceStory: "Câu chuyện hiệu quả",
    recommendations: "Khuyến nghị",
    appendixCharts: "Phụ lục A: Biểu đồ và phân tích nhóm",
    appendixTables: "Phụ lục B: Bảng hiệu quả",
    appendixDiagnostics: "Phụ lục C: Chẩn đoán và chi tiết quảng cáo",
    wins: "Nhóm thắng",
    losers: "Nhóm thua",
    risks: "Rủi ro",
    assumptions: "Giả định",
    nextMoves: "Bước tiếp theo",
    selectedPack: "Gói KPI đã chọn",
    primaryResult: "Kết quả chính",
    confidence: "Độ tin cậy Verdict",
    dataPulled: "Thời điểm kéo dữ liệu",
    comparisonDrivers: "Động lực giữa hai kỳ",
    dailyDiagnosis: "Chẩn đoán theo ngày",
    customCharts: "Biểu đồ tùy chỉnh đã lưu",
    footnoteSource: "Số liệu dùng kỳ báo cáo và phạm vi chiến dịch đang chọn. Nguồn dữ liệu: Meta Ads API.",
    footnoteComparison: "Chênh lệch so sánh hiển thị khi có báo cáo kỳ trước.",
    footnoteRecommendations: "Budget Move đến từ Budget Move Engine có guardrail; diễn giải tạo sinh không được mở rộng các kết luận này.",
  },
} as const;

export function buildClientReportViewModel(args: {
  report: DashboardReport;
  language: InterfaceLanguage;
  compareMode: CompareMode;
  kpis: KpiCard[];
  previousReport?: DashboardReport | null;
  verdict?: Verdict | null;
  insights?: AiInsightTable | null;
  decisionTargets?: DecisionTargets;
  customCharts?: CustomChartSpec[];
  generatedAt?: string;
}): ClientReportViewModel {
  const report = { ...args.report, kpis: args.kpis };
  const languageCopy = copy[args.language];
  const healthSummary = summarizeHealth(report);
  const currency = report.account.currency || "VND";
  const verdict = args.verdict ?? buildLocalVerdict(report, args.language);
  const diagnostics = runDiagnostics(report, args.decisionTargets);
  const budgetMove = recommendBudgetMoves(report);
  const comparisons = buildKpiComparisons({
    report,
    previousReport: args.previousReport,
    compareMode: args.compareMode,
    language: args.language,
  });
  const comparisonByKey = new Map(comparisons.map((comparison) => [comparison.key, comparison]));
  const primarySpec = primaryResultSpec(report.selectedPack);
  const primaryKey = primarySpec.volumeKey;
  const efficiency = efficiencySpec(report.selectedPack, primarySpec.costKey);
  const decisionProvider = verdict.provider;
  const source = reportSource(report, args.language);
  const dailyDiagnostic = diagnostics.find((diagnostic) => diagnostic.id === "dailyDiagnosis");

  return {
    accountName: report.account.name,
    dateRange: report.dateRange,
    dateRangeLabel: formatDateRange(report.dateRange, args.language),
    generatedLabel: formatDateTime(args.generatedAt ?? new Date().toISOString(), args.language, true),
    pulledLabel: formatDateTime(report.pulledAt, args.language, true),
    currency,
    language: args.language,
    copy: {
      ...languageCopy,
      source: source.label,
      footnoteSource: source.footnote,
      footnoteComparison: comparisonFootnote({
        report,
        previousReport: args.previousReport,
        compareMode: args.compareMode,
        language: args.language,
      }),
    },
    verdict,
    verdictText: verdict.verdict,
    verdictConfidenceLabel: confidenceLabel(verdict.confidence, args.language),
    healthScore: healthSummary.score,
    healthGrade: healthSummary.grade,
    healthLabel: `${healthSummary.grade} / ${healthSummary.score}/100`,
    healthStatus: healthSummary.severity,
    healthStatusLabel: healthSummary.label[args.language],
    healthSummaryText: healthSummary.summary[args.language],
    decisionProvider,
    decisionProviderLabel: generationSourceLabel(decisionProvider, args.insights?.provider, args.language),
    selectedPack: report.selectedPack,
    selectedPackLabel: packLabel(report.selectedPack, args.language),
    selectedPackReason: selectedPackReason(report, args.language),
    primaryResultKey: primaryKey,
    primaryResultLabel: primarySpec.volumeLabel[args.language],
    primaryResultExplanation: primaryResultExplanation(report.selectedPack, primarySpec.volumeLabel[args.language], primarySpec.costLabel[args.language], args.language),
    primaryCostKey: primarySpec.costKey || undefined,
    primaryCostLabel: primarySpec.costLabel[args.language],
    efficiencyLabel: efficiency.label[args.language],
    kpis: args.kpis.slice(0, 6).map((kpi) => {
      const key = kpi.key as keyof NormalizedRow;
      const value = kpi.key === "healthScore"
        ? healthSummary.grade
        : formatMetric(Number(report.totals[key] || 0), kpi.format, currency);
      const comparison = kpi.key === "healthScore" ? undefined : comparisonByKey.get(key);
      return {
        key: kpi.key,
        label: localizeKpiLabel(kpi.key, kpi.label, args.language),
        value,
        delta: comparison ? `${comparison.change > 0 ? "↑" : comparison.change < 0 ? "↓" : "→"} ${formatComparisonChangePct(comparison.changePct, args.language)} ${comparison.descriptor}` : undefined,
        movement: comparison ? (metricMovementIsBad(kpi.key, comparison.change) ? "bad" : comparison.change === 0 ? "neutral" : "good") : "neutral",
      };
    }),
    wins: reportSignalList(verdict.winners, "wins", args.language),
    losers: reportSignalList(verdict.losers, "losers", args.language),
    risks: reportSignalList(verdict.risks, "risks", args.language),
    assumptions: reportSignalList(verdict.assumptions, "assumptions", args.language),
    actions: buildActions(verdict, args.insights, budgetMove, args.language),
    budgetMove: localizeBudgetMove(budgetMove, args.language, currency, report.selectedPack),
    insightSummary: args.insights?.summary || null,
    dailyDiagnosis: dailyDiagnostic && dailyDiagnostic.id === "dailyDiagnosis"
      ? {
          severity: dailyDiagnostic.severity,
          summary: dailyDiagnostic.daily.summary[args.language],
          causes: dailyDiagnostic.daily.causes.map((cause) => ({
            title: cause.title[args.language],
            evidence: cause.evidence.map((line) => line[args.language]),
            action: cause.action[args.language],
          })),
        }
      : { severity: "insufficient", summary: args.language === "vi" ? "Chưa có chẩn đoán theo ngày." : "No daily diagnosis is available.", causes: [] },
    dailyTrend: report.dailyRows.slice(-14).map((row) => ({
      label: row.date ? row.date.slice(5) : row.name,
      spend: row.spend,
      primary: Number(row[primaryKey] || 0),
      efficiency: Number(row[efficiency.key] || 0),
    })),
    topCampaigns: rankDrivers(report.campaignRows, report, primaryKey, efficiency, args.language),
    topAdsets: rankDrivers(report.adsetRows, report, primaryKey, efficiency, args.language),
    comparison: buildComparison(report, args.previousReport, args.compareMode, args.language),
    customCharts: (args.customCharts || []).map((spec) => ({
      id: spec.id,
      title: spec.title,
      type: spec.type,
      series: spec.series.map((series) => ({
        key: series.key,
        label: metricLabel(series.key, args.language),
        axis: series.axis,
        format: metricFormat(series.key),
      })),
      data: buildCustomChartData(report.dailyRows, spec),
    })),
    breakdowns: {
      platforms: report.platformRows.slice(0, 4).map((row) => localizeBreakdownRow(row, "platform", args.language)),
      regions: (report.regionRows.length ? report.regionRows : report.countryRows || []).slice(0, 4),
      ageGender: report.ageGenderRows.slice(0, 4).map((row) => localizeBreakdownRow(row, "ageGender", args.language)),
    },
    tables: buildReportTables(report, args.language, currency),
    diagnostics: diagnostics.map((diagnostic) => ({
      id: diagnostic.id,
      severity: diagnostic.severity,
      title: diagnostic.title[args.language],
      description: diagnostic.description[args.language],
      badge: diagnostic.badge[args.language],
      summary: diagnostic.summary?.[args.language] || diagnostic.description[args.language],
      evidence: projectDiagnosticEvidence(diagnostic, args.language, currency),
      nextStep: diagnostic.nextStep[args.language],
    })),
    creativeDetails: (report.adsetPreviews || []).map((adset) => {
      const adCount = adset.ads.length;
      const adCountLabel = args.language === "vi" ? `${adCount} quảng cáo` : `${adCount} ${adCount === 1 ? "ad" : "ads"}`;
      return {
        name: adset.name,
        campaignName: adset.campaignName,
        status: adset.status,
        adCount,
        adCountLabel,
        summary: `${adset.campaignName} / ${adset.status} / ${adCountLabel}`,
        ads: adset.ads.map((ad) => ad.name || ad.id).slice(0, 6),
      };
    }),
  };
}

export type ClientReportPdfFile = {
  filename: string;
  blob: Blob;
};

export type PdfDownloadRuntime = {
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  createLink: () => { href: string; download: string; click: () => void };
};

export function downloadClientReportPdf(pdf: ClientReportPdfFile, runtime: PdfDownloadRuntime) {
  const url = runtime.createObjectUrl(pdf.blob);
  const link = runtime.createLink();
  link.href = url;
  link.download = pdf.filename;
  link.click();
  runtime.revokeObjectUrl(url);
}

function efficiencySpec(pack: KpiPack, primaryCostKey: keyof NormalizedRow | null) {
  if (pack === "sales_roas") return { key: "roas" as const, format: "ratio" as const, label: { en: "ROAS", vi: "ROAS" } };
  if (pack === "awareness") return { key: "cpm" as const, format: "currency" as const, label: { en: "CPM", vi: "CPM" } };
  return {
    key: (primaryCostKey || "cpc") as keyof NormalizedRow,
    format: "currency" as const,
    label: primaryResultSpec(pack).costLabel,
  };
}

function rankDrivers(
  rows: NormalizedRow[],
  report: DashboardReport,
  primaryKey: keyof NormalizedRow,
  efficiency: ReturnType<typeof efficiencySpec>,
  language: InterfaceLanguage,
): ClientReportDriver[] {
  const totalSpend = Math.max(1, report.totals.spend || rows.reduce((sum, row) => sum + row.spend, 0));
  const totalPrimary = Math.max(1, Number(report.totals[primaryKey] || rows.reduce((sum, row) => sum + Number(row[primaryKey] || 0), 0)));
  const currency = report.account.currency || "VND";

  const primaryRows = rows.filter((row) => Number(row[primaryKey] || 0) > 0);
  const rankedRows = primaryRows.length ? primaryRows : rows.filter((row) => row.spend > 0);

  return rankedRows
    .slice()
    .sort((left, right) => Number(right[primaryKey] || 0) - Number(left[primaryKey] || 0) || right.spend - left.spend || left.name.localeCompare(right.name))
    .slice(0, 4)
    .map((row) => {
      const primary = Number(row[primaryKey] || 0);
      const efficiencyValue = Number(row[efficiency.key] || 0);
      return {
        id: row.id,
        name: row.name,
        level: row.level,
        spend: row.spend,
        spendLabel: formatMetric(row.spend, "currency", currency),
        spendShare: (row.spend / totalSpend) * 100,
        primary,
        primaryLabel: formatMetric(primary, "number", currency),
        primaryShare: (primary / totalPrimary) * 100,
        efficiency: efficiencyValue,
        efficiencyLabel: efficiency.label[language],
        efficiencyValue: formatMetric(efficiencyValue, efficiency.format, currency),
      };
    });
}

function buildComparison(
  report: DashboardReport,
  previousReport: DashboardReport | null | undefined,
  compareMode: CompareMode,
  language: InterfaceLanguage,
): ClientReportComparison {
  if (compareMode === "off") {
    return { status: "off", summary: language === "vi" ? "Không chọn so sánh cho báo cáo này." : "No comparison selected for this report.", drivers: [] };
  }
  if (!previousReport) {
    return { status: "insufficient_data", summary: language === "vi" ? "Không có báo cáo kỳ trước để phân tích động lực." : "No previous report is available for driver analysis.", drivers: [] };
  }
  const analysis = analyzeComparisonRootCauses(report, previousReport);
  return {
    status: analysis.status,
    summary: analysis.summary[language],
    drivers: analysis.drivers.map((driver) => ({
      id: driver.rowId,
      name: driver.rowName,
      direction: driver.direction,
      evidence: driver.evidence.map((line) => localizeComparisonEvidence(line, language)),
      action: driver.action[language],
    })),
  };
}

function localizeBudgetMove(
  result: ReturnType<typeof recommendBudgetMoves>,
  language: InterfaceLanguage,
  currency: string,
  pack: KpiPack,
): ClientReportBudgetMove {
  const spec = primaryResultSpec(pack);
  return {
    status: result.status,
    severity: result.severity,
    label: result.label[language],
    summary: result.summary[language],
    holdReasons: result.holdReasons[language],
    recommendations: result.recommendations.map((recommendation) => ({
      id: recommendation.id,
      summary: recommendation.summary[language],
      sourceName: recommendation.sourceRowName,
      targetName: recommendation.targetRowName,
      movePercent: recommendation.suggestedMovePercent,
      evidence: [
        `${recommendation.targetRowName}: ${formatMetric(recommendation.targetReasons[0]?.metrics.result || 0, "number", currency)} ${spec.volumeLabel[language]}, ${formatMetric(recommendation.targetReasons[0]?.metrics.costPerResult || 0, "currency", currency)} ${spec.costLabel[language]}`,
        `${recommendation.sourceRowName}: ${formatMetric(recommendation.sourceReasons[0]?.metrics.spend || 0, "currency", currency)} ${language === "vi" ? "chi tiêu" : "spend"}`,
      ],
    })),
  };
}

function buildActions(
  verdict: Verdict,
  insights: AiInsightTable | null | undefined,
  budgetMove: ReturnType<typeof recommendBudgetMoves>,
  language: InterfaceLanguage,
): ClientReportAction[] {
  const recommendation = budgetMove.recommendations[0];
  const budgetDetails = recommendation
    ? language === "vi"
      ? [
          recommendation.summary.vi,
          `Giữ mức tăng và giảm trong giới hạn ${recommendation.maxIncreasePercent}% mỗi bước để bảo vệ learning phase.`,
        ]
      : [
          recommendation.summary.en,
          `Keep increases and reductions within ${recommendation.maxIncreasePercent}% per step to protect the learning phase.`,
        ]
    : budgetMove.holdReasons[language];
  const budgetActions = verdict.budget_moves.map((title, index) => ({
    kind: "budget" as const,
    title,
    detail: budgetDetails[index] || budgetDetails[0] || budgetMove.summary[language],
  }));
  const testActions = verdict.tests.map((title, index) => ({
    kind: "test" as const,
    title,
    detail: verdict.risks[index] || verdict.assumptions[index] || (language === "vi" ? "Đặt KPI thành công và ngày rà soát trước khi chạy." : "Set the success metric and review date before launch."),
  }));
  const fromVerdict = [...budgetActions, ...testActions];
  const fromInsights = (insights?.rows || []).map((row) => ({ kind: "insight" as const, title: row.action, detail: `${row.area}: ${row.evidence}` }));
  return (fromVerdict.length ? fromVerdict : fromInsights).filter((item) => item.title).slice(0, 6);
}

function generationSourceLabel(verdictProvider: AiProvider, insightProvider: AiProvider | undefined, language: InterfaceLanguage) {
  const hasInsightEnhancement = insightProvider === "9router";
  if (verdictProvider === "9router" && hasInsightEnhancement) {
    return language === "vi" ? "Luật cục bộ + diễn giải và insight 9router" : "Local rules + 9router wording and insights";
  }
  if (verdictProvider === "9router") {
    return language === "vi" ? "Luật cục bộ + diễn giải 9router" : "Local rules + 9router wording";
  }
  if (hasInsightEnhancement) {
    return language === "vi" ? "Verdict cục bộ + insight 9router" : "Local Verdict + 9router insights";
  }
  return language === "vi" ? "Luật quyết định cục bộ" : "Deterministic local rules";
}

function reportSource(report: DashboardReport, language: InterfaceLanguage) {
  if (report.source === "sample") {
    return language === "vi"
      ? {
          label: "Dữ liệu mẫu - không phải Meta API",
          footnote: "Đây là dữ liệu mẫu để xem trước sản phẩm; không dùng cho quyết định ngân sách thực tế.",
        }
      : {
          label: "Sample data - not Meta API",
          footnote: "This is product-preview sample data and must not be used for real budget decisions.",
        };
  }
  return language === "vi"
    ? {
        label: "Meta Ads API",
        footnote: "Số liệu dùng kỳ báo cáo và phạm vi chiến dịch đang chọn. Nguồn dữ liệu: Meta Ads API.",
      }
    : {
        label: "Meta Ads API",
        footnote: "Values use the selected dashboard reporting period and campaign scope. Data source: Meta Ads API.",
      };
}

function selectedPackReason(report: DashboardReport, language: InterfaceLanguage) {
  if (report.selectedPack !== report.detectedPack) {
    return language === "vi"
      ? `Được chọn thủ công; logic báo cáo dùng ${packLabel(report.selectedPack, language)} thay vì gói phát hiện ${packLabel(report.detectedPack, language)}.`
      : `Selected manually; report logic uses ${packLabel(report.selectedPack, language)} instead of detected ${packLabel(report.detectedPack, language)}.`;
  }
  const reasons: Record<KpiPack, { en: string; vi: string }> = {
    messages: {
      en: "Message actions and campaign setup indicate inbox optimization.",
      vi: "Hành động tin nhắn và cấu hình chiến dịch cho thấy mục tiêu tối ưu hộp thư.",
    },
    lead_gen: {
      en: "Lead actions are the strongest complete outcome signal in this scope.",
      vi: "Hành động lead là tín hiệu kết quả đầy đủ mạnh nhất trong phạm vi này.",
    },
    sales_roas: {
      en: "Purchase and revenue signals support sales-efficiency evaluation.",
      vi: "Tín hiệu mua hàng và doanh thu hỗ trợ đánh giá hiệu quả bán hàng.",
    },
    traffic: {
      en: "Link-click activity is the strongest available optimization signal.",
      vi: "Hoạt động click link là tín hiệu tối ưu mạnh nhất hiện có.",
    },
    awareness: {
      en: "No complete lower-funnel signal is available, so delivery quality is the evaluation lens.",
      vi: "Chưa có tín hiệu cuối phễu đầy đủ, nên chất lượng phân phối là tiêu chí đánh giá.",
    },
  };
  return reasons[report.selectedPack][language];
}

function reportSignalList(values: string[] | undefined, kind: "wins" | "losers" | "risks" | "assumptions", language: InterfaceLanguage) {
  const selected = (values || []).filter(Boolean).slice(0, 4);
  if (selected.length) return selected;
  const emptyCopy = {
    en: {
      wins: "No supported winner claim is available in the current scope.",
      losers: "No supported loser claim is available in the current scope.",
      risks: "No additional Verdict risk was identified in the current scope.",
      assumptions: "No additional assumptions were added to the Verdict.",
    },
    vi: {
      wins: "Chưa có kết luận nhóm thắng đủ bằng chứng trong phạm vi hiện tại.",
      losers: "Chưa có kết luận nhóm thua đủ bằng chứng trong phạm vi hiện tại.",
      risks: "Không có rủi ro Verdict bổ sung trong phạm vi hiện tại.",
      assumptions: "Verdict không bổ sung giả định nào khác.",
    },
  } as const;
  return [emptyCopy[language][kind]];
}

type ReportTableMetric = {
  key: keyof NormalizedRow;
  label: { en: string; vi: string };
  format: "currency" | "number" | "percent" | "ratio";
};

function reportTableMetrics(pack: KpiPack): ReportTableMetric[] {
  const spend: ReportTableMetric = { key: "spend", label: { en: "Spend", vi: "Chi tiêu" }, format: "currency" };
  const metrics: Record<KpiPack, ReportTableMetric[]> = {
    messages: [
      spend,
      { key: "messages", label: { en: "Messages", vi: "Tin nhắn" }, format: "number" },
      { key: "costPerMessage", label: { en: "Cost/message", vi: "Chi phí/tin nhắn" }, format: "currency" },
      { key: "replyRate", label: { en: "Reply rate", vi: "Tỷ lệ phản hồi" }, format: "percent" },
    ],
    lead_gen: [
      spend,
      { key: "leads", label: { en: "Leads", vi: "Khách hàng tiềm năng" }, format: "number" },
      { key: "cpl", label: { en: "CPL", vi: "CPL" }, format: "currency" },
      { key: "leadRate", label: { en: "Lead/message", vi: "Lead/tin nhắn" }, format: "percent" },
    ],
    sales_roas: [
      spend,
      { key: "purchases", label: { en: "Purchases", vi: "Lượt mua" }, format: "number" },
      { key: "roas", label: { en: "ROAS", vi: "ROAS" }, format: "ratio" },
      { key: "cpaPurchase", label: { en: "CPA", vi: "CPA" }, format: "currency" },
    ],
    traffic: [
      spend,
      { key: "linkClicks", label: { en: "Link clicks", vi: "Click link" }, format: "number" },
      { key: "cpc", label: { en: "CPC", vi: "CPC" }, format: "currency" },
      { key: "ctr", label: { en: "CTR", vi: "CTR" }, format: "percent" },
    ],
    awareness: [
      spend,
      { key: "reach", label: { en: "Reach", vi: "Người tiếp cận" }, format: "number" },
      { key: "cpm", label: { en: "CPM", vi: "CPM" }, format: "currency" },
      { key: "frequency", label: { en: "Frequency", vi: "Tần suất" }, format: "number" },
    ],
  };
  return metrics[pack];
}

function buildReportTables(report: DashboardReport, language: InterfaceLanguage, currency: string): ClientReportTable[] {
  const metrics = reportTableMetrics(report.selectedPack);
  const columns: ClientReportTableColumn[] = [
    { key: "name", label: language === "vi" ? "Tên" : "Name", weight: 2.6, align: "left" },
    ...metrics.map((metric) => ({ key: metric.key, label: metric.label[language], weight: 1, align: "right" as const })),
  ];
  const buildTable = (title: string, rows: NormalizedRow[]): ClientReportTable => ({
    title,
    columns,
    rows: rows.map((row) => ({
      id: row.id,
      cells: {
        name: reportRowLabel(row),
        ...Object.fromEntries(metrics.map((metric) => [metric.key, formatMetric(Number(row[metric.key] || 0), metric.format, currency)])),
      },
    })),
  });
  return [
    buildTable(language === "vi" ? "Chiến dịch" : "Campaigns", report.campaignRows),
    buildTable(language === "vi" ? "Nhóm quảng cáo" : "Ad sets", report.adsetRows),
    buildTable(language === "vi" ? "Quảng cáo" : "Ads", report.adRows),
    buildTable(language === "vi" ? "Theo ngày" : "Daily", report.dailyRows),
  ];
}

function reportRowLabel(row: NormalizedRow) {
  if (row.level === "daily") return row.date || row.name;
  if (row.platform) return row.platform;
  if (row.placement) return row.placement;
  if (row.region) return row.region;
  if (row.country) return row.country;
  if (row.age && row.gender) return `${row.age} ${row.gender}`;
  return row.name;
}

function projectDiagnosticEvidence(diagnostic: Diagnostic, language: InterfaceLanguage, currency: string) {
  const itemEvidence = diagnostic.items.map((item) => [
    item.title?.[language],
    item.value?.[language],
    item.badge?.text[language],
    ...item.lines.map((line) => line[language]),
  ].filter(Boolean).join(" - "));
  const typedEvidence: string[] = [];

  if (diagnostic.id === "healthTriage") {
    typedEvidence.push(...diagnostic.health.items.slice(0, 4).map((item) => `${item.title[language]}: ${item.detail[language]}`));
  } else if (diagnostic.id === "dailyDiagnosis") {
    typedEvidence.push(...diagnostic.daily.causes.slice(0, 4).map((cause) => `${cause.title[language]}: ${cause.evidence.map((line) => line[language]).join("; ")}`));
  } else if (diagnostic.id === "creativeStarvation") {
    typedEvidence.push(...diagnostic.starvation.adsets.slice(0, 4).map((adset) => `${adset.adsetName}: ${adset.reason[language]}`));
  } else if (diagnostic.id === "budgetMove") {
    typedEvidence.push(...diagnostic.engine.recommendations.slice(0, 4).map((recommendation) => recommendation.summary[language]));
  } else if (diagnostic.id === "funnelLeakage") {
    typedEvidence.push(...diagnostic.leakage.blockers[language]);
    typedEvidence.push(...diagnostic.stages.map((stage) => {
      const benchmark = stage.benchmark === null ? "" : ` / ${language === "vi" ? "mốc" : "benchmark"} ${(stage.benchmark * 100).toFixed(0)}%`;
      return `${stage.label[language]}: ${formatMetric(stage.value, "number", currency)}${benchmark}`;
    }));
  } else if (diagnostic.id === "breakdownWaste") {
    typedEvidence.push(diagnostic.waste.summary[language]);
  }

  return Array.from(new Set([...itemEvidence, ...typedEvidence].filter(Boolean))).slice(0, 6);
}

function formatDateRange(range: DashboardReport["dateRange"], language: InterfaceLanguage) {
  return `${formatDate(range.since, language)} - ${formatDate(range.until, language)}`;
}

function formatDate(value: string, language: InterfaceLanguage) {
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string, language: InterfaceLanguage, includeTime = false) {
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", timeZoneName: "short" } : {}),
  }).format(new Date(value));
}

function packLabel(pack: KpiPack, language: InterfaceLanguage) {
  const labels: Record<KpiPack, { en: string; vi: string }> = {
    messages: { en: "Messages", vi: "Tin nhắn" },
    lead_gen: { en: "Lead generation", vi: "Tạo khách hàng tiềm năng" },
    sales_roas: { en: "Sales / ROAS", vi: "Doanh số / ROAS" },
    traffic: { en: "Traffic", vi: "Lưu lượng" },
    awareness: { en: "Awareness", vi: "Nhận biết" },
  };
  return labels[pack][language];
}

function primaryResultExplanation(pack: KpiPack, result: string, cost: string, language: InterfaceLanguage) {
  if (pack === "awareness") {
    return language === "vi"
      ? `${result} là tín hiệu quy mô; Budget Move được giữ lại vì awareness được đánh giá bằng CTR, CPM và frequency.`
      : `${result} is signal volume; Budget Moves stay on hold because awareness is judged through CTR, CPM, and frequency.`;
  }
  return language === "vi"
    ? `${result} là kết quả dùng để xếp hạng đóng góp; ${cost} thể hiện hiệu quả chi phí.`
    : `${result} is the outcome used to rank contribution; ${cost} expresses cost efficiency.`;
}

function confidenceLabel(confidence: Verdict["confidence"], language: InterfaceLanguage) {
  if (language === "vi") return confidence === "high" ? "Cao" : confidence === "medium" ? "Trung bình" : "Thấp";
  return confidence === "high" ? "High" : confidence === "medium" ? "Medium" : "Low";
}

function localizeKpiLabel(key: string, fallback: string, language: InterfaceLanguage) {
  if (language !== "vi") return fallback;
  const labels: Record<string, string> = {
    spend: "Chi tiêu",
    impressions: "Lượt hiển thị",
    reach: "Người tiếp cận",
    messages: "Tin nhắn",
    costPerMessage: "Chi phí/tin nhắn",
    replyRate: "Tỷ lệ phản hồi",
    leads: "Khách hàng tiềm năng",
    leadRate: "Tỷ lệ lead/tin nhắn",
    purchases: "Lượt mua",
    linkClicks: "Lượt nhấp liên kết",
    frequency: "Tần suất",
    healthScore: "Sức khỏe tài khoản",
  };
  return labels[key] || fallback;
}

function localizeBreakdownRow(row: NormalizedRow, kind: "platform" | "ageGender", language: InterfaceLanguage): NormalizedRow {
  if (kind === "platform") {
    const platformLabels: Record<string, string> = {
      facebook: "Facebook",
      instagram: "Instagram",
      audience_network: "Audience Network",
      messenger: "Messenger",
    };
    return { ...row, name: platformLabels[row.name.toLowerCase()] || row.name, platform: undefined };
  }
  if (language !== "vi") return row;
  const localizedGender = row.gender === "female" ? "Nữ" : row.gender === "male" ? "Nam" : row.gender;
  return { ...row, name: [localizedGender, row.age].filter(Boolean).join(" ") || row.name, age: undefined, gender: undefined };
}

function localizeComparisonEvidence(value: string, language: InterfaceLanguage) {
  if (language !== "vi") return value;
  return value.replace(/Cost\/message/g, "Chi phí/tin nhắn").replace(/Link clicks/g, "Click link").replace(/Purchases/g, "Đơn hàng").replace(/Leads/g, "Lead").replace(/Messages/g, "Tin nhắn").replace(/Spend/g, "Chi tiêu").replace(/ up /g, " tăng ").replace(/ down /g, " giảm ");
}
