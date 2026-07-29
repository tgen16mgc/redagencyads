import type {
  DashboardReport,
  InsightRow,
  KpiPack,
  MetaAccount,
  MetaAdSet,
  MetaCampaign,
  NormalizedRow,
} from "@/lib/types";
import { graphList, graphRequest } from "@/lib/meta-graph";
import {
  buildPrompt,
  detectKpiPack,
  getKpiCards,
  normalizeRows,
  scoreHealth,
  sumRows,
} from "@/lib/metrics";
import { buildAdSetPreviewsWithCreatives } from "@/lib/adset-preview";
import { flattenAudienceTargeting } from "@/lib/cross-channel";
import {
  boundedMediaHashNumber,
  fetchHttpsMediaSha256,
} from "@/lib/media-content-hash";

type MetaReportAd = {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  effective_status: string;
  previewImageUrl: string;
  contentHash?: string;
  contentHashSource?: "meta_thumbnail_sha256";
};

const META_FIELDS = [
  "account_name",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "cpc",
  "cpm",
  "spend",
  "actions",
  "cost_per_action_type",
  "purchase_roas",
  "website_purchase_roas",
  "date_start",
  "date_stop",
].join(",");

export async function validateToken(token: string) {
  return graphRequest<{ id: string; name?: string }>({
    path: "/me",
    params: { fields: "id,name" },
    token,
  });
}

export async function getAccounts(token: string) {
  return graphList<MetaAccount>({
    path: "/me/adaccounts",
    params: {
      fields: "id,account_id,name,currency,timezone_name,account_status",
      limit: 100,
    },
    token,
  });
}

export async function getCampaigns(token: string, accountId: string) {
  const id = normalizeAccountId(accountId);
  return graphList<MetaCampaign>({
    path: `/${id}/campaigns`,
    params: {
      fields:
        "id,name,objective,status,effective_status,daily_budget,lifetime_budget",
      limit: 100,
    },
    token,
  });
}

export async function getAdSets(
  token: string,
  accountId: string,
  campaignIds: string[] = [],
) {
  const id = normalizeAccountId(accountId);
  const filtering = campaignIds.length
    ? JSON.stringify([
        { field: "campaign.id", operator: "IN", value: campaignIds },
      ])
    : undefined;
  return graphList<MetaAdSet>({
    path: `/${id}/adsets`,
    params: {
      fields:
        "id,name,campaign_id,campaign_name,status,effective_status,daily_budget,lifetime_budget,targeting",
      filtering,
      limit: 100,
    },
    token,
  });
}

export async function getActiveAdsForCampaigns(
  token: string,
  accountId: string,
  campaignIds: string[],
) {
  const id = normalizeAccountId(accountId);
  const filtering = campaignIds.length
    ? JSON.stringify([
        { field: "campaign.id", operator: "IN", value: campaignIds },
      ])
    : undefined;
  const ads = await graphList<{
    id: string;
    name: string;
    adset_id: string;
    status: string;
    effective_status: string;
    creative?: { thumbnail_url?: string };
  }>({
    path: `/${id}/ads`,
    params: {
      fields:
        "id,name,adset_id,status,effective_status,creative{thumbnail_url}",
      filtering,
      limit: 100,
    },
    token,
  });
  return ads
    .filter((ad) => (ad.effective_status || ad.status) === "ACTIVE")
    .map((ad) => ({
      ...ad,
      previewImageUrl: ad.creative?.thumbnail_url?.trim() || "",
    }));
}

export async function enrichMetaAdContentHashes(input: {
  ads: MetaReportAd[];
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
  const ads = input.ads.map((ad) => ({ ...ad }));
  const eligible = ads
    .map((ad, index) => ({ ad, index }))
    .filter(({ ad }) => !ad.contentHash && ad.previewImageUrl);
  const candidates = eligible.slice(0, maxAssets);
  const failures: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor];
      cursor += 1;
      try {
        ads[candidate.index] = {
          ...candidate.ad,
          contentHash: await fetchHttpsMediaSha256({
            mediaUrl: candidate.ad.previewImageUrl,
            maxBytes,
            timeoutMs,
            fetchFn,
          }),
          contentHashSource: "meta_thumbnail_sha256",
        };
      } catch (error) {
        if (failures.length < 20) {
          failures.push(
            `${candidate.ad.id}: ${error instanceof Error ? error.message : "Media hashing failed."}`,
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
  const hashedAssets = ads.filter((ad) => ad.contentHash).length;
  const cappedAssets = Math.max(0, eligible.length - candidates.length);
  return {
    ads,
    summary: {
      source: "meta_thumbnail_sha256" as const,
      totalAssets: ads.length,
      hashedAssets,
      metadataFallbackAssets: ads.length - hashedAssets,
      cappedAssets,
      warnings: failures,
      limitation:
        "Meta hashes Graph API thumbnail bytes; transformed thumbnail renditions only deduplicate when their returned bytes are identical.",
    },
  };
}

export async function getAdPreviews(
  token: string,
  adIds: string[],
): Promise<Record<string, string>> {
  if (!adIds.length) return {};
  const previews: Record<string, string> = {};
  await Promise.all(
    adIds.map(async (id) => {
      try {
        const res = await graphRequest<{ data: { body: string }[] }>({
          path: `/${id}/previews`,
          params: { ad_format: "DESKTOP_FEED_STANDARD" },
          token,
        });
        if (res.data?.[0]?.body) {
          previews[id] = res.data[0].body;
        }
      } catch (e) {
        console.error(`Failed to fetch preview for ad ${id}:`, e);
      }
    }),
  );
  return previews;
}

export function normalizeAccountId(accountId: string) {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

async function getInsights(
  token: string,
  objectId: string,
  level: "account" | "campaign" | "adset" | "ad",
  since: string,
  until: string,
  extra: Record<string, string | number | undefined> = {},
) {
  return graphList<InsightRow>({
    path: `/${objectId}/insights`,
    params: {
      fields: META_FIELDS,
      level,
      time_range: JSON.stringify({ since, until }),
      limit: 200,
      ...extra,
    },
    token,
  });
}

export async function buildReport(params: {
  token: string;
  accountId: string;
  campaignIds: string[];
  since: string;
  until: string;
  pack?: KpiPack;
}): Promise<DashboardReport> {
  const accountId = normalizeAccountId(params.accountId);
  const [accounts, campaigns] = await Promise.all([
    getAccounts(params.token),
    getCampaigns(params.token, accountId),
  ]);
  const account = accounts.find(
    (item) =>
      item.id === accountId ||
      item.account_id === accountId.replace("act_", ""),
  );
  if (!account)
    throw new Error("Selected account not found for current token.");

  const selectedCampaigns = campaigns.filter((campaign) =>
    params.campaignIds.length
      ? params.campaignIds.includes(campaign.id)
      : campaign.effective_status === "ACTIVE",
  );
  if (!selectedCampaigns.length)
    throw new Error("No campaign selected or active campaigns found.");

  const filter = JSON.stringify([
    {
      field: "campaign.id",
      operator: "IN",
      value: selectedCampaigns.map((campaign) => campaign.id),
    },
  ]);

  const campaignIds = selectedCampaigns.map((campaign) => campaign.id);

  const [
    campaignInsights,
    adsetInsights,
    adInsights,
    dailyInsights,
    platformInsights,
    ageGenderInsights,
    regionInsights,
    activeAdSetsData,
    activeAdsData,
  ] = await Promise.all([
    getInsights(
      params.token,
      accountId,
      "campaign",
      params.since,
      params.until,
      { filtering: filter },
    ),
    getInsights(params.token, accountId, "adset", params.since, params.until, {
      filtering: filter,
    }),
    getInsights(params.token, accountId, "ad", params.since, params.until, {
      filtering: filter,
    }),
    getInsights(
      params.token,
      accountId,
      "campaign",
      params.since,
      params.until,
      {
        filtering: filter,
        time_increment: 1,
      },
    ),
    getInsights(
      params.token,
      accountId,
      "campaign",
      params.since,
      params.until,
      {
        filtering: filter,
        breakdowns: "publisher_platform",
      },
    ),
    getInsights(
      params.token,
      accountId,
      "campaign",
      params.since,
      params.until,
      {
        filtering: filter,
        breakdowns: "age,gender",
      },
    ),
    getInsights(
      params.token,
      accountId,
      "campaign",
      params.since,
      params.until,
      {
        filtering: filter,
        breakdowns: "region",
      },
    ),
    getAdSets(params.token, accountId, campaignIds),
    getActiveAdsForCampaigns(params.token, accountId, campaignIds),
  ]);

  const activeAdSets = activeAdSetsData.filter(
    (adset) => (adset.effective_status || adset.status) === "ACTIVE",
  );
  const adsetTargeting = activeAdSets.map((adset) => ({
    adSetId: adset.id,
    criteria: Array.from(
      new Set(flattenAudienceTargeting(adset.targeting)),
    ).sort(),
  }));
  const activeAdSetIds = new Set(activeAdSets.map((adset) => adset.id));
  const activeAds = activeAdsData.filter((ad) =>
    activeAdSetIds.has(ad.adset_id),
  );
  const [previewHtmls, hashedActiveAds] = await Promise.all([
    getAdPreviews(
      params.token,
      activeAds.map((ad) => ad.id),
    ),
    enrichMetaAdContentHashes({ ads: activeAds }),
  ]);
  const adsetPreviews = buildAdSetPreviewsWithCreatives(
    activeAdSets,
    hashedActiveAds.ads,
    previewHtmls,
    selectedCampaigns,
  );

  const campaignRows = normalizeRows(campaignInsights, "campaign");
  const adsetRows = normalizeRows(adsetInsights, "adset");
  const adRows = normalizeRows(adInsights, "ad");
  const dailyRows = normalizeRows(dailyInsights, "daily");
  const platformRows = normalizeRows(platformInsights, "breakdown");
  const ageGenderRows = normalizeRows(ageGenderInsights, "breakdown");
  const regionRows = normalizeRows(regionInsights, "breakdown");
  const totals = sumRows(campaignRows, "Account total");
  const detected = detectKpiPack(selectedCampaigns, campaignRows, adsetRows);
  const selectedPack = params.pack || detected.pack;
  const health = scoreHealth({ totals, campaignRows, adsetRows, adRows });
  const prompt = buildPrompt({
    account,
    campaigns: selectedCampaigns,
    selectedPack,
    totals,
    campaignRows,
    adsetRows,
    adRows,
    dailyRows,
    platformRows,
    ageGenderRows,
    regionRows,
    health,
    dateRange: { since: params.since, until: params.until },
  });

  return {
    source: "meta_api",
    account,
    selectedCampaigns,
    dateRange: { since: params.since, until: params.until },
    detectedPack: detected.pack,
    selectedPack,
    packReason: detected.reason,
    kpis: getKpiCards(selectedPack),
    totals,
    campaignRows,
    adsetRows,
    adRows,
    dailyRows,
    platformRows,
    ageGenderRows,
    regionRows,
    health,
    prompt,
    pulledAt: new Date().toISOString(),
    adsetPreviews,
    adsetTargeting,
    creativeHashing: hashedActiveAds.summary,
  };
}
