import type {
  AiInsightTable,
  CompetitorSpyResult,
  DashboardReport,
  InterfaceLanguage,
  KpiPack,
  NormalizedRow,
  Verdict,
  VerdictProvider,
} from "@/lib/types";

const OPENROUTER_FREE_MODELS = [
  "nvidia/nemotron-nano-9b-v2:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
] as const;

const OPENROUTER_VERDICT_MODELS = [
  "moonshotai/kimi-k2.6:free",
  ...OPENROUTER_FREE_MODELS,
] as const;

const OPENROUTER_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_MODEL_TIMEOUT_MS || 45000);
const OPENROUTER_TOTAL_TIMEOUT_MS = Number(process.env.OPENROUTER_TOTAL_TIMEOUT_MS || 130000);
const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 1400);
const OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS || 85000);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45000);
const GEMINI_MAX_TOKENS = Number(process.env.GEMINI_MAX_TOKENS || 1400);

const VERDICT_JSON_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    winners: { type: "array", items: { type: "string" } },
    losers: { type: "array", items: { type: "string" } },
    budget_moves: { type: "array", items: { type: "string" } },
    tests: { type: "array", items: { type: "string" } },
    confidence: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "risks", "winners", "losers", "budget_moves", "tests", "confidence", "assumptions"],
} as const;

function openRouterModels(defaultModels: readonly string[] = OPENROUTER_FREE_MODELS) {
  const requested = process.env.OPENROUTER_MODEL?.split(",").map((model) => model.trim()).filter(Boolean) || [];
  return Array.from(new Set([...requested, ...defaultModels]));
}

function positiveMs(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "request failed";
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const chunks = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]");

    if (!chunks.length) return null;

    let content = "";
    let reasoning = "";
    let finishReason = "";
    let lastChunk: any = null;

    for (const chunk of chunks) {
      try {
        const json = JSON.parse(chunk);
        lastChunk = json;
        const choice = json.choices?.[0];
        content += choiceText(choice);
        reasoning += stringValue(choice?.delta?.reasoning) || stringValue(choice?.delta?.reasoning_content);
        finishReason = choice?.finish_reason || finishReason;
      } catch {
        continue;
      }
    }

    return {
      ...lastChunk,
      choices: [
        {
          ...(lastChunk?.choices?.[0] || {}),
          finish_reason: finishReason || lastChunk?.choices?.[0]?.finish_reason,
          message: {
            ...(lastChunk?.choices?.[0]?.message || {}),
            content,
            reasoning,
          },
        },
      ],
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openRouterResponseError(json: any) {
  const topLevel = json?.error?.message;
  const choice = json?.choices?.[0];
  const choiceError = choice?.error?.message || choice?.delta?.error?.message;
  const finishReason = choice?.finish_reason;
  return topLevel || choiceError || (finishReason === "error" ? "provider returned an error finish reason" : "");
}

function shouldRetryOpenRouterResponse(response: Response, json: any) {
  if ([408, 429, 502, 503, 529].includes(response.status)) return true;
  if (!response.ok) return false;
  if (openRouterResponseError(json)) return true;
  if (json?.choices?.[0]?.finish_reason === "length") return true;
  return !json?.choices?.[0]?.message?.content;
}

async function fetchOpenRouterCompletion(args: {
  prompt: string;
  model: string;
  attemptTimeoutMs: number;
  maxTokens: number;
  jsonMode: boolean;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.attemptTimeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: args.model,
      messages: [{ role: "user", content: args.prompt }],
      reasoning: { exclude: true },
      include_reasoning: false,
    };
    if (args.model !== "moonshotai/kimi-k2.6:free") {
      body.temperature = 0.2;
      body.max_tokens = args.maxTokens;
    }
    if (args.jsonMode) body.response_format = { type: "json_object" };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "http-referer": process.env.OPENROUTER_SITE_URL || "https://meta-ads-dashboard.vercel.app",
        "x-title": "Red Agency Ads Tool",
      },
      body: JSON.stringify(body),
    });
    const json = await readJson(response);
    return { response, json };
  } finally {
    clearTimeout(timeout);
  }
}

function contentPartText(part: unknown): string {
  if (typeof part === "string") return part;
  if (typeof part !== "object" || part === null) return "";
  const record = part as Record<string, unknown>;
  return stringValue(record.text) || stringValue(record.content);
}

function messageText(message: unknown): string {
  if (typeof message === "string") return message;
  if (typeof message !== "object" || message === null) return "";

  const record = message as Record<string, unknown>;
  const content = record.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(contentPartText).join("");

  return stringValue(record.text) || stringValue(record.reasoning_content) || stringValue(record.reasoning);
}

function choiceText(choice: unknown): string {
  if (typeof choice !== "object" || choice === null) return "";
  const record = choice as Record<string, unknown>;
  return messageText(record.message) || messageText(record.delta) || stringValue(record.text);
}

async function openRouterCompletion(
  prompt: string,
  options: {
    modelTimeoutMs?: number;
    totalTimeoutMs?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    models?: readonly string[];
  } = {},
) {
  const errors: string[] = [];
  const startedAt = Date.now();
  const modelTimeoutMs = positiveMs(options.modelTimeoutMs ?? OPENROUTER_MODEL_TIMEOUT_MS, OPENROUTER_MODEL_TIMEOUT_MS);
  const totalTimeoutMs = positiveMs(options.totalTimeoutMs ?? OPENROUTER_TOTAL_TIMEOUT_MS, OPENROUTER_TOTAL_TIMEOUT_MS);
  const maxTokens = Math.max(300, Math.min(positiveMs(options.maxTokens ?? OPENROUTER_MAX_TOKENS, OPENROUTER_MAX_TOKENS), 2400));
  const jsonMode = options.jsonMode ?? false;

  for (const model of openRouterModels(options.models)) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const remainingMs = totalTimeoutMs - (Date.now() - startedAt);
      if (remainingMs < 4000) {
        errors.push(`deadline: stopped before ${model} attempt ${attempt} because ${Math.max(0, Math.round(remainingMs / 1000))}s remained`);
        break;
      }

      const attemptTimeoutMs = Math.min(modelTimeoutMs, remainingMs - 1000);
      try {
        const { response, json } = await fetchOpenRouterCompletion({
          prompt,
          model,
          attemptTimeoutMs,
          maxTokens,
          jsonMode,
        });
        const choice = json?.choices?.[0];
        const content = choiceText(choice);
        const providerError = openRouterResponseError(json);
        if (response.ok && content && !providerError) {
          if (choice?.finish_reason !== "length") return content;
          try {
            parseJsonObject(content);
            return content;
          } catch {
            errors.push(`${model} attempt ${attempt}: response hit max token limit before JSON completed`);
            if (attempt === 1) await sleep(750);
            continue;
          }
        }

        const message = providerError || json?.error?.message || (response.ok ? `empty response (finish_reason: ${choice?.finish_reason || "unknown"})` : response.statusText || response.status || "request failed");
        errors.push(`${model} attempt ${attempt}: ${message}`);
        if ([400, 401, 403].includes(response.status)) {
          throw new Error(`OpenRouter request failed. ${errors.join(" | ")}`);
        }
        if (!shouldRetryOpenRouterResponse(response, json)) break;
        if (attempt === 1) await sleep(750);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("OpenRouter request failed.")) throw error;
        const message =
          error instanceof DOMException && error.name === "AbortError"
            ? `timed out after ${Math.round(attemptTimeoutMs / 1000)}s`
            : errorMessage(error);
        errors.push(`${model} attempt ${attempt}: ${message}`);
        if (attempt === 1) await sleep(750);
      }
    }
  }
  throw new Error(`OpenRouter free model request failed. ${errors.join(" | ")}`);
}

function geminiModelPath() {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return model.startsWith("models/") ? model : `models/${model}`;
}

function geminiBaseUrl() {
  return (process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
}

function geminiResponseText(json: any) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map(contentPartText).join("").trim();
}

async function geminiCompletion(prompt: string, schema?: Record<string, unknown>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key missing.");

  const controller = new AbortController();
  const timeoutMs = positiveMs(GEMINI_TIMEOUT_MS, 45000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.2,
      maxOutputTokens: Math.max(300, Math.min(positiveMs(GEMINI_MAX_TOKENS, 1400), 2400)),
    };
    if (schema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = schema;
    }

    const response = await fetch(`${geminiBaseUrl()}/${geminiModelPath()}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });
    const json = await readJson(response);
    if (!response.ok) throw new Error(json?.error?.message || "Gemini verdict request failed.");
    const text = geminiResponseText(json);
    if (!text) throw new Error("Gemini returned an empty verdict.");
    return text;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Gemini timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonObject(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  for (let start = trimmed.indexOf("{"); start >= 0; start = trimmed.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < trimmed.length; index += 1) {
      const char = trimmed[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) return trimmed.slice(start, index + 1);
      }
    }
  }

  return trimmed;
}

function parseJsonObject(text: string) {
  return JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => stringValue(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function confidenceValue(value: unknown): "low" | "medium" | "high" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

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

async function enhanceVerdictWithOpenAI(args: {
  report: DashboardReport;
  localVerdict: Verdict;
  language: InterfaceLanguage;
}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: buildVerdictEnhancementPrompt(args) }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || "OpenAI verdict request failed.");
  if (json.choices?.[0]?.finish_reason === "length") throw new Error("OpenAI stopped before the verdict JSON completed.");
  const parsed = parseVerdictStrict(json.choices?.[0]?.message?.content || "", "openai");
  if (!parsed || hasLargeBudgetMove(parsed)) throw new Error("OpenAI verdict failed guardrail validation.");
  return capConfidence(parsed, args.localVerdict.confidence);
}

async function generateOpenRouterVerdict(args: {
  report: DashboardReport;
  localVerdict: Verdict;
  language: InterfaceLanguage;
}) {
  const parsed = parseVerdictStrict(
    await openRouterCompletion(buildVerdictEnhancementPrompt(args), {
      models: OPENROUTER_VERDICT_MODELS,
      jsonMode: true,
      maxTokens: 1800,
    }),
    "openrouter",
  );
  if (!parsed || hasLargeBudgetMove(parsed)) throw new Error("OpenRouter verdict failed guardrail validation.");
  return capConfidence(parsed, args.localVerdict.confidence);
}

async function enhanceVerdictWithGemini(args: {
  report: DashboardReport;
  localVerdict: Verdict;
  language: InterfaceLanguage;
}) {
  const parsed = parseVerdictStrict(await geminiCompletion(buildVerdictEnhancementPrompt(args), VERDICT_JSON_SCHEMA), "gemini");
  if (!parsed || hasLargeBudgetMove(parsed)) throw new Error("Gemini verdict failed guardrail validation.");
  return capConfidence(parsed, args.localVerdict.confidence);
}

async function generateLegacyVerdict(prompt: string, provider: VerdictRequestProvider): Promise<Verdict> {
  if (provider === "prompt") return fallback(prompt);
  if ((provider === "openai" || provider === "auto") && process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "OpenAI verdict request failed.");
    if (json.choices?.[0]?.finish_reason === "length") return fallback(prompt, "OpenAI stopped before the verdict JSON completed. Retry with a shorter report scope.");
    return parseVerdict(json.choices?.[0]?.message?.content || "", "openai");
  }
  if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
    try {
      return parseVerdict(await openRouterCompletion(prompt, { models: OPENROUTER_VERDICT_MODELS, jsonMode: true }), "openrouter");
    } catch (error) {
      return fallback(prompt, `OpenRouter could not finish a live verdict in time. Use local prompt mode or retry with OpenAI. ${errorMessage(error)}`);
    }
  }
  return fallback(prompt);
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

  if ((provider === "openai" || provider === "auto") && process.env.OPENAI_API_KEY) {
    try {
      return await enhanceVerdictWithOpenAI({ report: input.report, localVerdict, language });
    } catch (error) {
      return mergeProviderAssumption(localVerdict, `OpenAI enhancement failed; local ads-rule Verdict used instead. ${errorMessage(error)}`);
    }
  }

  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      return mergeProviderAssumption(localVerdict, "OpenRouter API key missing; local ads-rule Verdict used instead.");
    }
    try {
      return await generateOpenRouterVerdict({ report: input.report, localVerdict, language });
    } catch (error) {
      return {
        ...localVerdict,
        assumptions: [
          ...localVerdict.assumptions,
          `OpenRouter failed; local ads-rule Verdict used instead. ${errorMessage(error)}`,
        ],
      };
    }
  }

  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      return mergeProviderAssumption(localVerdict, "Gemini API key missing; local ads-rule Verdict used instead.");
    }
    try {
      return await enhanceVerdictWithGemini({ report: input.report, localVerdict, language });
    } catch (error) {
      return mergeProviderAssumption(localVerdict, `Gemini enhancement failed; local ads-rule Verdict used instead. ${errorMessage(error)}`);
    }
  }

  return localVerdict;
}

function insightFallback(prompt: string, reason = "AI provider key not configured. Copy prompt fallback and run manually."): AiInsightTable {
  return {
    provider: "prompt",
    summary: reason,
    rows: [
      {
        area: "Setup",
        insight: "Live AI insight table unavailable.",
        evidence: `Prompt ready with ${prompt.length} chars.`,
        action: reason.includes("OpenRouter") || reason.includes("Gemini") ? "Retry with a shorter report scope or switch provider to OpenAI." : "Add OPENAI_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY on server, then regenerate insights.",
        priority: "medium",
        confidence: "high",
      },
    ],
    confidence: "low",
    assumptions: [reason],
  };
}

function promptInputJson(prompt: string) {
  const marker = "Input JSON:";
  const index = prompt.lastIndexOf(marker);
  if (index < 0) return null;
  try {
    return parseJsonObject(prompt.slice(index + marker.length));
  } catch {
    return null;
  }
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value || 0) || 0;
}

function compactNumber(value: number, suffix = "") {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}${suffix}`;
}

function localInsightFallback(prompt: string, reason: string): AiInsightTable {
  const input = promptInputJson(prompt);
  if (!input) return insightFallback(prompt, reason);

  const totals = typeof input.totals === "object" && input.totals !== null ? (input.totals as Record<string, unknown>) : {};
  const health = typeof input.health === "object" && input.health !== null ? (input.health as Record<string, unknown>) : {};
  const checks = Array.isArray(health.checks) ? health.checks : [];
  const rows: AiInsightTable["rows"] = [];
  const failingCheck = checks.find((check) => typeof check === "object" && check !== null && (check as Record<string, unknown>).status !== "pass") as Record<string, unknown> | undefined;
  const topCampaign = Array.isArray(input.top_campaigns) ? input.top_campaigns[0] as Record<string, unknown> | undefined : undefined;
  const comparison = typeof input.comparison === "object" && input.comparison !== null ? (input.comparison as Record<string, unknown>) : null;
  const deltas = comparison && Array.isArray(comparison.deltas) ? comparison.deltas as Record<string, unknown>[] : [];
  const biggestDelta = deltas
    .filter((delta) => ["spend", "messages", "leads", "purchases", "linkClicks", "ctr", "frequency", "costPerMessage", "cpl", "roas"].includes(stringValue(delta.key)))
    .sort((a, b) => Math.abs(numberValue(b.change_pct)) - Math.abs(numberValue(a.change_pct)))[0];
  const ctr = numberValue(totals.ctr);
  const frequency = numberValue(totals.frequency);
  const spend = numberValue(totals.spend);
  const messages = numberValue(totals.messages);
  const leads = numberValue(totals.leads);
  const purchases = numberValue(totals.purchases);

  if (failingCheck) {
    rows.push({
      area: "Account health",
      insight: stringValue(failingCheck.label, "Health check needs attention"),
      evidence: stringValue(failingCheck.detail, `Health score ${compactNumber(numberValue(health.score))}/100.`),
      action: "Fix this check before scaling budget or broadening campaign scope.",
      priority: "high",
      confidence: "high",
    });
  }

  if (ctr > 0 && ctr < 1) {
    rows.push({
      area: "Creative",
      insight: "CTR is below the 1% benchmark.",
      evidence: `CTR is ${compactNumber(ctr, "%")} on ${compactNumber(numberValue(totals.impressions))} impressions.`,
      action: "Refresh hooks and first-frame creative before increasing spend.",
      priority: "high",
      confidence: "high",
    });
  }

  if (frequency > 3) {
    rows.push({
      area: "Audience",
      insight: "Frequency suggests possible audience or creative fatigue.",
      evidence: `Average frequency is ${compactNumber(frequency)}.`,
      action: "Rotate creative, exclude recent engagers, or widen the audience before scaling.",
      priority: frequency > 5 ? "high" : "medium",
      confidence: "medium",
    });
  }

  if (topCampaign) {
    rows.push({
      area: "Budget",
      insight: `${stringValue(topCampaign.name, "Top campaign")} is the first budget review target.`,
      evidence: `Spend ${compactNumber(numberValue(topCampaign.spend))}, messages ${compactNumber(numberValue(topCampaign.messages))}, leads ${compactNumber(numberValue(topCampaign.leads))}, purchases ${compactNumber(numberValue(topCampaign.purchases))}.`,
      action: "Shift budget only after checking its cost per result against the account average.",
      priority: "medium",
      confidence: "medium",
    });
  }

  if (biggestDelta) {
    rows.push({
      area: "Efficiency",
      insight: `${stringValue(biggestDelta.key, "Metric")} changed most in the comparison window.`,
      evidence: `Change ${compactNumber(numberValue(biggestDelta.change_pct), "%")}.`,
      action: "Check which campaign or ad set caused this movement before changing budget.",
      priority: Math.abs(numberValue(biggestDelta.change_pct)) >= 20 ? "high" : "medium",
      confidence: "medium",
    });
  }

  if (!rows.length) {
    rows.push({
      area: "Efficiency",
      insight: "No major red flag detected from the available Meta metrics.",
      evidence: `Spend ${compactNumber(spend)}, messages ${compactNumber(messages)}, leads ${compactNumber(leads)}, purchases ${compactNumber(purchases)}.`,
      action: "Use campaign and ad set drilldowns to pick one winner to protect and one weak segment to test.",
      priority: "medium",
      confidence: "medium",
    });
  }

  return {
    provider: "prompt",
    summary: "Live OpenRouter output was unavailable, so this brief was generated from the report metrics.",
    rows: rows.slice(0, 5),
    confidence: "medium",
    assumptions: [reason, "Fallback uses only available Meta report metrics; it does not invent CRM, Pixel, CAPI, MER, revenue, or conversion data."],
  };
}

function priorityValue(value: unknown): "low" | "medium" | "high" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function parseInsights(text: string, provider: AiInsightTable["provider"]): AiInsightTable {
  try {
    const json = parseJsonObject(text);
    const rows = Array.isArray(json.rows)
      ? json.rows.map((row) => {
          const record = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
          return {
            area: stringValue(record.area, "AI output"),
            insight: stringValue(record.insight),
            evidence: stringValue(record.evidence),
            action: stringValue(record.action),
            priority: priorityValue(record.priority),
            confidence: confidenceValue(record.confidence),
          };
        }).filter((row) => row.insight || row.evidence || row.action)
      : [];
    return {
      provider,
      summary: stringValue(json.summary, "AI insight summary generated."),
      rows,
      confidence: confidenceValue(json.confidence),
      assumptions: stringArray(json.assumptions),
    };
  } catch {
    return {
      provider,
      summary: "Model returned non-JSON output.",
      rows: [
        {
          area: "AI output",
          insight: text.slice(0, 180),
          evidence: "JSON parsing failed.",
          action: "Retry or use prompt fallback.",
          priority: "medium",
          confidence: "low",
        },
      ],
      confidence: "low",
      assumptions: ["Raw model output truncated into insight row."],
    };
  }
}

export async function generateInsights(prompt: string, provider: "auto" | AiInsightTable["provider"]) {
  if (provider === "prompt") return insightFallback(prompt);
  if ((provider === "openai" || provider === "auto") && process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "OpenAI insights request failed.");
    if (json.choices?.[0]?.finish_reason === "length") return localInsightFallback(prompt, "OpenAI stopped before the insight JSON completed.");
    return parseInsights(json.choices?.[0]?.message?.content || "", "openai");
  }
  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) return localInsightFallback(prompt, "Gemini API key missing; local metric insights used instead.");
    try {
      return parseInsights(await geminiCompletion(prompt), "gemini");
    } catch (error) {
      return localInsightFallback(prompt, `Gemini insights were unavailable or returned unusable output. ${errorMessage(error)}`);
    }
  }
  if ((provider === "openrouter" || provider === "auto") && process.env.OPENROUTER_API_KEY) {
    try {
      return parseInsights(await openRouterCompletion(prompt, { maxTokens: 2200 }), "openrouter");
    } catch (error) {
      return localInsightFallback(prompt, `OpenRouter live models were unavailable or returned unusable output. ${errorMessage(error)}`);
    }
  }
  return insightFallback(prompt);
}

function competitorFallback(prompt: string): CompetitorSpyResult {
  return {
    provider: "prompt",
    summary: "AI provider key not configured. Copy the competitor prompt and run it manually.",
    competitors: [],
    themes: [
      {
        theme: "Manual competitor brief required",
        evidence: `Prompt ready with ${prompt.length} chars.`,
        opportunity: "Add OPENAI_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY, then regenerate competitor spy output.",
        confidence: "high",
      },
    ],
    creative_gaps: ["Live AI competitor interpretation unavailable in prompt-only mode."],
    test_briefs: [],
    next_actions: ["Paste competitor ad-library notes into the panel and regenerate after adding an AI provider key."],
    assumptions: ["OPENAI_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY missing in server environment."],
  };
}

function parseCompetitorSpy(text: string, provider: CompetitorSpyResult["provider"]): CompetitorSpyResult {
  try {
    return { ...JSON.parse(text), provider } as CompetitorSpyResult;
  } catch {
    return {
      provider,
      summary: "Model returned non-JSON output.",
      competitors: [],
      themes: [
        {
          theme: "AI output",
          evidence: text.slice(0, 220),
          opportunity: "Retry with shorter competitor notes or use prompt fallback.",
          confidence: "low",
        },
      ],
      creative_gaps: ["JSON parsing failed."],
      test_briefs: [],
      next_actions: ["Retry competitor spy generation."],
      assumptions: ["Raw model output truncated into theme evidence."],
    };
  }
}

export async function generateCompetitorSpy(prompt: string, provider: "auto" | CompetitorSpyResult["provider"]) {
  if (provider === "prompt") return competitorFallback(prompt);
  if ((provider === "openai" || provider === "auto") && process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "OpenAI competitor spy request failed.");
    return parseCompetitorSpy(json.choices?.[0]?.message?.content || "", "openai");
  }
  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) return competitorFallback(prompt);
    try {
      return parseCompetitorSpy(await geminiCompletion(prompt), "gemini");
    } catch (error) {
      return {
        ...competitorFallback(prompt),
        summary: `Gemini competitor spy failed; prompt-only output returned. ${errorMessage(error)}`,
        assumptions: [`Gemini failed; prompt-only output returned. ${errorMessage(error)}`],
      };
    }
  }
  if ((provider === "openrouter" || provider === "auto") && process.env.OPENROUTER_API_KEY) {
    return parseCompetitorSpy(
      await openRouterCompletion(prompt, {
        modelTimeoutMs: OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS,
        totalTimeoutMs: OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS + 15000,
        maxTokens: 1800,
      }),
      "openrouter",
    );
  }
  return competitorFallback(prompt);
}
