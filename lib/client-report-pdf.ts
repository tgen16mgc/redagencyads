import { jsPDF } from "jspdf";
import type {
  ClientReportPdfFile,
  ClientReportViewModel,
} from "@/lib/client-report";
import { formatClientReportCompactMetric, formatClientReportMetric } from "@/lib/client-report";
import {
  buildClientReportPdfLayout,
  clientReportMetricGridColumns,
  clientReportPdfCopy as reportCopy,
  createClientReportTypesetter,
  registerClientReportPdfFonts,
  safePdfText,
  type ClientReportPdfBlock,
  type ClientReportPdfFontData,
  type ClientReportTypesetter,
  type ReportTone,
} from "@/lib/client-report-layout";
import { supportedPdfImageFormat } from "@/lib/meta-preview-image";

type Rgb = readonly [number, number, number];
type PdfBlock<Kind extends ClientReportPdfBlock["kind"]> = Extract<ClientReportPdfBlock, { kind: Kind }>;
type LoadedPreviewImage = { data: Uint8Array; format: "JPEG" | "PNG" };

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
  info: [86, 165, 255] as Rgb,
  chartCyan: [72, 190, 214] as Rgb,
  chartSteel: [116, 138, 169] as Rgb,
  chartLight: [174, 198, 228] as Rgb,
} as const;

let fontPromise: Promise<ClientReportPdfFontData> | null = null;

async function loadClientReportPdfFonts(): Promise<ClientReportPdfFontData> {
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
  const fontData = fonts || await loadClientReportPdfFonts();
  const previewImages = await loadClientReportPreviewImages(model);
  const layout = await buildClientReportPdfLayout(model, fontData);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  registerClientReportPdfFonts(doc, fontData);
  const renderTypesetter = createClientReportTypesetter(doc);
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
    page.blocks.forEach((block) => drawBlock(doc, model, block, renderTypesetter, previewImages));
  });

  return {
    filename: `${slugify(model.accountName)}-meta-ads-report-${model.dateRange.since}-to-${model.dateRange.until}.pdf`,
    blob: doc.output("blob"),
  };
}

function drawBlock(
  doc: jsPDF,
  model: ClientReportViewModel,
  block: ClientReportPdfBlock,
  typesetter: ClientReportTypesetter,
  previewImages: ReadonlyMap<string, LoadedPreviewImage>,
) {
  switch (block.kind) {
    case "cover":
      drawCover(doc, model, block, typesetter);
      return;
    case "header":
      drawHeader(doc, model, block);
      return;
    case "footer":
      drawFooter(doc, model, block);
      return;
    case "section-title":
      drawSectionTitle(doc, block, typesetter);
      return;
    case "subsection":
      drawSubsection(doc, block);
      return;
    case "provenance":
      drawProvenance(doc, block, typesetter);
      return;
    case "metric-grid":
      drawMetricGrid(doc, block, typesetter);
      return;
    case "health-strip":
      drawHealthStrip(doc, model, block, typesetter);
      return;
    case "narrative":
      drawNarrative(doc, block);
      return;
    case "signal-list":
      drawSignalList(doc, block, typesetter);
      return;
    case "trend-chart":
      drawTrendChart(doc, model, block);
      return;
    case "ranking-list":
      drawRankingList(doc, model, block, typesetter);
      return;
    case "action-row":
      drawActionRow(doc, model, block, typesetter);
      return;
    case "custom-chart":
      drawCustomChart(doc, model, block, typesetter);
      return;
    case "breakdown-list":
      drawBreakdownList(doc, model, block);
      return;
    case "table-header":
      drawTableHeader(doc, block, typesetter);
      return;
    case "table-row":
      drawTableRow(doc, block, typesetter);
      return;
    case "diagnostic-row":
      drawDiagnosticRow(doc, model, block, typesetter);
      return;
    case "creative-row":
      drawCreativeRow(doc, model, block, typesetter, previewImages.get(block.creative.id));
      return;
    case "note":
      drawNote(doc, block, typesetter);
  }
}

function drawCover(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"cover">, typesetter: ClientReportTypesetter) {
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
  drawLines(doc, typesetter.wrap(model.copy.title, block.width - 30, 34, "semibold").slice(0, 3), block.x, block.y + 126, 38);
  setFont(doc, "normal", 11);
  textColor(doc, colors.muted);
  drawLines(doc, typesetter.wrap(model.copy.subtitle, block.width - 46, 11).slice(0, 4), block.x, block.y + 224, 16);

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
  doc.text(t.primaryResult.toUpperCase(), block.x + 24, panelY + 28);
  setFont(doc, "semibold", 17);
  textColor(doc, colors.foreground);
  doc.text(safeText(`${model.primaryResultLabel} / ${model.primaryCostLabel}`), block.x + 24, panelY + 61, { maxWidth: block.width - 48 });
  setFont(doc, "normal", 10.5);
  textColor(doc, colors.muted);
  drawLines(doc, typesetter.wrap(model.primaryResultExplanation, block.width - 48, 10.5).slice(0, 5), block.x + 24, panelY + 91, 15);

  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height - 72, block.x + block.width, block.y + block.height - 72);
  const metadata = [
    [t.selectedPack, model.selectedPackLabel],
    [t.verdictConfidence, model.verdictConfidenceLabel],
    [t.dataPulled, model.pulledLabel],
    [t.generated, model.generatedLabel],
  ];
  metadata.forEach(([label, value], index) => {
    const x = block.x + index * (block.width / 4);
    setFont(doc, "semibold", 7.25);
    textColor(doc, colors.muted);
    doc.text(label.toUpperCase(), x, block.y + block.height - 46);
    setFont(doc, "normal", 8.5);
    textColor(doc, colors.foreground);
    doc.text(safeText(value), x, block.y + block.height - 25, { maxWidth: block.width / 4 - 18 });
  });
}

function drawHeader(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"header">) {
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

function drawFooter(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"footer">) {
  const t = reportCopy[model.language];
  drawColor(doc, colors.border);
  doc.line(block.x, block.y, block.x + block.width, block.y);
  setFont(doc, "normal", 7.5);
  textColor(doc, colors.muted);
  doc.text(safeText(model.accountName), block.x, block.y + 15, { maxWidth: 190 });
  doc.text(safeText(model.copy.source), block.x + block.width / 2, block.y + 15, { align: "center" });
  doc.text(`${t.page} ${block.pageNumber}`, block.x + block.width, block.y + 15, { align: "right" });
}

function drawSectionTitle(doc: jsPDF, block: PdfBlock<"section-title">, typesetter: ClientReportTypesetter) {
  const titleLines = typesetter.wrap(block.title || block.section, block.width - 36, 24, "semibold");
  fill(doc, colors.primary);
  doc.roundedRect(block.x, block.y + 2, 4, Math.max(42, titleLines.length * 30), 2, 2, "F");
  setFont(doc, "semibold", 24);
  textColor(doc, colors.foreground);
  drawLines(doc, titleLines, block.x + 20, block.y + 26, 30);
  setFont(doc, "normal", 9.5);
  textColor(doc, colors.muted);
  drawLines(doc, typesetter.wrap(block.text || "", block.width - 36, 9.5), block.x + 20, block.y + 22 + titleLines.length * 30, 13);
}

function drawSubsection(doc: jsPDF, block: PdfBlock<"subsection">) {
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height - 8, block.x + block.width, block.y + block.height - 8);
  setFont(doc, "semibold", 14);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.title || ""), block.x, block.y + 22, { maxWidth: block.width });
}

function drawProvenance(doc: jsPDF, block: PdfBlock<"provenance">, typesetter: ClientReportTypesetter) {
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
    drawLines(doc, typesetter.wrap(item.value, columnWidth - 28, 9, "semibold"), x + 14, block.y + 44, 12);
  });
}

function drawMetricGrid(doc: jsPDF, block: PdfBlock<"metric-grid">, typesetter: ClientReportTypesetter) {
  const kpis = block.kpis || [];
  const columns = clientReportMetricGridColumns(kpis.length);
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
    const value = safeText(kpi.value);
    const valueFontSize = fitTextSize(doc, value, cellWidth - 30, 19, 11, "semibold");
    setFont(doc, "semibold", valueFontSize);
    doc.text(value, x, y + 51);
    if (kpi.delta) {
      setFont(doc, "normal", 7.5);
      textColor(doc, kpi.movement === "good" ? colors.success : kpi.movement === "bad" ? colors.destructive : colors.muted);
      const deltaLines = typesetter.wrap(kpi.delta, cellWidth - 30, 7.5).slice(0, 2);
      drawLines(doc, deltaLines, x, y + 70, 9);
    }
  });
}

function drawHealthStrip(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"health-strip">, typesetter: ClientReportTypesetter) {
  surface(doc, block.x, block.y, block.width, block.height, colors.raised);
  setFont(doc, "semibold", 7.5);
  textColor(doc, colors.muted);
  doc.text(safeText(block.title || "").toUpperCase(), block.x + 18, block.y + 24);
  setFont(doc, "semibold", 29);
  textColor(doc, colors.foreground);
  doc.text(safeText(model.healthLabel), block.x + 18, block.y + 53);
  drawStatus(doc, block.label || model.healthStatusLabel, block.x + 18, block.y + 66, block.tone || "neutral");
  drawColor(doc, colors.border);
  doc.line(block.x + 210, block.y + 16, block.x + 210, block.y + block.height - 16);
  setFont(doc, "normal", 9.5);
  textColor(doc, colors.foreground);
  drawLines(doc, typesetter.wrap(block.text || "", block.width - 248, 9.5), block.x + 230, block.y + 30, 13);
}

function drawNarrative(doc: jsPDF, block: PdfBlock<"narrative">) {
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

function drawSignalList(doc: jsPDF, block: PdfBlock<"signal-list">, typesetter: ClientReportTypesetter) {
  const tone = block.tone || "neutral";
  const accent = toneColor(tone);
  drawColor(doc, colors.border);
  doc.line(block.x, block.y, block.x + block.width, block.y);
  setFont(doc, "semibold", 10.5);
  textColor(doc, accent);
  doc.text(safeText(block.title || ""), block.x, block.y + 24, { maxWidth: block.width });
  let y = block.y + 46;
  (block.items || []).forEach((item, index) => {
    const lines = typesetter.wrap(item, block.width - 34, 8.8);
    setFont(doc, "semibold", 7.25);
    textColor(doc, colors.muted);
    doc.text(String(index + 1).padStart(2, "0"), block.x, y + 2);
    setFont(doc, "normal", 8.8);
    textColor(doc, colors.foreground);
    drawLines(doc, lines, block.x + 28, y + 2, 12);
    y += lines.length * 12 + 10;
  });
}

function drawTrendChart(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"trend-chart">) {
  const t = reportCopy[model.language];
  const rows = block.trend || [];
  const maxSpend = Math.max(0, ...rows.map((row) => row.spend));
  const maxPrimary = Math.max(0, ...rows.map((row) => row.primary));
  const maxEfficiency = Math.max(0, ...rows.map((row) => row.efficiency));
  const efficiencyFormat = model.selectedPack === "sales_roas" ? "ratio" : "currency";
  const legendValues = [
    `${t.maximum}: ${formatClientReportCompactMetric(maxSpend, "currency", model.currency, model.language)}`,
    `${t.maximum}: ${formatClientReportCompactMetric(maxPrimary, "number", model.currency, model.language)}`,
    `${t.latest}: ${formatClientReportCompactMetric(rows.at(-1)?.efficiency || 0, efficiencyFormat, model.currency, model.language)}`,
  ];
  surface(doc, block.x, block.y, block.width, block.height, colors.surface);
  setFont(doc, "semibold", 12);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.title || ""), block.x + 18, block.y + 26);

  const legendX = block.x + 18;
  const legendY = block.y + 45;
  const legendWidth = (block.width - 36) / 3;
  (block.legend || []).forEach((item, index) => {
    const x = legendX + index * legendWidth;
    const sampleY = legendY + 4;
    if (item.kind === "bar") {
      fill(doc, colors.chartSteel);
      doc.roundedRect(x, sampleY - 6, 12, 10, 2, 2, "F");
    } else {
      drawColor(doc, item.kind === "line" ? colors.chartCyan : colors.chartLight);
      doc.setLineWidth(item.kind === "line" ? 1.8 : 1.3);
      if (item.kind === "dashed") doc.setLineDashPattern([3, 2], 0);
      doc.line(x, sampleY - 1, x + 13, sampleY - 1);
      doc.setLineDashPattern([], 0);
      doc.setLineWidth(0.75);
    }
    setFont(doc, "semibold", 7.4);
    textColor(doc, colors.foreground);
    doc.text(safeText(item.label), x + 19, legendY + 3, { maxWidth: legendWidth - 23 });
    setFont(doc, "normal", 6.8);
    textColor(doc, colors.muted);
    doc.text(safeText(legendValues[index] || ""), x + 19, legendY + 15, { maxWidth: legendWidth - 23 });
  });

  setFont(doc, "normal", 7.2);
  textColor(doc, colors.muted);
  doc.text(safeText(block.text || ""), block.x + 18, block.y + 82, { maxWidth: block.width - 36 });

  const chartX = block.x + 28;
  const chartY = block.y + 98;
  const chartWidth = block.width - 56;
  const chartHeight = block.height - 137;
  const spendScale = Math.max(1, maxSpend);
  const primaryScale = Math.max(1, maxPrimary);
  const efficiencyScale = Math.max(1, maxEfficiency);
  drawColor(doc, colors.border);
  [0, 1, 2, 3].forEach((step) => {
    const y = chartY + (step * chartHeight) / 3;
    doc.line(chartX, y, chartX + chartWidth, y);
  });
  setFont(doc, "normal", 6.5);
  textColor(doc, colors.muted);
  doc.text(safeText(t.maximum).toUpperCase(), chartX - 5, chartY + 2, { align: "right" });
  doc.text("0", chartX - 5, chartY + chartHeight + 2, { align: "right" });

  if (rows.length) {
    const slot = chartWidth / rows.length;
    rows.forEach((row, index) => {
      const barHeight = Math.max(2, (row.spend / spendScale) * chartHeight);
      fill(doc, index === rows.length - 1 ? colors.chartLight : colors.chartSteel);
      doc.roundedRect(chartX + index * slot + 2, chartY + chartHeight - barHeight, Math.max(2, slot - 5), barHeight, 2, 2, "F");
    });

    drawColor(doc, colors.chartCyan);
    doc.setLineWidth(2);
    rows.forEach((row, index) => {
      if (!index) return;
      const previous = rows[index - 1];
      const x1 = chartX + (index - 1) * slot + slot / 2;
      const y1 = chartY + chartHeight - (previous.primary / primaryScale) * chartHeight;
      const x2 = chartX + index * slot + slot / 2;
      const y2 = chartY + chartHeight - (row.primary / primaryScale) * chartHeight;
      doc.line(x1, y1, x2, y2);
    });
    doc.setLineWidth(0.75);
    fill(doc, colors.chartCyan);
    rows.forEach((row, index) => {
      doc.circle(chartX + index * slot + slot / 2, chartY + chartHeight - (row.primary / primaryScale) * chartHeight, index === rows.length - 1 ? 3 : 1.7, "F");
    });

    drawColor(doc, colors.chartLight);
    doc.setLineDashPattern([3, 2], 0);
    doc.setLineWidth(1.4);
    rows.forEach((row, index) => {
      if (!index) return;
      const previous = rows[index - 1];
      doc.line(
        chartX + (index - 1) * slot + slot / 2,
        chartY + chartHeight - (previous.efficiency / efficiencyScale) * chartHeight,
        chartX + index * slot + slot / 2,
        chartY + chartHeight - (row.efficiency / efficiencyScale) * chartHeight,
      );
    });
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(0.75);
    const last = rows[rows.length - 1];
    fill(doc, colors.chartLight);
    doc.circle(chartX + (rows.length - 1) * slot + slot / 2, chartY + chartHeight - (last.efficiency / efficiencyScale) * chartHeight, 2.4, "F");

    setFont(doc, "normal", 7);
    textColor(doc, colors.muted);
    const labelIndexes = Array.from(new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]));
    labelIndexes.forEach((index) => {
      const row = rows[index];
      doc.text(safeText(row.label), chartX + index * slot + slot / 2, chartY + chartHeight + 17, { align: "center" });
    });
  }
}

function drawRankingList(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"ranking-list">, typesetter: ClientReportTypesetter) {
  const rows = block.drivers || [];
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
    drawLines(doc, typesetter.wrap(row.name, block.width - 82, 8.3).slice(0, 2), block.x + 43, y + 2, 11);
    setFont(doc, "semibold", 8.1);
    textColor(doc, index === 0 ? colors.primary : colors.muted);
    doc.text(safeText(row.primaryLabel), block.x + block.width - 16, y + 2, { align: "right", maxWidth: 58 });
    setFont(doc, "normal", 7.2);
    textColor(doc, colors.muted);
    doc.text(`${row.primaryShare.toFixed(0)}% ${model.primaryResultLabel}`, block.x + 43, y + 29, { maxWidth: block.width - 110 });
    doc.text(`${row.efficiencyLabel} ${safeText(row.efficiencyValue)}`, block.x + block.width - 16, y + 29, { align: "right", maxWidth: 100 });
    y += 62;
  });
}

function drawCustomChart(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"custom-chart">, typesetter: ClientReportTypesetter) {
  const chart = block.customChart;
  if (!chart) return;
  const t = reportCopy[model.language];
  surface(doc, block.x, block.y, block.width, block.height, colors.surface);
  setFont(doc, "semibold", 12);
  textColor(doc, colors.foreground);
  doc.text(safeText(chart.title), block.x + 18, block.y + 26, { maxWidth: block.width - 36 });

  let headerY = block.y + 48;
  if (chart.referenceNote) {
    setFont(doc, "normal", 7.6);
    textColor(doc, colors.warning);
    const noteLines = typesetter.wrap(chart.referenceNote, block.width - 36, 7.6).slice(0, 2);
    drawLines(doc, noteLines, block.x + 18, headerY, 10.5);
    headerY += noteLines.length * 10.5 + 10;
  }

  const palette = [colors.primary, colors.info, colors.chartCyan, colors.chartSteel, colors.chartLight] as const;
  let legendX = block.x + 18;
  chart.series.forEach((series, index) => {
    fill(doc, palette[index % palette.length]);
    doc.circle(legendX + 3, headerY - 3, 3, "F");
    setFont(doc, "normal", 7.2);
    textColor(doc, colors.muted);
    const label = `${series.label} — ${series.axis === "left" ? t.leftAxis : t.rightAxis}`;
    doc.text(safeText(label), legendX + 10, headerY);
    legendX += Math.min(170, 22 + label.length * 4.1);
  });

  const chartX = block.x + 58;
  const chartY = headerY + 18;
  const chartWidth = block.width - 116;
  const chartHeight = block.y + block.height - chartY - 36;
  drawColor(doc, colors.border);
  [0, 1, 2, 3].forEach((step) => doc.line(chartX, chartY + (step * chartHeight) / 3, chartX + chartWidth, chartY + (step * chartHeight) / 3));
  if (!chart.data.length) {
    setFont(doc, "normal", 9);
    textColor(doc, colors.muted);
    doc.text(model.language === "vi" ? "Chưa có dữ liệu theo ngày." : "No daily chart data available.", chartX + chartWidth / 2, chartY + chartHeight / 2, { align: "center" });
    return;
  }

  const maxima = { left: 1, right: 1 };
  chart.series.forEach((series) => {
    const values = chart.data
      .map((point) => point[series.key])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    maxima[series.axis] = Math.max(maxima[series.axis], ...values);
  });
  const leftSeries = chart.series.find((series) => series.axis === "left");
  const rightSeries = chart.series.find((series) => series.axis === "right");
  drawAxisScale(doc, model, chartX, chartY, chartHeight, maxima.left, leftSeries?.format || "number", "left");
  if (rightSeries) {
    drawAxisScale(doc, model, chartX + chartWidth, chartY, chartHeight, maxima.right, rightSeries.format, "right");
  }
  const slot = chartWidth / chart.data.length;
  chart.series.forEach((series, seriesIndex) => {
    const color = palette[seriesIndex % palette.length];
    const points = chart.data.map((point, index) => {
      const rawValue = point[series.key];
      const value = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : null;
      return {
        x: chartX + index * slot + slot / 2,
        y: value === null ? null : chartY + chartHeight - (value / maxima[series.axis]) * chartHeight,
        value,
      };
    });
    const drawBars = chart.type === "bar" || (chart.type === "composed" && seriesIndex === 0);
    if (drawBars) {
      points.forEach((point) => {
        if (point.value === null || point.value <= 0) return;
        const height = (point.value / maxima[series.axis]) * chartHeight;
        fill(doc, color);
        doc.roundedRect(point.x - Math.max(2, slot / (chart.series.length + 2)) / 2 + seriesIndex * 2, chartY + chartHeight - height, Math.max(2, slot / (chart.series.length + 2)), height, 1, 1, "F");
      });
    } else {
      drawColor(doc, color);
      doc.setLineWidth(1.7);
      let previousPoint: { x: number; y: number } | null = null;
      points.forEach((point) => {
        if (point.y === null) {
          previousPoint = null;
          return;
        }
        if (previousPoint) doc.line(previousPoint.x, previousPoint.y, point.x, point.y);
        previousPoint = { x: point.x, y: point.y };
      });
      doc.setLineWidth(0.75);
    }
  });
  setFont(doc, "normal", 7);
  textColor(doc, colors.muted);
  const labelIndexes = Array.from(new Set([0, Math.floor((chart.data.length - 1) / 2), chart.data.length - 1]));
  labelIndexes.forEach((index) => doc.text(safeText(String(chart.data[index].x || "")), chartX + index * slot + slot / 2, chartY + chartHeight + 17, { align: "center" }));
}

function drawAxisScale(
  doc: jsPDF,
  model: ClientReportViewModel,
  x: number,
  y: number,
  height: number,
  maximum: number,
  format: ClientReportViewModel["customCharts"][number]["series"][number]["format"],
  side: "left" | "right",
) {
  setFont(doc, "normal", 6.4);
  textColor(doc, colors.muted);
  const align = side === "left" ? "right" : "left";
  const labelX = x + (side === "left" ? -8 : 8);
  [maximum, maximum / 2, 0].forEach((value, index) => {
    doc.text(formatAxisValue(value, format, model.currency, model.language), labelX, y + (index * height) / 2 + 2, { align });
  });
}

function formatAxisValue(
  value: number,
  format: ClientReportViewModel["customCharts"][number]["series"][number]["format"],
  currency: string,
  language: ClientReportViewModel["language"],
) {
  if (format !== "currency" && format !== "number") {
    return formatClientReportMetric(value, format, currency, language);
  }
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const absolute = Math.abs(value);
  const compact = absolute >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })}m`
    : absolute >= 1_000
      ? `${(value / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })}k`
      : value.toLocaleString(locale, { maximumFractionDigits: 0 });
  return format === "currency" ? `${compact} ${currency}` : compact;
}

function drawActionRow(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"action-row">, typesetter: ClientReportTypesetter) {
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
  const titleLines = typesetter.wrap(block.action.title, block.width - 92, 11.5, "semibold");
  drawLines(doc, titleLines, block.x + 70, block.y + 25, 15);
  const bodyX = block.x + 70;
  const bodyWidth = block.width - 92;
  let bodyY = block.y + 34 + titleLines.length * 15;
  setFont(doc, "semibold", 7.1);
  textColor(doc, colors.muted);
  doc.text(reportCopy[model.language].why.toUpperCase(), bodyX, bodyY);
  bodyY += 12;
  setFont(doc, "normal", 8.5);
  textColor(doc, colors.foreground);
  const whyLines = typesetter.wrap(block.action.why, bodyWidth, 8.5);
  drawLines(doc, whyLines, bodyX, bodyY, 11.5);
  bodyY += whyLines.length * 11.5 + 10;
  setFont(doc, "semibold", 7.1);
  textColor(doc, colors.muted);
  doc.text(reportCopy[model.language].monitor.toUpperCase(), bodyX, bodyY);
  bodyY += 12;
  setFont(doc, "normal", 8.5);
  textColor(doc, colors.foreground);
  drawLines(doc, typesetter.wrap(block.action.monitor, bodyWidth, 8.5), bodyX, bodyY, 11.5);
}

function drawBreakdownList(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"breakdown-list">) {
  const rows = block.rows || [];
  const maxSpend = Math.max(1, ...rows.map((row) => row.spend));
  const compact = block.width < 220;
  surface(doc, block.x, block.y, block.width, block.height, colors.surface);
  setFont(doc, "semibold", 11);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.title || ""), block.x + 16, block.y + 25);
  let y = block.y + 52;
  rows.forEach((row, index) => {
    const barWidth = Math.max(3, ((block.width - 32) * row.spend) / maxSpend);
    setFont(doc, "normal", 8.2);
    textColor(doc, colors.foreground);
    doc.text(safeText(row.name), block.x + 16, y, { maxWidth: compact ? block.width - 32 : block.width - 168 });
    setFont(doc, "semibold", 7.8);
    textColor(doc, colors.muted);
    if (compact) {
      doc.text(safeText(`${row.spendLabel} · ${row.spendShareLabel}`), block.x + 16, y + 13, { maxWidth: block.width - 32 });
    } else {
      doc.text(safeText(`${row.spendLabel} · ${row.spendShareLabel}`), block.x + block.width - 16, y, { align: "right", maxWidth: 142 });
    }
    fill(doc, index === 0 ? colors.primary : colors.border);
    doc.roundedRect(block.x + 16, y + (compact ? 23 : 10), barWidth, 4, 2, 2, "F");
    y += compact ? 40 : 32;
  });
}

function drawTableHeader(doc: jsPDF, block: PdfBlock<"table-header">, typesetter: ClientReportTypesetter) {
  if (!block.table) return;
  fill(doc, colors.raised);
  doc.roundedRect(block.x, block.y, block.width, block.height, 7, 7, "F");
  const columns = tableColumns(block, block.table);
  setFont(doc, "semibold", 7.1);
  textColor(doc, colors.muted);
  columns.forEach((column) => {
    const lines = typesetter.wrap(column.label.toUpperCase(), column.width - 8, 7.1, "semibold").slice(0, 2);
    lines.forEach((line, index) => {
      doc.text(safeText(line), column.align === "left" ? column.x : column.x + column.width, block.y + 17 + index * 8.5, { align: column.align });
    });
  });
}

function drawTableRow(doc: jsPDF, block: PdfBlock<"table-row">, typesetter: ClientReportTypesetter) {
  if (!block.row || !block.table) return;
  const columns = tableColumns(block, block.table);
  drawColor(doc, colors.border);
  doc.line(block.x + 14, block.y + block.height, block.x + block.width - 14, block.y + block.height);
  setFont(doc, "normal", 8.1);
  columns.forEach((column) => {
    textColor(doc, column.align === "left" ? colors.foreground : colors.muted);
    const value = block.row?.cells[column.key] || "";
    if (column.align === "left") {
      drawLines(doc, typesetter.wrap(value, column.width - 8, 8.1), column.x, block.y + 19, 11);
    } else {
      doc.text(safeText(value), column.x + column.width, block.y + 19, { align: "right", maxWidth: column.width - 6 });
    }
  });
}

function drawDiagnosticRow(doc: jsPDF, model: ClientReportViewModel, block: PdfBlock<"diagnostic-row">, typesetter: ClientReportTypesetter) {
  if (!block.diagnostic) return;
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height, block.x + block.width, block.y + block.height);
  drawStatus(doc, diagnosticLabel(block.diagnostic.severity, model.language), block.x, block.y + 16, block.tone || "neutral");
  setFont(doc, "semibold", 10.5);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.diagnostic.title), block.x + 92, block.y + 29, { maxWidth: block.width - 108 });
  setFont(doc, "normal", 8.5);
  textColor(doc, colors.muted);
  const summaryLines = typesetter.wrap(block.diagnostic.summary, block.width - 108, 8.5);
  drawLines(doc, summaryLines, block.x + 92, block.y + 50, 11.5);
  const evidenceY = block.y + 57 + summaryLines.length * 11.5;
  setFont(doc, "normal", 7.8);
  textColor(doc, colors.foreground);
  const evidenceLines = block.diagnostic.evidence.flatMap((line) => typesetter.wrap(`- ${line}`, block.width - 108, 7.8));
  drawLines(doc, evidenceLines, block.x + 92, evidenceY, 10.5);
  setFont(doc, "semibold", 7.8);
  textColor(doc, block.tone === "bad" ? colors.destructive : block.tone === "warning" ? colors.warning : colors.primary);
  const nextStepY = evidenceY + Math.max(1, evidenceLines.length) * 10.5 + 10;
  drawLines(doc, typesetter.wrap(`${model.language === "vi" ? "Bước tiếp theo" : "Next step"}: ${block.diagnostic.nextStep}`, block.width - 108, 7.8, "semibold"), block.x + 92, nextStepY, 10.5);
}

function drawCreativeRow(
  doc: jsPDF,
  model: ClientReportViewModel,
  block: PdfBlock<"creative-row">,
  typesetter: ClientReportTypesetter,
  previewImage?: LoadedPreviewImage,
) {
  if (!block.creative) return;
  const t = reportCopy[model.language];
  const imageX = block.x;
  const imageY = block.y + 12;
  const imageWidth = 136;
  const imageHeight = block.height - 28;
  fill(doc, colors.raised);
  drawColor(doc, colors.border);
  doc.roundedRect(imageX, imageY, imageWidth, imageHeight, 7, 7, "FD");
  const imageDrawn = previewImage
    ? drawContainedImage(doc, previewImage, imageX + 3, imageY + 3, imageWidth - 6, imageHeight - 6)
    : false;
  if (!imageDrawn) {
    setFont(doc, "semibold", 7.2);
    textColor(doc, colors.muted);
    doc.text(safeText(t.previewUnavailable), imageX + imageWidth / 2, imageY + imageHeight / 2, {
      align: "center",
      maxWidth: imageWidth - 22,
    });
  }
  doc.link(imageX, imageY, imageWidth, imageHeight, { url: block.creative.previewUrl });

  const textX = block.x + 156;
  const textWidth = block.width - 156;
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + block.height, block.x + block.width, block.y + block.height);
  drawStatus(doc, block.creative.status || "UNKNOWN", textX, block.y + 12, "neutral");
  setFont(doc, "semibold", 10.5);
  textColor(doc, colors.foreground);
  doc.text(safeText(block.creative.name), textX, block.y + 48, { maxWidth: textWidth });
  setFont(doc, "normal", 8.3);
  textColor(doc, colors.muted);
  drawLines(doc, typesetter.wrap(block.creative.summary, textWidth, 8.3).slice(0, 3), textX, block.y + 68, 11);
  setFont(doc, "semibold", 8.3);
  textColor(doc, colors.primary);
  doc.textWithLink(safeText(`${t.openInMeta} ->`), textX, block.y + block.height - 20, { url: block.creative.previewUrl });
}

function drawNote(doc: jsPDF, block: PdfBlock<"note">, typesetter: ClientReportTypesetter) {
  drawColor(doc, colors.border);
  doc.line(block.x, block.y + 2, block.x + block.width, block.y + 2);
  setFont(doc, "normal", 7.8);
  textColor(doc, colors.muted);
  drawLines(doc, typesetter.wrap(block.text || "", block.width - 10, 7.8), block.x, block.y + 20, 10.5);
}

async function loadClientReportPreviewImages(model: ClientReportViewModel) {
  const entries = await Promise.all(
    model.creativeDetails.map(async (creative) => {
      if (!creative.previewImageUrl) return null;
      try {
        const image = await loadPreviewImage(creative.previewImageUrl);
        return image ? ([creative.id, image] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  return new Map(entries.filter((entry): entry is readonly [string, LoadedPreviewImage] => Boolean(entry)));
}

async function loadPreviewImage(source: string): Promise<LoadedPreviewImage | null> {
  if (source.startsWith("data:image/")) return decodeDataImage(source);
  const response = await fetch(`/api/meta/ad-preview-image?url=${encodeURIComponent(source)}`);
  if (!response.ok) return null;
  const format = supportedPdfImageFormat(response.headers.get("content-type") || "");
  if (!format) return null;
  return { data: new Uint8Array(await response.arrayBuffer()), format };
}

function decodeDataImage(source: string): LoadedPreviewImage | null {
  const match = /^data:(image\/(?:jpeg|jpg|png));base64,([a-z0-9+/=]+)$/i.exec(source);
  if (!match) return null;
  const format = supportedPdfImageFormat(match[1]);
  if (!format) return null;
  const binary = atob(match[2]);
  return { data: Uint8Array.from(binary, (character) => character.charCodeAt(0)), format };
}

function drawContainedImage(doc: jsPDF, image: LoadedPreviewImage, x: number, y: number, width: number, height: number) {
  try {
    const properties = doc.getImageProperties(image.data);
    const scale = Math.min(width / properties.width, height / properties.height);
    const renderedWidth = properties.width * scale;
    const renderedHeight = properties.height * scale;
    doc.addImage(
      image.data,
      image.format,
      x + (width - renderedWidth) / 2,
      y + (height - renderedHeight) / 2,
      renderedWidth,
      renderedHeight,
      undefined,
      "FAST",
    );
    return true;
  } catch {
    return false;
  }
}

function fitTextSize(
  doc: jsPDF,
  value: string,
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
  weight: "normal" | "semibold",
) {
  let size = preferredSize;
  while (size > minimumSize) {
    setFont(doc, weight, size);
    if (doc.getTextWidth(value) <= maxWidth) return size;
    size -= 0.5;
  }
  return minimumSize;
}

function tableColumns(block: Pick<ClientReportPdfBlock, "x" | "width">, table: PdfBlock<"table-header">["table"]) {
  const innerX = block.x + 14;
  const innerWidth = block.width - 28;
  const totalWeight = table.columns.reduce((sum, column) => sum + column.weight, 0);
  let x = innerX;
  return table.columns.map((column) => {
    const width = (innerWidth * column.weight) / totalWeight;
    const positioned = { ...column, x, width };
    x += width;
    return positioned;
  });
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

function healthTone(status: ClientReportViewModel["healthStatus"]): ReportTone {
  if (status === "healthy") return "good";
  if (status === "warning") return "warning";
  return "bad";
}

function diagnosticLabel(status: ClientReportViewModel["diagnostics"][number]["severity"], language: ClientReportViewModel["language"]) {
  if (language === "vi") {
    if (status === "ok") return "Ổn";
    if (status === "watch") return "Theo dõi";
    if (status === "risk") return "Rủi ro";
    return "Chưa đủ";
  }
  if (status === "ok") return "OK";
  if (status === "watch") return "Watch";
  if (status === "risk") return "Risk";
  return "Insufficient";
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
  return safePdfText(value);
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
