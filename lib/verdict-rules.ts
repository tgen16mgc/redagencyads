import type { DashboardReport, InterfaceLanguage, Verdict } from "@/lib/types";
import { recommendBudgetMoves } from "@/lib/budget-move-engine";
import { runDiagnostics } from "@/lib/diagnosis";
import { primaryResultSpec } from "@/lib/primary-result";

const verdictText = {
  en: {
    account: "Account",
    noSignal: "Insufficient spend or primary-result signal for a confident budget move.",
    trackingAssumption: "Pixel, CAPI, CRM, and MER data are not included; confirm measurement quality before changing budget.",
    localSource: "The decision is generated from deterministic local rules without an external AI call.",
    weakPack: "Selected KPI pack has weak or missing primary-result signal.",
    holdBudget: "Hold budget until spend and primary-result signal are strong enough to judge winners.",
    noRows: "No campaign or ad set rows were available for winner/loser analysis.",
    testTracking: "Check measurement quality before increasing budget: confirm Pixel/CAPI, reconcile CRM results, and check for duplicate events.",
    testCreative: "Prepare at least 3-5 distinct ad concepts before increasing budget so Meta has enough variety to test.",
    testFatigue: "Refresh hooks and first-frame creative for high-frequency segments before increasing spend.",
    testKpi: "Run one focused test against the selected KPI pack before moving budget.",
  },
  vi: {
    account: "Tài khoản",
    noSignal: "Chưa đủ chi tiêu hoặc tín hiệu kết quả chính để khuyến nghị điều chỉnh ngân sách chắc chắn.",
    trackingAssumption: "Báo cáo chưa có dữ liệu Pixel, CAPI, CRM và MER; cần xác nhận chất lượng đo lường trước khi đổi ngân sách.",
    localSource: "Quyết định được tạo từ bộ quy tắc cục bộ, không gọi nhà cung cấp AI bên ngoài.",
    weakPack: "Gói KPI đang chọn có tín hiệu kết quả chính yếu hoặc thiếu.",
    holdBudget: "Giữ ngân sách cho đến khi chi tiêu và kết quả chính đủ mạnh để xác định nhóm hiệu quả.",
    noRows: "Không có dữ liệu chiến dịch hoặc nhóm quảng cáo để phân tích hiệu quả.",
    testTracking: "Kiểm tra chất lượng đo lường trước khi tăng ngân sách: xác nhận Pixel/CAPI, đối soát CRM và kiểm tra sự kiện trùng lặp.",
    testCreative: "Chuẩn bị ít nhất 3-5 ý tưởng quảng cáo khác biệt trước khi tăng ngân sách để Meta có đủ phương án thử nghiệm.",
    testFatigue: "Làm mới thông điệp mở đầu và khung hình đầu cho nhóm có tần suất cao trước khi tăng chi tiêu.",
    testKpi: "Chạy một thử nghiệm tập trung vào KPI đang chọn trước khi chuyển ngân sách.",
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
    return `${(value || 0).toLocaleString(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 0 })} VND`;
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
        ? `Có thể tăng ${move.targetRowName} tối đa ${move.suggestedMovePercent}% sau khi xác nhận đo lường và chất lượng kết quả.`
        : `Consider increasing ${move.targetRowName} by up to ${move.suggestedMovePercent}% after confirming measurement and result quality.`,
      vi
        ? `Giảm hoặc giữ trần ${move.sourceRowName}; chỉ chuyển ngân sách sang nhóm hiệu quả theo từng bước tối đa ${move.maxReductionPercent}%.`
        : `Reduce or cap ${move.sourceRowName}; reallocate only in steps of up to ${move.maxReductionPercent}% toward the stronger segment.`,
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

  const selectedPack = ({
    messages: { en: "messages", vi: "tin nhắn" },
    lead_gen: { en: "lead generation", vi: "tạo khách hàng tiềm năng" },
    sales_roas: { en: "sales and ROAS", vi: "doanh số và ROAS" },
    traffic: { en: "traffic", vi: "lưu lượng" },
    awareness: { en: "awareness", vi: "nhận biết" },
  } as const)[report.selectedPack][language];
  const verdict =
    vi
      ? `${t.account} ${report.account.name} được đánh giá theo mục tiêu ${selectedPack}. Chi tiêu ${compactMoney(totalSpend, currency, language)} tạo ${compactMetric(totalPrimary, language)} ${resultLabel}; cần xử lý rủi ro đo lường và mẫu quảng cáo trước khi tăng ngân sách.`
      : `${t.account} ${report.account.name} was evaluated against the ${selectedPack} objective. Spend of ${compactMoney(totalSpend, currency, language)} produced ${compactMetric(totalPrimary, language)} ${resultLabel}; address measurement and ad-creative risks before increasing budget.`;

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
