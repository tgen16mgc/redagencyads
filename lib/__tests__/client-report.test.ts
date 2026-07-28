import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildClientReportViewModel, downloadClientReportPdf } from "../client-report";
import { buildClientReportPdf } from "../client-report-pdf";
import type { ClientReportPdfFontData } from "../client-report-layout";
import { runDiagnostics } from "../diagnosis";
import { summarizeHealth } from "../health-score";
import { CHART_PRESETS, presetToSpec } from "../custom-chart";
import { primaryResultSpec } from "../primary-result";
import type { DashboardReport, KpiCard, KpiPack, NormalizedRow, Verdict } from "../types";

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

const fonts: ClientReportPdfFontData = {
  regular: readFileSync(resolve(process.cwd(), "public/fonts/geist/Geist-Regular.ttf")).toString("base64"),
  semibold: readFileSync(resolve(process.cwd(), "public/fonts/geist/Geist-SemiBold.ttf")).toString("base64"),
};

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  return {
    account: { id: "act", name: "Seoul Beauty Clinic", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-26" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "Lead actions detected.",
    kpis,
    totals: row({ id: "total", level: "account", name: "Total", spend: 84000000, leads: 1200, cpl: 70000 }),
    campaignRows: [row({ id: "c1", name: "Lead campaign - HCM", spend: 30000000, leads: 500, cpl: 60000 })],
    adsetRows: [row({ id: "a1", name: "Consult retargeting", spend: 14000000, leads: 250, cpl: 56000 })],
    adRows: [row({ id: "ad1", level: "ad", name: "Testimonial ad", spend: 5000000, leads: 80, cpl: 62500 })],
    dailyRows: [
      row({ id: "d1", level: "daily", name: "2026-06-25", date: "2026-06-25", spend: 3000000, leads: 40 }),
      row({ id: "d2", level: "daily", name: "2026-06-26", date: "2026-06-26", spend: 3200000, leads: 44 }),
    ],
    platformRows: [row({ id: "p1", level: "breakdown", name: "instagram", platform: "instagram", spend: 50000000, leads: 700 })],
    ageGenderRows: [row({ id: "ag1", level: "breakdown", name: "25-34 female", age: "25-34", gender: "female", spend: 22000000, leads: 340 })],
    regionRows: [row({ id: "r1", level: "breakdown", name: "Ho Chi Minh", region: "Ho Chi Minh", spend: 36000000, leads: 620 })],
    health: {
      score: 82,
      grade: "B",
      checks: [
        { id: "ctr", label: "CTR benchmark", status: "pass", detail: "CTR is above benchmark." },
        { id: "freq", label: "Frequency", status: "warning", detail: "Frequency is rising." },
      ],
    },
    prompt: "Prompt",
    pulledAt: "2026-06-26T10:00:00.000Z",
    adsetPreviews: [
      {
        id: "as1",
        name: "Consult retargeting",
        campaignId: "c1",
        campaignName: "Lead campaign - HCM",
        status: "ACTIVE",
        dailyBudget: 1000000,
        lifetimeBudget: 0,
        ads: [{
          id: "ad1",
          name: "Testimonial ad",
          adsetId: "as1",
          previewHtml: '<iframe src="https://www.facebook.com/ads/api/preview_iframe.php?d=proof&amp;t=1"></iframe>',
          previewImageUrl: "https://scontent.example.fbcdn.net/ad1.jpg",
        }],
      },
    ],
    ...overrides,
  };
}

function verdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    verdict: "Scale carefully while protecting CPA.",
    risks: ["Frequency is rising on retargeting."],
    winners: ["Lead campaign - HCM is the strongest volume driver."],
    losers: [],
    budget_moves: ["Move 15% more budget to the efficient lead cluster."],
    tests: ["Launch testimonial creative variants."],
    confidence: "high",
    assumptions: [],
    provider: "prompt",
    ...overrides,
  };
}

describe("buildClientReportViewModel", () => {
  it("uses the canonical health summary for the cover, health KPI, and fallback Verdict", () => {
    const current = report({
      health: {
        score: 91,
        grade: "A",
        checks: [
          { id: "warning", label: "Watch", status: "warning", detail: "Watch this." },
          { id: "danger", label: "Risk", status: "fail", detail: "Fix this." },
        ],
      },
    });
    const healthSummary = summarizeHealth(current);
    const model = buildClientReportViewModel({
      report: current,
      compareMode: "off",
      language: "en",
      kpis,
      generatedAt: "2026-06-27T08:30:00.000Z",
    });

    expect(healthSummary).toMatchObject({ score: 73, grade: "C" });
    expect(model.healthLabel).toBe("C · 73/100");
    expect(model.healthStatusLabel).toBe("Needs attention");
    expect(model.kpis.find((kpi) => kpi.key === "healthScore")?.value).toBe("C");
    expect(model.verdictText).toContain("lead generation objective");
    expect(model.generatedLabel).not.toBe(model.pulledLabel);
    expect(model.copy.footnoteComparison).toBe("No comparison selected for this report.");
    expect(model.kpis.every((kpi) => !kpi.delta)).toBe(true);
  });

  it("builds client-ready KPI cards with comparison deltas", () => {
    const model = buildClientReportViewModel({
      report: report(),
      previousReport: report({ totals: row({ id: "prev", level: "account", name: "Previous", spend: 70000000, leads: 1000, cpl: 70000 }) }),
      compareMode: "mom",
      language: "en",
      kpis,
      verdict: verdict(),
    });

    expect(model.accountName).toBe("Seoul Beauty Clinic");
    expect(model.verdictText).toBe("Increase budget carefully while protecting CPA.");
    expect(model.kpis.find((kpi) => kpi.key === "spend")?.delta).toContain("vs MoM");
    expect(model.kpis.find((kpi) => kpi.key === "healthScore")?.value).toBe("B");
    expect(model.copy.footnoteComparison).toContain("current 2026-06-01 to 2026-06-26");
    expect(model.copy.footnoteComparison).toContain("previous 2026-06-01 to 2026-06-26");
  });

  it("keeps appendix tables and creative details explicit", () => {
    const model = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "en",
      kpis,
    });

    expect(model.tables.map((table) => table.title)).toEqual(["Campaigns", "Ad sets", "Ads", "Daily"]);
    expect(model.copy.footnoteComparison).toBe("No comparison selected for this report.");
    expect(model.kpis.every((kpi) => !kpi.delta)).toBe(true);
    expect(model.tables[0].rows[0].cells.name).toBe("Lead campaign - HCM");
    expect(model.creativeDetails[0]).toMatchObject({
      id: "ad1",
      name: "Testimonial ad",
      adsetName: "Consult retargeting",
      summary: "Lead campaign - HCM / Consult retargeting",
      previewUrl: "https://www.facebook.com/ads/api/preview_iframe.php?d=proof&t=1",
      previewImageUrl: "https://scontent.example.fbcdn.net/ad1.jpg",
    });
  });

  it("keeps every available ad in creative detail", () => {
    const ads = Array.from({ length: 9 }, (_, index) => ({
      id: `ad-${index + 1}`,
      name: `Creative ${index + 1}`,
      adsetId: "as1",
      previewHtml: "",
    }));
    const model = buildClientReportViewModel({
      report: report({ adsetPreviews: [{ ...report().adsetPreviews![0], ads }] }),
      compareMode: "off",
      language: "en",
      kpis,
    });

    expect(model.creativeDetails).toHaveLength(9);
    expect(model.creativeDetails.at(-1)?.name).toBe("Creative 9");
    expect(model.creativeDetails.every((creative) => creative.previewUrl.includes("selected_ad_ids="))).toBe(true);
  });

  it("limits dense chart rows so PDF cards have enough vertical space", () => {
    const denseRows = Array.from({ length: 6 }, (_, index) => row({ id: `dense-${index}`, name: `Dense row ${index + 1}`, spend: 10_000 - index }));
    const model = buildClientReportViewModel({
      report: report({
        campaignRows: denseRows,
        adsetRows: denseRows.map((item) => ({ ...item, level: "adset" })),
        platformRows: denseRows.map((item, index) => ({ ...item, level: "breakdown", platform: `Platform ${index + 1}` })),
        regionRows: denseRows.map((item, index) => ({ ...item, level: "breakdown", region: `Region ${index + 1}` })),
        ageGenderRows: denseRows.map((item, index) => ({ ...item, level: "breakdown", age: "25-34", gender: `group ${index + 1}` })),
      }),
      compareMode: "off",
      language: "en",
      kpis,
    });

    expect(model.topCampaigns).toHaveLength(4);
    expect(model.topAdsets).toHaveLength(4);
    expect(model.breakdowns.platforms).toHaveLength(4);
    expect(model.breakdowns.regions).toHaveLength(4);
    expect(model.breakdowns.ageGender).toHaveLength(4);
  });

  it("uses Vietnamese report copy when requested", () => {
    const model = buildClientReportViewModel({
      report: report({
        health: {
          score: 85,
          grade: "B",
          checks: [
            { id: "M25", label: "Creative/ad volume proxy", status: "warning", detail: "8 ads found in selected scope. Target: 10+ diverse creatives where budget supports it." },
          ],
        },
      }),
      compareMode: "off",
      language: "vi",
      kpis,
    });

    expect(model.copy.executiveSummary).toBe("Tóm tắt điều hành");
    expect(model.copy.appendixCharts).toContain("Phụ lục A");
    expect(model.dateRangeLabel).toContain("2026");
    expect(model.kpis.find((kpi) => kpi.key === "leads")?.label).toBe("Khách hàng tiềm năng");
    expect(model.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(runDiagnostics(report({
      health: {
        score: 85,
        grade: "B",
        checks: [
          { id: "M25", label: "Creative/ad volume proxy", status: "warning", detail: "8 ads found in selected scope. Target: 10+ diverse creatives where budget supports it." },
        ],
      },
    })).map((diagnostic) => diagnostic.id));
    expect(model.diagnostics.find((diagnostic) => diagnostic.id === "creativeVolume")?.title).toBe("Số lượng mẫu quảng cáo");
    expect(model.diagnostics.find((diagnostic) => diagnostic.id === "dailyDiagnosis")?.severity).toBe("insufficient");
    expect(model.selectedPackReason).toBe("Hành động của khách hàng tiềm năng là tín hiệu kết quả đầy đủ mạnh nhất trong phạm vi này.");
    expect(model.primaryCostLabel).toBe("CPL");
    expect(model.breakdowns.platforms[0].name).toBe("Instagram");
    expect(model.breakdowns.ageGender[0].name).toBe("Nữ 25-34");
    expect(model.tableGuide.title).toBe("Cách đọc các bảng này");
    expect(model.tableGuide.items.join(" ")).toContain("Không cộng tổng giữa các bảng");
  });

  it("preserves Verdict evidence, comparison drivers, ranked Primary Result rows, and saved Custom Charts", () => {
    const current = report({
      campaignRows: [
        row({ id: "low", name: "High spend, low result", spend: 40_000_000, leads: 100, cpl: 400_000 }),
        row({ id: "high", name: "Primary Result driver", spend: 20_000_000, leads: 700, cpl: 28_571 }),
      ],
      dailyRows: [
        row({ id: "d1", level: "daily", name: "2026-06-25", date: "2026-06-25", spend: 3_000_000, leads: 40, cpl: 75_000 }),
        row({ id: "d2", level: "daily", name: "2026-06-26", date: "2026-06-26", spend: 3_200_000, leads: 44, cpl: 72_727 }),
      ],
    });
    const previous = report({
      campaignRows: current.campaignRows.map((item) => ({ ...item, leads: item.leads / 2, spend: item.spend / 2 })),
      adsetRows: current.adsetRows.map((item) => ({ ...item, leads: Math.max(1, item.leads / 2), spend: item.spend / 2 })),
    });
    const chart = presetToSpec(CHART_PRESETS[0], "en", "saved-chart");
    const model = buildClientReportViewModel({
      report: current,
      previousReport: previous,
      compareMode: "mom",
      language: "en",
      kpis,
      customCharts: [chart],
      verdict: verdict({ losers: ["Weak row"], assumptions: ["Tracking is validated externally."] }),
    });

    expect(model.topCampaigns[0].name).toBe("Primary Result driver");
    expect(model.verdict.confidence).toBe("high");
    expect(model.losers).toEqual(["Weak row"]);
    expect(model.assumptions).toEqual(["Tracking is validated externally."]);
    expect(model.comparison.status).not.toBe("off");
    expect(model.customCharts[0].id).toBe("saved-chart");
    expect(model.customCharts[0].data[0]).toMatchObject({ x: "25/6", leads: 40, cpl: 75000 });
  });

  it("keeps AI insights out of canonical Winner and Risk claims while disclosing their provider", () => {
    const model = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "en",
      kpis,
      verdict: verdict({ winners: [], risks: [], losers: [], assumptions: [] }),
      insights: {
        summary: "9router-generated recommendation summary.",
        rows: [{
          area: "Creative",
          insight: "Unsupported insight winner",
          evidence: "Unsupported insight risk evidence",
          action: "Test a new creative angle.",
          priority: "high",
          confidence: "medium",
        }],
        confidence: "medium",
        assumptions: [],
        provider: "9router",
      },
    });

    expect(model.wins.join(" ")).not.toContain("Unsupported insight winner");
    expect(model.risks.join(" ")).not.toContain("Unsupported insight risk evidence");
    expect(model.decisionProviderLabel).toBe("Local decision rules + 9router insights");
    expect(model.insightSummary).toBe("9router-generated recommendation summary.");
  });

  it("preserves diagnostic subjects, values, and details in printable evidence", () => {
    const model = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "en",
      kpis,
    });

    expect(model.diagnostics.find((diagnostic) => diagnostic.id === "healthTriage")?.evidence.join(" ")).toContain("CTR benchmark: CTR is above benchmark.");
    expect(model.diagnostics.find((diagnostic) => diagnostic.id === "resultConcentration")?.evidence.join(" ")).toContain("Testimonial ad");
    expect(model.diagnostics.find((diagnostic) => diagnostic.id === "creativeVolume")?.evidence.join(" ")).toContain("Unknown ad set");
    expect(model.diagnostics.find((diagnostic) => diagnostic.id === "budgetMove")?.title).toBe("Budget recommendation");
    expect(model.diagnostics.find((diagnostic) => diagnostic.id === "creativeStarvation")?.title).toBe("Creative distribution");
    expect([model.verdictText, ...model.diagnostics.flatMap((diagnostic) => [diagnostic.title, diagnostic.summary, ...diagnostic.evidence, diagnostic.nextStep])].join(" "))
      .not.toMatch(/ad-creative risks|active\/spent creatives|creative-volume constraint|downgraded rows?|Creative starvation| - Monitor - |Conv\/adset\/week|daily budget data available/i);
  });

  it("projects client-readable Vietnamese diagnostics without known internal English labels", () => {
    const model = buildClientReportViewModel({
      report: report({
        health: {
          score: 82,
          grade: "B",
          checks: [
            { id: "M-CR4", label: "CTR benchmark", status: "pass", detail: "CTR 1.40%. Pack benchmark pass >= 1%." },
            { id: "M-CR2", label: "Prospecting frequency", status: "pass", detail: "Average frequency 2.10." },
            { id: "M25", label: "Creative/ad volume proxy", status: "warning", detail: "8 ads found in selected scope. Target: 10+ diverse creatives where budget supports it." },
            { id: "M11", label: "Campaign consolidation", status: "pass", detail: "3 selected campaigns. Meta prefers fewer campaigns per goal." },
          ],
        },
      }),
      compareMode: "off",
      language: "vi",
      kpis,
      customCharts: [presetToSpec(CHART_PRESETS[0], "vi", "saved-chart")],
    });
    const diagnosticText = model.diagnostics.map((diagnostic) => [diagnostic.title, diagnostic.summary, ...diagnostic.evidence, diagnostic.nextStep].join(" ")).join(" ");

    expect(diagnosticText).not.toMatch(/Creative\/ad volume proxy|CTR benchmark|Prospecting frequency|Campaign consolidation|guardrail|delivery|learning phase|portfolio|dataset|hạ cấp|khám phá phân phối/i);
    expect(diagnosticText).not.toContain("thử nghiệmimonial");
    expect(diagnosticText).toContain("Testimonial ad");
    expect(diagnosticText).toContain("Mốc tham chiếu CTR");
    expect(diagnosticText).toContain("Số lượng mẫu quảng cáo");
    expect(model.customCharts[0].title).toBe("Lượng lead vs CPL");
    expect(model.customCharts[0].series[0].label).toBe("Khách hàng tiềm năng");
  });

  it("uses locale-consistent VND formatting, spend shares, and not-applicable cost cells", () => {
    const zeroResult = row({ id: "zero", name: "No result", spend: 2_000_000, leads: 0, cpl: 0 });
    const english = buildClientReportViewModel({
      report: report({ campaignRows: [zeroResult] }),
      compareMode: "off",
      language: "en",
      kpis,
    });
    const vietnamese = buildClientReportViewModel({
      report: report({ campaignRows: [zeroResult] }),
      compareMode: "off",
      language: "vi",
      kpis,
    });

    expect(english.tables[0].rows[0].cells.spend).toBe("2,000,000 VND");
    expect(vietnamese.tables[0].rows[0].cells.spend).toBe("2.000.000 VND");
    expect(english.tables[0].rows[0].cells.cpl).toBe("—");
    expect(english.breakdowns.platforms[0].spendShareLabel).toBe("100%");
    expect(english.tableGuide.items.join(" ")).toContain("not applicable");
  });

  it("structures each priority action around evidence and the next metric check", () => {
    const model = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "en",
      kpis,
      verdict: verdict(),
    });

    expect(model.actions.length).toBeGreaterThan(0);
    expect(model.actions.every((action) => action.why && action.monitor)).toBe(true);
    expect(model.actions[0].monitor).toContain("leads");
    expect(model.actions[0].monitor).toContain("CPL");
  });

  it("discloses sample data and explains a Selected KPI Pack override in the Interface Language", () => {
    const model = buildClientReportViewModel({
      report: report({ source: "sample", detectedPack: "lead_gen", selectedPack: "traffic" }),
      compareMode: "off",
      language: "vi",
      kpis,
    });

    expect(model.copy.source).toBe("Dữ liệu mẫu - không phải Meta API");
    expect(model.copy.footnoteSource).toContain("dữ liệu mẫu");
    expect(model.selectedPackReason).toContain("Được chọn thủ công");
    expect(model.selectedPackReason).toContain("Lưu lượng");
  });

  it.each([
    ["messages", "messages", "costPerMessage", ["Name", "Spend", "Messages", "Cost/message", "Reply rate"]],
    ["lead_gen", "leads", "cpl", ["Name", "Spend", "Leads", "CPL", "Lead/message"]],
    ["sales_roas", "purchases", "roas", ["Name", "Spend", "Purchases", "ROAS", "CPA"]],
    ["traffic", "linkClicks", "cpc", ["Name", "Spend", "Link clicks", "CPC", "CTR"]],
    ["awareness", "reach", "cpm", ["Name", "Spend", "Reach", "CPM", "Frequency"]],
  ] as Array<[KpiPack, keyof NormalizedRow, keyof NormalizedRow, string[]]>) (
    "builds a pack-aware performance story for %s",
    (pack, volumeKey, efficiencyKey, expectedColumns) => {
      const strong = row({ id: "strong", name: "Strong contribution", spend: 2_000_000, [volumeKey]: 80, [efficiencyKey]: 2 });
      const weak = row({ id: "weak", name: "Weak contribution", spend: 4_000_000, [volumeKey]: 20, [efficiencyKey]: 8 });
      const model = buildClientReportViewModel({
        report: report({
          selectedPack: pack,
          detectedPack: pack,
          totals: row({ id: "total", level: "account", name: "Total", spend: 6_000_000, [volumeKey]: 100, [efficiencyKey]: 4 }),
          campaignRows: [weak, strong],
          adsetRows: [weak, strong],
        }),
        compareMode: "off",
        language: "en",
        kpis,
      });

      expect(model.primaryResultKey).toBe(primaryResultSpec(pack).volumeKey);
      expect(model.topCampaigns[0].name).toBe("Strong contribution");
      expect(model.dailyTrend.every((point) => "efficiency" in point)).toBe(true);
      expect(model.tables[0].columns.map((column) => column.label)).toEqual(expectedColumns);
      if (pack === "awareness") expect(model.budgetMove.status).toBe("hold");
    },
  );

  it("builds a downloadable PDF report file", async () => {
    const model = buildClientReportViewModel({
      report: report(),
      compareMode: "off",
      language: "en",
      kpis,
      verdict: verdict(),
    });

    const pdf = await buildClientReportPdf(model, fonts);
    const bytes = new Uint8Array(await pdf.blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);

    expect(pdf.filename).toBe("seoul-beauty-clinic-meta-ads-report-2026-06-01-to-2026-06-26.pdf");
    expect(pdf.blob.type).toBe("application/pdf");
    expect(String.fromCharCode(...bytes.slice(0, 8))).toBe("%PDF-1.3");
    expect(text).toContain("Geist");
    expect(text).toContain("/ToUnicode");
    expect(text).not.toContain("/Subtype /Image");
    expect(text).toContain("%%EOF");
  });

  it("downloads the generated PDF without opening browser print", () => {
    const pdf = new Blob(["%PDF-1.3\n%%EOF"], { type: "application/pdf" });
    const link = { href: "", download: "", click: vi.fn() };
    const runtime = {
      createObjectUrl: vi.fn(() => "blob:report-pdf"),
      revokeObjectUrl: vi.fn(),
      createLink: vi.fn(() => link),
    };

    downloadClientReportPdf({ filename: "report.pdf", blob: pdf }, runtime);

    expect(runtime.createObjectUrl).toHaveBeenCalledWith(pdf);
    expect(link.href).toBe("blob:report-pdf");
    expect(link.download).toBe("report.pdf");
    expect(link.click).toHaveBeenCalledOnce();
    expect(runtime.revokeObjectUrl).toHaveBeenCalledWith("blob:report-pdf");
  });
});
