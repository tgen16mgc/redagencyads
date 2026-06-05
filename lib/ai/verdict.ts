import type { DashboardReport, InterfaceLanguage, Verdict, VerdictProvider } from "@/lib/types";
import { buildLocalVerdict } from "@/lib/verdict-rules";
import {
  confidenceValue,
  errorMessage,
  hasNineRouterCredentials,
  nineRouterCompletion,
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

async function enhanceVerdictWithNineRouter(args: {
  report: DashboardReport;
  localVerdict: Verdict;
  language: InterfaceLanguage;
}) {
  const parsed = parseVerdictStrict(
    await nineRouterCompletion(buildVerdictEnhancementPrompt(args), { jsonMode: true, maxTokens: 1800 }),
    "9router",
  );
  if (!parsed || hasLargeBudgetMove(parsed)) throw new Error("9router Verdict failed guardrail validation.");
  return capConfidence(parsed, args.localVerdict.confidence);
}

async function generateLegacyVerdict(prompt: string, provider: VerdictRequestProvider): Promise<Verdict> {
  if (provider === "prompt") return fallback(prompt);
  if ((provider === "9router" || provider === "auto") && hasNineRouterCredentials()) {
    try {
      return parseVerdict(await nineRouterCompletion(prompt, { jsonMode: true }), "9router");
    } catch (error) {
      return fallback(prompt, `9router could not finish a live Verdict in time. Local prompt mode used instead. ${errorMessage(error)}`);
    }
  }
  return fallback(prompt, "9router credentials missing. Use local prompt mode for deterministic Verdict generation.");
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

  if (provider === "9router" || provider === "auto") {
    if (!hasNineRouterCredentials()) {
      return mergeProviderAssumption(localVerdict, "9router credentials missing; local ads-rule Verdict used instead.");
    }
    try {
      return await enhanceVerdictWithNineRouter({ report: input.report, localVerdict, language });
    } catch (error) {
      return mergeProviderAssumption(localVerdict, `9router enhancement failed; local ads-rule Verdict used instead. ${errorMessage(error)}`);
    }
  }

  return localVerdict;
}
