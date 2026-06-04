import type { CompetitorSpyResult } from "@/lib/types";
import {
  OPENROUTER_COMPETITOR_MODEL_TIMEOUT_MS,
  errorMessage,
  geminiCompletion,
  openRouterCompletion,
  promptInputJson,
} from "@/lib/ai/transport";

function competitorFallback(prompt: string): CompetitorSpyResult {
  const payload = promptInputJson(prompt);
  const competitors = Array.isArray(payload?.competitors) ? payload.competitors.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  const extractedAds = Array.isArray(payload?.extracted_ads) ? payload.extracted_ads : [];
  const notes = typeof payload?.pasted_ad_library_notes === "string" ? payload.pasted_ad_library_notes : "";
  const evidenceCount = extractedAds.length + (notes && !notes.includes("No pasted") ? 1 : 0);
  const competitorRows = competitors.map((name) => ({
    name,
    likely_positioning: evidenceCount ? "Public ad-library evidence and notes available; inspect live ads before final creative decisions." : "Hypothesis only; no live ad evidence loaded yet.",
    observed_or_expected_patterns: evidenceCount
      ? ["Offer-led Meta ads", "Proof or consultation hook", "DM/contact CTA"]
      : ["Open public ad-library links to confirm active hooks, offers, and CTAs."],
    gap: "Create original proof-led tests with clearer local value prop and measurable CTA.",
  }));
  if (competitorRows.length) {
    return {
      provider: "prompt",
      summary: evidenceCount
        ? `Local competitor brief generated from ${competitorRows.length} competitor(s) and ${evidenceCount} evidence source(s).`
        : `Local competitor brief generated for ${competitorRows.length} competitor(s). Open public links to confirm live ads.`,
      competitors: competitorRows,
      themes: [
        {
          theme: evidenceCount ? "Offer and proof-led Meta positioning" : "Unverified competitor hypotheses",
          evidence: evidenceCount ? "Public links, extracted ad cards, or pasted ad-library notes are present in the prompt." : "Competitor names were provided without fetched ad evidence.",
          opportunity: "Turn observed hooks into original Meta tests, not copied competitor claims.",
          confidence: evidenceCount ? "medium" : "low",
        },
      ],
      creative_gaps: ["Benchmark competitor hooks against your actual offer, proof assets, and landing/DM flow.", "Avoid copying competitor copy; convert themes into original tests."],
      test_briefs: [
        {
          angle: "Proof-first consultation",
          hook: "Show the clearest result or pain point, then invite a low-friction consultation.",
          format: "UGC",
          why: "Competitor spy should turn market patterns into a distinct offer test.",
          guardrail: "Do not scale until cost per primary result and lead quality beat current account baseline.",
        },
      ],
      next_actions: ["Open Meta Ad Library links from fetched cards.", "Paste notable hooks/offers into notes if live scraping is thin.", "Generate again with Gemini/OpenAI when provider key is available for deeper synthesis."],
      assumptions: ["Local deterministic brief used because no live AI provider key was available.", evidenceCount ? "Evidence links or notes need human review before final claims." : "No live competitor ad evidence was available."],
    };
  }
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
