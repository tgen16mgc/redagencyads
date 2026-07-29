import type {
  CanonicalCreativeRow,
  CanonicalPerformanceRow,
  CanonicalPlatform,
} from "@/lib/cross-channel";
import {
  creativeFingerprint,
  normalizeContentSha256,
} from "@/lib/cross-channel";
import {
  boundedMediaHashNumber,
  fetchHttpsMediaSha256,
} from "@/lib/media-content-hash";

export type OAuthProvider = "google" | "linkedin";

export const DEFAULT_GOOGLE_ADS_API_VERSION = "v25";
export const DEFAULT_LINKEDIN_API_VERSION = "202607";

function googleAdsApiVersion(value?: string) {
  return value && /^v\d+$/u.test(value)
    ? value
    : DEFAULT_GOOGLE_ADS_API_VERSION;
}

function linkedInApiVersion(value?: string) {
  return value && /^\d{6}$/u.test(value) ? value : DEFAULT_LINKEDIN_API_VERSION;
}

export type OAuthConfig = {
  provider: OAuthProvider;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: readonly string[];
  authorizationEndpoint: string;
  tokenEndpoint: string;
};

export type OAuthToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
};

export type ConnectorSyncResult = {
  platform: CanonicalPlatform;
  source: string;
  fetchedAt: string;
  rows: CanonicalPerformanceRow[];
  creatives: CanonicalCreativeRow[];
  warnings: string[];
};

export function buildOAuthAuthorizationUrl(
  config: OAuthConfig,
  state: string,
  codeChallenge?: string,
) {
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  if (config.provider === "google")
    url.searchParams.set("access_type", "offline");
  return url;
}

export async function exchangeOAuthCode(
  config: OAuthConfig,
  code: string,
  codeVerifier?: string,
): Promise<OAuthToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
  });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error(
      `${config.provider} OAuth token exchange failed (${response.status}).`,
    );
  }
  return {
    accessToken: payload.access_token,
    refreshToken:
      typeof payload.refresh_token === "string"
        ? payload.refresh_token
        : undefined,
    expiresAt:
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : undefined,
    scope: typeof payload.scope === "string" ? payload.scope : undefined,
  };
}

export async function refreshOAuthToken(
  config: OAuthConfig,
  refreshToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<OAuthToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);
  const response = await fetchFn(config.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== "string")
    throw new Error(
      `${config.provider} OAuth token refresh failed (${response.status}).`,
    );
  return {
    accessToken: payload.access_token,
    refreshToken:
      typeof payload.refresh_token === "string"
        ? payload.refresh_token
        : refreshToken,
    expiresAt:
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : undefined,
    scope: typeof payload.scope === "string" ? payload.scope : undefined,
  };
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return 0;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readStringAt(value: unknown, key: string) {
  return readString(readRecord(value)[key]);
}

function dateValue(value: unknown, fallback: string) {
  const date = readString(value);
  return date && /^\d{4}-\d{2}-\d{2}$/u.test(date) ? date : fallback;
}

function linkedInDate(row: Record<string, unknown>, fallback: string) {
  const direct = dateValue(row.date || row.day, "");
  if (direct) return direct;
  const range = readRecord(row.dateRange);
  const start = readRecord(range.start);
  const year = readNumber(start.year);
  const month = readNumber(start.month);
  const day = readNumber(start.day);
  return year && month && day
    ? `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
    : fallback;
}

function canonicalRow(input: {
  id: string;
  platform: CanonicalPlatform;
  date: string;
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  adSetName?: string;
  adId?: string;
  adName?: string;
  creativeId?: string;
  objective?: string;
  audienceSegment?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  viewThroughConversions?: number;
  videoViews?: number;
  watchTimeMinutes?: number;
}): CanonicalPerformanceRow {
  return {
    schemaVersion: "1.0",
    id: input.id,
    platform: input.platform,
    authority: "owned_performance",
    grain: input.adId ? "ad" : input.adSetId ? "ad_set" : "campaign",
    date: input.date,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    adSetId: input.adSetId,
    adSetName: input.adSetName,
    adId: input.adId,
    adName: input.adName,
    creativeId: input.creativeId,
    objective: input.objective,
    audienceSegment: input.audienceSegment,
    spend: Math.max(0, input.spend || 0),
    impressions: Math.max(0, input.impressions || 0),
    clicks: Math.max(0, input.clicks || 0),
    conversions: Math.max(0, input.conversions || 0),
    revenue: Math.max(0, input.revenue || 0),
    viewThroughConversions: Math.max(0, input.viewThroughConversions || 0),
    videoViews:
      input.videoViews === undefined
        ? undefined
        : Math.max(0, input.videoViews),
    watchTimeMinutes:
      input.watchTimeMinutes === undefined
        ? undefined
        : Math.max(0, input.watchTimeMinutes),
  };
}

function creativeRow(input: {
  id: string;
  platform: CanonicalPlatform;
  advertiser?: string;
  title?: string;
  caption?: string;
  format?: CanonicalCreativeRow["format"];
  cta?: string;
  landingUrl?: string;
  mediaUrl?: string;
  firstSeen?: string;
  lastSeen?: string;
  performanceScore?: number;
  contentHash?: string;
}): CanonicalCreativeRow {
  const contentHash = normalizeContentSha256(input.contentHash);
  const fingerprint = creativeFingerprint({
    advertiser: input.advertiser,
    caption: input.caption || input.title || input.id,
    mediaUrl: input.mediaUrl,
    landingUrl: input.landingUrl,
    contentHash,
  });
  return {
    schemaVersion: "1.0",
    id: input.id,
    creativeId: `creative:${fingerprint}`,
    platform: input.platform,
    authority: "owned_performance",
    advertiser: input.advertiser,
    title: input.title,
    caption: input.caption,
    format: input.format || "unknown",
    cta: input.cta,
    landingUrl: input.landingUrl,
    mediaUrl: input.mediaUrl,
    firstSeen: input.firstSeen,
    lastSeen: input.lastSeen,
    performanceScore: input.performanceScore,
    contentHash,
    fingerprintMethod: contentHash ? "content_sha256" : "metadata",
    fingerprint,
  };
}

export function normalizeGoogleAdsRows(
  rows: unknown[],
  dateFallback: string,
): ConnectorSyncResult {
  const normalizedRows: CanonicalPerformanceRow[] = [];
  const creatives: CanonicalCreativeRow[] = [];
  const warnings: string[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      warnings.push("Ignored a non-object Google Ads row.");
      continue;
    }
    const row = item as Record<string, unknown>;
    const campaign = (row.campaign || {}) as Record<string, unknown>;
    const adGroup = (row.adGroup || row.ad_group || {}) as Record<
      string,
      unknown
    >;
    const adGroupAd = readRecord(row.adGroupAd || row.ad_group_ad);
    const ad = readRecord(adGroupAd.ad || row.asset);
    const responsiveSearchAd = readRecord(
      ad.responsiveSearchAd || ad.responsive_search_ad,
    );
    const imageAd = readRecord(ad.imageAd || ad.image_ad);
    const headlines = Array.isArray(responsiveSearchAd.headlines)
      ? responsiveSearchAd.headlines
      : [];
    const descriptions = Array.isArray(responsiveSearchAd.descriptions)
      ? responsiveSearchAd.descriptions
      : [];
    const metrics = (row.metrics || {}) as Record<string, unknown>;
    const campaignId = readString(campaign.id);
    const adGroupId = readString(adGroup.id);
    const adId = readString(ad.id);
    const rowId = adId || adGroupId || campaignId || readString(row.id);
    if (!rowId) {
      warnings.push(
        "Ignored a Google Ads row without a stable campaign, ad group, asset, or row id.",
      );
      continue;
    }
    const spend =
      readNumber(metrics.costMicros ?? metrics.cost_micros) / 1_000_000;
    const revenue =
      readNumber(
        metrics.conversionsValue ??
          metrics.conversions_value ??
          metrics.conversionsValueMicros,
      ) / (metrics.conversionsValueMicros ? 1_000_000 : 1);
    const sourceCreativeId = adId || readString(row.assetId) || rowId;
    const adType = readString(ad.type)?.toLocaleLowerCase() || "";
    const title =
      readStringAt(headlines[0], "text") ||
      readString(ad.name) ||
      sourceCreativeId;
    const caption =
      readStringAt(descriptions[0], "text") || readString(ad.description);
    const finalUrls = Array.isArray(ad.finalUrls)
      ? ad.finalUrls
      : Array.isArray(ad.final_urls)
        ? ad.final_urls
        : [];
    const normalizedCreative = creativeRow({
      id: `google_ads:creative:${sourceCreativeId}`,
      platform: "google_ads",
      title,
      caption,
      format: adType.includes("video")
        ? "video"
        : adType.includes("image") || adType.includes("display")
          ? "image"
          : "text",
      landingUrl:
        readString(finalUrls[0]) ||
        readString(ad.finalUrl) ||
        readString(ad.final_url),
      mediaUrl:
        readString(imageAd.imageUrl) ||
        readString(imageAd.image_url) ||
        readString(ad.mediaUrl) ||
        readString(ad.media_url),
      contentHash:
        readString(row.contentSha256) ||
        readString(row.content_sha256) ||
        readString(ad.contentSha256) ||
        readString(ad.content_sha256),
    });
    normalizedRows.push(
      canonicalRow({
        id: `google_ads:${rowId}:${dateValue(row.date, dateFallback)}`,
        platform: "google_ads",
        date: dateValue(row.date, dateFallback),
        campaignId,
        campaignName: readString(campaign.name),
        adSetId: adGroupId,
        adSetName: readString(adGroup.name),
        adId,
        adName: readString(ad.name),
        creativeId: normalizedCreative.creativeId,
        objective:
          readString(campaign.advertisingChannelType) ||
          readString(campaign.advertising_channel_type),
        spend,
        impressions: readNumber(metrics.impressions),
        clicks: readNumber(metrics.clicks),
        conversions: readNumber(metrics.conversions),
        revenue,
        viewThroughConversions: readNumber(
          metrics.viewThroughConversions ?? metrics.view_through_conversions,
        ),
      }),
    );
    creatives.push(normalizedCreative);
  }
  return {
    platform: "google_ads",
    source: "google_ads_api",
    fetchedAt: new Date().toISOString(),
    rows: normalizedRows,
    creatives,
    warnings,
  };
}

export function normalizeYouTubeAnalyticsRows(
  rows: unknown[],
  dateFallback: string,
): ConnectorSyncResult {
  const normalizedRows: CanonicalPerformanceRow[] = [];
  const creatives: CanonicalCreativeRow[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const videoId =
      readString(row.video) || readString(row.videoId) || readString(row.id);
    if (!videoId) continue;
    const date = dateValue(row.day || row.date, dateFallback);
    const creative = creativeRow({
      id: `youtube:creative:${videoId}`,
      platform: "youtube",
      title: readString(row.title) || videoId,
      format: "video",
      mediaUrl: readString(row.thumbnailUrl),
      firstSeen: date,
      contentHash:
        readString(row.contentSha256) || readString(row.content_sha256),
    });
    normalizedRows.push(
      canonicalRow({
        id: `youtube:${videoId}:${date}`,
        platform: "youtube",
        date,
        adId: videoId,
        adName: readString(row.title),
        creativeId: creative.creativeId,
        impressions: readNumber(row.views || row.impressions),
        clicks: readNumber(row.cardClicks || row.clicks),
        conversions: readNumber(row.subscribersGained || row.conversions),
        revenue: readNumber(row.estimatedRevenue || row.revenue),
        viewThroughConversions: readNumber(row.viewThroughConversions),
        videoViews: readNumber(row.views || row.videoViews),
        watchTimeMinutes: readNumber(
          row.estimatedMinutesWatched || row.watchTimeMinutes,
        ),
      }),
    );
    creatives.push(creative);
  }
  return {
    platform: "youtube",
    source: "youtube_analytics_api",
    fetchedAt: new Date().toISOString(),
    rows: normalizedRows,
    creatives,
    warnings: [],
  };
}

export function normalizeLinkedInRows(
  rows: unknown[],
  dateFallback: string,
): ConnectorSyncResult {
  const normalizedRows: CanonicalPerformanceRow[] = [];
  const creatives: CanonicalCreativeRow[] = [];
  const warnings: string[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const campaign = (row.campaign || {}) as Record<string, unknown>;
    const creative = (row.creative || {}) as Record<string, unknown>;
    const id = readString(row.id) || readString(campaign.id);
    if (!id) {
      warnings.push("Ignored a LinkedIn row without an id.");
      continue;
    }
    const spend = readNumber(row.costInLocalCurrency ?? row.spend);
    const conversions = readNumber(
      row.externalWebsiteConversions ??
        row.leadGenerationMailContactInfoShares ??
        row.leadGenFormFills ??
        row.conversions,
    );
    const sourceCreativeId =
      readString(row.creativeId) || readString(creative.id) || id;
    const normalizedCreative = creativeRow({
      id: `linkedin:creative:${sourceCreativeId}`,
      platform: "linkedin",
      advertiser: readString(row.accountName),
      title:
        readString(creative.name) || readString(row.adName) || sourceCreativeId,
      caption: readString(creative.text) || readString(row.commentary),
      format: readString(creative.type)?.toLocaleLowerCase().includes("video")
        ? "video"
        : readString(creative.type)?.toLocaleLowerCase().includes("image")
          ? "image"
          : "unknown",
      landingUrl:
        readString(creative.landingPageUrl) || readString(row.landingUrl),
      mediaUrl: readString(creative.imageUrl) || readString(creative.videoUrl),
      contentHash:
        readString(row.contentSha256) ||
        readString(row.content_sha256) ||
        readString(creative.contentSha256) ||
        readString(creative.content_sha256),
    });
    normalizedRows.push(
      canonicalRow({
        id: `linkedin:${id}:${dateValue(row.date, dateFallback)}`,
        platform: "linkedin",
        date: dateValue(row.date, dateFallback),
        campaignId: readString(campaign.id) || id,
        campaignName: readString(campaign.name) || readString(row.campaignName),
        adId: sourceCreativeId,
        adName: readString(creative.name) || readString(row.adName),
        creativeId: normalizedCreative.creativeId,
        objective:
          readString(campaign.objectiveType) || readString(row.objective),
        audienceSegment:
          readString(row.jobTitle) ||
          readString(row.companyName) ||
          readString(row.audienceSegment),
        spend,
        impressions: readNumber(row.impressions),
        clicks: readNumber(row.clicks),
        conversions,
        revenue: readNumber(row.revenue),
        viewThroughConversions: readNumber(
          row.viewThroughConversions ?? row.externalWebsitePostViewConversions,
        ),
        videoViews: readNumber(row.videoViews),
      }),
    );
    creatives.push(normalizedCreative);
  }
  return {
    platform: "linkedin",
    source: "linkedin_marketing_api",
    fetchedAt: new Date().toISOString(),
    rows: normalizedRows,
    creatives,
    warnings,
  };
}

export type LinkedInB2BMetricRow = {
  targetAccount: string;
  jobTitle?: string;
  leadGenFormFills: number;
  companyEngagement: number;
  impressions: number;
  clicks: number;
  spend: number;
};

export type LinkedInB2BBreakdown = {
  companyRows: LinkedInB2BMetricRow[];
  jobTitleRows: LinkedInB2BMetricRow[];
};

export function rollupLinkedInTargetAccounts(
  rows: LinkedInB2BMetricRow[],
  targetAccounts: string[],
) {
  const targets = new Set(
    targetAccounts
      .map((account) => account.trim().toLocaleLowerCase())
      .filter(Boolean),
  );
  const grouped = new Map<string, LinkedInB2BMetricRow[]>();
  for (const row of rows) {
    if (targets.size && !targets.has(row.targetAccount.toLocaleLowerCase()))
      continue;
    const bucket = grouped.get(row.targetAccount) || [];
    bucket.push(row);
    grouped.set(row.targetAccount, bucket);
  }
  return [...grouped.entries()]
    .map(([targetAccount, values]) => ({
      targetAccount,
      leadGenFormFills: values.reduce(
        (sum, row) => sum + row.leadGenFormFills,
        0,
      ),
      companyEngagement: values.reduce(
        (sum, row) => sum + row.companyEngagement,
        0,
      ),
      impressions: values.reduce((sum, row) => sum + row.impressions, 0),
      clicks: values.reduce((sum, row) => sum + row.clicks, 0),
      spend: values.reduce((sum, row) => sum + row.spend, 0),
      jobTitles: Array.from(
        new Set(
          values
            .map((row) => row.jobTitle)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    }))
    .sort(
      (left, right) =>
        right.leadGenFormFills - left.leadGenFormFills ||
        right.companyEngagement - left.companyEngagement,
    );
}

export function rollupLinkedInJobTitles(rows: LinkedInB2BMetricRow[]) {
  const grouped = new Map<string, LinkedInB2BMetricRow[]>();
  for (const row of rows) {
    const jobTitle = row.jobTitle?.trim();
    if (!jobTitle) continue;
    const bucket = grouped.get(jobTitle) || [];
    bucket.push(row);
    grouped.set(jobTitle, bucket);
  }
  return [...grouped.entries()]
    .map(([jobTitle, values]) => ({
      jobTitle,
      leadGenFormFills: values.reduce(
        (sum, row) => sum + row.leadGenFormFills,
        0,
      ),
      companyEngagement: values.reduce(
        (sum, row) => sum + row.companyEngagement,
        0,
      ),
      impressions: values.reduce((sum, row) => sum + row.impressions, 0),
      clicks: values.reduce((sum, row) => sum + row.clicks, 0),
      spend: values.reduce((sum, row) => sum + row.spend, 0),
    }))
    .sort(
      (left, right) =>
        right.leadGenFormFills - left.leadGenFormFills ||
        right.companyEngagement - left.companyEngagement,
    );
}

export function connectorPlatformFor(
  provider: string,
): CanonicalPlatform | undefined {
  const values: Record<string, CanonicalPlatform> = {
    google: "google_ads",
    google_ads: "google_ads",
    youtube: "youtube",
    youtube_analytics: "youtube",
    linkedin: "linkedin",
    linkedin_ads: "linkedin",
  };
  return values[provider.toLocaleLowerCase()];
}

export async function enrichConnectorCreativeContentHashes(input: {
  result: ConnectorSyncResult;
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
      process.env.CONNECTOR_MEDIA_HASH_MAX_ASSETS,
      250,
      0,
    ),
  );
  const maxBytes = boundedMediaHashNumber(
    input.maxBytes,
    process.env.CONNECTOR_MEDIA_HASH_MAX_BYTES,
    10 * 1024 * 1024,
    1,
  );
  const timeoutMs = boundedMediaHashNumber(
    input.timeoutMs,
    process.env.CONNECTOR_MEDIA_HASH_TIMEOUT_MS,
    15_000,
    1000,
  );
  const concurrency = Math.floor(
    boundedMediaHashNumber(input.concurrency, undefined, 4, 1),
  );
  const candidates = input.result.creatives
    .map((creative, index) => ({ creative, index }))
    .filter(({ creative }) => !creative.contentHash && creative.mediaUrl)
    .slice(0, maxAssets);
  const creatives = input.result.creatives.map((creative) => ({ ...creative }));
  const relink = new Map<string, string>();
  const failures: string[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor];
      cursor += 1;
      const mediaUrl = candidate.creative.mediaUrl!;
      try {
        const contentHash = await fetchHttpsMediaSha256({
          mediaUrl,
          maxBytes,
          timeoutMs,
          fetchFn,
        });
        const fingerprint = creativeFingerprint({ contentHash });
        relink.set(candidate.creative.creativeId, `creative:${fingerprint}`);
        creatives[candidate.index] = {
          ...candidate.creative,
          creativeId: `creative:${fingerprint}`,
          contentHash,
          fingerprint,
          fingerprintMethod: "content_sha256",
        };
      } catch (error) {
        if (failures.length < 20)
          failures.push(
            `${candidate.creative.id}: ${error instanceof Error ? error.message : "Media hashing failed."}`,
          );
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, () =>
      worker(),
    ),
  );
  const skipped = Math.max(
    0,
    input.result.creatives.filter(
      (creative) => !creative.contentHash && creative.mediaUrl,
    ).length - candidates.length,
  );
  return {
    ...input.result,
    rows: input.result.rows.map((row) => ({
      ...row,
      creativeId: row.creativeId
        ? relink.get(row.creativeId) || row.creativeId
        : undefined,
    })),
    creatives,
    warnings: [
      ...input.result.warnings,
      ...failures.map((failure) => `Media hash skipped: ${failure}`),
      ...(skipped
        ? [
            `Media hashing capped at ${maxAssets} assets; ${skipped} additional assets retained metadata fingerprints.`,
          ]
        : []),
    ],
  } satisfies ConnectorSyncResult;
}

export async function fetchGoogleAdsRows(input: {
  accessToken: string;
  customerId: string;
  developerToken: string;
  loginCustomerId?: string;
  since: string;
  until: string;
  apiVersion?: string;
  fetchFn?: typeof fetch;
}) {
  const fetchFn = input.fetchFn || fetch;
  const customerId = input.customerId.replace(/\D/gu, "");
  const apiVersion = googleAdsApiVersion(
    input.apiVersion || process.env.GOOGLE_ADS_API_VERSION,
  );
  const query = `SELECT segments.date, campaign.id, campaign.name, campaign.advertising_channel_type, ad_group.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.image_ad.image_url, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.view_through_conversions FROM ad_group_ad WHERE segments.date BETWEEN '${input.since}' AND '${input.until}'`;
  const response = await fetchFn(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "developer-token": input.developerToken,
        ...(input.loginCustomerId
          ? { "login-customer-id": input.loginCustomerId.replace(/\D/gu, "") }
          : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const payload = await response.json().catch(() => []);
  if (!response.ok)
    throw new Error(`Google Ads report fetch failed (${response.status}).`);
  const segments = Array.isArray(payload) ? payload : [payload];
  return segments.flatMap((segment) =>
    Array.isArray(segment?.results)
      ? segment.results.map((row: Record<string, unknown>) => ({
          ...row,
          date: readRecord(row.segments).date,
        }))
      : [],
  );
}

export async function updateGoogleAdsCampaignBudget(input: {
  accessToken: string;
  customerId: string;
  developerToken: string;
  campaignBudgetId: string;
  amount: number;
  loginCustomerId?: string;
  apiVersion?: string;
  fetchFn?: typeof fetch;
}) {
  const fetchFn = input.fetchFn || fetch;
  const customerId = input.customerId.replace(/\D/gu, "");
  if (!customerId)
    throw new Error("A valid Google Ads customer ID is required.");
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    throw new Error("Google Ads budget amount must be greater than zero.");

  const suppliedResource = input.campaignBudgetId.trim();
  const resourceMatch = suppliedResource.match(
    /^customers\/(\d+)\/campaignBudgets\/(\d+)$/u,
  );
  if (resourceMatch && resourceMatch[1] !== customerId) {
    throw new Error(
      "Google Ads campaign budget belongs to a different customer.",
    );
  }
  const budgetId =
    resourceMatch?.[2] ||
    suppliedResource.match(/(?:campaignBudgets\/)?(\d+)$/u)?.[1];
  if (!budgetId)
    throw new Error(
      "A Google Ads campaign budget ID or resource name is required.",
    );

  const resourceName = `customers/${customerId}/campaignBudgets/${budgetId}`;
  const amountMicros = Math.round(input.amount * 1_000_000);
  const apiVersion = googleAdsApiVersion(
    input.apiVersion || process.env.GOOGLE_ADS_API_VERSION,
  );
  const response = await fetchFn(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/campaignBudgets:mutate`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "developer-token": input.developerToken,
        ...(input.loginCustomerId
          ? { "login-customer-id": input.loginCustomerId.replace(/\D/gu, "") }
          : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operations: [
          {
            update: { resourceName, amountMicros: String(amountMicros) },
            updateMask: "amount_micros",
          },
        ],
        partialFailure: false,
        validateOnly: false,
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `Google Ads campaign budget update failed (${response.status}).`,
    );
  return {
    resourceName,
    amount: input.amount,
    amountMicros,
    result: Array.isArray(payload.results) ? payload.results[0] : undefined,
  };
}

type GoogleAdsWriteInput = {
  accessToken: string;
  customerId: string;
  developerToken: string;
  loginCustomerId?: string;
  apiVersion?: string;
  fetchFn?: typeof fetch;
};

function googleAdsWriteHeaders(input: GoogleAdsWriteInput) {
  return {
    authorization: `Bearer ${input.accessToken}`,
    "developer-token": input.developerToken,
    ...(input.loginCustomerId
      ? { "login-customer-id": input.loginCustomerId.replace(/\D/gu, "") }
      : {}),
    "content-type": "application/json",
  };
}

function googleCampaignResource(
  customerIdInput: string,
  campaignIdInput: string,
) {
  const customerId = customerIdInput.replace(/\D/gu, "");
  if (!customerId)
    throw new Error("A valid Google Ads customer ID is required.");
  const suppliedResource = campaignIdInput.trim();
  const resourceMatch = suppliedResource.match(
    /^customers\/(\d+)\/campaigns\/(\d+)$/u,
  );
  if (resourceMatch && resourceMatch[1] !== customerId)
    throw new Error("Google Ads campaign belongs to a different customer.");
  const campaignId =
    resourceMatch?.[2] ||
    suppliedResource.match(/(?:campaigns\/)?(\d+)$/u)?.[1];
  if (!campaignId)
    throw new Error("A Google Ads campaign ID or resource name is required.");
  return {
    customerId,
    campaignId,
    resourceName: `customers/${customerId}/campaigns/${campaignId}`,
  };
}

export async function fetchGoogleAdsCampaignLearningState(
  input: GoogleAdsWriteInput & { campaignId: string },
) {
  const fetchFn = input.fetchFn || fetch;
  const { customerId, campaignId, resourceName } = googleCampaignResource(
    input.customerId,
    input.campaignId,
  );
  const apiVersion = googleAdsApiVersion(
    input.apiVersion || process.env.GOOGLE_ADS_API_VERSION,
  );
  const query = `SELECT campaign.id, campaign.campaign_budget, campaign.bidding_strategy_system_status FROM campaign WHERE campaign.id = ${campaignId}`;
  const response = await fetchFn(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: googleAdsWriteHeaders(input),
      body: JSON.stringify({ query }),
    },
  );
  const payload = await response.json().catch(() => []);
  if (!response.ok)
    throw new Error(
      `Google Ads campaign learning-state lookup failed (${response.status}).`,
    );
  const segments = Array.isArray(payload) ? payload : [payload];
  const campaign = segments
    .flatMap((segment) =>
      Array.isArray(segment?.results) ? segment.results : [],
    )
    .map((row: Record<string, unknown>) => readRecord(row.campaign))[0];
  return {
    campaignId,
    resourceName,
    campaignBudgetId: readString(
      campaign?.campaignBudget || campaign?.campaign_budget,
    ),
    status:
      readString(
        campaign?.biddingStrategySystemStatus ||
          campaign?.bidding_strategy_system_status,
      )?.toUpperCase() || "UNKNOWN",
  };
}

export async function pauseGoogleAdsCampaign(
  input: GoogleAdsWriteInput & { campaignId: string },
) {
  const fetchFn = input.fetchFn || fetch;
  const { customerId, resourceName } = googleCampaignResource(
    input.customerId,
    input.campaignId,
  );
  const apiVersion = googleAdsApiVersion(
    input.apiVersion || process.env.GOOGLE_ADS_API_VERSION,
  );
  const response = await fetchFn(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/campaigns:mutate`,
    {
      method: "POST",
      headers: googleAdsWriteHeaders(input),
      body: JSON.stringify({
        operations: [
          { update: { resourceName, status: "PAUSED" }, updateMask: "status" },
        ],
        partialFailure: false,
        validateOnly: false,
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(`Google Ads campaign pause failed (${response.status}).`);
  return {
    resourceName,
    result: Array.isArray(payload.results) ? payload.results[0] : undefined,
  };
}

const googleDayOfWeek = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export async function replaceGoogleAdsCampaignDaypartSchedule(
  input: GoogleAdsWriteInput & {
    campaignId: string;
    rules: Array<{
      day: number;
      startHour: number;
      endHour: number;
      bidMultiplier: number;
    }>;
  },
) {
  const fetchFn = input.fetchFn || fetch;
  const { customerId, campaignId, resourceName } = googleCampaignResource(
    input.customerId,
    input.campaignId,
  );
  const apiVersion = googleAdsApiVersion(
    input.apiVersion || process.env.GOOGLE_ADS_API_VERSION,
  );
  const query = `SELECT campaign_criterion.resource_name FROM campaign_criterion WHERE campaign.id = ${campaignId} AND campaign_criterion.type = AD_SCHEDULE`;
  const searchResponse = await fetchFn(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: googleAdsWriteHeaders(input),
      body: JSON.stringify({ query }),
    },
  );
  const searchPayload = await searchResponse.json().catch(() => []);
  if (!searchResponse.ok)
    throw new Error(
      `Google Ads daypart lookup failed (${searchResponse.status}).`,
    );
  const existing = (
    Array.isArray(searchPayload) ? searchPayload : [searchPayload]
  ).flatMap((segment) =>
    Array.isArray(segment?.results)
      ? segment.results
          .map((row: Record<string, unknown>) =>
            readString(readRecord(row.campaignCriterion).resourceName),
          )
          .filter((value: string | undefined): value is string =>
            Boolean(value),
          )
      : [],
  );
  const operations = [
    ...existing.map((criterion) => ({ remove: criterion })),
    ...input.rules.map((rule) => {
      if (
        !googleDayOfWeek[rule.day] ||
        rule.startHour < 0 ||
        rule.startHour > 23 ||
        rule.endHour <= rule.startHour ||
        rule.endHour > 24 ||
        rule.bidMultiplier <= 0
      )
        throw new Error(
          "Google Ads daypart rules require a valid day, increasing whole-hour range, and positive bid multiplier.",
        );
      return {
        create: {
          campaign: resourceName,
          adSchedule: {
            dayOfWeek: googleDayOfWeek[rule.day],
            startHour: rule.startHour,
            startMinute: "ZERO",
            endHour: rule.endHour,
            endMinute: "ZERO",
          },
          bidModifier: rule.bidMultiplier,
        },
      };
    }),
  ];
  const mutateResponse = await fetchFn(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/campaignCriteria:mutate`,
    {
      method: "POST",
      headers: googleAdsWriteHeaders(input),
      body: JSON.stringify({
        operations,
        partialFailure: false,
        validateOnly: false,
      }),
    },
  );
  const mutatePayload = await mutateResponse.json().catch(() => ({}));
  if (!mutateResponse.ok)
    throw new Error(
      `Google Ads daypart update failed (${mutateResponse.status}).`,
    );
  return {
    campaign: resourceName,
    removed: existing.length,
    created: input.rules.length,
    results: Array.isArray(mutatePayload.results) ? mutatePayload.results : [],
  };
}

export async function fetchYouTubeAnalyticsRows(input: {
  accessToken: string;
  since: string;
  until: string;
  channelId?: string;
  fetchFn?: typeof fetch;
}) {
  const fetchFn = input.fetchFn || fetch;
  const rows: Record<string, unknown>[] = [];
  let headers: string[] = [];
  let startIndex = 1;
  const pageSize = 200;
  for (let page = 0; page < 100; page += 1) {
    const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    url.searchParams.set(
      "ids",
      input.channelId ? `channel==${input.channelId}` : "channel==MINE",
    );
    url.searchParams.set("startDate", input.since);
    url.searchParams.set("endDate", input.until);
    url.searchParams.set("dimensions", "day,video");
    url.searchParams.set(
      "metrics",
      "views,estimatedMinutesWatched,subscribersGained,estimatedRevenue",
    );
    url.searchParams.set("sort", "day");
    url.searchParams.set("startIndex", String(startIndex));
    url.searchParams.set("maxResults", String(pageSize));
    const response = await fetchFn(url, {
      headers: { authorization: `Bearer ${input.accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(`YouTube Analytics fetch failed (${response.status}).`);
    if (!headers.length && Array.isArray(payload.columnHeaders))
      headers = payload.columnHeaders.map(
        (header: Record<string, unknown>) =>
          readString(header.name) || "column",
      );
    const pageRows = Array.isArray(payload.rows) ? payload.rows : [];
    rows.push(
      ...pageRows.map((values: unknown[]) =>
        Object.fromEntries(
          headers.map((header: string, index: number) => [
            header,
            values[index],
          ]),
        ),
      ),
    );
    if (!payload.nextPageToken || pageRows.length === 0) break;
    startIndex += pageRows.length;
  }
  return rows;
}

async function fetchLinkedInAnalyticsPivot(input: {
  accessToken: string;
  accountId: string;
  since: string;
  until: string;
  pivot: "CAMPAIGN" | "MEMBER_COMPANY" | "MEMBER_JOB_TITLE";
  apiVersion?: string;
  fetchFn?: typeof fetch;
}): Promise<Record<string, unknown>[]> {
  const fetchFn = input.fetchFn || fetch;
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  const apiVersion = linkedInApiVersion(
    input.apiVersion || process.env.LINKEDIN_API_VERSION,
  );
  for (let start = 0, page = 0; page < 100; page += 1, start += pageSize) {
    const url = new URL("https://api.linkedin.com/rest/adAnalytics");
    url.searchParams.set("q", "analytics");
    url.searchParams.set("pivot", input.pivot);
    url.searchParams.set(
      "accounts",
      `List(urn:li:sponsoredAccount:${input.accountId.replace(/\D/gu, "")})`,
    );
    url.searchParams.set(
      "dateRange",
      `(start:(year:${input.since.slice(0, 4)},month:${Number(input.since.slice(5, 7))},day:${Number(input.since.slice(8, 10))}),end:(year:${input.until.slice(0, 4)},month:${Number(input.until.slice(5, 7))},day:${Number(input.until.slice(8, 10))}))`,
    );
    url.searchParams.set("timeGranularity", "DAILY");
    url.searchParams.set("start", String(start));
    url.searchParams.set("count", String(pageSize));
    url.searchParams.set(
      "fields",
      "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,externalWebsitePostViewConversions,leadGenerationMailContactInfoShares,leadGenerationMailInterestedClicks,totalEngagements,likes,comments,shares,videoViews,pivotValues",
    );
    const response = await fetchFn(url, {
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "LinkedIn-Version": apiVersion,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(`LinkedIn Ads report fetch failed (${response.status}).`);
    const pageRows = Array.isArray(payload.elements) ? payload.elements : [];
    rows.push(...pageRows);
    const total = readNumber(readRecord(payload.paging).total);
    if (pageRows.length === 0 || !total || start + pageRows.length >= total)
      break;
  }
  return rows;
}

export async function fetchLinkedInRows(input: {
  accessToken: string;
  accountId: string;
  since: string;
  until: string;
  apiVersion?: string;
  fetchFn?: typeof fetch;
}) {
  const rows = await fetchLinkedInAnalyticsPivot({
    ...input,
    pivot: "CAMPAIGN",
  });
  return rows.map((row: Record<string, unknown>) => ({
    ...row,
    id: Array.isArray(row.pivotValues) ? row.pivotValues[0] : row.id,
    date: linkedInDate(row, input.until),
  }));
}

function normalizeLinkedInB2BMetric(
  row: Record<string, unknown>,
  dimension: "company" | "job_title",
): LinkedInB2BMetricRow | null {
  const pivot = Array.isArray(row.pivotValues)
    ? readString(row.pivotValues[0])
    : undefined;
  if (!pivot) return null;
  const clicks = readNumber(row.clicks);
  const companyEngagement =
    readNumber(row.totalEngagements) ||
    clicks +
      readNumber(row.likes) +
      readNumber(row.comments) +
      readNumber(row.shares);
  return {
    targetAccount: dimension === "company" ? pivot : "All target accounts",
    jobTitle: dimension === "job_title" ? pivot : undefined,
    leadGenFormFills: readNumber(
      row.leadGenerationMailContactInfoShares ??
        row.leadGenerationMailInterestedClicks ??
        row.externalWebsiteConversions,
    ),
    companyEngagement,
    impressions: readNumber(row.impressions),
    clicks,
    spend: readNumber(row.costInLocalCurrency),
  };
}

export async function fetchLinkedInB2BBreakdown(input: {
  accessToken: string;
  accountId: string;
  since: string;
  until: string;
  apiVersion?: string;
  fetchFn?: typeof fetch;
}): Promise<LinkedInB2BBreakdown> {
  const [companies, jobTitles] = await Promise.all([
    fetchLinkedInAnalyticsPivot({ ...input, pivot: "MEMBER_COMPANY" }),
    fetchLinkedInAnalyticsPivot({ ...input, pivot: "MEMBER_JOB_TITLE" }),
  ]);
  return {
    companyRows: companies
      .map((row) => normalizeLinkedInB2BMetric(row, "company"))
      .filter((row): row is LinkedInB2BMetricRow => Boolean(row)),
    jobTitleRows: jobTitles
      .map((row) => normalizeLinkedInB2BMetric(row, "job_title"))
      .filter((row): row is LinkedInB2BMetricRow => Boolean(row)),
  };
}

export async function fetchConnectorRows(input: {
  platform: "google_ads" | "youtube" | "linkedin";
  accessToken: string;
  since: string;
  until: string;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
}) {
  const env = input.env || process.env;
  if (input.platform === "google_ads") {
    if (!env.GOOGLE_ADS_CUSTOMER_ID || !env.GOOGLE_ADS_DEVELOPER_TOKEN)
      throw new Error(
        "GOOGLE_ADS_CUSTOMER_ID and GOOGLE_ADS_DEVELOPER_TOKEN are required.",
      );
    return fetchGoogleAdsRows({
      accessToken: input.accessToken,
      customerId: env.GOOGLE_ADS_CUSTOMER_ID,
      developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
      loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      since: input.since,
      until: input.until,
      apiVersion: env.GOOGLE_ADS_API_VERSION,
      fetchFn: input.fetchFn,
    });
  }
  if (input.platform === "youtube")
    return fetchYouTubeAnalyticsRows({
      accessToken: input.accessToken,
      since: input.since,
      until: input.until,
      channelId: env.YOUTUBE_CHANNEL_ID,
      fetchFn: input.fetchFn,
    });
  if (!env.LINKEDIN_AD_ACCOUNT_ID)
    throw new Error("LINKEDIN_AD_ACCOUNT_ID is required.");
  return fetchLinkedInRows({
    accessToken: input.accessToken,
    accountId: env.LINKEDIN_AD_ACCOUNT_ID,
    since: input.since,
    until: input.until,
    apiVersion: env.LINKEDIN_API_VERSION,
    fetchFn: input.fetchFn,
  });
}
