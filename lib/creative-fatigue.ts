import type { NormalizedRow } from "@/lib/types";
import { SUFFICIENCY, hasRowDelivery } from "@/lib/data-sufficiency";

export type CreativeFatigueStatus = "fresh" | "watch" | "fatigued";

export type CreativeFatigueSignal = {
  status: CreativeFatigueStatus;
  severity: "secondary" | "warning" | "danger";
  label: { en: string; vi: string };
  reason: { en: string; vi: string };
};

export type CreativeFatigueBaseline = {
  typicalFrequency: number;
  typicalCtr: number;
  sampleSize: number;
};

const MIN_BASELINE_SAMPLE = SUFFICIENCY.minBaselineSample;

const FATIGUE_FREQ_RATIO = 1.3;
const FATIGUE_CTR_RATIO = 0.75;
const WATCH_FREQ_RATIO = 1.15;
const WATCH_CTR_RATIO = 0.9;

const labels: Record<CreativeFatigueStatus, { en: string; vi: string }> = {
  fresh: { en: "Fresh / Keep testing", vi: "Còn mới / Tiếp tục test" },
  watch: { en: "Watch", vi: "Theo dõi" },
  fatigued: { en: "Fatigued / Rotate creative", vi: "Mỏi creative / Nên thay mẫu" },
};

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeCreativeFatigueBaseline(rows: NormalizedRow[]): CreativeFatigueBaseline | null {
  const delivered = rows.filter(hasRowDelivery);
  if (delivered.length === 0) return null;

  return {
    typicalFrequency: median(delivered.map((r) => r.frequency)),
    typicalCtr: median(delivered.map((r) => r.ctr)),
    sampleSize: delivered.length,
  };
}

function insufficientDelivery(): CreativeFatigueSignal {
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

function classifyAgainstBaseline(row: NormalizedRow, baseline: CreativeFatigueBaseline): CreativeFatigueSignal {
  const freqRatio = baseline.typicalFrequency > 0 ? row.frequency / baseline.typicalFrequency : 1;
  const ctrRatio = baseline.typicalCtr > 0 ? row.ctr / baseline.typicalCtr : 1;
  const freqPct = Math.round((freqRatio - 1) * 100);
  const ctrPct = Math.round((1 - ctrRatio) * 100);

  if (freqRatio >= FATIGUE_FREQ_RATIO && ctrRatio <= FATIGUE_CTR_RATIO) {
    return {
      status: "fatigued",
      severity: "danger",
      label: labels.fatigued,
      reason: {
        en: `Frequency ${freqPct}% above and CTR ${ctrPct}% below the account norm — rotate the creative.`,
        vi: `Tần suất cao hơn ${freqPct}% và CTR thấp hơn ${ctrPct}% so với mức bình thường của tài khoản — nên thay mẫu.`,
      },
    };
  }

  if (freqRatio >= WATCH_FREQ_RATIO || ctrRatio <= WATCH_CTR_RATIO) {
    return {
      status: "watch",
      severity: "warning",
      label: labels.watch,
      reason: {
        en: `Drifting from the account norm: frequency ${freqPct >= 0 ? "+" : ""}${freqPct}%, CTR ${ctrPct >= 0 ? "-" : "+"}${Math.abs(ctrPct)}%.`,
        vi: `Đang lệch khỏi mức bình thường: tần suất ${freqPct >= 0 ? "+" : ""}${freqPct}%, CTR ${ctrPct >= 0 ? "-" : "+"}${Math.abs(ctrPct)}%.`,
      },
    };
  }

  return {
    status: "fresh",
    severity: "secondary",
    label: labels.fresh,
    reason: {
      en: `In line with the account norm: frequency ${row.frequency.toFixed(2)}, CTR ${row.ctr.toFixed(2)}%.`,
      vi: `Phù hợp với mức bình thường của tài khoản: tần suất ${row.frequency.toFixed(2)}, CTR ${row.ctr.toFixed(2)}%.`,
    },
  };
}

function classifyAgainstFixedThresholds(row: NormalizedRow): CreativeFatigueSignal {
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

export function classifyCreativeFatigue(
  row: NormalizedRow,
  baseline?: CreativeFatigueBaseline | null,
): CreativeFatigueSignal {
  if (!hasRowDelivery(row)) {
    return insufficientDelivery();
  }

  if (baseline && baseline.sampleSize >= MIN_BASELINE_SAMPLE) {
    return classifyAgainstBaseline(row, baseline);
  }

  return classifyAgainstFixedThresholds(row);
}
