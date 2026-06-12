import type { KpiPack, NormalizedRow } from "@/lib/types";

export type SpendPacingStatus = "on_pace" | "underpacing" | "severely_underpacing" | "no_budget_data";

export type SpendPacingCampaign = {
  id: string;
  name: string;
  spend: number;
  expectedSpend: number;
  pacePercent: number;
  dailyBudget: number;
  status: Exclude<SpendPacingStatus, "no_budget_data">;
};

export type SpendPacingAssessment = {
  status: SpendPacingStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  campaigns: SpendPacingCampaign[];
  totalSpend: number;
  totalExpected: number;
  overallPacePercent: number;
};

function campaignStatus(pacePercent: number): SpendPacingCampaign["status"] {
  if (pacePercent >= 85) return "on_pace";
  if (pacePercent >= 60) return "underpacing";
  return "severely_underpacing";
}

export function assessSpendPacing(
  campaignRows: NormalizedRow[],
  reportDays: number,
): SpendPacingAssessment {
  const withBudget = campaignRows.filter((row) => (row.dailyBudget ?? 0) > 0);

  if (!withBudget.length) {
    return {
      status: "no_budget_data",
      variant: "outline",
      label: { en: "No budget data", vi: "Không có dữ liệu ngân sách" },
      summary: {
        en: "No campaign daily budget data available to assess spend pacing.",
        vi: "Không có dữ liệu ngân sách ngày để đánh giá tốc độ chi tiêu.",
      },
      campaigns: [],
      totalSpend: 0,
      totalExpected: 0,
      overallPacePercent: 0,
    };
  }

  const campaigns: SpendPacingCampaign[] = withBudget.map((row) => {
    const dailyBudget = row.dailyBudget ?? 0;
    const expectedSpend = dailyBudget * reportDays;
    const pacePercent = expectedSpend > 0 ? (row.spend / expectedSpend) * 100 : 100;
    return {
      id: row.id,
      name: row.name,
      spend: row.spend,
      expectedSpend,
      pacePercent,
      dailyBudget,
      status: campaignStatus(pacePercent),
    };
  });

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalExpected = campaigns.reduce((sum, c) => sum + c.expectedSpend, 0);
  const overallPacePercent = totalExpected > 0 ? (totalSpend / totalExpected) * 100 : 100;

  const worst = campaigns.some((c) => c.status === "severely_underpacing")
    ? "severely_underpacing"
    : campaigns.some((c) => c.status === "underpacing")
      ? "underpacing"
      : "on_pace";

  const status: SpendPacingStatus = worst;
  const variant = status === "on_pace" ? "secondary" : status === "underpacing" ? "outline" : "destructive";

  const label = {
    on_pace: { en: "Pacing on track", vi: "Chi tiêu đúng tiến độ" },
    underpacing: { en: "Underpacing", vi: "Chi tiêu chậm" },
    severely_underpacing: { en: "Severely underpacing", vi: "Chi tiêu rất chậm" },
    no_budget_data: { en: "No budget data", vi: "Không có dữ liệu ngân sách" },
  }[status];

  const summary = {
    on_pace: {
      en: `Overall pacing at ${overallPacePercent.toFixed(0)}% of expected spend — campaigns are delivering as budgeted.`,
      vi: `Tổng chi tiêu đạt ${overallPacePercent.toFixed(0)}% kế hoạch — các campaign đang phân phối đúng ngân sách.`,
    },
    underpacing: {
      en: `Overall pacing at ${overallPacePercent.toFixed(0)}% of expected spend. ${campaigns.filter((c) => c.status !== "on_pace").length} campaign(s) are underpacing — check bid/cap settings or audience size.`,
      vi: `Tổng chi tiêu đạt ${overallPacePercent.toFixed(0)}% kế hoạch. ${campaigns.filter((c) => c.status !== "on_pace").length} campaign đang chậm — kiểm tra cài đặt bid/cap hoặc quy mô đối tượng.`,
    },
    severely_underpacing: {
      en: `Severe underpacing at ${overallPacePercent.toFixed(0)}% of expected spend. Campaigns may be blocked by a cost cap, low bid, or audience exhaustion.`,
      vi: `Chi tiêu rất chậm, chỉ đạt ${overallPacePercent.toFixed(0)}% kế hoạch. Campaign có thể bị chặn bởi cost cap quá thấp, bid thấp, hoặc audience đã bão hòa.`,
    },
    no_budget_data: {
      en: "No campaign daily budget data available to assess spend pacing.",
      vi: "Không có dữ liệu ngân sách ngày để đánh giá tốc độ chi tiêu.",
    },
  }[status];

  return { status, variant, label, summary, campaigns, totalSpend, totalExpected, overallPacePercent };
}
