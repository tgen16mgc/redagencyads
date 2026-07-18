import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as verdictPOST } from "../../app/api/ai/verdict/route";
import { generateVerdict } from "../ai";
import { buildLocalVerdict } from "../verdict-rules";
import type { DashboardReport, NormalizedRow } from "../types";

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

function report(overrides: Partial<DashboardReport> = {}): DashboardReport {
  const winner = row({
    id: "winner",
    name: "Message Winner",
    spend: 60,
    impressions: 6000,
    reach: 4200,
    frequency: 1.4,
    clicks: 180,
    linkClicks: 120,
    ctr: 3,
    cpc: 0.33,
    cpm: 10,
    messages: 12,
    costPerMessage: 5,
  });
  const loser = row({
    id: "loser",
    name: "Message Loser",
    spend: 40,
    impressions: 5000,
    reach: 2500,
    frequency: 4.2,
    clicks: 25,
    linkClicks: 12,
    ctr: 0.5,
    cpc: 1.6,
    cpm: 8,
    messages: 1,
    costPerMessage: 40,
  });
  return {
    account: { id: "act_1", name: "Test Account", currency: "USD" },
    selectedCampaigns: [{ id: "campaign_1", name: "Messages Campaign", objective: "OUTCOME_ENGAGEMENT" }],
    dateRange: { since: "2026-05-01", until: "2026-05-31" },
    detectedPack: "messages",
    selectedPack: "messages",
    packReason: "Messages detected.",
    kpis: [],
    totals: row({
      id: "total",
      level: "account",
      name: "Account total",
      spend: 100,
      impressions: 11000,
      reach: 6700,
      frequency: 2.8,
      clicks: 205,
      linkClicks: 132,
      ctr: 1.86,
      cpc: 0.49,
      cpm: 9.09,
      messages: 13,
      costPerMessage: 7.69,
    }),
    campaignRows: [winner, loser],
    adsetRows: [winner, loser],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    regionRows: [],
    health: {
      score: 68,
      grade: "C",
      checks: [
        { id: "M-CR4", label: "CTR benchmark", status: "pass", detail: "CTR 1.86%. Meta benchmark pass >= 1.0%." },
        { id: "M-CR2", label: "Prospecting frequency", status: "warning", detail: "Average frequency 2.80." },
        { id: "M25", label: "Creative/ad volume proxy", status: "fail", detail: "2 ads found in selected scope." },
      ],
    },
    prompt: "prompt",
    pulledAt: "2026-06-04T00:00:00.000Z",
    ...overrides,
  };
}

function noSpendReport() {
  return report({
    totals: row({ id: "total", level: "account", name: "Account total" }),
    campaignRows: [row({ id: "new", name: "New Campaign" })],
    adsetRows: [row({ id: "new-adset", name: "New Ad Set" })],
    health: {
      score: 20,
      grade: "F",
      checks: [{ id: "M25", label: "Creative/ad volume proxy", status: "fail", detail: "0 ads found." }],
    },
  });
}

describe("buildLocalVerdict", () => {
  it("ignores rows below 1% of account spend for winner and loser claims", () => {
    const tinyWinner = row({
      id: "tiny-winner",
      name: "Tiny Winner",
      spend: 0.5,
      messages: 10,
      costPerMessage: 0.05,
    });
    const steadyRow = row({
      id: "steady-row",
      name: "Steady Row",
      spend: 99.5,
      messages: 10,
      costPerMessage: 9.95,
    });
    const verdict = buildLocalVerdict(
      report({
        totals: row({ id: "total", level: "account", name: "Account total", spend: 100, messages: 20, costPerMessage: 5 }),
        campaignRows: [tinyWinner, steadyRow],
        adsetRows: [tinyWinner, steadyRow],
      }),
      "en",
    );

    expect(verdict.winners.join(" ")).not.toContain("Tiny Winner");
    expect(verdict.losers.join(" ")).not.toContain("Tiny Winner");
  });

  it("keeps Budget Moves within the Meta learning-stability cap", () => {
    const verdict = buildLocalVerdict(report(), "en");

    expect(verdict.budget_moves.join(" ")).toContain("20%");
    expect(verdict.budget_moves.join(" ")).not.toMatch(/(?:[2-9][1-9]|[1-9]\d{2,})%/);
  });

  it("uses the Selected KPI Pack as the Primary Result lens", () => {
    const verdict = buildLocalVerdict(
      report({
        selectedPack: "sales_roas",
        totals: row({ id: "total", level: "account", name: "Account total", spend: 100, messages: 13, purchases: 0 }),
      }),
      "en",
    );

    expect(verdict.risks.join(" ")).toContain("sales_roas: 0 purchases");
    expect(verdict.assumptions.join(" ")).toContain("Budget Moves use the selected KPI pack");
  });

  it("returns Vietnamese local Verdict strings without provider calls", () => {
    const verdict = buildLocalVerdict(report(), "vi");

    expect(verdict.provider).toBe("prompt");
    expect(verdict.verdict).toContain("Tài khoản Test Account");
    expect(verdict.assumptions.join(" ")).toContain("không gọi nhà cung cấp AI");
  });

  it("never emits winners, losers, or scaling moves for the non-scalable awareness pack", () => {
    const verdict = buildLocalVerdict(report({ selectedPack: "awareness" }), "en");

    expect(verdict.winners).toHaveLength(0);
    expect(verdict.losers).toHaveLength(0);
    expect(verdict.budget_moves.join(" ")).toContain("Hold budget");
    expect(verdict.budget_moves.join(" ")).not.toMatch(/increas/i);
  });

  it("ranks the traffic pack on CPC against link clicks", () => {
    const verdict = buildLocalVerdict(report({ selectedPack: "traffic" }), "en");

    expect(verdict.winners.join(" ")).toContain("Message Winner");
    expect(verdict.winners.join(" ")).toContain("link clicks");
    expect(verdict.winners.join(" ")).toContain("CPC");
    expect(verdict.losers.join(" ")).toContain("Message Loser");
  });

  it("only reports high confidence when spend, primary results, a winner/loser, and health checks all exist", () => {
    expect(buildLocalVerdict(report(), "en").confidence).toBe("high");
    expect(buildLocalVerdict(noSpendReport(), "en").confidence).toBe("low");
  });
});

describe("generateVerdict", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns a complete local Verdict from structured report in prompt mode without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await generateVerdict({ report: report(), language: "en", provider: "prompt" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(verdict.provider).toBe("prompt");
    expect(verdict.verdict).toContain("Test Account");
    expect(verdict.winners.length).toBeGreaterThan(0);
    expect(verdict.risks.length).toBeGreaterThan(0);
    expect(verdict.budget_moves.length).toBeGreaterThan(0);
    expect(verdict.tests.length).toBeGreaterThan(0);
    expect(["medium", "high"]).toContain(verdict.confidence);
  });

  it("returns a low-confidence setup Verdict when no meaningful spend exists", async () => {
    const verdict = await generateVerdict({ report: noSpendReport(), language: "en", provider: "prompt" });

    expect(verdict.confidence).toBe("low");
    expect(verdict.winners).toHaveLength(0);
    expect(verdict.losers).toHaveLength(0);
    expect(verdict.risks.join(" ")).toContain("Insufficient spend");
    expect(verdict.budget_moves.join(" ")).toContain("Hold budget");
    expect(verdict.tests.length).toBeGreaterThan(0);
  });

  it("falls back to local Verdict when explicit 9router fails", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "provider overloaded" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await generateVerdict({ report: report(), language: "en", provider: "9router" });

    expect(fetchSpy).toHaveBeenCalled();
    expect(verdict.provider).toBe("prompt");
    expect(verdict.winners.length).toBeGreaterThan(0);
    expect(verdict.assumptions.join(" ")).toContain("AI enhancement failed");
  });

  it("enhances a structured Verdict with 9router in auto mode when 9router credentials exist", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubEnv("NINEROUTER_URL", "http://localhost:20128");
    const enhanced = {
      verdict: "9router refined the local Verdict wording.",
      risks: ["Validate tracking before scaling."],
      winners: ["Message Winner is the strongest budget candidate."],
      losers: ["Message Loser should stay capped."],
      budget_moves: ["Increase Message Winner by up to 20% after quality checks."],
      tests: ["Run a tracking-quality check before scaling."],
      confidence: "high",
      assumptions: ["9router only enhanced the local Verdict wording."],
    };
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(enhanced) } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await generateVerdict({ report: report(), language: "en", provider: "auto" });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toBe("http://localhost:20128/v1/chat/completions");
    expect(verdict.provider).toBe("9router");
    expect(verdict.verdict).toBe(enhanced.verdict);
  });

  it("does not call legacy providers in auto mode", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await generateVerdict({ report: report(), language: "en", provider: "auto" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(verdict.provider).toBe("prompt");
    expect(verdict.assumptions.join(" ")).toContain("AI provider credentials missing");
  });

  it("enhances a structured Verdict with 9router when explicitly selected", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const enhanced = {
      verdict: "9router refined the local Verdict wording.",
      risks: ["Validate tracking before scaling."],
      winners: ["Message Winner is the strongest budget candidate."],
      losers: ["Message Loser should stay capped."],
      budget_moves: ["Increase Message Winner by up to 20% after quality checks."],
      tests: ["Run a tracking-quality check before scaling."],
      confidence: "high",
      assumptions: ["9router only enhanced the local Verdict wording."],
    };
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(enhanced) } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await generateVerdict({ report: report(), language: "en", provider: "9router" });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toBe("http://localhost:20128/v1/chat/completions");
    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({ authorization: "Bearer test-key" });
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(requestBody.response_format).toMatchObject({ type: "json_object" });
    expect(JSON.stringify(requestBody.messages)).toContain('\\"score\\": 50');
    expect(JSON.stringify(requestBody.messages)).toContain('\\"grade\\": \\"D\\"');
    expect(JSON.stringify(requestBody.messages)).not.toContain('\\"score\\": 68');
    expect(verdict.provider).toBe("9router");
    expect(verdict.verdict).toBe(enhanced.verdict);
    expect(verdict.budget_moves).toEqual(enhanced.budget_moves);
  });

  it("falls back to local Verdict when explicit 9router is missing an API key", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await generateVerdict({ report: report(), language: "en", provider: "9router" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(verdict.provider).toBe("prompt");
    expect(verdict.winners.length).toBeGreaterThan(0);
    expect(verdict.assumptions.join(" ")).toContain("AI provider credentials missing");
  });

  it("does not let 9router raise confidence above the local Verdict", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const enhanced = {
      verdict: "9router polished a setup-only Verdict.",
      risks: ["No meaningful spend exists yet."],
      winners: [],
      losers: [],
      budget_moves: ["Hold budget until spend and primary-result signal are strong enough."],
      tests: ["Run a tracking-quality check before scaling."],
      confidence: "high",
      assumptions: ["9router only enhanced the local Verdict wording."],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(enhanced) } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const verdict = await generateVerdict({ report: noSpendReport(), language: "en", provider: "9router" });

    expect(verdict.provider).toBe("9router");
    expect(verdict.confidence).toBe("low");
  });

  it("keeps deterministic local Verdict fields when 9router only returns improved summary wording", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ verdict: "9router made the Verdict easier to present to the client." }) } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await generateVerdict({ report: report(), language: "en", provider: "9router" });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(verdict.provider).toBe("9router");
    expect(verdict.verdict).toBe("9router made the Verdict easier to present to the client.");
    expect(verdict.winners.length).toBeGreaterThan(0);
    expect(verdict.losers.length).toBeGreaterThan(0);
    expect(verdict.budget_moves.join(" ")).toContain("20%");
    expect(verdict.assumptions.join(" ")).toContain("AI-enhanced wording");
  });

  it("falls back to local Verdict when 9router returns invalid JSON", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn().mockImplementation(() => (
      new Response(
        JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    ));
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await generateVerdict({ report: report(), language: "en", provider: "9router" });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(verdict.provider).toBe("prompt");
    expect(verdict.winners.length).toBeGreaterThan(0);
    expect(verdict.assumptions.join(" ")).toContain("AI enhancement failed");
  });

  it("returns Vietnamese local Verdict strings when language is vi", async () => {
    const verdict = await generateVerdict({ report: report(), language: "vi", provider: "prompt" });

    expect(verdict.verdict).toContain("Tài khoản Test Account");
    expect(verdict.assumptions.join(" ")).toContain("không gọi nhà cung cấp AI");
    expect(verdict.budget_moves.join(" ")).toContain("tối đa 20%");
  });

  it("accepts structured report input through the Verdict route", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await verdictPOST(
      new Request("http://localhost/api/ai/verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report: report(), language: "vi", provider: "prompt" }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(json.verdict.provider).toBe("prompt");
    expect(json.verdict.verdict).toContain("Tài khoản Test Account");
  });

  it("rejects legacy Gemini provider through the Verdict route", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await verdictPOST(
      new Request("http://localhost/api/ai/verdict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report: report(), language: "en", provider: "gemini" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
