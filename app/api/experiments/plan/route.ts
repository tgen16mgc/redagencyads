import { NextResponse } from "next/server";
import { z } from "zod";
import { buildExperimentPlan } from "@/lib/experiment-engine";

const definitionSchema = z.object({
  id: z.string().min(1).max(120),
  hypothesis: z.string().min(1).max(1000),
  metric: z.enum(["cpa", "roas", "ctr", "conversion_rate", "cost_per_lead"]),
  baselineRate: z.number().finite().nonnegative(),
  baselineStandardDeviation: z.number().finite().positive().optional(),
  minimumDetectableEffect: z.number().finite().positive(),
  confidence: z.number().finite().gt(0.5).lt(1),
  power: z.number().finite().gt(0.5).lt(1),
  trafficAllocation: z.number().finite().positive().lte(1),
  assignmentUnit: z.enum(["user", "geo"]),
  guardrails: z.array(z.string().max(240)).max(12),
  layer: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      definition?: unknown;
      observedDailyEligibleUsers?: unknown;
    };
    const definition = definitionSchema.parse(body.definition);
    const observedDailyEligibleUsers =
      body.observedDailyEligibleUsers === undefined
        ? undefined
        : z.number().finite().positive().parse(body.observedDailyEligibleUsers);
    return NextResponse.json({
      plan: buildExperimentPlan(definition, observedDailyEligibleUsers),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build experiment plan.",
      },
      { status: 400 },
    );
  }
}
