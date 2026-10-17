import { z } from "zod";
import type { FunnelBriefDraft, FunnelObservation } from "@/lib/funnel-investigation";

const metricSchema = z.enum(["cpa", "cost_per_lead", "roas", "ctr", "conversion_rate"]);
const countSchema = z.enum(["impressions", "reach", "linkClicks", "messages", "replies", "leads", "purchases", "addToCart", "initiateCheckout", "frequency"]);
const amount = z.number().finite().nonnegative().nullable();
const dateRange = z.object({ since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const measure = z.object({ metric: countSchema, value: amount, denominatorKey: countSchema.nullable(), denominator: amount, rate: amount, cost: amount });

export const funnelHypothesisRequestSchema = z.object({
  language: z.enum(["en", "vi"]),
  preferredMetric: metricSchema,
  observation: z.object({
    source: z.enum(["sample", "meta_api"]),
    currency: z.string().regex(/^[A-Z]{3}$/),
    dates: dateRange,
    baselineDates: dateRange.nullable(),
    compareMode: z.enum(["off", "previous", "campaign", "wow", "mom", "yoy"]),
    stage: z.enum(["exposure", "reach", "impressions", "traffic", "cart", "checkout", "purchase", "lead", "conversations", "replies", "saturation"]),
    dimension: z.enum(["campaign", "adset", "ad", "platform", "region", "ageGender", "device"]),
    segment: z.object({ name: z.string().max(500) }).nullable(),
    current: measure,
    baseline: measure.nullable(),
    spend: amount.optional(),
    baselineSpend: amount.optional(),
  }),
});

export type FunnelHypothesisRequest = z.infer<typeof funnelHypothesisRequestSchema>;
export const funnelHypothesisOutputSchema = z.object({
  suggestions: z.array(z.object({
    hypothesis: z.string().trim().min(1).max(2000),
    change: z.string().trim().min(1).max(2000),
    metric: metricSchema,
    guardrails: z.string().trim().min(1).max(1000),
    evidenceIds: z.array(z.string().max(20)).min(1).max(4),
    missingEvidence: z.array(z.string().trim().min(1).max(500)).min(1).max(3),
  })).min(1).max(3),
});
export const funnelHypothesisResponseSchema = funnelHypothesisOutputSchema.extend({
  evidence: z.array(z.object({ id: z.string(), text: z.string() })).min(1).max(4),
  provider: z.enum(["openrouter", "9router"]),
});
export type FunnelHypothesisResponse = z.infer<typeof funnelHypothesisResponseSchema>;

// Send only the selected finding, never tokens, account IDs or the full report.
export function funnelHypothesisRequest(observation: FunnelObservation, language: "en" | "vi", preferredMetric: FunnelBriefDraft["metric"]): FunnelHypothesisRequest {
  return funnelHypothesisRequestSchema.parse({ observation, language, preferredMetric });
}
