export const OPENROUTER_FREE_MODELS = [
  "nvidia/nemotron-nano-9b-v2:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
] as const;

export const OPENROUTER_VERDICT_MODELS = [
  "moonshotai/kimi-k2.6:free",
  ...OPENROUTER_FREE_MODELS,
] as const;

const OPENROUTER_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_MODEL_TIMEOUT_MS || 45000);
const OPENROUTER_TOTAL_TIMEOUT_MS = Number(process.env.OPENROUTER_TOTAL_TIMEOUT_MS || 130000);
const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 1400);
export const OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS = Number(
  process.env.OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS || 85000,
);
const KIRO_TIMEOUT_MS = Number(process.env.KIRO_TIMEOUT_MS || process.env.NINEROUTER_TIMEOUT_MS || 45000);
const KIRO_MAX_TOKENS = Number(process.env.KIRO_MAX_TOKENS || process.env.NINEROUTER_MAX_TOKENS || 1800);
const KIRO_DEFAULT_MODEL = "kr/claude-sonnet-4.5-thinking-agentic";
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45000);
const GEMINI_MAX_TOKENS = Number(process.env.GEMINI_MAX_TOKENS || 1400);
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export const VERDICT_JSON_SCHEMA = {
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

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "request failed";
}

export function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => stringValue(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function confidenceValue(value: unknown): "low" | "medium" | "high" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
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

export function parseJsonObject(text: string) {
  return JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
}

export function promptInputJson(prompt: string) {
  const marker = "Input JSON:";
  const index = prompt.lastIndexOf(marker);
  if (index < 0) return null;
  try {
    return parseJsonObject(prompt.slice(index + marker.length));
  } catch {
    return null;
  }
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

export async function openRouterCompletion(
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

function kiroBaseUrl() {
  return (process.env.KIRO_BASE_URL || process.env.NINEROUTER_URL || "http://localhost:20128").replace(/\/$/, "");
}

function kiroApiKey() {
  return process.env.KIRO_API_KEY || process.env.NINEROUTER_KEY || "";
}

export function hasKiroCredentials() {
  return Boolean(kiroApiKey());
}

export async function kiroCompletion(prompt: string, options: { jsonMode?: boolean; maxTokens?: number } = {}) {
  const controller = new AbortController();
  const timeoutMs = positiveMs(KIRO_TIMEOUT_MS, 45000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = kiroApiKey();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  try {
    const body: Record<string, unknown> = {
      model: process.env.KIRO_MODEL || process.env.NINEROUTER_MODEL || KIRO_DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: Math.max(300, Math.min(positiveMs(options.maxTokens ?? KIRO_MAX_TOKENS, KIRO_MAX_TOKENS), 2400)),
    };
    if (options.jsonMode) body.response_format = { type: "json_object" };

    const response = await fetch(`${kiroBaseUrl()}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify(body),
    });
    const json = await readJson(response);
    if (!response.ok) throw new Error(json?.error?.message || "Kiro 9router request failed.");
    const text = choiceText(json?.choices?.[0]);
    if (!text) throw new Error("Kiro 9router returned an empty response.");
    return text;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Kiro 9router timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function geminiModelPath() {
  const requestedModel = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const model = requestedModel.replace(/^models\//, "") === "gemini-3.1-flash" ? GEMINI_DEFAULT_MODEL : requestedModel;
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

export async function geminiCompletion(prompt: string, schema?: Record<string, unknown>) {
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
