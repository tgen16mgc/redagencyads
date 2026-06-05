import type { DashboardReport, KpiPack, NormalizedRow } from "@/lib/types";

export type MeasurementQualityStatus = "good" | "limited" | "unverified" | "not_applicable";

export type MeasurementQuality = {
  status: MeasurementQualityStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  reasons: { en: string[]; vi: string[] };
};

const labels: Record<MeasurementQualityStatus, { en: string; vi: string }> = {
  good: { en: "Good", vi: "Tốt" },
  limited: { en: "Limited", vi: "Giới hạn" },
  unverified: { en: "Unverified", vi: "Chưa xác minh" },
  not_applicable: { en: "Not applicable", vi: "Không áp dụng" },
};

function primaryResult(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "lead_gen") return row.leads;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  return row.impressions;
}

export function assessMeasurementQuality(report: DashboardReport): MeasurementQuality {
  const { totals, selectedPack } = report;
  if (totals.spend <= 0) {
    return {
      status: "not_applicable",
      variant: "outline",
      label: labels.not_applicable,
      reasons: {
        en: ["No spend in the selected scope, so measurement quality is not applicable yet."],
        vi: ["Chưa có chi tiêu trong phạm vi đã chọn nên chưa cần đánh giá chất lượng đo lường."],
      },
    };
  }

  const result = primaryResult(totals, selectedPack);
  if (result <= 0) {
    return {
      status: "unverified",
      variant: "destructive",
      label: labels.unverified,
      reasons: {
        en: ["Tracking data is not available in the current dataset for the selected KPI pack."],
        vi: ["Dữ liệu tracking chưa có trong dataset hiện tại cho bộ KPI đang chọn."],
      },
    };
  }

  if (selectedPack === "sales_roas" && totals.roas <= 0) {
    return {
      status: "limited",
      variant: "outline",
      label: labels.limited,
      reasons: {
        en: ["Primary result signal is present, but Value or ROAS data is missing in the current dataset."],
        vi: ["Đã có tín hiệu kết quả chính, nhưng đang thiếu dữ liệu giá trị hoặc ROAS trong dataset hiện tại."],
      },
    };
  }

  return {
    status: "good",
    variant: "secondary",
    label: labels.good,
    reasons: {
      en: ["Primary result signal is present for the selected KPI pack."],
      vi: ["Đã có tín hiệu kết quả chính cho bộ KPI đang chọn."],
    },
  };
}
