import type { CompetitorFetchResult, CompetitorFetchSource, CompetitorSpyAd } from "@/lib/types";

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

export async function fetchCompetitorAds(args: SpyFetchArgs): Promise<CompetitorFetchResult> {
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
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchApifyAds(args: SpyFetchArgs): Promise<CompetitorFetchResult> {
  const token = process.env.APIFY_TOKEN;
  const actorId = process.env.APIFY_META_ADS_ACTOR_ID;
  if (!token || !actorId) {
    throw new Error("APIFY_TOKEN and APIFY_META_ADS_ACTOR_ID are required for Apify competitor spy.");
  }

  const input = buildApifyInput(args);
  const actorPath = actorId.replace("/", "~");
  const url = new URL(`https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items`);
  url.searchParams.set("clean", "true");
  url.searchParams.set("format", "json");
  url.searchParams.set("timeout", "240");

  const response = await fetch(url.toString(), {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || "Apify actor run failed.");
  const rows = Array.isArray(json) ? json : [];

  return {
    source: "apify",
    ads: uniqueAds(rows.map((row, index) => normalizeApifyAd(row, index))).slice(0, args.limit),
    warnings: rows.length ? [] : ["Apify returned no ads. Check actor input mapping or competitor/page URL."],
    fetchedAt: new Date().toISOString(),
  };
}

function buildApifyInput(args: SpyFetchArgs) {
  const template = process.env.APIFY_META_ADS_INPUT_TEMPLATE;
  if (template) {
    return replaceTemplate(JSON.parse(template), {
      competitors: args.competitors,
      country: normalizeCountry(args.country),
      limit: args.limit,
      libraryUrls: args.libraryUrls,
    });
  }
  return {
    searchQueries: args.competitors,
    country: normalizeCountry(args.country),
    maxItems: args.limit,
    activeStatus: "active",
    startUrls: args.libraryUrls.map((url) => ({ url })),
  };
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

function normalizeCountry(value: string) {
  const country = value.trim().toUpperCase();
  return country || "VN";
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
