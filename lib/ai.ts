import type { AiInsightTable, AiVerdict } from "@/lib/types";

const OPENROUTER_FREE_MODELS = [
  "moonshotai/kimi-k2.6:free",
  "openrouter/owl-alpha",
  "nvidia/nemotron-3-super-120b-a12b:free",
] as const;

const OPENROUTER_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_MODEL_TIMEOUT_MS || 30000);

function openRouterModels() {
  const requested = process.env.OPENROUTER_MODEL;
  const kimi = OPENROUTER_FREE_MODELS[0];
  if (requested && requested !== kimi && OPENROUTER_FREE_MODELS.includes(requested as (typeof OPENROUTER_FREE_MODELS)[number])) {
    return [kimi, requested, ...OPENROUTER_FREE_MODELS.filter((model) => model !== kimi && model !== requested)];
  }
  return [...OPENROUTER_FREE_MODELS];
}

async function openRouterCompletion(prompt: string) {
  const errors: string[] = [];
  for (const model of openRouterModels()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENROUTER_MODEL_TIMEOUT_MS);
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
          response_format: { type: "json_object" },
        }),
      });
      const json = await response.json();
      if (response.ok) return json.choices?.[0]?.message?.content || "";
      errors.push(`${model}: ${json?.error?.message || response.status}`);
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError" ? `timed out after ${Math.round(OPENROUTER_MODEL_TIMEOUT_MS / 1000)}s` : error instanceof Error ? error.message : "request failed";
      errors.push(`${model}: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`OpenRouter free model request failed. ${errors.join(" | ")}`);
}

function fallback(prompt: string): AiVerdict {
  return {
    provider: "prompt",
    verdict: "AI provider key not configured. Use the generated prompt fallback for manual analysis.",
    risks: ["No live AI verdict was generated."],
    winners: [],
    losers: [],
    budget_moves: [],
    tests: [],
    confidence: "low",
    assumptions: ["OPENAI_API_KEY or OPENROUTER_API_KEY missing in server environment.", `Prompt length: ${prompt.length} chars.`],
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
    return parseVerdict(await openRouterCompletion(prompt), "openrouter");
  }
  return fallback(prompt);
}

function insightFallback(prompt: string): AiInsightTable {
  return {
    provider: "prompt",
    summary: "AI provider key not configured. Copy prompt fallback and run manually.",
    rows: [
      {
        area: "Setup",
        insight: "Live AI insight table unavailable.",
        evidence: `Prompt ready with ${prompt.length} chars.`,
        action: "Add OPENAI_API_KEY or OPENROUTER_API_KEY on server, then regenerate insights.",
        priority: "medium",
        confidence: "high",
      },
    ],
    confidence: "low",
    assumptions: ["OPENAI_API_KEY or OPENROUTER_API_KEY missing in server environment."],
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
    return parseInsights(await openRouterCompletion(prompt), "openrouter");
  }
  return insightFallback(prompt);
}
