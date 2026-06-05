import type { AdSetPreview, MetaAdSet } from "@/lib/types";

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
