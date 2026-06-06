import type { InterfaceLanguage, KpiPack, NormalizedRow } from "@/lib/types";
import { assessDecisionConfidence } from "@/lib/decision-confidence";

const decisionLabels = {
  en: {
    fixCreative: "Fix creative",
    healthy: "Healthy",
    review: "Review",
    watch: "Watch",
  },
  vi: {
    fixCreative: "Sửa creative",
    healthy: "Ổn",
    review: "Rà soát",
    watch: "Theo dõi",
  },
} satisfies Record<InterfaceLanguage, Record<string, string>>;

export function primaryResult(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "lead_gen") return row.leads;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  return row.reach;
}

export function rowDecision(row: NormalizedRow, pack: KpiPack, language: InterfaceLanguage = "en") {
  const confidence = assessDecisionConfidence(row, pack, language);
  if (confidence.status === "insufficient_data") {
    return { label: confidence.label[language], reason: confidence.reasons[language][0], intent: "neutral" as const };
  }

  const copy = decisionLabels[language];
  const result = primaryResult(row, pack);
  const freqLimit = pack === "awareness" ? 4 : 3;
  if (row.frequency >= freqLimit && row.ctr < 1) {
    return { label: copy.fixCreative, reason: `Frequency >= ${freqLimit} and CTR below 1%.`, intent: "danger" as const };
  }
  if (row.ctr < 0.5 && row.impressions > 1000) {
    return { label: copy.fixCreative, reason: "CTR below Meta fail threshold.", intent: "warning" as const };
  }
  if (result > 0 && row.ctr >= 1 && row.frequency < freqLimit) {
    return { label: copy.healthy, reason: "Has result signal with CTR and frequency in guardrail.", intent: "good" as const };
  }
  if (row.spend > 0 && result === 0) {
    return { label: copy.review, reason: "Spend exists but primary result is zero.", intent: "warning" as const };
  }
  return { label: copy.watch, reason: "No hard scale or kill signal.", intent: "neutral" as const };
}
