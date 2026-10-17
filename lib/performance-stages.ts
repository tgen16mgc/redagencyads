import { comparisonDescriptor } from "@/lib/metric-comparison";
import type { CompareMode, DashboardReport, InterfaceLanguage, KpiPack, NormalizedRow, OutcomeMetricKey } from "@/lib/types";

export const FUNNEL_STAGE_STORAGE_KEY = "decision-workspace-funnel-stages";

export type PerformanceStageKey = "exposure" | "reach" | "impressions" | "traffic" | "cart" | "checkout" | "purchase" | "lead" | "conversations" | "replies" | "saturation";

export type StageAvailability = "available" | "not_tracked" | "insufficient";

export type PerformanceStage = {
  key: PerformanceStageKey;
  label: string;
  name: string;
  category: string;
  relation: string;
  value: number | null;
  unit: string;
  efficiency: string;
  movement: string;
  tone: "success" | "warning" | "primary";
  availability: StageAvailability;
  statusLabel: string;
};

type StageArgs = {
  report: DashboardReport;
  previousReport?: DashboardReport | null;
  compareMode: CompareMode;
  language: InterfaceLanguage;
  stageKeys?: PerformanceStageKey[] | null;
};

const DEFAULT_STAGE_KEYS: Record<KpiPack, PerformanceStageKey[]> = {
  lead_gen: ["exposure", "traffic", "lead"],
  messages: ["exposure", "traffic", "conversations", "replies"],
  sales_roas: ["exposure", "traffic", "cart", "checkout", "purchase"],
  traffic: ["exposure", "traffic"],
  awareness: ["reach", "impressions", "saturation"],
};

const STAGE_CATALOG: Array<{ key: PerformanceStageKey; label: Record<InterfaceLanguage, string>; description: Record<InterfaceLanguage, string> }> = [
  { key: "exposure", label: { en: "Exposure", vi: "Phân phối" }, description: { en: "Impression delivery", vi: "Lượt hiển thị được phân phối" } },
  { key: "reach", label: { en: "Reach", vi: "Tiếp cận" }, description: { en: "Unique people reached", vi: "Số người tiếp cận duy nhất" } },
  { key: "impressions", label: { en: "Impressions", vi: "Lượt hiển thị" }, description: { en: "Total delivered impressions", vi: "Tổng lượt hiển thị" } },
  { key: "traffic", label: { en: "Link clicks", vi: "Click liên kết" }, description: { en: "Traffic from ads", vi: "Lưu lượng từ quảng cáo" } },
  { key: "conversations", label: { en: "Conversations", vi: "Hội thoại" }, description: { en: "Messaging conversations started", vi: "Hội thoại bắt đầu" } },
  { key: "replies", label: { en: "Replies", vi: "Phản hồi" }, description: { en: "Replies from conversations", vi: "Phản hồi từ hội thoại" } },
  { key: "lead", label: { en: "Leads", vi: "Lead" }, description: { en: "Captured lead outcomes", vi: "Kết quả lead thu được" } },
  { key: "cart", label: { en: "Add to cart", vi: "Thêm vào giỏ" }, description: { en: "Commerce consideration signal", vi: "Tín hiệu cân nhắc mua" } },
  { key: "checkout", label: { en: "Checkout", vi: "Thanh toán" }, description: { en: "Checkout initiations", vi: "Lượt bắt đầu thanh toán" } },
  { key: "purchase", label: { en: "Purchases", vi: "Mua hàng" }, description: { en: "Completed purchase outcomes", vi: "Kết quả mua hàng hoàn tất" } },
  { key: "saturation", label: { en: "Saturation", vi: "Bão hòa" }, description: { en: "Frequency pressure", vi: "Áp lực tần suất" } },
];

export function defaultPerformanceStageKeys(pack: KpiPack) {
  return [...DEFAULT_STAGE_KEYS[pack]];
}

export function getPerformanceStageCatalog(language: InterfaceLanguage) {
  return STAGE_CATALOG.map((item) => ({ key: item.key, label: item.label[language], description: item.description[language] }));
}

export function normalizePerformanceStageKeys(keys: unknown[]): PerformanceStageKey[] {
  const valid = new Set(STAGE_CATALOG.map((item) => item.key));
  const seen = new Set<PerformanceStageKey>();
  return keys.flatMap((key) => {
    if (typeof key !== "string" || !valid.has(key as PerformanceStageKey) || seen.has(key as PerformanceStageKey)) return [];
    seen.add(key as PerformanceStageKey);
    return [key as PerformanceStageKey];
  });
}

export function serializePerformanceStageKeys(keys: PerformanceStageKey[]) {
  return JSON.stringify(normalizePerformanceStageKeys(keys));
}

export function deserializePerformanceStageKeys(raw: string | null, pack: KpiPack): PerformanceStageKey[] {
  if (!raw) return defaultPerformanceStageKeys(pack);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultPerformanceStageKeys(pack);
    const normalized = normalizePerformanceStageKeys(parsed);
    return normalized.length ? normalized : defaultPerformanceStageKeys(pack);
  } catch {
    return defaultPerformanceStageKeys(pack);
  }
}

export function buildPerformanceStages({ stageKeys, ...args }: StageArgs): PerformanceStage[] {
  const defaults = buildDefaultPerformanceStages(args);
  const normalized = stageKeys?.length ? normalizePerformanceStageKeys(stageKeys) : [];
  if (!normalized.length) return defaults;

  const stageMap = new Map<PerformanceStageKey, PerformanceStage>();
  const packs: KpiPack[] = [args.report.selectedPack, "lead_gen", "messages", "sales_roas", "traffic", "awareness"];
  for (const pack of packs) {
    const stages = buildDefaultPerformanceStages({ ...args, report: { ...args.report, selectedPack: pack } });
    for (const item of stages) if (!stageMap.has(item.key)) stageMap.set(item.key, item);
  }

  const selected = normalized.flatMap((key) => {
    const item = stageMap.get(key);
    return item ? [item] : [];
  });
  return selected.map((item, index) => ({
    ...item,
    label: `${String(index + 1).padStart(2, "0")} · ${item.name.toUpperCase()}`,
  }));
}

function buildDefaultPerformanceStages({ report, previousReport, compareMode, language }: Omit<StageArgs, "stageKeys">): PerformanceStage[] {
  const t = report.totals;
  const p = previousReport?.totals;
  const currencyCode = report.account.currency || "VND";
  const isVietnamese = language === "vi";
  const exposure = stage({
    key: "exposure",
    label: isVietnamese ? "01 · PHÂN PHỐI" : "01 · EXPOSURE",
    name: isVietnamese ? "Phân phối" : "Exposure",
    category: isVietnamese ? "Giai đoạn phân phối" : "Delivery stage",
    relation: isVietnamese ? "Reach → Lượt hiển thị" : "Reach → Impressions",
    value: t.impressions,
    unit: isVietnamese ? "lượt hiển thị" : "impressions",
    efficiency: `CPM ${currency(t.cpm, currencyCode, language)} · ${isVietnamese ? "Tần suất" : "Frequency"} ${t.frequency.toFixed(1)}`,
    movement: comparisonMovement(t.impressions, p?.impressions, compareMode, language, isVietnamese ? "lượng phân phối" : "volume"),
    tone: t.impressions > 0 ? "success" : "warning",
    availability: t.impressions > 0 ? "available" : "insufficient",
  }, language);

  const traffic = stage({
    key: "traffic",
    label: report.selectedPack === "traffic" ? (isVietnamese ? "02 · CLICK LINK" : "02 · LINK CLICKS") : "02 · TRAFFIC",
    name: isVietnamese ? "Traffic" : "Traffic",
    category: isVietnamese ? "Giai đoạn traffic" : "Traffic stage",
    relation: isVietnamese ? "Lượt hiển thị → Click link" : "Impressions → Link clicks",
    value: t.linkClicks,
    unit: isVietnamese ? "click link" : "link clicks",
    efficiency: `Link CTR ${linkCtr(t).toFixed(2)}% · Link CPC ${currency(linkCpc(t), currencyCode, language)}`,
    movement: comparisonMovement(linkCpc(t), p ? linkCpc(p) : undefined, compareMode, language, "Link CPC", true, true),
    tone: t.linkClicks > 0 && linkCtr(t) >= 1 ? "success" : "warning",
    availability: t.impressions > 0 ? (t.linkClicks > 0 ? "available" : "insufficient") : "insufficient",
  }, language);

  if (report.selectedPack === "sales_roas") {
    const cart = outcomeStage({
      key: "cart",
      label: isVietnamese ? "03 · THÊM GIỎ" : "03 · CART",
      name: isVietnamese ? "Thêm giỏ" : "Cart",
      category: isVietnamese ? "Giai đoạn cân nhắc" : "Consideration stage",
      relation: isVietnamese ? "Click link → Thêm giỏ" : "Link clicks → Add to cart",
      metric: "addToCart",
      value: t.addToCart,
      unit: isVietnamese ? "thêm giỏ" : "add to carts",
      efficiency: `${isVietnamese ? "Click → giỏ" : "Click → cart"} ${percent(t.addToCart, t.linkClicks)}`,
      movement: comparisonMovement(cost(t.spend, t.addToCart), p ? cost(p.spend, p.addToCart) : undefined, compareMode, language, isVietnamese ? "Chi phí / thêm giỏ" : "Cost / ATC", true, true),
      report,
      language,
      healthy: t.addToCart > 0 && ratio(t.addToCart, t.linkClicks) >= 0.05,
    });
    const checkout = outcomeStage({
      key: "checkout",
      label: "04 · CHECKOUT",
      name: "Checkout",
      category: isVietnamese ? "Giai đoạn checkout" : "Checkout stage",
      relation: isVietnamese ? "Thêm giỏ → Checkout" : "Cart → Checkout",
      metric: "initiateCheckout",
      value: t.initiateCheckout,
      unit: isVietnamese ? "lượt checkout" : "checkouts",
      efficiency: `${isVietnamese ? "Giỏ → checkout" : "Cart → checkout"} ${percent(t.initiateCheckout, t.addToCart)}`,
      movement: comparisonMovement(ratio(t.initiateCheckout, t.addToCart), p ? ratio(p.initiateCheckout, p.addToCart) : undefined, compareMode, language, isVietnamese ? "tỷ lệ bước" : "stage rate", false, false, true),
      report,
      language,
      healthy: t.initiateCheckout > 0 && ratio(t.initiateCheckout, t.addToCart) >= 0.15,
    });
    const purchase = outcomeStage({
      key: "purchase",
      label: isVietnamese ? "05 · MUA HÀNG" : "05 · PURCHASE",
      name: isVietnamese ? "Mua hàng" : "Purchase",
      category: isVietnamese ? "Giai đoạn kết quả" : "Outcome stage",
      relation: isVietnamese ? "Checkout → Mua hàng" : "Checkout → Purchase",
      metric: "purchases",
      value: t.purchases,
      unit: isVietnamese ? "mua hàng" : "purchases",
      efficiency: `CPA ${currency(t.cpaPurchase, currencyCode, language)} · ROAS ${t.roas.toFixed(1)}`,
      movement: comparisonMovement(t.roas, p?.roas, compareMode, language, "ROAS", false, false),
      report,
      language,
      healthy: t.purchases > 0 && t.roas >= 2,
      signalTone: "primary",
    });
    return [exposure, traffic, cart, checkout, purchase];
  }

  if (report.selectedPack === "lead_gen") {
    return [exposure, traffic, outcomeStage({
      key: "lead",
      label: isVietnamese ? "03 · LEAD" : "03 · LEADS",
      name: "Lead",
      category: isVietnamese ? "Giai đoạn lead" : "Lead stage",
      relation: isVietnamese ? "Click link → Lead" : "Link clicks → Leads",
      metric: "leads",
      value: t.leads,
      unit: isVietnamese ? "lead" : "leads",
      efficiency: `Click → lead ${percent(t.leads, t.linkClicks)} · CPL ${currency(t.cpl, currencyCode, language)}`,
      movement: comparisonMovement(t.cpl, p?.cpl, compareMode, language, "CPL", true, true),
      report,
      language,
      healthy: t.leads > 0,
      signalTone: "primary",
    })];
  }

  if (report.selectedPack === "messages") {
    const conversations = outcomeStage({
      key: "conversations",
      label: isVietnamese ? "03 · HỘI THOẠI" : "03 · CONVERSATIONS",
      name: isVietnamese ? "Hội thoại" : "Conversation",
      category: isVietnamese ? "Giai đoạn tin nhắn" : "Message stage",
      relation: isVietnamese ? "Click link → Hội thoại" : "Link clicks → Conversations",
      metric: "messages",
      value: t.messages,
      unit: isVietnamese ? "hội thoại" : "conversations",
      efficiency: `${isVietnamese ? "Chi phí / tin nhắn" : "Cost / message"} ${currency(t.costPerMessage, currencyCode, language)}`,
      movement: comparisonMovement(t.costPerMessage, p?.costPerMessage, compareMode, language, isVietnamese ? "chi phí / tin nhắn" : "cost / message", true, true),
      report,
      language,
      healthy: t.messages > 0,
      signalTone: "primary",
    });
    const replies = outcomeStage({
      key: "replies",
      label: isVietnamese ? "04 · PHẢN HỒI" : "04 · REPLIES",
      name: isVietnamese ? "Phản hồi" : "Reply",
      category: isVietnamese ? "Giai đoạn chất lượng" : "Quality stage",
      relation: isVietnamese ? "Hội thoại → Phản hồi" : "Conversations → Replies",
      metric: "replies",
      value: t.replies,
      unit: isVietnamese ? "phản hồi" : "replies",
      efficiency: `${isVietnamese ? "Tỷ lệ phản hồi" : "Reply rate"} ${t.replyRate.toFixed(1)}% · ${isVietnamese ? "Chi phí / phản hồi" : "Cost / reply"} ${currency(t.costPerReply, currencyCode, language)}`,
      movement: comparisonMovement(t.replyRate, p?.replyRate, compareMode, language, isVietnamese ? "tỷ lệ phản hồi" : "reply rate", false, false, true),
      report,
      language,
      healthy: t.replies > 0 && t.replyRate >= 60,
    });
    return [exposure, traffic, conversations, replies];
  }

  if (report.selectedPack === "traffic") return [exposure, traffic];

  const reach = stage({
    key: "reach",
    label: isVietnamese ? "01 · TIẾP CẬN" : "01 · REACH",
    name: isVietnamese ? "Tiếp cận" : "Reach",
    category: isVietnamese ? "Giai đoạn phân phối" : "Delivery stage",
    relation: isVietnamese ? "Audience → Reach" : "Audience → Reach",
    value: t.reach,
    unit: isVietnamese ? "người" : "people",
    efficiency: `${isVietnamese ? "Tiếp cận duy nhất" : "Unique reach"} ${compact(t.reach)}`,
    movement: comparisonMovement(t.reach, p?.reach, compareMode, language, isVietnamese ? "tiếp cận" : "reach"),
    tone: t.reach > 0 ? "success" : "warning",
    availability: t.reach > 0 ? "available" : "insufficient",
  }, language);
  const impressions = stage({
    key: "impressions",
    label: isVietnamese ? "02 · LƯỢT HIỂN THỊ" : "02 · IMPRESSIONS",
    name: isVietnamese ? "Lượt hiển thị" : "Impression",
    category: isVietnamese ? "Giai đoạn phân phối" : "Delivery stage",
    relation: isVietnamese ? "Reach → Lượt hiển thị" : "Reach → Impressions",
    value: t.impressions,
    unit: isVietnamese ? "lượt hiển thị" : "impressions",
    efficiency: `CPM ${currency(t.cpm, currencyCode, language)} · ${isVietnamese ? "Tần suất" : "Frequency"} ${t.frequency.toFixed(1)}`,
    movement: comparisonMovement(t.cpm, p?.cpm, compareMode, language, "CPM", true, true),
    tone: t.impressions > 0 ? "success" : "warning",
    availability: t.impressions > 0 ? "available" : "insufficient",
  }, language);
  const saturation = stage({
    key: "saturation",
    label: isVietnamese ? "03 · BÃO HÒA" : "03 · SATURATION",
    name: isVietnamese ? "Bão hòa" : "Saturation",
    category: isVietnamese ? "Ngưỡng awareness" : "Awareness guardrail",
    relation: isVietnamese ? "Reach → Lượt hiển thị → Frequency" : "Reach → Impressions → Frequency",
    value: t.frequency,
    unit: isVietnamese ? "tần suất" : "frequency",
    efficiency: `CPM ${currency(t.cpm, currencyCode, language)} · CTR ${t.ctr.toFixed(2)}%`,
    movement: comparisonMovement(t.frequency, p?.frequency, compareMode, language, isVietnamese ? "tần suất" : "frequency", true, false),
    tone: t.frequency >= 4 ? "warning" : "primary",
    availability: t.impressions > 0 && t.reach > 0 ? "available" : "insufficient",
  }, language);
  return [reach, impressions, saturation];
}

function outcomeStage(args: Omit<PerformanceStage, "availability" | "statusLabel" | "tone"> & {
  metric: OutcomeMetricKey;
  report: DashboardReport;
  language: InterfaceLanguage;
  healthy: boolean;
  signalTone?: PerformanceStage["tone"];
}): PerformanceStage {
  const { language, metric, report, healthy, signalTone, ...stageArgs } = args;
  const tracked = metricTracked(report.totals, metric);
  const availability: StageAvailability = !tracked ? "not_tracked" : args.value && args.value > 0 ? "available" : "insufficient";
  return stage({
    ...stageArgs,
    value: availability === "not_tracked" ? null : args.value,
    efficiency: availability === "not_tracked" ? (language === "vi" ? "Chưa theo dõi" : "Not tracked") : args.efficiency,
    movement: availability === "not_tracked" ? (language === "vi" ? "Cần thiết lập tracking" : "Tracking required") : args.movement,
    tone: availability === "available" ? (healthy ? signalTone || "success" : "warning") : "warning",
    availability,
  }, language);
}

function stage(args: Omit<PerformanceStage, "statusLabel">, language: InterfaceLanguage): PerformanceStage {
  return {
    ...args,
    statusLabel: args.availability === "not_tracked"
      ? (language === "vi" ? "Chưa theo dõi" : "Not tracked")
      : args.availability === "insufficient"
        ? (language === "vi" ? "Chưa đủ dữ liệu" : "Insufficient")
        : args.tone === "success"
          ? (language === "vi" ? "Khỏe" : "Healthy")
          : args.tone === "warning"
            ? (language === "vi" ? "Cần xem" : "Watch")
            : (language === "vi" ? "Tín hiệu" : "Signal"),
  };
}

function metricTracked(row: NormalizedRow, key: OutcomeMetricKey) {
  const status = row.metricAvailability?.[key];
  if (status) return status === "tracked";
  return Number(row[key] || 0) > 0;
}

function ratio(top: number, bottom: number) {
  return bottom > 0 ? top / bottom : 0;
}

function percent(top: number, bottom: number) {
  return `${(ratio(top, bottom) * 100).toFixed(1)}%`;
}

function cost(spend: number, result: number) {
  return result > 0 ? spend / result : 0;
}

function linkCtr(row: NormalizedRow) {
  return ratio(row.linkClicks, row.impressions) * 100;
}

function linkCpc(row: NormalizedRow) {
  return cost(row.spend, row.linkClicks);
}

function comparisonMovement(current: number, previous: number | undefined, mode: CompareMode, language: InterfaceLanguage, label: string, lowerIsBetter = false, currencyMetric = false, percentagePoint = false) {
  if (mode === "off" || previous === undefined) return language === "vi" ? "Kỳ hiện tại" : "Current period";
  if (previous === 0) return `${current > 0 ? (language === "vi" ? "Mới" : "New") : (language === "vi" ? "Không đổi" : "No change")} · ${comparisonDescriptor({ compareMode: mode, language })}`;
  const changePct = ((current - previous) / Math.abs(previous)) * 100;
  const improved = lowerIsBetter ? changePct < 0 : changePct > 0;
  const arrow = changePct > 0 ? "↑" : changePct < 0 ? "↓" : "→";
  const amount = percentagePoint ? `${Math.abs(current - previous).toFixed(1)} pp` : `${Math.abs(changePct).toFixed(1)}%`;
  const metricLabel = currencyMetric || label ? ` ${label}` : "";
  const status = improved
    ? (language === "vi" ? "tốt hơn" : "improved")
    : changePct === 0
      ? (language === "vi" ? "ổn định" : "stable")
      : (language === "vi" ? "cần theo dõi" : "watch");
  return `${arrow} ${amount}${metricLabel} · ${status} ${comparisonDescriptor({ compareMode: mode, language })}`;
}

function currency(value: number, currencyCode: string, language: InterfaceLanguage) {
  if (!Number.isFinite(value) || value <= 0) return language === "vi" ? "Chưa có dữ liệu" : "Unavailable";
  return new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(value);
}

function compact(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
