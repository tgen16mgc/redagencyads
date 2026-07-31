import { comparisonDescriptor } from "@/lib/metric-comparison";
import type { CompareMode, DashboardReport, InterfaceLanguage, NormalizedRow, OutcomeMetricKey } from "@/lib/types";

export type StageAvailability = "available" | "not_tracked" | "insufficient";

export type PerformanceStage = {
  key: "exposure" | "reach" | "impressions" | "traffic" | "cart" | "checkout" | "purchase" | "lead" | "conversations" | "replies" | "saturation";
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
};

export function buildPerformanceStages({ report, previousReport, compareMode, language }: StageArgs): PerformanceStage[] {
  const t = report.totals;
  const p = previousReport?.totals;
  const currencyCode = report.account.currency || "VND";
  const isVietnamese = language === "vi";
  const exposure = stage({
    key: "exposure",
    label: "01 · EXPOSURE",
    name: isVietnamese ? "Phân phối" : "Exposure",
    category: isVietnamese ? "Giai đoạn phân phối" : "Delivery stage",
    relation: isVietnamese ? "Reach → Lượt hiển thị" : "Reach → Impressions",
    value: t.impressions,
    unit: isVietnamese ? "lượt hiển thị" : "impressions",
    efficiency: `CPM ${currency(t.cpm, currencyCode)} · Freq ${t.frequency.toFixed(1)}`,
    movement: comparisonMovement(t.impressions, p?.impressions, compareMode, language, isVietnamese ? "volume" : "volume"),
    tone: t.impressions > 0 ? "success" : "warning",
    availability: t.impressions > 0 ? "available" : "insufficient",
  });

  const traffic = stage({
    key: "traffic",
    label: report.selectedPack === "traffic" ? "02 · LINK CLICKS" : "02 · TRAFFIC",
    name: isVietnamese ? "Traffic" : "Traffic",
    category: isVietnamese ? "Giai đoạn traffic" : "Traffic stage",
    relation: isVietnamese ? "Lượt hiển thị → Click link" : "Impressions → Link clicks",
    value: t.linkClicks,
    unit: isVietnamese ? "click link" : "link clicks",
    efficiency: `Link CTR ${linkCtr(t).toFixed(2)}% · Link CPC ${currency(linkCpc(t), currencyCode)}`,
    movement: comparisonMovement(linkCpc(t), p ? linkCpc(p) : undefined, compareMode, language, "Link CPC", true, true),
    tone: t.linkClicks > 0 && linkCtr(t) >= 1 ? "success" : "warning",
    availability: t.impressions > 0 ? (t.linkClicks > 0 ? "available" : "insufficient") : "insufficient",
  });

  if (report.selectedPack === "sales_roas") {
    const cart = outcomeStage({
      key: "cart",
      label: "03 · CART",
      name: isVietnamese ? "Thêm giỏ" : "Cart",
      category: isVietnamese ? "Giai đoạn cân nhắc" : "Consideration stage",
      relation: isVietnamese ? "Click link → Thêm giỏ" : "Link clicks → Add to cart",
      metric: "addToCart",
      value: t.addToCart,
      unit: isVietnamese ? "thêm giỏ" : "add to carts",
      efficiency: `Click → cart ${percent(t.addToCart, t.linkClicks)}`,
      movement: comparisonMovement(cost(t.spend, t.addToCart), p ? cost(p.spend, p.addToCart) : undefined, compareMode, language, "Cost / ATC", true, true),
      report,
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
      unit: "checkouts",
      efficiency: `Cart → checkout ${percent(t.initiateCheckout, t.addToCart)}`,
      movement: comparisonMovement(ratio(t.initiateCheckout, t.addToCart), p ? ratio(p.initiateCheckout, p.addToCart) : undefined, compareMode, language, "stage rate", false, false, true),
      report,
      healthy: t.initiateCheckout > 0 && ratio(t.initiateCheckout, t.addToCart) >= 0.15,
    });
    const purchase = outcomeStage({
      key: "purchase",
      label: "05 · PURCHASE",
      name: isVietnamese ? "Mua hàng" : "Purchase",
      category: isVietnamese ? "Giai đoạn kết quả" : "Outcome stage",
      relation: isVietnamese ? "Checkout → Mua hàng" : "Checkout → Purchase",
      metric: "purchases",
      value: t.purchases,
      unit: isVietnamese ? "mua hàng" : "purchases",
      efficiency: `CPA ${currency(t.cpaPurchase, currencyCode)} · ROAS ${t.roas.toFixed(1)}`,
      movement: comparisonMovement(t.roas, p?.roas, compareMode, language, "ROAS", false, false),
      report,
      healthy: t.purchases > 0 && t.roas >= 2,
      signalTone: "primary",
    });
    return [exposure, traffic, cart, checkout, purchase];
  }

  if (report.selectedPack === "lead_gen") {
    return [exposure, traffic, outcomeStage({
      key: "lead",
      label: "03 · LEADS",
      name: "Lead",
      category: isVietnamese ? "Giai đoạn lead" : "Lead stage",
      relation: isVietnamese ? "Click link → Lead" : "Link clicks → Leads",
      metric: "leads",
      value: t.leads,
      unit: "leads",
      efficiency: `Click → lead ${percent(t.leads, t.linkClicks)} · CPL ${currency(t.cpl, currencyCode)}`,
      movement: comparisonMovement(t.cpl, p?.cpl, compareMode, language, "CPL", true, true),
      report,
      healthy: t.leads > 0,
      signalTone: "primary",
    })];
  }

  if (report.selectedPack === "messages") {
    const conversations = outcomeStage({
      key: "conversations",
      label: "03 · CONVERSATIONS",
      name: isVietnamese ? "Hội thoại" : "Conversation",
      category: isVietnamese ? "Giai đoạn tin nhắn" : "Message stage",
      relation: isVietnamese ? "Click link → Hội thoại" : "Link clicks → Conversations",
      metric: "messages",
      value: t.messages,
      unit: isVietnamese ? "hội thoại" : "conversations",
      efficiency: `Cost / message ${currency(t.costPerMessage, currencyCode)}`,
      movement: comparisonMovement(t.costPerMessage, p?.costPerMessage, compareMode, language, "cost / message", true, true),
      report,
      healthy: t.messages > 0,
      signalTone: "primary",
    });
    const replies = outcomeStage({
      key: "replies",
      label: "04 · REPLIES",
      name: isVietnamese ? "Phản hồi" : "Reply",
      category: isVietnamese ? "Giai đoạn chất lượng" : "Quality stage",
      relation: isVietnamese ? "Hội thoại → Phản hồi" : "Conversations → Replies",
      metric: "replies",
      value: t.replies,
      unit: isVietnamese ? "phản hồi" : "replies",
      efficiency: `Reply rate ${t.replyRate.toFixed(1)}% · Cost / reply ${currency(t.costPerReply, currencyCode)}`,
      movement: comparisonMovement(t.replyRate, p?.replyRate, compareMode, language, "reply rate", false, false, true),
      report,
      healthy: t.replies > 0 && t.replyRate >= 60,
    });
    return [exposure, traffic, conversations, replies];
  }

  if (report.selectedPack === "traffic") return [exposure, traffic];

  const reach = stage({
    key: "reach",
    label: "01 · REACH",
    name: isVietnamese ? "Tiếp cận" : "Reach",
    category: isVietnamese ? "Giai đoạn phân phối" : "Delivery stage",
    relation: isVietnamese ? "Audience → Reach" : "Audience → Reach",
    value: t.reach,
    unit: isVietnamese ? "người" : "people",
    efficiency: `Unique reach ${compact(t.reach)}`,
    movement: comparisonMovement(t.reach, p?.reach, compareMode, language, "reach"),
    tone: t.reach > 0 ? "success" : "warning",
    availability: t.reach > 0 ? "available" : "insufficient",
  });
  const impressions = stage({
    key: "impressions",
    label: "02 · IMPRESSIONS",
    name: isVietnamese ? "Lượt hiển thị" : "Impression",
    category: isVietnamese ? "Giai đoạn phân phối" : "Delivery stage",
    relation: isVietnamese ? "Reach → Lượt hiển thị" : "Reach → Impressions",
    value: t.impressions,
    unit: isVietnamese ? "lượt hiển thị" : "impressions",
    efficiency: `CPM ${currency(t.cpm, currencyCode)} · Frequency ${t.frequency.toFixed(1)}`,
    movement: comparisonMovement(t.cpm, p?.cpm, compareMode, language, "CPM", true, true),
    tone: t.impressions > 0 ? "success" : "warning",
    availability: t.impressions > 0 ? "available" : "insufficient",
  });
  const saturation = stage({
    key: "saturation",
    label: "03 · SATURATION",
    name: isVietnamese ? "Bão hòa" : "Saturation",
    category: isVietnamese ? "Ngưỡng awareness" : "Awareness guardrail",
    relation: isVietnamese ? "Reach → Lượt hiển thị → Frequency" : "Reach → Impressions → Frequency",
    value: t.frequency,
    unit: "frequency",
    efficiency: `CPM ${currency(t.cpm, currencyCode)} · CTR ${t.ctr.toFixed(2)}%`,
    movement: comparisonMovement(t.frequency, p?.frequency, compareMode, language, "frequency", true, false),
    tone: t.frequency >= 4 ? "warning" : "primary",
    availability: t.impressions > 0 && t.reach > 0 ? "available" : "insufficient",
  });
  return [reach, impressions, saturation];
}

function outcomeStage(args: Omit<PerformanceStage, "availability" | "statusLabel" | "tone"> & {
  metric: OutcomeMetricKey;
  report: DashboardReport;
  healthy: boolean;
  signalTone?: PerformanceStage["tone"];
}): PerformanceStage {
  const tracked = metricTracked(args.report.totals, args.metric);
  const availability: StageAvailability = !tracked ? "not_tracked" : args.value && args.value > 0 ? "available" : "insufficient";
  return stage({
    ...args,
    value: availability === "not_tracked" ? null : args.value,
    efficiency: availability === "not_tracked" ? "Not tracked" : args.efficiency,
    movement: availability === "not_tracked" ? "Tracking required" : args.movement,
    tone: availability === "available" ? (args.healthy ? args.signalTone || "success" : "warning") : "warning",
    availability,
  });
}

function stage(args: Omit<PerformanceStage, "statusLabel">): PerformanceStage {
  return {
    ...args,
    statusLabel: args.availability === "not_tracked"
      ? "Not tracked"
      : args.availability === "insufficient"
        ? "Insufficient"
        : args.tone === "success"
          ? "Healthy"
          : args.tone === "warning"
            ? "Watch"
            : "Signal",
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
  if (previous === 0) return `${current > 0 ? "New" : "No change"} · ${comparisonDescriptor({ compareMode: mode, language })}`;
  const changePct = ((current - previous) / Math.abs(previous)) * 100;
  const improved = lowerIsBetter ? changePct < 0 : changePct > 0;
  const arrow = changePct > 0 ? "↑" : changePct < 0 ? "↓" : "→";
  const amount = percentagePoint ? `${Math.abs(current - previous).toFixed(1)} pp` : `${Math.abs(changePct).toFixed(1)}%`;
  const metricLabel = currencyMetric || label ? ` ${label}` : "";
  return `${arrow} ${amount}${metricLabel} · ${improved ? "improved" : changePct === 0 ? "stable" : "watch"} ${comparisonDescriptor({ compareMode: mode, language })}`;
}

function currency(value: number, currencyCode: string) {
  if (!Number.isFinite(value) || value <= 0) return "Unavailable";
  return new Intl.NumberFormat("en", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(value);
}

function compact(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
