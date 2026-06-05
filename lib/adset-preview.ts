import type { AdSetPreview, AdSetWithPreviews, MetaAdSet } from "@/lib/types";

export function activeAdSetPreviews(adsets: MetaAdSet[], limit = 12): AdSetPreview[] {
  return adsets
    .filter((adset) => (adset.effective_status || adset.status || "UNKNOWN") === "ACTIVE")
    .sort((a, b) => (a.campaign_name || "").localeCompare(b.campaign_name || "") || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((adset) => ({
      id: adset.id,
      name: adset.name,
      campaignId: adset.campaign_id || "",
      campaignName: adset.campaign_name || "Unknown campaign",
      status: adset.effective_status || adset.status || "UNKNOWN",
      dailyBudget: Number(adset.daily_budget || 0),
      lifetimeBudget: Number(adset.lifetime_budget || 0),
    }));
}

export function buildAdSetPreviewsWithCreatives(
  adsets: MetaAdSet[],
  ads: { id: string; name: string; adset_id: string; status?: string; effective_status?: string }[],
  previews: Record<string, string>
): AdSetWithPreviews[] {
  const activeAdSets = adsets.filter((adset) => (adset.effective_status || adset.status || "UNKNOWN") === "ACTIVE");

  return activeAdSets
    .sort((a, b) => (a.campaign_name || "").localeCompare(b.campaign_name || "") || a.name.localeCompare(b.name))
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
        campaignName: adset.campaign_name || "Unknown campaign",
        status: adset.effective_status || adset.status || "UNKNOWN",
        dailyBudget: Number(adset.daily_budget || 0),
        lifetimeBudget: Number(adset.lifetime_budget || 0),
        ads: adsetAds,
      };
    });
}
