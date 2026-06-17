import type { KpiPack, NormalizedRow } from "@/lib/types";
import { SUFFICIENCY } from "@/lib/data-sufficiency";

export type BreakdownWasteStatus = "clean" | "waste_detected" | "insufficient_data";

export type BreakdownWasteRow = {
  id: string;
  name: string;
  spend: number;
  result: number;
  spendShare: number;
  resultShare: number;
  cpa: number;
};

export type BreakdownWaste = {
  status: BreakdownWasteStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  rows: BreakdownWasteRow[];
};

const labels: Record<BreakdownWasteStatus, { en: string; vi: string }> = {
  clean: { en: "No major waste", vi: "Không có lãng phí lớn" },
  waste_detected: { en: "Waste detected", vi: "Phát hiện lãng phí" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

const MIN_BREAKDOWN_ROWS = 2;

function primaryResult(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "lead_gen") return row.leads;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  return row.impressions;
}

function insufficientData(): BreakdownWaste {
  return {
    status: "insufficient_data",
    variant: "outline",
    label: labels.insufficient_data,
    summary: {
      en: `Need at least ${MIN_BREAKDOWN_ROWS} breakdown rows with spend to analyze allocation efficiency.`,
      vi: `Chưa đủ ${MIN_BREAKDOWN_ROWS} dòng dữ liệu có chi tiêu để phân tích hiệu quả phân bổ.`,
    },
    rows: [],
  };
}

export function assessBreakdownWaste(rows: NormalizedRow[], pack: KpiPack): BreakdownWaste {
  const usable = rows.filter((row) => row.spend > 0);
  const totalSpend = usable.reduce((sum, row) => sum + row.spend, 0);
  const totalResult = usable.reduce((sum, row) => sum + primaryResult(row, pack), 0);

  if (usable.length < MIN_BREAKDOWN_ROWS || totalSpend <= 0) {
    return insufficientData();
  }

  const detailedRows: BreakdownWasteRow[] = usable.map((row) => {
    const resultVal = primaryResult(row, pack);
    return {
      id: row.id,
      name: row.name || row.platform || [row.age, row.gender].filter(Boolean).join(" / "),
      spend: row.spend,
      result: resultVal,
      spendShare: row.spend / totalSpend,
      resultShare: totalResult > 0 ? resultVal / totalResult : 0,
      cpa: resultVal > 0 ? row.spend / resultVal : 0,
    };
  });

  const accountCpa = totalResult > 0 ? totalSpend / totalResult : 0;

  // Flag a row if it takes >30% of spend AND has a CPA that is >1.5x the account average
  // (or has zero results while owning >30% of spend)
  const wasteRows = detailedRows.filter((row) => {
    if (row.spendShare < 0.3) return false;
    if (row.result === 0) return true;
    return row.cpa > accountCpa * 1.5;
  });

  if (wasteRows.length > 0) {
    const topWaste = wasteRows.sort((a, b) => b.spend - a.spend)[0];
    return {
      status: "waste_detected",
      variant: "destructive",
      label: labels.waste_detected,
      summary: {
        en: `High spend share but weak results on ${topWaste.name} (${(topWaste.spendShare * 100).toFixed(0)}% spend share, CPA ${(topWaste.cpa || topWaste.spend).toFixed(2)}).`,
        vi: `Tỷ lệ chi tiêu cao nhưng kết quả yếu trên ${topWaste.name} (chiếm ${(topWaste.spendShare * 100).toFixed(0)}% chi tiêu, CPA ${(topWaste.cpa || topWaste.spend).toFixed(0)}).`,
      },
      rows: wasteRows,
    };
  }

  return {
    status: "clean",
    variant: "secondary",
    label: labels.clean,
    summary: {
      en: "No major breakdown waste detected. Spend matches results proportionally.",
      vi: "Không phát hiện lãng phí lớn. Chi tiêu phân bổ tương đối đồng đều với kết quả.",
    },
    rows: [],
  };
}
