import type { InterfaceLanguage, KpiPack, NormalizedRow } from "@/lib/types";

export type DecisionConfidenceStatus = "scale_candidate" | "kill_candidate" | "monitor" | "insufficient_data";

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

export function assessDecisionConfidence(row: NormalizedRow, pack: KpiPack, language: InterfaceLanguage = "en"): DecisionConfidence {
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

  if (result >= minResults && row.ctr >= 1 && (row.frequency === 0 || row.frequency < (pack === "awareness" ? 4 : 3))) {
    const cost = primaryCost(row, pack);
    return {
      status: "scale_candidate",
      actionable: true,
      variant: "secondary",
      label: labels.scale_candidate,
      reasons: {
        en: [`Has ${result.toLocaleString("en-US")} primary results with stable CTR and frequency${cost > 0 ? ` at ${cost.toFixed(2)} cost/result` : ""}.`],
        vi: [`Có ${result.toLocaleString("vi-VN")} kết quả chính với CTR và frequency ổn định${cost > 0 ? ` ở ${cost.toFixed(2)} cost/result` : ""}.`],
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
