import type { KpiPack, NormalizedRow } from "@/lib/types";
import { SUFFICIENCY } from "@/lib/data-sufficiency";

export type ResultConcentrationStatus = "low_risk" | "medium_risk" | "high_risk" | "insufficient_data";

export type ResultConcentrationRow = {
  id: string;
  name: string;
  result: number;
  spend: number;
  resultShare: number;
  spendShare: number;
};

export type ResultConcentration = {
  status: ResultConcentrationStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  topRows: ResultConcentrationRow[];
};

const labels: Record<ResultConcentrationStatus, { en: string; vi: string }> = {
  low_risk: { en: "Low concentration", vi: "Tập trung thấp" },
  medium_risk: { en: "Medium concentration", vi: "Tập trung trung bình" },
  high_risk: { en: "High concentration", vi: "Tập trung cao" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

const MIN_CONCENTRATION_ROWS = 3;

function primaryResult(row: NormalizedRow, pack: KpiPack) {
  if (pack === "messages") return row.messages;
  if (pack === "lead_gen") return row.leads;
  if (pack === "sales_roas") return row.purchases;
  if (pack === "traffic") return row.linkClicks;
  return row.impressions;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function insufficientData(topRows: ResultConcentrationRow[]): ResultConcentration {
  return {
    status: "insufficient_data",
    variant: "outline",
    label: labels.insufficient_data,
    summary: {
      en: `Need at least ${MIN_CONCENTRATION_ROWS} rows with spend or results to judge concentration.`,
      vi: `Chưa đủ ${MIN_CONCENTRATION_ROWS} dòng có chi tiêu hoặc kết quả để đánh giá tập trung.`,
    },
    topRows,
  };
}

export function assessResultConcentration(rows: NormalizedRow[], pack: KpiPack): ResultConcentration {
  const usableRows = rows.filter((row) => row.spend > 0 || primaryResult(row, pack) > 0);
  const totalResult = usableRows.reduce((sum, row) => sum + primaryResult(row, pack), 0);
  const totalSpend = usableRows.reduce((sum, row) => sum + row.spend, 0);
  const useResults = totalResult > 0;
  const denominator = useResults ? totalResult : totalSpend;
  const sorted = [...usableRows].sort((a, b) => {
    const left = useResults ? primaryResult(b, pack) - primaryResult(a, pack) : b.spend - a.spend;
    return left || b.spend - a.spend;
  });
  const topRows = sorted.slice(0, 3).map((row) => ({
    id: row.id,
    name: row.name,
    result: primaryResult(row, pack),
    spend: row.spend,
    resultShare: totalResult > 0 ? primaryResult(row, pack) / totalResult : 0,
    spendShare: totalSpend > 0 ? row.spend / totalSpend : 0,
  }));

  if (usableRows.length < MIN_CONCENTRATION_ROWS || denominator <= 0) {
    return insufficientData(topRows);
  }

  const topOneShare = useResults ? topRows[0]?.resultShare || 0 : topRows[0]?.spendShare || 0;
  const topThreeShare = topRows.reduce((sum, row) => sum + (useResults ? row.resultShare : row.spendShare), 0);
  const basis = useResults ? "results" : "spend";
  const basisVi = useResults ? "kết quả" : "chi tiêu";

  if (topOneShare >= 0.6 || topThreeShare >= 0.85) {
    return {
      status: "high_risk",
      variant: "destructive",
      label: labels.high_risk,
      summary: {
        en: `${topRows[0].name} drives ${percent(topOneShare)} of ${basis}; portfolio risk is concentrated in too few rows.`,
        vi: `${topRows[0].name} chiếm ${percent(topOneShare)} ${basisVi}; rủi ro portfolio đang tập trung vào quá ít dòng.`,
      },
      topRows,
    };
  }

  if (topOneShare >= 0.4 || topThreeShare >= 0.7) {
    return {
      status: "medium_risk",
      variant: "outline",
      label: labels.medium_risk,
      summary: {
        en: `The top 3 rows drive ${percent(topThreeShare)} of ${basis}; scale carefully until more rows prove repeatable.`,
        vi: `Top 3 dòng chiếm ${percent(topThreeShare)} ${basisVi}; nên scale cẩn thận đến khi nhiều dòng chứng minh được độ lặp lại.`,
      },
      topRows,
    };
  }

  return {
    status: "low_risk",
    variant: "secondary",
    label: labels.low_risk,
    summary: {
      en: `Primary ${basis} are distributed across multiple rows, so portfolio dependency is low.`,
      vi: `${basisVi} chính được phân bổ trên nhiều dòng, nên rủi ro phụ thuộc portfolio thấp.`,
    },
    topRows,
  };
}
