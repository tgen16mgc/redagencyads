import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeHookRetention, copyVariantContribution, correlateAudioPerformance, correlateCreativeElements, detectSevenDayFatigue, inferAudioClassification, inferCreativeElements, readCreativeAssetMedia } from "@/lib/creative-dam";
import { recordAutomaticDecisionWorkspaceAcceptanceEvidence } from "@/lib/decision-workspace-acceptance";

const bodySchema = z.discriminatedUnion("analysis", [
  z.object({ analysis: z.literal("hook"), curve: z.array(z.object({ second: z.number().finite().nonnegative(), retention: z.number().finite().min(0).max(1) })).min(2).max(200) }),
  z.object({ analysis: z.literal("fatigue"), frequency: z.number().finite().nonnegative(), currentRoas: z.number().finite().nonnegative(), previousRoas: z.number().finite().nonnegative() }),
  z.object({ analysis: z.literal("elements"), assetId: z.string().max(160).optional(), transcript: z.string().max(20_000).optional(), detectedLabels: z.array(z.string().max(120)).max(100).optional(), hasFace: z.boolean().optional(), hasTextOverlay: z.boolean().optional(), hasCta: z.boolean().optional() }),
  z.object({ analysis: z.literal("audio"), assetId: z.string().max(160).optional(), bpm: z.number().finite().nonnegative().optional(), transcript: z.string().max(20_000).optional(), speechRatio: z.number().finite().min(0).max(1).optional(), energy: z.number().finite().min(0).max(1).optional() }),
  z.object({ analysis: z.literal("copy"), variants: z.array(z.object({ id: z.string(), headline: z.string().optional(), primaryText: z.string().optional(), cta: z.string().optional(), impressions: z.number().finite().nonnegative(), clicks: z.number().finite().nonnegative(), conversions: z.number().finite().nonnegative() })).min(2).max(100) }),
  z.object({ analysis: z.literal("element_correlation"), samples: z.array(z.object({ tags: z.array(z.string()), impressions: z.number().nonnegative(), clicks: z.number().nonnegative(), conversions: z.number().nonnegative() })).min(2).max(10000) }),
  z.object({ analysis: z.literal("audio_correlation"), samples: z.array(z.object({ classification: z.object({ mood: z.string(), tempo: z.string(), mode: z.string(), speechRatio: z.number() }), impressions: z.number().nonnegative(), clicks: z.number().nonnegative(), conversions: z.number().nonnegative() })).min(2).max(10000) }),
]);

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const media = (body.analysis === "elements" || body.analysis === "audio") && body.assetId ? await readCreativeAssetMedia(body.assetId) : undefined;
    const inference = body.analysis === "elements" ? await inferCreativeElements({ ...body, media })
      : body.analysis === "audio" ? await inferAudioClassification({ ...body, media })
        : undefined;
    const result = body.analysis === "hook" ? analyzeHookRetention(body.curve)
      : body.analysis === "fatigue" ? detectSevenDayFatigue(body)
        : body.analysis === "elements" || body.analysis === "audio" ? inference?.result
            : body.analysis === "copy" ? copyVariantContribution(body.variants)
              : body.analysis === "element_correlation" ? correlateCreativeElements(body.samples)
                : correlateAudioPerformance(body.samples as Parameters<typeof correlateAudioPerformance>[0]);
    const requirementId = body.analysis === "elements"
      ? "T3.3.2" as const
      : body.analysis === "audio"
        ? "T3.3.4" as const
        : undefined;
    const assetId = body.analysis === "elements" || body.analysis === "audio"
      ? body.assetId
      : undefined;
    const evidence = requirementId && inference?.source === "provider"
      ? await recordAutomaticDecisionWorkspaceAcceptanceEvidence({
          requirementId,
          measuredAt: new Date().toISOString(),
          acceptanceMet: true,
          summary: `Provider-backed ${inference.model} ${body.analysis} inference completed${assetId ? ` for asset ${assetId}` : ""}.`,
          runId: `creative-${body.analysis}:${assetId || "inline"}:${Date.now()}`,
          requestOrigin: new URL(request.url).origin,
        })
      : undefined;
    return NextResponse.json({ result, source: inference?.source, model: inference?.model, warning: inference?.warning, evidence });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to analyze creative." }, { status: 400 });
  }
}
