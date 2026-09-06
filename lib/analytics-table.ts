import type { NormalizedRow } from "@/lib/types";

export function selectAnalyticsRows(rows: NormalizedRow[], query: string, resultKey: keyof NormalizedRow, spendWithoutResults: boolean, sortKey: keyof NormalizedRow, direction: "asc" | "desc") {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const matches = [row.name, row.id, row.campaignId, row.campaignName, row.adsetId, row.adsetName, row.date].some((value) => String(value || "").toLocaleLowerCase().includes(search));
    const availability = row.metricAvailability as Partial<Record<keyof NormalizedRow, string>> | undefined;
    return matches && (!spendWithoutResults || (row.spend > 0 && availability?.[resultKey] !== "not_tracked" && Number.isFinite(row[resultKey]) && Number(row[resultKey]) === 0));
  }).sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    if (typeof left === "number" && !Number.isFinite(left) && typeof right === "number" && !Number.isFinite(right)) return 0;
    if (typeof left === "number" && !Number.isFinite(left)) return 1;
    if (typeof right === "number" && !Number.isFinite(right)) return -1;
    const delta = typeof left === "number" && typeof right === "number" ? left - right : String(left || "").localeCompare(String(right || ""));
    return direction === "asc" ? delta : -delta;
  });
}

export function analyticsNumber(value: number, currency?: string) {
  if (!Number.isFinite(value)) return "—";
  const validCurrency = currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined;
  return new Intl.NumberFormat("en", { maximumFractionDigits: validCurrency === "VND" ? 0 : 2, ...(validCurrency ? { style: "currency", currency: validCurrency } : {}) }).format(value);
}
