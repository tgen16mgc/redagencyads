import { NextResponse } from "next/server";
import { z } from "zod";
import { monthlyBackfillWindows } from "@/lib/data-pipeline";
import { connectorProviderForPlatform } from "@/lib/connectors";
import { requireConnectorSessionAccessToken } from "@/lib/interactive-connector-auth";
import { sessionErrorStatus } from "@/lib/session";
import { runConnectorBackfill } from "@/lib/sync-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({ platform: z.enum(["google_ads", "youtube", "linkedin"]), months: z.number().int().min(1).max(13).default(13), execute: z.boolean().default(true) });

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const windows = monthlyBackfillWindows(new Date(), body.months);
    if (!body.execute) return NextResponse.json({ platform: body.platform, windows, status: "planned", message: "Backfill windows are ready for idempotent connector ingestion." });
    const accessToken = await requireConnectorSessionAccessToken(
      request,
      connectorProviderForPlatform(body.platform),
    );
    const result = await runConnectorBackfill({ platform: body.platform, accessToken, months: body.months });
    return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to plan historical backfill." }, { status: sessionErrorStatus(error) });
  }
}
