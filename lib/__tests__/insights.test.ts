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
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "not json at all" } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const promptPayload = `Some instructions\n\nInput JSON:\n${JSON.stringify({
      totals: { spend: 100, ctr: 0.5, frequency: 1.2 },
      health: { score: 85, checks: [] }
    })}`;
    const insights = await generateInsights(promptPayload, "9router");

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(insights.provider).toBe("prompt");
    expect(insights.summary).toContain("unavailable");
    expect(insights.rows.length).toBeGreaterThan(0);
    expect(insights.rows[0].area).toBe("Creative"); // CTR low row triggered
  });
});
