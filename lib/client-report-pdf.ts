import { jsPDF } from "jspdf";
import { formatMetric } from "@/lib/metrics";
import type { ClientReportAction, ClientReportPdfFile, ClientReportTable, ClientReportViewModel } from "@/lib/client-report";
import type { NormalizedRow } from "@/lib/types";

export type { ClientReportPdfFile };

type ReportTone = "neutral" | "primary" | "good" | "warning" | "bad";

export type ClientReportPdfFontData = {
  regular: string;
  semibold: string;
};

export type ClientReportPdfBlock = {
  kind:
    | "cover"
    | "header"
    | "footer"
    | "section-title"
    | "subsection"
    | "provenance"
    | "metric-grid"
    | "health-strip"
    | "narrative"
    | "signal-list"
    | "trend-chart"
    | "ranking-list"
    | "action-row"
    | "breakdown-list"
    | "table-header"
    | "table-row"
    | "diagnostic-row"
    | "creative-row"
    | "note";
  section: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  text?: string;
  footnote?: string;
  label?: string;
  tone?: ReportTone;
  index?: number;
  items?: string[];
  meta?: Array<{ label: string; value: string }>;
  kpis?: ClientReportViewModel["kpis"];
  trend?: ClientReportViewModel["dailyTrend"];
  rows?: NormalizedRow[];
  action?: ClientReportAction;
  row?: NormalizedRow;
  diagnostic?: ClientReportViewModel["diagnostics"][number];
  creative?: ClientReportViewModel["creativeDetails"][number];
};

export type ClientReportPdfPage = {
  pageNumber: number;
  section: string;
  blocks: ClientReportPdfBlock[];
};

export type ClientReportPdfLayout = {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  pages: ClientReportPdfPage[];
};

type Rgb = readonly [number, number, number];

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = { top: 34, right: 42, bottom: 34, left: 42 };
const contentWidth = pageWidth - margin.left - margin.right;
const contentTop = 80;
const contentBottom = pageHeight - margin.bottom - 42;
const gap = 14;

const colors = {
  canvas: [12, 13, 15] as Rgb,
  surface: [19, 21, 25] as Rgb,
  raised: [22, 24, 29] as Rgb,
  foreground: [244, 244, 245] as Rgb,
  muted: [156, 163, 175] as Rgb,
  border: [42, 47, 55] as Rgb,
  primary: [47, 140, 255] as Rgb,
  primaryInk: [6, 20, 38] as Rgb,
  primaryTint: [18, 40, 70] as Rgb,
  success: [50, 213, 131] as Rgb,
  successTint: [19, 54, 42] as Rgb,
  warning: [245, 185, 64] as Rgb,
  warningTint: [58, 45, 18] as Rgb,
  destructive: [255, 92, 108] as Rgb,
  destructiveTint: [60, 28, 34] as Rgb,
} as const;

const reportCopy = {
  en: {
    coverLabel: "CLIENT PERFORMANCE REPORT",
    executiveDescription: "The current decision, account health, and highest-priority evidence.",
    performanceDescription: "Spend, results, and the rows that explain the outcome.",
    recommendationsDescription: "Reviewed actions for the next optimization cycle.",
    chartsDescription: "Distribution views that preserve the source rows behind the decision.",
    tablesDescription: "Comparable records for audit, handoff, and follow-up analysis.",
    diagnosticsDescription: "Account checks and printable creative metadata.",
    accountHealth: "Account health",
    decisionBrief: "Decision brief",
    evidenceSummary: "Evidence summary",
    dataSource: "Data source",
    decisionSource: "Decision source",
    generated: "Generated",
    reportingPeriod: "Reporting period",
    whatWorked: "What is working",
    watchItems: "What needs attention",
    spendTrend: "Spend and primary-result trend",
    spend: "Spend",
    primaryResult: "Primary result",
    topCampaigns: "Campaign drivers",
    topAdsets: "Ad set drivers",
    priorityActions: "Priority actions",
    performanceRows: "Performance records",
    diagnostics: "Diagnostic checks",
    creativeDetail: "Creative detail",
    noCreativeDetail: "No printable creative detail is available in the selected scope.",
    status: "Status",
    result: "Result",
    cost: "Cost",
    continued: "continued",
    page: "Page",
  },
  vi: {
    coverLabel: "BÁO CÁO HIỆU QUẢ KHÁCH HÀNG",
    executiveDescription: "Kết luận hiện tại, sức khỏe tài khoản và bằng chứng cần ưu tiên.",
    performanceDescription: "Chi tiêu, kết quả và các dòng dữ liệu giải thích hiệu quả.",
    recommendationsDescription: "Các hành động đã rà soát cho chu kỳ tối ưu tiếp theo.",
    chartsDescription: "Phân bổ dữ liệu giúp giữ nguyên các dòng nguồn phía sau quyết định.",
    tablesDescription: "Các bản ghi có thể đối chiếu để kiểm tra, bàn giao và phân tích tiếp.",
    diagnosticsDescription: "Kiểm tra tài khoản và metadata quảng cáo có thể in.",
    accountHealth: "Sức khỏe tài khoản",
    decisionBrief: "Kết luận quyết định",
    evidenceSummary: "Tóm tắt bằng chứng",
    dataSource: "Nguồn dữ liệu",
    decisionSource: "Nguồn quyết định",
    generated: "Ngày tạo",
    reportingPeriod: "Kỳ báo cáo",
    whatWorked: "Điểm đang hiệu quả",
    watchItems: "Điểm cần theo dõi",
    spendTrend: "Xu hướng chi tiêu và kết quả chính",
    spend: "Chi tiêu",
    primaryResult: "Kết quả chính",
    topCampaigns: "Động lực từ chiến dịch",
    topAdsets: "Động lực từ nhóm quảng cáo",
    priorityActions: "Hành động ưu tiên",
    performanceRows: "Bản ghi hiệu quả",
    diagnostics: "Kiểm tra chẩn đoán",
    creativeDetail: "Chi tiết quảng cáo",
    noCreativeDetail: "Không có chi tiết quảng cáo có thể in trong phạm vi đã chọn.",
    status: "Trạng thái",
    result: "Kết quả",
    cost: "Chi phí",
    continued: "tiếp theo",
    page: "Trang",
  },
} as const;

let fontPromise: Promise<ClientReportPdfFontData> | null = null;

export async function loadClientReportPdfFonts(): Promise<ClientReportPdfFontData> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      fetchFont("/fonts/geist/Geist-Regular.ttf"),
      fetchFont("/fonts/geist/Geist-SemiBold.ttf"),
    ]).then(([regular, semibold]) => ({ regular, semibold }));
  }
  return fontPromise;
}

export async function buildClientReportPdf(
  model: ClientReportViewModel,
  fonts?: ClientReportPdfFontData,
): Promise<ClientReportPdfFile> {
  const layout = buildClientReportPdfLayout(model);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  registerFonts(doc, fonts || await loadClientReportPdfFonts());
  doc.setProperties({
    title: `${model.copy.title} - ${model.accountName}`,
    subject: model.copy.subtitle,
    author: "Decision Workspace",
    creator: "Decision Workspace",
  });

  layout.pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage("a4", "portrait");
    fill(doc, colors.canvas);
    doc.rect(0, 0, layout.width, layout.height, "F");
    page.blocks.forEach((block) => drawBlock(doc, model, block));
  });

  return {
    filename: `${slugify(model.accountName)}-meta-ads-report-${model.dateRange.since}-to-${model.dateRange.until}.pdf`,
    blob: doc.output("blob"),
  };
}

export function buildClientReportPdfLayout(model: ClientReportViewModel): ClientReportPdfLayout {
  const t = reportCopy[model.language];
  const layout: ClientReportPdfLayout = { width: pageWidth, height: pageHeight, margin, pages: [] };
  let page: ClientReportPdfPage;
  let cursor = contentTop;

  const addBlock = (block: Omit<ClientReportPdfBlock, "pageNumber">) => {
    page.blocks.push({ ...block, pageNumber: page.pageNumber });
  };

  const addCover = () => {
    page = { pageNumber: 1, section: "Cover", blocks: [] };
    layout.pages.push(page);
    addBlock({
      kind: "cover",
      section: "Cover",
      x: margin.left,
      y: margin.top,
      width: contentWidth,
      height: pageHeight - margin.top - margin.bottom,
    });
  };

  const addContentPage = (section: string) => {
    page = { pageNumber: layout.pages.length + 1, section, blocks: [] };
    layout.pages.push(page);
    addBlock({ kind: "header", section, x: margin.left, y: margin.top, width: contentWidth, height: 28, title: section });
    addBlock({ kind: "footer", section, x: margin.left, y: pageHeight - margin.bottom - 20, width: contentWidth, height: 20 });
    cursor = contentTop;
  };

  const ensureSpace = (height: number, section: string) => {
    if (cursor + height > contentBottom) addContentPage(section);
  };

  const startSection = (section: string, description: string) => {
    addContentPage(section);
    const titleLines = wrapForLayout(section, contentWidth - 34, 24).length;
    const descriptionLines = wrapForLayout(description, contentWidth - 34, 9.5).length;
    const titleHeight = 28 + titleLines * 30 + descriptionLines * 13;
    addBlock({
      kind: "section-title",
      section,
      x: margin.left,
      y: cursor,
      width: contentWidth,
      height: titleHeight,
      title: section,
      text: description,
    });
    cursor += titleHeight + 16;
  };

  const addNote = (section: string, text: string) => {
    const height = 28 + textHeight(text, contentWidth - 28, 8, 11);
    ensureSpace(height, section);
    addBlock({ kind: "note", section, x: margin.left, y: cursor, width: contentWidth, height, text });
    cursor += height + gap;
  };

  const addNarrativeFlow = (section: string, title: string, text: string, footnote?: string) => {
    const lineHeight = 14;
    let lines = wrapForLayout(text, contentWidth - 40, 10.25);
    let first = true;

    while (lines.length) {
      if (contentBottom - cursor < 110) addContentPage(section);
      const available = contentBottom - cursor;
      const titleReserve = 48;
      const maxLines = Math.max(1, Math.floor((available - titleReserve) / lineHeight));
      const chunk = lines.slice(0, maxLines);
      const height = titleReserve + chunk.length * lineHeight;
      addBlock({
        kind: "narrative",
        section,
        x: margin.left,
        y: cursor,
        width: contentWidth,
        height,
        title: first ? title : `${title} (${t.continued})`,
        text: chunk.join("\n"),
      });
      cursor += height + gap;
      lines = lines.slice(chunk.length);
      first = false;
    }

    if (footnote) addNote(section, footnote);
  };

  const addPairedLists = (
    section: string,
    left: { title: string; items: string[]; tone: ReportTone },
    right: { title: string; items: string[]; tone: ReportTone },
  ) => {
    const columnGap = 16;
    const width = (contentWidth - columnGap) / 2;
    const leftHeight = signalListHeight(left.items, width);
    const rightHeight = signalListHeight(right.items, width);
    const height = Math.max(leftHeight, rightHeight);
    ensureSpace(height, section);
    addBlock({ kind: "signal-list", section, x: margin.left, y: cursor, width, height, title: left.title, items: left.items, tone: left.tone });
    addBlock({ kind: "signal-list", section, x: margin.left + width + columnGap, y: cursor, width, height, title: right.title, items: right.items, tone: right.tone });
    cursor += height + gap;
  };

  const addPairedRankings = (section: string) => {
    const columnGap = 16;
    const width = (contentWidth - columnGap) / 2;
    const height = Math.max(rankingHeight(model.topCampaigns), rankingHeight(model.topAdsets));
    ensureSpace(height, section);
    addBlock({ kind: "ranking-list", section, x: margin.left, y: cursor, width, height, title: t.topCampaigns, rows: model.topCampaigns });
    addBlock({ kind: "ranking-list", section, x: margin.left + width + columnGap, y: cursor, width, height, title: t.topAdsets, rows: model.topAdsets });
    cursor += height + gap;
  };

  const addBreakdown = (section: string, title: string, rows: NormalizedRow[], x: number, width: number, height: number) => {
    addBlock({ kind: "breakdown-list", section, x, y: cursor, width, height, title, rows });
  };

  const addTable = (section: string, table: ClientReportTable) => {
    const addTableHeading = (continued = false) => {
      const headingHeight = 44;
      ensureSpace(headingHeight + 32 + tableRowHeight(table.rows[0]), section);
      addBlock({
        kind: "subsection",
        section,
        x: margin.left,
        y: cursor,
        width: contentWidth,
        height: headingHeight,
        title: continued ? `${table.title} (${t.continued})` : table.title,
      });
      cursor += headingHeight;
      addBlock({ kind: "table-header", section: table.title, x: margin.left, y: cursor, width: contentWidth, height: 32, title: table.title });
      cursor += 32;
    };

    addTableHeading();
    table.rows.forEach((row) => {
      const height = tableRowHeight(row);
      if (cursor + height > contentBottom) {
        addContentPage(section);
        addTableHeading(true);
      }
      addBlock({ kind: "table-row", section: table.title, x: margin.left, y: cursor, width: contentWidth, height, row });
      cursor += height;
    });
    cursor += 20;
  };

  addCover();

  startSection(model.copy.executiveSummary, t.executiveDescription);
  const provenanceHeight = 66;
  addBlock({
    kind: "provenance",
    section: model.copy.executiveSummary,
    x: margin.left,
    y: cursor,
    width: contentWidth,
    height: provenanceHeight,
    meta: [
      { label: t.dataSource, value: model.copy.source },
      { label: t.decisionSource, value: model.decisionProviderLabel },
      { label: t.generated, value: model.generatedLabel },
    ],
  });
  cursor += provenanceHeight + gap;

  const healthHeight = 88 + textHeight(model.healthSummaryText, contentWidth - 170, 9.5, 13);
  ensureSpace(healthHeight, model.copy.executiveSummary);
  addBlock({
    kind: "health-strip",
    section: model.copy.executiveSummary,
    x: margin.left,
    y: cursor,
    width: contentWidth,
    height: healthHeight,
    title: t.accountHealth,
    text: model.healthSummaryText,
    label: model.healthStatusLabel,
    tone: healthTone(model.healthStatus),
  });
  cursor += healthHeight + gap;

  const metricHeight = metricGridHeight(model.kpis.length);
  ensureSpace(metricHeight, model.copy.executiveSummary);
  addBlock({ kind: "metric-grid", section: model.copy.executiveSummary, x: margin.left, y: cursor, width: contentWidth, height: metricHeight, kpis: model.kpis });
  cursor += metricHeight + gap;

  addNarrativeFlow(model.copy.executiveSummary, t.decisionBrief, model.verdictText);
  addPairedLists(
    model.copy.executiveSummary,
    { title: t.whatWorked, items: model.wins, tone: "good" },
    { title: t.watchItems, items: model.risks, tone: "warning" },
  );

  startSection(model.copy.performanceStory, t.performanceDescription);
  const trendHeight = 238;
  addBlock({
    kind: "trend-chart",
    section: model.copy.performanceStory,
    x: margin.left,
    y: cursor,
    width: contentWidth,
    height: trendHeight,
    title: t.spendTrend,
    text: `${t.spend} / ${model.primaryResultLabel}`,
    trend: model.dailyTrend,
  });
  cursor += trendHeight + gap;
  addPairedRankings(model.copy.performanceStory);
  addNote(model.copy.performanceStory, model.copy.footnoteComparison);

  startSection(model.copy.recommendations, t.recommendationsDescription);
  addNote(model.copy.recommendations, model.copy.footnoteRecommendations);
  addNarrativeFlow(model.copy.recommendations, t.evidenceSummary, model.insightSummary);
  const subsectionHeight = 44;
  addBlock({ kind: "subsection", section: model.copy.recommendations, x: margin.left, y: cursor, width: contentWidth, height: subsectionHeight, title: t.priorityActions });
  cursor += subsectionHeight;
  model.actions.forEach((action, index) => {
    const height = actionHeight(action, contentWidth);
    ensureSpace(height, model.copy.recommendations);
    addBlock({ kind: "action-row", section: model.copy.recommendations, x: margin.left, y: cursor, width: contentWidth, height, action, index: index + 1 });
    cursor += height;
  });

  startSection(model.copy.appendixCharts, t.chartsDescription);
  const platformHeight = breakdownHeight(model.breakdowns.platforms);
  ensureSpace(platformHeight, model.copy.appendixCharts);
  addBreakdown(model.copy.appendixCharts, model.language === "vi" ? "Nền tảng" : "Platform", model.breakdowns.platforms, margin.left, contentWidth, platformHeight);
  cursor += platformHeight + gap;
  const pairGap = 16;
  const pairWidth = (contentWidth - pairGap) / 2;
  const pairHeight = Math.max(breakdownHeight(model.breakdowns.regions), breakdownHeight(model.breakdowns.ageGender));
  ensureSpace(pairHeight, model.copy.appendixCharts);
  addBreakdown(model.copy.appendixCharts, model.language === "vi" ? "Khu vực" : "Geography", model.breakdowns.regions, margin.left, pairWidth, pairHeight);
  addBreakdown(model.copy.appendixCharts, model.language === "vi" ? "Tuổi và giới tính" : "Age and gender", model.breakdowns.ageGender, margin.left + pairWidth + pairGap, pairWidth, pairHeight);
  cursor += pairHeight + gap;
  addNote(model.copy.appendixCharts, model.copy.footnoteSource);

  startSection(model.copy.appendixTables, t.tablesDescription);
  addBlock({ kind: "subsection", section: model.copy.appendixTables, x: margin.left, y: cursor, width: contentWidth, height: 44, title: t.performanceRows });
  cursor += 44;
  model.tables.forEach((table) => addTable(model.copy.appendixTables, table));

  startSection(model.copy.appendixDiagnostics, t.diagnosticsDescription);
  addBlock({ kind: "subsection", section: model.copy.appendixDiagnostics, x: margin.left, y: cursor, width: contentWidth, height: 44, title: t.diagnostics });
  cursor += 44;
  model.diagnostics.forEach((diagnostic) => {
    const height = diagnosticHeight(diagnostic.detail, contentWidth);
    ensureSpace(height, model.copy.appendixDiagnostics);
    addBlock({
      kind: "diagnostic-row",
      section: model.copy.appendixDiagnostics,
      x: margin.left,
      y: cursor,
      width: contentWidth,
      height,
      diagnostic,
      tone: diagnostic.status === "pass" ? "good" : diagnostic.status === "warning" ? "warning" : "bad",
    });
    cursor += height;
  });
  cursor += gap;
  const firstCreativeHeight = model.creativeDetails[0] ? creativeHeight(model.creativeDetails[0], contentWidth) : 0;
  ensureSpace(44 + firstCreativeHeight, model.copy.appendixDiagnostics);
  addBlock({ kind: "subsection", section: model.copy.appendixDiagnostics, x: margin.left, y: cursor, width: contentWidth, height: 44, title: t.creativeDetail });
  cursor += 44;
  if (!model.creativeDetails.length) {
    addNote(model.copy.appendixDiagnostics, t.noCreativeDetail);
  } else {
    model.creativeDetails.forEach((creative) => {
      const height = creativeHeight(creative, contentWidth);
      ensureSpace(height, model.copy.appendixDiagnostics);
      addBlock({ kind: "creative-row", section: model.copy.appendixDiagnostics, x: margin.left, y: cursor, width: contentWidth, height, creative });
      cursor += height;
    });
  }

  return layout;
}

function drawBlock(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  switch (block.kind) {
    case "cover":
      drawCover(doc, model, block);
      return;
    case "header":
      drawHeader(doc, model, block);
      return;
    case "footer":
      drawFooter(doc, model, block);
      return;
    case "section-title":
      drawSectionTitle(doc, block);
      return;
    case "subsection":
      drawSubsection(doc, block);
      return;
    case "provenance":
      drawProvenance(doc, block);
      return;
    case "metric-grid":
      drawMetricGrid(doc, block);
      return;
    case "health-strip":
      drawHealthStrip(doc, model, block);
      return;
    case "narrative":
      drawNarrative(doc, block);
      return;
    case "signal-list":
      drawSignalList(doc, block);
      return;
    case "trend-chart":
      drawTrendChart(doc, model, block);
      return;
    case "ranking-list":
      drawRankingList(doc, model, block);
      return;
    case "action-row":
      drawActionRow(doc, block);
      return;
    case "breakdown-list":
      drawBreakdownList(doc, model, block);
      return;
    case "table-header":
      drawTableHeader(doc, model, block);
      return;
    case "table-row":
      drawTableRow(doc, model, block);
      return;
    case "diagnostic-row":
      drawDiagnosticRow(doc, model, block);
      return;
    case "creative-row":
      drawCreativeRow(doc, block);
      return;
    case "note":
      drawNote(doc, block);
  }
}

function drawCover(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  const t = reportCopy[model.language];
  setFont(doc, "semibold", 10);
  textColor(doc, colors.foreground);
  doc.text("Decision Workspace", block.x, block.y + 12);
  setFont(doc, "semibold", 7.5);
  textColor(doc, colors.muted);
  doc.text(t.coverLabel, block.x + block.width, block.y + 12, { align: "right" });

  fill(doc, colors.primary);
  doc.roundedRect(block.x, block.y + 68, 72, 4, 2, 2, "F");

  setFont(doc, "semibold", 34);
  textColor(doc, colors.foreground);
  drawLines(doc, wrapForLayout(model.copy.title, block.width - 30, 34).slice(0, 3), block.x, block.y + 126, 38);
  setFont(doc, "normal", 11);
  textColor(doc, colors.muted);
  drawLines(doc, wrapForLayout(model.copy.subtitle, block.width - 46, 11).slice(0, 4), block.x, block.y + 224, 16);

  drawColor(doc, colors.border);
  doc.line(block.x, block.y + 302, block.x + block.width, block.y + 302);
  setFont(doc, "normal", 8);
  textColor(doc, colors.muted);
  doc.text(t.reportingPeriod.toUpperCase(), block.x, block.y + 328);
  setFont(doc, "semibold", 18);
  textColor(doc, colors.foreground);
  doc.text(safeText(model.accountName), block.x, block.y + 358, { maxWidth: block.width - 150 });
  setFont(doc, "normal", 10);
  textColor(doc, colors.muted);
  doc.text(safeText(model.dateRangeLabel), block.x, block.y + 382);

  const healthToneValue = healthTone(model.healthStatus);
  drawStatus(doc, model.healthStatusLabel, block.x + block.width - 116, block.y + 330, healthToneValue);
  setFont(doc, "semibold", 24);
  textColor(doc, colors.foreground);
  doc.text(safeText(model.healthLabel), block.x + block.width, block.y + 382, { align: "right" });

  const panelY = block.y + 438;
  const panelH = 170;
  surface(doc, block.x, panelY, block.width, panelH, colors.raised);
  fill(doc, colors.primary);
  doc.roundedRect(block.x, panelY, 5, panelH, 2, 2, "F");
  setFont(doc, "semibold", 9);
  textColor(doc, colors.primary);
  doc.text(t.decisionBrief.toUpperCase(), block.x + 24, panelY + 28);
  setFont(doc, "semibold", 15);
  textColor(doc, colors.foreground);
  drawLines(doc, wrapForLayout(model.verdictText, block.width - 48, 15).slice(0, 7), block.x + 24, panelY + 58, 21);

  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height - 72, block.x + block.width, block.y + block.height - 72);
  const metadata = [
    [t.dataSource, model.copy.source],
    [t.decisionSource, model.decisionProviderLabel],
    [t.generated, model.generatedLabel],
  ];
  metadata.forEach(([label, value], index) => {
    const x = block.x + index * (block.width / 3);
    setFont(doc, "semibold", 7.25);
    textColor(doc, colors.muted);
    doc.text(label.toUpperCase(), x, block.y + block.height - 46);
    setFont(doc, "normal", 8.5);
    textColor(doc, colors.foreground);
    doc.text(safeText(value), x, block.y + block.height - 25, { maxWidth: block.width / 3 - 18 });
  });
}

function drawHeader(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  setFont(doc, "semibold", 8.5);
  textColor(doc, colors.foreground);
  doc.text("Decision Workspace", block.x, block.y + 10);
  setFont(doc, "normal", 8);
  textColor(doc, colors.muted);
  doc.text(safeText(block.title || block.section), block.x + 138, block.y + 10, { maxWidth: 220 });
  doc.text(safeText(model.dateRangeLabel), block.x + block.width, block.y + 10, { align: "right" });
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height, block.x + block.width, block.y + block.height);
}

function drawFooter(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  const t = reportCopy[model.language];
  drawColor(doc, colors.border);
  doc.line(block.x, block.y, block.x + block.width, block.y);
  setFont(doc, "normal", 7.5);
  textColor(doc, colors.muted);
  doc.text(safeText(model.accountName), block.x, block.y + 15, { maxWidth: 190 });
  doc.text(safeText(model.copy.source), block.x + block.width / 2, block.y + 15, { align: "center" });
  doc.text(`${t.page} ${block.pageNumber}`, block.x + block.width, block.y + 15, { align: "right" });
}

function drawSectionTitle(doc: jsPDF, block: ClientReportPdfBlock) {
  const titleLines = wrapForLayout(block.title || block.section, block.width - 36, 24);
  fill(doc, colors.primary);
  doc.roundedRect(block.x, block.y + 2, 4, Math.max(42, titleLines.length * 30), 2, 2, "F");
  setFont(doc, "semibold", 24);
  textColor(doc, colors.foreground);
  drawLines(doc, titleLines, block.x + 20, block.y + 26, 30);
  setFont(doc, "normal", 9.5);
  textColor(doc, colors.muted);
  drawLines(doc, wrapForLayout(block.text || "", block.width - 36, 9.5), block.x + 20, block.y + 22 + titleLines.length * 30, 13);
}

function drawSubsection(doc: jsPDF, block: ClientReportPdfBlock) {
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height - 8, block.x + block.width, block.y + block.height - 8);
  setFont(doc, "semibold", 14);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.title || ""), block.x, block.y + 22, { maxWidth: block.width });
}

function drawProvenance(doc: jsPDF, block: ClientReportPdfBlock) {
  surface(doc, block.x, block.y, block.width, block.height, colors.surface);
  const items = block.meta || [];
  const columnWidth = block.width / Math.max(1, items.length);
  items.forEach((item, index) => {
    const x = block.x + index * columnWidth;
    if (index > 0) {
      drawColor(doc, colors.border);
      doc.line(x, block.y + 14, x, block.y + block.height - 14);
    }
    setFont(doc, "semibold", 7.25);
    textColor(doc, colors.muted);
    doc.text(safeText(item.label).toUpperCase(), x + 14, block.y + 22);
    setFont(doc, "semibold", 9);
    textColor(doc, colors.foreground);
    drawLines(doc, wrapForLayout(item.value, columnWidth - 28, 9).slice(0, 2), x + 14, block.y + 44, 12);
  });
}

function drawMetricGrid(doc: jsPDF, block: ClientReportPdfBlock) {
  const kpis = block.kpis || [];
  const columns = 3;
  const rows = Math.max(1, Math.ceil(kpis.length / columns));
  const cellWidth = block.width / columns;
  const cellHeight = block.height / rows;
  surface(doc, block.x, block.y, block.width, block.height, colors.surface);
  for (let column = 1; column < columns; column += 1) {
    drawColor(doc, colors.border);
    doc.line(block.x + column * cellWidth, block.y + 14, block.x + column * cellWidth, block.y + block.height - 14);
  }
  for (let row = 1; row < rows; row += 1) {
    drawColor(doc, colors.border);
    doc.line(block.x + 14, block.y + row * cellHeight, block.x + block.width - 14, block.y + row * cellHeight);
  }
  kpis.forEach((kpi, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = block.x + column * cellWidth + 16;
    const y = block.y + row * cellHeight;
    setFont(doc, "semibold", 7.25);
    textColor(doc, colors.muted);
    doc.text(safeText(kpi.label).toUpperCase(), x, y + 24, { maxWidth: cellWidth - 32 });
    setFont(doc, "semibold", 19);
    textColor(doc, colors.foreground);
    doc.text(safeText(kpi.value), x, y + 52, { maxWidth: cellWidth - 30 });
    if (kpi.delta) {
      setFont(doc, "normal", 7.5);
      textColor(doc, kpi.movement === "good" ? colors.success : kpi.movement === "bad" ? colors.destructive : colors.muted);
      doc.text(safeText(kpi.delta), x, y + 70, { maxWidth: cellWidth - 30 });
    }
  });
}

function drawHealthStrip(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  surface(doc, block.x, block.y, block.width, block.height, colors.raised);
  setFont(doc, "semibold", 7.5);
  textColor(doc, colors.muted);
  doc.text(safeText(block.title || "").toUpperCase(), block.x + 18, block.y + 24);
  setFont(doc, "semibold", 32);
  textColor(doc, colors.foreground);
  doc.text(safeText(model.healthLabel), block.x + 18, block.y + 62);
  drawStatus(doc, block.label || model.healthStatusLabel, block.x + 18, block.y + 74, block.tone || "neutral");
  drawColor(doc, colors.border);
  doc.line(block.x + 146, block.y + 16, block.x + 146, block.y + block.height - 16);
  setFont(doc, "normal", 9.5);
  textColor(doc, colors.foreground);
  drawLines(doc, wrapForLayout(block.text || "", block.width - 184, 9.5), block.x + 166, block.y + 35, 13);
}

function drawNarrative(doc: jsPDF, block: ClientReportPdfBlock) {
  surface(doc, block.x, block.y, block.width, block.height, colors.raised);
  fill(doc, colors.primary);
  doc.roundedRect(block.x, block.y, 4, block.height, 2, 2, "F");
  setFont(doc, "semibold", 10.5);
  textColor(doc, colors.primary);
  doc.text(safeText(block.title || ""), block.x + 20, block.y + 25, { maxWidth: block.width - 40 });
  setFont(doc, "normal", 10.25);
  textColor(doc, colors.foreground);
  drawLines(doc, safeText(block.text || "").split("\n"), block.x + 20, block.y + 49, 14);
}

function drawSignalList(doc: jsPDF, block: ClientReportPdfBlock) {
  const tone = block.tone || "neutral";
  const accent = toneColor(tone);
  drawColor(doc, colors.border);
  doc.line(block.x, block.y, block.x + block.width, block.y);
  setFont(doc, "semibold", 10.5);
  textColor(doc, accent);
  doc.text(safeText(block.title || ""), block.x, block.y + 24, { maxWidth: block.width });
  let y = block.y + 46;
  (block.items || []).forEach((item, index) => {
    const lines = wrapForLayout(item, block.width - 34, 8.8);
    setFont(doc, "semibold", 7.25);
    textColor(doc, colors.muted);
    doc.text(String(index + 1).padStart(2, "0"), block.x, y + 2);
    setFont(doc, "normal", 8.8);
    textColor(doc, colors.foreground);
    drawLines(doc, lines, block.x + 28, y + 2, 12);
    y += lines.length * 12 + 16;
  });
}

function drawTrendChart(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  const t = reportCopy[model.language];
  const rows = block.trend || [];
  surface(doc, block.x, block.y, block.width, block.height, colors.surface);
  setFont(doc, "semibold", 12);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.title || ""), block.x + 18, block.y + 26);
  setFont(doc, "normal", 8);
  textColor(doc, colors.muted);
  doc.text(`${t.spend}: ${formatMetric(Math.max(0, ...rows.map((row) => row.spend)), "currency", model.currency)}`, block.x + 18, block.y + 46);
  doc.text(`${model.primaryResultLabel}: ${formatMetric(Math.max(0, ...rows.map((row) => row.primary)), "number", model.currency)}`, block.x + block.width - 18, block.y + 46, { align: "right" });

  const chartX = block.x + 24;
  const chartY = block.y + 66;
  const chartWidth = block.width - 48;
  const chartHeight = block.height - 104;
  const maxSpend = Math.max(1, ...rows.map((row) => row.spend));
  const maxPrimary = Math.max(1, ...rows.map((row) => row.primary));
  drawColor(doc, colors.border);
  [0, 1, 2, 3].forEach((step) => {
    const y = chartY + (step * chartHeight) / 3;
    doc.line(chartX, y, chartX + chartWidth, y);
  });

  if (rows.length) {
    const slot = chartWidth / rows.length;
    rows.forEach((row, index) => {
      const barHeight = Math.max(2, (row.spend / maxSpend) * chartHeight);
      fill(doc, index === rows.length - 1 ? colors.primaryTint : colors.raised);
      doc.roundedRect(chartX + index * slot + 2, chartY + chartHeight - barHeight, Math.max(2, slot - 5), barHeight, 2, 2, "F");
    });

    drawColor(doc, colors.primary);
    doc.setLineWidth(2);
    rows.forEach((row, index) => {
      if (!index) return;
      const previous = rows[index - 1];
      const x1 = chartX + (index - 1) * slot + slot / 2;
      const y1 = chartY + chartHeight - (previous.primary / maxPrimary) * chartHeight;
      const x2 = chartX + index * slot + slot / 2;
      const y2 = chartY + chartHeight - (row.primary / maxPrimary) * chartHeight;
      doc.line(x1, y1, x2, y2);
    });
    doc.setLineWidth(0.75);
    const last = rows[rows.length - 1];
    fill(doc, colors.primary);
    doc.circle(chartX + (rows.length - 1) * slot + slot / 2, chartY + chartHeight - (last.primary / maxPrimary) * chartHeight, 3, "F");

    setFont(doc, "normal", 7);
    textColor(doc, colors.muted);
    const labelIndexes = Array.from(new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]));
    labelIndexes.forEach((index) => {
      const row = rows[index];
      doc.text(safeText(row.label), chartX + index * slot + slot / 2, chartY + chartHeight + 17, { align: "center" });
    });
  }
}

function drawRankingList(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  const rows = block.rows || [];
  surface(doc, block.x, block.y, block.width, block.height, colors.surface);
  setFont(doc, "semibold", 11);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.title || ""), block.x + 16, block.y + 25, { maxWidth: block.width - 32 });
  let y = block.y + 52;
  rows.forEach((row, index) => {
    if (index > 0) {
      drawColor(doc, colors.border);
      doc.line(block.x + 16, y - 10, block.x + block.width - 16, y - 10);
    }
    setFont(doc, "semibold", 7.25);
    textColor(doc, colors.muted);
    doc.text(String(index + 1).padStart(2, "0"), block.x + 16, y + 2);
    setFont(doc, "normal", 8.3);
    textColor(doc, colors.foreground);
    drawLines(doc, wrapForLayout(reportRowLabel(row), block.width - 128, 8.3).slice(0, 2), block.x + 43, y + 2, 11);
    setFont(doc, "semibold", 8.1);
    textColor(doc, index === 0 ? colors.primary : colors.muted);
    doc.text(safeText(formatMetric(row.spend, "currency", model.currency)), block.x + block.width - 16, y + 2, { align: "right", maxWidth: 86 });
    y += 45;
  });
}

function drawActionRow(doc: jsPDF, block: ClientReportPdfBlock) {
  if (!block.action) return;
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height, block.x + block.width, block.y + block.height);
  setFont(doc, "semibold", 19);
  textColor(doc, colors.primary);
  doc.text(String(block.index || 1).padStart(2, "0"), block.x, block.y + 31);
  fill(doc, colors.primary);
  doc.roundedRect(block.x + 48, block.y + 14, 3, block.height - 28, 1.5, 1.5, "F");
  setFont(doc, "semibold", 11.5);
  textColor(doc, colors.foreground);
  const titleLines = wrapForLayout(block.action.title, block.width - 92, 11.5);
  drawLines(doc, titleLines, block.x + 70, block.y + 25, 15);
  setFont(doc, "normal", 8.8);
  textColor(doc, colors.muted);
  drawLines(doc, wrapForLayout(block.action.detail, block.width - 92, 8.8), block.x + 70, block.y + 30 + titleLines.length * 15, 12);
}

function drawBreakdownList(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  const rows = block.rows || [];
  const maxSpend = Math.max(1, ...rows.map((row) => row.spend));
  surface(doc, block.x, block.y, block.width, block.height, colors.surface);
  setFont(doc, "semibold", 11);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.title || ""), block.x + 16, block.y + 25);
  let y = block.y + 52;
  rows.forEach((row, index) => {
    const label = reportRowLabel(row);
    const barWidth = Math.max(3, ((block.width - 132) * row.spend) / maxSpend);
    setFont(doc, "normal", 8.2);
    textColor(doc, colors.foreground);
    doc.text(safeText(label), block.x + 16, y, { maxWidth: block.width - 118 });
    setFont(doc, "semibold", 7.8);
    textColor(doc, colors.muted);
    doc.text(safeText(formatMetric(row.spend, "currency", model.currency)), block.x + block.width - 16, y, { align: "right", maxWidth: 92 });
    fill(doc, index === 0 ? colors.primary : colors.border);
    doc.roundedRect(block.x + 16, y + 10, barWidth, 4, 2, 2, "F");
    y += 32;
  });
}

function drawTableHeader(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  const t = reportCopy[model.language];
  fill(doc, colors.raised);
  doc.roundedRect(block.x, block.y, block.width, block.height, 7, 7, "F");
  const columns = tableColumns(block);
  setFont(doc, "semibold", 7.1);
  textColor(doc, colors.muted);
  doc.text(safeText(block.title || "").toUpperCase(), block.x + 14, block.y + 20, { maxWidth: columns.nameWidth });
  doc.text(t.spend.toUpperCase(), columns.spend, block.y + 20, { align: "right" });
  doc.text(safeText(model.primaryResultLabel).toUpperCase(), columns.result, block.y + 20, { align: "right" });
  doc.text((model.primaryCostKey ? safeText(model.primaryCostLabel) : t.cost).toUpperCase(), columns.cost, block.y + 20, { align: "right" });
  doc.text("CTR", columns.ctr, block.y + 20, { align: "right" });
}

function drawTableRow(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  if (!block.row) return;
  const columns = tableColumns(block);
  drawColor(doc, colors.border);
  doc.line(block.x + 14, block.y + block.height, block.x + block.width - 14, block.y + block.height);
  setFont(doc, "normal", 8.1);
  textColor(doc, colors.foreground);
  drawLines(doc, wrapForLayout(reportRowLabel(block.row), columns.nameWidth, 8.1), block.x + 14, block.y + 19, 11);
  setFont(doc, "normal", 7.9);
  textColor(doc, colors.muted);
  doc.text(safeText(formatMetric(block.row.spend, "currency", model.currency)), columns.spend, block.y + 19, { align: "right" });
  doc.text(safeText(formatMetric(Number(block.row[model.primaryResultKey] || 0), "number", model.currency)), columns.result, block.y + 19, { align: "right" });
  doc.text(model.primaryCostKey ? safeText(formatMetric(Number(block.row[model.primaryCostKey] || 0), "currency", model.currency)) : "n/a", columns.cost, block.y + 19, { align: "right" });
  doc.text(safeText(formatMetric(block.row.ctr, "percent", model.currency)), columns.ctr, block.y + 19, { align: "right" });
}

function drawDiagnosticRow(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  if (!block.diagnostic) return;
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height, block.x + block.width, block.y + block.height);
  drawStatus(doc, diagnosticLabel(block.diagnostic.status, model.language), block.x, block.y + 16, block.tone || "neutral");
  setFont(doc, "semibold", 10.5);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.diagnostic.label), block.x + 92, block.y + 29, { maxWidth: block.width - 108 });
  setFont(doc, "normal", 8.5);
  textColor(doc, colors.muted);
  drawLines(doc, wrapForLayout(block.diagnostic.detail, block.width - 108, 8.5), block.x + 92, block.y + 50, 11.5);
}

function drawCreativeRow(doc: jsPDF, block: ClientReportPdfBlock) {
  if (!block.creative) return;
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height, block.x + block.width, block.y + block.height);
  drawStatus(doc, block.creative.status || "UNKNOWN", block.x, block.y + 16, "neutral");
  setFont(doc, "semibold", 10.5);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.creative.name), block.x + 92, block.y + 29, { maxWidth: block.width - 108 });
  setFont(doc, "normal", 8.3);
  textColor(doc, colors.muted);
  doc.text(safeText(block.creative.summary), block.x + 92, block.y + 48, { maxWidth: block.width - 108 });
  const items = block.creative.ads.map((item) => `- ${item}`).join("\n");
  drawLines(doc, wrapForLayout(items, block.width - 108, 8.1), block.x + 92, block.y + 70, 11);
}

function drawNote(doc: jsPDF, block: ClientReportPdfBlock) {
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + 2, block.x + block.width, block.y + 2);
  setFont(doc, "normal", 7.8);
  textColor(doc, colors.muted);
  drawLines(doc, wrapForLayout(block.text || "", block.width - 10, 7.8), block.x, block.y + 20, 10.5);
}

function surface(doc: jsPDF, x: number, y: number, width: number, height: number, color: Rgb) {
  fill(doc, color);
  drawColor(doc, colors.border);
  doc.roundedRect(x, y, width, height, 9, 9, "FD");
}

function drawStatus(doc: jsPDF, label: string, x: number, y: number, tone: ReportTone) {
  const text = safeText(label).toUpperCase();
  const width = Math.max(48, Math.min(120, 18 + text.length * 4.6));
  fill(doc, toneTint(tone));
  doc.roundedRect(x, y, width, 20, 6, 6, "F");
  setFont(doc, "semibold", 6.8);
  textColor(doc, toneColor(tone));
  doc.text(text, x + width / 2, y + 13, { align: "center", maxWidth: width - 10 });
}

function registerFonts(doc: jsPDF, fonts: ClientReportPdfFontData) {
  doc.addFileToVFS("Geist-Regular.ttf", fonts.regular);
  doc.addFont("Geist-Regular.ttf", "Geist", "normal", "Identity-H");
  doc.addFileToVFS("Geist-SemiBold.ttf", fonts.semibold);
  doc.addFont("Geist-SemiBold.ttf", "Geist", "semibold", "Identity-H");
  doc.setFont("Geist", "normal");
}

function setFont(doc: jsPDF, style: "normal" | "semibold", size: number) {
  doc.setFont("Geist", style);
  doc.setFontSize(size);
}

function textColor(doc: jsPDF, rgb: Rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function fill(doc: jsPDF, rgb: Rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function drawColor(doc: jsPDF, rgb: Rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setLineWidth(0.75);
}

function drawLines(doc: jsPDF, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => doc.text(safeText(line), x, y + index * lineHeight));
}

function metricGridHeight(kpiCount: number) {
  return Math.max(88, Math.ceil(Math.max(1, kpiCount) / 3) * 80);
}

function signalListHeight(items: string[], width: number) {
  return Math.max(112, 50 + items.reduce((height, item) => height + wrapForLayout(item, width - 34, 8.8).length * 12 + 16, 0));
}

function rankingHeight(rows: NormalizedRow[]) {
  return Math.max(112, 58 + rows.length * 45);
}

function actionHeight(action: ClientReportAction, width: number) {
  const titleLines = wrapForLayout(action.title, width - 92, 11.5).length;
  const detailLines = wrapForLayout(action.detail, width - 92, 8.8).length;
  return Math.max(86, 44 + titleLines * 15 + detailLines * 12);
}

function breakdownHeight(rows: NormalizedRow[]) {
  return Math.max(118, 58 + rows.length * 32);
}

function tableRowHeight(row: NormalizedRow | undefined) {
  if (!row) return 40;
  return Math.max(40, 18 + wrapForLayout(reportRowLabel(row), contentWidth - 306, 8.1).length * 11);
}

function diagnosticHeight(detail: string, width: number) {
  return Math.max(78, 58 + textHeight(detail, width - 108, 8.5, 11.5));
}

function creativeHeight(creative: ClientReportViewModel["creativeDetails"][number], width: number) {
  const ads = creative.ads.map((item) => `- ${item}`).join("\n");
  return Math.max(96, 76 + textHeight(ads, width - 108, 8.1, 11));
}

function textHeight(value: string, width: number, fontSize: number, lineHeight = fontSize + 3) {
  return wrapForLayout(value, width, fontSize).length * lineHeight;
}

function wrapForLayout(value: string, width: number, fontSize: number) {
  const charsPerLine = Math.max(10, Math.floor(width / (fontSize * 0.52)));
  return safeText(value).split("\n").flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (word.length > charsPerLine) {
        if (current) {
          lines.push(current);
          current = "";
        }
        for (let start = 0; start < word.length; start += charsPerLine) lines.push(word.slice(start, start + charsPerLine));
        continue;
      }
      const next = current ? `${current} ${word}` : word;
      if (next.length > charsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  });
}

function tableColumns(block: Pick<ClientReportPdfBlock, "x" | "width">) {
  return {
    nameWidth: block.width - 306,
    spend: block.x + block.width - 220,
    result: block.x + block.width - 146,
    cost: block.x + block.width - 66,
    ctr: block.x + block.width - 14,
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

function healthTone(status: ClientReportViewModel["healthStatus"]): ReportTone {
  if (status === "healthy") return "good";
  if (status === "warning") return "warning";
  return "bad";
}

function diagnosticLabel(status: "pass" | "warning" | "fail", language: ClientReportViewModel["language"]) {
  if (language === "vi") {
    if (status === "pass") return "Đạt";
    if (status === "warning") return "Theo dõi";
    return "Xử lý";
  }
  if (status === "pass") return "Pass";
  if (status === "warning") return "Watch";
  return "Action";
}

function toneColor(tone: ReportTone): Rgb {
  if (tone === "primary") return colors.primary;
  if (tone === "good") return colors.success;
  if (tone === "warning") return colors.warning;
  if (tone === "bad") return colors.destructive;
  return colors.muted;
}

function toneTint(tone: ReportTone): Rgb {
  if (tone === "primary") return colors.primaryTint;
  if (tone === "good") return colors.successTint;
  if (tone === "warning") return colors.warningTint;
  if (tone === "bad") return colors.destructiveTint;
  return colors.raised;
}

function safeText(value: string) {
  return value.replace(/[–—]/g, "-").replace(/₫/g, " VND").replace(/\u00a0/g, " ").normalize("NFC");
}

function slugify(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
}

async function fetchFont(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load report font: ${url}`);
  return arrayBufferToBase64(await response.arrayBuffer());
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
}
