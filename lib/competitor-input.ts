function splitInput(value: string | string[]) {
  const rows = Array.isArray(value) ? value : value.split(/[\n,]/);
  return rows.map((item) => item.trim()).filter(Boolean);
}

function uniqueStable(values: string[], maxItems: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function normalizeCompetitorNames(value: string | string[], maxItems = 8) {
  return uniqueStable(splitInput(value), maxItems);
}

export function normalizeCompetitorUrls(value: string | string[], maxItems = 8) {
  const validUrls = splitInput(value).filter((item) => {
    try {
      const url = new URL(item);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });
  return uniqueStable(validUrls, maxItems);
}

export function normalizeCompetitorLimit(value: number, fallback = 20) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(80, Math.trunc(value)));
}

export function normalizeCompetitorCountry(value: string, fallback = "VN") {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  return normalized.length === 2 ? normalized : fallback;
}
