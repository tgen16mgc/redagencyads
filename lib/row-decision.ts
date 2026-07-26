import type { InterfaceLanguage, KpiPack, NormalizedRow } from "@/lib/types";
import { assessDecisionConfidence } from "@/lib/decision-confidence";
import { classifyCreativeFatigue } from "@/lib/creative-fatigue";
import { signalVolumeValue } from "@/lib/primary-result";

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

export function rowDecision(row: NormalizedRow, pack: KpiPack, language: InterfaceLanguage = "en") {
  const confidence = assessDecisionConfidence(row, pack, language);
  if (confidence.status === "insufficient_data") {
    return { label: confidence.label[language], reason: confidence.reasons[language][0], intent: "neutral" as const };
  }

  const copy = decisionLabels[language];
  const result = signalVolumeValue(row, pack);
  const freqLimit = pack === "awareness" ? 4 : 3;
  const fatigue = classifyCreativeFatigue(row);
  if (fatigue.status === "fatigued") {
    return { label: copy.fixCreative, reason: fatigue.reason[language], intent: "danger" as const };
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
