import { afterEach, describe, expect, it, vi } from "vitest";
import { generateInsights } from "../ai";

const insightResponse = {
  summary: "Gemini generated the insight brief.",
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

  it("routes AI insight brief to Gemini and falls back from unsupported Gemini 3.1 Flash env model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.1-flash");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(insightResponse) }] } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const insights = await generateInsights("x".repeat(120), "gemini");

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/models/gemini-2.5-flash:generateContent");
    expect(insights.provider).toBe("gemini");
    expect(insights.summary).toBe(insightResponse.summary);
  });
});
