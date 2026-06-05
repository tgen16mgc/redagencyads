import type { NormalizedRow } from "@/lib/types";

export type CreativeFatigueStatus = "fresh" | "watch" | "fatigued";

export type CreativeFatigueSignal = {
  status: CreativeFatigueStatus;
  severity: "secondary" | "warning" | "danger";
  label: { en: string; vi: string };
  reason: { en: string; vi: string };
};

const labels: Record<CreativeFatigueStatus, { en: string; vi: string }> = {
  fresh: { en: "Fresh / Keep testing", vi: "Còn mới / Tiếp tục test" },
  watch: { en: "Watch", vi: "Theo dõi" },
  fatigued: { en: "Fatigued / Rotate creative", vi: "Mỏi creative / Nên thay mẫu" },
};

export function classifyCreativeFatigue(row: NormalizedRow): CreativeFatigueSignal {
  if (row.impressions < 1000 || row.spend < 10) {
    return {
      status: "fresh",
      severity: "secondary",
      label: labels.fresh,
      reason: {
        en: "Fresh because there is insufficient delivery to judge fatigue.",
        vi: "Tạm xem là còn mới vì chưa đủ phân phối để đánh giá độ mỏi.",
      },
    };
  }

  if (row.frequency >= 5 && row.ctr < 0.8) {
    return {
      status: "fatigued",
      severity: "danger",
      label: labels.fatigued,
      reason: {
        en: `High frequency ${row.frequency.toFixed(2)} with weak CTR ${row.ctr.toFixed(2)}%.`,
        vi: `Tần suất cao ${row.frequency.toFixed(2)} với CTR yếu ${row.ctr.toFixed(2)}%.`,
      },
    };
  }

  if (row.frequency >= 3 || row.ctr < 1) {
    return {
      status: "watch",
      severity: "warning",
      label: labels.watch,
      reason: {
        en: `Monitor creative rotation: frequency ${row.frequency.toFixed(2)}, CTR ${row.ctr.toFixed(2)}%.`,
        vi: `Theo dõi vòng đời creative: tần suất ${row.frequency.toFixed(2)}, CTR ${row.ctr.toFixed(2)}%.`,
      },
    };
  }

  return {
    status: "fresh",
    severity: "secondary",
    label: labels.fresh,
    reason: {
      en: `Healthy attention signal: frequency ${row.frequency.toFixed(2)}, CTR ${row.ctr.toFixed(2)}%.`,
      vi: `Tín hiệu chú ý ổn: tần suất ${row.frequency.toFixed(2)}, CTR ${row.ctr.toFixed(2)}%.`,
    },
  };
}
