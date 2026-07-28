import type { DashboardReport, InterfaceLanguage, Verdict } from "@/lib/types";
import { recommendBudgetMoves } from "@/lib/budget-move-engine";
import { runDiagnostics } from "@/lib/diagnosis";
import { primaryResultSpec } from "@/lib/primary-result";

const verdictText = {
  en: {
    account: "Account",
    noSignal: "Insufficient spend or primary-result signal for a confident budget move.",
    trackingAssumption: "Pixel/CAPI/CRM/MER data is not included in this report; validate tracking before acting on budget moves.",
    localSource: "Generated from local ads rules without an AI provider call.",
    weakPack: "Selected KPI pack has weak or missing primary-result signal.",
    holdBudget: "Hold budget until spend and primary-result signal are strong enough to judge winners.",
    noRows: "No campaign or ad set rows were available for winner/loser analysis.",
    testTracking: "Run a tracking-quality check before scaling: confirm Pixel/CAPI, CRM matchback, and event deduplication.",
    testCreative: "Create at least 3-5 distinct creative angles before scaling; Meta retrieval benefits from creative diversity.",
    testFatigue: "Refresh hooks and first-frame creative for high-frequency segments before increasing spend.",
    testKpi: "Run one focused test against the selected KPI pack before moving budget.",
  },
  vi: {
    account: "Tài khoản",
    noSignal: "Chưa đủ chi tiêu hoặc tín hiệu kết quả chính để khuyến nghị điều chỉnh ngân sách chắc chắn.",
    trackingAssumption: "Báo cáo chưa có dữ liệu Pixel/CAPI/CRM/MER; cần kiểm tra tracking trước khi hành động với ngân sách.",
    localSource: "Được tạo bằng luật ads nội bộ, không gọi nhà cung cấp AI.",
    weakPack: "Gói KPI đang chọn có tín hiệu kết quả chính yếu hoặc thiếu.",
    holdBudget: "Giữ ngân sách cho đến khi chi tiêu và kết quả chính đủ mạnh để xác định nhóm thắng.",
    noRows: "Không có dòng campaign hoặc ad set để phân tích nhóm thắng/thua.",
    testTracking: "Kiểm tra chất lượng tracking trước khi scale: Pixel/CAPI, đối soát CRM, và dedup sự kiện.",
    testCreative: "Tạo ít nhất 3-5 góc creative khác biệt trước khi scale; Meta retrieval cần độ đa dạng creative.",
    testFatigue: "Làm mới hook và first-frame creative cho nhóm frequency cao trước khi tăng chi tiêu.",
    testKpi: "Chạy một test tập trung vào KPI đang chọn trước khi chuyển ngân sách.",
  },
} satisfies Record<InterfaceLanguage, Record<string, string>>;

function localize(language: InterfaceLanguage) {
  return verdictText[language] || verdictText.en;
}

function activeRows(report: DashboardReport) {
  return report.adsetRows.length ? report.adsetRows : report.campaignRows;
}

function compactMoney(value: number, currency = "USD", language: InterfaceLanguage = "en") {
  if (currency === "VND") {
    return `${compactMetric(value, language)} VND`;
  }
  return new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compactMetric(value: number, language: InterfaceLanguage) {
  return (value || 0).toLocaleString(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

export function buildLocalVerdict(report: DashboardReport, language: InterfaceLanguage): Verdict {
  const t = localize(language);
  const vi = language === "vi";
  const spec = primaryResultSpec(report.selectedPack);
  const resultLabel = vi ? spec.resultLabel.vi : spec.resultLabel.en;
  const costLabel = vi ? spec.costLabel.vi : spec.costLabel.en;
  const rows = activeRows(report);
  const currency = report.account.currency || "USD";
  const totalSpend = Number(report.totals.spend || 0);
  const totalPrimary = spec.resultKey ? Number(report.totals[spec.resultKey] || 0) : 0;
  const diagnostics = runDiagnostics(report);
  const failingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === "watch" || diagnostic.severity === "risk");
  const assumptions = [t.localSource, t.trackingAssumption];
  const risks = failingDiagnostics.slice(0, 4).map((diagnostic) =>
    `${diagnostic.title[language]}: ${diagnostic.summary?.[language] || diagnostic.description[language]}`,
  );
  const tests = new Set<string>();
  const winners: string[] = [];
  const losers: string[] = [];
  const budgetMoves: string[] = [];
  const engine = recommendBudgetMoves(report);
  const move = engine.recommendations[0];

  if (!rows.length) risks.push(t.noRows);
  if (!totalSpend || engine.status === "insufficient_data") risks.push(t.noSignal);
  if (spec.resultKey && totalPrimary <= 0) {
    risks.push(`${t.weakPack} ${report.selectedPack}: 0 ${resultLabel}.`);
    assumptions.push(`${t.weakPack} Stronger secondary signals may exist, but Budget Moves use the selected KPI pack.`);
  }

  if (move) {
    const target = move.targetReasons[0].metrics;
    const source = move.sourceReasons[0].metrics;
    winners.push(
      vi
        ? `${move.targetRowName} có ${compactMetric(target.result, language)} ${resultLabel} với ${costLabel} ${compactMoney(target.costPerResult, currency, language)}, tốt hơn trung bình tài khoản.`
        : `${move.targetRowName} produced ${compactMetric(target.result, language)} ${resultLabel} at ${compactMoney(target.costPerResult, currency, language)} ${costLabel}, better than account average.`,
    );
    const loserCostText = source.costPerResult > 0 ? `${compactMoney(source.costPerResult, currency, language)} ${costLabel}` : `0 ${resultLabel}`;
    losers.push(
      vi
        ? `${move.sourceRowName} dùng ${compactMoney(source.spend, currency, language)} nhưng hiệu quả yếu (${loserCostText}).`
        : `${move.sourceRowName} spent ${compactMoney(source.spend, currency, language)} with weak efficiency (${loserCostText}).`,
    );
    budgetMoves.push(
      vi
        ? `Có thể tăng ${move.targetRowName} tối đa ${move.suggestedMovePercent}% sau khi xác nhận tracking và chất lượng kết quả.`
        : `Consider increasing ${move.targetRowName} by up to ${move.suggestedMovePercent}% after validating tracking and result quality.`,
      vi
        ? `Giảm hoặc giữ trần ${move.sourceRowName}; chỉ chuyển ngân sách sang nhóm thắng theo bước tối đa ${move.maxReductionPercent}%.`
        : `Reduce or cap ${move.sourceRowName}; reallocate only in steps of up to ${move.maxReductionPercent}% toward proven winners.`,
    );
  }

  if (!budgetMoves.length) budgetMoves.push(t.holdBudget);

  if (report.adRows.length < 10 || diagnostics.some((diagnostic) => diagnostic.id === "creativeVolume" && diagnostic.severity !== "ok")) tests.add(t.testCreative);
  if (report.totals.frequency > 3 || diagnostics.some((diagnostic) => diagnostic.id === "dailyDiagnosis" && diagnostic.daily.causes.some((cause) => cause.id === "creative_fatigue"))) tests.add(t.testFatigue);
  tests.add(t.testTracking);
  if (spec.resultKey && totalPrimary <= 0) tests.add(t.testKpi);

  const hasWinnerOrLoser = Boolean(winners.length || losers.length);
  const confidence: Verdict["confidence"] =
    totalSpend > 0 && totalPrimary > 0 && hasWinnerOrLoser && report.health.checks.length
      ? "high"
      : totalSpend > 0 && (totalPrimary > 0 || failingDiagnostics.length)
        ? "medium"
        : "low";

  const selectedPack = vi
    ? ({ messages: "tin nhắn", lead_gen: "tạo khách hàng tiềm năng", sales_roas: "doanh số/ROAS", traffic: "lưu lượng", awareness: "nhận biết" } as const)[report.selectedPack]
    : report.selectedPack;
  const verdict =
    vi
      ? `${t.account} ${report.account.name} được đánh giá theo gói KPI ${selectedPack}. Chi tiêu ${compactMoney(totalSpend, currency, language)} tạo ${compactMetric(totalPrimary, language)} ${resultLabel}; ưu tiên xử lý rủi ro tracking/creative trước khi scale.`
      : `${t.account} ${report.account.name} was evaluated with the ${report.selectedPack} KPI pack. Spend of ${compactMoney(totalSpend, currency, language)} produced ${compactMetric(totalPrimary, language)} ${resultLabel}; prioritize tracking and creative risks before scaling.`;

  return {
    provider: "prompt",
    verdict,
    risks: risks.length ? risks : [vi ? "Không có rủi ro lớn từ dữ liệu hiện có." : "No major risk detected from the available report data."],
    winners,
    losers,
    budget_moves: budgetMoves.slice(0, 4),
    tests: Array.from(tests).slice(0, 4),
    confidence,
    assumptions,
  };
}
