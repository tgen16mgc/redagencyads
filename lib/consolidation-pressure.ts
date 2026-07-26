import type { DiagnosticSeverity } from "@/lib/diagnosis";
import type { KpiPack, NormalizedRow } from "@/lib/types";
import { primaryResultSpec, primaryResultValue } from "@/lib/primary-result";

export type ConsolidationPressureStatus = "healthy" | "warning" | "critical" | "insufficient_data";

export type ConsolidationPressureAssessment = {
  status: ConsolidationPressureStatus;
  severity: DiagnosticSeverity;
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  conversionsPerAdset: number;
  activeAdsets: number;
  totalConversions: number;
  weeklyThreshold: number;
};

export function assessConsolidationPressure(
  adsetRows: NormalizedRow[],
  pack: KpiPack,
  reportDays: number,
): ConsolidationPressureAssessment {
  const weeklyThreshold = 7;
  const active = adsetRows.filter((row) => row.spend > 0);

  if (!primaryResultSpec(pack).resultKey) {
    return {
      status: "insufficient_data",
      severity: "insufficient",
      label: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
      summary: {
        en: "The awareness pack has no conversion-scale primary result, so consolidation pressure is not assessed.",
        vi: "Gói awareness không có kết quả chính theo quy mô chuyển đổi nên không đánh giá áp lực hợp nhất.",
      },
      conversionsPerAdset: 0,
      activeAdsets: active.length,
      totalConversions: 0,
      weeklyThreshold,
    };
  }

  if (!active.length) {
    return {
      status: "insufficient_data",
      severity: "insufficient",
      label: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
      summary: {
        en: "No active ad sets with spend found to assess consolidation pressure.",
        vi: "Không có ad set active có chi tiêu để đánh giá áp lực hợp nhất.",
      },
      conversionsPerAdset: 0,
      activeAdsets: 0,
      totalConversions: 0,
      weeklyThreshold,
    };
  }

  const totalConversions = active.reduce((sum, row) => sum + primaryResultValue(row, pack), 0);
  const weeks = Math.max(reportDays / 7, 1);
  const weeklyConversions = totalConversions / weeks;
  const conversionsPerAdset = weeklyConversions / active.length;

  const status: ConsolidationPressureStatus =
    conversionsPerAdset >= weeklyThreshold
      ? "healthy"
      : conversionsPerAdset > weeklyThreshold / 2
        ? "warning"
        : "critical";

  const severity: DiagnosticSeverity = status === "healthy" ? "ok" : status === "warning" ? "watch" : "risk";

  const label = {
    healthy: { en: "Consolidation healthy", vi: "Cấu trúc ổn định" },
    warning: { en: "Consolidation pressure", vi: "Áp lực hợp nhất" },
    critical: { en: "Consolidation critical", vi: "Cần hợp nhất gấp" },
    insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
  }[status];

  const summary = {
    healthy: {
      en: `${conversionsPerAdset.toFixed(1)} conversions/ad set/week meets the 7/week learning threshold.`,
      vi: `${conversionsPerAdset.toFixed(1)} chuyển đổi/ad set/tuần đạt ngưỡng học máy 7/tuần.`,
    },
    warning: {
      en: `${conversionsPerAdset.toFixed(1)} conversions/ad set/week is below the 7/week threshold — ad sets may stay in learning phase. Consider consolidating ${active.length} ad sets.`,
      vi: `${conversionsPerAdset.toFixed(1)} chuyển đổi/ad set/tuần dưới ngưỡng 7/tuần — ad set có thể ở trạng thái học liên tục. Cân nhắc hợp nhất ${active.length} ad set.`,
    },
    critical: {
      en: `Only ${conversionsPerAdset.toFixed(1)} conversions/ad set/week across ${active.length} active ad sets — well below the 7/week threshold. Consolidate ad sets to exit the learning phase and improve algorithmic signal.`,
      vi: `Chỉ ${conversionsPerAdset.toFixed(1)} chuyển đổi/ad set/tuần trên ${active.length} ad set active — thấp hơn nhiều so với ngưỡng 7/tuần. Hợp nhất ad set để thoát learning phase và cải thiện tín hiệu thuật toán.`,
    },
    insufficient_data: {
      en: "No active ad sets with spend found to assess consolidation pressure.",
      vi: "Không có ad set active có chi tiêu để đánh giá áp lực hợp nhất.",
    },
  }[status];

  return { status, severity, label, summary, conversionsPerAdset, activeAdsets: active.length, totalConversions, weeklyThreshold };
}
