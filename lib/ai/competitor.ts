import type { CompetitorSpyResult, InterfaceLanguage } from "@/lib/types";
import { z } from "zod";
import { buildCompetitorSpyPayload, buildCompetitorSpyPrompt, type CompetitorSpyPromptArgs } from "@/lib/metrics";
import {
  errorMessage,
  hasNineRouterCredentials,
  nineRouterCompletion,
  parseJsonObject,
} from "@/lib/ai/transport";

export type GenerateCompetitorSpyInput = CompetitorSpyPromptArgs & {
  language?: InterfaceLanguage;
  provider?: "auto" | CompetitorSpyResult["provider"];
};

type CompetitorSpyPayload = ReturnType<typeof buildCompetitorSpyPayload>;

const competitorSchema = z.object({
  name: z.string(),
  likely_positioning: z.string(),
  observed_or_expected_patterns: z.array(z.string()),
  gap: z.string(),
});

const themeSchema = z.object({
  theme: z.string(),
  evidence: z.string(),
  evidence_ids: z.array(z.string()).max(12),
  opportunity: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const testBriefSchema = z.object({
  angle: z.string(),
  hook: z.string(),
  format: z.string(),
  why: z.string(),
  guardrail: z.string(),
});

const competitorSpyPayloadSchema = z.object({
  summary: z.string().min(1),
  competitors: z.array(competitorSchema),
  themes: z.array(themeSchema),
  creative_gaps: z.array(z.string()),
  test_briefs: z.array(testBriefSchema),
  next_actions: z.array(z.string()),
  assumptions: z.array(z.string()),
});

const recoverableCompetitorSpyPayloadSchema = z.object({
  summary: z.string().min(1).optional().catch(undefined),
  competitors: z.array(competitorSchema).optional().catch(undefined),
  themes: z.array(themeSchema.extend({
    evidence_ids: z.array(z.string()).max(12).default([]),
  })).optional().catch(undefined),
  creative_gaps: z.array(z.string()).optional().catch(undefined),
  test_briefs: z.array(testBriefSchema).optional().catch(undefined),
  next_actions: z.array(z.string()).optional().catch(undefined),
  assumptions: z.array(z.string()).optional().catch(undefined),
});

function competitorFallback(payload: CompetitorSpyPayload, prompt: string): CompetitorSpyResult {
  const competitors = payload.competitors;
  const notes = payload.pasted_ad_library_notes;
  const hasNotes = payload.manual_evidence.length > 0 || !notes.includes("No pasted");
  const hasExtractedAds = payload.extracted_ads.length > 0;
  const evidenceIds = [...payload.extracted_ads, ...payload.manual_evidence]
    .map((row) => row.evidence_id)
    .filter((value): value is string => Boolean(value))
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
        ? ["Open Meta Ad Library links from fetched cards.", "Paste notable hooks/offers into notes if live scraping is thin.", "Generate again with the AI assistant when a provider key is available for deeper synthesis."]
        : ["Recheck the pasted evidence against the live Meta Ad Library before using it in a brief.", "Add landing-page or CTA details that materially change the offer interpretation.", "Generate again with the AI assistant when a provider key is available for deeper synthesis."],
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
        evidence_ids: [],
        opportunity: "Configure the AI provider key, then regenerate the competitor analysis.",
        confidence: "high",
      },
    ],
    creative_gaps: ["Live AI competitor interpretation unavailable in prompt-only mode."],
    test_briefs: [],
    next_actions: ["Paste competitor ad-library notes into the panel and regenerate after adding an AI provider key."],
    assumptions: ["The AI provider key is missing from the server environment."],
  };
}

function parseCompetitorSpy(text: string, provider: CompetitorSpyResult["provider"], payload: CompetitorSpyPayload, prompt: string): CompetitorSpyResult {
  const json = parseJsonObject(text);
  const strictResult = competitorSpyPayloadSchema.safeParse(json);
  const recovered = recoverableCompetitorSpyPayloadSchema.parse(json);
  const fallback = competitorFallback(payload, prompt);
  const allowedEvidenceIds = new Set(payload.available_evidence_ids);
  const themes = (recovered.themes ?? fallback.themes).map((theme) => ({
    ...theme,
    evidence_ids: theme.evidence_ids.filter((id) => allowedEvidenceIds.has(id)),
  }));
  const recoveryAssumption = strictResult.success
    ? []
    : ["The AI assistant returned partial structured output; missing or invalid sections were filled from the deterministic verified-evidence brief."];

  if (!strictResult.success) {
    console.warn("[competitor-ai] Recovered partial structured output", {
      provider,
      responseChars: text.length,
      issuePaths: Array.from(new Set(strictResult.error.issues.map((issue) => issue.path.join(".") || "root"))),
    });
  }

  return {
    summary: recovered.summary ?? fallback.summary,
    competitors: recovered.competitors ?? fallback.competitors,
    themes,
    creative_gaps: recovered.creative_gaps ?? fallback.creative_gaps,
    test_briefs: recovered.test_briefs ?? fallback.test_briefs,
    next_actions: recovered.next_actions ?? fallback.next_actions,
    assumptions: Array.from(new Set([
      ...(recovered.assumptions ?? []),
      ...recoveryAssumption,
    ])),
    provider,
  };
}

export async function generateCompetitorSpy(input: GenerateCompetitorSpyInput): Promise<CompetitorSpyResult> {
  const payload = buildCompetitorSpyPayload(input);
  const prompt = buildCompetitorSpyPrompt(input);
  if (input.provider === "prompt" || !hasNineRouterCredentials()) return competitorFallback(payload, prompt);
  try {
    return parseCompetitorSpy(await nineRouterCompletion(prompt, { jsonMode: true, maxTokens: 1800 }), "9router", payload, prompt);
  } catch (error) {
    return {
      ...competitorFallback(payload, prompt),
      summary: `The AI assistant could not complete the competitor analysis; prompt-only output returned. ${errorMessage(error)}`,
      assumptions: [`The AI assistant failed; prompt-only output returned. ${errorMessage(error)}`],
    };
  }
}
