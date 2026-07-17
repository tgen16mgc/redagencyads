import type { AdSetPreview, AdSetWithPreviews, MetaAdSet, MetaCampaign } from "@/lib/types";

export type CampaignNameSource =
  | MetaCampaign[]
  | ReadonlyMap<string, string>
  | Readonly<Record<string, string>>;

function campaignNameMap(source?: CampaignNameSource): Map<string, string> {
  if (!source) return new Map();
  if (Array.isArray(source)) {
    return new Map(source.map((campaign) => [campaign.id, campaign.name]));
  }
  if (source instanceof Map) return new Map(source);
  return new Map(Object.entries(source));
}

function shortIdentifier(value: string): string {
  return value.length > 8 ? `…${value.slice(-6)}` : value;
}

function resolveCampaignName(adset: MetaAdSet, campaigns: Map<string, string>): string {
  const campaignId = adset.campaign_id || "";
  const selectedCampaignName = campaigns.get(campaignId)?.trim();
  if (selectedCampaignName) return selectedCampaignName;

  const payloadCampaignName = adset.campaign_name?.trim();
  if (payloadCampaignName) return payloadCampaignName;

  const identifier = campaignId || adset.id;
  return identifier
    ? `Campaign unavailable · ${shortIdentifier(identifier)}`
    : "Campaign unavailable";
}

export function activeAdSetPreviews(
  adsets: MetaAdSet[],
  limit = 12,
  campaignNames?: CampaignNameSource
): AdSetPreview[] {
  const campaigns = campaignNameMap(campaignNames);

  return adsets
    .filter((adset) => (adset.effective_status || adset.status || "UNKNOWN") === "ACTIVE")
    .map((adset) => ({
      id: adset.id,
      name: adset.name,
      campaignId: adset.campaign_id || "",
      campaignName: resolveCampaignName(adset, campaigns),
      status: adset.effective_status || adset.status || "UNKNOWN",
      dailyBudget: Number(adset.daily_budget || 0),
      lifetimeBudget: Number(adset.lifetime_budget || 0),
    }))
    .sort((a, b) => a.campaignName.localeCompare(b.campaignName) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildAdSetPreviewsWithCreatives(
  adsets: MetaAdSet[],
  ads: { id: string; name: string; adset_id: string; status?: string; effective_status?: string }[],
  previews: Record<string, string>,
  campaignNames?: CampaignNameSource
): AdSetWithPreviews[] {
  const campaigns = campaignNameMap(campaignNames);
  const activeAdSets = adsets.filter((adset) => (adset.effective_status || adset.status || "UNKNOWN") === "ACTIVE");

  return activeAdSets
    .map((adset) => {
      const adsetAds = ads
        .filter((ad) => ad.adset_id === adset.id)
        .map((ad) => ({
          id: ad.id,
          name: ad.name,
          adsetId: ad.adset_id,
          previewHtml: previews[ad.id] || "",
        }));

      return {
        id: adset.id,
        name: adset.name,
        campaignId: adset.campaign_id || "",
        campaignName: resolveCampaignName(adset, campaigns),
        status: adset.effective_status || adset.status || "UNKNOWN",
        dailyBudget: Number(adset.daily_budget || 0),
        lifetimeBudget: Number(adset.lifetime_budget || 0),
        ads: adsetAds,
      };
    })
    .sort((a, b) => a.campaignName.localeCompare(b.campaignName) || a.name.localeCompare(b.name));
}
