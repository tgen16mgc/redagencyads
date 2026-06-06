import type { NormalizedRow } from "@/lib/types";
import { classifyCreativeFatigue } from "./creative-fatigue";

export type StarvedAd = {
  adId: string;
  adName: string;
  spend: number;
  spendShare: number;
};

export type FlaggedStarvationAdset = {
  adsetId: string;
  adsetName: string;
  dominantAdId: string;
  dominantAdName: string;
  dominantAdSpendShare: number;
  starvedAds: StarvedAd[];
  reason: { en: string; vi: string };
};

export type CreativeStarvationAssessment = {
  status: "clean" | "warning" | "insufficient_data";
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  adsets: FlaggedStarvationAdset[];
};

const labels: Record<CreativeStarvationAssessment["status"], { en: string; vi: string }> = {
  clean: { en: "Creative spend healthy", vi: "Phân bổ ngân sách creative ổn định" },
  warning: { en: "Creative starvation detected", vi: "Phát hiện starvation creative" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

export function assessCreativeStarvation(rows: NormalizedRow[]): CreativeStarvationAssessment {
  const adsetGroups = new Map<string, { name: string; ads: NormalizedRow[] }>();

  // Filter and group by adset
  for (const row of rows) {
    if (row.level !== "ad") continue;
    const adsetId = row.adsetId || "unknown";
    const group = adsetGroups.get(adsetId) || { name: row.adsetName || "Unknown ad set", ads: [] };
    group.ads.push(row);
    adsetGroups.set(adsetId, group);
  }

  const flaggedAdsets: FlaggedStarvationAdset[] = [];
  let totalAdSpend = 0;

  for (const [adsetId, group] of adsetGroups.entries()) {
    const adsWithSpend = group.ads.filter((ad) => ad.spend > 0);
    if (adsWithSpend.length === 0) continue;

    const totalSpend = adsWithSpend.reduce((sum, ad) => sum + ad.spend, 0);
    totalAdSpend += totalSpend;

    const adInfos = adsWithSpend.map((ad) => {
      const spend = ad.spend;
      const spendShare = spend / totalSpend;
      const fatigue = classifyCreativeFatigue(ad);
      return {
        ad,
        spend,
        spendShare,
        fatigueStatus: fatigue.status,
      };
    });

    const dominantFatigued = adInfos.find(
      (info) => info.fatigueStatus === "fatigued" && info.spendShare >= 0.8
    );

    if (dominantFatigued) {
      const starvedFresh = adInfos
        .filter((info) => info.fatigueStatus === "fresh" && info.spendShare < 0.05)
        .map((info) => ({
          adId: info.ad.adId || info.ad.id,
          adName: info.ad.name,
          spend: info.spend,
          spendShare: info.spendShare,
        }));

      if (starvedFresh.length > 0) {
        const pct = Math.round(dominantFatigued.spendShare * 100);
        flaggedAdsets.push({
          adsetId,
          adsetName: group.name,
          dominantAdId: dominantFatigued.ad.adId || dominantFatigued.ad.id,
          dominantAdName: dominantFatigued.ad.name,
          dominantAdSpendShare: dominantFatigued.spendShare,
          starvedAds: starvedFresh,
          reason: {
            en: `Ad "${dominantFatigued.ad.name}" is fatigued but dominates ${pct}% of spend, while ${starvedFresh.length} fresh creative(s) are starved of budget.`,
            vi: `Quảng cáo "${dominantFatigued.ad.name}" đã mỏi nhưng chiếm đến ${pct}% ngân sách, khiến ${starvedFresh.length} creative mới bị thiếu chi tiêu.`,
          },
        });
      }
    }
  }

  if (totalAdSpend <= 0) {
    return {
      status: "insufficient_data",
      variant: "outline",
      label: labels.insufficient_data,
      summary: {
        en: "Need served ad rows with spend before checking creative spend starvation.",
        vi: "Cần dữ liệu ad có chi tiêu trước khi kiểm tra việc phân bổ ngân sách creative.",
      },
      adsets: [],
    };
  }

  const status = flaggedAdsets.length > 0 ? "warning" : "clean";

  return {
    status,
    variant: status === "warning" ? "destructive" : "secondary",
    label: labels[status],
    summary: {
      en: status === "warning"
        ? "Some ad sets show creative starvation where a fatigued creative dominates spend and blocks fresh testing."
        : "Creative spend is distributed reasonably, or dominant creatives are not fatigued.",
      vi: status === "warning"
        ? "Một số ad set bị hiện tượng mỏi creative chiếm ngân sách lớn và chặn thử nghiệm creative mới."
        : "Chi tiêu creative được phân bổ hợp lý, hoặc các creative chiếm đa số không bị mỏi.",
    },
    adsets: flaggedAdsets,
  };
}
