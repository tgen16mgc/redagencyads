import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { runApifyActor } from "@/lib/apify";
import type { CompetitorEvidenceCoverage, CompetitorFetchResult, CompetitorFetchSource, CompetitorSpyAd } from "@/lib/types";

type SpyFetchArgs = {
  source: CompetitorFetchSource;
  competitors: string[];
  country: string;
  limit: number;
  libraryUrls: string[];
  token?: string;
};

const META_FIELDS = [
  "id",
  "ad_creation_time",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_creative_link_captions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
  "page_id",
  "page_name",
  "publisher_platforms",
].join(",");

const execFileAsync = promisify(execFile);
const PUBLIC_META_SCRAPE_TIMEOUT_MS = Number(process.env.META_PUBLIC_SCRAPE_TIMEOUT_MS || 45000);
const PUBLIC_META_SCRAPE_WAIT_MS = Number(process.env.META_PUBLIC_SCRAPE_WAIT_MS || 12000);
const PUBLIC_META_MAX_BUFFER = 24 * 1024 * 1024;
const COMPETITOR_APIFY_TIMEOUT_SECONDS = 135;

export async function fetchCompetitorAds(args: SpyFetchArgs): Promise<CompetitorFetchResult> {
  if (args.source === "public") return fetchPublicLibraryCards(args);
  if (args.source === "meta_official") return fetchMetaOfficialAds(args);
  return fetchApifyAds(args);
}

async function fetchMetaOfficialAds(args: SpyFetchArgs): Promise<CompetitorFetchResult> {
  if (!args.token) throw new Error("Meta token session required for official Ad Library API.");
  const warnings = [
    "Meta official ads_archive can miss normal commercial competitor ads. Use Apify scraper for broader commercial spy data.",
  ];
  const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
  const country = normalizeCountry(args.country);
  const ads: CompetitorSpyAd[] = [];

  for (const competitor of args.competitors) {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/ads_archive`);
    url.searchParams.set("access_token", args.token);
    url.searchParams.set("search_terms", competitor);
    url.searchParams.set("ad_reached_countries", JSON.stringify([country]));
    url.searchParams.set("ad_type", "ALL");
    url.searchParams.set("fields", META_FIELDS);
    url.searchParams.set("limit", String(Math.min(args.limit, 50)));
    const response = await fetch(url.toString(), { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) {
      warnings.push(`${competitor}: ${json?.error?.message || "Meta Ad Library API failed."}`);
      continue;
    }
    const rows = Array.isArray(json.data) ? json.data : [];
    ads.push(...rows.map((row: Record<string, unknown>) => normalizeMetaAd(row, competitor)));
  }

  return {
    source: "meta_official",
    outcome: ads.length ? "matched" : "empty",
    ads: uniqueAds(ads).slice(0, args.limit),
    coverage: [],
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchApifyAds(args: SpyFetchArgs): Promise<CompetitorFetchResult> {
  const actorId = process.env.APIFY_META_ADS_ACTOR_ID;
  if (!process.env.APIFY_TOKEN || !actorId) {
    throw new Error("Competitor evidence collection requires APIFY_TOKEN and APIFY_META_ADS_ACTOR_ID.");
  }

  const targets = buildApifyTargets(args);
  const targetResults = await Promise.all(targets.map(async (target) => {
    try {
      const rows = await runApifyTarget(target.args, actorId);
      return { ...target, rows, error: undefined as unknown };
    } catch (error) {
      return { ...target, rows: [] as unknown[], error };
    }
  }));
  const failedTargets = targetResults.filter((result) => result.error);
  if (failedTargets.length === targetResults.length && failedTargets[0]?.error) {
    throw failedTargets[0].error;
  }
  const fetchedAt = new Date().toISOString();
  const normalizedAds = targetResults.flatMap((target, targetIndex) => target.rows.map((row, rowIndex) => {
    const ad = normalizeApifyAd(row, targetIndex * Math.max(1, target.args.limit) + rowIndex);
    const advertiserCompetitor = findAdvertiserCompetitor(ad.pageName, args.competitors);
    const competitorName = advertiserCompetitor || target.competitor || ad.competitorName;
    return competitorName ? { ...ad, competitorName } : ad;
  }));
  const ads = uniqueAds(normalizedAds)
    .slice(0, args.limit)
    .map((ad) => ({
      ...ad,
      evidence: classifyEvidence(ad, args.competitors, fetchedAt),
    }));
  const matchedCount = ads.filter((ad) => ad.evidence?.matchedToCompetitor).length;
  const outcome = ads.length === 0 ? "empty" : matchedCount > 0 ? "matched" : "zero_match";
  const warnings = failedTargets.map((target) => {
    const message = target.error instanceof Error ? target.error.message : "Actor run failed.";
    return `${target.competitor || "Ad Library URL"}: ${message}`;
  });
  if (outcome === "empty") {
    warnings.push("Apify returned no ads. Check the actor input or use an exact Meta Ad Library page URL.");
  } else if (outcome === "zero_match") {
    warnings.push("Ads were collected, but none matched the requested advertiser. Add the exact advertiser Ad Library page URL for a precise retry.");
  }

  return {
    source: "apify",
    outcome,
    ads,
    coverage: buildEvidenceCoverage(args.competitors, ads),
    warnings,
    fetchedAt,
  };
}

async function runApifyTarget(args: SpyFetchArgs, actorId: string) {
  const input = buildApifyInput(args, actorId);
  try {
    return await runApifyActor<unknown>({
      actorId,
      input,
      timeoutSeconds: COMPETITOR_APIFY_TIMEOUT_SECONDS,
    });
  } catch (error) {
    if (!requiresUrlsInput(error) || hasUsableUrlsInput(input)) throw error;
    return runApifyActor<unknown>({
      actorId,
      input: buildApifyUrlsInput(args),
      timeoutSeconds: COMPETITOR_APIFY_TIMEOUT_SECONDS,
    });
  }
}

function buildApifyTargets(args: SpyFetchArgs) {
  const rawTargets = args.libraryUrls.length
    ? [
      ...args.libraryUrls.map((libraryUrl, index) => {
      const competitor = args.competitors[index]
        || (args.competitors.length === 1 ? args.competitors[0] : undefined)
        || pageLabelFromLibraryUrl(libraryUrl);
      return {
        competitor,
        libraryUrls: [libraryUrl],
      };
      }),
      ...args.competitors.slice(args.libraryUrls.length).map((competitor) => ({
        competitor,
        libraryUrls: [] as string[],
      })),
    ]
    : args.competitors.map((competitor) => ({ competitor, libraryUrls: [] as string[] }));
  const limit = Math.max(1, Math.ceil(args.limit / Math.max(1, rawTargets.length)));

  return rawTargets.map((target) => ({
    competitor: target.competitor,
    args: {
      ...args,
      competitors: target.competitor ? [target.competitor] : [],
      libraryUrls: target.libraryUrls,
      limit,
    },
  }));
}

function findAdvertiserCompetitor(advertiser: string | undefined, competitors: string[]) {
  const advertiserKey = normalizedName(advertiser);
  if (!advertiserKey) return undefined;
  const matches = competitors.filter((competitor) => {
    const competitorKey = normalizedName(competitor);
    return advertiserKey === competitorKey
      || (advertiserKey.includes(competitorKey) || competitorKey.includes(advertiserKey));
  });
  return matches.length === 1 ? matches[0] : undefined;
}

async function fetchPublicLibraryCards(args: SpyFetchArgs, warning = "No-key public mode used Meta Ad Library public pages. If extraction is thin, open the links to inspect live ads."): Promise<CompetitorFetchResult> {
  const country = normalizeCountry(args.country);
  const urlAds = args.libraryUrls.map((url, index): CompetitorSpyAd => {
    const label = pageLabelFromLibraryUrl(url) || `Meta Ad Library URL ${index + 1}`;
    return {
      id: `public-url-${index}`,
      source: "public",
      competitorName: label,
      pageName: label,
      platform: "Meta / Instagram",
      headline: "Open supplied Meta Ad Library URL",
      description: "User supplied URL. Use this as live public evidence for the competitor brief.",
      cta: "Open Ad Library",
      format: "public-link",
      snapshotUrl: url,
      raw: { mode: "public", country },
    };
  });
  const searchAds = args.competitors.map((competitor): CompetitorSpyAd => {
    const url = new URL("https://www.facebook.com/ads/library/");
    url.searchParams.set("active_status", "active");
    url.searchParams.set("ad_type", "all");
    url.searchParams.set("country", country);
    url.searchParams.set("q", competitor);
    url.searchParams.set("search_type", "keyword_unordered");
    return {
      id: `public-search-${slug(competitor)}`,
      source: "public",
      competitorName: competitor,
      pageName: competitor,
      platform: "Meta / Instagram",
      headline: "Open Meta Ad Library search",
      description: `No API key needed. Review active ads for "${competitor}" in ${country}, then use Generate spy brief.`,
      cta: "Open Ad Library",
      format: "public-search",
      snapshotUrl: url.toString(),
      raw: { mode: "public", country },
    };
  });
  const linkAds = uniqueAds([...urlAds, ...searchAds]).slice(0, args.limit);
  const extractedAds = await fetchPublicLibraryExtractedAds(linkAds, args.limit);
  const ads = extractedAds.length ? uniqueAds([...extractedAds, ...linkAds]).slice(0, args.limit) : linkAds;
  return {
    source: "public",
    outcome: ads.length ? "matched" : "empty",
    ads,
    coverage: [],
    warnings: extractedAds.length
      ? [`Local Chrome public scrape extracted ${extractedAds.length} Meta Ad Library ad(s). ${warning}`]
      : [warning],
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchPublicLibraryExtractedAds(linkAds: CompetitorSpyAd[], limit: number) {
  if (process.env.VITEST || process.env.META_PUBLIC_SCRAPE_DISABLE === "1") return [];
  const chromePath = chromeExecutablePath();
  if (!chromePath) return [];

  const ads: CompetitorSpyAd[] = [];
  for (const linkAd of linkAds.slice(0, Math.min(linkAds.length, 3))) {
    if (!linkAd.snapshotUrl || ads.length >= limit) break;
    try {
      const html = await dumpPublicMetaLibraryHtml(chromePath, linkAd.snapshotUrl);
      ads.push(...parsePublicMetaLibraryHtml(html, {
        competitorName: linkAd.competitorName || linkAd.pageName || "Competitor",
        sourceUrl: linkAd.snapshotUrl,
        limit: limit - ads.length,
      }));
    } catch {
      continue;
    }
  }
  return uniqueAds(ads).slice(0, limit);
}

function chromeExecutablePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => existsSync(candidate));
}

async function dumpPublicMetaLibraryHtml(chromePath: string, url: string) {
  const { stdout } = await execFileAsync(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--disable-background-networking",
      `--virtual-time-budget=${Math.max(3000, PUBLIC_META_SCRAPE_WAIT_MS)}`,
      "--dump-dom",
      url,
    ],
    {
      timeout: Math.max(5000, PUBLIC_META_SCRAPE_TIMEOUT_MS),
      maxBuffer: PUBLIC_META_MAX_BUFFER,
    },
  );
  return stdout;
}

export function parsePublicMetaLibraryHtml(
  html: string,
  args: { competitorName: string; sourceUrl: string; limit: number },
): CompetitorSpyAd[] {
  const text = decodeHtmlJson(html);
  const ads: CompetitorSpyAd[] = [];
  const starts = [...text.matchAll(/"(?:ad_archive_id|page_name)"\s*:/g)]
    .map((match) => match.index || 0)
    .filter((index, position, indexes) => position === 0 || index - indexes[position - 1] > 500);

  for (const index of starts) {
    const block = text.slice(Math.max(0, index - 6000), Math.min(text.length, index + 18000));
    const pageName = readJsonString(block, "page_name");
    const id = readJsonString(block, "ad_archive_id") || readJsonString(block, "ad_id") || readJsonString(block, "id");
    const snapshotUrl = readJsonString(block, "ad_snapshot_url") || readJsonString(block, "snapshot_url") || (id ? `https://www.facebook.com/ads/library/?id=${id}` : args.sourceUrl);
    const body = readNestedText(block, "body") || readJsonString(block, "ad_creative_body");
    const headline = readJsonString(block, "title") || readNestedText(block, "title") || readJsonString(block, "ad_creative_link_title");
    const description = readJsonString(block, "caption") || readNestedText(block, "caption") || readNestedText(block, "link_description") || readJsonString(block, "ad_creative_link_description");
    const platforms = readJsonArrayStrings(block, "publisher_platform").concat(readJsonArrayStrings(block, "publisher_platforms"));

    if (!pageName && !body && !headline && !id) continue;

    ads.push({
      id: id || `${args.competitorName}-${ads.length}`,
      source: "public",
      competitorName: args.competitorName,
      pageName: pageName || args.competitorName,
      platform: Array.from(new Set(platforms)).join(", ") || "Meta / Instagram",
      body,
      headline,
      description,
      cta: readJsonString(block, "cta_text") || readJsonString(block, "call_to_action"),
      format: readJsonString(block, "__typename") || "public-html",
      startDate: unixDateString(readJsonNumber(block, "start_date")) || readJsonString(block, "start_date"),
      endDate: unixDateString(readJsonNumber(block, "end_date")) || readJsonString(block, "end_date"),
      snapshotUrl,
      imageUrl: readJsonString(block, "resized_image_url") || readJsonString(block, "original_image_url"),
      videoUrl: readJsonString(block, "video_hd_url") || readJsonString(block, "video_sd_url"),
      landingUrl: readJsonString(block, "link_url") || readJsonString(block, "website_url"),
      raw: { mode: "public-html", sourceUrl: args.sourceUrl },
    });
    if (ads.length >= args.limit) break;
  }

  return uniqueAds(ads).slice(0, args.limit);
}

function buildApifyInput(args: SpyFetchArgs, actorId: string) {
  const template = process.env.APIFY_META_ADS_INPUT_TEMPLATE;
  if (template) {
    return replaceTemplate(JSON.parse(template), {
      competitors: args.competitors,
      country: normalizeCountry(args.country),
      limit: args.limit,
      libraryUrls: args.libraryUrls,
    });
  }

  const actorKey = actorId.trim().replaceAll("~", "/").toLocaleLowerCase();
  if (actorKey === "data_xplorer/facebook-ads-library" || actorKey === "mfgxmdyarjhtscl8h") {
    return buildApifyUrlsInput(args);
  }

  return {
    searchQueries: args.competitors,
    country: normalizeCountry(args.country),
    maxItems: args.limit,
    activeStatus: "active",
    startUrls: args.libraryUrls.map((url) => ({ url })),
  };
}

function buildApifyUrlsInput(args: SpyFetchArgs) {
  const urls = (args.libraryUrls.length
    ? args.libraryUrls
    : args.competitors.map((competitor) => metaLibrarySearchUrl(competitor, args.country)))
    .map((url) => ({ url }));
  const maxAdsPerUrl = Math.max(1, Math.ceil(args.limit / Math.max(1, urls.length)));
  return {
    urls,
    maxAds: maxAdsPerUrl,
    fetchDetails: false,
  };
}

function requiresUrlsInput(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /input\.urls.*required|required.*input\.urls/i.test(message);
}

function hasUsableUrlsInput(input: unknown) {
  if (!input || typeof input !== "object") return false;
  const urls = (input as Record<string, unknown>).urls;
  return Array.isArray(urls)
    && urls.length > 0
    && urls.every((item) => Boolean(
      item
      && typeof item === "object"
      && typeof (item as Record<string, unknown>).url === "string"
      && (item as Record<string, string>).url.trim(),
    ));
}

function metaLibrarySearchUrl(competitor: string, country: string) {
  const url = new URL("https://www.facebook.com/ads/library/");
  url.searchParams.set("active_status", "active");
  url.searchParams.set("ad_type", "all");
  url.searchParams.set("country", normalizeCountry(country));
  url.searchParams.set("q", competitor);
  url.searchParams.set("search_type", "keyword_unordered");
  return url.toString();
}

function replaceTemplate(value: unknown, vars: { competitors: string[]; country: string; limit: number; libraryUrls: string[] }): unknown {
  if (Array.isArray(value)) return value.map((item) => replaceTemplate(item, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTemplate(item, vars)]));
  }
  if (typeof value !== "string") return value;
  if (value === "{{competitors}}") return vars.competitors;
  if (value === "{{libraryUrls}}") return vars.libraryUrls;
  if (value === "{{startUrls}}") return vars.libraryUrls.map((url) => ({ url }));
  if (value === "{{limit}}") return vars.limit;
  return value
    .replaceAll("{{country}}", vars.country)
    .replaceAll("{{limit}}", String(vars.limit))
    .replaceAll("{{competitors_csv}}", vars.competitors.join(", "))
    .replaceAll("{{library_urls_csv}}", vars.libraryUrls.join(", "));
}

function normalizeMetaAd(row: Record<string, unknown>, competitorName: string): CompetitorSpyAd {
  const platforms = readStringArray(row.publisher_platforms).join(", ");
  return {
    id: readString(row.id) || `${competitorName}-${readString(row.ad_snapshot_url)}`,
    source: "meta_official",
    competitorName,
    pageName: readString(row.page_name),
    platform: platforms,
    body: readStringArray(row.ad_creative_bodies)[0],
    headline: readStringArray(row.ad_creative_link_titles)[0],
    description: readStringArray(row.ad_creative_link_descriptions)[0],
    startDate: readString(row.ad_delivery_start_time) || readString(row.ad_creation_time),
    endDate: readString(row.ad_delivery_stop_time),
    snapshotUrl: readString(row.ad_snapshot_url),
    landingUrl: readStringArray(row.ad_creative_link_captions)[0],
  };
}

function normalizeApifyAd(row: unknown, index: number): CompetitorSpyAd {
  const item = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
  const publicationDate = item.publicationDate && typeof item.publicationDate === "object"
    ? item.publicationDate as Record<string, unknown>
    : {};
  const archiveId = pick(item, ["adArchiveId", "adArchiveID", "archiveId", "libraryId"]);
  const id = archiveId || pick(item, ["id", "adId", "ad_id"])
    || `apify-${index}`;
  const snapshotUrl = metaLibraryEvidenceUrl(
    pick(item, ["snapshotUrl", "adSnapshotUrl", "ad_snapshot_url", "adLibraryUrl", "adUrl"]),
  ) || (archiveId ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(archiveId)}` : undefined);
  return {
    id,
    source: "apify",
    competitorName: pick(item, ["competitorName", "query", "searchQuery"]),
    pageName: pick(item, ["pageName", "page_name", "advertiserName", "advertiser", "brandName"]),
    platform: pickList(item, ["platforms", "publisherPlatforms", "publisher_platforms"])
      || pick(item, ["platform", "publisherPlatform"]),
    body: pick(item, ["body", "bodyText", "text", "copy", "adText", "adCreativeBody", "ad_creative_body", "adCreativeBodies"]),
    headline: pick(item, ["headline", "title", "adTitle", "adCreativeLinkTitle", "ad_creative_link_title"]),
    description: pick(item, ["description", "adDescription", "adCreativeLinkDescription"]),
    cta: pick(item, ["cta", "ctaText", "callToAction", "call_to_action", "buttonText"]),
    format: pick(item, ["format", "type", "mediaType", "adFormat"]),
    isActive: pickBoolean(item, ["isActive", "is_active", "active"]),
    startDate: pick(item, ["startDate", "adDeliveryStartTime", "ad_delivery_start_time", "startedAt"])
      || pick(publicationDate, ["startDate"]),
    endDate: pick(item, ["endDate", "adDeliveryStopTime", "ad_delivery_stop_time", "endedAt"])
      || pick(publicationDate, ["endDate"]),
    snapshotUrl,
    imageUrl: pickMediaUrl(item, ["imageUrl", "image", "adCreativeImageUrl", "ad_creative_image_url", "all_images"], [
      "url", "imageUrl", "resized_image_url", "original_image_url", "thumbnailUrl", "poster",
    ]),
    videoUrl: pickMediaUrl(item, ["videoUrl", "video", "adCreativeVideoUrl", "ad_creative_video_url", "all_videos"], [
      "video_hd_url", "video_sd_url", "url", "videoUrl", "src",
    ]),
    landingUrl: pick(item, ["landingUrl", "linkUrl", "destinationUrl", "urlTarget", "ad_creative_link_caption"]),
  };
}

function classifyEvidence(ad: CompetitorSpyAd, competitors: string[], collectedAt: string) {
  const requestedCompetitor = findRequestedCompetitor(ad, competitors);
  const advertiser = ad.pageName?.trim();
  const requestedKey = normalizedName(requestedCompetitor);
  const advertiserKey = normalizedName(advertiser);
  const sourceUrl = metaLibraryEvidenceUrl(ad.snapshotUrl);
  const hasUsableCreative = Boolean(sourceUrl && (
    ad.body?.trim()
    || ad.headline?.trim()
    || ad.description?.trim()
    || ad.imageUrl
    || ad.videoUrl
  ));

  if (requestedKey && advertiserKey === requestedKey && sourceUrl) {
    return {
      status: "accepted" as const,
      match: "exact" as const,
      reason: "exact_advertiser_trusted_source" as const,
      matchedToCompetitor: true,
      hasUsableCreative,
      requestedCompetitor,
      advertiser,
      sourceUrl,
      collectedAt,
    };
  }

  if (requestedKey && advertiserKey === requestedKey) {
    return {
      status: "needs_review" as const,
      match: "ambiguous" as const,
      reason: "exact_advertiser_missing_source" as const,
      matchedToCompetitor: true,
      hasUsableCreative,
      requestedCompetitor,
      advertiser,
      sourceUrl,
      collectedAt,
    };
  }

  if (requestedKey && advertiserKey && (
    advertiserKey.includes(requestedKey) || requestedKey.includes(advertiserKey)
  )) {
    return {
      status: "needs_review" as const,
      match: "ambiguous" as const,
      reason: "similar_advertiser" as const,
      matchedToCompetitor: true,
      hasUsableCreative,
      requestedCompetitor,
      advertiser,
      sourceUrl,
      collectedAt,
    };
  }

  return {
    status: "rejected" as const,
    match: "mismatch" as const,
    reason: advertiserKey ? "advertiser_mismatch" as const : "advertiser_unknown" as const,
    matchedToCompetitor: false,
    hasUsableCreative,
    requestedCompetitor,
    advertiser,
    sourceUrl,
    collectedAt,
  };
}

function findRequestedCompetitor(ad: CompetitorSpyAd, competitors: string[]) {
  const requestedKey = normalizedName(ad.competitorName);
  const explicitMatch = competitors.find((competitor) => normalizedName(competitor) === requestedKey);
  if (explicitMatch) return explicitMatch;

  const advertiserKey = normalizedName(ad.pageName);
  const advertiserMatches = competitors.filter((competitor) => {
    const competitorKey = normalizedName(competitor);
    return advertiserKey === competitorKey
      || (advertiserKey && competitorKey && (advertiserKey.includes(competitorKey) || competitorKey.includes(advertiserKey)));
  });
  if (advertiserMatches.length === 1) return advertiserMatches[0];

  return ad.competitorName?.trim() || "Unattributed result";
}

function normalizedName(value: string | undefined) {
  return value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") || "";
}

function metaLibraryEvidenceUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLocaleLowerCase();
    const isFacebookHost = host === "facebook.com" || host.endsWith(".facebook.com");
    const isLibraryPath = url.pathname === "/ads/library" || url.pathname === "/ads/library/";
    if (url.protocol !== "https:" || !isFacebookHost || !isLibraryPath) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function buildEvidenceCoverage(
  competitors: string[],
  ads: CompetitorSpyAd[],
): CompetitorEvidenceCoverage[] {
  return competitors.map((competitor) => {
    const rows = ads.filter(
      (ad) => normalizedName(ad.evidence?.requestedCompetitor) === normalizedName(competitor),
    );
    return {
      competitor,
      collected: rows.length,
      matched: rows.filter((ad) => ad.evidence?.matchedToCompetitor).length,
      mediaReady: rows.filter((ad) => ad.evidence?.hasUsableCreative).length,
      accepted: rows.filter((ad) => ad.evidence?.status === "accepted").length,
      needsReview: rows.filter((ad) => ad.evidence?.status === "needs_review").length,
      rejected: rows.filter((ad) => ad.evidence?.status === "rejected").length,
    };
  });
}

function pick(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) {
      const first = value.find((entry) => typeof entry === "string" && entry.trim());
      if (first) return first;
    }
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function pickList(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const values = readStringArray(item[key]);
    if (values.length) return values.join(", ");
  }
  return undefined;
}

function pickBoolean(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1 || value === "1") return true;
    if (value === "false" || value === 0 || value === "0") return false;
  }
  return undefined;
}

function pickMediaUrl(item: Record<string, unknown>, keys: string[], nestedKeys: string[]) {
  for (const key of keys) {
    const value = mediaUrlFromValue(item[key], nestedKeys);
    if (value) return value;
  }
  return undefined;
}

function mediaUrlFromValue(value: unknown, nestedKeys: string[]): string | undefined {
  if (typeof value === "string" && /^https:\/\//iu.test(value.trim())) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = mediaUrlFromValue(item, nestedKeys);
      if (nested) return nested;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of nestedKeys) {
    const nested = mediaUrlFromValue(record[key], nestedKeys);
    if (nested) return nested;
  }
  return undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function decodeHtmlJson(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function readJsonString(block: string, key: string) {
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "s");
  const match = block.match(pattern);
  return match?.[1] ? decodeJsonString(match[1]) : undefined;
}

function readNestedText(block: string, key: string) {
  const index = block.indexOf(`"${key}"`);
  if (index < 0) return undefined;
  return readJsonString(block.slice(index, index + 1600), "text");
}

function readJsonArrayStrings(block: string, key: string) {
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*\\[([^\\]]*)\\]`, "s");
  const match = block.match(pattern);
  if (!match?.[1]) return [];
  return [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)]
    .map((item) => decodeJsonString(item[1]))
    .filter(Boolean);
}

function readJsonNumber(block: string, key: string) {
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(\\d{6,})`);
  const match = block.match(pattern);
  return match?.[1] ? Number(match[1]) : undefined;
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value.replace(/\\\//g, "/").trim();
  }
}

function unixDateString(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return undefined;
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  return new Date(milliseconds).toISOString();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCountry(value: string) {
  const country = value.trim().toUpperCase();
  return country || "VN";
}

function pageLabelFromLibraryUrl(value: string) {
  try {
    const url = new URL(value);
    return url.searchParams.get("q") || url.searchParams.get("view_all_page_id") || undefined;
  } catch {
    return undefined;
  }
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "competitor";
}

function uniqueAds(ads: CompetitorSpyAd[]) {
  const seen = new Set<string>();
  return ads.filter((ad) => {
    const key = ad.snapshotUrl || ad.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
