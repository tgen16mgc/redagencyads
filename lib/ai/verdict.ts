import type {
  DashboardReport,
  InterfaceLanguage,
  KpiPack,
  NormalizedRow,
  Verdict,
  VerdictProvider,
} from "@/lib/types";
import {
  confidenceValue,
  errorMessage,
  hasKiroCredentials,
  kiroCompletion,
  parseJsonObject,
  stringArray,
  stringValue,
} from "@/lib/ai/transport";

type VerdictRequestProvider = VerdictProvider | "auto";
type StructuredVerdictInput = {
  report: DashboardReport;
  language?: InterfaceLanguage;
  provider?: VerdictRequestProvider;
  prompt?: string;
};
type LegacyVerdictInput = {
  prompt: string;
  language?: InterfaceLanguage;
  provider?: VerdictRequestProvider;
};
type GenerateVerdictInput = StructuredVerdictInput | LegacyVerdictInput;

type PrimarySpec = {
  resultKey: keyof NormalizedRow | null;
  costKey: keyof NormalizedRow | null;
  resultLabel: string;
  costLabel: string;
  scalable: boolean;
};

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

function fallback(prompt: string, reason = "AI provider key not configured. Use local prompt mode for deterministic Verdict generation."): Verdict {
  return {
    provider: "prompt",
    verdict: reason,
    risks: ["No live Verdict was generated."],
    winners: [],
    losers: [],
    budget_moves: [],
    tests: [],
    confidence: "low",
    assumptions: [reason, `Prompt length: ${prompt.length} chars.`],
  };
}

function localize(language: InterfaceLanguage) {
  return verdictText[language] || verdictText.en;
}

function primarySpec(pack: KpiPack, language: InterfaceLanguage): PrimarySpec {
  const vi = language === "vi";
  const specs: Record<KpiPack, PrimarySpec> = {
    messages: {
      resultKey: "messages",
      costKey: "costPerMessage",
      resultLabel: vi ? "tin nhắn" : "messages",
      costLabel: vi ? "cost/message" : "cost/message",
      scalable: true,
    },
    lead_gen: {
      resultKey: "leads",
      costKey: "cpl",
      resultLabel: vi ? "lead" : "leads",
      costLabel: "CPL",
      scalable: true,
    },
    sales_roas: {
      resultKey: "purchases",
      costKey: "cpaPurchase",
      resultLabel: vi ? "đơn mua" : "purchases",
      costLabel: "CPA",
      scalable: true,
    },
    traffic: {
      resultKey: "linkClicks",
      costKey: "cpc",
      resultLabel: vi ? "link click" : "link clicks",
      costLabel: "CPC",
      scalable: true,
    },
    awareness: {
      resultKey: null,
      costKey: null,
      resultLabel: vi ? "delivery/creative efficiency" : "delivery/creative efficiency",
      costLabel: vi ? "CTR/CPM/frequency" : "CTR/CPM/frequency",
      scalable: false,
    },
  };
  return specs[pack];
}

function activeRows(report: DashboardReport) {
  return report.adsetRows.length ? report.adsetRows : report.campaignRows;
}

function meaningfulRows(report: DashboardReport) {
  const rows = activeRows(report).filter((row) => row.spend > 0);
  const totalSpend = Number(report.totals.spend || 0);
  if (!totalSpend) return [];
  const topSpendIds = new Set(rows.sort((a, b) => b.spend - a.spend).slice(0, 3).map((row) => row.id));
  return rows.filter((row) => {
    const share = row.spend / totalSpend;
    if (share < 0.01) return false;
    return share >= 0.1 || topSpendIds.has(row.id);
  });
}

function numericRowValue(row: NormalizedRow, key: keyof NormalizedRow | null) {
  if (!key) return 0;
  return Number(row[key] || 0);
}

function rowCost(row: NormalizedRow, spec: PrimarySpec) {
  if (!spec.costKey) return 0;
  const value = numericRowValue(row, spec.costKey);
  if (value > 0) return value;
  const result = numericRowValue(row, spec.resultKey);
  return result ? row.spend / result : 0;
}

function compactMoney(value: number, currency = "USD", language: InterfaceLanguage = "en") {
  return new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compactMetric(value: number, language: InterfaceLanguage) {
  return (value || 0).toLocaleString(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

function buildLocalVerdict(report: DashboardReport, language: InterfaceLanguage): Verdict {
  const t = localize(language);
  const spec = primarySpec(report.selectedPack, language);
  const rows = activeRows(report);
  const meaningful = meaningfulRows(report);
  const currency = report.account.currency || "USD";
  const totalSpend = Number(report.totals.spend || 0);
  const totalPrimary = numericRowValue(report.totals, spec.resultKey);
  const accountCost = rowCost(report.totals, spec);
  const failingChecks = report.health.checks.filter((check) => check.status !== "pass");
  const assumptions = [t.localSource, t.trackingAssumption];
  const risks = failingChecks.map((check) => `${check.label}: ${check.detail}`);
  const tests = new Set<string>();
  const winners: string[] = [];
  const losers: string[] = [];
  const budgetMoves: string[] = [];

  if (!rows.length) risks.push(t.noRows);
  if (!totalSpend || !meaningful.length) risks.push(t.noSignal);
  if (spec.resultKey && totalPrimary <= 0) {
    risks.push(`${t.weakPack} ${report.selectedPack}: 0 ${spec.resultLabel}.`);
    assumptions.push(`${t.weakPack} Stronger secondary signals may exist, but Budget Moves use the selected KPI pack.`);
  }

  const sortedByCost = meaningful
    .map((row) => ({ row, result: numericRowValue(row, spec.resultKey), cost: rowCost(row, spec) }))
    .filter((item) => (spec.resultKey ? item.result > 0 && item.cost > 0 : item.row.spend > 0))
    .sort((a, b) => a.cost - b.cost);

  if (spec.scalable && totalPrimary > 0 && accountCost > 0) {
    const winner = sortedByCost.find((item) => item.cost <= accountCost * 0.85);
    const loser = meaningful
      .map((row) => ({ row, result: numericRowValue(row, spec.resultKey), cost: rowCost(row, spec) }))
      .filter((item) => item.result <= 0 || (item.cost > 0 && item.cost >= accountCost * 1.5))
      .sort((a, b) => b.row.spend - a.row.spend)[0];

    if (winner) {
      winners.push(
        language === "vi"
          ? `${winner.row.name} có ${compactMetric(winner.result, language)} ${spec.resultLabel} với ${spec.costLabel} ${compactMoney(winner.cost, currency, language)}, tốt hơn mức tài khoản ${compactMoney(accountCost, currency, language)}.`
          : `${winner.row.name} produced ${compactMetric(winner.result, language)} ${spec.resultLabel} at ${compactMoney(winner.cost, currency, language)} ${spec.costLabel}, better than account average ${compactMoney(accountCost, currency, language)}.`,
      );
      budgetMoves.push(
        language === "vi"
          ? `Có thể tăng ${winner.row.name} tối đa 20% sau khi xác nhận tracking và chất lượng lead/tin nhắn.`
          : `Consider increasing ${winner.row.name} by up to 20% after validating tracking and result quality.`,
      );
    }

    if (loser) {
      const loserCostText = loser.cost ? `${compactMoney(loser.cost, currency, language)} ${spec.costLabel}` : `0 ${spec.resultLabel}`;
      losers.push(
        language === "vi"
          ? `${loser.row.name} dùng ${compactMoney(loser.row.spend, currency, language)} nhưng hiệu quả yếu (${loserCostText}).`
          : `${loser.row.name} spent ${compactMoney(loser.row.spend, currency, language)} with weak efficiency (${loserCostText}).`,
      );
      budgetMoves.push(
        language === "vi"
          ? `Giảm hoặc giữ trần ${loser.row.name}; chỉ chuyển ngân sách sang nhóm thắng theo bước tối đa 20%.`
          : `Reduce or cap ${loser.row.name}; reallocate only in steps of up to 20% toward proven winners.`,
      );
    }
  }

  if (!budgetMoves.length) budgetMoves.push(t.holdBudget);

  if (report.adRows.length < 10 || failingChecks.some((check) => /creative|volume/i.test(check.label))) tests.add(t.testCreative);
  if (report.totals.frequency > 3 || failingChecks.some((check) => /frequency/i.test(check.label))) tests.add(t.testFatigue);
  tests.add(t.testTracking);
  if (spec.resultKey && totalPrimary <= 0) tests.add(t.testKpi);

  const hasWinnerOrLoser = Boolean(winners.length || losers.length);
  const confidence: Verdict["confidence"] =
    totalSpend > 0 && meaningful.length && totalPrimary > 0 && hasWinnerOrLoser && report.health.checks.length
      ? "high"
      : totalSpend > 0 && meaningful.length && (totalPrimary > 0 || failingChecks.length)
        ? "medium"
        : "low";

  const verdict =
    language === "vi"
      ? `${t.account} ${report.account.name} được đánh giá theo gói ${report.selectedPack}. Chi tiêu ${compactMoney(totalSpend, currency, language)} tạo ${compactMetric(totalPrimary, language)} ${spec.resultLabel}; ưu tiên xử lý rủi ro tracking/creative trước khi scale.`
      : `${t.account} ${report.account.name} was evaluated with the ${report.selectedPack} KPI pack. Spend of ${compactMoney(totalSpend, currency, language)} produced ${compactMetric(totalPrimary, language)} ${spec.resultLabel}; prioritize tracking and creative risks before scaling.`;

  return {
    provider: "prompt",
    verdict,
    risks: risks.length ? risks : [language === "vi" ? "Không có rủi ro lớn từ dữ liệu hiện có." : "No major risk detected from the available report data."],
    winners,
    losers,
    budget_moves: budgetMoves.slice(0, 4),
    tests: Array.from(tests).slice(0, 4),
    confidence,
    assumptions,
  };
}


function parseVerdictStrict(text: string, provider: VerdictProvider): Verdict | null {
  try {
    const json = parseJsonObject(text);
    return {
      provider,
      verdict: stringValue(json.verdict, "AI returned a verdict without a readable summary."),
      risks: stringArray(json.risks),
      winners: stringArray(json.winners),
      losers: stringArray(json.losers),
      budget_moves: stringArray(json.budget_moves),
      tests: stringArray(json.tests),
      confidence: confidenceValue(json.confidence),
      assumptions: stringArray(json.assumptions),
    };
  } catch {
    return null;
  }
}

function parseVerdict(text: string, provider: VerdictProvider): Verdict {
  const parsed = parseVerdictStrict(text, provider);
  if (parsed) return parsed;
  return {
    provider,
    verdict: "AI returned an unreadable verdict. Retry with a shorter campaign scope or switch provider.",
    risks: ["Model output could not be parsed into the verdict schema."],
    winners: [],
    losers: [],
    budget_moves: [],
    tests: [],
    confidence: "low",
    assumptions: [`Raw output preview: ${text.slice(0, 220)}`],
  };
}

function hasLargeBudgetMove(verdict: Verdict) {
  return verdict.budget_moves.some((move) => {
    const matches = Array.from(move.matchAll(/(\d+(?:\.\d+)?)\s*%/g));
    return matches.some((match) => Number(match[1]) > 20);
  });
}

function mergeProviderAssumption(verdict: Verdict, assumption: string): Verdict {
  return { ...verdict, assumptions: Array.from(new Set([...verdict.assumptions, assumption])) };
}

function capConfidence(verdict: Verdict, max: Verdict["confidence"]): Verdict {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[verdict.confidence] > rank[max] ? { ...verdict, confidence: max } : verdict;
}

function isStructuredVerdictInput(input: GenerateVerdictInput): input is StructuredVerdictInput {
  return typeof input === "object" && input !== null && "report" in input;
}

function buildVerdictEnhancementPrompt(args: {
  report: DashboardReport;
  localVerdict: Verdict;
  language: InterfaceLanguage;
}) {
  const languageRule =
    args.language === "vi"
      ? "Return Vietnamese user-facing strings. Keep JSON keys unchanged."
      : "Return English user-facing strings. Keep JSON keys unchanged.";
  const payload = {
    account: args.report.account.name,
    selected_pack: args.report.selectedPack,
    date_range: args.report.dateRange,
    totals: args.report.totals,
    health: args.report.health,
    local_verdict: args.localVerdict,
  };
  return `You are improving wording for a Meta Ads Verdict.

Rules:
- Return strict JSON only.
- Preserve the local Verdict's strategic claims: risks, winners, losers, budget_moves, tests, confidence.
- Do not invent revenue, CRM, CAPI, MER, Pixel, or conversion data.
- Do not recommend budget changes above 20%.
- You may improve clarity, prioritization language, and client-facing wording.
- ${languageRule}

Output schema:
{
  "verdict": "...",
  "risks": ["..."],
  "winners": ["..."],
  "losers": ["..."],
  "budget_moves": ["..."],
  "tests": ["..."],
  "confidence": "low|medium|high",
  "assumptions": ["..."]
}

Input JSON:
${JSON.stringify(payload, null, 2)}`;
}

async function enhanceVerdictWithKiro(args: {
  report: DashboardReport;
  localVerdict: Verdict;
  language: InterfaceLanguage;
}) {
  const parsed = parseVerdictStrict(
    await kiroCompletion(buildVerdictEnhancementPrompt(args), { jsonMode: true, maxTokens: 1800 }),
    "kiro",
  );
  if (!parsed || hasLargeBudgetMove(parsed)) throw new Error("Kiro 9router verdict failed guardrail validation.");
  return capConfidence(parsed, args.localVerdict.confidence);
}

async function generateLegacyVerdict(prompt: string, provider: VerdictRequestProvider): Promise<Verdict> {
  if (provider === "prompt") return fallback(prompt);
  if ((provider === "kiro" || provider === "auto") && hasKiroCredentials()) {
    try {
      return parseVerdict(await kiroCompletion(prompt, { jsonMode: true }), "kiro");
    } catch (error) {
      return fallback(prompt, `Kiro 9router could not finish a live verdict in time. Local prompt mode used instead. ${errorMessage(error)}`);
    }
  }
  return fallback(prompt, "Kiro 9router credentials missing. Use local prompt mode for deterministic Verdict generation.");
}

export async function generateVerdict(input: GenerateVerdictInput | string, legacyProvider: VerdictRequestProvider = "auto"): Promise<Verdict> {
  if (typeof input === "string") return generateLegacyVerdict(input, legacyProvider);

  const provider = input.provider || "auto";
  const language = input.language || "en";

  if (!isStructuredVerdictInput(input)) {
    return generateLegacyVerdict(input.prompt, provider);
  }

  const localVerdict = buildLocalVerdict(input.report, language);
  if (provider === "prompt") return localVerdict;

  if (provider === "kiro" || provider === "auto") {
    if (!hasKiroCredentials()) {
      return mergeProviderAssumption(localVerdict, "Kiro 9router credentials missing; local ads-rule Verdict used instead.");
    }
    try {
      return await enhanceVerdictWithKiro({ report: input.report, localVerdict, language });
    } catch (error) {
      return mergeProviderAssumption(localVerdict, `Kiro 9router enhancement failed; local ads-rule Verdict used instead. ${errorMessage(error)}`);
    }
  }

  return localVerdict;
}
