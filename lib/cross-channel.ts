import type {
  DashboardReport,
  TikTokAdLibraryRow,
  TikTokLibraryReport,
} from "@/lib/types";

export const CANONICAL_SCHEMA_VERSION = "1.0" as const;

export type CanonicalPlatform =
  | "meta"
  | "tiktok"
  | "google_ads"
  | "youtube"
  | "linkedin";
export type CanonicalAuthority = "owned_performance" | "public_intelligence";
export type CanonicalGrain =
  | "campaign"
  | "ad_set"
  | "ad"
  | "creative"
  | "daily";

export type CanonicalPerformanceRow = {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  id: string;
  platform: CanonicalPlatform;
  authority: "owned_performance";
  grain: CanonicalGrain;
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
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  viewThroughConversions: number;
  videoViews?: number;
  watchTimeMinutes?: number;
};

export type CanonicalCreativeRow = {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  id: string;
  creativeId: string;
  platform: CanonicalPlatform;
  authority: CanonicalAuthority;
  advertiser?: string;
  title?: string;
  caption?: string;
  format: "video" | "image" | "text" | "ugc" | "static" | "unknown";
  cta?: string;
  landingUrl?: string;
  mediaUrl?: string;
  firstSeen?: string;
  lastSeen?: string;
  performanceScore?: number;
  hookRetention?: number;
  contentHash?: string;
  fingerprintMethod?: "content_sha256" | "metadata";
  fingerprint: string;
};

export type CanonicalQualityGate = {
  id:
    | "row_counts"
    | "null_rates"
    | "spend_variance"
    | "schema_drift"
    | "deduplication";
  status: "pass" | "warning" | "fail";
  detail: string;
};

export type PlatformSummary = {
  platform: CanonicalPlatform;
  authority: CanonicalAuthority;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpa: number;
  roas: number;
  spendShare: number;
  rowCount: number;
};

export type CrossChannelSnapshot = {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  dateRange: { since: string; until: string };
  performanceRows: CanonicalPerformanceRow[];
  creativeRows: CanonicalCreativeRow[];
  platforms: PlatformSummary[];
  totals: Omit<PlatformSummary, "platform" | "authority" | "spendShare">;
  quality: CanonicalQualityGate[];
  warnings: string[];
  executive: ExecutiveSummary;
  attribution: AttributionSummary;
  creativeDrillthrough: CreativeDrillthroughRow[];
  generatedAt: string;
};

export type AttributionModel =
  | "last_click"
  | "7d_click_1d_view"
  | "data_driven"
  | "custom";

export type AttributionSummary = {
  model: AttributionModel;
  effectiveModel: AttributionModel;
  attributedConversions: number;
  attributedRevenue: number;
  source: "canonical_rows" | "ga4_data_api";
  propertyId?: string;
  reportingAttributionModel?: string;
  dateRange?: { since: string; until: string };
  warning?: string;
};

export type DataDrivenAttributionTotals = {
  propertyId: string;
  reportingAttributionModel: string;
  conversions: number;
  revenue: number;
  since: string;
  until: string;
  source: "ga4_data_api";
};

export type ExecutiveSummary = {
  blendedRoas: number;
  blendedCpa: number;
  cac: number;
  ltv: number;
  cacLtv: number;
  spendShare: Record<string, number>;
  trend: Array<{
    date: string;
    spend: number;
    conversions: number;
    revenue: number;
    roas: number;
  }>;
};

export type IncrementalityStudy = {
  id: string;
  method: "geo_lift" | "psa";
  startDate: string;
  endDate: string;
  lift: number;
  confidenceLower?: number;
  confidenceUpper?: number;
  incrementalConversions?: number;
  incrementalRevenue?: number;
  notes?: string;
};

export type CreativeDrillthroughRow = {
  creativeId: string;
  platform: CanonicalPlatform;
  authority: CanonicalAuthority;
  title?: string;
  format: CanonicalCreativeRow["format"];
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  performanceScore?: number;
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

function normalizeMediaUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export function creativeFingerprint(input: {
  advertiser?: string;
  caption?: string;
  mediaUrl?: string;
  landingUrl?: string;
  contentHash?: string;
}) {
  const contentHash = normalizeContentSha256(input.contentHash);
  if (contentHash) return contentHash.slice("sha256:".length);
  const mediaIdentity = [
    normalizeMediaUrl(input.mediaUrl),
    normalizeMediaUrl(input.landingUrl),
  ].filter(Boolean);
  const identity = [
    ...(mediaIdentity.length ? [] : [input.advertiser]),
    input.caption,
    ...mediaIdentity,
  ]
    .map((value) => text(value).toLocaleLowerCase().replace(/\s+/gu, " "))
    .filter(Boolean)
    .join("|");
  return hash(identity || "empty-creative");
}

export function normalizeContentSha256(value?: string) {
  const digest = text(value)
    .toLocaleLowerCase()
    .replace(/^(?:creative:|sha256:)/u, "");
  return /^[a-f0-9]{64}$/u.test(digest) ? `sha256:${digest}` : undefined;
}

export function normalizeTikTokCreative(
  row: TikTokAdLibraryRow,
): CanonicalCreativeRow {
  const mediaUrl = row.videoUrl || row.imageUrl;
  const fingerprint = creativeFingerprint({
    advertiser: row.advertiserName,
    caption: row.caption || row.adTitle,
    mediaUrl,
    landingUrl: row.landingUrl,
    contentHash: row.contentHash,
  });
  const contentHash = normalizeContentSha256(row.contentHash);
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    id: `tiktok:creative:${row.id}`,
    creativeId: `creative:${fingerprint}`,
    platform: "tiktok",
    authority: "public_intelligence",
    advertiser: row.advertiserName,
    title: row.adTitle,
    caption: row.caption,
    format:
      row.format ||
      (row.videoUrl ? "video" : row.imageUrl ? "image" : "unknown"),
    cta: row.cta,
    landingUrl: row.landingUrl,
    mediaUrl,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    performanceScore: row.performanceScore,
    hookRetention: row.hookRetention,
    contentHash,
    fingerprintMethod: contentHash ? "content_sha256" : "metadata",
    fingerprint,
  };
}

function normalizeMetaRows(
  report: DashboardReport,
  rows: DashboardReport["campaignRows"],
  grain: CanonicalGrain,
): CanonicalPerformanceRow[] {
  const date = report.dateRange.until || report.dateRange.since;
  const previewByAd = new Map(
    (report.adsetPreviews || []).flatMap((adset) =>
      adset.ads.map((ad) => [ad.id, ad] as const),
    ),
  );
  const conversionsFor = (row: {
    leads: number;
    purchases: number;
    messages: number;
  }) => {
    if (report.selectedPack === "sales_roas") return row.purchases;
    if (report.selectedPack === "lead_gen") return row.leads;
    if (report.selectedPack === "messages") return row.messages;
    if (report.selectedPack === "traffic") return 0;
    return 0;
  };
  return rows.map((row) => {
    const preview = previewByAd.get(row.adId || row.id);
    const fingerprint =
      grain === "ad"
        ? creativeFingerprint({
            advertiser: report.account.name,
            caption: row.adName || row.name,
            mediaUrl: preview?.previewImageUrl,
            contentHash: preview?.contentHash,
          })
        : undefined;
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      id: `meta:${grain}:${row.id}:${date}`,
      platform: "meta",
      authority: "owned_performance",
      grain,
      date,
      campaignId: row.campaignId || (grain === "campaign" ? row.id : undefined),
      campaignName:
        row.campaignName || (grain === "campaign" ? row.name : undefined),
      adSetId: row.adsetId || (grain === "ad_set" ? row.id : undefined),
      adSetName: row.adsetName || (grain === "ad_set" ? row.name : undefined),
      adId: row.adId || (grain === "ad" ? row.id : undefined),
      adName: row.adName || (grain === "ad" ? row.name : undefined),
      creativeId: fingerprint ? `creative:${fingerprint}` : undefined,
      objective: report.selectedCampaigns.find(
        (campaign) => campaign.id === row.campaignId,
      )?.objective,
      spend: number(row.spend),
      impressions: number(row.impressions),
      clicks: number(row.linkClicks || row.clicks),
      conversions: conversionsFor(row),
      revenue: number(row.spend) * number(row.roas),
      viewThroughConversions: 0,
    };
  });
}

export function normalizeMetaPerformance(
  report: DashboardReport,
): CanonicalPerformanceRow[] {
  return normalizeMetaRows(report, report.campaignRows, "campaign");
}

export function normalizeMetaHierarchy(
  report: DashboardReport,
): CanonicalPerformanceRow[] {
  return [
    ...normalizeMetaRows(report, report.campaignRows, "campaign"),
    ...normalizeMetaRows(report, report.adsetRows, "ad_set"),
    ...normalizeMetaRows(report, report.adRows, "ad"),
  ];
}

export function normalizeMetaCreatives(
  report: DashboardReport,
): CanonicalCreativeRow[] {
  const previewByAd = new Map(
    (report.adsetPreviews || []).flatMap((adset) =>
      adset.ads.map((ad) => [ad.id, ad] as const),
    ),
  );
  return report.adRows.map((row) => {
    const preview = previewByAd.get(row.adId || row.id);
    const fingerprint = creativeFingerprint({
      advertiser: report.account.name,
      caption: row.adName || row.name,
      mediaUrl: preview?.previewImageUrl,
      contentHash: preview?.contentHash,
    });
    const contentHash = normalizeContentSha256(preview?.contentHash);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      id: `meta:creative:${row.adId || row.id}`,
      creativeId: `creative:${fingerprint}`,
      platform: "meta",
      authority: "owned_performance",
      advertiser: report.account.name,
      title: row.adName || row.name,
      format:
        row.adFormat === "video"
          ? "video"
          : row.adFormat === "image"
            ? "image"
            : "unknown",
      mediaUrl: preview?.previewImageUrl,
      firstSeen: report.dateRange.since,
      lastSeen: report.dateRange.until,
      contentHash,
      fingerprintMethod: contentHash ? "content_sha256" : "metadata",
      fingerprint,
    };
  });
}

export function dedupeCreativeRows(rows: CanonicalCreativeRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.fingerprint)) return false;
    seen.add(row.fingerprint);
    return true;
  });
}

function summarize(
  platform: CanonicalPlatform,
  authority: CanonicalAuthority,
  rows: CanonicalPerformanceRow[],
  totalSpend: number,
): PlatformSummary {
  const spend = rows.reduce((sum, row) => sum + number(row.spend), 0);
  const impressions = rows.reduce(
    (sum, row) => sum + number(row.impressions),
    0,
  );
  const clicks = rows.reduce((sum, row) => sum + number(row.clicks), 0);
  const conversions = rows.reduce(
    (sum, row) => sum + number(row.conversions),
    0,
  );
  const revenue = rows.reduce((sum, row) => sum + number(row.revenue), 0);
  return {
    platform,
    authority,
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? revenue / spend : 0,
    spendShare: totalSpend > 0 ? spend / totalSpend : 0,
    rowCount: rows.length,
  };
}

function sumMetric(
  rows: CanonicalPerformanceRow[],
  key:
    | "spend"
    | "impressions"
    | "clicks"
    | "conversions"
    | "revenue"
    | "viewThroughConversions",
) {
  return rows.reduce((sum, row) => sum + number(row[key]), 0);
}

export function attributeRows(
  rows: CanonicalPerformanceRow[],
  model: AttributionModel,
  customWeights?: { click: number; view: number },
  dataDrivenAttribution?: DataDrivenAttributionTotals,
  dataDrivenWarning?: string,
): AttributionSummary {
  const clicks = sumMetric(rows, "conversions");
  const views = sumMetric(rows, "viewThroughConversions");
  if (model === "data_driven") {
    if (!dataDrivenAttribution) {
      return {
        model,
        effectiveModel: "last_click",
        attributedConversions: clicks,
        attributedRevenue: sumMetric(rows, "revenue"),
        source: "canonical_rows",
        warning:
          dataDrivenWarning ||
          "Data-driven attribution requires a linked GA4 property using the data-driven reporting model; last-click values are shown.",
      };
    }
    return {
      model,
      effectiveModel: "data_driven",
      attributedConversions: dataDrivenAttribution.conversions,
      attributedRevenue: dataDrivenAttribution.revenue,
      source: dataDrivenAttribution.source,
      propertyId: dataDrivenAttribution.propertyId,
      reportingAttributionModel:
        dataDrivenAttribution.reportingAttributionModel,
      dateRange: {
        since: dataDrivenAttribution.since,
        until: dataDrivenAttribution.until,
      },
    };
  }
  const clickWeight =
    model === "custom" ? Math.max(0, customWeights?.click ?? 1) : 1;
  const viewWeight =
    model === "last_click"
      ? 0
      : model === "custom"
        ? Math.max(0, customWeights?.view ?? 0)
        : 1;
  const attributedConversions = clicks * clickWeight + views * viewWeight;
  const attributedRevenue = rows.reduce((sum, row) => {
    const revenuePerClickConversion =
      row.conversions > 0 ? row.revenue / row.conversions : 0;
    return (
      sum +
      row.revenue * clickWeight +
      (model === "last_click"
        ? 0
        : revenuePerClickConversion * row.viewThroughConversions * viewWeight)
    );
  }, 0);
  return {
    model,
    effectiveModel: model,
    attributedConversions,
    attributedRevenue,
    source: "canonical_rows",
  };
}

export function buildExecutiveSummary(
  rows: CanonicalPerformanceRow[],
  platformRows: PlatformSummary[],
  attribution: AttributionSummary,
  options?: { ltv?: number; dailyRows?: CanonicalPerformanceRow[] },
): ExecutiveSummary {
  const spend = sumMetric(rows, "spend");
  const ltv = Math.max(0, options?.ltv || 0);
  const cac =
    attribution.attributedConversions > 0
      ? spend / attribution.attributedConversions
      : 0;
  const trendMap = new Map<string, CanonicalPerformanceRow[]>();
  for (const row of options?.dailyRows || rows) {
    const bucket = trendMap.get(row.date) || [];
    bucket.push(row);
    trendMap.set(row.date, bucket);
  }
  const trend = [...trendMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => {
      const dailySpend = sumMetric(bucket, "spend");
      const dailyConversions = sumMetric(bucket, "conversions");
      const dailyRevenue = sumMetric(bucket, "revenue");
      return {
        date,
        spend: dailySpend,
        conversions: dailyConversions,
        revenue: dailyRevenue,
        roas: dailySpend > 0 ? dailyRevenue / dailySpend : 0,
      };
    });
  return {
    blendedRoas: spend > 0 ? attribution.attributedRevenue / spend : 0,
    blendedCpa: cac,
    cac,
    ltv,
    cacLtv: cac > 0 && ltv > 0 ? ltv / cac : 0,
    spendShare: Object.fromEntries(
      platformRows.map((row) => [row.platform, row.spendShare]),
    ),
    trend,
  };
}

export function buildCreativeDrillthrough(
  creatives: CanonicalCreativeRow[],
  rows: CanonicalPerformanceRow[],
): CreativeDrillthroughRow[] {
  const byCreative = new Map<string, CanonicalPerformanceRow[]>();
  for (const row of rows) {
    if (!row.creativeId) continue;
    const bucket = byCreative.get(row.creativeId) || [];
    bucket.push(row);
    byCreative.set(row.creativeId, bucket);
  }
  return creatives.map((creative) => {
    const linked = byCreative.get(creative.creativeId) || [];
    return {
      creativeId: creative.creativeId,
      platform: creative.platform,
      authority: creative.authority,
      title: creative.title,
      format: creative.format,
      spend: sumMetric(linked, "spend"),
      impressions: sumMetric(linked, "impressions"),
      clicks: sumMetric(linked, "clicks"),
      conversions: sumMetric(linked, "conversions"),
      revenue: sumMetric(linked, "revenue"),
      performanceScore: creative.performanceScore,
    };
  });
}

export function applyIncrementalityOverlay(
  summary: ExecutiveSummary,
  study: IncrementalityStudy,
) {
  return {
    ...summary,
    incrementality: {
      method: study.method,
      lift: study.lift,
      incrementalConversions: study.incrementalConversions || 0,
      incrementalRevenue: study.incrementalRevenue || 0,
      confidence:
        study.confidenceLower !== undefined &&
        study.confidenceUpper !== undefined
          ? ([study.confidenceLower, study.confidenceUpper] as const)
          : undefined,
    },
  };
}

export function evaluateQuality(
  rows: CanonicalPerformanceRow[],
  previousRows: CanonicalPerformanceRow[] = [],
): CanonicalQualityGate[] {
  const duplicateCount = rows.length - new Set(rows.map((row) => row.id)).size;
  const nullCount = rows.filter(
    (row) => !row.id || !row.platform || !row.date,
  ).length;
  const negativeCount = rows.filter((row) =>
    [row.spend, row.impressions, row.clicks, row.conversions, row.revenue].some(
      (value) => value < 0,
    ),
  ).length;
  const currentSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const previousSpend = previousRows.reduce((sum, row) => sum + row.spend, 0);
  const spendVariance =
    previousSpend > 0
      ? Math.abs(currentSpend - previousSpend) / previousSpend
      : 0;
  const allowedKeys = new Set([
    "schemaVersion",
    "id",
    "platform",
    "authority",
    "grain",
    "date",
    "campaignId",
    "campaignName",
    "adSetId",
    "adSetName",
    "adId",
    "adName",
    "creativeId",
    "objective",
    "audienceSegment",
    "spend",
    "impressions",
    "clicks",
    "conversions",
    "revenue",
    "viewThroughConversions",
    "videoViews",
    "watchTimeMinutes",
  ]);
  const driftRows = rows.filter(
    (row) =>
      row.schemaVersion !== CANONICAL_SCHEMA_VERSION ||
      Object.keys(row).some((key) => !allowedKeys.has(key)),
  ).length;
  return [
    {
      id: "row_counts",
      status: rows.length > 0 ? "pass" : "warning",
      detail:
        rows.length > 0
          ? `${rows.length} canonical performance rows loaded.`
          : "No canonical performance rows were returned for this window; the empty sync is retained without deleting prior data.",
    },
    {
      id: "null_rates",
      status: negativeCount > 0 || nullCount > 0 ? "fail" : "pass",
      detail: `${nullCount} rows have missing required keys; ${negativeCount} rows have negative metrics.`,
    },
    {
      id: "spend_variance",
      status: spendVariance > 0.05 ? "warning" : "pass",
      detail:
        previousSpend > 0
          ? `Spend variance ${(spendVariance * 100).toFixed(1)}% versus previous load.`
          : "No previous load supplied; variance check will begin on the next sync.",
    },
    {
      id: "schema_drift",
      status: driftRows > 0 ? "fail" : "pass",
      detail:
        driftRows > 0
          ? `${driftRows} rows contain a schema-version mismatch or unknown canonical fields.`
          : `Schema ${CANONICAL_SCHEMA_VERSION} accepted; unknown source fields remain isolated in raw payloads.`,
    },
    {
      id: "deduplication",
      status: duplicateCount > 0 ? "warning" : "pass",
      detail:
        duplicateCount > 0
          ? `${duplicateCount} duplicate canonical ids detected.`
          : "No duplicate canonical ids detected.",
    },
  ];
}

export function buildCrossChannelSnapshot(input: {
  metaReport?: DashboardReport | null;
  tiktokReport?: TikTokLibraryReport | null;
  connectorPerformanceRows?: CanonicalPerformanceRow[];
  connectorCreativeRows?: CanonicalCreativeRow[];
  previousRows?: CanonicalPerformanceRow[];
  attributionModel?: AttributionModel;
  customAttributionWeights?: { click: number; view: number };
  dataDrivenAttribution?: DataDrivenAttributionTotals;
  dataDrivenAttributionWarning?: string;
  ltv?: number;
}): CrossChannelSnapshot {
  const connectorPerformanceRows = Array.from(
    new Map(
      (input.connectorPerformanceRows || []).map((row) => [row.id, row]),
    ).values(),
  );
  const connectorCreativeRows = input.connectorCreativeRows || [];
  const summaryRows = [
    ...(input.metaReport ? normalizeMetaPerformance(input.metaReport) : []),
    ...connectorPerformanceRows,
  ];
  const performanceRows = [
    ...(input.metaReport ? normalizeMetaHierarchy(input.metaReport) : []),
    ...connectorPerformanceRows,
  ];
  const publicCreatives = (input.tiktokReport?.rows || []).map(
    normalizeTikTokCreative,
  );
  const ownedCreatives = input.metaReport
    ? normalizeMetaCreatives(input.metaReport)
    : [];
  const creativeRows = dedupeCreativeRows([
    ...ownedCreatives,
    ...connectorCreativeRows,
    ...publicCreatives,
  ]);
  const totalSpend = summaryRows.reduce((sum, row) => sum + row.spend, 0);
  const platformGroups = new Map<
    CanonicalPlatform,
    CanonicalPerformanceRow[]
  >();
  for (const row of summaryRows) {
    const bucket = platformGroups.get(row.platform) || [];
    bucket.push(row);
    platformGroups.set(row.platform, bucket);
  }
  const platforms = [...platformGroups.entries()]
    .map(([platform, rows]) =>
      summarize(platform, "owned_performance", rows, totalSpend),
    )
    .sort((left, right) => right.spend - left.spend);
  const totals = {
    authority: "owned_performance" as const,
    spend: totalSpend,
    impressions: summaryRows.reduce((sum, row) => sum + row.impressions, 0),
    clicks: summaryRows.reduce((sum, row) => sum + row.clicks, 0),
    conversions: summaryRows.reduce((sum, row) => sum + row.conversions, 0),
    revenue: summaryRows.reduce((sum, row) => sum + row.revenue, 0),
    cpa:
      summaryRows.reduce((sum, row) => sum + row.conversions, 0) > 0
        ? totalSpend /
          summaryRows.reduce((sum, row) => sum + row.conversions, 0)
        : 0,
    roas:
      totalSpend > 0
        ? summaryRows.reduce((sum, row) => sum + row.revenue, 0) / totalSpend
        : 0,
    rowCount: summaryRows.length,
  };
  const quality = evaluateQuality(summaryRows, input.previousRows);
  const attribution = attributeRows(
    summaryRows,
    input.attributionModel || "last_click",
    input.customAttributionWeights,
    input.dataDrivenAttribution,
    input.dataDrivenAttributionWarning,
  );
  const metaDailyRows = input.metaReport?.dailyRows
    ? normalizeMetaRows(input.metaReport, input.metaReport.dailyRows, "daily")
    : [];
  const executive = buildExecutiveSummary(summaryRows, platforms, attribution, {
    ltv: input.ltv,
    dailyRows: [...metaDailyRows, ...connectorPerformanceRows],
  });
  const creativeDrillthrough = buildCreativeDrillthrough(
    creativeRows,
    performanceRows,
  );
  const allDates = summaryRows
    .map((row) => row.date)
    .filter(Boolean)
    .sort();
  const sourceCreativeCount =
    ownedCreatives.length +
    connectorCreativeRows.length +
    publicCreatives.length;
  const warnings = [
    ...(input.tiktokReport?.warnings || []),
    ...(creativeRows.length < sourceCreativeCount
      ? [
          `Deduplicated ${sourceCreativeCount - creativeRows.length} creatives across platform source URLs and captions.`,
        ]
      : []),
    ...(summaryRows.length === 0
      ? [
          "No owned performance connector is loaded. Public creative intelligence cannot be used for budget recommendations.",
        ]
      : []),
  ];
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    dateRange: input.metaReport?.dateRange || {
      since: allDates[0] || "",
      until: allDates.at(-1) || "",
    },
    performanceRows,
    creativeRows,
    platforms,
    totals,
    quality,
    warnings,
    executive,
    attribution,
    creativeDrillthrough,
    generatedAt: new Date().toISOString(),
  };
}

export type AudienceFingerprint = {
  id: string;
  platform: CanonicalPlatform;
  adSetId: string;
  spend: number;
  criteria: string[];
};

export function flattenAudienceTargeting(
  value: unknown,
  path: string[] = [],
): string[] {
  if (Array.isArray(value))
    return value.flatMap((item) => flattenAudienceTargeting(item, path));
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, item]) => flattenAudienceTargeting(item, [...path, key]),
    );
  if (value === undefined || value === null || value === "") return [];
  const key =
    path.filter((part) => !/^\d+$/u.test(part)).join(".") || "targeting";
  return [`${key}:${String(value).trim().toLocaleLowerCase()}`];
}

export function buildAudienceFingerprint(
  input: Omit<AudienceFingerprint, "id" | "criteria"> & { criteria: string[] },
) {
  const criteria = Array.from(
    new Set(
      input.criteria
        .map((item) => item.trim().toLocaleLowerCase())
        .filter(Boolean),
    ),
  ).sort();
  return {
    ...input,
    id: `audience:${hash(`${input.platform}|${input.adSetId}|${criteria.join("|")}`)}`,
    criteria,
  } satisfies AudienceFingerprint;
}

export type AudienceOverlapAlert = {
  leftId: string;
  rightId: string;
  overlap: number;
  cannibalizationRisk: boolean;
};

export type ConsolidationRecommendation = {
  id: string;
  leftId: string;
  rightId: string;
  action: "merge" | "exclude";
  overlap: number;
  rationale: string;
  apiSupported: boolean;
};

export function audienceOverlapMatrix(
  audiences: AudienceFingerprint[],
): AudienceOverlapAlert[] {
  const result: AudienceOverlapAlert[] = [];
  for (let left = 0; left < audiences.length; left += 1) {
    for (let right = left + 1; right < audiences.length; right += 1) {
      const leftSet = new Set(
        audiences[left].criteria
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      );
      const rightSet = new Set(
        audiences[right].criteria
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      );
      const union = new Set([...leftSet, ...rightSet]).size;
      const intersection = [...leftSet].filter((item) =>
        rightSet.has(item),
      ).length;
      const overlap = union > 0 ? intersection / union : 0;
      if (overlap > 0) {
        result.push({
          leftId: audiences[left].adSetId,
          rightId: audiences[right].adSetId,
          overlap,
          cannibalizationRisk:
            overlap > 0.3 &&
            audiences[left].spend > 50 &&
            audiences[right].spend > 50,
        });
      }
    }
  }
  return result.sort((left, right) => right.overlap - left.overlap);
}

export function recommendAudienceConsolidation(
  audiences: AudienceFingerprint[],
): ConsolidationRecommendation[] {
  return audienceOverlapMatrix(audiences)
    .filter((alert) => alert.cannibalizationRisk)
    .map((alert) => {
      const left = audiences.find((item) => item.adSetId === alert.leftId);
      const right = audiences.find((item) => item.adSetId === alert.rightId);
      const action =
        left && right && left.spend >= right.spend ? "exclude" : "merge";
      return {
        id: `audience:${alert.leftId}:${alert.rightId}`,
        leftId: alert.leftId,
        rightId: alert.rightId,
        action,
        overlap: alert.overlap,
        rationale:
          action === "exclude"
            ? `Exclude the overlapping segment from ${alert.rightId} before consolidating spend.`
            : `Merge ${alert.leftId} and ${alert.rightId} into one controlled audience layer.`,
        apiSupported: action === "exclude" && right?.platform === "meta",
      };
    });
}
