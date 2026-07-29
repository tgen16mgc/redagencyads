import type { TikTokAdLibraryRow } from "@/lib/types";

export type CreativeSearchFilters = {
  keyword?: string;
  startDate?: string;
  endDate?: string;
  format?: TikTokAdLibraryRow["format"];
  objective?: string;
  industry?: string;
  performanceTier?: TikTokAdLibraryRow["performanceTier"];
};

function normalize(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() || "";
}

export function searchCreativeCatalog(rows: TikTokAdLibraryRow[], filters: CreativeSearchFilters) {
  const keyword = normalize(filters.keyword);
  const objective = normalize(filters.objective);
  const industry = normalize(filters.industry);
  return rows.filter((row) => {
    const text = normalize([row.advertiserName, row.adTitle, row.caption, row.cta, row.landingUrl].filter(Boolean).join(" "));
    return (!keyword || text.includes(keyword))
      && (!filters.startDate || !row.lastSeen || row.lastSeen >= filters.startDate)
      && (!filters.endDate || !row.firstSeen || row.firstSeen <= filters.endDate)
      && (!filters.format || row.format === filters.format)
      && (!objective || normalize(row.objective).includes(objective))
      && (!industry || normalize(row.industry).includes(industry))
      && (!filters.performanceTier || row.performanceTier === filters.performanceTier);
  });
}

export function creativeSearchBenchmark(rows: TikTokAdLibraryRow[], filters: CreativeSearchFilters) {
  const startedAt = performance.now();
  const results = searchCreativeCatalog(rows, filters);
  const durationMs = performance.now() - startedAt;
  return { results, durationMs, recordCount: rows.length, acceptanceMet: rows.length < 10_000 || durationMs < 2_000 };
}
