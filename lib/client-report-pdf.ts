import { jsPDF } from "jspdf";
import { formatMetric } from "@/lib/metrics";
import type { ClientReportAction, ClientReportPdfFile, ClientReportTable, ClientReportViewModel } from "@/lib/client-report";
import type { NormalizedRow } from "@/lib/types";

export type { ClientReportPdfFile };

export type ClientReportPdfBlock = {
  kind: "header" | "footer" | "title" | "kpi-card" | "text-card" | "bullet-list" | "bar-list" | "trend-chart" | "action-card" | "table-header" | "table-row" | "diagnostic-card" | "creative-card";
  section: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kicker?: string;
  title?: string;
  text?: string;
  footnote?: string;
  items?: string[];
  kpi?: ClientReportViewModel["kpis"][number];
  rows?: NormalizedRow[];
  trend?: ClientReportViewModel["dailyTrend"];
  action?: ClientReportAction;
  row?: NormalizedRow;
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

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = { top: 42, right: 42, bottom: 42, left: 42 };
const contentWidth = pageWidth - margin.left - margin.right;
const pageBottom = pageHeight - margin.bottom;
const contentBottom = pageBottom - 38;

const colors = {
  accent: [198, 38, 38] as const,
  ink: [17, 24, 39] as const,
  muted: [102, 112, 133] as const,
  line: [229, 231, 235] as const,
  panel: [255, 255, 255] as const,
  panelAlt: [248, 250, 252] as const,
};

export function buildClientReportPdf(model: ClientReportViewModel): ClientReportPdfFile {
  const layout = buildClientReportPdfLayout(model);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  layout.pages.forEach((page, index) => {
    if (index > 0) doc.addPage();
    if (page.section === "Cover") {
      fill(doc, [9, 9, 9]);
      doc.rect(0, 0, layout.width, layout.height, "F");
      fill(doc, colors.accent);
      doc.rect(0, 0, 14, layout.height, "F");
    }
    page.blocks.forEach((block) => drawBlock(doc, model, block));
  });

  return {
    filename: `${slugify(model.accountName)}-meta-ads-report-${model.dateRange.since}-to-${model.dateRange.until}.pdf`,
    blob: doc.output("blob"),
  };
}

export function buildClientReportPdfLayout(model: ClientReportViewModel): ClientReportPdfLayout {
  const layout: ClientReportPdfLayout = { width: pageWidth, height: pageHeight, margin, pages: [] };
  let page: ClientReportPdfPage;
  let cursor = margin.top;

  const addPage = (section: string, footnote?: string) => {
    page = { pageNumber: layout.pages.length + 1, section, blocks: [] };
    layout.pages.push(page);
    if (section !== "Cover") {
      addBlock({ kind: "header", section, x: margin.left, y: margin.top, width: contentWidth, height: 20, title: section });
    }
    addBlock({ kind: "footer", section, x: margin.left, y: pageBottom - 14, width: contentWidth, height: 12, title: section === "Cover" ? "Cover" : `Page ${page.pageNumber}`, footnote });
    cursor = section === "Cover" ? margin.top : 86;
  };

  const addBlock = (block: Omit<ClientReportPdfBlock, "pageNumber">) => {
    page.blocks.push({ ...block, pageNumber: page.pageNumber });
  };

  const startSection = (section: string, kicker: string, title: string, footnote?: string) => {
    addPage(section, footnote);
    addBlock({ kind: "title", section, x: margin.left, y: 86, width: contentWidth, height: 48, kicker, title });
    cursor = 150;
  };

  const continueSection = (section: string, footnote?: string) => {
    addPage(section, footnote);
    cursor = 76;
  };

  const ensureSpace = (height: number, section: string, footnote?: string) => {
    if (cursor + height > contentBottom) continueSection(section, footnote);
  };

  addPage("Cover");
  addBlock({ kind: "title", section: "Cover", x: margin.left, y: 112, width: contentWidth, height: 96, kicker: model.copy.preparedBy, title: model.copy.title, text: model.copy.subtitle });
  addBlock({ kind: "text-card", section: "Cover", x: margin.left, y: 322, width: 310, height: 124, title: model.accountName, items: [model.dateRangeLabel, model.healthLabel, model.copy.source] });

  startSection(model.copy.executiveSummary, model.copy.executiveSummary.toUpperCase(), model.language === "vi" ? "Hiệu quả tổng quan" : "Performance at a glance", model.copy.footnoteSource);
  const kpiGap = 12;
  const kpiWidth = (contentWidth - kpiGap * 3) / 4;
  model.kpis.slice(0, 4).forEach((kpi, index) => {
    addBlock({ kind: "kpi-card", section: model.copy.executiveSummary, x: margin.left + index * (kpiWidth + kpiGap), y: cursor, width: kpiWidth, height: 86, kpi });
  });
  cursor += 110;

  addExecutiveVerdict();

  const bulletWidth = (contentWidth - 24) / 3;
  const bulletHeight = Math.max(
    listHeight(model.wins, bulletWidth),
    listHeight(model.risks, bulletWidth),
    listHeight(model.actions.map((action) => action.title), bulletWidth),
  );
  ensureSpace(bulletHeight, model.copy.executiveSummary, model.copy.footnoteSource);
  addBlock({ kind: "bullet-list", section: model.copy.executiveSummary, x: margin.left, y: cursor, width: bulletWidth, height: bulletHeight, title: model.copy.wins, items: model.wins });
  addBlock({ kind: "bullet-list", section: model.copy.executiveSummary, x: margin.left + bulletWidth + 12, y: cursor, width: bulletWidth, height: bulletHeight, title: model.copy.risks, items: model.risks });
  addBlock({ kind: "bullet-list", section: model.copy.executiveSummary, x: margin.left + (bulletWidth + 12) * 2, y: cursor, width: bulletWidth, height: bulletHeight, title: model.copy.nextMoves, items: model.actions.map((action) => action.title) });

  startSection(model.copy.performanceStory, model.copy.performanceStory.toUpperCase(), model.language === "vi" ? "Điều gì thay đổi và vì sao" : "What changed and why", model.copy.footnoteComparison);
  addBarList(model.language === "vi" ? "Top campaign" : "Top campaigns", model.topCampaigns, model.copy.performanceStory);
  addBarList(model.language === "vi" ? "Top ad set" : "Top ad sets", model.topAdsets, model.copy.performanceStory);

  startSection(model.copy.recommendations, model.copy.recommendations.toUpperCase(), model.language === "vi" ? "Red Agency khuyến nghị gì tiếp theo" : "What Red Agency recommends next", model.copy.footnoteRecommendations);
  model.actions.forEach((action) => {
    const height = actionHeight(action, contentWidth);
    ensureSpace(height, model.copy.recommendations, model.copy.footnoteRecommendations);
    addBlock({ kind: "action-card", section: model.copy.recommendations, x: margin.left, y: cursor, width: contentWidth, height, action });
    cursor += height + 12;
  });

  startSection(model.copy.appendixCharts, "Appendix A", model.language === "vi" ? "Biểu đồ và breakdown" : "Charts and breakdowns", model.copy.footnoteSource);
  addBarList(model.language === "vi" ? "Platform" : "Platform breakdown", model.breakdowns.platforms, model.copy.appendixCharts);
  const halfWidth = (contentWidth - 18) / 2;
  const pairedHeight = Math.max(barListHeight(model.breakdowns.regions), barListHeight(model.breakdowns.ageGender));
  ensureSpace(pairedHeight, model.copy.appendixCharts, model.copy.footnoteSource);
  addBlock({ kind: "bar-list", section: model.copy.appendixCharts, x: margin.left, y: cursor, width: halfWidth, height: pairedHeight, title: model.language === "vi" ? "Địa lý" : "Geography", rows: model.breakdowns.regions });
  addBlock({ kind: "bar-list", section: model.copy.appendixCharts, x: margin.left + halfWidth + 18, y: cursor, width: halfWidth, height: pairedHeight, title: model.language === "vi" ? "Tuổi / giới tính" : "Age / gender", rows: model.breakdowns.ageGender });

  startSection(model.copy.appendixTables, "Appendix B", model.language === "vi" ? "Bảng hiệu quả" : "Performance tables");
  model.tables.forEach((table) => addTable(table));

  startSection(model.copy.appendixDiagnostics, "Appendix C", model.language === "vi" ? "Chẩn đoán và creative" : "Diagnostics and creative detail");
  model.diagnostics.forEach((check) => {
    const height = Math.max(58, 34 + textHeight(check.detail, contentWidth - 28, 8.5));
    ensureSpace(height, model.copy.appendixDiagnostics);
    addBlock({ kind: "diagnostic-card", section: model.copy.appendixDiagnostics, x: margin.left, y: cursor, width: contentWidth, height, title: check.label, text: check.detail });
    cursor += height + 10;
  });
  model.creativeDetails.forEach((creative) => {
    const height = Math.max(64, 42 + textHeight(creative.summary, contentWidth - 28, 8.5) + textHeight(creative.ads.join(", "), contentWidth - 28, 8));
    ensureSpace(height, model.copy.appendixDiagnostics);
    addBlock({ kind: "creative-card", section: model.copy.appendixDiagnostics, x: margin.left, y: cursor, width: contentWidth, height, title: creative.name, text: creative.summary, items: creative.ads });
    cursor += height + 10;
  });

  return layout;

  function addExecutiveVerdict() {
    const chartWidth = 250;
    const cardX = margin.left + 270;
    const cardWidth = contentWidth - 270;
    const lineHeight = 12;
    const textLines = wrapForLayout(model.verdictText, cardWidth - 28, 9.5);
    const footnoteLines = wrapForLayout(model.insightSummary, cardWidth - 28, 9);
    let remainingText = textLines;
    let remainingFootnote = footnoteLines;
    let firstChunk = true;

    while (remainingText.length || remainingFootnote.length) {
      const available = contentBottom - cursor;
      if (available < 116) continueSection(model.copy.executiveSummary, model.copy.footnoteSource);

      const maxLines = Math.max(1, Math.floor((contentBottom - cursor - 58) / lineHeight));
      const textChunk = remainingText.slice(0, maxLines);
      const remainingLineBudget = maxLines - textChunk.length;
      const footnoteChunk = remainingText.length > textChunk.length ? [] : remainingFootnote.slice(0, remainingLineBudget);
      const cardHeight = Math.max(180, 58 + (textChunk.length + footnoteChunk.length) * lineHeight);

      if (firstChunk) {
        addBlock({ kind: "trend-chart", section: model.copy.executiveSummary, x: margin.left, y: cursor, width: chartWidth, height: cardHeight, title: model.language === "vi" ? "Xu hướng chi tiêu" : "Spend trend", trend: model.dailyTrend });
      }
      addBlock({
        kind: "text-card",
        section: model.copy.executiveSummary,
        x: firstChunk ? cardX : margin.left,
        y: cursor,
        width: firstChunk ? cardWidth : contentWidth,
        height: cardHeight,
        title: model.copy.verdictLabel,
        text: textChunk.join("\n"),
        footnote: footnoteChunk.join("\n") || undefined,
      });
      cursor += cardHeight + 24;
      remainingText = remainingText.slice(textChunk.length);
      remainingFootnote = remainingFootnote.slice(footnoteChunk.length);
      firstChunk = false;
    }
  }

  function addBarList(title: string, rows: NormalizedRow[], section: string) {
    const height = barListHeight(rows);
    ensureSpace(height, section, section === model.copy.performanceStory ? model.copy.footnoteComparison : model.copy.footnoteSource);
    addBlock({ kind: "bar-list", section, x: margin.left, y: cursor, width: contentWidth, height, title, rows });
    cursor += height + 20;
  }

  function addTable(table: ClientReportTable) {
    ensureSpace(36 + tableRowHeight(table.rows[0]), model.copy.appendixTables);
    addBlock({ kind: "table-header", section: table.title, x: margin.left, y: cursor, width: contentWidth, height: 36, title: table.title });
    cursor += 36;

    table.rows.forEach((row) => {
      const rowHeight = tableRowHeight(row);
      if (cursor + rowHeight > contentBottom) {
        continueSection(model.copy.appendixTables);
        addBlock({ kind: "table-header", section: table.title, x: margin.left, y: cursor, width: contentWidth, height: 36, title: `${table.title} continued` });
        cursor += 36;
      }
      addBlock({ kind: "table-row", section: table.title, x: margin.left, y: cursor, width: contentWidth, height: rowHeight, row });
      cursor += rowHeight;
    });
    cursor += 18;
  }
}

function drawBlock(doc: jsPDF, model: ClientReportViewModel, block: ClientReportPdfBlock) {
  if (block.kind === "header") {
    setFont(doc, "bold", 8);
    textColor(doc, colors.muted);
    doc.text(pdfText(block.title || block.section).toUpperCase(), block.x, block.y + 8);
    doc.text(pdfText(model.dateRangeLabel).toUpperCase(), block.x + block.width, block.y + 8, { align: "right" });
    drawColor(doc, colors.line);
    doc.line(block.x, block.y + 18, block.x + block.width, block.y + 18);
    return;
  }

  if (block.kind === "footer") {
    drawColor(doc, block.section === "Cover" ? [63, 63, 70] : colors.line);
    doc.line(block.x, block.y - 8, block.x + block.width, block.y - 8);
    setFont(doc, "bold", 8);
    textColor(doc, block.section === "Cover" ? [212, 212, 216] : colors.muted);
    doc.text("Red Agency", block.x, block.y + 8);
    doc.text(pdfText(block.title || "Report"), block.x + block.width / 2, block.y + 8, { align: "center" });
    doc.text(pdfText(model.accountName), block.x + block.width, block.y + 8, { align: "right" });
    if (block.footnote) {
      setFont(doc, "normal", 7.5);
      doc.text(doc.splitTextToSize(pdfText(block.footnote), block.width), block.x, block.y - 18);
    }
    return;
  }

  if (block.kind === "title") {
    setFont(doc, "bold", block.section === "Cover" ? 10 : 8);
    textColor(doc, block.section === "Cover" ? [212, 212, 216] : colors.muted);
    if (block.kicker) doc.text(block.kicker.startsWith("Appendix ") ? pdfText(block.kicker) : pdfText(block.kicker).toUpperCase(), block.x, block.y);
    setFont(doc, "bold", block.section === "Cover" ? 36 : 25);
    textColor(doc, block.section === "Cover" ? [255, 255, 255] : colors.ink);
    doc.text(pdfText(block.title || "Report"), block.x, block.y + (block.section === "Cover" ? 42 : 30), { maxWidth: block.width });
    if (block.text) {
      setFont(doc, "normal", 12);
      textColor(doc, [208, 213, 221]);
      doc.text(doc.splitTextToSize(pdfText(block.text), block.width - 58), block.x, block.y + 98);
    }
    return;
  }

  if (block.kind === "kpi-card") {
    panel(doc, block);
    if (!block.kpi) return;
    fill(doc, block.kpi.movement === "bad" ? [254, 242, 242] : block.kpi.movement === "good" ? [240, 253, 244] : colors.panelAlt);
    doc.roundedRect(block.x + 12, block.y + 12, 26, 26, 7, 7, "F");
    setFont(doc, "bold", 7.5);
    textColor(doc, colors.muted);
    doc.text(pdfText(block.kpi.label).toUpperCase(), block.x + 48, block.y + 24, { maxWidth: block.width - 58 });
    setFont(doc, "bold", 15);
    textColor(doc, colors.ink);
    doc.text(pdfText(block.kpi.value), block.x + 14, block.y + 58, { maxWidth: block.width - 24 });
    if (block.kpi.delta) {
      setFont(doc, "normal", 7.5);
      textColor(doc, block.kpi.movement === "bad" ? [180, 35, 24] : block.kpi.movement === "good" ? [2, 122, 72] : colors.muted);
      doc.text(pdfText(block.kpi.delta), block.x + 14, block.y + 76, { maxWidth: block.width - 24 });
    }
    return;
  }

  if (block.kind === "text-card") {
    panel(doc, block, block.section === "Cover" ? [24, 24, 27] : colors.panel);
    setFont(doc, "bold", block.section === "Cover" ? 11 : 12);
    textColor(doc, block.section === "Cover" ? [255, 255, 255] : colors.ink);
    doc.text(pdfText(block.title || ""), block.x + 14, block.y + 28, { maxWidth: block.width - 28 });
    setFont(doc, "normal", block.section === "Cover" ? 10 : 9.5);
    textColor(doc, block.section === "Cover" ? [212, 212, 216] : [71, 84, 103]);
    let y = block.y + 54;
    if (block.text) {
      doc.text(doc.splitTextToSize(pdfText(block.text), block.width - 28), block.x + 14, y);
      y += textHeight(block.text, block.width - 28, 9.5) + 12;
    }
    if (block.footnote) {
      setFont(doc, "bold", 9);
      textColor(doc, colors.accent);
      doc.text(doc.splitTextToSize(pdfText(block.footnote), block.width - 28), block.x + 14, y);
    }
    (block.items || []).forEach((item) => {
      doc.text(pdfText(item), block.x + 14, y);
      y += 26;
    });
    return;
  }

  if (block.kind === "bullet-list") {
    panel(doc, block);
    setFont(doc, "bold", 11);
    textColor(doc, colors.ink);
    doc.text(pdfText(block.title || ""), block.x + 14, block.y + 24);
    setFont(doc, "normal", 8.5);
    textColor(doc, [71, 84, 103]);
    let y = block.y + 46;
    (block.items || []).slice(0, 3).forEach((item) => {
      const lines = doc.splitTextToSize(pdfText(`- ${item}`), block.width - 28);
      doc.text(lines, block.x + 14, y);
      y += lines.length * 11 + 7;
    });
    return;
  }

  if (block.kind === "trend-chart") {
    panel(doc, block);
    setFont(doc, "bold", 11);
    textColor(doc, colors.ink);
    doc.text(pdfText(block.title || ""), block.x + 14, block.y + 24);
    const rows = (block.trend || []).slice(-10);
    const maxSpend = Math.max(1, ...rows.map((row) => row.spend));
    const chartX = block.x + 18;
    const chartY = block.y + 54;
    const chartW = block.width - 36;
    const chartH = block.height - 88;
    drawColor(doc, [238, 242, 246]);
    [0, 1, 2].forEach((step) => doc.line(chartX, chartY + step * (chartH / 2), chartX + chartW, chartY + step * (chartH / 2)));
    rows.forEach((row, index) => {
      const barW = chartW / Math.max(1, rows.length) - 5;
      const barH = Math.max(4, (row.spend / maxSpend) * chartH);
      const x = chartX + index * (chartW / Math.max(1, rows.length)) + 2;
      fill(doc, index === rows.length - 1 ? colors.accent : [252, 165, 165]);
      doc.roundedRect(x, chartY + chartH - barH, barW, barH, 3, 3, "F");
      if (index === 0 || index === rows.length - 1) {
        setFont(doc, "normal", 7);
        textColor(doc, colors.muted);
        doc.text(pdfText(row.label), x, chartY + chartH + 14);
      }
    });
    return;
  }

  if (block.kind === "bar-list") {
    panel(doc, block);
    setFont(doc, "bold", 11);
    textColor(doc, colors.ink);
    doc.text(pdfText(block.title || ""), block.x + 14, block.y + 24);
    const rows = (block.rows || []).slice(0, 6);
    const maxSpend = Math.max(1, ...rows.map((row) => row.spend));
    let y = block.y + 50;
    rows.forEach((row, index) => {
      const label = reportRowLabel(row);
      const barWidth = Math.max(4, ((block.width - 142) * row.spend) / maxSpend);
      setFont(doc, "normal", 8.2);
      textColor(doc, [52, 64, 84]);
      doc.text(pdfText(label), block.x + 14, y, { maxWidth: block.width - 122 });
      fill(doc, index === 0 ? colors.accent : [254, 202, 202]);
      doc.roundedRect(block.x + 14, y + 8, barWidth, 7, 3, 3, "F");
      fill(doc, [243, 244, 246]);
      doc.roundedRect(block.x + 14 + barWidth, y + 8, Math.max(0, block.width - 142 - barWidth), 7, 3, 3, "F");
      setFont(doc, "bold", 8);
      textColor(doc, colors.ink);
      doc.text(pdfText(formatMetric(row.spend, "currency", model.currency)), block.x + block.width - 14, y + 7, { align: "right" });
      y += 27;
    });
    return;
  }

  if (block.kind === "action-card") {
    panel(doc, block);
    if (!block.action) return;
    fill(doc, colors.accent);
    doc.circle(block.x + 24, block.y + 27, 11, "F");
    setFont(doc, "bold", 11);
    textColor(doc, colors.ink);
    doc.text(pdfText(block.action.title), block.x + 46, block.y + 24, { maxWidth: block.width - 72 });
    setFont(doc, "normal", 8.5);
    textColor(doc, [71, 84, 103]);
    doc.text(doc.splitTextToSize(pdfText(block.action.detail), block.width - 72), block.x + 46, block.y + 46);
    return;
  }

  if (block.kind === "table-header") {
    panel(doc, block, colors.panelAlt);
    setFont(doc, "bold", 11);
    textColor(doc, colors.ink);
    doc.text(pdfText(block.title || block.section), block.x + 14, block.y + 23);
    setFont(doc, "bold", 7.5);
    textColor(doc, colors.muted);
    doc.text("SPEND", block.x + block.width - 212, block.y + 23);
    doc.text("CTR", block.x + block.width - 116, block.y + 23);
    doc.text("RESULT", block.x + block.width - 14, block.y + 23, { align: "right" });
    return;
  }

  if (block.kind === "table-row") {
    if (!block.row) return;
    drawColor(doc, colors.line);
    doc.line(block.x + 14, block.y, block.x + block.width - 14, block.y);
    setFont(doc, "normal", 8.2);
    textColor(doc, [52, 64, 84]);
    doc.text(doc.splitTextToSize(pdfText(reportRowLabel(block.row)), block.width - 280), block.x + 14, block.y + 18);
    doc.text(pdfText(formatMetric(block.row.spend, "currency", model.currency)), block.x + block.width - 212, block.y + 18, { maxWidth: 82 });
    doc.text(pdfText(formatMetric(block.row.ctr, "percent", model.currency)), block.x + block.width - 116, block.y + 18);
    doc.text(pdfText(formatMetric(rowResult(block.row), "number", model.currency)), block.x + block.width - 14, block.y + 18, { align: "right" });
    return;
  }

  if (block.kind === "diagnostic-card" || block.kind === "creative-card") {
    panel(doc, block);
    setFont(doc, "bold", 10.5);
    textColor(doc, colors.ink);
    doc.text(pdfText(block.title || ""), block.x + 14, block.y + 24, { maxWidth: block.width - 28 });
    setFont(doc, "normal", 8.5);
    textColor(doc, [71, 84, 103]);
    let y = block.y + 44;
    if (block.text) {
      const lines = doc.splitTextToSize(pdfText(block.text), block.width - 28);
      doc.text(lines, block.x + 14, y);
      y += lines.length * 11 + 8;
    }
    if (block.items?.length) {
      setFont(doc, "normal", 8);
      doc.text(doc.splitTextToSize(pdfText(block.items.join(", ")), block.width - 28), block.x + 14, y);
    }
  }
}

function panel(doc: jsPDF, block: ClientReportPdfBlock, color: readonly [number, number, number] = colors.panel) {
  fill(doc, color);
  drawColor(doc, [234, 236, 240]);
  doc.roundedRect(block.x, block.y, block.width, block.height, 12, 12, "FD");
}

function setFont(doc: jsPDF, style: "normal" | "bold", size: number) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
}

function textColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function fill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function drawColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function listHeight(items: string[], width: number) {
  return Math.max(118, 46 + items.slice(0, 3).reduce((height, item) => height + textHeight(`- ${item}`, width - 28, 8.5) + 7, 0));
}

function actionHeight(action: ClientReportAction, width: number) {
  return Math.max(72, 44 + textHeight(action.title, width - 72, 10) + textHeight(action.detail, width - 72, 8.5));
}

function barListHeight(rows: NormalizedRow[]) {
  return Math.max(118, 54 + Math.min(rows.length, 6) * 27);
}

function tableRowHeight(row: NormalizedRow | undefined) {
  if (!row) return 56;
  return Math.max(56, 28 + textHeight(reportRowLabel(row), contentWidth - 280, 8.2));
}

function textHeight(value: string, width: number, fontSize: number) {
  return wrapForLayout(value, width, fontSize).length * (fontSize + 2.5);
}

function wrapForLayout(value: string, width: number, fontSize: number) {
  const charsPerLine = Math.max(12, Math.floor(width / (fontSize * 0.52)));
  return pdfText(value).split("\n").flatMap((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > charsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    lines.push(current);
    return lines;
  });
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

function rowResult(row: NormalizedRow) {
  return row.leads || row.messages || row.purchases || row.linkClicks || row.reach;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
}

function pdfText(value: string) {
  return value
    .replace(/₫/g, "VND")
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "");
}
