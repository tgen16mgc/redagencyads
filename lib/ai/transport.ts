const NINEROUTER_TIMEOUT_MS = Number(process.env.NINEROUTER_TIMEOUT_MS || 45000);
const NINEROUTER_MAX_TOKENS = Number(process.env.NINEROUTER_MAX_TOKENS || 1800);
const NINEROUTER_DEFAULT_MODEL = "mhyc";

export type NineRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class NineRouterProviderError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "NineRouterProviderError";
  }
}

export class NineRouterTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NineRouterTimeoutError";
  }
}

export class NineRouterAbortError extends Error {
  constructor() {
    super("AI provider request was cancelled.");
    this.name = "NineRouterAbortError";
  }
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

function nineRouterBaseUrl() {
  return (process.env.NINEROUTER_URL || "http://localhost:20128").replace(/\/$/, "").replace(/\/v1$/, "");
}

function nineRouterApiKey() {
  return process.env.NINEROUTER_KEY || "";
}

export function hasNineRouterCredentials() {
  return Boolean(nineRouterApiKey());
}

function retryableProviderStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function answerPartText(message: unknown): string {
  if (typeof message !== "object" || message === null) return "";
  const record = message as Record<string, unknown>;
  const content = record.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(contentPartText).join("");
  return stringValue(record.text);
}

function streamedChoiceText(choice: unknown): string {
  if (typeof choice !== "object" || choice === null) return "";
  const record = choice as Record<string, unknown>;
  return answerPartText(record.delta) || answerPartText(record.message) || stringValue(record.text);
}

async function readStreamedCompletion(response: Response, onDelta: (delta: string) => void) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const json = await readJson(response);
    const text = choiceText(json?.choices?.[0]);
    if (text) onDelta(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload);
      const delta = streamedChoiceText(json?.choices?.[0]);
      if (!delta) return;
      answer += delta;
      onDelta(delta);
    } catch {
      // Ignore malformed provider keep-alives while preserving valid streamed tokens.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    lines.forEach(consumeLine);
  }
  buffer += decoder.decode();
  if (buffer) consumeLine(buffer);
  return answer;
}

export async function nineRouterChatCompletionStream(
  messages: NineRouterMessage[],
  options: { maxTokens?: number; signal?: AbortSignal; onDelta: (delta: string) => void },
) {
  const controller = new AbortController();
  const timeoutMs = positiveMs(NINEROUTER_TIMEOUT_MS, 45000);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = nineRouterApiKey();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const requestedMaxTokens = Math.max(
    300,
    Math.min(positiveMs(options.maxTokens ?? NINEROUTER_MAX_TOKENS, NINEROUTER_MAX_TOKENS), 2400),
  );

  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await fetch(`${nineRouterBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: process.env.NINEROUTER_MODEL || NINEROUTER_DEFAULT_MODEL,
          messages,
          temperature: 0.2,
          max_tokens: requestedMaxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const json = await readJson(response);
        const message = json?.error?.message || "AI provider request failed.";
        if (attempt === 1 && retryableProviderStatus(response.status)) continue;
        throw new NineRouterProviderError(message, response.status);
      }

      const text = await readStreamedCompletion(response, options.onDelta);
      if (text) return text;
      if (attempt === 1) continue;
      throw new NineRouterProviderError("AI provider returned an empty response after 2 attempts.", 502);
    }

    throw new NineRouterProviderError("AI provider request failed after 2 attempts.", 502);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (!timedOut && options.signal?.aborted) throw new NineRouterAbortError();
      throw new NineRouterTimeoutError(`AI provider timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    if (error instanceof NineRouterProviderError || error instanceof NineRouterTimeoutError || error instanceof NineRouterAbortError) {
      throw error;
    }
    throw new NineRouterProviderError(errorMessage(error), 502);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function nineRouterChatCompletion(
  messages: NineRouterMessage[],
  options: { jsonMode?: boolean; maxTokens?: number; signal?: AbortSignal } = {},
) {
  const controller = new AbortController();
  const timeoutMs = positiveMs(NINEROUTER_TIMEOUT_MS, 45000);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = nineRouterApiKey();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const requestedMaxTokens = Math.max(
    300,
    Math.min(positiveMs(options.maxTokens ?? NINEROUTER_MAX_TOKENS, NINEROUTER_MAX_TOKENS), 2400),
  );

  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const body: Record<string, unknown> = {
        model: process.env.NINEROUTER_MODEL || NINEROUTER_DEFAULT_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: Math.min(requestedMaxTokens + (attempt - 1) * 600, 2400),
      };
      if (options.jsonMode) body.response_format = { type: "json_object" };

      const response = await fetch(`${nineRouterBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers,
        body: JSON.stringify(body),
      });
      const json = await readJson(response);
      if (!response.ok) {
        const message = json?.error?.message || "AI provider request failed.";
        if (attempt === 1 && retryableProviderStatus(response.status)) continue;
        throw new NineRouterProviderError(message, response.status);
      }

      const choice = json?.choices?.[0];
      const text = choiceText(choice);
      if (!text) {
        if (attempt === 1) continue;
        throw new NineRouterProviderError("AI provider returned an empty response after 2 attempts.", 502);
      }

      if (options.jsonMode) {
        try {
          parseJsonObject(text);
        } catch {
          if (attempt === 1) continue;
          const finishReason = choice?.finish_reason || "unknown";
          throw new Error(
            `AI provider did not return valid JSON after 2 attempts (finish_reason: ${finishReason}, response_chars: ${text.length}).`,
          );
        }
      }

      return text;
    }

    throw new NineRouterProviderError("AI provider request failed after 2 attempts.", 502);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (!timedOut && options.signal?.aborted) throw new NineRouterAbortError();
      throw new NineRouterTimeoutError(`AI provider timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    if (error instanceof NineRouterProviderError || error instanceof NineRouterTimeoutError || error instanceof NineRouterAbortError) {
      throw error;
    }
    throw new NineRouterProviderError(errorMessage(error), 502);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function nineRouterCompletion(
  prompt: string,
  options: { jsonMode?: boolean; maxTokens?: number; signal?: AbortSignal } = {},
) {
  return nineRouterChatCompletion([{ role: "user", content: prompt }], options);
}

