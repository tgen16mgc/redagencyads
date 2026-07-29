import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateTikTokDeduplication } from "@/lib/tiktok";
import { certifyTikTokAcceptanceEvidence } from "@/lib/tiktok-acceptance";

const schema = z.object({
  samples: z
    .array(
      z.object({
        expectedCreativeId: z.string().min(1).max(240),
        row: z.record(z.unknown()),
      }),
    )
    .min(2)
    .max(2000),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const validation = evaluateTikTokDeduplication(body.samples);
    const evidenceRecording = await certifyTikTokAcceptanceEvidence(request, {
      deduplication: {
        measuredAt: new Date().toISOString(),
        sampleSize: validation.sampleSize,
        expectedUniqueCount: validation.expectedUniqueCount,
        predictedUniqueCount: validation.predictedUniqueCount,
        precision: validation.precision,
        recall: validation.recall,
        deduplicationAccuracy: validation.deduplicationAccuracy,
        acceptanceMet: validation.acceptanceMet,
      },
    });
    return NextResponse.json({
      validation,
      evidenceRecording,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to validate TikTok deduplication.",
      },
      { status: 400 },
    );
  }
}
