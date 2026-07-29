import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildContinuousExperimentResultDashboard,
  buildExperimentResultDashboard,
  evaluateContinuousMsprt,
  evaluateMsprt,
} from "@/lib/experiment-engine";

const binarySegment = z
  .object({
    segment: z.string(),
    controlSuccesses: z.number().nonnegative(),
    controlSamples: z.number().positive(),
    treatmentSuccesses: z.number().nonnegative(),
    treatmentSamples: z.number().positive(),
  })
  .superRefine((body, context) => {
    if (body.controlSuccesses > body.controlSamples)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["controlSuccesses"],
        message: "controlSuccesses cannot exceed controlSamples.",
      });
    if (body.treatmentSuccesses > body.treatmentSamples)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["treatmentSuccesses"],
        message: "treatmentSuccesses cannot exceed treatmentSamples.",
      });
  });
const continuousSegment = z.object({
  segment: z.string(),
  controlMean: z.number().finite(),
  controlStandardDeviation: z.number().positive(),
  controlSamples: z.number().int().positive(),
  treatmentMean: z.number().finite(),
  treatmentStandardDeviation: z.number().positive(),
  treatmentSamples: z.number().int().positive(),
});
const sequential = {
  relativeMde: z.number().positive().default(0.1),
  alpha: z.number().positive().max(0.5).optional(),
  beta: z.number().positive().max(0.5).optional(),
};
const binarySchema = z
  .object({
    metric: z.enum(["ctr", "conversion_rate"]),
    controlSuccesses: z.number().nonnegative(),
    controlSamples: z.number().positive(),
    treatmentSuccesses: z.number().nonnegative(),
    treatmentSamples: z.number().positive(),
    ...sequential,
    segments: z.array(binarySegment).max(100).optional(),
  })
  .superRefine((body, context) => {
    if (body.controlSuccesses > body.controlSamples)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["controlSuccesses"],
        message: "controlSuccesses cannot exceed controlSamples.",
      });
    if (body.treatmentSuccesses > body.treatmentSamples)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["treatmentSuccesses"],
        message: "treatmentSuccesses cannot exceed treatmentSamples.",
      });
  });
const continuousSchema = z.object({
  metric: z.enum(["cpa", "roas", "cost_per_lead"]),
  controlMean: z.number().finite(),
  controlStandardDeviation: z.number().positive(),
  controlSamples: z.number().int().positive(),
  treatmentMean: z.number().finite(),
  treatmentStandardDeviation: z.number().positive(),
  treatmentSamples: z.number().int().positive(),
  ...sequential,
  segments: z.array(continuousSegment).max(100).optional(),
});
const schema = z.union([binarySchema, continuousSchema]);

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if ("controlSuccesses" in body)
      return NextResponse.json({
        dashboard: buildExperimentResultDashboard(body),
        sequential: evaluateMsprt(body),
      });
    return NextResponse.json({
      dashboard: buildContinuousExperimentResultDashboard(body),
      sequential: evaluateContinuousMsprt(body),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to evaluate experiment.",
      },
      { status: 400 },
    );
  }
}
