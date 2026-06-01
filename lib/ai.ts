import type { AiInsightTable, AiVerdict } from "@/lib/types";

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
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "http-referer": process.env.OPENROUTER_SITE_URL || "https://meta-ads-dashboard.vercel.app",
        "x-title": "Meta Ads Analysis Dashboard",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "OpenRouter verdict request failed.");
    return parseVerdict(json.choices?.[0]?.message?.content || "", "openrouter");
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
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "http-referer": process.env.OPENROUTER_SITE_URL || "https://meta-ads-dashboard.vercel.app",
        "x-title": "Red Agency Ads Tool",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "OpenRouter insights request failed.");
    return parseInsights(json.choices?.[0]?.message?.content || "", "openrouter");
  }
  return insightFallback(prompt);
}
