import { jsPDF } from "jspdf";
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
    ads: string[];
  }>;
};

const copy = {
  en: {
    title: "Meta Ads Performance Report",
    subtitle: "A client-ready readout of what happened, what drove performance, and where Red Agency recommends moving budget next.",
    preparedBy: "Prepared by Red Agency",
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
    subtitle: "Bản báo cáo dành cho khách hàng: chuyện gì đã xảy ra, điều gì tạo ra hiệu quả, và Red Agency khuyến nghị chuyển ngân sách ra sao.",
    preparedBy: "Chuẩn bị bởi Red Agency",
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
    topCampaigns: report.campaignRows.slice(0, 8),
    topAdsets: report.adsetRows.slice(0, 8),
    breakdowns: {
      platforms: report.platformRows.slice(0, 8),
      regions: (report.regionRows.length ? report.regionRows : report.countryRows || []).slice(0, 8),
      ageGender: report.ageGenderRows.slice(0, 8),
    },
    tables: [
      { title: args.language === "vi" ? "Campaign" : "Campaigns", rows: report.campaignRows },
      { title: args.language === "vi" ? "Ad set" : "Ad sets", rows: report.adsetRows },
      { title: "Ads", rows: report.adRows },
      { title: args.language === "vi" ? "Theo ngày" : "Daily", rows: report.dailyRows },
    ],
    diagnostics: report.health.checks,
    creativeDetails: (report.adsetPreviews || []).map((adset) => ({
      name: adset.name,
      campaignName: adset.campaignName,
      status: adset.status,
      adCount: adset.ads.length,
      ads: adset.ads.map((ad) => ad.name || ad.id).slice(0, 6),
    })),
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

export function buildClientReportPdf(model: ClientReportViewModel): ClientReportPdfFile {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 42;
  const filename = `${slugify(model.accountName)}-meta-ads-report-${model.dateRange.since}-to-${model.dateRange.until}.pdf`;

  const text = (value: string) => pdfText(value);

  const addFooter = (page: string, footnote?: string) => {
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, height - 54, width - margin, height - 54);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(102, 112, 133);
    doc.text("Red Agency", margin, height - 34);
    doc.text(text(page), width / 2, height - 34, { align: "center" });
    doc.text(text(model.accountName), width - margin, height - 34, { align: "right" });
    if (footnote) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(text(footnote), width - margin * 2), margin, height - 72);
    }
  };

  const addHeader = (section: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(102, 112, 133);
    doc.text(text(section).toUpperCase(), margin, 36);
    doc.text(text(model.dateRangeLabel).toUpperCase(), width - margin, 36, { align: "right" });
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, 48, width - margin, 48);
  };

  const addTitle = (kicker: string, title: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(102, 112, 133);
    doc.text(text(kicker).toUpperCase(), margin, y);
    doc.setFontSize(24);
    doc.setTextColor(17, 24, 39);
    doc.text(text(title), margin, y + 28);
  };

  const addBullets = (title: string, items: string[], x: number, y: number, maxWidth: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(text(title), x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 84, 103);
    let cursor = y + 18;
    items.forEach((item) => {
      const lines = doc.splitTextToSize(text(`- ${item}`), maxWidth);
      doc.text(lines, x, cursor);
      cursor += lines.length * 12 + 6;
    });
  };

  const addRows = (title: string, rows: NormalizedRow[], y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(text(title), margin, y);
    doc.setFontSize(8);
    doc.setTextColor(52, 64, 84);
    let cursor = y + 18;
    rows.slice(0, 8).forEach((row) => {
      doc.text(text(row.date || row.name.slice(0, 42)), margin, cursor);
      doc.text(text(formatMetric(row.spend, "currency", model.currency)), width - margin, cursor, { align: "right" });
      cursor += 14;
    });
  };

  doc.setFillColor(9, 9, 9);
  doc.rect(0, 0, width, height, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(text(model.copy.title), margin, 130, { maxWidth: width - margin * 2 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(208, 213, 221);
  doc.text(doc.splitTextToSize(text(model.copy.subtitle), width - margin * 2), margin, 205);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(text(model.accountName), margin, 330);
  doc.text(text(model.dateRangeLabel), margin, 354);
  doc.text(text(model.healthLabel), margin, 378);
  doc.text(text(model.copy.source), margin, 402);
  addFooter("Cover");

  doc.addPage();
  addHeader(model.copy.executiveSummary);
  addTitle(model.copy.executiveSummary, model.language === "vi" ? "Hiệu quả tổng quan" : "Performance at a glance", 86);
  let kpiX = margin;
  model.kpis.slice(0, 4).forEach((kpi) => {
    doc.setDrawColor(234, 236, 240);
    doc.roundedRect(kpiX, 145, 116, 72, 10, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(102, 112, 133);
    doc.text(text(kpi.label).toUpperCase(), kpiX + 12, 169);
    doc.setFontSize(16);
    doc.setTextColor(16, 24, 40);
    doc.text(text(kpi.value), kpiX + 12, 195, { maxWidth: 92 });
    kpiX += 126;
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(text(model.copy.verdictLabel), margin, 260);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 84, 103);
  doc.text(doc.splitTextToSize(text(model.verdictText), width - margin * 2), margin, 280);
  addBullets(model.copy.wins, model.wins, margin, 365, 150);
  addBullets(model.copy.risks, model.risks, margin + 178, 365, 150);
  addBullets(model.copy.nextMoves, model.actions.map((action) => action.title), margin + 356, 365, 150);
  addFooter("Page 2", model.copy.footnoteSource);

  doc.addPage();
  addHeader(model.copy.performanceStory);
  addTitle(model.copy.performanceStory, model.language === "vi" ? "Điều gì thay đổi và vì sao" : "What changed and why", 86);
  addRows(model.language === "vi" ? "Top campaign" : "Top campaigns", model.topCampaigns, 160);
  addRows(model.language === "vi" ? "Top ad set" : "Top ad sets", model.topAdsets, 310);
  addRows(model.language === "vi" ? "Khu vực" : "Regions", model.breakdowns.regions, 460);
  addFooter("Page 3", model.copy.footnoteComparison);

  doc.addPage();
  addHeader(model.copy.recommendations);
  addTitle(model.copy.recommendations, model.language === "vi" ? "Red Agency khuyến nghị gì tiếp theo" : "What Red Agency recommends next", 86);
  let actionY = 160;
  model.actions.forEach((action, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(text(`${index + 1}. ${action.title}`), margin, actionY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 84, 103);
    doc.text(doc.splitTextToSize(text(action.detail), width - margin * 2), margin, actionY + 16);
    actionY += 64;
  });
  addFooter("Page 4", model.copy.footnoteRecommendations);

  doc.addPage();
  addHeader(model.copy.appendixCharts);
  addTitle("Appendix A", model.language === "vi" ? "Biểu đồ và breakdown" : "Charts and breakdowns", 86);
  addRows(model.language === "vi" ? "Platform" : "Platform breakdown", model.breakdowns.platforms, 160);
  addRows(model.language === "vi" ? "Địa lý" : "Geography", model.breakdowns.regions, 300);
  addRows(model.language === "vi" ? "Tuổi / giới tính" : "Age / gender", model.breakdowns.ageGender, 440);
  addFooter("Appendix A · Page 5", model.copy.footnoteSource);

  doc.addPage();
  addHeader(model.copy.appendixTables);
  addTitle("Appendix B", model.language === "vi" ? "Bảng hiệu quả" : "Performance tables", 86);
  let tableY = 150;
  model.tables.forEach((table) => {
    addRows(table.title, table.rows, tableY);
    tableY += 130;
  });
  addFooter("Appendix B · Page 6", model.language === "vi" ? "Bảng dài có thể tiếp tục qua trang tiếp theo khi lưu PDF." : "Long tables may continue across pages when saved to PDF.");

  doc.addPage();
  addHeader(model.copy.appendixDiagnostics);
  addTitle("Appendix C", model.language === "vi" ? "Chẩn đoán và creative" : "Diagnostics and creative detail", 86);
  addBullets(model.language === "vi" ? "Chẩn đoán" : "Diagnostics", model.diagnostics.map((check) => `${check.label}: ${check.detail}`), margin, 155, width - margin * 2);
  addBullets(model.language === "vi" ? "Creative đang chạy" : "Running creative detail", model.creativeDetails.map((creative) => `${creative.name} · ${creative.campaignName} · ${creative.adCount} ads`), margin, 390, width - margin * 2);
  addFooter("Appendix C · Page 7", model.language === "vi" ? "Creative preview dùng metadata in được nếu iframe không an toàn cho PDF." : "Creative previews use printable metadata when embedded previews are not PDF-safe.");

  return { filename, blob: doc.output("blob") };
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
}

function pdfText(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[↑↓→]/g, "")
    .replace(/[₫đ]/gi, "VND")
    .replace(/ /g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ]/g, "");
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
