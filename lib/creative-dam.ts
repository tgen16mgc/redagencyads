import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { workspaceDataPath } from "@/lib/workspace-storage";
import type { CanonicalPerformanceRow, CanonicalPlatform } from "@/lib/cross-channel";

export type CreativeFormat = "video" | "image" | "text" | "ugc" | "static" | "unknown";
export type DerivativeRatio = "9:16" | "1:1" | "4:5" | "16:9";

export type CreativeAssetVersion = {
  version: number;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: string;
};

export type CreativeDerivative = {
  ratio: DerivativeRatio;
  width: number;
  height: number;
  storagePath: string;
  status: "ready" | "failed";
  error?: string;
};

export type CreativeAsset = {
  id: string;
  creativeId: string;
  name: string;
  platform: CanonicalPlatform | "multi";
  concept?: string;
  hook?: string;
  talent?: string;
  format: CreativeFormat;
  tags: string[];
  rightsExpiry?: string;
  versions: CreativeAssetVersion[];
  derivatives: CreativeDerivative[];
  linkedAdIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreativeAssetSummary = Omit<CreativeAsset, "versions" | "derivatives"> & {
  versions: Array<Omit<CreativeAssetVersion, "storagePath">>;
  derivatives: Array<Omit<CreativeDerivative, "storagePath" | "error">>;
};

export function publicCreativeAsset(asset: CreativeAsset): CreativeAssetSummary {
  return {
    ...asset,
    versions: asset.versions.map(({ storagePath: _storagePath, ...version }) => version),
    derivatives: asset.derivatives.map(({ storagePath: _storagePath, error: _error, ...derivative }) => derivative),
  };
}

export type CreativeInferenceSource = "provider" | "heuristic" | "heuristic_fallback";

export type CreativeInference<T> = {
  result: T;
  source: CreativeInferenceSource;
  model?: string;
  warning?: string;
};

export type CreativeMediaPayload = { fileName: string; mimeType: string; dataBase64: string };

type Manifest = { assets: CreativeAsset[] };

const RATIO_SIZES: Record<DerivativeRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1920, height: 1080 },
};

function storageRoot() {
  return process.env.CREATIVE_ASSET_STORAGE_DIR || workspaceDataPath("creative-assets");
}

function manifestPath() {
  return path.join(storageRoot(), "manifest.json");
}

async function readManifest(): Promise<Manifest> {
  try {
    const parsed = JSON.parse(await readFile(manifestPath(), "utf8")) as Manifest;
    return { assets: Array.isArray(parsed.assets) ? parsed.assets : [] };
  } catch {
    return { assets: [] };
  }
}

async function writeManifest(manifest: Manifest) {
  await mkdir(storageRoot(), { recursive: true });
  const target = manifestPath();
  const temporaryPath = `${target}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), "utf8");
  await rename(temporaryPath, target);
}

function safeExtension(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLocaleLowerCase().replace(/[^.a-z0-9]/gu, "");
  if (ext) return ext;
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg")) return ".jpg";
  if (mimeType.includes("gif")) return ".gif";
  if (mimeType.includes("mp4")) return ".mp4";
  return ".bin";
}

function immutableCreativeId(buffer: Buffer) {
  return `creative:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function formatFromMime(mimeType: string): CreativeFormat {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("text/")) return "text";
  return "unknown";
}

export async function listCreativeAssets() {
  return (await readManifest()).assets;
}

export async function getCreativeAsset(id: string) {
  return (await readManifest()).assets.find((asset) => asset.id === id);
}

export async function readCreativeAssetMedia(id: string): Promise<CreativeMediaPayload> {
  const asset = await getCreativeAsset(id);
  const version = asset?.versions.at(-1);
  if (!asset || !version) throw new Error("Creative asset has no readable media version.");
  return { fileName: version.fileName, mimeType: version.mimeType, dataBase64: (await readFile(version.storagePath)).toString("base64") };
}

export async function createCreativeAsset(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  name?: string;
  platform?: CreativeAsset["platform"];
  concept?: string;
  hook?: string;
  talent?: string;
  tags?: string[];
  rightsExpiry?: string;
}) {
  const manifest = await readManifest();
  const creativeId = immutableCreativeId(input.buffer);
  const existing = manifest.assets.find((asset) => asset.creativeId === creativeId);
  if (existing) return existing;
  const id = `asset:${creativeId.slice(-16)}`;
  const directory = path.join(storageRoot(), id.replace(":", "-"));
  await mkdir(directory, { recursive: true });
  const originalPath = path.join(directory, `v1${safeExtension(input.fileName, input.mimeType)}`);
  await writeFile(originalPath, input.buffer);
  const createdAt = new Date().toISOString();
  const asset: CreativeAsset = {
    id,
    creativeId,
    name: input.name?.trim() || input.fileName,
    platform: input.platform || "multi",
    concept: input.concept?.trim() || undefined,
    hook: input.hook?.trim() || undefined,
    talent: input.talent?.trim() || undefined,
    format: formatFromMime(input.mimeType),
    tags: Array.from(new Set((input.tags || []).map((tag) => tag.trim()).filter(Boolean))).slice(0, 50),
    rightsExpiry: input.rightsExpiry,
    versions: [{ version: 1, fileName: input.fileName, mimeType: input.mimeType, size: input.buffer.length, storagePath: originalPath, createdAt }],
    derivatives: [],
    linkedAdIds: [],
    createdAt,
    updatedAt: createdAt,
  };
  manifest.assets.unshift(asset);
  await writeManifest(manifest);
  return asset;
}

export async function updateCreativeAsset(id: string, patch: Partial<Pick<CreativeAsset, "name" | "platform" | "concept" | "hook" | "talent" | "tags" | "rightsExpiry" | "linkedAdIds">>) {
  const manifest = await readManifest();
  const index = manifest.assets.findIndex((asset) => asset.id === id);
  if (index < 0) throw new Error("Creative asset not found.");
  manifest.assets[index] = { ...manifest.assets[index], ...patch, updatedAt: new Date().toISOString() };
  await writeManifest(manifest);
  return manifest.assets[index];
}

export async function addCreativeAssetVersion(id: string, input: { buffer: Buffer; fileName: string; mimeType: string }) {
  const manifest = await readManifest();
  const index = manifest.assets.findIndex((asset) => asset.id === id);
  if (index < 0) throw new Error("Creative asset not found.");
  const asset = manifest.assets[index];
  const version = (asset.versions.at(-1)?.version || 0) + 1;
  const directory = path.dirname(asset.versions.at(-1)?.storagePath || path.join(storageRoot(), id.replace(":", "-"), "v1.bin"));
  await mkdir(directory, { recursive: true });
  const storagePath = path.join(directory, `v${version}${safeExtension(input.fileName, input.mimeType)}`);
  await writeFile(storagePath, input.buffer);
  asset.versions.push({ version, fileName: input.fileName, mimeType: input.mimeType, size: input.buffer.length, storagePath, createdAt: new Date().toISOString() });
  asset.format = formatFromMime(input.mimeType);
  asset.derivatives = [];
  asset.updatedAt = new Date().toISOString();
  manifest.assets[index] = asset;
  await writeManifest(manifest);
  return asset;
}

function ffmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH || "ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => { error += String(chunk).slice(-4000); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(error || `ffmpeg exited with ${code}`)));
  });
}

export async function generateCreativeDerivatives(id: string, options: { ratios?: DerivativeRatio[]; caption?: string; overlayText?: string } = {}) {
  const manifest = await readManifest();
  const index = manifest.assets.findIndex((asset) => asset.id === id);
  if (index < 0) throw new Error("Creative asset not found.");
  const asset = manifest.assets[index];
  const source = asset.versions.at(-1)?.storagePath;
  if (!source) throw new Error("Creative asset has no source file.");
  const ratios = options.ratios?.length ? options.ratios : Object.keys(RATIO_SIZES) as DerivativeRatio[];
  const outputDirectory = path.join(path.dirname(source), "derivatives");
  await mkdir(outputDirectory, { recursive: true });
  const derivatives: CreativeDerivative[] = [];
  for (const ratio of ratios) {
    const size = RATIO_SIZES[ratio];
    const extension = asset.format === "video" ? ".mp4" : ".jpg";
    const output = path.join(outputDirectory, `${ratio.replace(":", "x")}${extension}`);
    try {
      if (asset.format === "video") {
        const filter = [`scale=${size.width}:${size.height}:force_original_aspect_ratio=increase`, `crop=${size.width}:${size.height}`];
        if (options.caption) filter.push(`drawtext=text='${options.caption.replaceAll("'", "\\'")}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=h-140:box=1:boxcolor=black@0.55:boxborderw=18`);
        if (options.overlayText) filter.push(`drawtext=text='${options.overlayText.replaceAll("'", "\\'")}':fontcolor=white:fontsize=36:x=50:y=50:box=1:boxcolor=black@0.4:boxborderw=12`);
        await ffmpeg(["-y", "-i", source, "-vf", filter.join(","), "-c:v", "libx264", "-preset", "fast", "-c:a", "aac", output]);
      } else {
        let image = sharp(source).resize(size.width, size.height, { fit: "cover" });
        const lines = [options.overlayText, options.caption].filter(Boolean);
        if (lines.length) {
          const overlay = Buffer.from(`<svg width="${size.width}" height="${size.height}"><rect x="40" y="${size.height - 190}" width="${size.width - 80}" height="130" rx="16" fill="rgba(0,0,0,.55)"/><text x="${size.width / 2}" y="${size.height - 115}" text-anchor="middle" fill="white" font-family="sans-serif" font-size="44">${lines.join(" · ").replace(/[<>&]/gu, "")}</text></svg>`);
          image = image.composite([{ input: overlay, top: 0, left: 0 }]);
        }
        await image.jpeg({ quality: 88 }).toFile(output);
      }
      derivatives.push({ ratio, width: size.width, height: size.height, storagePath: output, status: "ready" });
    } catch (error) {
      derivatives.push({ ratio, width: size.width, height: size.height, storagePath: output, status: "failed", error: error instanceof Error ? error.message : "Derivative generation failed." });
    }
  }
  asset.derivatives = [...asset.derivatives.filter((item) => !ratios.includes(item.ratio)), ...derivatives];
  asset.updatedAt = new Date().toISOString();
  manifest.assets[index] = asset;
  await writeManifest(manifest);
  return asset;
}

export function aggregateCreativePerformance(asset: CreativeAsset, rows: CanonicalPerformanceRow[]) {
  const linked = rows.filter((row) => row.creativeId === asset.creativeId || (row.adId && asset.linkedAdIds.includes(row.adId)));
  const spend = linked.reduce((sum, row) => sum + row.spend, 0);
  const conversions = linked.reduce((sum, row) => sum + row.conversions, 0);
  const revenue = linked.reduce((sum, row) => sum + row.revenue, 0);
  return { creativeId: asset.creativeId, adIds: Array.from(new Set(linked.map((row) => row.adId).filter((value): value is string => Boolean(value)))), spend, impressions: linked.reduce((sum, row) => sum + row.impressions, 0), clicks: linked.reduce((sum, row) => sum + row.clicks, 0), conversions, revenue, cpa: conversions > 0 ? spend / conversions : 0, roas: spend > 0 ? revenue / spend : 0 };
}

export function detectSevenDayFatigue(input: { frequency: number; currentRoas: number; previousRoas: number }) {
  const decline = input.previousRoas > 0 ? (input.previousRoas - input.currentRoas) / input.previousRoas : 0;
  const fatigued = input.frequency > 3 && decline > 0.2;
  return { fatigued, frequency: input.frequency, roasDecline: decline, recommendation: fatigued ? "Refresh the hook, first frame, or offer before adding spend." : "Keep monitoring the seven-day window." };
}

function vectorize(text: string, dimensions = 32) {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const digest = crypto.createHash("sha256").update(token).digest();
    vector[digest[0] % dimensions] += digest[1] % 2 ? 1 : -1;
  }
  return vector;
}

function cosine(left: number[], right: number[]) {
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
  const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
  return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : 0;
}

function inferenceConfig() {
  return {
    url: process.env.CREATIVE_INFERENCE_URL,
    key: process.env.CREATIVE_INFERENCE_API_KEY,
    model: process.env.CREATIVE_EMBEDDING_MODEL || "clip",
  };
}

async function requestInference(operation: "embeddings" | "elements" | "audio", input: Record<string, unknown>) {
  const config = inferenceConfig();
  if (!config.url) return undefined;
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.key ? { authorization: `Bearer ${config.key}` } : {}),
    },
    body: JSON.stringify({ operation, model: config.model, ...input }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Creative inference provider returned ${response.status}.`);
  return payload as Record<string, unknown>;
}

function numericEmbedding(value: unknown) {
  return Array.isArray(value) && value.length > 1 && value.every((item) => typeof item === "number" && Number.isFinite(item)) ? value as number[] : undefined;
}

function clustersFromVectors(assets: CreativeAsset[], vectors: number[][], similarityThreshold = 0.65) {
  const clusters: Array<{ id: string; label: string; assets: CreativeAsset[] }> = [];
  for (const [index, asset] of assets.entries()) {
    const vector = vectors[index];
    const match = vector ? clusters.find((cluster) => {
      const clusterIndex = assets.indexOf(cluster.assets[0]);
      return clusterIndex >= 0 && cosine(vectors[clusterIndex], vector) >= similarityThreshold;
    }) : undefined;
    if (match) match.assets.push(asset);
    else clusters.push({ id: `cluster:${clusters.length + 1}`, label: asset.concept || asset.tags[0] || asset.name, assets: [asset] });
  }
  return clusters.sort((left, right) => right.assets.length - left.assets.length);
}

export function clusterCreativeConcepts(assets: CreativeAsset[], similarityThreshold = 0.65) {
  const clusters: Array<{ id: string; label: string; assets: CreativeAsset[] }> = [];
  for (const asset of assets) {
    const text = [asset.concept, asset.hook, asset.name, ...asset.tags].filter(Boolean).join(" ");
    const vector = vectorize(text);
    const match = clusters.find((cluster) => cosine(vectorize([cluster.label, ...cluster.assets.flatMap((item) => item.tags)].join(" ")), vector) >= similarityThreshold);
    if (match) match.assets.push(asset);
    else clusters.push({ id: `cluster:${clusters.length + 1}`, label: asset.concept || asset.tags[0] || asset.name, assets: [asset] });
  }
  return clusters.sort((left, right) => right.assets.length - left.assets.length);
}

export function rankCreativeClusters(assets: CreativeAsset[], performance: Record<string, { spend: number; conversions: number; revenue: number }>) {
  return clusterCreativeConcepts(assets).map((cluster) => {
    const totals = cluster.assets.reduce((result, asset) => {
      const metrics = performance[asset.creativeId] || { spend: 0, conversions: 0, revenue: 0 };
      return { spend: result.spend + metrics.spend, conversions: result.conversions + metrics.conversions, revenue: result.revenue + metrics.revenue };
    }, { spend: 0, conversions: 0, revenue: 0 });
    return { ...cluster, ...totals, cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0, roas: totals.spend > 0 ? totals.revenue / totals.spend : 0 };
  }).sort((left, right) => right.roas - left.roas || left.cpa - right.cpa || right.assets.length - left.assets.length);
}

export async function rankCreativeClustersWithEmbeddings(assets: CreativeAsset[], performance: Record<string, { spend: number; conversions: number; revenue: number }>): Promise<CreativeInference<Array<{ id: string; label: string; assets: CreativeAsset[]; spend: number; conversions: number; revenue: number; cpa: number; roas: number }>>> {
  const config = inferenceConfig();
  let source: CreativeInferenceSource = config.url ? "heuristic_fallback" : "heuristic";
  let warning: string | undefined = config.url ? "Creative inference provider was unavailable; deterministic text clustering was used." : "Configure CREATIVE_INFERENCE_URL for CLIP/video embedding clustering.";
  let clusters = clusterCreativeConcepts(assets);
  if (config.url) {
    try {
      const maxMediaBytes = Math.max(0, Number(process.env.CREATIVE_INFERENCE_MAX_BYTES) || 10 * 1024 * 1024);
      let omittedMedia = 0;
      const inputs = await Promise.all(assets.map(async (asset) => {
        const text = [asset.concept, asset.hook, asset.name, ...asset.tags].filter(Boolean).join(" ");
        const version = asset.versions.at(-1);
        if (!version || version.size > maxMediaBytes) {
          if (version) omittedMedia += 1;
          return { id: asset.id, text };
        }
        const media: CreativeMediaPayload = { fileName: version.fileName, mimeType: version.mimeType, dataBase64: (await readFile(version.storagePath)).toString("base64") };
        return { id: asset.id, text, media };
      }));
      const payload = await requestInference("embeddings", { inputs });
      const vectors = Array.isArray(payload?.embeddings) ? payload.embeddings.map(numericEmbedding) : [];
      if (vectors.length === assets.length && vectors.every((vector): vector is number[] => Boolean(vector))) {
        clusters = clustersFromVectors(assets, vectors as number[][]);
        source = "provider";
        warning = omittedMedia ? `${omittedMedia} oversized asset(s) used text metadata instead of raw media for embeddings.` : undefined;
      }
    } catch {
      // Keep the catalog usable while making the missing model evidence explicit.
    }
  }
  const ranked = clusters.map((cluster) => {
    const totals = cluster.assets.reduce((result, asset) => {
      const metrics = performance[asset.creativeId] || { spend: 0, conversions: 0, revenue: 0 };
      return { spend: result.spend + metrics.spend, conversions: result.conversions + metrics.conversions, revenue: result.revenue + metrics.revenue };
    }, { spend: 0, conversions: 0, revenue: 0 });
    return { ...cluster, ...totals, cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0, roas: totals.spend > 0 ? totals.revenue / totals.spend : 0 };
  }).sort((left, right) => right.roas - left.roas || left.cpa - right.cpa || right.assets.length - left.assets.length);
  return { result: ranked, source, model: config.model, warning };
}

export function analyzeHookRetention(curve: Array<{ second: number; retention: number }>) {
  const firstThree = curve.filter((point) => point.second <= 3).sort((left, right) => left.second - right.second);
  const start = firstThree[0]?.retention || 0;
  const end = firstThree.at(-1)?.retention || 0;
  const drops = firstThree.slice(1).map((point, index) => ({ second: point.second, drop: (firstThree[index]?.retention || point.retention) - point.retention })).sort((left, right) => right.drop - left.drop);
  return { hookRetention: end, firstThreeSecondDrop: Math.max(0, start - end), biggestDropFrame: drops[0]?.second, curve: firstThree };
}

export function tagCreativeElements(input: { transcript?: string; detectedLabels?: string[]; hasFace?: boolean; hasTextOverlay?: boolean; hasCta?: boolean }) {
  const text = input.transcript?.toLocaleLowerCase() || "";
  return Array.from(new Set([
    ...(input.detectedLabels || []),
    ...(input.hasFace ? ["face"] : []),
    ...(input.hasTextOverlay || /\b(save|buy|shop|learn|đăng ký|mua|giảm)\b/u.test(text) ? ["text_overlay"] : []),
    ...(input.hasCta || /\b(click|tap|shop now|learn more|nhấn|xem ngay)\b/u.test(text) ? ["cta"] : []),
    ...(/\b(product|sản phẩm)\b/u.test(text) ? ["product"] : []),
  ]));
}

export async function inferCreativeElements(input: Parameters<typeof tagCreativeElements>[0] & { media?: CreativeMediaPayload }): Promise<CreativeInference<string[]>> {
  const config = inferenceConfig();
  if (config.url) {
    try {
      const payload = await requestInference("elements", input);
      if (Array.isArray(payload?.tags) && payload.tags.every((tag) => typeof tag === "string")) return { result: Array.from(new Set(payload.tags)), source: "provider", model: config.model };
    } catch {
      // Fall through to the deterministic signal extractor.
    }
  }
  return { result: tagCreativeElements(input), source: config.url ? "heuristic_fallback" : "heuristic", model: config.model, warning: config.url ? "Creative inference provider was unavailable; transcript and supplied labels were used." : "Configure CREATIVE_INFERENCE_URL for object and text detection." };
}

export function classifyAudio(input: { bpm?: number; transcript?: string; speechRatio?: number; energy?: number }) {
  const bpm = input.bpm || 0;
  const speechRatio = Math.max(0, Math.min(1, input.speechRatio || (input.transcript ? 0.6 : 0)));
  const mood = (input.energy || 0) > 0.7 || bpm > 125 ? "energetic" : bpm > 0 && bpm < 80 ? "calm" : "neutral";
  return { mood, tempo: bpm >= 120 ? "fast" : bpm > 0 && bpm < 85 ? "slow" : "medium", mode: speechRatio >= 0.5 ? "voiceover" : "music_only", speechRatio };
}

export async function inferAudioClassification(input: Parameters<typeof classifyAudio>[0] & { media?: CreativeMediaPayload }): Promise<CreativeInference<ReturnType<typeof classifyAudio>>> {
  const config = inferenceConfig();
  if (config.url) {
    try {
      const payload = await requestInference("audio", input);
      const classification = payload?.classification;
      if (classification && typeof classification === "object") {
        const value = classification as Record<string, unknown>;
        if (typeof value.mood === "string" && typeof value.tempo === "string" && typeof value.mode === "string" && typeof value.speechRatio === "number") return { result: { mood: value.mood, tempo: value.tempo, mode: value.mode, speechRatio: value.speechRatio }, source: "provider", model: config.model };
      }
    } catch {
      // Fall through to the deterministic metadata classifier.
    }
  }
  return { result: classifyAudio(input), source: config.url ? "heuristic_fallback" : "heuristic", model: config.model, warning: config.url ? "Creative inference provider was unavailable; supplied audio metadata was used." : "Configure CREATIVE_INFERENCE_URL for raw audio classification." };
}

export function copyVariantContribution(variants: Array<{ id: string; headline?: string; primaryText?: string; cta?: string; impressions: number; clicks: number; conversions: number }>) {
  const score = (variant: typeof variants[number]) => variant.impressions > 0 ? (variant.clicks / variant.impressions) * 0.4 + (variant.conversions / variant.impressions) * 0.6 : 0;
  return variants.map((variant) => ({ ...variant, contributionScore: score(variant) })).sort((left, right) => right.contributionScore - left.contributionScore);
}

export function correlateCreativeElements(samples: Array<{ tags: string[]; impressions: number; clicks: number; conversions: number }>) {
  const tags = Array.from(new Set(samples.flatMap((sample) => sample.tags)));
  return tags.map((tag) => {
    const tagged = samples.filter((sample) => sample.tags.includes(tag));
    const untagged = samples.filter((sample) => !sample.tags.includes(tag));
    const rates = (rows: typeof samples) => {
      const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
      return { ctr: impressions > 0 ? rows.reduce((sum, row) => sum + row.clicks, 0) / impressions : 0, cvr: impressions > 0 ? rows.reduce((sum, row) => sum + row.conversions, 0) / impressions : 0 };
    };
    const taggedRates = rates(tagged);
    const baselineRates = rates(untagged);
    return { tag, sampleSize: tagged.length, ctr: taggedRates.ctr, cvr: taggedRates.cvr, ctrLift: baselineRates.ctr > 0 ? (taggedRates.ctr - baselineRates.ctr) / baselineRates.ctr : 0, cvrLift: baselineRates.cvr > 0 ? (taggedRates.cvr - baselineRates.cvr) / baselineRates.cvr : 0 };
  }).sort((left, right) => right.cvrLift - left.cvrLift || right.ctrLift - left.ctrLift);
}

export function correlateAudioPerformance(samples: Array<{ classification: ReturnType<typeof classifyAudio>; impressions: number; clicks: number; conversions: number }>) {
  const groups = new Map<string, typeof samples>();
  for (const sample of samples) {
    const key = `${sample.classification.mood}:${sample.classification.tempo}:${sample.classification.mode}`;
    const bucket = groups.get(key) || [];
    bucket.push(sample);
    groups.set(key, bucket);
  }
  return [...groups.entries()].map(([classification, rows]) => {
    const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
    return { classification, sampleSize: rows.length, ctr: impressions > 0 ? rows.reduce((sum, row) => sum + row.clicks, 0) / impressions : 0, cvr: impressions > 0 ? rows.reduce((sum, row) => sum + row.conversions, 0) / impressions : 0 };
  }).sort((left, right) => right.cvr - left.cvr || right.ctr - left.ctr);
}
