import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestConnectorResult, incrementalWindow, getDefaultPipelineStore, monthlyBackfillWindows, type SyncMode } from "@/lib/data-pipeline";
import { enrichConnectorCreativeContentHashes, normalizeGoogleAdsRows, normalizeLinkedInRows, normalizeYouTubeAnalyticsRows } from "@/lib/connector-adapters";
import { fetchConnectorRows } from "@/lib/connector-adapters";
import { connectorProviderForPlatform } from "@/lib/connectors";
import { requireConnectorSessionAccessToken } from "@/lib/interactive-connector-auth";
import { sessionErrorStatus } from "@/lib/session";

const bodySchema = z.object({
  platform: z.enum(["google_ads", "youtube", "linkedin"]),
  mode: z.enum(["incremental", "full", "backfill"]).default("incremental"),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  rows: z.array(z.unknown()).max(100_000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const now = new Date();
    const fallbackWindow = body.mode === "backfill" ? monthlyBackfillWindows(now, 1)[0] : incrementalWindow(now);
    const window = { since: body.since || fallbackWindow.since, until: body.until || fallbackWindow.until };
    const accessToken = await requireConnectorSessionAccessToken(
      request,
      connectorProviderForPlatform(body.platform),
    );
    let rows: unknown[];
    if (body.rows) {
      rows = body.rows;
    } else {
      rows = await fetchConnectorRows({ platform: body.platform, accessToken, since: window.since, until: window.until });
    }
    const normalized = body.platform === "google_ads"
      ? normalizeGoogleAdsRows(rows, window.until)
      : body.platform === "youtube"
        ? normalizeYouTubeAnalyticsRows(rows, window.until)
        : normalizeLinkedInRows(rows, window.until);
    const result = body.rows
      ? normalized
      : await enrichConnectorCreativeContentHashes({ result: normalized });
    const job = await ingestConnectorResult(getDefaultPipelineStore(), { result, mode: body.mode as SyncMode, window });
    return NextResponse.json({ job, result: { rowCount: result.rows.length, creativeCount: result.creatives.length, warnings: result.warnings } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sync connector data." }, { status: sessionErrorStatus(error) });
  }
}
