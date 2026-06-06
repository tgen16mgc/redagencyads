import type { DashboardReport, KpiPack, NormalizedRow } from "@/lib/types";
import { assessDecisionConfidence } from "@/lib/decision-confidence";

export type BudgetMoveEngineStatus = "moves_recommended" | "hold" | "insufficient_data";

export type BudgetMoveRecommendation = {
  id: string;
  type: "transfer";
  sourceRowId: string;
  sourceRowName: string;
  targetRowId: string;
  targetRowName: string;
  suggestedMovePercent: number;
  maxIncreasePercent: 20;
  maxReductionPercent: 20;
  confidence: "low" | "medium";
  summary: { en: string; vi: string };
  targetReasons: BudgetMoveRowReason[];
  sourceReasons: BudgetMoveRowReason[];
};

export type BudgetMoveRowReason = {
  rowId: string;
  rowName: string;
  level: NormalizedRow["level"];
  reasons: string[];
  metrics: {
    spend: number;
    result: number;
    costPerResult: number;
    ctr: number;
    frequency: number;
    roas: number;
  };
};

export type BudgetMoveEngineResult = {
  status: BudgetMoveEngineStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  recommendations: BudgetMoveRecommendation[];
  holdReasons: { en: string[]; vi: string[] };
};

const MAX_MOVE_PERCENT = 20 as const;

const labels: Record<BudgetMoveEngineStatus, { en: string; vi: string }> = {
  moves_recommended: { en: "Budget moves", vi: "Đề xuất ngân sách" },
  hold: { en: "Hold budget", vi: "Giữ ngân sách" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

function primaryResult(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "lead_gen") return row.leads;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  return row.reach || row.impressions;
}

function selectBudgetRows(report: DashboardReport) {
  const adsets = report.adsetRows.filter((row) => row.spend > 0);
  if (adsets.length > 0) return adsets;
  return report.campaignRows.filter((row) => row.spend > 0);
}

function rowMetrics(row: NormalizedRow, pack: KpiPack) {
  const result = primaryResult(row, pack);
  return {
    spend: row.spend,
    result,
    costPerResult: result > 0 ? row.spend / result : 0,
    ctr: row.ctr,
    frequency: row.frequency,
    roas: row.roas,
  };
}

function asReason(row: NormalizedRow, pack: KpiPack, reasons: string[]): BudgetMoveRowReason {
  return {
    rowId: row.id,
    rowName: row.name,
    level: row.level,
    reasons,
    metrics: rowMetrics(row, pack),
  };
}

function insufficient(reasonEn: string, reasonVi: string): BudgetMoveEngineResult {
  return {
    status: "insufficient_data",
    variant: "outline",
    label: labels.insufficient_data,
    summary: {
      en: "Need stronger budget-owning row data before recommending guarded reallocations.",
      vi: "Cần dữ liệu mạnh hơn ở cấp có ngân sách trước khi đề xuất điều chuyển an toàn.",
    },
    recommendations: [],
    holdReasons: { en: [reasonEn], vi: [reasonVi] },
  };
}

function hold(reasonsEn: string[], reasonsVi: string[]): BudgetMoveEngineResult {
  return {
    status: "hold",
    variant: "outline",
    label: labels.hold,
    summary: {
      en: "No safe guarded budget move is supported by the current report.",
      vi: "Báo cáo hiện tại chưa hỗ trợ điều chuyển ngân sách an toàn.",
    },
    recommendations: [],
    holdReasons: { en: reasonsEn, vi: reasonsVi },
  };
}

export function recommendBudgetMoves(report: DashboardReport): BudgetMoveEngineResult {
  const rows = selectBudgetRows(report);
  const pack = report.selectedPack;

  if (rows.length < 3) {
    return insufficient("Need at least 3 budget-owning rows with spend.", "Cần tối thiểu 3 dòng có ngân sách và chi tiêu.");
  }

  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const totalResult = rows.reduce((sum, row) => sum + primaryResult(row, pack), 0);
  const resultRows = rows.filter((row) => primaryResult(row, pack) > 0);

  if (totalSpend <= 0 || totalResult <= 0 || resultRows.length < 2) {
    return insufficient("Need primary result signal across at least 2 budget-owning rows.", "Cần tín hiệu kết quả chính trên tối thiểu 2 dòng có ngân sách.");
  }

  if (pack === "sales_roas" && rows.every((row) => row.roas <= 0)) {
    return insufficient("Need ROAS signal before recommending sales budget moves.", "Cần tín hiệu ROAS trước khi đề xuất ngân sách sales.");
  }

  const accountCost = totalSpend / totalResult;
  const resultRowAverage = totalResult / resultRows.length;

  const targets = resultRows
    .map((row) => {
      const metrics = rowMetrics(row, pack);
      const costDelta = accountCost > 0 && metrics.costPerResult > 0 ? (accountCost - metrics.costPerResult) / accountCost : 0;
      const fatigueRisk = row.frequency >= 3 && row.ctr < 1;
      const enoughVolume = metrics.result >= Math.max(3, resultRowAverage * 0.2);
      const roasOk = pack !== "sales_roas" || (row.roas > 0 && row.roas >= report.totals.roas);
      const confidence = assessDecisionConfidence(row, pack);
      return { row, metrics, costDelta, fatigueRisk, enoughVolume, roasOk, confidence };
    })
    .filter((item) => item.costDelta >= 0.15 && item.enoughVolume && item.roasOk && !item.fatigueRisk && item.confidence.actionable)
    .sort((a, b) => b.costDelta - a.costDelta || b.metrics.result - a.metrics.result || a.row.name.localeCompare(b.row.name) || a.row.id.localeCompare(b.row.id));

  const sources = rows
    .map((row) => {
      const metrics = rowMetrics(row, pack);
      const inefficiencyDelta = metrics.result > 0 && metrics.costPerResult > 0 ? (metrics.costPerResult - accountCost) / accountCost : row.spend / totalSpend;
      const zeroResultWaste = metrics.result === 0 && row.spend >= totalSpend / rows.length;
      const weakCtr = row.impressions >= 1000 && row.ctr < 0.5;
      const fatigueRisk = row.frequency >= 3 && row.ctr < 1;
      return { row, metrics, inefficiencyDelta, zeroResultWaste, weakCtr, fatigueRisk };
    })
    .filter((item) => item.zeroResultWaste || item.inefficiencyDelta >= 0.25 || item.weakCtr || item.fatigueRisk)
    .sort((a, b) => b.inefficiencyDelta - a.inefficiencyDelta || b.metrics.spend - a.metrics.spend || a.row.name.localeCompare(b.row.name) || a.row.id.localeCompare(b.row.id));

  const target = targets[0];
  const source = sources.find((item) => item.row.id !== target?.row.id);

  if (!target) {
    const fatiguedWinner = resultRows.find((row) => {
      const cost = primaryResult(row, pack) > 0 ? row.spend / primaryResult(row, pack) : 0;
      return cost > 0 && cost <= accountCost * 0.85 && row.frequency >= 3 && row.ctr < 1;
    });
    const confidenceBlockedWinner = resultRows.find((row) => {
      const cost = primaryResult(row, pack) > 0 ? row.spend / primaryResult(row, pack) : 0;
      const costDelta = accountCost > 0 && cost > 0 ? (accountCost - cost) / accountCost : 0;
      return costDelta >= 0.15 && !assessDecisionConfidence(row, pack).actionable;
    });
    return hold(
      [
        fatiguedWinner
          ? "Potential winner has fatigue risk, so scaling is blocked by guardrail."
          : confidenceBlockedWinner
            ? "Potential winner is blocked by the decision confidence guardrail."
            : "No row is meaningfully better than account average.",
      ],
      [
        fatiguedWinner
          ? "Dòng có vẻ thắng đang có rủi ro fatigue nên không scale."
          : confidenceBlockedWinner
            ? "Dòng có vẻ thắng bị chặn bởi guardrail độ tin cậy quyết định."
            : "Không có dòng nào tốt hơn trung bình tài khoản đủ rõ.",
      ],
    );
  }

  if (!source) {
    return hold(["No safe source row is clearly inefficient enough to reduce."], ["Chưa có dòng nguồn nào kém hiệu quả đủ rõ để giảm ngân sách."]);
  }

  const suggestedMovePercent = target.costDelta >= 0.5 && source.inefficiencyDelta >= 0.5 ? 20 : target.costDelta >= 0.3 && source.inefficiencyDelta >= 0.3 ? 15 : 10;
  const recommendation: BudgetMoveRecommendation = {
    id: `transfer:${source.row.id}->${target.row.id}`,
    type: "transfer",
    sourceRowId: source.row.id,
    sourceRowName: source.row.name,
    targetRowId: target.row.id,
    targetRowName: target.row.name,
    suggestedMovePercent,
    maxIncreasePercent: MAX_MOVE_PERCENT,
    maxReductionPercent: MAX_MOVE_PERCENT,
    confidence: suggestedMovePercent >= 15 ? "medium" : "low",
    summary: {
      en: `Move up to ${suggestedMovePercent}% from ${source.row.name} toward ${target.row.name}.`,
      vi: `Chuyển tối đa ${suggestedMovePercent}% từ ${source.row.name} sang ${target.row.name}.`,
    },
    targetReasons: [
      asReason(target.row, pack, [
        `Cost per result is ${(target.costDelta * 100).toFixed(1)}% better than account average.`,
        `Has ${target.metrics.result.toLocaleString("en-US")} primary results with CTR ${target.metrics.ctr.toFixed(2)}% and frequency ${target.metrics.frequency.toFixed(2)}.`,
      ]),
    ],
    sourceReasons: [
      asReason(source.row, pack, [
        source.metrics.result === 0
          ? `Spent ${source.metrics.spend.toFixed(2)} with zero primary results.`
          : `Cost per result is ${(source.inefficiencyDelta * 100).toFixed(1)}% worse than account average.`,
        source.fatigueRisk ? "Frequency and CTR indicate fatigue risk." : "Performance is weak enough to fund a guarded transfer.",
      ]),
    ],
  };

  return {
    status: "moves_recommended",
    variant: "secondary",
    label: labels.moves_recommended,
    summary: {
      en: "A guarded budget transfer is supported by current budget-owning row performance.",
      vi: "Hiệu quả hiện tại hỗ trợ một điều chuyển ngân sách có kiểm soát.",
    },
    recommendations: [recommendation],
    holdReasons: { en: [], vi: [] },
  };
}
