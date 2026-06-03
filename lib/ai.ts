import type { AiInsightTable, AiVerdict, CompetitorSpyResult } from "@/lib/types";

const OPENROUTER_FREE_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-nano-9b-v2:free",
] as const;

const OPENROUTER_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_MODEL_TIMEOUT_MS || 22000);
const OPENROUTER_TOTAL_TIMEOUT_MS = Number(process.env.OPENROUTER_TOTAL_TIMEOUT_MS || 76000);
const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 1400);
const OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS || 85000);

function openRouterModels() {
  const requested = process.env.OPENROUTER_MODEL?.split(",").map((model) => model.trim()).filter(Boolean) || [];
  return Array.from(new Set([...requested, ...OPENROUTER_FREE_MODELS]));
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
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.attemptTimeoutMs);
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
        model: args.model,
        messages: [{ role: "user", content: args.prompt }],
        temperature: 0.2,
        max_tokens: args.maxTokens,
        response_format: { type: "json_object" },
      }),
    });
    const json = await readJson(response);
    return { response, json };
  } finally {
    clearTimeout(timeout);
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
        });
        const choice = json?.choices?.[0];
        const content = choice?.message?.content;
        const providerError = openRouterResponseError(json);
        if (response.ok && content && !providerError && choice?.finish_reason !== "length") return content;

        const message = choice?.finish_reason === "length" ? "response hit max token limit before JSON completed" : providerError || json?.error?.message || response.statusText || response.status || "empty response";
        errors.push(`${model} attempt ${attempt}: ${message}`);
        if (!shouldRetryOpenRouterResponse(response, json)) break;
        if (attempt === 1) await sleep(750);
      } catch (error) {
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
    if (json.choices?.[0]?.finish_reason === "length") return fallback(prompt, "OpenAI stopped before the verdict JSON completed. Retry with a shorter report scope.");
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
    if (json.choices?.[0]?.finish_reason === "length") return insightFallback(prompt, "OpenAI stopped before the insight JSON completed. Retry with a shorter report scope.");
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
