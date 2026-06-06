import type { NormalizedRow } from "@/lib/types";

export type TargetingExclusionsStatus = "clean" | "warning";

export type FlaggedTargetingAdset = {
  adsetId: string;
  adsetName: string;
  keyword: string;
  reason: { en: string; vi: string };
};

export type TargetingExclusionsAssessment = {
  status: TargetingExclusionsStatus;
  variant: "secondary" | "outline";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  flaggedAdsets: FlaggedTargetingAdset[];
};

const labels: Record<TargetingExclusionsStatus, { en: string; vi: string }> = {
  clean: { en: "Exclusions verified", vi: "Đã xác minh loại trừ" },
  warning: { en: "Exclusions check needed", vi: "Cần kiểm tra loại trừ" },
};

const EXCLUSION_KEYWORDS = [
  "exclude",
  "loại trừ",
  "no purchase",
  "no purchaser",
  "no customer",
  "no-purchase",
  "no-customer",
  "non-buyer",
  "non-purchaser",
];

export function assessTargetingExclusions(adsets: NormalizedRow[]): TargetingExclusionsAssessment {
  const flaggedAdsets: FlaggedTargetingAdset[] = [];

  for (const adset of adsets) {
    if (adset.level !== "adset" && adset.level !== "campaign") continue;
    const nameLower = adset.name.toLowerCase();
    const matchedKeyword = EXCLUSION_KEYWORDS.find((keyword) => nameLower.includes(keyword));

    if (matchedKeyword) {
      flaggedAdsets.push({
        adsetId: adset.id,
        adsetName: adset.name,
        keyword: matchedKeyword,
        reason: {
          en: `Ad set name matches "${matchedKeyword}". Detailed targeting exclusions are fully phased out in 2026. Verify that you are using valid Custom Audience exclusions instead of discontinued detailed exclusions.`,
          vi: `Tên ad set chứa từ khóa "${matchedKeyword}". Các loại trừ nhắm mục tiêu chi tiết đã bị loại bỏ hoàn toàn trong năm 2026. Hãy xác minh bạn đang sử dụng Custom Audience để loại trừ.`,
        },
      });
    }
  }

  const status = flaggedAdsets.length > 0 ? "warning" : "clean";

  return {
    status,
    variant: status === "warning" ? "outline" : "secondary",
    label: labels[status],
    summary: {
      en: status === "warning"
        ? "Some active ad sets may be using discontinued detailed targeting exclusions. Verify your audience exclusion setup."
        : "No obvious detailed targeting exclusions keywords detected in active ad sets.",
      vi: status === "warning"
        ? "Một số ad set có thể đang sử dụng loại trừ chi tiết đã bị bãi bỏ. Hãy kiểm tra cấu hình audience loại trừ."
        : "Không phát hiện từ khóa loại trừ nhắm mục tiêu chi tiết trong các ad set hoạt động.",
    },
    flaggedAdsets,
  };
}
