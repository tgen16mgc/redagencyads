import { jsPDF } from "jspdf";
import type {
  ClientReportAction,
  ClientReportBreakdownRow,
  ClientReportCustomChart,
  ClientReportDriver,
  ClientReportTable,
  ClientReportViewModel,
} from "@/lib/client-report";
import type { InterfaceLanguage } from "@/lib/types";

export type ReportTone = "neutral" | "primary" | "good" | "warning" | "bad";

export type ClientReportPdfFontData = {
  regular: string;
  semibold: string;
};

export const clientReportPdfCopy = {
  en: {
    coverLabel: "CLIENT PERFORMANCE REPORT",
    executiveDescription: "The current decision, account health, and highest-priority evidence.",
    performanceDescription: "Spend, results, and the rows that explain the outcome.",
    recommendationsDescription: "Reviewed actions for the next optimization cycle.",
    chartsDescription: "Saved reference views and spend distribution across the selected scope.",
    tablesDescription: "Detailed performance records for review and follow-up analysis.",
    diagnosticsDescription: "The checks behind the decision, followed by available ad details.",
    accountHealth: "Account health",
    decisionBrief: "Performance decision",
    evidenceSummary: "Evidence summary",
    dataSource: "Data source",
    decisionSource: "Decision source",
    generated: "Generated",
    dataPulled: "Data pulled",
    reportingPeriod: "Reporting period",
    whatWorked: "What is working",
    watchItems: "What needs attention",
    spendTrend: "Spend and primary-result trend",
    trendGuide: "Each series uses its own 0-to-maximum scale. Compare direction over time, not relative height.",
    maximum: "Max",
    latest: "Latest",
    spend: "Spend",
    primaryResult: "Primary result",
    efficiency: "Efficiency",
    selectedPack: "Selected KPI Pack",
    verdictConfidence: "Decision confidence",
    dailyDiagnosis: "Daily diagnosis",
    comparisonDrivers: "Period-over-period drivers",
    budgetEvidence: "Budget evidence",
    customCharts: "Saved Custom Charts",
    topCampaigns: "Campaign drivers",
    topAdsets: "Ad set drivers",
    priorityActions: "Priority actions",
    performanceRows: "Performance records",
    diagnostics: "Diagnostic checks",
    creativeDetail: "Creative detail",
    noCreativeDetail: "Creative previews were not available for this report.",
    openInMeta: "Open in Meta",
    previewUnavailable: "Preview image unavailable",
    why: "Why this matters",
    monitor: "What to monitor next",
    leftAxis: "Left axis",
    rightAxis: "Right axis",
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
    chartsDescription: "Biểu đồ tham khảo đã lưu và phân bổ chi tiêu trong phạm vi được chọn.",
    tablesDescription: "Bản ghi hiệu quả chi tiết để rà soát và phân tích tiếp.",
    diagnosticsDescription: "Các kiểm tra phía sau quyết định, kèm chi tiết quảng cáo hiện có.",
    accountHealth: "Sức khỏe tài khoản",
    decisionBrief: "Kết luận hiệu quả",
    evidenceSummary: "Tóm tắt bằng chứng",
    dataSource: "Nguồn dữ liệu",
    decisionSource: "Nguồn quyết định",
    generated: "Ngày tạo",
    dataPulled: "Kéo dữ liệu",
    reportingPeriod: "Kỳ báo cáo",
    whatWorked: "Điểm đang hiệu quả",
    watchItems: "Điểm cần theo dõi",
    spendTrend: "Xu hướng chi tiêu và kết quả chính",
    trendGuide: "Mỗi chuỗi dùng thang 0 đến mức cao nhất riêng. Hãy so sánh xu hướng theo thời gian, không so chiều cao giữa các chuỗi.",
    maximum: "Cao nhất",
    latest: "Mới nhất",
    spend: "Chi tiêu",
    primaryResult: "Kết quả chính",
    efficiency: "Hiệu quả",
    selectedPack: "Gói KPI đã chọn",
    verdictConfidence: "Độ tin cậy quyết định",
    dailyDiagnosis: "Chẩn đoán theo ngày",
    comparisonDrivers: "Động lực giữa hai kỳ",
    budgetEvidence: "Bằng chứng ngân sách",
    customCharts: "Biểu đồ tùy chỉnh đã lưu",
    topCampaigns: "Động lực từ chiến dịch",
    topAdsets: "Động lực từ nhóm quảng cáo",
    priorityActions: "Hành động ưu tiên",
    performanceRows: "Bản ghi hiệu quả",
    diagnostics: "Kiểm tra chẩn đoán",
    creativeDetail: "Chi tiết quảng cáo",
    noCreativeDetail: "Báo cáo này không có bản xem trước mẫu quảng cáo.",
    openInMeta: "Mở trong Meta",
    previewUnavailable: "Không tải được ảnh xem trước",
    why: "Vì sao quan trọng",
    monitor: "Cần theo dõi tiếp",
    leftAxis: "Trục trái",
    rightAxis: "Trục phải",
    status: "Trạng thái",
    result: "Kết quả",
    cost: "Chi phí",
    continued: "tiếp theo",
    page: "Trang",
  },
} as const;

type ClientReportPdfBlockBase = {
  section: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClientReportPdfBlock =
  | (ClientReportPdfBlockBase & { kind: "cover" })
  | (ClientReportPdfBlockBase & { kind: "header"; title: string })
  | (ClientReportPdfBlockBase & { kind: "footer" })
  | (ClientReportPdfBlockBase & { kind: "section-title"; title: string; text: string })
  | (ClientReportPdfBlockBase & { kind: "subsection"; title: string })
  | (ClientReportPdfBlockBase & { kind: "provenance"; meta: Array<{ label: string; value: string }> })
  | (ClientReportPdfBlockBase & { kind: "metric-grid"; kpis: ClientReportViewModel["kpis"] })
  | (ClientReportPdfBlockBase & { kind: "health-strip"; title: string; text: string; label: string; tone: ReportTone })
  | (ClientReportPdfBlockBase & { kind: "narrative"; title: string; text: string })
  | (ClientReportPdfBlockBase & { kind: "signal-list"; title: string; items: string[]; tone: ReportTone })
  | (ClientReportPdfBlockBase & {
      kind: "trend-chart";
      title: string;
      text: string;
      legend: Array<{ kind: "bar" | "line" | "dashed"; label: string }>;
      trend: ClientReportViewModel["dailyTrend"];
    })
  | (ClientReportPdfBlockBase & { kind: "ranking-list"; title: string; drivers: ClientReportDriver[] })
  | (ClientReportPdfBlockBase & { kind: "action-row"; action: ClientReportAction; index: number })
  | (ClientReportPdfBlockBase & { kind: "custom-chart"; title: string; customChart: ClientReportCustomChart })
  | (ClientReportPdfBlockBase & { kind: "breakdown-list"; title: string; rows: ClientReportBreakdownRow[] })
  | (ClientReportPdfBlockBase & { kind: "table-header"; title: string; table: ClientReportTable })
  | (ClientReportPdfBlockBase & { kind: "table-row"; table: ClientReportTable; row: ClientReportTable["rows"][number] })
  | (ClientReportPdfBlockBase & { kind: "diagnostic-row"; diagnostic: ClientReportViewModel["diagnostics"][number]; tone: ReportTone })
  | (ClientReportPdfBlockBase & { kind: "creative-row"; creative: ClientReportViewModel["creativeDetails"][number] })
  | (ClientReportPdfBlockBase & { kind: "note"; text: string });

type ClientReportPdfBlockInput = ClientReportPdfBlock extends infer Block
  ? Block extends ClientReportPdfBlock
    ? Omit<Block, "pageNumber">
    : never
  : never;

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

export type ClientReportTypesetter = {
  wrap: (value: string, width: number, fontSize: number, weight?: "normal" | "semibold") => string[];
  height: (value: string, width: number, fontSize: number, lineHeight?: number, weight?: "normal" | "semibold") => number;
};

const clientReportPage = {
  width: 595.28,
  height: 841.89,
  margin: { top: 34, right: 42, bottom: 34, left: 42 },
  contentTop: 80,
  footerReserve: 42,
  gap: 12,
} as const;

export function createClientReportTypesetter(doc: jsPDF): ClientReportTypesetter {
  const wrap = (value: string, width: number, fontSize: number, weight: "normal" | "semibold" = "normal") => {
    doc.setFont("Geist", weight);
    doc.setFontSize(fontSize);
    return safePdfText(value).split("\n").flatMap((paragraph) => {
      if (!paragraph.trim()) return [""];
      const lines = doc.splitTextToSize(paragraph, width);
      return Array.isArray(lines) ? lines.map(String) : [String(lines)];
    });
  };
  return {
    wrap,
    height: (value, width, fontSize, lineHeight = fontSize + 3, weight = "normal") =>
      wrap(value, width, fontSize, weight).length * lineHeight,
  };
}

class ClientReportLayoutComposer {
  readonly layout: ClientReportPdfLayout;
  cursor = clientReportPage.contentTop;
  private page: ClientReportPdfPage | null = null;

  constructor(private readonly typesetter: ClientReportTypesetter) {
    this.layout = {
      width: clientReportPage.width,
      height: clientReportPage.height,
      margin: clientReportPage.margin,
      pages: [],
    };
  }

  addBlock(block: ClientReportPdfBlockInput) {
    if (!this.page) throw new Error("A PDF page must be started before adding blocks.");
    this.page.blocks.push({ ...block, pageNumber: this.page.pageNumber } as ClientReportPdfBlock);
  }

  addCover() {
    this.page = { pageNumber: 1, section: "Cover", blocks: [] };
    this.layout.pages.push(this.page);
    this.addBlock({
      kind: "cover",
      section: "Cover",
      x: clientReportPage.margin.left,
      y: clientReportPage.margin.top,
      width: this.contentWidth,
      height: clientReportPage.height - clientReportPage.margin.top - clientReportPage.margin.bottom,
    });
  }

  addContentPage(section: string) {
    this.page = { pageNumber: this.layout.pages.length + 1, section, blocks: [] };
    this.layout.pages.push(this.page);
    this.addBlock({ kind: "header", section, x: clientReportPage.margin.left, y: clientReportPage.margin.top, width: this.contentWidth, height: 28, title: section });
    this.addBlock({ kind: "footer", section, x: clientReportPage.margin.left, y: clientReportPage.height - clientReportPage.margin.bottom - 20, width: this.contentWidth, height: 20 });
    this.cursor = clientReportPage.contentTop;
  }

  ensureSpace(height: number, section: string) {
    if (this.cursor + height > this.contentBottom) this.addContentPage(section);
  }

  startSection(section: string, description: string) {
    this.addContentPage(section);
    const titleLines = this.typesetter.wrap(section, this.contentWidth - 34, 24, "semibold").length;
    const descriptionLines = this.typesetter.wrap(description, this.contentWidth - 34, 9.5).length;
    const titleHeight = 28 + titleLines * 30 + descriptionLines * 13;
    this.addBlock({
      kind: "section-title",
      section,
      x: clientReportPage.margin.left,
      y: this.cursor,
      width: this.contentWidth,
      height: titleHeight,
      title: section,
      text: description,
    });
    this.cursor += titleHeight + 16;
  }

  get contentWidth() {
    return clientReportPage.width - clientReportPage.margin.left - clientReportPage.margin.right;
  }

  get contentBottom() {
    return clientReportPage.height - clientReportPage.margin.bottom - clientReportPage.footerReserve;
  }
}

export function registerClientReportPdfFonts(doc: jsPDF, fonts: ClientReportPdfFontData) {
  doc.addFileToVFS("Geist-Regular.ttf", fonts.regular);
  doc.addFont("Geist-Regular.ttf", "Geist", "normal", "Identity-H");
  doc.addFileToVFS("Geist-SemiBold.ttf", fonts.semibold);
  doc.addFont("Geist-SemiBold.ttf", "Geist", "semibold", "Identity-H");
  doc.setFont("Geist", "normal");
}

export async function buildClientReportPdfLayout(
  model: ClientReportViewModel,
  fonts: ClientReportPdfFontData,
): Promise<ClientReportPdfLayout> {
  const measurementDoc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", putOnlyUsedFonts: true });
  registerClientReportPdfFonts(measurementDoc, fonts);
  const typesetter = createClientReportTypesetter(measurementDoc);
  const composer = new ClientReportLayoutComposer(typesetter);
  const t = clientReportPdfCopy[model.language];
  const { margin, gap } = clientReportPage;
  const contentWidth = composer.contentWidth;

  const addNote = (section: string, text: string) => {
    const height = noteHeight(text, contentWidth, typesetter);
    composer.ensureSpace(height, section);
    composer.addBlock({ kind: "note", section, x: margin.left, y: composer.cursor, width: contentWidth, height, text });
    composer.cursor += height + gap;
  };

  const addNarrativeFlow = (section: string, title: string, text: string, footnote?: string) => {
    const lineHeight = 14;
    let lines = typesetter.wrap(text, contentWidth - 40, 10.25);
    let first = true;
    while (lines.length) {
      if (composer.contentBottom - composer.cursor < 110) composer.addContentPage(section);
      const maxLines = Math.max(1, Math.floor((composer.contentBottom - composer.cursor - 48) / lineHeight));
      const chunk = lines.slice(0, maxLines);
      const height = 48 + chunk.length * lineHeight;
      composer.addBlock({
        kind: "narrative",
        section,
        x: margin.left,
        y: composer.cursor,
        width: contentWidth,
        height,
        title: first ? title : `${title} (${t.continued})`,
        text: chunk.join("\n"),
      });
      composer.cursor += height + gap;
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
    const height = Math.max(signalListHeight(left.items, width, typesetter), signalListHeight(right.items, width, typesetter));
    composer.ensureSpace(height, section);
    composer.addBlock({ kind: "signal-list", section, x: margin.left, y: composer.cursor, width, height, title: left.title, items: left.items, tone: left.tone });
    composer.addBlock({ kind: "signal-list", section, x: margin.left + width + columnGap, y: composer.cursor, width, height, title: right.title, items: right.items, tone: right.tone });
    composer.cursor += height + gap;
  };

  const addPairedRankings = (section: string) => {
    const columnGap = 16;
    const width = (contentWidth - columnGap) / 2;
    const campaigns = model.topCampaigns.slice(0, 3);
    const adsets = model.topAdsets.slice(0, 3);
    const height = Math.max(rankingHeight(campaigns), rankingHeight(adsets));
    composer.ensureSpace(height, section);
    composer.addBlock({ kind: "ranking-list", section, x: margin.left, y: composer.cursor, width, height, title: t.topCampaigns, drivers: campaigns });
    composer.addBlock({ kind: "ranking-list", section, x: margin.left + width + columnGap, y: composer.cursor, width, height, title: t.topAdsets, drivers: adsets });
    composer.cursor += height + gap;
  };

  const addBreakdown = (section: string, title: string, rows: ClientReportBreakdownRow[], x: number, width: number, height: number) => {
    composer.addBlock({ kind: "breakdown-list", section, x, y: composer.cursor, width, height, title, rows });
  };

  const addTable = (section: string, table: ClientReportTable) => {
    const addHeading = (continued = false) => {
      const headingHeight = 44;
      const tableHeaderHeight = 40;
      composer.ensureSpace(headingHeight + tableHeaderHeight + tableRowHeight(table.rows[0], table, contentWidth, typesetter), section);
      composer.addBlock({
        kind: "subsection",
        section,
        x: margin.left,
        y: composer.cursor,
        width: contentWidth,
        height: headingHeight,
        title: continued ? `${table.title} (${t.continued})` : table.title,
      });
      composer.cursor += headingHeight;
      composer.addBlock({ kind: "table-header", section: table.title, x: margin.left, y: composer.cursor, width: contentWidth, height: tableHeaderHeight, title: table.title, table });
      composer.cursor += tableHeaderHeight;
    };
    addHeading();
    table.rows.forEach((row) => {
      const height = tableRowHeight(row, table, contentWidth, typesetter);
      if (composer.cursor + height > composer.contentBottom) {
        composer.addContentPage(section);
        addHeading(true);
      }
      composer.addBlock({ kind: "table-row", section: table.title, x: margin.left, y: composer.cursor, width: contentWidth, height, row, table });
      composer.cursor += height;
    });
    composer.cursor += 20;
  };

  composer.addCover();

  composer.startSection(model.copy.executiveSummary, t.executiveDescription);
  const executiveMeta = [
    { label: t.dataSource, value: model.copy.source },
    { label: t.decisionSource, value: model.decisionProviderLabel },
    { label: t.selectedPack, value: `${model.selectedPackLabel}\n${model.selectedPackReason}` },
    { label: t.primaryResult, value: `${model.primaryResultLabel}\n${model.primaryCostLabel}` },
  ];
  const provenanceHeight = provenanceBlockHeight(executiveMeta, contentWidth, typesetter);
  composer.addBlock({
    kind: "provenance",
    section: model.copy.executiveSummary,
    x: margin.left,
    y: composer.cursor,
    width: contentWidth,
    height: provenanceHeight,
    meta: executiveMeta,
  });
  composer.cursor += provenanceHeight + gap;

  const healthHeight = Math.max(92, 36 + typesetter.height(model.healthSummaryText, contentWidth - 248, 9.5, 13));
  composer.ensureSpace(healthHeight, model.copy.executiveSummary);
  composer.addBlock({
    kind: "health-strip",
    section: model.copy.executiveSummary,
    x: margin.left,
    y: composer.cursor,
    width: contentWidth,
    height: healthHeight,
    title: t.accountHealth,
    text: model.healthSummaryText,
    label: model.healthStatusLabel,
    tone: healthTone(model.healthStatus),
  });
  composer.cursor += healthHeight + gap;

  const metricHeight = metricGridHeight(model.kpis.length);
  composer.ensureSpace(metricHeight, model.copy.executiveSummary);
  composer.addBlock({ kind: "metric-grid", section: model.copy.executiveSummary, x: margin.left, y: composer.cursor, width: contentWidth, height: metricHeight, kpis: model.kpis });
  composer.cursor += metricHeight + gap;
  addNarrativeFlow(model.copy.executiveSummary, t.decisionBrief, model.verdictText);
  addPairedLists(
    model.copy.executiveSummary,
    { title: model.copy.wins, items: model.wins.slice(0, 1), tone: "good" },
    { title: model.copy.losers, items: model.losers.slice(0, 1), tone: "bad" },
  );
  addPairedLists(
    model.copy.executiveSummary,
    { title: model.copy.risks, items: model.risks.slice(0, 1), tone: "warning" },
    { title: model.copy.assumptions, items: model.assumptions.slice(0, 1), tone: "neutral" },
  );

  const comparisonContext = model.comparison.status === "off" ? ` ${model.comparison.summary}` : "";
  composer.startSection(model.copy.performanceStory, `${t.performanceDescription} ${model.primaryResultExplanation}${comparisonContext}`);
  const trendHeight = 232;
  composer.addBlock({
    kind: "trend-chart",
    section: model.copy.performanceStory,
    x: margin.left,
    y: composer.cursor,
    width: contentWidth,
    height: trendHeight,
    title: t.spendTrend,
    text: t.trendGuide,
    legend: [
      { kind: "bar", label: t.spend },
      { kind: "line", label: sentenceCase(model.primaryResultLabel) },
      { kind: "dashed", label: model.efficiencyLabel },
    ],
    trend: model.dailyTrend,
  });
  composer.cursor += trendHeight + gap;
  addNarrativeFlow(model.copy.performanceStory, t.dailyDiagnosis, model.dailyDiagnosis.summary);
  if (model.dailyDiagnosis.causes.length) {
    addPairedLists(
      model.copy.performanceStory,
      { title: model.language === "vi" ? "Nguyên nhân" : "Causes", items: model.dailyDiagnosis.causes.map((cause) => `${cause.title}: ${cause.evidence.join("; ")}`), tone: model.dailyDiagnosis.severity === "risk" ? "bad" : "warning" },
      { title: model.language === "vi" ? "Hành động" : "Actions", items: model.dailyDiagnosis.causes.map((cause) => cause.action), tone: "primary" },
    );
  }
  addPairedRankings(model.copy.performanceStory);
  if (model.comparison.status !== "off") {
    addNarrativeFlow(model.copy.performanceStory, t.comparisonDrivers, model.comparison.summary);
  }
  if (model.comparison.status !== "off" && model.comparison.drivers.length) {
    addPairedLists(
      model.copy.performanceStory,
      { title: model.language === "vi" ? "Bằng chứng" : "Evidence", items: model.comparison.drivers.map((driver) => `${driver.name}: ${driver.evidence.join("; ")}`), tone: "primary" },
      { title: model.language === "vi" ? "Hàm ý" : "Implication", items: model.comparison.drivers.map((driver) => driver.action), tone: "neutral" },
    );
  }
  if (model.comparison.status !== "off" && model.copy.footnoteComparison !== model.comparison.summary) {
    addNote(model.copy.performanceStory, model.copy.footnoteComparison);
  }

  const recommendationInsight = model.insightSummary ? `${t.evidenceSummary}: ${model.insightSummary}` : null;
  const inlineRecommendationInsight = recommendationInsight
    && typesetter.wrap(recommendationInsight, contentWidth - 34, 9.5).length <= 3
    ? recommendationInsight
    : null;
  composer.startSection(
    model.copy.recommendations,
    `${inlineRecommendationInsight ? `${t.recommendationsDescription} ${inlineRecommendationInsight}` : t.recommendationsDescription} ${model.copy.footnoteRecommendations}`,
  );
  if (model.insightSummary && !inlineRecommendationInsight) {
    addNarrativeFlow(model.copy.recommendations, t.evidenceSummary, model.insightSummary);
  }
  const budgetEvidence = model.budgetMove.recommendations.flatMap((recommendation) => [recommendation.summary, ...recommendation.evidence]);
  const supportingBudgetEvidence = budgetEvidence.length ? budgetEvidence : model.budgetMove.holdReasons;
  const evidence = [model.budgetMove.summary, ...supportingBudgetEvidence.slice(0, 2)].filter(
    (item, index, items) => Boolean(item) && items.indexOf(item) === index,
  );
  if (evidence.length) {
    const height = signalListHeight(evidence, contentWidth, typesetter);
    composer.ensureSpace(height, model.copy.recommendations);
    composer.addBlock({
      kind: "signal-list",
      section: model.copy.recommendations,
      x: margin.left,
      y: composer.cursor,
      width: contentWidth,
      height,
      title: t.budgetEvidence,
      items: evidence,
      tone: model.budgetMove.status === "moves_recommended" ? "good" : "warning",
    });
    composer.cursor += height + gap;
  }
  const actionGap = 16;
  const firstActionWidth = model.actions.length > 1 ? (contentWidth - actionGap) / 2 : contentWidth;
  const firstActionHeight = model.actions[0] ? actionHeight(model.actions[0], firstActionWidth, typesetter) : 0;
  composer.ensureSpace(44 + firstActionHeight, model.copy.recommendations);
  composer.addBlock({ kind: "subsection", section: model.copy.recommendations, x: margin.left, y: composer.cursor, width: contentWidth, height: 44, title: t.priorityActions });
  composer.cursor += 44;
  for (let index = 0; index < model.actions.length; index += 2) {
    const pair = model.actions.slice(index, index + 2);
    const width = pair.length === 1 ? contentWidth : (contentWidth - actionGap) / 2;
    const height = Math.max(...pair.map((action) => actionHeight(action, width, typesetter)));
    composer.ensureSpace(height, model.copy.recommendations);
    pair.forEach((action, pairIndex) => {
      composer.addBlock({
        kind: "action-row",
        section: model.copy.recommendations,
        x: margin.left + pairIndex * (width + actionGap),
        y: composer.cursor,
        width,
        height,
        action,
        index: index + pairIndex + 1,
      });
    });
    composer.cursor += height + 8;
  }

  composer.startSection(model.copy.appendixCharts, t.chartsDescription);
  if (model.customCharts.length) {
    composer.addBlock({ kind: "subsection", section: model.copy.appendixCharts, x: margin.left, y: composer.cursor, width: contentWidth, height: 44, title: t.customCharts });
    composer.cursor += 44;
    model.customCharts.forEach((chart) => {
      const height = 300;
      composer.ensureSpace(height, model.copy.appendixCharts);
      composer.addBlock({ kind: "custom-chart", section: model.copy.appendixCharts, x: margin.left, y: composer.cursor, width: contentWidth, height, customChart: chart, title: chart.title });
      composer.cursor += height + gap;
    });
  }
  const breakdownGap = 8;
  if (model.customCharts.length) {
    const breakdownWidth = (contentWidth - breakdownGap * 2) / 3;
    const breakdownHeightValue = Math.max(
      breakdownHeight(model.breakdowns.platforms, true),
      breakdownHeight(model.breakdowns.regions, true),
      breakdownHeight(model.breakdowns.ageGender, true),
    );
    composer.ensureSpace(breakdownHeightValue, model.copy.appendixCharts);
    addBreakdown(model.copy.appendixCharts, model.language === "vi" ? "Nền tảng" : "Platform", model.breakdowns.platforms, margin.left, breakdownWidth, breakdownHeightValue);
    addBreakdown(model.copy.appendixCharts, model.language === "vi" ? "Khu vực" : "Geography", model.breakdowns.regions, margin.left + breakdownWidth + breakdownGap, breakdownWidth, breakdownHeightValue);
    addBreakdown(model.copy.appendixCharts, model.language === "vi" ? "Tuổi và giới tính" : "Age and gender", model.breakdowns.ageGender, margin.left + (breakdownWidth + breakdownGap) * 2, breakdownWidth, breakdownHeightValue);
    composer.cursor += breakdownHeightValue + breakdownGap;
  } else {
    const breakdowns = [
      { title: model.language === "vi" ? "Nền tảng" : "Platform", rows: model.breakdowns.platforms },
      { title: model.language === "vi" ? "Khu vực" : "Geography", rows: model.breakdowns.regions },
      { title: model.language === "vi" ? "Tuổi và giới tính" : "Age and gender", rows: model.breakdowns.ageGender },
    ];
    breakdowns.forEach(({ title, rows }) => {
      const height = breakdownHeight(rows);
      composer.ensureSpace(height, model.copy.appendixCharts);
      addBreakdown(model.copy.appendixCharts, title, rows, margin.left, contentWidth, height);
      composer.cursor += height + breakdownGap;
    });
  }

  composer.startSection(model.copy.appendixTables, t.tablesDescription);
  composer.addBlock({ kind: "subsection", section: model.copy.appendixTables, x: margin.left, y: composer.cursor, width: contentWidth, height: 44, title: t.performanceRows });
  composer.cursor += 44;
  model.tables.forEach((table) => addTable(model.copy.appendixTables, table));
  const tableGuideHeight = signalListHeight(model.tableGuide.items, contentWidth, typesetter);
  composer.ensureSpace(tableGuideHeight, model.copy.appendixTables);
  composer.addBlock({
    kind: "signal-list",
    section: model.copy.appendixTables,
    x: margin.left,
    y: composer.cursor,
    width: contentWidth,
    height: tableGuideHeight,
    title: model.tableGuide.title,
    items: model.tableGuide.items,
    tone: "neutral",
  });
  composer.cursor += tableGuideHeight + gap;

  composer.startSection(model.copy.appendixDiagnostics, t.diagnosticsDescription);
  composer.addBlock({ kind: "subsection", section: model.copy.appendixDiagnostics, x: margin.left, y: composer.cursor, width: contentWidth, height: 44, title: t.diagnostics });
  composer.cursor += 44;
  model.diagnostics.forEach((diagnostic) => {
    const height = diagnosticHeight(diagnostic, contentWidth, typesetter, model.language);
    composer.ensureSpace(height, model.copy.appendixDiagnostics);
    composer.addBlock({
      kind: "diagnostic-row",
      section: model.copy.appendixDiagnostics,
      x: margin.left,
      y: composer.cursor,
      width: contentWidth,
      height,
      diagnostic,
      tone: diagnostic.severity === "ok" ? "good" : diagnostic.severity === "watch" ? "warning" : diagnostic.severity === "risk" ? "bad" : "neutral",
    });
    composer.cursor += height;
  });
  composer.cursor += gap;
  const firstCreativeHeight = model.creativeDetails[0] ? creativeHeight(model.creativeDetails[0], contentWidth, typesetter) : 0;
  composer.ensureSpace(44 + firstCreativeHeight, model.copy.appendixDiagnostics);
  composer.addBlock({ kind: "subsection", section: model.copy.appendixDiagnostics, x: margin.left, y: composer.cursor, width: contentWidth, height: 44, title: t.creativeDetail });
  composer.cursor += 44;
  if (!model.creativeDetails.length) {
    addNote(model.copy.appendixDiagnostics, t.noCreativeDetail);
  } else {
    model.creativeDetails.forEach((creative) => {
      const height = creativeHeight(creative, contentWidth, typesetter);
      composer.ensureSpace(height, model.copy.appendixDiagnostics);
      composer.addBlock({ kind: "creative-row", section: model.copy.appendixDiagnostics, x: margin.left, y: composer.cursor, width: contentWidth, height, creative });
      composer.cursor += height;
    });
  }

  return composer.layout;
}

export function clientReportMetricGridColumns(kpiCount: number) {
  if (kpiCount <= 5) return Math.max(1, kpiCount);
  return 3;
}

function metricGridHeight(kpiCount: number) {
  const rows = Math.ceil(Math.max(1, kpiCount) / clientReportMetricGridColumns(kpiCount));
  return rows * 88;
}

function signalListHeight(items: string[], width: number, typesetter: ClientReportTypesetter) {
  return Math.max(78, 46 + items.reduce((height, item) => height + typesetter.wrap(item, width - 34, 8.8).length * 12 + 10, 0));
}

function provenanceBlockHeight(meta: Array<{ label: string; value: string }>, width: number, typesetter: ClientReportTypesetter) {
  const columnWidth = width / Math.max(1, meta.length);
  const valueLines = Math.max(1, ...meta.map((item) => typesetter.wrap(item.value, columnWidth - 28, 9, "semibold").length));
  return Math.max(72, 48 + valueLines * 12);
}

function noteHeight(text: string, width: number, typesetter: ClientReportTypesetter) {
  return 28 + typesetter.height(text, width - 28, 8, 11);
}

function rankingHeight(rows: ClientReportDriver[]) {
  return Math.max(128, 58 + rows.length * 62);
}

function actionHeight(action: ClientReportAction, width: number, typesetter: ClientReportTypesetter) {
  const titleLines = typesetter.wrap(action.title, width - 92, 11.5, "semibold").length;
  const whyLines = typesetter.wrap(action.why, width - 92, 8.5).length;
  const monitorLines = typesetter.wrap(action.monitor, width - 92, 8.5).length;
  return Math.max(124, 74 + titleLines * 15 + whyLines * 11.5 + monitorLines * 11.5);
}

function breakdownHeight(rows: ClientReportBreakdownRow[], compact = false) {
  return Math.max(compact ? 138 : 118, 58 + rows.length * (compact ? 40 : 32));
}

function tableRowHeight(
  row: ClientReportTable["rows"][number] | undefined,
  table: ClientReportTable,
  contentWidth: number,
  typesetter: ClientReportTypesetter,
) {
  if (!row) return 40;
  const totalWeight = table.columns.reduce((sum, column) => sum + column.weight, 0);
  const nameColumn = table.columns.find((column) => column.align === "left") || table.columns[0];
  const nameWidth = ((contentWidth - 28) * nameColumn.weight) / totalWeight;
  return Math.max(40, 18 + typesetter.wrap(row.cells[nameColumn.key] || "", nameWidth - 8, 8.1).length * 11);
}

function diagnosticHeight(
  diagnostic: ClientReportViewModel["diagnostics"][number],
  width: number,
  typesetter: ClientReportTypesetter,
  language: InterfaceLanguage,
) {
  const summaryLines = typesetter.wrap(diagnostic.summary, width - 108, 8.5).length;
  const evidenceLines = diagnostic.evidence.reduce((count, line) => count + typesetter.wrap(`- ${line}`, width - 108, 7.8).length, 0);
  const nextStepText = `${language === "vi" ? "Bước tiếp theo" : "Next step"}: ${diagnostic.nextStep}`;
  const nextStepLines = typesetter.wrap(nextStepText, width - 108, 7.8, "semibold").length;
  return Math.max(96, 68 + summaryLines * 11.5 + Math.max(1, evidenceLines) * 10.5 + nextStepLines * 10.5);
}

function creativeHeight(creative: ClientReportViewModel["creativeDetails"][number], width: number, typesetter: ClientReportTypesetter) {
  return Math.max(126, 78 + typesetter.height(creative.summary, width - 184, 8.3, 11));
}

function healthTone(status: ClientReportViewModel["healthStatus"]): ReportTone {
  if (status === "healthy") return "good";
  if (status === "warning") return "warning";
  return "bad";
}

export function safePdfText(value: string) {
  return value.replace(/₫/g, "VND").replace(/\u00a0/g, " ").normalize("NFC");
}

function sentenceCase(value: string) {
  return value ? value.charAt(0).toLocaleUpperCase() + value.slice(1) : value;
}
