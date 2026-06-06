import type { InterfaceLanguage, KpiPack, NormalizedRow } from "@/lib/types";

export type DecisionConfidenceStatus = "scale_candidate" | "kill_candidate" | "monitor" | "insufficient_data";

export type DecisionTargets = {
  targetCpa?: number;
  targetRoas?: number;
};

export type DecisionConfidence = {
  status: DecisionConfidenceStatus;
  actionable: boolean;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  reasons: { en: string[]; vi: string[] };
};

const labels: Record<DecisionConfidenceStatus, { en: string; vi: string }> = {
  scale_candidate: { en: "Scale candidate", vi: "Có thể scale" },
  kill_candidate: { en: "Kill candidate", vi: "Có thể tắt" },
  monitor: { en: "Monitor", vi: "Theo dõi" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

function primaryResult(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "lead_gen") return row.leads;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  return row.reach;
}

function primaryCost(row: NormalizedRow, pack: KpiPack) {
  const result = primaryResult(row, pack);
  return result > 0 ? row.spend / result : 0;
}

function resultThreshold(pack: KpiPack) {
  if (pack === "sales_roas") return 5;
  if (pack === "traffic" || pack === "awareness") return 30;
  return 5;
}

function lowDelivery(row: NormalizedRow) {
  return row.impressions > 0 && row.impressions < 1000;
}

export function assessDecisionConfidence(row: NormalizedRow, pack: KpiPack, language: InterfaceLanguage = "en", targets: DecisionTargets = {}): DecisionConfidence {
  const result = primaryResult(row, pack);
  const minResults = resultThreshold(pack);

  if (row.spend > 0 && lowDelivery(row)) {
    return {
      status: "insufficient_data",
      actionable: false,
      variant: "outline",
      label: labels.insufficient_data,
      reasons: {
        en: ["Need at least 1,000 impressions before kill/scale decisions."],
        vi: ["Cần tối thiểu 1.000 impressions trước khi quyết định tắt hoặc scale."],
      },
    };
  }

  if (row.spend > 0 && result === 0 && row.spend < 100) {
    return {
      status: "insufficient_data",
      actionable: false,
      variant: "outline",
      label: labels.insufficient_data,
      reasons: {
        en: ["Spend is still below the minimum evidence threshold for a zero-result decision."],
        vi: ["Chi tiêu vẫn dưới ngưỡng bằng chứng tối thiểu cho quyết định chưa có kết quả."],
      },
    };
  }

  if (result === 0 && row.spend >= 100 && row.impressions >= 1000) {
    return {
      status: "kill_candidate",
      actionable: true,
      variant: "destructive",
      label: labels.kill_candidate,
      reasons: {
        en: ["Zero primary results after enough spend and delivery."],
        vi: ["Chưa có kết quả chính dù đã có đủ chi tiêu và delivery."],
      },
    };
  }

  const cost = primaryCost(row, pack);

  if (pack !== "sales_roas" && targets.targetCpa && result >= minResults && cost > targets.targetCpa * 3) {
    const multiple = cost / targets.targetCpa;
    return {
      status: "kill_candidate",
      actionable: true,
      variant: "destructive",
      label: labels.kill_candidate,
      reasons: {
        en: [`CPA is ${multiple.toFixed(2)}x above target CPA after ${result.toLocaleString("en-US")} primary results.`],
        vi: [`CPA cao hơn target ${multiple.toFixed(2)}x sau ${result.toLocaleString("vi-VN")} kết quả chính.`],
      },
    };
  }

  if (result >= minResults && row.ctr >= 1 && (row.frequency === 0 || row.frequency < (pack === "awareness" ? 4 : 3))) {
    if (pack === "sales_roas" && targets.targetRoas && row.roas < targets.targetRoas) {
      return {
        status: "monitor",
        actionable: false,
        variant: "outline",
        label: labels.monitor,
        reasons: {
          en: [`ROAS is below target: ${row.roas.toFixed(2)} vs ${targets.targetRoas.toFixed(2)}.`],
          vi: [`ROAS thấp hơn target: ${row.roas.toFixed(2)} so với ${targets.targetRoas.toFixed(2)}.`],
        },
      };
    }
    if (pack !== "sales_roas" && targets.targetCpa && cost > targets.targetCpa) {
      return {
        status: "monitor",
        actionable: false,
        variant: "outline",
        label: labels.monitor,
        reasons: {
          en: [`CPA is above target: ${cost.toFixed(2)} vs ${targets.targetCpa.toFixed(2)}.`],
          vi: [`CPA cao hơn target: ${cost.toFixed(2)} so với ${targets.targetCpa.toFixed(2)}.`],
        },
      };
    }
    const targetReasonEn = pack === "sales_roas" && targets.targetRoas ? ` ROAS target met at ${row.roas.toFixed(2)}.` : pack !== "sales_roas" && targets.targetCpa ? ` CPA target met at ${cost.toFixed(2)}.` : "";
    const targetReasonVi = pack === "sales_roas" && targets.targetRoas ? ` Đạt target ROAS ở ${row.roas.toFixed(2)}.` : pack !== "sales_roas" && targets.targetCpa ? ` Đạt target CPA ở ${cost.toFixed(2)}.` : "";
    return {
      status: "scale_candidate",
      actionable: true,
      variant: "secondary",
      label: labels.scale_candidate,
      reasons: {
        en: [`Has ${result.toLocaleString("en-US")} primary results with stable CTR and frequency${cost > 0 ? ` at ${cost.toFixed(2)} cost/result` : ""}.${targetReasonEn}`],
        vi: [`Có ${result.toLocaleString("vi-VN")} kết quả chính với CTR và frequency ổn định${cost > 0 ? ` ở ${cost.toFixed(2)} cost/result` : ""}.${targetReasonVi}`],
      },
    };
  }

  return {
    status: "monitor",
    actionable: false,
    variant: "outline",
    label: labels.monitor,
    reasons: {
      en: ["Signal is directional, but not strong enough for a hard kill/scale decision."],
      vi: ["Tín hiệu chỉ mang tính định hướng, chưa đủ mạnh cho quyết định tắt hoặc scale."],
    },
  };
}
