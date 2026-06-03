import type { AiInsightTable, AiVerdict, CompetitorSpyResult } from "@/lib/types";

const OPENROUTER_FREE_MODELS = [
  "moonshotai/kimi-k2.6:free",
  "openrouter/owl-alpha",
  "nvidia/nemotron-3-super-120b-a12b:free",
] as const;

const OPENROUTER_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_MODEL_TIMEOUT_MS || 22000);
const OPENROUTER_TOTAL_TIMEOUT_MS = Number(process.env.OPENROUTER_TOTAL_TIMEOUT_MS || 76000);
const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 900);
const OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS || 85000);

function openRouterModels() {
  const requested = process.env.OPENROUTER_MODEL;
  const kimi = OPENROUTER_FREE_MODELS[0];
  if (requested && requested !== kimi && OPENROUTER_FREE_MODELS.includes(requested as (typeof OPENROUTER_FREE_MODELS)[number])) {
    return [kimi, requested, ...OPENROUTER_FREE_MODELS.filter((model) => model !== kimi && model !== requested)];
  }
  return [...OPENROUTER_FREE_MODELS];
}

function positiveMs(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "request failed";
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function openRouterCompletion(
  prompt: string,
  options: {
    modelTimeoutMs?: number;
    totalTimeoutMs?: number;
    maxTokens?: number;
  } = {},
) {
  const errors: string[] = [];
  const startedAt = Date.now();
  const modelTimeoutMs = positiveMs(options.modelTimeoutMs ?? OPENROUTER_MODEL_TIMEOUT_MS, OPENROUTER_MODEL_TIMEOUT_MS);
  const totalTimeoutMs = positiveMs(options.totalTimeoutMs ?? OPENROUTER_TOTAL_TIMEOUT_MS, OPENROUTER_TOTAL_TIMEOUT_MS);
  const maxTokens = Math.max(300, Math.min(positiveMs(options.maxTokens ?? OPENROUTER_MAX_TOKENS, OPENROUTER_MAX_TOKENS), 2400));

  for (const model of openRouterModels()) {
    const remainingMs = totalTimeoutMs - (Date.now() - startedAt);
    if (remainingMs < 4000) {
      errors.push(`deadline: stopped before ${model} because ${Math.max(0, Math.round(remainingMs / 1000))}s remained`);
      break;
    }

    const controller = new AbortController();
    const attemptTimeoutMs = Math.min(modelTimeoutMs, remainingMs - 1000);
    const timeout = setTimeout(() => controller.abort(), attemptTimeoutMs);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "http-referer": process.env.OPENROUTER_SITE_URL || "https://meta-ads-dashboard.vercel.app",
          "x-title": "Red Agency Ads Tool",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
      });
      const json = await readJson(response);
      const content = json?.choices?.[0]?.message?.content;
      if (response.ok && content) return content;
      if (response.ok) {
        errors.push(`${model}: empty response`);
        continue;
      }
      errors.push(`${model}: ${json?.error?.message || response.status}`);
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? `timed out after ${Math.round(attemptTimeoutMs / 1000)}s`
          : errorMessage(error);
      errors.push(`${model}: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`OpenRouter free model request failed. ${errors.join(" | ")}`);
}

function fallback(prompt: string, reason = "AI provider key not configured. Use the generated prompt fallback for manual analysis."): AiVerdict {
  return {
    provider: "prompt",
    verdict: reason,
    risks: ["No live AI verdict was generated."],
    winners: [],
    losers: [],
    budget_moves: [],
    tests: [],
    confidence: "low",
    assumptions: [reason, `Prompt length: ${prompt.length} chars.`],
  };
}

function parseVerdict(text: string, provider: AiVerdict["provider"]): AiVerdict {
  try {
    return { ...JSON.parse(text), provider } as AiVerdict;
  } catch {
    return {
      provider,
      verdict: text.slice(0, 700),
      risks: ["Model returned non-JSON output."],
      winners: [],
      losers: [],
      budget_moves: [],
      tests: [],
      confidence: "low",
      assumptions: ["JSON parsing failed; raw model output was truncated into verdict field."],
    };
  }
}

export async function generateVerdict(prompt: string, provider: "auto" | "openai" | "openrouter" | "prompt") {
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
    return parseVerdict(json.choices?.[0]?.message?.content || "", "openai");
  }
  if ((provider === "openrouter" || provider === "auto") && process.env.OPENROUTER_API_KEY) {
    try {
      return parseVerdict(await openRouterCompletion(prompt), "openrouter");
    } catch (error) {
      return fallback(prompt, `OpenRouter could not finish a live verdict in time. Use the prompt fallback or retry with OpenAI. ${errorMessage(error)}`);
    }
  }
  return fallback(prompt);
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
        action: reason.includes("OpenRouter") ? "Retry with a shorter report scope or switch provider to OpenAI." : "Add OPENAI_API_KEY or OPENROUTER_API_KEY on server, then regenerate insights.",
        priority: "medium",
        confidence: "high",
      },
    ],
    confidence: "low",
    assumptions: [reason],
  };
}

function parseInsights(text: string, provider: AiInsightTable["provider"]): AiInsightTable {
  try {
    return { ...JSON.parse(text), provider } as AiInsightTable;
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

export async function generateInsights(prompt: string, provider: "auto" | "openai" | "openrouter" | "prompt") {
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
    return parseInsights(json.choices?.[0]?.message?.content || "", "openai");
  }
  if ((provider === "openrouter" || provider === "auto") && process.env.OPENROUTER_API_KEY) {
    try {
      return parseInsights(await openRouterCompletion(prompt, { maxTokens: 1100 }), "openrouter");
    } catch (error) {
      return insightFallback(prompt, `OpenRouter could not finish live insights in time. Use the prompt fallback or retry with OpenAI. ${errorMessage(error)}`);
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
        opportunity: "Add OPENAI_API_KEY or OPENROUTER_API_KEY, then regenerate competitor spy output.",
        confidence: "high",
      },
    ],
    creative_gaps: ["Live AI competitor interpretation unavailable in prompt-only mode."],
    test_briefs: [],
    next_actions: ["Paste competitor ad-library notes into the panel and regenerate after adding an AI provider key."],
    assumptions: ["OPENAI_API_KEY or OPENROUTER_API_KEY missing in server environment."],
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

export async function generateCompetitorSpy(prompt: string, provider: "auto" | "openai" | "openrouter" | "prompt") {
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
