import { describe, expect, it } from "vitest";
import { buildClientReportViewModel } from "../client-report";
import { buildClientReportPdf, buildClientReportPdfLayout } from "../client-report-pdf";
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
  it("keeps every rendered block inside printable page bounds", () => {
    const layout = buildClientReportPdfLayout(model());

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

  it("continues very long executive verdict text within printable page bounds", () => {
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
    const layout = buildClientReportPdfLayout(longVerdictModel);
    const verdictBlocks = layout.pages.flatMap((page) => page.blocks.filter((block) => block.kind === "text-card" && block.title === longVerdictModel.copy.verdictLabel));

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

  it("continues long table sections across pages instead of clipping rows", () => {
    const layout = buildClientReportPdfLayout(model());
    const campaignTableRows = layout.pages.flatMap((page) => page.blocks.filter((block) => block.kind === "table-row" && block.section === "Campaigns"));

    expect(campaignTableRows).toHaveLength(12);
    expect(new Set(campaignTableRows.map((block) => block.pageNumber)).size).toBeGreaterThan(1);
  });

  it("renders selectable PDF text without screenshot image objects", async () => {
    const pdf = buildClientReportPdf(model());
    const bytes = new Uint8Array(await pdf.blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);

    expect(pdf.filename).toBe("seoul-beauty-clinic-meta-ads-report-2026-06-01-to-2026-06-26.pdf");
    expect(String.fromCharCode(...bytes.slice(0, 8))).toBe("%PDF-1.3");
    expect(text).toContain("Meta Ads Performance");
    expect(text).toContain("Seoul Beauty Clinic");
    expect(text).not.toContain("/Subtype /Image");
    expect(text).toContain("%%EOF");
  });

  it("transliterates Vietnamese PDF text without corrupting words into VND", async () => {
    const pdf = buildClientReportPdf(buildClientReportViewModel({
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
    }));
    const bytes = new Uint8Array(await pdf.blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);

    expect(text).toContain("Dieu Dep Clinic VND");
    expect(text).toContain("Dieu chinh ngan sach VND");
    expect(text).not.toContain("VNDiu");
    expect(text).not.toContain("/Subtype /Image");
  });
});
