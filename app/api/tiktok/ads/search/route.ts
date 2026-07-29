import { NextResponse } from "next/server";
import { z } from "zod";
import { creativeSearchBenchmark, type CreativeSearchFilters } from "@/lib/creative-search";
import { certifyTikTokAcceptanceEvidence } from "@/lib/tiktok-acceptance";
import type { TikTokAdLibraryRow } from "@/lib/types";

const row = z.object({ id: z.string(), advertiserName: z.string().optional(), adTitle: z.string().optional(), caption: z.string().optional(), cta: z.string().optional(), landingUrl: z.string().optional(), firstSeen: z.string().optional(), lastSeen: z.string().optional(), format: z.enum(["video", "image", "unknown"]).optional(), objective: z.string().optional(), industry: z.string().optional(), performanceTier: z.enum(["top", "strong", "standard", "unknown"]).optional() }).passthrough();
const schema = z.object({ rows: z.array(row).max(100_000), filters: z.object({ keyword: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional(), format: z.enum(["video", "image", "unknown"]).optional(), objective: z.string().optional(), industry: z.string().optional(), performanceTier: z.enum(["top", "strong", "standard", "unknown"]).optional() }).default({}) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const benchmark = creativeSearchBenchmark(body.rows as TikTokAdLibraryRow[], body.filters as CreativeSearchFilters);
    const evidenceRecording = await certifyTikTokAcceptanceEvidence(request, {
      search: {
        measuredAt: new Date().toISOString(),
        recordCount: benchmark.recordCount,
        resultCount: benchmark.results.length,
        durationMs: benchmark.durationMs,
        acceptanceMet: benchmark.acceptanceMet,
      },
    });
    return NextResponse.json({ ...benchmark, evidenceRecording });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to search creative catalog." }, { status: 400 }); }
}
