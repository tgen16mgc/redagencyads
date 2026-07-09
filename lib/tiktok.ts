import { runApifyActor } from "@/lib/apify";
import type { TikTokAdLibraryRow, TikTokLibraryReport, TikTokProfile, TikTokProfileResult, TikTokVideo } from "@/lib/types";

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
};

const DEFAULT_PROFILE_ACTOR_ID = "clockworks/tiktok-profile-scraper";
const DEFAULT_ADS_ACTOR_ID = "data_xplorer/tiktok-ads-library-fast";

export async function fetchTikTokProfiles(args: TikTokProfileArgs): Promise<TikTokProfileResult> {
  const actorId = process.env.APIFY_TIKTOK_PROFILE_ACTOR_ID || DEFAULT_PROFILE_ACTOR_ID;
  const profiles = args.profiles.map(normalizeProfileInput);
  const input = buildProfileInput(profiles, args.resultsPerPage);
  const items = await runApifyActor<Record<string, unknown>>({ actorId, input, timeoutSeconds: 240 });
  const warnings = items.flatMap(profileWarning);
  const validItems = items.filter((item) => !item.error && !item.errorCode);
  return {
    profiles: uniqueProfiles(validItems.map(normalizeProfile).filter((profile): profile is TikTokProfile => Boolean(profile))),
    videos: validItems.map(normalizeVideo).filter((video): video is TikTokVideo => Boolean(video)),
    warnings,
    pulledAt: new Date().toISOString(),
  };
}

export async function fetchTikTokAdLibrary(args: TikTokAdLibraryArgs): Promise<TikTokLibraryReport> {
  const actorId = process.env.APIFY_TIKTOK_ADS_ACTOR_ID || DEFAULT_ADS_ACTOR_ID;
  const input = buildAdsInput(args);
  const rows = await runApifyActor<Record<string, unknown>>({ actorId, input, timeoutSeconds: 240 });
  return {
    rows: rows.map(normalizeAdLibraryRow),
    warnings: ["TikTok rows are public TikTok Ad Library intelligence, not owned TikTok Ads Manager performance."],
    actorId,
    pulledAt: new Date().toISOString(),
  };
}

function buildProfileInput(profiles: string[], resultsPerPage: number) {
  const template = process.env.APIFY_TIKTOK_PROFILE_INPUT_TEMPLATE;
  if (template) return replaceTemplate(JSON.parse(template), { profiles, resultsPerPage });
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

function buildAdsInput(args: TikTokAdLibraryArgs) {
  const template = process.env.APIFY_TIKTOK_ADS_INPUT_TEMPLATE;
  if (template) return replaceTemplate(JSON.parse(template), args);
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

function replaceTemplate(value: unknown, vars: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => replaceTemplate(item, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTemplate(item, vars)]));
  }
  if (typeof value !== "string") return value;
  const exactKey = value.match(/^{{([a-zA-Z0-9_]+)}}$/)?.[1];
  if (exactKey && exactKey in vars) return vars[exactKey];
  return Object.entries(vars).reduce((result, [key, item]) => {
    return result.replaceAll(`{{${key}}}`, Array.isArray(item) ? item.join(", ") : String(item ?? ""));
  }, value);
}

function normalizeProfileInput(value: string) {
  return value.trim().replace(/^@/, "");
}

function profileWarning(item: Record<string, unknown>) {
  if (!item.error && !item.errorCode) return [];
  const input = readString(item.input) || readString(item.url) || "TikTok profile";
  return [`${input}: ${readString(item.error) || readString(item.errorCode) || "Unable to fetch profile."}`];
}

function normalizeProfile(item: Record<string, unknown>): TikTokProfile | undefined {
  const author = readRecord(item.authorMeta);
  const username = readString(author.name) || readString(item.username) || readString(item.input);
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

function normalizeVideo(item: Record<string, unknown>): TikTokVideo | undefined {
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

function normalizeAdLibraryRow(item: Record<string, unknown>): TikTokAdLibraryRow {
  const details = readRecord(item["Ad Details"]);
  const media = readRecord(item["Ad Media"]);
  const audience = readRecord(item["Ad Audience"]);
  const targeting = readRecord(item["Ad Targeting"]);
  const impressions = readRange(details.impressions) || readRange(item.impressions);
  const reach = readRange(details.reach) || readRange(item.reach);
  const spend = readRange(details.spend) || readRange(item.spend);
  return {
    id: readString(item["AD ID"]) || readString(item.adId) || readString(item.id) || "tiktok-ad",
    advertiserName: readString(item["Advertiser Name"]) || readString(item.advertiserName),
    adTitle: readString(item["Ad Title"]) || readString(item.adTitle),
    caption: readString(item.caption) || readString(details.caption),
    cta: readString(details.cta) || readString(item.cta),
    landingUrl: readString(details.landingUrl) || readString(details.clickUrl) || readString(item.clickUrl),
    previewUrl: readString(item["AD Preview"]) || readString(item["Ad Detail URL"]) || readString(item.previewUrl),
    imageUrl: readString(media.coverUrl) || firstString(media.imageUrls) || firstString(item.imageUrls),
    videoUrl: readString(media.videoUrl) || firstString(media.videoUrls),
    firstSeen: readString(item.firstSeen),
    lastSeen: readString(item.lastSeen),
    impressionsLower: impressions?.lower,
    impressionsUpper: impressions?.upper,
    reachLower: reach?.lower,
    reachUpper: reach?.upper,
    spendLower: spend?.lower,
    spendUpper: spend?.upper,
    audienceMin: readNumber(audience.min),
    audienceMax: readNumber(audience.max),
    regions: readStringArray(targeting.regions),
    targeting: Object.keys(targeting).length ? targeting : undefined,
    raw: item,
  };
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
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function firstString(value: unknown) {
  return Array.isArray(value) ? value.find((item): item is string => typeof item === "string" && Boolean(item.trim())) : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readRange(value: unknown) {
  const record = readRecord(value);
  const lower = readNumber(record.lowerBound) ?? readNumber(record.min);
  const upper = readNumber(record.upperBound) ?? readNumber(record.max);
  if (lower === undefined && upper === undefined) return undefined;
  return { lower, upper };
}
