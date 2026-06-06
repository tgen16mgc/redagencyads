import type { NormalizedRow } from "@/lib/types";

export type AudienceOverlapStatus = "clean" | "overlap_risk" | "insufficient_data";

export type OverlapPair = {
  name1: string;
  name2: string;
  similarity: number;
};

export type AudienceOverlap = {
  status: AudienceOverlapStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  pairs: OverlapPair[];
};

const labels: Record<AudienceOverlapStatus, { en: string; vi: string }> = {
  clean: { en: "No target overlap", vi: "Không trùng đối tượng" },
  overlap_risk: { en: "Overlap risk", vi: "Trùng đối tượng" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

function cleanNameTokens(name: string): string[] {
  // Normalize common target/ad set terms
  return name
    .toLowerCase()
    .replace(/lookalike/g, "lal")
    .replace(/purchases/g, "purchase")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !["vietnam", "vn", "target"].includes(token));
}

function calculateSimilarity(name1: string, name2: string): number {
  const tokens1 = cleanNameTokens(name1);
  const tokens2 = cleanNameTokens(name2);
  if (tokens1.length === 0 || tokens2.length === 0) {
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9]/g, "");
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.8;
    return 0;
  }
  const intersection = tokens1.filter((t) => tokens2.includes(t));
  const tokenSim = intersection.length / Math.max(tokens1.length, tokens2.length);

  // If token-based overlap is weak, check direct substring containment
  if (tokenSim < 0.5) {
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/lookalike/g, "lal").replace(/purchases/g, "purchase");
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/lookalike/g, "lal").replace(/purchases/g, "purchase");
    if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.7;
  }

  return tokenSim;
}

export function assessAudienceOverlap(adsets: NormalizedRow[]): AudienceOverlap {
  const activeAdsets = adsets.filter((row) => row.spend > 0);

  if (activeAdsets.length < 2) {
    return {
      status: "insufficient_data",
      variant: "outline",
      label: labels.insufficient_data,
      summary: {
        en: "Need at least 2 active ad sets with spend to analyze targeting overlap risk.",
        vi: "Cần tối thiểu 2 ad set active có chi tiêu để phân tích rủi ro trùng đối tượng.",
      },
      pairs: [],
    };
  }

  const pairs: OverlapPair[] = [];

  for (let i = 0; i < activeAdsets.length; i++) {
    for (let j = i + 1; j < activeAdsets.length; j++) {
      const similarity = calculateSimilarity(activeAdsets[i].name, activeAdsets[j].name);
      if (similarity >= 0.5) {
        pairs.push({
          name1: activeAdsets[i].name,
          name2: activeAdsets[j].name,
          similarity,
        });
      }
    }
  }

  if (pairs.length > 0) {
    const highest = pairs.sort((a, b) => b.similarity - a.similarity)[0];
    return {
      status: "overlap_risk",
      variant: "destructive",
      label: labels.overlap_risk,
      summary: {
        en: `Potential audience overlap found between highly similar ad sets: "${highest.name1}" and "${highest.name2}" (${(highest.similarity * 100).toFixed(0)}% similarity).`,
        vi: `Phát hiện rủi ro trùng đối tượng giữa các ad set tương đồng: "${highest.name1}" và "${highest.name2}" (tương đồng ${(highest.similarity * 100).toFixed(0)}%).`,
      },
      pairs,
    };
  }

  return {
    status: "clean",
    variant: "secondary",
    label: labels.clean,
    summary: {
      en: "Targeting names suggest distinct audiences. Low overlap risk.",
      vi: "Tên nhắm mục tiêu cho thấy đối tượng riêng biệt. Rủi ro trùng lắp thấp.",
    },
    pairs: [],
  };
}
