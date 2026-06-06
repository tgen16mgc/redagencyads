import type { NormalizedRow } from "@/lib/types";

export type CreativeVolumeStatus = "healthy" | "watch" | "constrained" | "insufficient_data";

export type CreativeVolumeAdset = {
  adsetId: string;
  adsetName: string;
  creativeCount: number;
  status: Exclude<CreativeVolumeStatus, "insufficient_data">;
  variant: "secondary" | "outline" | "destructive";
  reason: { en: string; vi: string };
};

export type CreativeVolumeAssessment = {
  status: CreativeVolumeStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  adsets: CreativeVolumeAdset[];
};

const labels: Record<CreativeVolumeStatus, { en: string; vi: string }> = {
  healthy: { en: "Creative volume healthy", vi: "Đủ volume creative" },
  watch: { en: "Creative volume watch", vi: "Theo dõi volume creative" },
  constrained: { en: "Creative constrained", vi: "Thiếu creative" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

function served(row: NormalizedRow) {
  return row.level === "ad" && (row.spend > 0 || row.impressions > 0);
}

function classify(creativeCount: number): CreativeVolumeAdset["status"] {
  if (creativeCount < 3) return "constrained";
  if (creativeCount < 5) return "watch";
  return "healthy";
}

function variant(status: CreativeVolumeAdset["status"]): CreativeVolumeAdset["variant"] {
  if (status === "constrained") return "destructive";
  if (status === "watch") return "outline";
  return "secondary";
}

function reason(status: CreativeVolumeAdset["status"], creativeCount: number) {
  if (status === "constrained") {
    return {
      en: `Only ${creativeCount} active/spent creatives; fewer than 3 is a creative-volume constraint.`,
      vi: `Chỉ có ${creativeCount} creative có chạy/chi tiêu; dưới 3 là rủi ro thiếu volume creative.`,
    };
  }
  if (status === "watch") {
    return {
      en: `${creativeCount} active/spent creatives; standard Meta guardrail is at least 5 per ad set.`,
      vi: `${creativeCount} creative có chạy/chi tiêu; guardrail Meta tiêu chuẩn là tối thiểu 5 mỗi ad set.`,
    };
  }
  return {
    en: `${creativeCount} active/spent creatives meets the standard minimum proxy.`,
    vi: `${creativeCount} creative có chạy/chi tiêu đạt proxy tối thiểu tiêu chuẩn.`,
  };
}

export function assessCreativeVolume(rows: NormalizedRow[]): CreativeVolumeAssessment {
  const groups = new Map<string, { name: string; ads: Set<string> }>();

  for (const row of rows) {
    if (!served(row)) continue;
    const adsetId = row.adsetId || "unknown";
    const group = groups.get(adsetId) || { name: row.adsetName || "Unknown ad set", ads: new Set<string>() };
    group.ads.add(row.adId || row.id);
    groups.set(adsetId, group);
  }

  if (groups.size === 0) {
    return {
      status: "insufficient_data",
      variant: "outline",
      label: labels.insufficient_data,
      summary: {
        en: "Need served ad rows before checking active creative volume per ad set.",
        vi: "Cần dữ liệu ad đã phân phối trước khi kiểm tra volume creative theo ad set.",
      },
      adsets: [],
    };
  }

  const adsets = Array.from(groups.entries()).map(([adsetId, group]) => {
    const creativeCount = group.ads.size;
    const status = classify(creativeCount);
    return {
      adsetId,
      adsetName: group.name,
      creativeCount,
      status,
      variant: variant(status),
      reason: reason(status, creativeCount),
    };
  }).sort((a, b) => a.creativeCount - b.creativeCount || a.adsetName.localeCompare(b.adsetName) || a.adsetId.localeCompare(b.adsetId));

  const status = adsets.some((item) => item.status === "constrained") ? "constrained" : adsets.some((item) => item.status === "watch") ? "watch" : "healthy";

  return {
    status,
    variant: status === "constrained" ? "destructive" : status === "watch" ? "outline" : "secondary",
    label: labels[status],
    summary: {
      en: status === "healthy" ? "Active/spent creative count meets the standard minimum proxy across served ad sets." : "Some served ad sets may not have enough active/spent creatives for reliable Meta delivery exploration.",
      vi: status === "healthy" ? "Số creative có chạy/chi tiêu đạt proxy tối thiểu tiêu chuẩn trên các ad set đã phân phối." : "Một số ad set đã phân phối có thể chưa đủ creative có chạy/chi tiêu để Meta khám phá delivery ổn định.",
    },
    adsets,
  };
}
