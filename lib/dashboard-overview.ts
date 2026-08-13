import type { TriageItem } from "@/lib/health-score";
import type { DashboardReport, InterfaceLanguage, NormalizedRow } from "@/lib/types";

export type OverviewPerformanceTarget = "overview" | "creatives" | "evidence";

export type OverviewPerformanceIntent = {
  target: OverviewPerformanceTarget;
  key: number;
};

export type OverviewReportMetric = {
  key: keyof NormalizedRow;
  label: string;
  format: "currency" | "number" | "percent" | "ratio";
};

export function advanceOverviewPerformanceIntent(
  current: OverviewPerformanceIntent,
  target: OverviewPerformanceTarget = "overview",
): OverviewPerformanceIntent {
  return { target, key: current.key + 1 };
}

export function overviewAttentionTarget(item: Pick<TriageItem, "id" | "title">): OverviewPerformanceTarget {
  const searchable = `${item.id} ${item.title.en}`.toLowerCase();
  return searchable.includes("creative") || searchable.includes("m25") ? "creatives" : "evidence";
}

export function overviewReportMetrics(report: Pick<DashboardReport, "selectedPack">, language: InterfaceLanguage): OverviewReportMetric[] {
  const isVietnamese = language === "vi";
  const spend: OverviewReportMetric = { key: "spend", label: isVietnamese ? "Chi tiêu" : "Spend", format: "currency" };

  if (report.selectedPack === "sales_roas") {
    return [
      spend,
      { key: "purchases", label: isVietnamese ? "Mua hàng" : "Purchases", format: "number" },
      { key: "cpaPurchase", label: "CPA", format: "currency" },
      { key: "roas", label: "ROAS", format: "ratio" },
    ];
  }
  if (report.selectedPack === "messages") {
    return [
      spend,
      { key: "messages", label: isVietnamese ? "Tin nhắn" : "Messages", format: "number" },
      { key: "costPerMessage", label: isVietnamese ? "Chi phí / tin nhắn" : "Cost / message", format: "currency" },
      { key: "replyRate", label: isVietnamese ? "Tỷ lệ phản hồi" : "Reply rate", format: "percent" },
    ];
  }
  if (report.selectedPack === "lead_gen") {
    return [
      spend,
      { key: "leads", label: "Leads", format: "number" },
      { key: "cpl", label: "CPL", format: "currency" },
      { key: "ctr", label: "CTR", format: "percent" },
    ];
  }
  if (report.selectedPack === "traffic") {
    return [
      spend,
      { key: "linkClicks", label: isVietnamese ? "Click link" : "Link clicks", format: "number" },
      { key: "cpc", label: "CPC", format: "currency" },
      { key: "ctr", label: "CTR", format: "percent" },
    ];
  }
  return [
    spend,
    { key: "reach", label: isVietnamese ? "Tiếp cận" : "Reach", format: "number" },
    { key: "cpm", label: "CPM", format: "currency" },
    { key: "frequency", label: isVietnamese ? "Tần suất" : "Frequency", format: "ratio" },
  ];
}
