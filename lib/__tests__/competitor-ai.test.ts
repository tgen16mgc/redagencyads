import { describe, expect, it, vi, afterEach } from "vitest";
import { generateCompetitorSpy } from "../ai";
import { buildCompetitorSpyPrompt } from "../metrics";

describe("generateCompetitorSpy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a usable local competitor brief when no AI provider key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");

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
});
