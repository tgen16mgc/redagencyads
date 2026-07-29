import { NextResponse } from "next/server";
import { z } from "zod";
import { validateCronRequest } from "@/lib/cron-auth";
import { resolveServerConnectorAccessToken } from "@/lib/server-connector-auth";
import { runConnectorBackfill } from "@/lib/sync-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  platform: z.enum(["google_ads", "youtube", "linkedin"]),
  months: z.number().int().min(1).max(13).default(13),
});

export async function POST(request: Request) {
  const auth = validateCronRequest(request);
  if (auth === "missing_secret") {
    return NextResponse.json(
      { error: "CRON_SECRET is required in production." },
      { status: 503 },
    );
  }
  if (auth === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = bodySchema.parse(await request.json());
    const accessToken = await resolveServerConnectorAccessToken({
      platform: body.platform,
    });
    if (!accessToken) {
      return NextResponse.json(
        { error: `${body.platform} server connector token is missing.` },
        { status: 503 },
      );
    }
    const result = await runConnectorBackfill({
      platform: body.platform,
      accessToken,
      months: body.months,
    });
    return NextResponse.json(result, {
      status: result.status === "failed" ? 502 : 200,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run connector backfill.",
      },
      { status: 400 },
    );
  }
}
