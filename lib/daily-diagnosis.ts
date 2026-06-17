import type { InterfaceLanguage, KpiPack, NormalizedRow } from "@/lib/types";
import { SUFFICIENCY } from "@/lib/data-sufficiency";

export type DailyDiagnosisStatus = "causes_found" | "stable" | "insufficient_data";

export type DailyDiagnosisCauseId =
  | "creative_fatigue"
  | "audience_saturation"
  | "auction_pressure"
  | "funnel_breakdown"
  | "efficiency_decay";

export type DailyDiagnosisCause = {
  id: DailyDiagnosisCauseId;
  severity: "warning" | "danger";
  score: number;
  title: { en: string; vi: string };
  evidence: Array<{ en: string; vi: string }>;
  action: { en: string; vi: string };
};

export type DailyDiagnosis = {
  status: DailyDiagnosisStatus;
  summary: { en: string; vi: string };
  window: { recentDays: number; priorDays: number };
  causes: DailyDiagnosisCause[];
};

type ResultMetric = "leads" | "messages" | "purchases" | "linkClicks";

const MIN_DATED_ROWS = SUFFICIENCY.minDatedRows;
const MAX_WINDOW = 7;
const MAX_CAUSES = 4;

// A metric is "moved" when it crosses this; "stable" when it stays within STABLE_BAND.
const MOVE_THRESHOLD = 15;
const STABLE_BAND = 10;

function resultMetric(pack: KpiPack): ResultMetric {
  if (pack === "messages") return "messages";
  if (pack === "sales_roas") return "purchases";
  if (pack === "traffic") return "linkClicks";
  return "leads";
}

function resultLabel(metric: ResultMetric): { en: string; vi: string } {
  if (metric === "messages") return { en: "Messages", vi: "Tin nhắn" };
  if (metric === "purchases") return { en: "Purchases", vi: "Đơn hàng" };
  if (metric === "linkClicks") return { en: "Link clicks", vi: "Click link" };
  return { en: "Leads", vi: "Lead" };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

type WindowStats = {
  ctr: number;
  frequency: number;
  cpm: number;
  cpc: number;
  reach: number;
  result: number;
  spend: number;
  linkClicks: number;
  cvr: number;
};

function windowStats(rows: NormalizedRow[], metric: ResultMetric): WindowStats {
  const result = sum(rows.map((row) => Number(row[metric] || 0)));
  const linkClicks = sum(rows.map((row) => row.linkClicks || 0));
  return {
    ctr: average(rows.map((row) => row.ctr || 0)),
    frequency: average(rows.map((row) => row.frequency || 0)),
    cpm: average(rows.map((row) => row.cpm || 0)),
    cpc: average(rows.map((row) => row.cpc || 0)),
    reach: average(rows.map((row) => row.reach || 0)),
    result,
    spend: sum(rows.map((row) => row.spend || 0)),
    linkClicks,
    cvr: linkClicks > 0 ? (result / linkClicks) * 100 : 0,
  };
}

function fmtPct(value: number): string {
  return `${Math.abs(value).toFixed(0)}%`;
}

function evidence(
  label: { en: string; vi: string },
  change: number,
): { en: string; vi: string } {
  const upEn = change >= 0 ? "up" : "down";
  const upVi = change >= 0 ? "tăng" : "giảm";
  return {
    en: `${label.en} ${upEn} ${fmtPct(change)}`,
    vi: `${label.vi} ${upVi} ${fmtPct(change)}`,
  };
}

const LABELS = {
  ctr: { en: "CTR", vi: "CTR" },
  frequency: { en: "Frequency", vi: "Tần suất" },
  cpm: { en: "CPM", vi: "CPM" },
  reach: { en: "Reach", vi: "Tiếp cận" },
  cvr: { en: "Conversion rate", vi: "Tỷ lệ chuyển đổi" },
  spend: { en: "Spend", vi: "Chi tiêu" },
} as const;

function insufficient(window: { recentDays: number; priorDays: number }): DailyDiagnosis {
  return {
    status: "insufficient_data",
    summary: {
      en: "Need at least 6 days of daily data to diagnose what changed.",
      vi: "Cần tối thiểu 6 ngày dữ liệu theo ngày để chẩn đoán thay đổi.",
    },
    window,
    causes: [],
  };
}

export function diagnoseDailyChange(report: {
  dailyRows: NormalizedRow[];
  selectedPack: KpiPack;
}): DailyDiagnosis {
  const dated = report.dailyRows
    .filter((row) => Boolean(row.date))
    .slice()
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));

  if (dated.length < MIN_DATED_ROWS) {
    return insufficient({ recentDays: 0, priorDays: 0 });
  }

  const windowSize = Math.min(MAX_WINDOW, Math.floor(dated.length / 2));
  const recentRows = dated.slice(dated.length - windowSize);
  const priorRows = dated.slice(dated.length - windowSize * 2, dated.length - windowSize);
  const window = { recentDays: recentRows.length, priorDays: priorRows.length };

  if (priorRows.length < windowSize) {
    return insufficient(window);
  }

  const metric = resultMetric(report.selectedPack);
  const recent = windowStats(recentRows, metric);
  const prior = windowStats(priorRows, metric);

  const ctrChange = pctChange(recent.ctr, prior.ctr);
  const freqChange = pctChange(recent.frequency, prior.frequency);
  const cpmChange = pctChange(recent.cpm, prior.cpm);
  const reachChange = pctChange(recent.reach, prior.reach);
  const cvrChange = pctChange(recent.cvr, prior.cvr);
  const resultChange = pctChange(recent.result, prior.result);
  const spendChange = pctChange(recent.spend, prior.spend);

  const causes: DailyDiagnosisCause[] = [];

  // 1. Creative fatigue: CTR down + frequency up.
  if (ctrChange !== null && freqChange !== null && ctrChange <= -MOVE_THRESHOLD && freqChange >= STABLE_BAND) {
    const severe = ctrChange <= -25 && freqChange >= 20;
    causes.push({
      id: "creative_fatigue",
      severity: severe ? "danger" : "warning",
      score: Math.abs(ctrChange) + Math.abs(freqChange),
      title: { en: "Creative fatigue", vi: "Mỏi creative" },
      evidence: [evidence(LABELS.ctr, ctrChange), evidence(LABELS.frequency, freqChange)],
      action: {
        en: "The same people are seeing your ads too often. Refresh the creative, don't widen the audience.",
        vi: "Cùng một tệp người đang thấy quảng cáo quá nhiều lần. Thay creative, đừng mở rộng tệp.",
      },
    });
  }

  // 2. Audience saturation: reach down + CPM up.
  if (reachChange !== null && cpmChange !== null && reachChange <= -STABLE_BAND && cpmChange >= MOVE_THRESHOLD) {
    causes.push({
      id: "audience_saturation",
      severity: reachChange <= -25 ? "danger" : "warning",
      score: Math.abs(reachChange) + Math.abs(cpmChange),
      title: { en: "Audience saturation", vi: "Tệp đối tượng bão hòa" },
      evidence: [evidence(LABELS.reach, reachChange), evidence(LABELS.cpm, cpmChange)],
      action: {
        en: "You are paying more to reach fewer new people. Expand or refresh targeting.",
        vi: "Bạn đang trả nhiều hơn để tiếp cận ít người mới hơn. Mở rộng hoặc làm mới targeting.",
      },
    });
  }

  // 3. Auction pressure: CPM up while CTR holds — not your fault.
  if (
    cpmChange !== null &&
    cpmChange >= MOVE_THRESHOLD &&
    ctrChange !== null &&
    Math.abs(ctrChange) <= STABLE_BAND &&
    (reachChange === null || reachChange > -STABLE_BAND)
  ) {
    causes.push({
      id: "auction_pressure",
      severity: "warning",
      score: Math.abs(cpmChange),
      title: { en: "Auction got more expensive", vi: "Đấu giá đắt lên" },
      evidence: [evidence(LABELS.cpm, cpmChange), evidence(LABELS.ctr, ctrChange)],
      action: {
        en: "CPM rose but engagement held — likely seasonality or more competition, not a creative problem.",
        vi: "CPM tăng nhưng tương tác giữ vững — có thể do mùa vụ hoặc cạnh tranh, không phải lỗi creative.",
      },
    });
  }

  // 4. Funnel / landing-page breakdown: conversion rate down while CTR holds. Not meaningful for traffic pack.
  if (
    metric !== "linkClicks" &&
    cvrChange !== null &&
    cvrChange <= -MOVE_THRESHOLD &&
    ctrChange !== null &&
    ctrChange >= -STABLE_BAND
  ) {
    causes.push({
      id: "funnel_breakdown",
      severity: cvrChange <= -25 ? "danger" : "warning",
      score: Math.abs(cvrChange),
      title: { en: "Funnel / landing-page drop", vi: "Rớt ở phễu / landing page" },
      evidence: [evidence(LABELS.cvr, cvrChange), evidence(LABELS.ctr, ctrChange)],
      action: {
        en: "People still click but convert less. Check the landing page or offer, not the ads.",
        vi: "Người dùng vẫn click nhưng chuyển đổi ít hơn. Kiểm tra landing page hoặc offer, không phải quảng cáo.",
      },
    });
  }

  // 5. Efficiency decay: result down while spend holds.
  if (
    resultChange !== null &&
    resultChange <= -MOVE_THRESHOLD &&
    spendChange !== null &&
    Math.abs(spendChange) <= MOVE_THRESHOLD
  ) {
    causes.push({
      id: "efficiency_decay",
      severity: resultChange <= -30 ? "danger" : "warning",
      score: Math.abs(resultChange),
      title: { en: "Efficiency decay", vi: "Hiệu quả giảm" },
      evidence: [evidence(resultLabel(metric), resultChange), evidence(LABELS.spend, spendChange)],
      action: {
        en: "Same spend is buying fewer results. Review winners vs losers before the next budget step.",
        vi: "Cùng mức chi tiêu nhưng ra ít kết quả hơn. Rà soát nhóm thắng/thua trước khi đổi ngân sách.",
      },
    });
  }

  const ranked = causes.sort((a, b) => b.score - a.score).slice(0, MAX_CAUSES);

  if (!ranked.length) {
    return {
      status: "stable",
      summary: {
        en: `No major shifts in the last ${window.recentDays} days versus the prior ${window.priorDays}.`,
        vi: `Không có biến động lớn trong ${window.recentDays} ngày gần nhất so với ${window.priorDays} ngày trước đó.`,
      },
      window,
      causes: [],
    };
  }

  return {
    status: "causes_found",
    summary: {
      en: `Comparing the last ${window.recentDays} days with the prior ${window.priorDays}, these likely explain the change.`,
      vi: `So sánh ${window.recentDays} ngày gần nhất với ${window.priorDays} ngày trước đó, đây là các nguyên nhân có khả năng nhất.`,
    },
    window,
    causes: ranked,
  };
}

export function diagnosisText(diagnosis: DailyDiagnosis, language: InterfaceLanguage) {
  return {
    summary: diagnosis.summary[language],
    causes: diagnosis.causes.map((cause) => ({
      id: cause.id,
      severity: cause.severity,
      title: cause.title[language],
      evidence: cause.evidence.map((line) => line[language]),
      action: cause.action[language],
    })),
  };
}
