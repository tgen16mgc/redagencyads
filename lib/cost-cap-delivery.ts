import type { NormalizedRow } from "@/lib/types";

export type CostCapDeliveryStatus = "healthy" | "warning" | "critical" | "no_cap_data";

export type CostCapUnderdelivering = {
  id: string;
  name: string;
  spendRate: number;
  spend: number;
  dailyBudget: number;
  reportDays: number;
};

export type CostCapDeliveryAssessment = {
  status: CostCapDeliveryStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  underdelivering: CostCapUnderdelivering[];
};

export function assessCostCapDelivery(
  campaignRows: NormalizedRow[],
  reportDays: number,
): CostCapDeliveryAssessment {
  const withBudget = campaignRows.filter((row) => (row.dailyBudget ?? 0) > 0);

  if (!withBudget.length) {
    return {
      status: "no_cap_data",
      variant: "outline",
      label: { en: "No cap data", vi: "Không có dữ liệu cap" },
      summary: {
        en: "No campaign daily budget data available to assess cost cap delivery efficiency.",
        vi: "Không có dữ liệu ngân sách ngày để đánh giá hiệu quả phân phối cost cap.",
      },
      underdelivering: [],
    };
  }

  const underdelivering: CostCapUnderdelivering[] = [];

  for (const row of withBudget) {
    const dailyBudget = row.dailyBudget ?? 0;
    const expectedSpend = dailyBudget * reportDays;
    const spendRate = expectedSpend > 0 ? row.spend / expectedSpend : 1;
    if (spendRate < 0.8) {
      underdelivering.push({ id: row.id, name: row.name, spendRate, spend: row.spend, dailyBudget, reportDays });
    }
  }

  const hasCritical = underdelivering.some((item) => item.spendRate < 0.6);
  const status: CostCapDeliveryStatus = hasCritical ? "critical" : underdelivering.length ? "warning" : "healthy";
  const variant = status === "healthy" ? "secondary" : status === "warning" ? "outline" : "destructive";

  const label = {
    healthy: { en: "Delivery healthy", vi: "Phân phối ổn định" },
    warning: { en: "Delivery warning", vi: "Cảnh báo phân phối" },
    critical: { en: "Delivery constrained", vi: "Phân phối bị hạn chế" },
    no_cap_data: { en: "No cap data", vi: "Không có dữ liệu cap" },
  }[status];

  const summary = {
    healthy: {
      en: "All campaigns with daily budgets are spending at least 80% of their expected budget — cost/bid cap settings appear calibrated.",
      vi: "Tất cả campaign có ngân sách ngày đang chi tiêu ít nhất 80% ngân sách dự kiến — cài đặt cost/bid cap có vẻ phù hợp.",
    },
    warning: {
      en: `${underdelivering.length} campaign(s) spending 60–80% of daily budget. Cost or bid cap may be set below the market clearing price.`,
      vi: `${underdelivering.length} campaign chi tiêu 60–80% ngân sách ngày. Cost hoặc bid cap có thể thấp hơn giá thị trường.`,
    },
    critical: {
      en: `${underdelivering.length} campaign(s) spending under 60% of daily budget. Cost or bid cap is likely too restrictive — raise cap incrementally or switch to highest-volume bidding to diagnose.`,
      vi: `${underdelivering.length} campaign chi tiêu dưới 60% ngân sách ngày. Cost hoặc bid cap quá thấp — tăng dần cap hoặc chuyển sang đặt giá thầu highest-volume để chẩn đoán.`,
    },
    no_cap_data: {
      en: "No campaign daily budget data available to assess cost cap delivery efficiency.",
      vi: "Không có dữ liệu ngân sách ngày để đánh giá hiệu quả phân phối cost cap.",
    },
  }[status];

  return { status, variant, label, summary, underdelivering };
}
