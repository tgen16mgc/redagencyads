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
    adCountLabel: string;
    summary: string;
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

export type RenderedPdfDownloadRuntime = PdfDownloadRuntime & {
  renderElementToPdf: (element: HTMLElement) => Promise<Blob>;
};

export function downloadClientReportPdf(pdf: ClientReportPdfFile, runtime: PdfDownloadRuntime) {
  const url = runtime.createObjectUrl(pdf.blob);
  const link = runtime.createLink();
  link.href = url;
  link.download = pdf.filename;
  link.click();
  runtime.revokeObjectUrl(url);
}

export async function downloadRenderedClientReportPdf({ filename, element }: { filename: string; element: HTMLElement }, runtime: RenderedPdfDownloadRuntime) {
  const blob = await runtime.renderElementToPdf(element);
  downloadClientReportPdf({ filename, blob }, runtime);
}

export function buildClientReportPdf(model: ClientReportViewModel): ClientReportPdfFile {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 42;
  const filename = `${slugify(model.accountName)}-meta-ads-report-${model.dateRange.since}-to-${model.dateRange.until}.pdf`;

  const text = (value: string) => pdfText(value);
  const contentWidth = width - margin * 2;
  const accent = [198, 38, 38] as const;
  const ink = [17, 24, 39] as const;
  const muted = [102, 112, 133] as const;
  const line = [229, 231, 235] as const;

  const color = (rgb: readonly [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const fill = (rgb: readonly [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const draw = (rgb: readonly [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const addFooter = (page: string, footnote?: string) => {
    draw(line);
    doc.line(margin, height - 54, width - margin, height - 54);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    color(muted);
    doc.text("Red Agency", margin, height - 34);
    doc.text(text(page), width / 2, height - 34, { align: "center" });
    doc.text(text(model.accountName), width - margin, height - 34, { align: "right" });
    if (footnote) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(text(footnote), contentWidth), margin, height - 72);
    }
  };

  const addHeader = (section: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    color(muted);
    doc.text(text(section).toUpperCase(), margin, 36);
    doc.text(text(model.dateRangeLabel).toUpperCase(), width - margin, 36, { align: "right" });
    draw(line);
    doc.line(margin, 48, width - margin, 48);
  };

  const addTitle = (kicker: string, title: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    color(muted);
    doc.text(text(kicker).toUpperCase(), margin, y);
    doc.setFontSize(25);
    color(ink);
    doc.text(text(title), margin, y + 30, { maxWidth: contentWidth });
  };

  const addPanel = (x: number, y: number, panelWidth: number, panelHeight: number) => {
    fill([255, 255, 255]);
    draw([234, 236, 240]);
    doc.roundedRect(x, y, panelWidth, panelHeight, 12, 12, "FD");
  };

  const addMetricCards = (y: number) => {
    const gap = 12;
    const cardWidth = (contentWidth - gap * 3) / 4;
    model.kpis.slice(0, 4).forEach((kpi, index) => {
      const x = margin + index * (cardWidth + gap);
      addPanel(x, y, cardWidth, 86);
      fill(kpi.movement === "bad" ? [254, 242, 242] : kpi.movement === "good" ? [240, 253, 244] : [248, 250, 252]);
      doc.roundedRect(x + 12, y + 12, 26, 26, 7, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      color(muted);
      doc.text(text(kpi.label).toUpperCase(), x + 48, y + 23, { maxWidth: cardWidth - 58 });
      doc.setFontSize(15);
      color(ink);
      doc.text(text(kpi.value), x + 14, y + 56, { maxWidth: cardWidth - 24 });
      if (kpi.delta) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        color(kpi.movement === "bad" ? [180, 35, 24] : kpi.movement === "good" ? [2, 122, 72] : muted);
        doc.text(text(kpi.delta), x + 14, y + 74, { maxWidth: cardWidth - 24 });
      }
    });
  };

  const addBullets = (title: string, items: string[], x: number, y: number, maxWidth: number) => {
    addPanel(x, y, maxWidth, 150);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    color(ink);
    doc.text(text(title), x + 14, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    color([71, 84, 103]);
    let cursor = y + 46;
    items.slice(0, 3).forEach((item) => {
      const lines = doc.splitTextToSize(text(`- ${item}`), maxWidth - 28);
      doc.text(lines, x + 14, cursor);
      cursor += lines.length * 11 + 7;
    });
  };

  const addBarList = (title: string, rows: NormalizedRow[], x: number, y: number, panelWidth: number, panelHeight: number) => {
    addPanel(x, y, panelWidth, panelHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    color(ink);
    doc.text(text(title), x + 14, y + 24);
    const maxSpend = Math.max(1, ...rows.map((row) => row.spend));
    let cursor = y + 50;
    rows.slice(0, 6).forEach((row, index) => {
      const label = reportRowLabel(row);
      const barWidth = Math.max(4, ((panelWidth - 142) * row.spend) / maxSpend);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      color([52, 64, 84]);
      doc.text(text(label), x + 14, cursor, { maxWidth: panelWidth - 122 });
      fill(index === 0 ? accent : [254, 202, 202]);
      doc.roundedRect(x + 14, cursor + 8, barWidth, 7, 3, 3, "F");
      fill([243, 244, 246]);
      doc.roundedRect(x + 14 + barWidth, cursor + 8, Math.max(0, panelWidth - 142 - barWidth), 7, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      color(ink);
      doc.text(text(formatMetric(row.spend, "currency", model.currency)), x + panelWidth - 14, cursor + 7, { align: "right" });
      cursor += 27;
    });
  };

  const addTrendChart = (x: number, y: number, panelWidth: number, panelHeight: number) => {
    addPanel(x, y, panelWidth, panelHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    color(ink);
    doc.text(text(model.language === "vi" ? "Xu hướng chi tiêu" : "Spend trend"), x + 14, y + 24);
    const chartX = x + 18;
    const chartY = y + 54;
    const chartW = panelWidth - 36;
    const chartH = panelHeight - 88;
    const rows = model.dailyTrend.slice(-10);
    const maxSpend = Math.max(1, ...rows.map((row) => row.spend));
    draw([238, 242, 246]);
    [0, 1, 2].forEach((step) => doc.line(chartX, chartY + step * (chartH / 2), chartX + chartW, chartY + step * (chartH / 2)));
    rows.forEach((row, index) => {
      const barW = chartW / Math.max(1, rows.length) - 5;
      const barH = Math.max(4, (row.spend / maxSpend) * chartH);
      const barX = chartX + index * (chartW / Math.max(1, rows.length)) + 2;
      fill(index === rows.length - 1 ? accent : [252, 165, 165]);
      doc.roundedRect(barX, chartY + chartH - barH, barW, barH, 3, 3, "F");
      if (index === 0 || index === rows.length - 1) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        color(muted);
        doc.text(text(row.label), barX, chartY + chartH + 14);
      }
    });
  };

  const addRecommendationCards = (y: number) => {
    let cursor = y;
    model.actions.slice(0, 5).forEach((action, index) => {
      addPanel(margin, cursor, contentWidth, 76);
      fill(index === 0 ? accent : [31, 41, 55]);
      doc.circle(margin + 24, cursor + 27, 11, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(String(index + 1), margin + 24, cursor + 30, { align: "center" });
      doc.setFontSize(11);
      color(ink);
      doc.text(text(action.title), margin + 46, cursor + 24, { maxWidth: contentWidth - 72 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      color([71, 84, 103]);
      doc.text(doc.splitTextToSize(text(action.detail), contentWidth - 72), margin + 46, cursor + 42);
      cursor += 88;
    });
  };

  const addTable = (title: string, rows: NormalizedRow[], y: number) => {
    addPanel(margin, y, contentWidth, 128);
    const spendX = width - 212;
    const ctrX = width - 116;
    const resultX = width - margin - 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    color(ink);
    doc.text(text(title), margin + 14, y + 24);
    doc.setFontSize(7.5);
    color(muted);
    doc.text("SPEND", spendX, y + 24);
    doc.text("CTR", ctrX, y + 24);
    doc.text("RESULT", resultX, y + 24, { align: "right" });
    let cursor = y + 47;
    rows.slice(0, 5).forEach((row) => {
      draw([243, 244, 246]);
      doc.line(margin + 14, cursor - 11, width - margin - 14, cursor - 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      color([52, 64, 84]);
      doc.text(text(reportRowLabel(row)), margin + 14, cursor, { maxWidth: contentWidth - 280 });
      doc.text(text(formatCompactCurrency(row.spend, model.currency)), spendX, cursor);
      doc.text(text(formatMetric(row.ctr, "percent", model.currency)), ctrX, cursor);
      doc.text(text(formatMetric(row.leads || row.messages || row.purchases || row.linkClicks || row.reach, "number", model.currency)), resultX, cursor, { align: "right" });
      cursor += 18;
    });
  };

  fill([9, 9, 9]);
  doc.rect(0, 0, width, height, "F");
  fill([198, 38, 38]);
  doc.rect(0, 0, 14, height, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text(text(model.copy.title), margin, 132, { maxWidth: contentWidth });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(208, 213, 221);
  doc.text(doc.splitTextToSize(text(model.copy.subtitle), contentWidth - 58), margin, 210);
  fill([24, 24, 27]);
  doc.roundedRect(margin, 322, 310, 124, 16, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(text(model.accountName), margin + 18, 352);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(212, 212, 216);
  doc.text(text(model.dateRangeLabel), margin + 18, 378);
  doc.text(text(model.healthLabel), margin + 18, 404);
  doc.text(text(model.copy.source), margin + 18, 430);
  addFooter("Cover");

  doc.addPage();
  addHeader(model.copy.executiveSummary);
  addTitle(model.copy.executiveSummary, model.language === "vi" ? "Hiệu quả tổng quan" : "Performance at a glance", 86);
  addMetricCards(146);
  addTrendChart(margin, 256, 250, 180);
  addPanel(margin + 270, 256, contentWidth - 270, 180);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  color(ink);
  doc.text(text(model.copy.verdictLabel), margin + 286, 284);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  color([71, 84, 103]);
  doc.text(doc.splitTextToSize(text(model.verdictText), contentWidth - 304), margin + 286, 306);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  color(accent);
  doc.text(text(model.insightSummary), margin + 286, 378, { maxWidth: contentWidth - 304 });
  addBullets(model.copy.wins, model.wins, margin, 466, 160);
  addBullets(model.copy.risks, model.risks, margin + 174, 466, 160);
  addBullets(model.copy.nextMoves, model.actions.map((action) => action.title), margin + 348, 466, 160);
  addFooter("Page 2", model.copy.footnoteSource);

  doc.addPage();
  addHeader(model.copy.performanceStory);
  addTitle(model.copy.performanceStory, model.language === "vi" ? "Điều gì thay đổi và vì sao" : "What changed and why", 86);
  addBarList(model.language === "vi" ? "Top campaign" : "Top campaigns", model.topCampaigns, margin, 155, contentWidth, 190);
  addBarList(model.language === "vi" ? "Top ad set" : "Top ad sets", model.topAdsets, margin, 365, contentWidth, 210);
  addFooter("Page 3", model.copy.footnoteComparison);

  doc.addPage();
  addHeader(model.copy.recommendations);
  addTitle(model.copy.recommendations, model.language === "vi" ? "Red Agency khuyến nghị gì tiếp theo" : "What Red Agency recommends next", 86);
  addRecommendationCards(160);
  addFooter("Page 4", model.copy.footnoteRecommendations);

  doc.addPage();
  addHeader(model.copy.appendixCharts);
  addTitle("Appendix A", model.language === "vi" ? "Biểu đồ và breakdown" : "Charts and breakdowns", 86);
  addBarList(model.language === "vi" ? "Platform" : "Platform breakdown", model.breakdowns.platforms, margin, 155, contentWidth, 170);
  addBarList(model.language === "vi" ? "Địa lý" : "Geography", model.breakdowns.regions, margin, 345, (contentWidth - 18) / 2, 190);
  addBarList(model.language === "vi" ? "Tuổi / giới tính" : "Age / gender", model.breakdowns.ageGender, margin + (contentWidth + 18) / 2, 345, (contentWidth - 18) / 2, 190);
  addFooter("Appendix A · Page 5", model.copy.footnoteSource);

  doc.addPage();
  addHeader(model.copy.appendixTables);
  addTitle("Appendix B", model.language === "vi" ? "Bảng hiệu quả" : "Performance tables", 86);
  addTable(model.tables[0]?.title || "Campaigns", model.tables[0]?.rows || [], 150);
  addTable(model.tables[1]?.title || "Ad sets", model.tables[1]?.rows || [], 292);
  addTable(model.tables[2]?.title || "Ads", model.tables[2]?.rows || [], 434);
  addFooter("Appendix B · Page 6", model.language === "vi" ? "Bảng dài có thể tiếp tục qua trang tiếp theo khi lưu PDF." : "Long tables may continue across pages when saved to PDF.");

  doc.addPage();
  addHeader(model.copy.appendixDiagnostics);
  addTitle("Appendix C", model.language === "vi" ? "Chẩn đoán và creative" : "Diagnostics and creative detail", 86);
  addBullets(model.language === "vi" ? "Chẩn đoán" : "Diagnostics", model.diagnostics.map((check) => `${check.label}: ${check.detail}`), margin, 155, contentWidth);
  addBullets(model.language === "vi" ? "Creative đang chạy" : "Running creative detail", model.creativeDetails.map((creative) => `${creative.name} · ${creative.campaignName} · ${creative.adCount} ads`), margin, 330, contentWidth);
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

function reportRowLabel(row: NormalizedRow) {
  if (row.level === "daily") return row.date || row.name;
  if (row.platform) return row.platform;
  if (row.placement) return row.placement;
  if (row.region) return row.region;
  if (row.country) return row.country;
  if (row.age && row.gender) return `${row.age} ${row.gender}`;
  return row.name;
}

function formatCompactCurrency(value: number, currency: string) {
  if (Math.abs(value) >= 1_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000)}M ${currency}`;
  if (Math.abs(value) >= 1_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value / 1_000)}K ${currency}`;
  return formatMetric(value, "currency", currency);
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
