import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDefaultExperimentLogStore,
  saveStoredExperiment,
  searchStoredExperiments,
} from "@/lib/experiment-log-store";

const definition = z.object({
  id: z.string(),
  hypothesis: z.string(),
  metric: z.enum(["cpa", "roas", "ctr", "conversion_rate", "cost_per_lead"]),
  baselineRate: z.number(),
  baselineStandardDeviation: z.number().positive().optional(),
  minimumDetectableEffect: z.number(),
  confidence: z.number(),
  power: z.number(),
  trafficAllocation: z.number(),
  assignmentUnit: z.enum(["user", "geo"]),
  guardrails: z.array(z.string()),
  layer: z.string(),
});
const result = z.object({
  metric: z.enum(["cpa", "roas", "ctr", "conversion_rate", "cost_per_lead"]),
  metricFamily: z.enum(["binary", "continuous"]),
  metricDirection: z.enum(["higher", "lower"]),
  lift: z.number(),
  confidenceInterval: z.tuple([z.number(), z.number()]),
  pValue: z.number(),
  sampleSize: z.number(),
  segments: z.array(
    z.object({
      segment: z.string(),
      controlValue: z.number(),
      treatmentValue: z.number(),
      lift: z.number(),
      samples: z.number(),
    }),
  ),
  recommendation: z.enum(["ship", "kill", "iterate"]),
});

export async function GET(request: Request) {
  return NextResponse.json({
    entries: await searchStoredExperiments(
      getDefaultExperimentLogStore(),
      new URL(request.url).searchParams.get("q") || "",
    ),
  });
}
export async function POST(request: Request) {
  try {
    const body = z
      .object({ definition, result: result.optional() })
      .parse(await request.json());
    return NextResponse.json({
      entry: await saveStoredExperiment(getDefaultExperimentLogStore(), body),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save experiment.",
      },
      { status: 400 },
    );
  }
}
