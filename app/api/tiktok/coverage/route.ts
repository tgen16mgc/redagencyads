import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTikTokAdLibrary } from "@/lib/tiktok";
import { certifyTikTokAcceptanceEvidence } from "@/lib/tiktok-acceptance";
import { advertiserCoverage } from "@/lib/tiktok-watchlist";

const schema = z.object({ handles: z.array(z.string().min(1).max(120)).min(1).max(100), region: z.string().min(2).max(8).default("VN") });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const results = await Promise.all(
      body.handles.map(async (handle) => {
        try {
          const report = await fetchTikTokAdLibrary({
            region: body.region,
            queryType: "1",
            query: handle,
            maxAds: 5,
            fetchDetails: false,
          });
          return {
            handle,
            matched: Boolean(
              report.matchedAdvertisers && report.matchedAdvertisers > 0,
            ),
            actorId: report.actorId,
          };
        } catch {
          return { handle, matched: false, actorId: "unavailable" };
        }
      }),
    );
    const coverage = advertiserCoverage(results);
    const sourceActorIds = Array.from(
      new Set(results.map((result) => result.actorId)),
    );
    const evidenceRecording = await certifyTikTokAcceptanceEvidence(request, {
      coverage: {
        measuredAt: new Date().toISOString(),
        region: body.region,
        ...coverage,
        officialFeedUsed:
          sourceActorIds.length === 1 &&
          sourceActorIds[0] === "tiktok-commercial-content-library",
        sourceActorIds,
      },
    });
    return NextResponse.json({ coverage, results, evidenceRecording });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to measure advertiser coverage." }, { status: 400 }); }
}
