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

  const input = buildApifyInput(args, actorId);
  let rows: unknown[];
  try {
    rows = await runApifyActor<unknown>({
      actorId,
      input,
      timeoutSeconds: 240,
    });
  } catch (error) {
    if (!requiresUrlsInput(error) || hasUsableUrlsInput(input)) throw error;
    rows = await runApifyActor<unknown>({
      actorId,
      input: buildApifyUrlsInput(args),
      timeoutSeconds: 240,
    });
  }
  const fetchedAt = new Date().toISOString();
  const ads = uniqueAds(rows.map((row, index) => normalizeApifyAd(row, index)))
    .slice(0, args.limit)
    .map((ad) => ({
      ...ad,
      evidence: classifyEvidence(ad, args.competitors, fetchedAt),
    }));

  return {
    source: "apify",
    ads,
    coverage: buildEvidenceCoverage(args.competitors, ads),
    warnings: rows.length ? [] : ["Apify returned no ads. Check actor input mapping or competitor/page URL."],
    fetchedAt,
  };
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
  return {
    urls,
    maxAds: args.limit,
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
    raw: row,
  };
}

function normalizeApifyAd(row: unknown, index: number): CompetitorSpyAd {
  const item = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
  return {
    id: pick(item, ["id", "adId", "ad_id", "archiveId", "libraryId"]) || `apify-${index}`,
    source: "apify",
    competitorName: pick(item, ["competitorName", "query", "searchQuery"]),
    pageName: pick(item, ["pageName", "page_name", "advertiserName", "advertiser", "brandName"]),
    platform: pick(item, ["platform", "publisherPlatform", "publisher_platforms"]),
    body: pick(item, ["body", "text", "copy", "adText", "adCreativeBody", "ad_creative_body", "adCreativeBodies"]),
    headline: pick(item, ["headline", "title", "adTitle", "adCreativeLinkTitle", "ad_creative_link_title"]),
    description: pick(item, ["description", "adDescription", "adCreativeLinkDescription"]),
    cta: pick(item, ["cta", "callToAction", "call_to_action", "buttonText"]),
    format: pick(item, ["format", "type", "mediaType", "adFormat"]),
    startDate: pick(item, ["startDate", "adDeliveryStartTime", "ad_delivery_start_time", "startedAt"]),
    endDate: pick(item, ["endDate", "adDeliveryStopTime", "ad_delivery_stop_time", "endedAt"]),
    snapshotUrl: pick(item, ["snapshotUrl", "adSnapshotUrl", "ad_snapshot_url", "url", "adUrl"]),
    imageUrl: pick(item, ["imageUrl", "image", "adCreativeImageUrl", "ad_creative_image_url"]),
    videoUrl: pick(item, ["videoUrl", "video", "adCreativeVideoUrl", "ad_creative_video_url"]),
    landingUrl: pick(item, ["landingUrl", "linkUrl", "destinationUrl", "urlTarget", "ad_creative_link_caption"]),
    raw: row,
  };
}

function classifyEvidence(ad: CompetitorSpyAd, competitors: string[], collectedAt: string) {
  const requestedCompetitor = findRequestedCompetitor(ad, competitors);
  const advertiser = ad.pageName?.trim();
  const requestedKey = normalizedName(requestedCompetitor);
  const advertiserKey = normalizedName(advertiser);
  const sourceUrl = ad.snapshotUrl;

  if (requestedKey && advertiserKey === requestedKey) {
    return {
      status: "accepted" as const,
      match: "exact" as const,
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
      requestedCompetitor,
      advertiser,
      sourceUrl,
      collectedAt,
    };
  }

  return {
    status: "rejected" as const,
    match: "mismatch" as const,
    requestedCompetitor,
    advertiser,
    sourceUrl,
    collectedAt,
  };
}

function findRequestedCompetitor(ad: CompetitorSpyAd, competitors: string[]) {
  const requestedKey = normalizedName(ad.competitorName);
  return competitors.find((competitor) => normalizedName(competitor) === requestedKey)
    || ad.competitorName?.trim()
    || competitors[0]
    || "Unknown competitor";
}

function normalizedName(value: string | undefined) {
  return value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") || "";
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
