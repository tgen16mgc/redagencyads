import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTikTokAdLibrary } from "@/lib/tiktok";
import { certifyTikTokAcceptanceEvidence } from "@/lib/tiktok-acceptance";

export const runtime = "nodejs";
export const maxDuration = 300;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const bodySchema = z.object({
  region: z.string().min(2).max(8),
  queryType: z.enum(["1", "2", "url"]),
  query: z.string().min(1),
  startDate: dateSchema,
  endDate: dateSchema,
  maxAds: z.number().int().min(1).max(500).default(20),
  fetchDetails: z.boolean().default(false),
  format: z.string().max(80).optional(),
  objective: z.string().max(120).optional(),
  industry: z.string().max(120).optional(),
  performanceTier: z.enum(["top", "strong", "standard"]).optional(),
}).refine((body) => !body.startDate || !body.endDate || body.startDate <= body.endDate, {
  message: "startDate must be on or before endDate.",
  path: ["endDate"],
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const report = await fetchTikTokAdLibrary(body);
    const evidenceRecording = await certifyTikTokAcceptanceEvidence(request, {
      ingestion: {
        measuredAt: report.pulledAt,
        actorId: report.actorId,
        officialFeedUsed:
          report.actorId === "tiktok-commercial-content-library",
        pipelineDurationMs: report.pipelineDurationMs || 0,
        normalizationDurationMs: report.normalizationDurationMs || 0,
        normalizedWithin15Minutes: Boolean(
          report.acceptance?.normalizedWithin15Minutes,
        ),
      },
    });
    return NextResponse.json({ report, evidenceRecording });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch TikTok Ad Library rows." },
      { status: 400 },
    );
  }
}
