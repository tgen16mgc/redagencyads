export function normalizeTikTokProfiles(value: string | string[], maxItems = 10) {
  const rows = Array.isArray(value) ? value : value.split(/[\n,]/);
  return rows
    .map((item) => item.trim().replace(/^@/, ""))
    .filter(Boolean)
    .slice(0, maxItems);
}
