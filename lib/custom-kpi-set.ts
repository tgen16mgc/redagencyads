import type { InterfaceLanguage, KpiCard, NormalizedRow } from "@/lib/types";

export const CUSTOM_KPI_SET_STORAGE_KEY = "decision-workspace-custom-kpi-set";
export const LEGACY_CUSTOM_KPI_SET_STORAGE_KEY = "redagencyads-custom-kpi-set";

export type CustomKpiKey = Exclude<KpiCard["key"], "healthScore">;

type CustomKpiCatalogMetric = KpiCard & { key: CustomKpiKey };

type CustomKpiCatalogGroup = {
  id: string;
  label: string;
  metrics: CustomKpiCatalogMetric[];
};

const CUSTOM_KPI_CATALOG_GROUPS: Array<{
  id: string;
  label: Record<InterfaceLanguage, string>;
  metrics: CustomKpiCatalogMetric[];
}> = [
  {
    id: "delivery",
    label: { en: "Delivery", vi: "Phân phối" },
    metrics: [
      { key: "spend", label: "Spend", format: "currency" },
      { key: "impressions", label: "Impressions", format: "number" },
      { key: "reach", label: "Reach", format: "number" },
      { key: "frequency", label: "Frequency", format: "number" },
      { key: "cpm", label: "CPM", format: "currency" },
    ],
  },
  {
    id: "traffic",
    label: { en: "Traffic", vi: "Lưu lượng" },
    metrics: [
      { key: "clicks", label: "Clicks", format: "number" },
      { key: "linkClicks", label: "Link clicks", format: "number", intent: "good" },
      { key: "ctr", label: "CTR", format: "percent" },
      { key: "cpc", label: "CPC", format: "currency" },
    ],
  },
  {
    id: "messaging",
    label: { en: "Messaging", vi: "Tin nhắn" },
    metrics: [
      { key: "messages", label: "Messages", format: "number", intent: "good" },
      { key: "replies", label: "Replies", format: "number", intent: "good" },
      { key: "costPerMessage", label: "Cost/message", format: "currency" },
      { key: "costPerReply", label: "Cost/reply", format: "currency" },
      { key: "replyRate", label: "Reply rate", format: "percent" },
    ],
  },
  {
    id: "leads",
    label: { en: "Leads", vi: "Khách hàng tiềm năng" },
    metrics: [
      { key: "leads", label: "Leads", format: "number", intent: "good" },
      { key: "cpl", label: "CPL", format: "currency" },
      { key: "leadRate", label: "Lead/message", format: "percent" },
    ],
  },
  {
    id: "sales",
    label: { en: "Sales", vi: "Doanh số" },
    metrics: [
      { key: "purchases", label: "Purchases", format: "number", intent: "good" },
      { key: "addToCart", label: "Add to cart", format: "number", intent: "good" },
      { key: "initiateCheckout", label: "Checkout", format: "number", intent: "good" },
      { key: "cpaPurchase", label: "CPA", format: "currency" },
      { key: "roas", label: "ROAS", format: "ratio" },
    ],
  },
];

const CATALOG_BY_KEY = new Map<CustomKpiKey, CustomKpiCatalogMetric>(
  CUSTOM_KPI_CATALOG_GROUPS.flatMap((group) => group.metrics).map((metric) => [metric.key, metric]),
);

export function getCustomKpiCatalogGroups(language: InterfaceLanguage = "en"): CustomKpiCatalogGroup[] {
  return CUSTOM_KPI_CATALOG_GROUPS.map((group) => ({
    id: group.id,
    label: group.label[language],
    metrics: group.metrics,
  }));
}

export function serializeCustomKpiSet(keys: CustomKpiKey[]) {
  return JSON.stringify(keys);
}

export function deserializeCustomKpiSet(raw: string | null, defaultKpis: KpiCard[]): CustomKpiKey[] {
  const fallback = defaultKpiKeys(defaultKpis);
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;

    const keys = normalizeKpiKeys(parsed);
    return keys.length ? keys : fallback;
  } catch {
    return fallback;
  }
}

export function buildCustomKpiCards(keys: CustomKpiKey[]): KpiCard[] {
  return keys.flatMap((key) => {
    const metric = CATALOG_BY_KEY.get(key);
    return metric ? [{ ...metric }] : [];
  });
}

export function normalizeKpiKeys(keys: unknown[]): CustomKpiKey[] {
  const seen = new Set<CustomKpiKey>();
  const normalized: CustomKpiKey[] = [];

  for (const key of keys) {
    if (typeof key !== "string") continue;
    if (!isCustomKpiKey(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return normalized;
}

function defaultKpiKeys(defaultKpis: KpiCard[]): CustomKpiKey[] {
  const keys = normalizeKpiKeys(defaultKpis.map((kpi) => kpi.key));
  return keys.length ? keys : ["spend"];
}

function isCustomKpiKey(key: string): key is keyof NormalizedRow {
  return CATALOG_BY_KEY.has(key as CustomKpiKey);
}
