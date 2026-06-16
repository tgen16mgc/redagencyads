import type { CompetitorSpyResult } from "@/lib/types";
import {
  errorMessage,
  hasNineRouterCredentials,
  nineRouterCompletion,
  parseJsonObject,
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
      next_actions: ["Open Meta Ad Library links from fetched cards.", "Paste notable hooks/offers into notes if live scraping is thin.", "Generate again with 9router when provider key is available for deeper synthesis."],
      assumptions: ["Local deterministic brief used because no live 9router key was available.", evidenceCount ? "Evidence links or notes need human review before final claims." : "No live competitor ad evidence was available."],
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
        opportunity: "Add NINEROUTER_KEY, then regenerate competitor spy output.",
        confidence: "high",
      },
    ],
    creative_gaps: ["Live AI competitor interpretation unavailable in prompt-only mode."],
    test_briefs: [],
    next_actions: ["Paste competitor ad-library notes into the panel and regenerate after adding an AI provider key."],
    assumptions: ["NINEROUTER_KEY missing in server environment."],
  };
}

function parseCompetitorSpy(text: string, provider: CompetitorSpyResult["provider"]): CompetitorSpyResult {
  try {
    return { ...parseJsonObject(text), provider } as CompetitorSpyResult;
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
  if ((provider === "9router" || provider === "auto") && hasNineRouterCredentials()) {
    try {
      return parseCompetitorSpy(await nineRouterCompletion(prompt, { jsonMode: true, maxTokens: 1800 }), "9router");
    } catch (error) {
      return {
        ...competitorFallback(prompt),
        summary: `9router competitor spy failed; prompt-only output returned. ${errorMessage(error)}`,
        assumptions: [`9router failed; prompt-only output returned. ${errorMessage(error)}`],
      };
    }
  }
  return competitorFallback(prompt);
}
