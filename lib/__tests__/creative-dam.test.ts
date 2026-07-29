import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { addCreativeAssetVersion, analyzeHookRetention, classifyAudio, clusterCreativeConcepts, copyVariantContribution, createCreativeAsset, detectSevenDayFatigue, generateCreativeDerivatives, inferAudioClassification, inferCreativeElements, listCreativeAssets, publicCreativeAsset, rankCreativeClustersWithEmbeddings, readCreativeAssetMedia, tagCreativeElements, updateCreativeAsset } from "@/lib/creative-dam";

let directory = "";
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); delete process.env.CREATIVE_ASSET_STORAGE_DIR; delete process.env.CREATIVE_INFERENCE_URL; delete process.env.CREATIVE_INFERENCE_API_KEY; vi.unstubAllGlobals(); directory = ""; });

describe("creative DAM and intelligence", () => {
  it("stores immutable assets and creates all image derivatives", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "creative-dam-"));
    process.env.CREATIVE_ASSET_STORAGE_DIR = directory;
    const buffer = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#ff0000" } }).png().toBuffer();
    const asset = await createCreativeAsset({ buffer, fileName: "creative.png", mimeType: "image/png", concept: "UGC testimonial", tags: ["ugc", "proof"] });
    expect((await createCreativeAsset({ buffer, fileName: "duplicate.png", mimeType: "image/png" })).id).toBe(asset.id);
    const derived = await generateCreativeDerivatives(asset.id, { caption: "Proof first" });
    expect(derived.derivatives.filter((item) => item.status === "ready")).toHaveLength(4);
    const versioned = await addCreativeAssetVersion(asset.id, { buffer: await sharp(buffer).resize(180, 180).png().toBuffer(), fileName: "creative-v2.png", mimeType: "image/png" });
    expect(versioned.versions).toHaveLength(2);
    expect(versioned.derivatives).toHaveLength(0);
    expect(versioned.creativeId).toBe(asset.creativeId);
    expect((await updateCreativeAsset(asset.id, { linkedAdIds: ["meta-ad-1", "google-ad-2"] })).linkedAdIds).toEqual(["meta-ad-1", "google-ad-2"]);
    expect((await listCreativeAssets())[0].creativeId).toMatch(/^creative:/u);
    expect((await readCreativeAssetMedia(asset.id)).dataBase64).toBe((await sharp(buffer).resize(180, 180).png().toBuffer()).toString("base64"));
    const publicAsset = publicCreativeAsset(derived);
    expect(publicAsset.versions[0]).not.toHaveProperty("storagePath");
    expect(publicAsset.derivatives[0]).not.toHaveProperty("storagePath");
  }, 15_000);

  it("detects fatigue, clusters concepts, and analyzes creative elements", () => {
    expect(detectSevenDayFatigue({ frequency: 4, currentRoas: 1.5, previousRoas: 2 }).fatigued).toBe(true);
    const asset = { id: "a", creativeId: "creative:a", name: "UGC proof", platform: "meta" as const, format: "ugc" as const, tags: ["ugc"], versions: [], derivatives: [], linkedAdIds: [], createdAt: "", updatedAt: "" };
    expect(clusterCreativeConcepts([asset, { ...asset, id: "b", creativeId: "creative:b" }])[0].assets).toHaveLength(2);
    expect(analyzeHookRetention([{ second: 0, retention: 1 }, { second: 3, retention: 0.6 }]).firstThreeSecondDrop).toBeCloseTo(0.4);
    expect(tagCreativeElements({ transcript: "Shop now for this product", hasFace: true })).toEqual(expect.arrayContaining(["face", "cta", "product"]));
    expect(classifyAudio({ bpm: 130, speechRatio: 0.7 })).toMatchObject({ mood: "energetic", mode: "voiceover" });
    expect(copyVariantContribution([{ id: "a", impressions: 100, clicks: 10, conversions: 3 }, { id: "b", impressions: 100, clicks: 5, conversions: 1 }])[0].id).toBe("a");
  });

  it("uses configured embedding, vision, and audio inference while preserving source provenance", async () => {
    process.env.CREATIVE_INFERENCE_URL = "https://inference.example.test";
    process.env.CREATIVE_INFERENCE_API_KEY = "test-key";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ embeddings: [[1, 0], [0.99, 0.01]] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tags: ["face", "product"] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ classification: { mood: "energetic", tempo: "fast", mode: "voiceover", speechRatio: 0.8 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const asset = { id: "a", creativeId: "creative:a", name: "UGC proof", platform: "meta" as const, format: "ugc" as const, tags: ["ugc"], versions: [], derivatives: [], linkedAdIds: [], createdAt: "", updatedAt: "" };
    const clusters = await rankCreativeClustersWithEmbeddings([asset, { ...asset, id: "b", creativeId: "creative:b" }], {});
    expect(clusters.source).toBe("provider");
    expect(clusters.result[0].assets).toHaveLength(2);
    const media = { fileName: "creative.png", mimeType: "image/png", dataBase64: "aW1hZ2U=" };
    expect((await inferCreativeElements({ transcript: "product", media }))).toMatchObject({ source: "provider", result: ["face", "product"] });
    expect((await inferAudioClassification({ bpm: 130 }))).toMatchObject({ source: "provider", result: { mood: "energetic", mode: "voiceover" } });
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer test-key");
    expect(JSON.parse(fetcher.mock.calls[1][1].body).media).toEqual(media);
  });
});
