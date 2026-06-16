import { describe, expect, it, vi, afterEach } from "vitest";
import { generateCompetitorSpy } from "../ai";
import { buildCompetitorSpyPrompt } from "../metrics";

function nineRouterResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const spyPayload = {
  summary: "9router synthesized the competitor brief.",
  competitors: [{ name: "Seoul Spa", likely_positioning: "Premium clinic", observed_or_expected_patterns: ["UGC"], gap: "No proof" }],
  themes: [{ theme: "Proof-led", evidence: "UGC ads", opportunity: "Original test", confidence: "medium" }],
  creative_gaps: ["Benchmark hooks"],
  test_briefs: [{ angle: "Proof", hook: "Show result", format: "UGC", why: "Distinct offer", guardrail: "Hold until baseline beaten" }],
  next_actions: ["Open Ad Library"],
  assumptions: ["9router generated JSON."],
};

describe("generateCompetitorSpy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns a usable local competitor brief when no AI provider key is configured", async () => {
    vi.stubEnv("NINEROUTER_KEY", "");

    const prompt = buildCompetitorSpyPrompt({
      competitors: ["Seoul Spa"],
      market: "premium beauty clinic",
      platform: "meta",
      notes: "Seoul Spa pushes UGC-style videos, Send Message CTA, consultation offer, before/after proof.",
      extractedAds: [
        {
          id: "ad-1",
          source: "public",
          competitorName: "Seoul Spa",
          pageName: "Seoul Spa",
          platform: "Meta / Instagram",
          headline: "Open Meta Ad Library search",
          description: "Review active ads and offers.",
          snapshotUrl: "https://www.facebook.com/ads/library/?q=Seoul%20Spa",
        },
      ],
    });

    const result = await generateCompetitorSpy(prompt, "auto");

    expect(result.provider).toBe("prompt");
    expect(result.summary).not.toContain("Copy the competitor prompt");
    expect(result.competitors[0]?.name).toBe("Seoul Spa");
    expect(result.themes.length).toBeGreaterThan(0);
    expect(result.test_briefs.length).toBeGreaterThan(0);
    expect(result.next_actions.join(" ")).toContain("Open Meta Ad Library");
  });

  it("recovers competitor JSON wrapped in a code fence and prose from 9router", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const wrapped = `Here is the competitor brief:\n\`\`\`json\n${JSON.stringify(spyPayload)}\n\`\`\`\nLet me know if you need more.`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(nineRouterResponse(wrapped)));

    const result = await generateCompetitorSpy("x".repeat(120), "9router");

    expect(result.provider).toBe("9router");
    expect(result.summary).toBe(spyPayload.summary);
    expect(result.competitors[0]?.name).toBe("Seoul Spa");
  });

  it("reports non-JSON 9router output instead of throwing", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(nineRouterResponse("no json here at all")));

    const result = await generateCompetitorSpy("x".repeat(120), "9router");

    expect(result.provider).toBe("9router");
    expect(result.summary).toBe("Model returned non-JSON output.");
    expect(result.competitors).toEqual([]);
  });

  it("falls back to prompt-only output when 9router returns an empty response", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(nineRouterResponse("")));

    const prompt = buildCompetitorSpyPrompt({
      competitors: ["Seoul Spa"],
      market: "premium beauty clinic",
      platform: "meta",
      notes: "",
      extractedAds: [],
    });
    const result = await generateCompetitorSpy(prompt, "9router");

    expect(result.provider).toBe("prompt");
    expect(result.competitors[0]?.name).toBe("Seoul Spa");
  });
});
