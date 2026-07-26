import { afterEach, describe, expect, it, vi } from "vitest";
import { generateInsights } from "../ai/insights";
import type { DashboardReport, NormalizedRow } from "../types";

const insightResponse = {
  summary: "9router generated the insight brief.",
  rows: [
    {
      area: "Messages",
      insight: "Reply cost improved.",
      evidence: "Cost per reply fell.",
      action: "Scale the best ad set carefully.",
      priority: "high",
      confidence: "medium",
    },
  ],
  confidence: "medium",
  assumptions: ["Gemini generated JSON."],
};

function invalidJsonResponse() {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function totals(overrides: Partial<NormalizedRow>): NormalizedRow {
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

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  return {
    account: { id: "act", name: "Account", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-14" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "test",
    kpis: [],
    totals: totals({ spend: 100, ctr: 2.5, frequency: 1.2 }),
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    regionRows: [],
    health: { score: 90, grade: "A", checks: [] },
    prompt: "",
    pulledAt: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("generateInsights", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("routes AI insight brief through 9router", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubEnv("NINEROUTER_URL", "http://localhost:20128");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(insightResponse) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const insights = await generateInsights({ report: report(), compareMode: "off", provider: "9router" });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toBe("http://localhost:20128/v1/chat/completions");
    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({ authorization: "Bearer test-key" });
    expect(insights.provider).toBe("9router");
    expect(insights.summary).toBe(insightResponse.summary);
  });

  it("does not duplicate the v1 path when the 9router tunnel URL already includes it", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubEnv("NINEROUTER_URL", "https://rx5e3m7.abc-tunnel.us/v1");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(insightResponse) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const insights = await generateInsights({ report: report(), compareMode: "off", provider: "9router" });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://rx5e3m7.abc-tunnel.us/v1/chat/completions");
    expect(insights.provider).toBe("9router");
  });

  it("sends the structured report as prompt input with the Vietnamese language requirement", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(insightResponse) } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await generateInsights({ report: report(), compareMode: "off", language: "vi", provider: "9router" });

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    const prompt = String(body.messages[0].content);
    expect(prompt).toContain('"account": "Account"');
    expect(prompt).toContain("Language requirement:");
    expect(prompt).toContain("Use Vietnamese for all user-facing values.");
  });

  it("never fetches for the prompt provider", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const insights = await generateInsights({ report: report(), compareMode: "off", provider: "prompt" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(insights.provider).toBe("prompt");
    expect(insights.rows[0].area).toBe("Setup");
  });

  it("falls back to local metric insights when 9router returns invalid JSON or is missing summary", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn().mockImplementation(invalidJsonResponse);
    vi.stubGlobal("fetch", fetchSpy);

    const insights = await generateInsights({
      report: report({
        totals: totals({ spend: 100, ctr: 0.5, frequency: 1.2 }),
        health: { score: 85, grade: "B", checks: [] },
      }),
      compareMode: "off",
      provider: "9router",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(insights.provider).toBe("prompt");
    expect(insights.summary).toContain("unavailable");
    expect(insights.rows.length).toBeGreaterThan(0);
    expect(insights.rows[0].area).toBe("Creative"); // CTR low row triggered
  });

  it("surfaces a failing health check as the first high-priority local insight row", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights({
      report: report({
        health: { score: 55, grade: "D", checks: [{ id: "pixel", label: "Pixel coverage", status: "fail", detail: "Pixel missing on 2 pages." }] },
      }),
      compareMode: "off",
      provider: "9router",
    });

    const healthRow = insights.rows.find((row) => row.area === "Account health");
    expect(healthRow).toBeDefined();
    expect(healthRow?.insight).toBe("Pixel coverage");
    expect(healthRow?.evidence).toBe("Pixel missing on 2 pages.");
    expect(healthRow?.priority).toBe("high");
  });

  it("reports the canonical health-summary score when a failing check has no detail", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights({
      report: report({
        health: { score: 91, grade: "A", checks: [{ id: "funnel", label: "Funnel drop", status: "fail", detail: "" }] },
      }),
      compareMode: "off",
      provider: "9router",
    });

    const healthRow = insights.rows.find((row) => row.area === "Account health");
    expect(healthRow?.insight).toBe("Funnel drop");
    expect(healthRow?.evidence).toBe("Health score 79/100.");
  });

  it("flags high frequency as an audience-fatigue row with high priority above 5", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights({
      report: report({ totals: totals({ spend: 100, ctr: 2.5, frequency: 6 }) }),
      compareMode: "off",
      provider: "9router",
    });

    const audienceRow = insights.rows.find((row) => row.area === "Audience");
    expect(audienceRow).toBeDefined();
    expect(audienceRow?.priority).toBe("high");
  });

  it("names the top campaign as the first budget-review target", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights({
      report: report({
        campaignRows: [totals({ id: "campaign-1", name: "Prospecting Core", spend: 80, messages: 12 })],
      }),
      compareMode: "off",
      provider: "9router",
    });

    const budgetRow = insights.rows.find((row) => row.area === "Budget");
    expect(budgetRow).toBeDefined();
    expect(budgetRow?.insight).toContain("Prospecting Core");
  });

  it("highlights the biggest comparison delta as a high-priority efficiency row when it moves at least 20%", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights({
      report: report({ totals: totals({ spend: 100, ctr: 2.5, frequency: 1.2, cpl: 145 }) }),
      previousReport: report({
        dateRange: { since: "2026-05-18", until: "2026-05-31" },
        totals: totals({ spend: 100, ctr: 2.5, frequency: 1.2, cpl: 100 }),
      }),
      compareMode: "wow",
      provider: "9router",
    });

    const efficiencyRow = insights.rows.find((row) => row.area === "Efficiency" && row.insight.includes("cpl"));
    expect(efficiencyRow).toBeDefined();
    expect(efficiencyRow?.priority).toBe("high");
  });

  it("returns a single no-red-flag efficiency row when no metric breaches a threshold", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights({
      report: report({
        totals: totals({ spend: 100, ctr: 2.5, frequency: 1.2, messages: 20 }),
        health: { score: 95, grade: "A", checks: [] },
      }),
      compareMode: "off",
      provider: "9router",
    });

    expect(insights.rows).toHaveLength(1);
    expect(insights.rows[0].area).toBe("Efficiency");
    expect(insights.rows[0].insight).toContain("No major red flag");
  });
});
