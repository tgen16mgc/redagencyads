import type { DashboardReport, InsightRow, KpiPack, MetaAccount, MetaAdSet, MetaCampaign, NormalizedRow } from "@/lib/types";
import { buildPrompt, detectKpiPack, getKpiCards, normalizeRows, scoreHealth, sumRows } from "@/lib/metrics";
import { buildAdSetPreviewsWithCreatives } from "@/lib/adset-preview";

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

const graphVersion = () => process.env.META_GRAPH_VERSION || "v22.0";

function graphUrl(path: string, params: Record<string, string | number | undefined>, token: string) {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", token);
  return url;
}

async function graphGet<T>(path: string, params: Record<string, string | number | undefined>, token: string): Promise<T> {
  const response = await fetch(graphUrl(path, params, token), { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message || `Meta Graph request failed: ${response.status}`;
    throw new Error(message);
  }
  return json as T;
}

async function graphList<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  token: string,
  limit = 100,
) {
  const first = await graphGet<{ data?: T[]; paging?: { next?: string } }>(path, { ...params, limit }, token);
  const rows = [...(first.data || [])];
  let next = first.paging?.next;
  while (next && rows.length < 500) {
    const response = await fetch(next, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "Meta Graph pagination failed.");
    rows.push(...(json.data || []));
    next = json.paging?.next;
  }
  return rows;
}

export async function validateToken(token: string) {
  return graphGet<{ id: string; name?: string }>("/me", { fields: "id,name" }, token);
}

export async function getAccounts(token: string) {
  const accounts = await graphList<MetaAccount>(
    "/me/adaccounts",
    { fields: "id,account_id,name,currency,timezone_name,account_status" },
    token,
  );
  return accounts;
}

export async function getCampaigns(token: string, accountId: string) {
  const id = normalizeAccountId(accountId);
  return graphList<MetaCampaign>(
    `/${id}/campaigns`,
    { fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget", limit: 100 },
    token,
  );
}

export async function getAdSets(token: string, accountId: string, campaignIds: string[] = []) {
  const id = normalizeAccountId(accountId);
  const filtering = campaignIds.length
    ? JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }])
    : undefined;
  return graphList<MetaAdSet>(
    `/${id}/adsets`,
    {
      fields: "id,name,campaign_id,campaign_name,status,effective_status,daily_budget,lifetime_budget",
      filtering,
      limit: 100,
    },
    token,
  );
}

export async function getActiveAdsForCampaigns(token: string, accountId: string, campaignIds: string[]) {
  const id = normalizeAccountId(accountId);
  const filtering = campaignIds.length
    ? JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }])
    : undefined;
  const ads = await graphList<{ id: string; name: string; adset_id: string; status: string; effective_status: string }>(
    `/${id}/ads`,
    {
      fields: "id,name,adset_id,status,effective_status",
      filtering,
      limit: 100,
    },
    token,
  );
  return ads.filter((ad) => (ad.effective_status || ad.status) === "ACTIVE");
}

export async function getAdPreviews(token: string, adIds: string[]): Promise<Record<string, string>> {
  if (!adIds.length) return {};
  const previews: Record<string, string> = {};
  await Promise.all(
    adIds.map(async (id) => {
      try {
        const res = await graphGet<{ data: { body: string }[] }>(
          `/${id}/previews`,
          { ad_format: "DESKTOP_FEED_STANDARD" },
          token,
        );
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
  return graphList<InsightRow>(
    `/${objectId}/insights`,
    {
      fields: META_FIELDS,
      level,
      time_range: JSON.stringify({ since, until }),
      limit: 200,
      ...extra,
    },
    token,
    200,
  );
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
  const account = accounts.find((item) => item.id === accountId || item.account_id === accountId.replace("act_", ""));
  if (!account) throw new Error("Selected account not found for current token.");

  const selectedCampaigns = campaigns.filter((campaign) =>
    params.campaignIds.length ? params.campaignIds.includes(campaign.id) : campaign.effective_status === "ACTIVE",
  );
  if (!selectedCampaigns.length) throw new Error("No campaign selected or active campaigns found.");

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
    getInsights(params.token, accountId, "campaign", params.since, params.until, { filtering: filter }),
    getInsights(params.token, accountId, "adset", params.since, params.until, { filtering: filter }),
    getInsights(params.token, accountId, "ad", params.since, params.until, { filtering: filter }),
    getInsights(params.token, accountId, "campaign", params.since, params.until, {
      filtering: filter,
      time_increment: 1,
    }),
    getInsights(params.token, accountId, "campaign", params.since, params.until, {
      filtering: filter,
      breakdowns: "publisher_platform",
    }),
    getInsights(params.token, accountId, "campaign", params.since, params.until, {
      filtering: filter,
      breakdowns: "age,gender",
    }),
    getInsights(params.token, accountId, "campaign", params.since, params.until, {
      filtering: filter,
      breakdowns: "region",
    }),
    getAdSets(params.token, accountId, campaignIds),
    getActiveAdsForCampaigns(params.token, accountId, campaignIds),
  ]);

  const activeAdSets = activeAdSetsData.filter((adset) => (adset.effective_status || adset.status) === "ACTIVE");
  const activeAdSetIds = new Set(activeAdSets.map((adset) => adset.id));
  const activeAds = activeAdsData.filter((ad) => activeAdSetIds.has(ad.adset_id));
  const previewHtmls = await getAdPreviews(params.token, activeAds.map((ad) => ad.id));
  const adsetPreviews = buildAdSetPreviewsWithCreatives(activeAdSets, activeAds, previewHtmls);

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
  };
}
