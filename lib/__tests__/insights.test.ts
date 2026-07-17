import { afterEach, describe, expect, it, vi } from "vitest";
import { generateInsights } from "../ai";

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

function promptWith(payload: Record<string, unknown>) {
  return `Some instructions\n\nInput JSON:\n${JSON.stringify(payload)}`;
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

    const insights = await generateInsights("x".repeat(120), "9router");

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

    const insights = await generateInsights("x".repeat(120), "9router");

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://rx5e3m7.abc-tunnel.us/v1/chat/completions");
    expect(insights.provider).toBe("9router");
  });

  it("falls back to local metric insights when 9router returns invalid JSON or is missing summary", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn().mockImplementation(invalidJsonResponse);
    vi.stubGlobal("fetch", fetchSpy);

    const promptPayload = `Some instructions\n\nInput JSON:\n${JSON.stringify({
      totals: { spend: 100, ctr: 0.5, frequency: 1.2 },
      health: { score: 85, checks: [] }
    })}`;
    const insights = await generateInsights(promptPayload, "9router");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(insights.provider).toBe("prompt");
    expect(insights.summary).toContain("unavailable");
    expect(insights.rows.length).toBeGreaterThan(0);
    expect(insights.rows[0].area).toBe("Creative"); // CTR low row triggered
  });

  it("surfaces a failing health check as the first high-priority local insight row", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights(
      promptWith({
        totals: { spend: 100, ctr: 2.5, frequency: 1.2 },
        health: { score: 55, checks: [{ label: "Pixel coverage", detail: "Pixel missing on 2 pages.", status: "fail" }] },
      }),
      "9router",
    );

    const healthRow = insights.rows.find((row) => row.area === "Account health");
    expect(healthRow).toBeDefined();
    expect(healthRow?.insight).toBe("Pixel coverage");
    expect(healthRow?.priority).toBe("high");
  });

  it("reads failing items and the canonical score from the health-summary payload", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights(
      promptWith({
        totals: { spend: 100, ctr: 2.5, frequency: 1.2 },
        health: {
          score: 73,
          grade: "C",
          items: [{
            title: { en: "Funnel drop", vi: "Rớt phễu" },
            detail: { en: "Conversion fell.", vi: "Chuyển đổi giảm." },
            severity: "danger",
          }],
        },
      }),
      "9router",
    );

    const healthRow = insights.rows.find((row) => row.area === "Account health");
    expect(healthRow?.insight).toBe("Funnel drop");
    expect(healthRow?.evidence).toBe("Conversion fell.");
  });

  it("flags high frequency as an audience-fatigue row with high priority above 5", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights(
      promptWith({ totals: { spend: 100, ctr: 2.5, frequency: 6 }, health: { score: 90, checks: [] } }),
      "9router",
    );

    const audienceRow = insights.rows.find((row) => row.area === "Audience");
    expect(audienceRow).toBeDefined();
    expect(audienceRow?.priority).toBe("high");
  });

  it("names the top campaign as the first budget-review target", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights(
      promptWith({
        totals: { spend: 100, ctr: 2.5, frequency: 1.2 },
        health: { score: 90, checks: [] },
        top_campaigns: [{ name: "Prospecting Core", spend: 80, messages: 12, leads: 0, purchases: 0 }],
      }),
      "9router",
    );

    const budgetRow = insights.rows.find((row) => row.area === "Budget");
    expect(budgetRow).toBeDefined();
    expect(budgetRow?.insight).toContain("Prospecting Core");
  });

  it("highlights the biggest comparison delta as a high-priority efficiency row when it moves at least 20%", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights(
      promptWith({
        totals: { spend: 100, ctr: 2.5, frequency: 1.2 },
        health: { score: 90, checks: [] },
        comparison: { deltas: [{ key: "cpl", change_pct: 45 }, { key: "spend", change_pct: 5 }] },
      }),
      "9router",
    );

    const efficiencyRow = insights.rows.find((row) => row.area === "Efficiency" && row.insight.includes("cpl"));
    expect(efficiencyRow).toBeDefined();
    expect(efficiencyRow?.priority).toBe("high");
  });

  it("returns a single no-red-flag efficiency row when no metric breaches a threshold", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(invalidJsonResponse()));

    const insights = await generateInsights(
      promptWith({ totals: { spend: 100, ctr: 2.5, frequency: 1.2, messages: 20 }, health: { score: 95, checks: [] } }),
      "9router",
    );

    expect(insights.rows).toHaveLength(1);
    expect(insights.rows[0].area).toBe("Efficiency");
    expect(insights.rows[0].insight).toContain("No major red flag");
  });
});
