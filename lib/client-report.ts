import { analyzeComparisonRootCauses, type ComparisonRootCauseStatus } from "@/lib/comparison-root-cause";
import { extractMetaAdPreviewUrl } from "@/lib/ad-preview-html";
import { buildCustomChartData, metricFormat, metricLabel, type CustomChartSpec } from "@/lib/custom-chart";
import { type DecisionTargets } from "@/lib/decision-confidence";
import { runDiagnostics, type Diagnostic, type DiagnosticSeverity } from "@/lib/diagnosis";
import { summarizeHealth, type HealthScoreSummary } from "@/lib/health-score";
import { buildKpiComparisons, comparisonFootnote, formatComparisonChangePct, metricMovementIsBad } from "@/lib/metric-comparison";
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
  why: string;
  monitor: string;
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

export type ClientReportTableGuide = {
  title: string;
  items: string[];
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
  referenceNote: string | null;
};

export type ClientReportBreakdownRow = {
  id: string;
  name: string;
  spend: number;
  spendLabel: string;
  spendShare: number;
  spendShareLabel: string;
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
    platforms: ClientReportBreakdownRow[];
    regions: ClientReportBreakdownRow[];
    ageGender: ClientReportBreakdownRow[];
  };
  tables: ClientReportTable[];
  tableGuide: ClientReportTableGuide;
  diagnostics: ClientReportDiagnostic[];
  creativeDetails: Array<{
    id: string;
    name: string;
    adsetName: string;
    campaignName: string;
    status: string;
    summary: string;
    previewUrl: string;
    previewImageUrl: string | null;
  }>;
};

const copy = {
  en: {
    title: "Meta Ads Performance Report",
    subtitle: "A clear view of performance, the evidence behind it, and the decisions to make next.",
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
    wins: "Strong signals",
    losers: "Needs improvement",
    risks: "Risks",
    assumptions: "Assumptions",
    nextMoves: "Next moves",
    selectedPack: "Selected KPI Pack",
    primaryResult: "Primary Result",
    confidence: "Decision confidence",
    dataPulled: "Data pulled",
    comparisonDrivers: "Period-over-period drivers",
    dailyDiagnosis: "Daily diagnosis",
    customCharts: "Saved Custom Charts",
    footnoteSource: "Values use the selected dashboard reporting period and campaign scope. Data source: Meta Ads API.",
    footnoteComparison: "Comparison deltas appear when a previous report is available.",
    footnoteRecommendations: "Budget recommendations are limited to changes supported by this report. Generated wording does not add new claims.",
  },
  vi: {
    title: "Báo cáo hiệu quả Meta Ads",
    subtitle: "Góc nhìn rõ ràng về hiệu quả, bằng chứng phía sau và các quyết định tiếp theo.",
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
    wins: "Tín hiệu tích cực",
    losers: "Điểm cần cải thiện",
    risks: "Rủi ro",
    assumptions: "Giả định",
    nextMoves: "Bước tiếp theo",
    selectedPack: "Gói KPI đã chọn",
    primaryResult: "Kết quả chính",
    confidence: "Độ tin cậy quyết định",
    dataPulled: "Thời điểm kéo dữ liệu",
    comparisonDrivers: "Động lực giữa hai kỳ",
    dailyDiagnosis: "Chẩn đoán theo ngày",
    customCharts: "Biểu đồ tùy chỉnh đã lưu",
    footnoteSource: "Số liệu dùng kỳ báo cáo và phạm vi chiến dịch đang chọn. Nguồn dữ liệu: Meta Ads API.",
    footnoteComparison: "Chênh lệch so sánh hiển thị khi có báo cáo kỳ trước.",
    footnoteRecommendations: "Khuyến nghị ngân sách chỉ bao gồm thay đổi được dữ liệu trong báo cáo hỗ trợ. Nội dung tạo sinh không bổ sung kết luận mới.",
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
    verdictText: clientFacingText(verdict.verdict, args.language),
    verdictConfidenceLabel: confidenceLabel(verdict.confidence, args.language),
    healthScore: healthSummary.score,
    healthGrade: healthSummary.grade,
    healthLabel: `${healthSummary.grade} · ${healthSummary.score}/100`,
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
        : formatClientReportKpiMetric(Number(report.totals[key] || 0), kpi.format, currency, args.language);
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
    actions: buildActions(
      verdict,
      args.insights,
      budgetMove,
      args.language,
      primarySpec.volumeLabel[args.language],
      primarySpec.costLabel[args.language],
    ),
    budgetMove: localizeBudgetMove(budgetMove, args.language, currency, report.selectedPack),
    insightSummary: args.insights?.summary ? clientFacingText(args.insights.summary, args.language) : null,
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
        label: clientReportMetricLabel(series.key, args.language),
        axis: series.axis,
        format: metricFormat(series.key),
      })),
      data: buildCustomChartData(report.dailyRows, spec),
      referenceNote: customChartReferenceNote(spec, primaryKey, primarySpec.volumeLabel[args.language], args.language),
    })),
    breakdowns: {
      platforms: buildBreakdownRows(report.platformRows, "platform", args.language, currency),
      regions: buildBreakdownRows(report.regionRows.length ? report.regionRows : report.countryRows || [], "geography", args.language, currency),
      ageGender: buildBreakdownRows(report.ageGenderRows, "ageGender", args.language, currency),
    },
    tables: buildReportTables(report, args.language, currency),
    tableGuide: buildTableGuide(args.language),
    diagnostics: diagnostics.map((diagnostic) => ({
      id: diagnostic.id,
      severity: diagnostic.severity,
      title: clientFacingText(diagnostic.title[args.language], args.language),
      description: clientFacingText(diagnostic.description[args.language], args.language),
      badge: clientFacingText(diagnostic.badge[args.language], args.language),
      summary: clientFacingText(diagnostic.summary?.[args.language] || diagnostic.description[args.language], args.language),
      evidence: projectDiagnosticEvidence(diagnostic, args.language, currency),
      nextStep: clientFacingText(diagnostic.nextStep[args.language], args.language),
    })),
    creativeDetails: (report.adsetPreviews || []).flatMap((adset) =>
      adset.ads.map((ad) => ({
        id: ad.id,
        name: ad.name || ad.id,
        adsetName: adset.name,
        campaignName: adset.campaignName,
        status: adset.status,
        summary: `${adset.campaignName} / ${adset.name}`,
        previewUrl: extractMetaAdPreviewUrl(ad.previewHtml) || metaAdManagerUrl(report.account.id, ad.id),
        previewImageUrl: ad.previewImageUrl?.trim() || null,
      })),
    ),
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
        spendLabel: formatClientReportMetric(row.spend, "currency", currency, language),
        spendShare: (row.spend / totalSpend) * 100,
        primary,
        primaryLabel: formatClientReportMetric(primary, "number", currency, language),
        primaryShare: (primary / totalPrimary) * 100,
        efficiency: efficiencyValue,
        efficiencyLabel: efficiency.label[language],
        efficiencyValue: formatClientReportCompactMetric(efficiencyValue, efficiency.format, currency, language),
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
    label: clientFacingText(result.label[language], language),
    summary: clientFacingText(result.summary[language], language),
    holdReasons: result.holdReasons[language].map((reason) => clientFacingText(reason, language)),
    recommendations: result.recommendations.map((recommendation) => ({
      id: recommendation.id,
      summary: clientFacingText(recommendation.summary[language], language),
      sourceName: recommendation.sourceRowName,
      targetName: recommendation.targetRowName,
      movePercent: recommendation.suggestedMovePercent,
      evidence: [
        `${recommendation.targetRowName}: ${formatClientReportMetric(recommendation.targetReasons[0]?.metrics.result || 0, "number", currency, language)} ${spec.volumeLabel[language]}, ${formatClientReportMetric(recommendation.targetReasons[0]?.metrics.costPerResult || 0, "currency", currency, language)} ${spec.costLabel[language]}`,
        `${recommendation.sourceRowName}: ${formatClientReportMetric(recommendation.sourceReasons[0]?.metrics.spend || 0, "currency", currency, language)} ${language === "vi" ? "chi tiêu" : "spend"}`,
      ],
    })),
  };
}

function buildActions(
  verdict: Verdict,
  insights: AiInsightTable | null | undefined,
  budgetMove: ReturnType<typeof recommendBudgetMoves>,
  language: InterfaceLanguage,
  primaryResultLabel: string,
  primaryCostLabel: string,
): ClientReportAction[] {
  const recommendation = budgetMove.recommendations[0];
  const budgetDetails = recommendation
    ? language === "vi"
      ? [
          recommendation.summary.vi,
          `Giữ mức tăng và giảm trong giới hạn ${recommendation.maxIncreasePercent}% ở mỗi bước để hạn chế biến động phân phối.`,
        ]
      : [
          recommendation.summary.en,
          `Keep increases and reductions within ${recommendation.maxIncreasePercent}% per step to limit delivery disruption.`,
        ]
    : budgetMove.holdReasons[language];
  const budgetActions = verdict.budget_moves.map((title, index) => ({
    kind: "budget" as const,
    title: conciseActionTitle(clientFacingText(title, language), language),
    why: clientFacingText(budgetDetails[index] || budgetDetails[0] || budgetMove.summary[language], language),
    monitor: actionMonitor(primaryResultLabel, primaryCostLabel, language),
  }));
  const testActions = verdict.tests.map((title, index) => ({
    kind: "test" as const,
    title: conciseActionTitle(clientFacingText(title, language), language),
    why: clientFacingText(actionEvidence(title, index, verdict, language), language),
    monitor: actionMonitor(primaryResultLabel, primaryCostLabel, language),
  }));
  const fromVerdict = [...budgetActions, ...testActions];
  const fromInsights = (insights?.rows || []).map((row) => ({
    kind: "insight" as const,
    title: conciseActionTitle(clientFacingText(row.action, language), language),
    why: clientFacingText(`${row.area}: ${row.evidence}`, language),
    monitor: actionMonitor(primaryResultLabel, primaryCostLabel, language),
  }));
  return (fromVerdict.length ? fromVerdict : fromInsights).filter((item) => item.title).slice(0, 6);
}

function actionEvidence(title: string, index: number, verdict: Verdict, language: InterfaceLanguage) {
  const evidence = [...verdict.risks, ...verdict.assumptions].filter(Boolean);
  const isCreativeAction = /creative|ad concepts?|mẫu quảng cáo|ý tưởng quảng cáo/i.test(title);
  const isMeasurementAction = /measurement|tracking|pixel|capi|đo lường/i.test(title);
  const matched = isCreativeAction
    ? evidence.find((item) => /creative|ad sets?|mẫu quảng cáo|nhóm quảng cáo/i.test(item))
    : isMeasurementAction
      ? evidence.find((item) => /measurement|tracking|pixel|capi|crm|đo lường/i.test(item))
      : undefined;
  return matched
    || verdict.risks[index]
    || verdict.assumptions[index]
    || (language === "vi" ? "Cần xác nhận tín hiệu kết quả trước khi thay đổi ngân sách." : "The result signal needs validation before the next budget change.");
}

function actionMonitor(primaryResultLabel: string, primaryCostLabel: string, language: InterfaceLanguage) {
  return language === "vi"
    ? `Theo dõi ${primaryResultLabel}, ${primaryCostLabel} và độ ổn định phân phối.`
    : `Track ${primaryResultLabel}, ${primaryCostLabel}, and delivery stability.`;
}

function conciseActionTitle(value: string, language: InterfaceLanguage) {
  if (language === "vi") {
    return value
      .replace(/^Có thể tăng (.+?) tối đa (\d+%) sau khi.+$/i, "Tăng $1 tối đa $2")
      .replace(/^(Giảm hoặc giữ trần [^;]+);.+$/i, "$1")
      .replace(/^Chuẩn bị ít nhất 3-5 ý tưởng quảng cáo khác biệt.+$/i, "Chuẩn bị 3-5 ý tưởng quảng cáo khác biệt")
      .replace(/^Kiểm tra chất lượng đo lường trước khi tăng ngân sách:.+$/i, "Xác nhận chất lượng đo lường");
  }
  return value
    .replace(/^Consider increasing (.+?) by up to (\d+%) after.+$/i, "Increase $1 by up to $2")
    .replace(/^(Reduce or cap [^;]+);.+$/i, "$1")
    .replace(/^Prepare at least 3-5 distinct ad concepts.+$/i, "Prepare 3-5 distinct ad concepts")
    .replace(/^Check measurement quality before increasing budget:.+$/i, "Confirm measurement quality");
}

function generationSourceLabel(verdictProvider: AiProvider, insightProvider: AiProvider | undefined, language: InterfaceLanguage) {
  const hasInsightEnhancement = insightProvider === "9router";
  if (verdictProvider === "9router" && hasInsightEnhancement) {
    return language === "vi" ? "Luật quyết định cục bộ + diễn giải và nhận định 9router" : "Local rules + 9router wording and insights";
  }
  if (verdictProvider === "9router") {
    return language === "vi" ? "Luật quyết định cục bộ + diễn giải 9router" : "Local rules + 9router wording";
  }
  if (hasInsightEnhancement) {
    return language === "vi" ? "Luật quyết định cục bộ + nhận định 9router" : "Local decision rules + 9router insights";
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
      vi: "Hành động của khách hàng tiềm năng là tín hiệu kết quả đầy đủ mạnh nhất trong phạm vi này.",
    },
    sales_roas: {
      en: "Purchase and revenue signals support sales-efficiency evaluation.",
      vi: "Tín hiệu mua hàng và doanh thu hỗ trợ đánh giá hiệu quả bán hàng.",
    },
    traffic: {
      en: "Link-click activity is the strongest available optimization signal.",
      vi: "Lượt nhấp liên kết là tín hiệu tối ưu mạnh nhất hiện có.",
    },
    awareness: {
      en: "No complete lower-funnel signal is available, so delivery quality is the evaluation lens.",
      vi: "Chưa có tín hiệu cuối phễu đầy đủ, nên chất lượng phân phối là tiêu chí đánh giá.",
    },
  };
  return reasons[report.selectedPack][language];
}

function reportSignalList(values: string[] | undefined, kind: "wins" | "losers" | "risks" | "assumptions", language: InterfaceLanguage) {
  const selected = (values || []).filter(Boolean).slice(0, 4).map((value) => clientFacingText(value, language));
  if (selected.length) return selected;
  const emptyCopy = {
    en: {
      wins: "No positive performance claim has enough evidence in the current scope.",
      losers: "No underperforming segment has enough evidence for a firm conclusion.",
      risks: "No additional risk was identified in the current scope.",
      assumptions: "No additional assumptions were added to this decision.",
    },
    vi: {
      wins: "Chưa có tín hiệu tích cực đủ bằng chứng trong phạm vi hiện tại.",
      losers: "Chưa có phân khúc kém hiệu quả đủ bằng chứng để kết luận chắc chắn.",
      risks: "Không có rủi ro bổ sung trong phạm vi hiện tại.",
      assumptions: "Không có giả định bổ sung cho quyết định này.",
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
  const primarySpec = primaryResultSpec(report.selectedPack);
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
        ...Object.fromEntries(metrics.map((metric) => {
          const hasNoPrimaryResult = Number(row[primarySpec.volumeKey] || 0) <= 0;
          const isPrimaryCost = primarySpec.costKey === metric.key;
          return [
            metric.key,
            hasNoPrimaryResult && isPrimaryCost
              ? "—"
              : formatClientReportMetric(Number(row[metric.key] || 0), metric.format, currency, language),
          ];
        })),
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

function buildTableGuide(language: InterfaceLanguage): ClientReportTableGuide {
  if (language === "vi") {
    return {
      title: "Cách đọc các bảng này",
      items: [
        "Chiến dịch, nhóm quảng cáo và quảng cáo là các cấp khác nhau của cùng tài khoản. Không cộng tổng giữa các bảng.",
        "Dấu gạch ngang (—) nghĩa là chưa ghi nhận kết quả chính, nên chỉ số chi phí liên quan không áp dụng.",
        "Các dòng theo ngày thuộc kỳ báo cáo đã chọn và hỗ trợ biểu đồ xu hướng; xem phần Khuyến nghị để quyết định hành động tiếp theo.",
      ],
    };
  }
  return {
    title: "How to read these tables",
    items: [
      "Campaign, ad set, and ad rows are different levels of the same account. Do not add totals across the tables.",
      "A dash (—) means no primary result was recorded, so the related cost metric is not applicable.",
      "Daily rows cover the selected reporting period and support the trend view; use Recommendations for the next action.",
    ],
  };
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
    item.value?.[language] ? clientFacingText(item.value[language], language) : undefined,
    item.badge?.text[language] ? clientFacingText(item.badge.text[language], language) : undefined,
    ...item.lines.map((line) => clientFacingText(line[language], language)),
  ].filter(Boolean).join(" - "));
  const typedEvidence: string[] = [];

  if (diagnostic.id === "healthTriage") {
    typedEvidence.push(...diagnostic.health.items.slice(0, 4).map((item) => projectHealthEvidence(item.id, item.title[language], item.detail[language], language)));
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
      return `${stage.label[language]}: ${formatClientReportMetric(stage.value, "number", currency, language)}${benchmark}`;
    }));
  } else if (diagnostic.id === "breakdownWaste") {
    typedEvidence.push(diagnostic.waste.summary[language]);
  }

  return Array.from(new Set([...itemEvidence, ...typedEvidence].filter(Boolean).map((value) => clientFacingText(value, language)))).slice(0, 6);
}

function projectHealthEvidence(id: string, fallbackTitle: string, fallbackDetail: string, language: InterfaceLanguage) {
  const healthCopy: Record<string, { en: [string, string]; vi: [string, string] }> = {
    "health-M-CR4": {
      en: ["CTR benchmark", fallbackDetail.replace("Pack benchmark pass >=", "Target for this KPI pack: at least")],
      vi: ["Mốc tham chiếu CTR", fallbackDetail.replace("Pack benchmark pass >=", "Mức đạt của gói KPI >=").replace(/(\d+)\.(\d+)/g, "$1,$2")],
    },
    "health-M-CR2": {
      en: ["New-audience frequency", fallbackDetail],
      vi: ["Tần suất tìm khách hàng mới", fallbackDetail.replace("Average frequency", "Tần suất trung bình").replace(/(\d+)\.(\d+)/g, "$1,$2")],
    },
    "health-M25": {
      en: ["Creative volume", fallbackDetail.replace(/(\d+) ads found in selected scope\. Target: 10\+ diverse creatives where budget supports it\./, "$1 ads in the selected scope. Guideline: at least 10 varied ads when budget allows.")],
      vi: ["Số lượng mẫu quảng cáo", fallbackDetail.replace(/(\d+) ads found in selected scope\. Target: 10\+ diverse creatives where budget supports it\./, "$1 mẫu quảng cáo trong phạm vi đã chọn. Mục tiêu: từ 10 mẫu đa dạng khi ngân sách cho phép.")],
    },
    "health-M11": {
      en: ["Campaign structure", fallbackDetail.replace(/(\d+) selected campaigns\. Meta prefers fewer campaigns per goal\./, "$1 selected campaigns. Fewer campaigns per objective can help Meta learn.")],
      vi: ["Cấu trúc chiến dịch", fallbackDetail.replace(/(\d+) selected campaigns\. Meta prefers fewer campaigns per goal\./, "$1 chiến dịch đã chọn. Meta ưu tiên ít chiến dịch hơn cho mỗi mục tiêu.")],
    },
  };
  const [title, detail] = healthCopy[id]?.[language] || [fallbackTitle, fallbackDetail];
  return `${title}: ${detail}`;
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
      ? `${result} cho biết quy mô tiếp cận. Báo cáo chưa đề xuất tăng ngân sách vì hiệu quả nhận biết cần được đọc cùng CTR, CPM và tần suất.`
      : `${result} shows delivery scale. The report does not recommend a budget increase until CTR, CPM, and frequency support it.`;
  }
  return language === "vi"
    ? `Báo cáo dùng ${result} để xác định nơi tạo ra kết quả và dùng ${cost} để so sánh hiệu quả chi phí.`
    : `The report uses ${result} to show where results came from and ${cost} to compare cost efficiency.`;
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

function localizeBreakdownRow(row: NormalizedRow, kind: "platform" | "ageGender" | "geography", language: InterfaceLanguage): NormalizedRow {
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

function buildBreakdownRows(
  rows: NormalizedRow[],
  kind: "platform" | "ageGender" | "geography",
  language: InterfaceLanguage,
  currency: string,
): ClientReportBreakdownRow[] {
  const totalSpend = Math.max(1, rows.reduce((sum, row) => sum + row.spend, 0));
  return rows.slice(0, 4).map((row) => {
    const localized = localizeBreakdownRow(row, kind, language);
    const spendShare = (row.spend / totalSpend) * 100;
    return {
      id: row.id,
      name: reportRowLabel(localized),
      spend: row.spend,
      spendLabel: formatClientReportMetric(row.spend, "currency", currency, language),
      spendShare,
      spendShareLabel: `${spendShare.toLocaleString(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 1 })}%`,
    };
  });
}

function customChartReferenceNote(
  spec: CustomChartSpec,
  primaryKey: keyof NormalizedRow,
  primaryResultLabel: string,
  language: InterfaceLanguage,
) {
  if (spec.series.some((series) => series.key === primaryKey)) return null;
  const metrics = spec.series.map((series) => clientReportMetricLabel(series.key, language)).join(language === "vi" ? " và " : " and ");
  return language === "vi"
    ? `Biểu đồ tham khảo đã lưu dùng ${metrics}. KPI chính của báo cáo vẫn là ${primaryResultLabel}.`
    : `Saved reference view using ${metrics}. The report's primary KPI remains ${primaryResultLabel}.`;
}

function clientReportMetricLabel(key: CustomChartSpec["series"][number]["key"], language: InterfaceLanguage) {
  if (language === "vi" && key === "leads") return "Khách hàng tiềm năng";
  return metricLabel(key, language);
}

export function formatClientReportMetric(
  value: number,
  format: KpiCard["format"],
  currency: string,
  language: InterfaceLanguage,
) {
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const numericValue = value || 0;
  if (format === "currency") {
    if (currency === "VND") {
      return `${numericValue.toLocaleString(locale, { maximumFractionDigits: 0 })} VND`;
    }
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(numericValue);
  }
  if (format === "percent") return `${numericValue.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
  if (format === "ratio") return `${numericValue.toLocaleString(locale, { maximumFractionDigits: 2 })}x`;
  return numericValue.toLocaleString(locale, { maximumFractionDigits: 0 });
}

function formatClientReportKpiMetric(
  value: number,
  format: KpiCard["format"],
  currency: string,
  language: InterfaceLanguage,
) {
  if (format === "number" || (format === "currency" && currency === "VND")) {
    const absolute = Math.abs(value);
    const locale = language === "vi" ? "vi-VN" : "en-US";
    const compact = absolute >= 1_000_000
      ? `${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })}M`
      : absolute >= 100_000
        ? `${(value / 1_000).toLocaleString(locale, { maximumFractionDigits: 0 })}K`
        : null;
    if (compact) return format === "currency" ? `${compact} VND` : compact;
  }
  return formatClientReportMetric(value, format, currency, language);
}

export function formatClientReportCompactMetric(
  value: number,
  format: KpiCard["format"],
  currency: string,
  language: InterfaceLanguage,
) {
  if ((format === "currency" && currency === "VND") || format === "number") {
    const absolute = Math.abs(value);
    const locale = language === "vi" ? "vi-VN" : "en-US";
    if (absolute >= 1_000_000) {
      const compact = `${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })}M`;
      return format === "currency" ? `${compact} VND` : compact;
    }
  }
  return formatClientReportMetric(value, format, currency, language);
}

function clientFacingText(value: string, language: InterfaceLanguage) {
  if (!value) return value;
  if (language === "vi") {
    return value
      .replace(/(\d+) dòng đang bị hạ cấp vì chưa đủ bằng chứng quyết định\./gi, "$1 dòng chỉ nên theo dõi vì bằng chứng chưa đủ mạnh để thay đổi ngân sách.")
      .replace(/Xem các dòng bị hạ cấp là chỉ theo dõi đến khi phân phối ổn định\./gi, "Giữ nguyên các dòng chỉ theo dõi cho đến khi phân phối ổn định.")
      .replace(/Chưa dừng hoặc tăng ngân sách ở các dòng bị hạ cấp; cần tích lũy thêm bằng chứng\./gi, "Chưa dừng hoặc tăng ngân sách ở các dòng chỉ theo dõi; cần tích lũy thêm bằng chứng.")
      .replace(/để Meta khám phá (?:delivery|phân phối) ổn định/gi, "để Meta phân phối ổn định hơn")
      .replace(/Meta retrieval/gi, "hệ thống phân phối của Meta")
      .replace(/learning phase/gi, "giai đoạn học")
      .replace(/cost cap/gi, "giới hạn chi phí")
      .replace(/bid cap/gi, "giới hạn giá thầu")
      .replace(/CRM matchback/gi, "đối soát CRM")
      .replace(/event deduplication/gi, "kiểm tra sự kiện trùng lặp")
      .replace(/kill\/scale/gi, "dừng hoặc tăng ngân sách")
      .replace(/guardrails?/gi, "giới hạn an toàn")
      .replace(/prospecting/gi, "tìm khách hàng mới")
      .replace(/retargeting/gi, "tiếp thị lại")
      .replace(/delivery/gi, "phân phối")
      .replace(/tracking/gi, "đo lường")
      .replace(/creatives?/gi, "mẫu quảng cáo")
      .replace(/campaigns?/gi, "chiến dịch")
      .replace(/ad sets?/gi, "nhóm quảng cáo")
      .replace(/learning/gi, "giai đoạn học")
      .replace(/portfolio/gi, "tổng danh mục")
      .replace(/dataset/gi, "dữ liệu")
      .replace(/checkout/gi, "thanh toán")
      .replace(/click link/gi, "lượt nhấp liên kết")
      .replace(/\bactive\b/gi, "đang hoạt động")
      .replace(/\bvolume\b/gi, "số lượng")
      .replace(/\bCV\b/g, "Chuyển đổi")
      .replace(/benchmarks?/gi, "mốc tham chiếu")
      .replace(/breakdown/gi, "phân nhóm")
      .replace(/insights?/gi, "nhận định")
      .replace(/Verdict/gi, "kết luận")
      .replace(/scale/gi, "tăng ngân sách")
      .replace(/\btests?\b/gi, "thử nghiệm")
      .replace(/launch/gi, "khởi chạy");
  }
  const exactEnglish = {
    "budget move engine": "Budget recommendation",
    "creative starvation": "Creative distribution",
    "cost cap delivery": "Cost-control delivery",
    "consolidation pressure": "Campaign consolidation",
  } as const;
  const exactReplacement = exactEnglish[value.trim().toLowerCase() as keyof typeof exactEnglish];
  if (exactReplacement) return exactReplacement;
  return value
    .replace(/Rolls key checks into one prioritized action queue\./gi, "Summarizes the checks that need attention first.")
    .replace(/Combines measurement, account health, and creative signals before launch decisions\./gi, "Checks measurement, account health, and creative coverage before an experiment starts.")
    .replace(/Some served ad sets may not have enough active\/spent creatives for reliable Meta delivery exploration\./gi, "Some served ad sets may not have enough ads with delivery or spend to support stable Meta delivery.")
    .replace(/Only 1 active\/spent creatives/gi, "Only 1 ad has delivery or spend")
    .replace(/Only (\d+) active\/spent creatives/gi, "Only $1 ads have delivery or spend")
    .replace(/(\d+) active\/spent creatives/gi, "$1 ads with delivery or spend")
    .replace(/fewer than 3 is a creative-volume constraint/gi, "fewer than 3 limits creative variety")
    .replace(/Creative spend is distributed reasonably, or dominant creatives are not fatigued\./gi, "Spend is distributed across ads, and no dominant ad shows clear fatigue.")
    .replace(/(\d+) row is downgraded because decision evidence is not strong enough\./gi, "$1 row remains watch-only because decision evidence is not strong enough.")
    .replace(/(\d+) rows are downgraded because decision evidence is not strong enough\./gi, "$1 rows remain watch-only because decision evidence is not strong enough.")
    .replace(/Treat downgraded rows as watch-only until delivery stabilizes\./gi, "Keep watch-only rows unchanged until delivery stabilizes.")
    .replace(/Do not pause or increase budget on downgraded rows until they gather more evidence\./gi, "Do not pause or increase budget on watch-only rows until they gather more evidence.")
    .replace(/hard pause or increase budget decision/gi, "firm pause or budget-increase decision")
    .replace(/ - Monitor - /g, " - Watch - ")
    .replace(/Conv\/adset\/week/gi, "Conversions/ad set/week")
    .replace(/No campaign daily budget data available/gi, "No campaign daily budget data is available")
    .replace(/cost cap delivery efficiency/gi, "cost-control efficiency")
    .replace(/ad-creative risks/gi, "creative coverage risks")
    .replace(/Budget Move Engine/gi, "budget recommendation logic")
    .replace(/Budget Moves?/gi, "budget recommendations")
    .replace(/budget-owning rows?/gi, "campaigns or ad sets with budget")
    .replace(/Meta retrieval/gi, "Meta's delivery system")
    .replace(/CRM matchback/gi, "CRM reconciliation")
    .replace(/event deduplication/gi, "duplicate-event checks")
    .replace(/kill\/scale/gi, "pause or increase budget")
    .replace(/source-to-target transfer/gi, "budget shift")
    .replace(/portfolio risk/gi, "dependency risk")
    .replace(/dataset/gi, "available data")
    .replace(/Scaling/g, "Increasing budget")
    .replace(/scaling/g, "increasing budget")
    .replace(/Scale/g, "Increase budget")
    .replace(/scale/g, "increase budget")
    .replace(/guardrails?/gi, "safety limits")
    .replace(/guarded/gi, "controlled");
}

function metaAdManagerUrl(accountId: string, adId: string) {
  const account = accountId.replace(/^act_/, "");
  const params = new URLSearchParams({ act: account, selected_ad_ids: adId });
  return `https://www.facebook.com/adsmanager/manage/ads/edit/standalone?${params.toString()}`;
}

function localizeComparisonEvidence(value: string, language: InterfaceLanguage) {
  if (language !== "vi") return value;
  return value.replace(/Cost\/message/g, "Chi phí/tin nhắn").replace(/Link clicks/g, "Click link").replace(/Purchases/g, "Đơn hàng").replace(/Leads/g, "Lead").replace(/Messages/g, "Tin nhắn").replace(/Spend/g, "Chi tiêu").replace(/ up /g, " tăng ").replace(/ down /g, " giảm ");
}
