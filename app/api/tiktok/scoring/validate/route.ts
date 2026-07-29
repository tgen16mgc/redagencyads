import { NextResponse } from "next/server";
import { z } from "zod";
import { certifyTikTokAcceptanceEvidence } from "@/lib/tiktok-acceptance";
import { scoreCpaCorrelation } from "@/lib/tiktok-watchlist";

const schema = z.object({
  samples: z
    .array(
      z.object({
        score: z.number().min(0).max(100),
        cpa: z.number().nonnegative(),
        observedAt: z.string().datetime({ offset: true }),
      }),
    )
    .min(3)
    .max(10000),
});

export async function POST(request: Request) {
  try {
    const validation = scoreCpaCorrelation(
      schema.parse(await request.json()).samples,
    );
    const evidenceRecording = await certifyTikTokAcceptanceEvidence(request, {
      scoring: {
        measuredAt: new Date().toISOString(),
        ...validation,
      },
    });
    return NextResponse.json({ validation, evidenceRecording });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to validate creative score.",
      },
      { status: 400 },
    );
  }
}
