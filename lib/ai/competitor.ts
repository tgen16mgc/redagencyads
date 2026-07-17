import type { CompetitorSpyResult } from "@/lib/types";
import { z } from "zod";
import {
  errorMessage,
  hasNineRouterCredentials,
  nineRouterCompletion,
  parseJsonObject,
  promptInputJson,
} from "@/lib/ai/transport";

const competitorSpyPayloadSchema = z.object({
  summary: z.string().min(1),
  competitors: z.array(z.object({
    name: z.string(),
    likely_positioning: z.string(),
    observed_or_expected_patterns: z.array(z.string()),
    gap: z.string(),
  })),
  themes: z.array(z.object({
    theme: z.string(),
    evidence: z.string(),
    evidence_ids: z.array(z.string()).max(12),
    opportunity: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
  })),
  creative_gaps: z.array(z.string()),
  test_briefs: z.array(z.object({
    angle: z.string(),
    hook: z.string(),
    format: z.string(),
    why: z.string(),
    guardrail: z.string(),
  })),
  next_actions: z.array(z.string()),
  assumptions: z.array(z.string()),
});

function competitorFallback(prompt: string): CompetitorSpyResult {
  const payload = promptInputJson(prompt);
  const competitors = Array.isArray(payload?.competitors) ? payload.competitors.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  const extractedAds = Array.isArray(payload?.extracted_ads) ? payload.extracted_ads : [];
  const manualEvidence = Array.isArray(payload?.manual_evidence) ? payload.manual_evidence : [];
  const notes = typeof payload?.pasted_ad_library_notes === "string" ? payload.pasted_ad_library_notes : "";
  const hasNotes = manualEvidence.length > 0 || Boolean(notes && !notes.includes("No pasted"));
  const hasExtractedAds = extractedAds.length > 0;
  const evidenceIds = [...extractedAds, ...manualEvidence]
    .map((row) => row && typeof row === "object" && "evidence_id" in row ? row.evidence_id : undefined)
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .slice(0, 12);
  const evidenceCount = evidenceIds.length;
  const competitorRows = competitors.map((name) => ({
    name,
    likely_positioning: hasExtractedAds
      ? "Extracted ad evidence and notes are available; inspect live ads before final creative decisions."
      : hasNotes
        ? "Positioning inferred from the verified ad-library notes supplied for this analysis."
        : "Hypothesis only; no live ad evidence loaded yet.",
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
          evidence: hasExtractedAds
            ? "Extracted ad cards and pasted ad-library notes are present in the prompt."
            : hasNotes
              ? "Verified ad-library notes are present in the prompt."
              : "Competitor names were provided without ad evidence.",
          evidence_ids: evidenceIds,
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
      next_actions: hasExtractedAds
        ? ["Open Meta Ad Library links from fetched cards.", "Paste notable hooks/offers into notes if live scraping is thin.", "Generate again with 9router when provider key is available for deeper synthesis."]
        : ["Recheck the pasted evidence against the live Meta Ad Library before using it in a brief.", "Add landing-page or CTA details that materially change the offer interpretation.", "Generate again with 9router when provider key is available for deeper synthesis."],
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
        evidence_ids: [],
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

function parseCompetitorSpy(text: string, provider: CompetitorSpyResult["provider"], prompt: string): CompetitorSpyResult {
  try {
    const parsed = competitorSpyPayloadSchema.parse(parseJsonObject(text));
    const payload = promptInputJson(prompt);
    const allowedEvidenceIds = new Set(
      Array.isArray(payload?.available_evidence_ids)
        ? payload.available_evidence_ids.filter((value): value is string => typeof value === "string")
        : [],
    );
    return {
      ...parsed,
      themes: parsed.themes.map((theme) => ({
        ...theme,
        evidence_ids: theme.evidence_ids.filter((id) => allowedEvidenceIds.has(id)),
      })),
      provider,
    };
  } catch {
    return {
      provider,
      summary: "Model returned non-JSON output.",
      competitors: [],
      themes: [
        {
          theme: "AI output",
          evidence: text.slice(0, 220),
          evidence_ids: [],
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
      return parseCompetitorSpy(await nineRouterCompletion(prompt, { jsonMode: true, maxTokens: 1800 }), "9router", prompt);
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
