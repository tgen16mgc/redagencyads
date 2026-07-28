import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildClientReportViewModel } from "../client-report";
import { buildClientReportPdf } from "../client-report-pdf";
import {
  buildClientReportPdfLayout,
  clientReportMetricGridColumns,
  createClientReportTypesetter,
  registerClientReportPdfFonts,
  type ClientReportPdfFontData,
} from "../client-report-layout";
import { CHART_PRESETS, presetToSpec } from "../custom-chart";
import { buildSampleReport } from "../sample-report";
import type { DashboardReport, KpiCard, NormalizedRow, Verdict } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "campaign",
    name: "Row",
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    linkClicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    messages: 0,
    replies: 0,
    leads: 0,
    purchases: 0,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: 0,
    costPerReply: 0,
    cpl: 0,
    cpaPurchase: 0,
    roas: 0,
    replyRate: 0,
    leadRate: 0,
    ...overrides,
  };
}

const kpis: KpiCard[] = [
  { key: "spend", label: "Spend", format: "currency" },
  { key: "leads", label: "Leads", format: "number" },
  { key: "cpl", label: "CPL", format: "currency" },
  { key: "healthScore", label: "Health", format: "number" },
];

const longCopy = "This is a deliberately long client-facing sentence that must wrap naturally in the PDF instead of being clipped inside a fixed-height card.";

const fonts: ClientReportPdfFontData = {
  regular: readFileSync(resolve(process.cwd(), "public/fonts/geist/Geist-Regular.ttf")).toString("base64"),
  semibold: readFileSync(resolve(process.cwd(), "public/fonts/geist/Geist-SemiBold.ttf")).toString("base64"),
};

const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  const longRows = Array.from({ length: 34 }, (_, index) =>
    row({
      id: `row-${index}`,
      level: index % 3 === 0 ? "campaign" : index % 3 === 1 ? "adset" : "ad",
      name: `Long performance row ${index + 1} with campaign naming context that should wrap instead of disappear`,
      spend: 1_000_000 + index * 75_000,
      leads: 30 + index,
      cpl: 45_000 + index * 500,
      ctr: 0.012 + index / 10000,
    }),
  );

  return {
    account: { id: "act", name: "Seoul Beauty Clinic", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-26" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "Lead actions detected.",
    kpis,
    totals: row({ id: "total", level: "account", name: "Total", spend: 84_000_000, leads: 1200, cpl: 70_000 }),
    campaignRows: longRows.slice(0, 12).map((item) => ({ ...item, level: "campaign" })),
    adsetRows: longRows.map((item) => ({ ...item, level: "adset" })),
    adRows: longRows.map((item) => ({ ...item, level: "ad" })),
    dailyRows: Array.from({ length: 26 }, (_, index) =>
      row({
        id: `daily-${index}`,
        level: "daily",
        name: `2026-06-${String(index + 1).padStart(2, "0")}`,
        date: `2026-06-${String(index + 1).padStart(2, "0")}`,
        spend: 2_000_000 + index * 20_000,
        leads: 35 + index,
      }),
    ),
    platformRows: [row({ id: "p1", level: "breakdown", name: "Instagram", platform: "Instagram", spend: 50_000_000, leads: 700 })],
    ageGenderRows: [row({ id: "ag1", level: "breakdown", name: "25-34 female", age: "25-34", gender: "female", spend: 22_000_000, leads: 340 })],
    regionRows: [row({ id: "r1", level: "breakdown", name: "Ho Chi Minh", region: "Ho Chi Minh", spend: 36_000_000, leads: 620 })],
    health: {
      score: 82,
      grade: "B",
      checks: Array.from({ length: 12 }, (_, index) => ({
        id: `check-${index}`,
        label: `Diagnostic ${index + 1}`,
        status: index % 3 === 0 ? "warning" : "pass",
        detail: `${longCopy} Diagnostic evidence ${index + 1}.`,
      })),
    },
    prompt: "Prompt",
    pulledAt: "2026-06-26T10:00:00.000Z",
    adsetPreviews: [
      {
        id: "as1",
        name: "Consult retargeting with long ad set name",
        campaignId: "c1",
        campaignName: "Lead campaign - HCM",
        status: "ACTIVE",
        dailyBudget: 1_000_000,
        lifetimeBudget: 0,
        ads: Array.from({ length: 9 }, (_, index) => ({ id: `ad-${index}`, name: `Creative proof point ${index + 1} with long naming context`, adsetId: "as1", previewHtml: "" })),
      },
    ],
    ...overrides,
  };
}

function verdict(): Verdict {
  return {
    verdict: Array.from({ length: 5 }, () => longCopy).join(" "),
    risks: Array.from({ length: 5 }, (_, index) => `${longCopy} Risk ${index + 1}.`),
    winners: Array.from({ length: 5 }, (_, index) => `${longCopy} Winner ${index + 1}.`),
    losers: [],
    budget_moves: Array.from({ length: 5 }, (_, index) => `${longCopy} Budget move ${index + 1}.`),
    tests: Array.from({ length: 5 }, (_, index) => `${longCopy} Test ${index + 1}.`),
    confidence: "high",
    assumptions: [],
    provider: "prompt",
  };
}

function model() {
  return buildClientReportViewModel({
    report: report(),
    compareMode: "off",
    language: "en",
    kpis,
    verdict: verdict(),
  });
}

describe("client report PDF rebuild", () => {
  it("keeps every rendered block inside printable page bounds", async () => {
    const layout = await buildClientReportPdfLayout(model(), fonts);

    expect(layout.pages.length).toBeGreaterThan(7);
    for (const page of layout.pages) {
      const top = layout.margin.top;
      const bottom = layout.height - layout.margin.bottom;
      for (const block of page.blocks) {
        expect(block.y).toBeGreaterThanOrEqual(top - 0.01);
        expect(block.y + block.height).toBeLessThanOrEqual(bottom + 0.01);
      }
    }
  });

  it("continues very long executive verdict text within printable page bounds", async () => {
    const longVerdictModel = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "en",
      kpis,
      verdict: {
        ...verdict(),
        verdict: Array.from({ length: 250 }, () => longCopy).join(" "),
      },
    });
    const layout = await buildClientReportPdfLayout(longVerdictModel, fonts);
    const verdictBlocks = layout.pages.flatMap((page) => page.blocks.filter((block) => block.kind === "narrative" && block.title?.startsWith("Performance decision")));

    for (const page of layout.pages) {
      const top = layout.margin.top;
      const bottom = layout.height - layout.margin.bottom;
      for (const block of page.blocks) {
        expect(block.y).toBeGreaterThanOrEqual(top - 0.01);
        expect(block.y + block.height).toBeLessThanOrEqual(bottom + 0.01);
      }
    }
    expect(new Set(verdictBlocks.map((block) => block.pageNumber)).size).toBeGreaterThan(1);
  });

  it("continues long table sections across pages instead of clipping rows", async () => {
    const layout = await buildClientReportPdfLayout(model(), fonts);
    const campaignTableRows = layout.pages.flatMap((page) => page.blocks.filter((block) => block.kind === "table-row" && block.section === "Campaigns"));

    expect(campaignTableRows).toHaveLength(12);
    expect(new Set(campaignTableRows.map((block) => block.pageNumber)).size).toBeGreaterThan(1);
  });

  it("renders selectable PDF text without screenshot image objects", async () => {
    const pdf = await buildClientReportPdf(model(), fonts);
    const bytes = new Uint8Array(await pdf.blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);

    expect(pdf.filename).toBe("seoul-beauty-clinic-meta-ads-report-2026-06-01-to-2026-06-26.pdf");
    expect(String.fromCharCode(...bytes.slice(0, 8))).toBe("%PDF-1.3");
    expect(text).toContain("Geist");
    expect(text).toContain("/ToUnicode");
    expect(text).not.toContain("/Subtype /Image");
    expect(text).toContain("%%EOF");
  });

  it("reserves collision-safe metric and health space and explains every trend series", async () => {
    const stressedModel = {
      ...model(),
      healthLabel: "B · 85/100",
      healthStatusLabel: "Watch",
      kpis: [
        { key: "spend", label: "Spend", value: "10.21M VND", delta: "↑ 12.4% vs previous period", movement: "bad" as const },
        { key: "leads", label: "Leads", value: "121", delta: "↑ 8.2% vs previous period", movement: "good" as const },
        { key: "cpl", label: "Cost per lead", value: "84,420 VND", delta: "↓ 3.1% vs previous period", movement: "good" as const },
        { key: "ctr", label: "CTR", value: "1.24%", delta: "→ 0% vs previous period", movement: "neutral" as const },
        { key: "impressions", label: "Impressions", value: "742K", delta: "↑ 6.8% vs previous period", movement: "good" as const },
      ],
    };
    const layout = await buildClientReportPdfLayout(stressedModel, fonts);
    const blocks = layout.pages.flatMap((page) => page.blocks);
    const health = blocks.find((block) => block.kind === "health-strip");
    const metrics = blocks.find((block) => block.kind === "metric-grid");
    const trend = blocks.find((block) => block.kind === "trend-chart");

    expect(health?.height).toBeGreaterThanOrEqual(92);
    expect(metrics?.height).toBeGreaterThanOrEqual(88);
    expect(clientReportMetricGridColumns(stressedModel.kpis.length)).toBe(5);
    expect(trend?.kind === "trend-chart" ? trend.legend : []).toEqual([
      { kind: "bar", label: "Spend" },
      { kind: "line", label: "Leads" },
      { kind: "dashed", label: "CPL" },
    ]);
    expect(trend?.kind === "trend-chart" ? trend.text : "").toContain("own 0-to-maximum scale");
  });

  it("renders every ad as a paginated linked preview card and embeds available thumbnails", async () => {
    const previewReport = report({
      adsetPreviews: [{
        ...report().adsetPreviews![0],
        ads: Array.from({ length: 9 }, (_, index) => ({
          id: `preview-${index + 1}`,
          name: `Preview creative ${index + 1}`,
          adsetId: "as1",
          previewHtml: `<iframe src="https://www.facebook.com/ads/api/preview_iframe.php?d=preview-${index + 1}&amp;t=1"></iframe>`,
          previewImageUrl: index === 0 ? TINY_PNG : undefined,
        })),
      }],
    });
    const previewModel = buildClientReportViewModel({
      report: previewReport,
      compareMode: "off",
      language: "en",
      kpis,
      verdict: verdict(),
    });
    const layout = await buildClientReportPdfLayout(previewModel, fonts);
    const creativeBlocks = layout.pages.flatMap((page) => page.blocks.filter((block) => block.kind === "creative-row"));
    const pdf = await buildClientReportPdf(previewModel, fonts);
    const bytes = new Uint8Array(await pdf.blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);

    expect(creativeBlocks).toHaveLength(9);
    expect(new Set(creativeBlocks.map((block) => block.pageNumber)).size).toBeGreaterThan(1);
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/Annots");
    expect(text).toContain("/URI");
  });

  it("includes saved Custom Charts as vector layout blocks", async () => {
    const chartModel = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "en",
      kpis,
      verdict: verdict(),
      customCharts: [presetToSpec(CHART_PRESETS[0], "en", "saved-chart")],
    });
    const layout = await buildClientReportPdfLayout(chartModel, fonts);
    const chartBlocks = layout.pages.flatMap((page) => page.blocks.filter((block) => block.kind === "custom-chart"));

    expect(chartBlocks).toHaveLength(1);
    expect(chartBlocks[0].customChart?.title).toBe("Lead volume vs CPL");
    expect(chartBlocks[0].customChart?.data).toHaveLength(26);
    expect(chartBlocks[0].customChart?.referenceNote).toBeNull();
  });

  it("keeps the Budget Move and action grid concise, then keeps breakdown evidence together", async () => {
    const sample = buildSampleReport();
    const sampleModel = buildClientReportViewModel({
      report: sample,
      compareMode: "off",
      language: "en",
      kpis: sample.kpis,
      customCharts: [presetToSpec(CHART_PRESETS[0], "en", "saved-chart")],
      insights: {
        summary: "Scope includes 3 campaigns, 6 ad sets, and 8 ads.",
        rows: [],
        confidence: "medium",
        assumptions: [],
        provider: "9router",
      },
    });
    const layout = await buildClientReportPdfLayout(sampleModel, fonts);
    const recommendationPages = layout.pages.filter((page) => page.section === sampleModel.copy.recommendations);
    const recommendationBlocks = recommendationPages.flatMap((page) => page.blocks);
    const actionBlocks = recommendationBlocks.filter((block) => block.kind === "action-row");
    const budgetEvidence = recommendationBlocks.find((block) => block.kind === "signal-list" && block.title.startsWith("Budget evidence"));
    const breakdownBlocks = layout.pages.flatMap((page) => page.blocks.filter((block) => block.kind === "breakdown-list"));
    const noChartModel = buildClientReportViewModel({
      report: sample,
      compareMode: "off",
      language: "en",
      kpis: sample.kpis,
    });
    const noChartLayout = await buildClientReportPdfLayout(noChartModel, fonts);
    const noChartAppendixPages = noChartLayout.pages.filter((page) => page.section === noChartModel.copy.appendixCharts);

    expect(recommendationPages).toHaveLength(1);
    expect(actionBlocks).toHaveLength(4);
    expect(new Set(actionBlocks.map((block) => block.pageNumber)).size).toBe(1);
    expect(budgetEvidence?.kind === "signal-list" ? budgetEvidence.items[0] : null).toBe(sampleModel.budgetMove.summary);
    expect(recommendationBlocks.some((block) => block.kind === "narrative" && block.title.startsWith("Budget evidence"))).toBe(false);
    expect(new Set(breakdownBlocks.map((block) => block.pageNumber)).size).toBe(1);
    expect(noChartAppendixPages).toHaveLength(1);
    expect(noChartAppendixPages[0].blocks.filter((block) => block.kind === "breakdown-list")).toHaveLength(3);
  });

  it("keeps the client summary sections dense and prints the comparison-off disclosure once", async () => {
    const sample = buildSampleReport();
    const sampleModel = buildClientReportViewModel({
      report: sample,
      compareMode: "off",
      language: "en",
      kpis: sample.kpis,
      customCharts: [presetToSpec(CHART_PRESETS[0], "en", "saved-chart")],
    });
    const layout = await buildClientReportPdfLayout(sampleModel, fonts);
    const sections = [sampleModel.copy.executiveSummary, sampleModel.copy.performanceStory, sampleModel.copy.recommendations, sampleModel.copy.appendixCharts];

    sections.forEach((section) => expect(layout.pages.filter((page) => page.section === section)).toHaveLength(1));
    const savedChart = layout.pages.flatMap((page) => page.blocks).find((block) => block.kind === "custom-chart");
    expect(savedChart?.kind === "custom-chart" ? savedChart.customChart.referenceNote : null).toContain("primary KPI remains messages");
    const comparisonDisclosures = JSON.stringify(layout).match(/No comparison selected for this report\./g) || [];
    expect(comparisonDisclosures).toHaveLength(1);
    expect(JSON.stringify(layout)).not.toContain("Pack benchmark pass");
    expect(JSON.stringify(layout)).toContain("Target for this KPI pack");
    expect(layout.pages.filter((page) => sections.includes(page.section)).every((page) => {
      const content = page.blocks.filter((block) => block.kind !== "header" && block.kind !== "footer");
      return Math.max(...content.map((block) => block.y + block.height)) >= 650;
    })).toBe(true);
  });

  it("uses the final table-page space for client reading guidance", async () => {
    const sample = buildSampleReport();
    const sampleModel = buildClientReportViewModel({
      report: sample,
      compareMode: "off",
      language: "en",
      kpis: sample.kpis,
    });
    const layout = await buildClientReportPdfLayout(sampleModel, fonts);
    const tablePages = layout.pages.filter((page) => page.section === sampleModel.copy.appendixTables);
    const guideBlocks = tablePages.flatMap((page) => page.blocks).filter((block) => block.kind === "signal-list" && block.title === sampleModel.tableGuide.title);
    const lastPageContent = tablePages.at(-1)?.blocks.filter((block) => block.kind !== "header" && block.kind !== "footer") || [];

    expect(guideBlocks).toHaveLength(1);
    expect(Math.max(...lastPageContent.map((block) => block.y + block.height))).toBeGreaterThanOrEqual(650);
  });

  it("preserves the full KPI-pack explanation and reserves room below diagnostic next steps", async () => {
    const reportModel = model();
    const layout = await buildClientReportPdfLayout(reportModel, fonts);
    const provenance = layout.pages.flatMap((page) => page.blocks).find((block) => block.kind === "provenance" && block.meta.some((item) => item.label === "Selected KPI Pack"));

    expect(provenance?.kind === "provenance" ? provenance.meta.find((item) => item.label === "Selected KPI Pack")?.value : null)
      .toContain(reportModel.selectedPackReason);

    const measurementDoc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", putOnlyUsedFonts: true });
    registerClientReportPdfFonts(measurementDoc, fonts);
    const typesetter = createClientReportTypesetter(measurementDoc);
    const diagnosticBlocks = layout.pages.flatMap((page) => page.blocks.filter((block) => block.kind === "diagnostic-row"));
    for (const block of diagnosticBlocks) {
      if (block.kind !== "diagnostic-row") continue;
      const summaryLines = typesetter.wrap(block.diagnostic.summary, block.width - 108, 8.5).length;
      const evidenceLines = block.diagnostic.evidence.reduce((count, line) => count + typesetter.wrap(`- ${line}`, block.width - 108, 7.8).length, 0);
      const nextStepLines = typesetter.wrap(`Next step: ${block.diagnostic.nextStep}`, block.width - 108, 7.8, "semibold").length;
      const lastTextBaseline = block.y + 56.5 + summaryLines * 11.5 + Math.max(1, evidenceLines) * 10.5 + nextStepLines * 10.5;
      expect(lastTextBaseline).toBeLessThanOrEqual(block.y + block.height - 10);
    }
  });

  it("keeps Vietnamese copy in the layout and embeds a Unicode font", async () => {
    const vietnameseModel = buildClientReportViewModel({
      report: report({
        account: { id: "act", name: "Điều Đẹp Clinic ₫", currency: "VND" },
      }),
      compareMode: "off",
      language: "vi",
      kpis,
      verdict: {
        ...verdict(),
        verdict: "Điều chỉnh ngân sách ₫",
      },
    });
    const layout = await buildClientReportPdfLayout(vietnameseModel, fonts);
    const pdf = await buildClientReportPdf(vietnameseModel, fonts);
    const bytes = new Uint8Array(await pdf.blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);

    expect(vietnameseModel.accountName).toBe("Điều Đẹp Clinic ₫");
    expect(JSON.stringify(layout)).toContain("Điều chỉnh ngân sách VND");
    expect(text).toContain("Geist");
    expect(text).toContain("/ToUnicode");
    expect(text).not.toContain("/Subtype /Image");
  });
});
