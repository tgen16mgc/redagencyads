import { afterEach, describe, expect, it, vi } from "vitest";

const { recordAutomaticDecisionWorkspaceAcceptanceEvidence } = vi.hoisted(
  () => ({ recordAutomaticDecisionWorkspaceAcceptanceEvidence: vi.fn() }),
);
vi.mock("@/lib/decision-workspace-acceptance", () => ({
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
}));
import { POST } from "./route";

async function analyze(body: unknown) {
  return POST(new Request("http://localhost/api/creatives/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

describe("POST /api/creatives/analyze", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  it("ranks element-level CTR and CVR lift against an untagged baseline", async () => {
    const response = await analyze({ analysis: "element_correlation", samples: [
      { tags: ["face", "product"], impressions: 1000, clicks: 100, conversions: 20 },
      { tags: ["product"], impressions: 1000, clicks: 80, conversions: 12 },
      { tags: [], impressions: 1000, clicks: 40, conversions: 5 },
    ] });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.find((item: { tag: string }) => item.tag === "face")).toMatchObject({ sampleSize: 1, ctr: 0.1, cvr: 0.02 });
    expect(body.result.find((item: { tag: string }) => item.tag === "product").cvrLift).toBeGreaterThan(1);
  });

  it("groups audio classifications and orders the strongest conversion pattern first", async () => {
    const response = await analyze({ analysis: "audio_correlation", samples: [
      { classification: { mood: "energetic", tempo: "fast", mode: "voiceover", speechRatio: 0.8 }, impressions: 1000, clicks: 100, conversions: 30 },
      { classification: { mood: "energetic", tempo: "fast", mode: "voiceover", speechRatio: 0.7 }, impressions: 500, clicks: 40, conversions: 10 },
      { classification: { mood: "calm", tempo: "slow", mode: "music_only", speechRatio: 0 }, impressions: 1000, clicks: 50, conversions: 5 },
    ] });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result[0]).toMatchObject({ classification: "energetic:fast:voiceover", sampleSize: 2 });
    expect(body.result[0].cvr).toBeGreaterThan(body.result[1].cvr);
  });

  it("returns copy contribution and hook drop-off results", async () => {
    const copyResponse = await analyze({ analysis: "copy", variants: [
      { id: "a", headline: "A", impressions: 1000, clicks: 80, conversions: 20 },
      { id: "b", headline: "B", impressions: 1000, clicks: 30, conversions: 5 },
    ] });
    expect((await copyResponse.json()).result[0].id).toBe("a");
    const hookResponse = await analyze({ analysis: "hook", curve: [{ second: 0, retention: 1 }, { second: 1, retention: 0.8 }, { second: 3, retention: 0.55 }, { second: 5, retention: 0.4 }] });
    const hook = (await hookResponse.json()).result;
    expect(hook).toMatchObject({ hookRetention: 0.55, biggestDropFrame: 3 });
    expect(hook.firstThreeSecondDrop).toBeCloseTo(0.45);
  });

  it("labels deterministic element and audio fallbacks when no inference provider is configured", async () => {
    delete process.env.CREATIVE_INFERENCE_URL;
    const elements = await analyze({ analysis: "elements", transcript: "Show the product and shop now", hasFace: true });
    const elementBody = await elements.json();
    expect(elementBody).toMatchObject({ source: "heuristic", model: "clip" });
    expect(elementBody.result).toEqual(expect.arrayContaining(["face", "product", "cta"]));
    const audio = await analyze({ analysis: "audio", bpm: 130, speechRatio: 0.7 });
    expect(await audio.json()).toMatchObject({ source: "heuristic", result: { mood: "energetic", mode: "voiceover" } });
  });

  it("records automatic acceptance evidence after provider-backed inference", async () => {
    vi.stubEnv("CREATIVE_INFERENCE_URL", "https://inference.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ tags: ["face", "product", "cta"] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    recordAutomaticDecisionWorkspaceAcceptanceEvidence.mockResolvedValue({
      recorded: true,
      reason: "recorded",
    });

    const response = await analyze({
      analysis: "elements",
      transcript: "Show the product and shop now",
    });

    expect(await response.json()).toMatchObject({ source: "provider" });
    expect(recordAutomaticDecisionWorkspaceAcceptanceEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        requirementId: "T3.3.2",
        acceptanceMet: true,
      }),
    );
  });
});
