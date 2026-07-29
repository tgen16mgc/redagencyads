import { runApifyActor } from "@/lib/apify";
import { normalizeContentSha256 } from "@/lib/cross-channel";
import {
  boundedMediaHashNumber,
  fetchHttpsMediaSha256,
} from "@/lib/media-content-hash";
import { normalizeTikTokProfiles } from "@/lib/tiktok-input";
import type {
  TikTokAdLibraryRow,
  TikTokLibraryReport,
  TikTokProfile,
  TikTokProfileResult,
  TikTokVideo,
} from "@/lib/types";

type TikTokProfileArgs = {
  profiles: string[];
  resultsPerPage: number;
};

type TikTokAdLibraryArgs = {
  region: string;
  queryType: "1" | "2" | "url";
  query: string;
  startDate?: string;
  endDate?: string;
  maxAds: number;
  fetchDetails: boolean;
  format?: string;
  objective?: string;
  industry?: string;
  performanceTier?: string;
};

const DEFAULT_PROFILE_ACTOR_ID = "clockworks/tiktok-profile-scraper";
// This actor covers the EU/EEA/UK Ads Library and the global Creative Center.
// Keep the source choice explicit because advertiser search is only supported
// by the transparency library, while Creative Center is performance-oriented.
const DEFAULT_ADS_ACTOR_ID = "brilliant_gum/tiktok-ads-library-scraper";
const DUAL_SOURCE_ADS_ACTOR_ID = "brilliant_gum/tiktok-ads-library-scraper";
const LEGACY_ADS_ACTOR_ID = "data_xplorer/tiktok-ads-library-fast";

export async function fetchTikTokProfiles(
  args: TikTokProfileArgs,
): Promise<TikTokProfileResult> {
  const actorId =
    process.env.APIFY_TIKTOK_PROFILE_ACTOR_ID || DEFAULT_PROFILE_ACTOR_ID;
  const profiles = normalizeTikTokProfiles(args.profiles);
  const input = buildProfileInput(profiles, args.resultsPerPage);
  const items = await runApifyActor<Record<string, unknown>>({
    actorId,
    input,
    timeoutSeconds: 240,
  });
  const warnings = items.flatMap(profileWarning);
  const validItems = items.filter((item) => !item.error && !item.errorCode);
  return {
    profiles: uniqueProfiles(
      validItems
        .map(normalizeProfile)
        .filter((profile): profile is TikTokProfile => Boolean(profile)),
    ),
    videos: validItems
      .map(normalizeVideo)
      .filter((video): video is TikTokVideo => Boolean(video)),
    warnings,
    pulledAt: new Date().toISOString(),
  };
}

export async function fetchTikTokAdLibrary(
  args: TikTokAdLibraryArgs,
): Promise<TikTokLibraryReport> {
  const pipelineStartedAt = Date.now();
  const configuredFeed =
    process.env.TIKTOK_CCL_API_URL && process.env.TIKTOK_CCL_ACCESS_TOKEN
      ? await fetchCommercialContentLibraryRows(args)
      : null;
  const actorId = configuredFeed
    ? "tiktok-commercial-content-library"
    : process.env.APIFY_TIKTOK_ADS_ACTOR_ID || DEFAULT_ADS_ACTOR_ID;
  const input = buildAdsInput(args, actorId);
  const rows =
    configuredFeed ||
    (await runApifyActor<Record<string, unknown>>({
      actorId,
      input,
      timeoutSeconds: 240,
    }));
  const normalizationStartedAt = Date.now();
  const normalizedRows = rows.map(normalizeAdLibraryRow);
  const hashedRows = await enrichTikTokAdContentHashes({
    rows: normalizedRows,
  });
  const deduplicatedRows = uniqueAdLibraryRows(hashedRows.rows);
  const uniqueRows = deduplicatedRows.slice(0, args.maxAds);
  const normalizationDurationMs = Date.now() - normalizationStartedAt;
  const pipelineDurationMs = Date.now() - pipelineStartedAt;
  const matchedAdvertisers =
    args.queryType === "1"
      ? uniqueRows.filter((row) =>
          advertiserMatches(row.advertiserName, args.query),
        ).length
      : undefined;
  const warnings = [
    "TikTok rows are public TikTok Ad Library or Creative Center intelligence, not owned TikTok Ads Manager performance.",
  ];
  if (
    args.queryType === "1" &&
    !isCommercialContentLibraryRegion(args.region)
  ) {
    warnings.push(
      "This market is routed to Creative Center; advertiser-handle matching is not guaranteed outside Commercial Content Library regions.",
    );
  }
  if (
    actorId === DUAL_SOURCE_ADS_ACTOR_ID &&
    args.queryType !== "url" &&
    !isCommercialContentLibraryRegion(args.region)
  ) {
    warnings.push(
      "Creative Center does not support keyword or advertiser filtering; use a supported Commercial Content Library market for exact query matching.",
    );
  }
  if (actorId === DUAL_SOURCE_ADS_ACTOR_ID && args.queryType === "url") {
    warnings.push(
      "The default dual-source actor does not resolve ad-detail URLs; the URL is retained as a literal search term. Configure an approved actor template for URL lookup.",
    );
  }
  if (deduplicatedRows.length < normalizedRows.length) {
    warnings.push(
      `Deduplicated ${normalizedRows.length - deduplicatedRows.length} repeated creative rows before returning results.`,
    );
  }
  if (uniqueRows.length < deduplicatedRows.length) {
    warnings.push(
      `Capped the actor response at the requested ${args.maxAds} creative rows.`,
    );
  }
  warnings.push(
    ...hashedRows.summary.warnings.map(
      (warning) => `Media hash skipped: ${warning}`,
    ),
  );
  if (hashedRows.summary.cappedAssets) {
    warnings.push(
      `TikTok media hashing capped; ${hashedRows.summary.cappedAssets} additional assets retained metadata fingerprints.`,
    );
  }
  warnings.push(
    "Deduplication accuracy remains unvalidated until a labeled cohort is submitted to /api/tiktok/deduplication/validate.",
  );
  return {
    rows: uniqueRows,
    warnings,
    actorId,
    query: args.query,
    region: args.region,
    matchedAdvertisers,
    deduplicatedCount: normalizedRows.length - deduplicatedRows.length,
    pipelineDurationMs,
    normalizationDurationMs,
    creativeHashing: hashedRows.summary,
    acceptance: {
      normalizedWithin15Minutes: pipelineDurationMs < 15 * 60 * 1000,
      deduplicationAbove99Percent: null,
      deduplicationEvidence: "labeled_cohort_required",
    },
    pulledAt: new Date().toISOString(),
  };
}

export async function enrichTikTokAdContentHashes(input: {
  rows: TikTokAdLibraryRow[];
  fetchFn?: typeof fetch;
  maxAssets?: number;
  maxBytes?: number;
  timeoutMs?: number;
  concurrency?: number;
}) {
  const fetchFn = input.fetchFn || fetch;
  const maxAssets = Math.floor(
    boundedMediaHashNumber(
      input.maxAssets,
      process.env.TIKTOK_MEDIA_HASH_MAX_ASSETS,
      20,
      0,
    ),
  );
  const maxBytes = boundedMediaHashNumber(
    input.maxBytes,
    process.env.TIKTOK_MEDIA_HASH_MAX_BYTES,
    10 * 1024 * 1024,
    1,
  );
  const timeoutMs = boundedMediaHashNumber(
    input.timeoutMs,
    process.env.TIKTOK_MEDIA_HASH_TIMEOUT_MS,
    8_000,
    1000,
  );
  const concurrency = Math.floor(
    boundedMediaHashNumber(input.concurrency, undefined, 4, 1),
  );
  const rows = input.rows.map((row) => ({
    ...row,
    contentHash: normalizeContentSha256(row.contentHash),
  }));
  const providerHashAssets = rows.filter((row) => row.contentHash).length;
  const eligible = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) => !row.contentHash && Boolean(row.videoUrl || row.imageUrl),
    );
  const candidates = eligible.slice(0, maxAssets);
  const failures: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor];
      cursor += 1;
      try {
        rows[candidate.index] = {
          ...candidate.row,
          contentHash: await fetchHttpsMediaSha256({
            mediaUrl: candidate.row.videoUrl || candidate.row.imageUrl || "",
            maxBytes,
            timeoutMs,
            fetchFn,
          }),
        };
      } catch (error) {
        if (failures.length < 20) {
          failures.push(
            `${candidate.row.id}: ${error instanceof Error ? error.message : "Media hashing failed."}`,
          );
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, () =>
      worker(),
    ),
  );
  const hashedAssets = rows.filter((row) => row.contentHash).length;
  return {
    rows,
    summary: {
      source: "tiktok_provider_media_sha256" as const,
      totalAssets: rows.length,
      providerHashAssets,
      fetchedHashAssets: hashedAssets - providerHashAssets,
      metadataFallbackAssets: rows.length - hashedAssets,
      cappedAssets: Math.max(0, eligible.length - candidates.length),
      warnings: failures,
    },
  };
}

async function fetchCommercialContentLibraryRows(args: TikTokAdLibraryArgs) {
  const endpoint = process.env.TIKTOK_CCL_API_URL;
  const accessToken = process.env.TIKTOK_CCL_ACCESS_TOKEN;
  if (!endpoint || !accessToken) return null;
  const url = new URL(endpoint);
  url.searchParams.set("region", args.region.toUpperCase());
  url.searchParams.set("query_type", args.queryType);
  url.searchParams.set("query", args.query);
  url.searchParams.set("max_items", String(args.maxAds));
  if (args.startDate) url.searchParams.set("start_date", args.startDate);
  if (args.endDate) url.searchParams.set("end_date", args.endDate);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(240_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `TikTok Commercial Content Library fetch failed (${response.status}).`,
    );
  const data =
    payload && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : undefined;
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.ads)
        ? payload.ads
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.ads)
            ? data.ads
            : Array.isArray(payload.data)
              ? payload.data
              : [];
  return items.filter((item: unknown): item is Record<string, unknown> =>
    Boolean(item && typeof item === "object"),
  );
}

function buildProfileInput(profiles: string[], resultsPerPage: number) {
  const template = process.env.APIFY_TIKTOK_PROFILE_INPUT_TEMPLATE;
  if (template)
    return replaceTemplate(JSON.parse(template), { profiles, resultsPerPage });
  return {
    profiles,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    resultsPerPage,
    maxFollowersPerProfile: 0,
    maxFollowingPerProfile: 0,
    commentsPerPost: 0,
    topLevelCommentsPerPost: 0,
    maxRepliesPerComment: 0,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadAvatars: false,
  };
}

function buildAdsInput(args: TikTokAdLibraryArgs, actorId: string) {
  const template = process.env.APIFY_TIKTOK_ADS_INPUT_TEMPLATE;
  if (template) return replaceTemplate(JSON.parse(template), args);
  if (actorId === DUAL_SOURCE_ADS_ACTOR_ID) {
    const region = args.region.trim().toUpperCase();
    const source = isCommercialContentLibraryRegion(region)
      ? "library"
      : "creative_center";
    const adType = args.format?.toLocaleLowerCase().includes("video")
      ? "VIDEO"
      : args.format?.toLocaleLowerCase().includes("image")
        ? "IMAGE"
        : "ALL";
    return {
      source,
      searchTerms: [args.query],
      countries: [region],
      adType,
      dateFrom: args.startDate,
      dateTo: args.endDate,
      maxResults: args.maxAds,
      resolveAdDetails: args.fetchDetails,
      proxyConfiguration: { useApifyProxy: true },
    };
  }
  if (actorId === LEGACY_ADS_ACTOR_ID) {
    return {
      region: args.region,
      queryType: args.queryType,
      query: args.query,
      startDate: args.startDate,
      endDate: args.endDate,
      maxAds: args.maxAds,
      fetchDetails: args.fetchDetails,
      proxyConfiguration: { useApifyProxy: true },
    };
  }
  return {
    runMode: "real",
    mode: "ads_library_search",
    source: "auto",
    query: args.queryType === "2" || args.queryType === "url" ? args.query : "",
    advertiserName: args.queryType === "1" ? args.query : "",
    adIds: args.queryType === "url" ? extractTikTokAdIds(args.query) : [],
    country: args.region.toUpperCase(),
    contentType: "ads",
    startDate: args.startDate,
    endDate: args.endDate,
    maxPages: Math.max(1, Math.ceil(args.maxAds / 50)),
    maxItems: args.maxAds,
    quickSearch: !args.fetchDetails,
    includeDetails: args.fetchDetails,
    includeDiagnostics: false,
    includeSourceRaw: false,
    industries: args.industry ? [args.industry] : [],
    objectives: args.objective ? [args.objective] : [],
    adFormats: args.format ? [args.format] : [],
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
      ...(args.region && args.region.toLowerCase() !== "all"
        ? { apifyProxyCountry: args.region.toUpperCase() }
        : {}),
    },
  };
}

function extractTikTokAdIds(value: string) {
  return Array.from(new Set(value.match(/\d{8,}/gu) || []));
}

function replaceTemplate(
  value: unknown,
  vars: Record<string, unknown>,
): unknown {
  if (Array.isArray(value))
    return value.map((item) => replaceTemplate(item, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceTemplate(item, vars),
      ]),
    );
  }
  if (typeof value !== "string") return value;
  const exactKey = value.match(/^{{([a-zA-Z0-9_]+)}}$/)?.[1];
  if (exactKey && exactKey in vars) return vars[exactKey];
  return Object.entries(vars).reduce((result, [key, item]) => {
    return result.replaceAll(
      `{{${key}}}`,
      Array.isArray(item) ? item.join(", ") : String(item ?? ""),
    );
  }, value);
}

function profileWarning(item: Record<string, unknown>) {
  if (!item.error && !item.errorCode) return [];
  const input =
    readString(item.input) || readString(item.url) || "TikTok profile";
  return [
    `${input}: ${readString(item.error) || readString(item.errorCode) || "Unable to fetch profile."}`,
  ];
}

function normalizeProfile(
  item: Record<string, unknown>,
): TikTokProfile | undefined {
  const author = readRecord(item.authorMeta);
  const username =
    readString(author.name) ||
    readString(item.username) ||
    readString(item.input);
  if (!username) return undefined;
  return {
    id: readString(author.id),
    username,
    displayName: readString(author.nickName) || readString(item.displayName),
    bio: readString(author.signature),
    verified: readBoolean(author.verified),
    followerCount: readNumber(author.fans),
    followingCount: readNumber(author.following),
    likesCount: readNumber(author.heart),
    videoCount: readNumber(author.video),
    avatarUrl: readString(author.avatar),
    profileUrl: `https://www.tiktok.com/@${username}`,
    raw: item,
  };
}

function normalizeVideo(
  item: Record<string, unknown>,
): TikTokVideo | undefined {
  const id = readString(item.id);
  if (!id) return undefined;
  const author = readRecord(item.authorMeta);
  const videoMeta = readRecord(item.videoMeta);
  return {
    id,
    username: readString(author.name),
    text: readString(item.text),
    videoUrl: readString(item.webVideoUrl) || firstString(item.mediaUrls),
    coverUrl: readString(videoMeta.coverUrl),
    createdAt: readString(item.createTimeISO),
    likeCount: readNumber(item.diggCount),
    shareCount: readNumber(item.shareCount),
    playCount: readNumber(item.playCount),
    commentCount: readNumber(item.commentCount),
    raw: item,
  };
}

function normalizeAdLibraryRow(
  item: Record<string, unknown>,
): TikTokAdLibraryRow {
  const details = readRecord(item["Ad Details"]);
  const media = readRecord(item["Ad Media"]);
  const audience = readRecord(item["Ad Audience"]);
  const targeting = readRecord(item["Ad Targeting"]);
  const videoMetrics = readRecord(item.videoMetrics);
  const impressions =
    readRange(details.impressions) || readRange(item.impressions);
  const reach = readRange(details.reach) || readRange(item.reach);
  const spend = readRange(details.spend) || readRange(item.spend);
  const audienceRange = readRange(item.adEstimatedAudience) || {
    lower: readNumber(audience.min),
    upper: readNumber(audience.max),
  };
  const videoUrl =
    readString(media.videoUrl) ||
    readString(item.videoUrl) ||
    readString(item.adVideoUrl);
  const imageUrl =
    readString(media.coverUrl) ||
    firstString(media.imageUrls) ||
    firstString(item.imageUrls) ||
    readString(item.adVideoCover) ||
    readString(item.thumbnailUrl);
  const caption =
    readString(item.caption) ||
    readString(item.adText) ||
    readString(item.title) ||
    readString(item.bestTitle) ||
    readString(details.caption);
  const ctr = readNumber(item.ctr);
  const hookRetention = deriveHookRetention(item.keyframeAnalysis);
  const performanceScore = derivePerformanceScore(
    item,
    ctr,
    hookRetention,
    caption,
  );
  return {
    id:
      readString(item["AD ID"]) ||
      readString(item.adId) ||
      readString(item.materialId) ||
      readString(item.id) ||
      "tiktok-ad",
    advertiserName:
      readString(item["Advertiser Name"]) ||
      readString(item.advertiserName) ||
      readString(item.brandName),
    adTitle:
      readString(item["Ad Title"]) ||
      readString(item.adTitle) ||
      readString(item.bestTitle) ||
      readString(item.title),
    caption,
    cta: readString(details.cta) || readString(item.cta),
    landingUrl:
      readString(details.landingUrl) ||
      readString(details.clickUrl) ||
      readString(item.clickUrl) ||
      readString(item.landingPage) ||
      readString(item.landingPageUrl),
    previewUrl:
      readString(item["AD Preview"]) ||
      readString(item["Ad Detail URL"]) ||
      readString(item.previewUrl) ||
      readString(item.sourceUrl),
    imageUrl,
    videoUrl: videoUrl || firstString(media.videoUrls),
    contentHash: normalizeContentSha256(
      readString(item.contentHash) ||
        readString(item.contentSha256) ||
        readString(item.content_sha256) ||
        readString(media.contentHash) ||
        readString(media.contentSha256) ||
        readString(media.content_sha256),
    ),
    firstSeen:
      readString(item.firstSeen) ||
      readString(item.first_shown_date) ||
      readString(item.adStartDate) ||
      readString(item.firstShownDate),
    lastSeen:
      readString(item.lastSeen) ||
      readString(item.last_shown_date) ||
      readString(item.adEndDate) ||
      readString(item.lastShownDate),
    impressionsLower: impressions?.lower,
    impressionsUpper: impressions?.upper,
    reachLower: reach?.lower,
    reachUpper: reach?.upper,
    spendLower: spend?.lower,
    spendUpper: spend?.upper,
    audienceMin: audienceRange.lower,
    audienceMax: audienceRange.upper,
    regions: readStringArray(targeting.regions),
    format: normalizeFormat(
      readString(item.adType) || readString(item.adFormat),
      videoUrl,
      imageUrl,
    ),
    objective:
      readString(item.objective) ||
      readString(item.objectiveKey) ||
      readString(item.campaignObjective),
    industry: readString(item.industry) || readString(item.industryKey),
    performanceTier: performanceTier(performanceScore),
    performanceScore,
    hookRetention,
    ctr,
    likeCount:
      readNumber(item.likeCount) ??
      readNumber(item.metricLikeCount) ??
      readNumber(item.likes),
    commentCount:
      readNumber(item.commentCount) ?? readNumber(item.metricCommentCount),
    shareCount:
      readNumber(item.shareCount) ?? readNumber(item.metricForwardCount),
    durationSeconds:
      readNumber(item.duration) ??
      readNumber(item.keyframeDuration) ??
      readNumber(videoMetrics.duration),
    source: readString(item.source) || readString(item.dataSource),
    sourceUrl:
      readString(item.sourceUrl) ||
      readString(item["AD Detail URL"]) ||
      readString(item["Ad Detail URL"]),
    targeting: Object.keys(targeting).length ? targeting : undefined,
    raw: item,
  };
}

const COMMERCIAL_CONTENT_LIBRARY_REGIONS = new Set([
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

function isCommercialContentLibraryRegion(region: string) {
  return COMMERCIAL_CONTENT_LIBRARY_REGIONS.has(region.trim().toUpperCase());
}

function advertiserMatches(advertiser: string | undefined, query: string) {
  const left = advertiser
    ?.toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
  const right = query
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
  return Boolean(left && right && (left === right || left.includes(right)));
}

function normalizeIdentityUrl(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString().toLocaleLowerCase();
  } catch {
    return value.trim().toLocaleLowerCase();
  }
}

function adIdentityKeys(row: TikTokAdLibraryRow) {
  const keys: string[] = [];
  const contentHash = normalizeContentSha256(row.contentHash);
  if (contentHash) keys.push(`sha256:${contentHash.slice("sha256:".length)}`);
  if (row.id && row.id !== "tiktok-ad") keys.push(`id:${row.id}`);
  const media = normalizeIdentityUrl(row.videoUrl || row.imageUrl);
  if (media) keys.push(`media:${media}`);
  const landing = normalizeIdentityUrl(row.landingUrl);
  const caption = row.caption?.trim().toLocaleLowerCase().replace(/\s+/gu, " ");
  const advertiser = row.advertiserName?.trim().toLocaleLowerCase();
  if (!media && (caption || landing))
    keys.push(`content:${advertiser || "unknown"}|${caption || ""}|${landing}`);
  return keys.length ? keys : [`fallback:${row.id}:${advertiser || "unknown"}`];
}

function uniqueAdLibraryRows(rows: TikTokAdLibraryRow[]) {
  const assignments = adLibraryClusterAssignments(rows);
  const retainedClusters = new Set<number>();
  return rows.filter((_, index) => {
    const cluster = assignments[index];
    if (retainedClusters.has(cluster)) return false;
    retainedClusters.add(cluster);
    return true;
  });
}

function adLibraryClusterAssignments(rows: TikTokAdLibraryRow[]) {
  const parents = rows.map((_, index) => index);
  const keyOwners = new Map<string, number>();
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  rows.forEach((row, index) => {
    const keys = adIdentityKeys(row);
    keys.forEach((key) => {
      const owner = keyOwners.get(key);
      if (owner !== undefined) union(index, owner);
      keyOwners.set(key, index);
    });
  });

  return rows.map((_, index) => find(index));
}

export function evaluateTikTokDeduplication(
  samples: Array<{
    expectedCreativeId: string;
    row: Record<string, unknown>;
  }>,
) {
  const normalizedRows = samples.map((sample) =>
    normalizeAdLibraryRow(sample.row),
  );
  const predictedClusters = adLibraryClusterAssignments(normalizedRows);
  let truePositivePairs = 0;
  let falsePositivePairs = 0;
  let falseNegativePairs = 0;

  for (let left = 0; left < samples.length; left += 1) {
    for (let right = left + 1; right < samples.length; right += 1) {
      const expectedDuplicate =
        samples[left].expectedCreativeId === samples[right].expectedCreativeId;
      const predictedDuplicate =
        predictedClusters[left] === predictedClusters[right];
      if (expectedDuplicate && predictedDuplicate) truePositivePairs += 1;
      else if (!expectedDuplicate && predictedDuplicate)
        falsePositivePairs += 1;
      else if (expectedDuplicate && !predictedDuplicate)
        falseNegativePairs += 1;
    }
  }

  const precision =
    truePositivePairs + falsePositivePairs
      ? truePositivePairs / (truePositivePairs + falsePositivePairs)
      : 1;
  const recall =
    truePositivePairs + falseNegativePairs
      ? truePositivePairs / (truePositivePairs + falseNegativePairs)
      : 1;
  const deduplicationAccuracy =
    precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    sampleSize: samples.length,
    expectedUniqueCount: new Set(
      samples.map((sample) => sample.expectedCreativeId),
    ).size,
    predictedUniqueCount: new Set(predictedClusters).size,
    truePositivePairs,
    falsePositivePairs,
    falseNegativePairs,
    precision,
    recall,
    deduplicationAccuracy,
    acceptanceMet: deduplicationAccuracy > 0.99,
  };
}

function normalizeFormat(
  value: string | undefined,
  videoUrl: string | undefined,
  imageUrl: string | undefined,
): TikTokAdLibraryRow["format"] {
  const format = value?.toLocaleLowerCase();
  if (format?.includes("video") || videoUrl) return "video";
  if (format?.includes("image") || imageUrl) return "image";
  return "unknown";
}

function deriveHookRetention(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const firstThree = value
    .slice(0, 3)
    .map((point) => readNumber(readRecord(point).value))
    .filter((point): point is number => point !== undefined);
  if (!firstThree.length) return undefined;
  const average =
    firstThree.reduce((sum, point) => sum + point, 0) / firstThree.length;
  return Math.round(Math.max(0, Math.min(1, average)) * 100) / 100;
}

function derivePerformanceScore(
  item: Record<string, unknown>,
  ctr: number | undefined,
  hookRetention: number | undefined,
  caption: string | undefined,
) {
  const ctrSignal =
    readNumber(item.ctrPercentile) ??
    (ctr === undefined ? 0.5 : ctr > 1 ? ctr / 100 : ctr);
  const retentionSignal = hookRetention ?? 0.5;
  const positiveWords = (
    caption?.match(
      /\b(best|new|love|great|save|free|sale|deal|limited|ho\s*nh|tuyệt|mới|giảm|miễn phí)\b/giu,
    ) || []
  ).length;
  const negativeWords = (
    caption?.match(/\b(fake|bad|hate|scam|expired|lỗi|tệ)\b/giu) || []
  ).length;
  const suppliedSentiment =
    readNumber(item.commentSentiment) ?? readNumber(item.commentSentimentScore);
  const sentimentSignal =
    suppliedSentiment === undefined
      ? Math.max(0, Math.min(1, 0.5 + (positiveWords - negativeWords) * 0.05))
      : Math.max(0, Math.min(1, suppliedSentiment));
  const duration =
    readNumber(item.duration) ?? readNumber(item.keyframeDuration);
  const durationSignal =
    duration === undefined
      ? 0.5
      : duration >= 9 && duration <= 30
        ? 1
        : duration <= 60
          ? 0.7
          : 0.4;
  const score =
    Math.max(0, Math.min(1, ctrSignal)) * 0.35 +
    retentionSignal * 0.3 +
    sentimentSignal * 0.2 +
    durationSignal * 0.15;
  return Math.round(score * 100);
}

function performanceTier(
  score: number | undefined,
): TikTokAdLibraryRow["performanceTier"] {
  if (score === undefined) return "unknown";
  if (score >= 80) return "top";
  if (score >= 65) return "strong";
  return "standard";
}

function uniqueProfiles(profiles: TikTokProfile[]) {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    const key = profile.id || profile.username;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function firstString(value: unknown) {
  return Array.isArray(value)
    ? value.find(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readRange(value: unknown) {
  const direct = readNumber(value);
  if (direct !== undefined) return { lower: direct, upper: direct };
  if (typeof value === "string") {
    const numbers =
      value
        .match(/[\d,.]+/gu)
        ?.map((part) => Number(part.replaceAll(",", "")))
        .filter(Number.isFinite) || [];
    if (numbers.length)
      return { lower: numbers[0], upper: numbers[1] ?? numbers[0] };
  }
  const record = readRecord(value);
  const lower = readNumber(record.lowerBound) ?? readNumber(record.min);
  const upper = readNumber(record.upperBound) ?? readNumber(record.max);
  if (lower === undefined && upper === undefined) return undefined;
  return { lower, upper };
}
