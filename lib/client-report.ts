import { buildKpiComparisons, formatComparisonChangePct, metricMovementIsBad } from "@/lib/metric-comparison";
import { formatMetric } from "@/lib/metrics";
import type { AiInsightTable, CompareMode, DashboardReport, InterfaceLanguage, KpiCard, NormalizedRow, Verdict } from "@/lib/types";

export type ClientReportKpi = {
  key: string;
  label: string;
  value: string;
  delta?: string;
  movement: "good" | "bad" | "neutral";
};

export type ClientReportAction = {
  title: string;
  detail: string;
};

export type ClientReportTable = {
  title: string;
  rows: NormalizedRow[];
};

export type ClientReportViewModel = {
  accountName: string;
  dateRange: DashboardReport["dateRange"];
  dateRangeLabel: string;
  generatedLabel: string;
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
    risks: string;
    nextMoves: string;
    footnoteSource: string;
    footnoteComparison: string;
    footnoteRecommendations: string;
  };
  verdictText: string;
  healthLabel: string;
  kpis: ClientReportKpi[];
  wins: string[];
  risks: string[];
  actions: ClientReportAction[];
  insightSummary: string;
  dailyTrend: Array<{ label: string; spend: number; primary: number }>;
  topCampaigns: NormalizedRow[];
  topAdsets: NormalizedRow[];
  breakdowns: {
    platforms: NormalizedRow[];
    regions: NormalizedRow[];
    ageGender: NormalizedRow[];
  };
  tables: ClientReportTable[];
  diagnostics: DashboardReport["health"]["checks"];
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
    subtitle: "A client-ready readout of what happened, what drove performance, and where the evidence supports moving budget next.",
    preparedBy: "Prepared in Decision Workspace",
    source: "Meta Ads API",
    verdictLabel: "Performance verdict",
    executiveSummary: "Executive summary",
    kpiScorecard: "KPI scorecard",
    performanceStory: "Performance story",
    recommendations: "Recommendations",
    appendixCharts: "Appendix A — Charts and breakdowns",
    appendixTables: "Appendix B — Performance tables",
    appendixDiagnostics: "Appendix C — Diagnostics and creative detail",
    wins: "Wins",
    risks: "Risks",
    nextMoves: "Next moves",
    footnoteSource: "Values use the selected dashboard reporting period and campaign scope. Data source: Meta Ads API.",
    footnoteComparison: "Comparison deltas appear when a previous report or recent daily window is available.",
    footnoteRecommendations: "Recommendations combine deterministic account rules with generated insight text when available.",
  },
  vi: {
    title: "Báo cáo hiệu quả Meta Ads",
    subtitle: "Bản báo cáo dành cho khách hàng: chuyện gì đã xảy ra, điều gì tạo ra hiệu quả và evidence hỗ trợ chuyển ngân sách ra sao.",
    preparedBy: "Chuẩn bị trong Decision Workspace",
    source: "Meta Ads API",
    verdictLabel: "Kết luận hiệu quả",
    executiveSummary: "Tóm tắt điều hành",
    kpiScorecard: "Bảng điểm KPI",
    performanceStory: "Câu chuyện hiệu quả",
    recommendations: "Khuyến nghị",
    appendixCharts: "Phụ lục A — Biểu đồ và breakdown",
    appendixTables: "Phụ lục B — Bảng hiệu quả",
    appendixDiagnostics: "Phụ lục C — Chẩn đoán và creative",
    wins: "Điểm tốt",
    risks: "Rủi ro",
    nextMoves: "Bước tiếp theo",
    footnoteSource: "Số liệu dùng kỳ báo cáo và phạm vi campaign đang chọn. Nguồn dữ liệu: Meta Ads API.",
    footnoteComparison: "Chênh lệch so sánh hiển thị khi có báo cáo trước đó hoặc đủ dữ liệu ngày gần nhất.",
    footnoteRecommendations: "Khuyến nghị kết hợp rule chẩn đoán tài khoản và nội dung AI insight khi có.",
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
}): ClientReportViewModel {
  const report = { ...args.report, kpis: args.kpis };
  const languageCopy = copy[args.language];
  const currency = report.account.currency || "VND";
  const comparisons = buildKpiComparisons({
    report,
    previousReport: args.previousReport,
    compareMode: args.compareMode,
    language: args.language,
  });
  const comparisonByKey = new Map(comparisons.map((comparison) => [comparison.key, comparison]));
  const primaryKey = primaryMetricKey(report.selectedPack);

  return {
    accountName: report.account.name,
    dateRange: report.dateRange,
    dateRangeLabel: formatDateRange(report.dateRange, args.language),
    generatedLabel: formatDateTime(report.pulledAt, args.language),
    currency,
    language: args.language,
    copy: languageCopy,
    verdictText: args.verdict?.verdict || defaultVerdict(report, args.language),
    healthLabel: `${report.health.grade} · ${report.health.score}/100`,
    kpis: args.kpis.slice(0, 6).map((kpi) => {
      const key = kpi.key as keyof NormalizedRow;
      const value = kpi.key === "healthScore"
        ? report.health.grade
        : formatMetric(Number(report.totals[key] || 0), kpi.format, currency);
      const comparison = kpi.key === "healthScore" ? undefined : comparisonByKey.get(key);
      return {
        key: kpi.key,
        label: kpi.label,
        value,
        delta: comparison ? `${comparison.change > 0 ? "↑" : comparison.change < 0 ? "↓" : "→"} ${formatComparisonChangePct(comparison.changePct, args.language)} ${comparison.descriptor}` : undefined,
        movement: comparison ? (metricMovementIsBad(kpi.key, comparison.change) ? "bad" : comparison.change === 0 ? "neutral" : "good") : "neutral",
      };
    }),
    wins: pickList(args.verdict?.winners, args.insights?.rows.filter((row) => row.priority === "high").map((row) => row.insight), report.health.checks.filter((check) => check.status === "pass").map((check) => check.detail), args.language),
    risks: pickList(args.verdict?.risks, args.insights?.rows.filter((row) => row.priority !== "low").map((row) => row.evidence), report.health.checks.filter((check) => check.status !== "pass").map((check) => check.detail), args.language),
    actions: buildActions(args.verdict, args.insights, args.language),
    insightSummary: args.insights?.summary || defaultInsightSummary(report, args.language),
    dailyTrend: report.dailyRows.slice(-14).map((row) => ({
      label: row.date ? row.date.slice(5) : row.name,
      spend: row.spend,
      primary: Number(row[primaryKey] || 0),
    })),
    topCampaigns: report.campaignRows.slice(0, 4),
    topAdsets: report.adsetRows.slice(0, 4),
    breakdowns: {
      platforms: report.platformRows.slice(0, 4),
      regions: (report.regionRows.length ? report.regionRows : report.countryRows || []).slice(0, 4),
      ageGender: report.ageGenderRows.slice(0, 4),
    },
    tables: [
      { title: args.language === "vi" ? "Campaign" : "Campaigns", rows: report.campaignRows },
      { title: args.language === "vi" ? "Ad set" : "Ad sets", rows: report.adsetRows },
      { title: "Ads", rows: report.adRows },
      { title: args.language === "vi" ? "Theo ngày" : "Daily", rows: report.dailyRows },
    ],
    diagnostics: report.health.checks,
    creativeDetails: (report.adsetPreviews || []).map((adset) => {
      const adCount = adset.ads.length;
      const adCountLabel = `${adCount} ${adCount === 1 ? "ad" : "ads"}`;
      return {
        name: adset.name,
        campaignName: adset.campaignName,
        status: adset.status,
        adCount,
        adCountLabel,
        summary: `${adset.campaignName} · ${adset.status} · ${adCountLabel}`,
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

function primaryMetricKey(pack: DashboardReport["selectedPack"]): keyof NormalizedRow {
  if (pack === "messages") return "messages";
  if (pack === "sales_roas") return "purchases";
  if (pack === "traffic") return "linkClicks";
  if (pack === "awareness") return "reach";
  return "leads";
}

function formatDateRange(range: DashboardReport["dateRange"], language: InterfaceLanguage) {
  return `${formatDate(range.since, language)} – ${formatDate(range.until, language)}`;
}

function formatDate(value: string, language: InterfaceLanguage) {
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string, language: InterfaceLanguage) {
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function defaultVerdict(report: DashboardReport, language: InterfaceLanguage) {
  if (language === "vi") return `Tài khoản đạt hạng ${report.health.grade}. Nên tối ưu có kiểm soát dựa trên KPI chính và các cảnh báo sức khỏe tài khoản.`;
  return `The account is graded ${report.health.grade}. Optimize carefully based on the primary KPI trend and account health warnings.`;
}

function defaultInsightSummary(report: DashboardReport, language: InterfaceLanguage) {
  if (language === "vi") return `Báo cáo bao gồm ${report.campaignRows.length} campaign, ${report.adsetRows.length} ad set, và ${report.adRows.length} ads trong phạm vi đã chọn.`;
  return `This report covers ${report.campaignRows.length} campaigns, ${report.adsetRows.length} ad sets, and ${report.adRows.length} ads in the selected scope.`;
}

function pickList(primary: string[] | undefined, secondary: string[] | undefined, fallback: string[] | undefined, language: InterfaceLanguage) {
  const picked = (primary?.length ? primary : secondary?.length ? secondary : fallback?.length ? fallback : []).filter(Boolean).slice(0, 3);
  if (picked.length) return picked;
  return language === "vi" ? ["Chưa có đủ tín hiệu nổi bật trong phạm vi hiện tại."] : ["No standout signal is available in the current scope yet."];
}

function buildActions(verdict: Verdict | null | undefined, insights: AiInsightTable | null | undefined, language: InterfaceLanguage): ClientReportAction[] {
  const fromVerdict = [
    ...(verdict?.budget_moves || []),
    ...(verdict?.tests || []),
  ].map((item) => ({ title: item, detail: language === "vi" ? "Ưu tiên kiểm tra trong kỳ tối ưu tiếp theo." : "Prioritize this in the next optimization cycle." }));

  const fromInsights = (insights?.rows || []).map((row) => ({ title: row.action, detail: `${row.area}: ${row.evidence}` }));
  const actions = (fromVerdict.length ? fromVerdict : fromInsights).filter((item) => item.title).slice(0, 4);

  if (actions.length) return actions;
  return language === "vi"
    ? [{ title: "Giữ phạm vi tối ưu tập trung", detail: "Ưu tiên các campaign/ad set có dữ liệu rõ ràng trước khi scale." }]
    : [{ title: "Keep optimization focused", detail: "Prioritize campaigns and ad sets with clear evidence before scaling." }];
}
