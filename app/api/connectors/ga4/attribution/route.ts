import { NextResponse } from "next/server";
import { fetchGa4DataDrivenAttribution } from "@/lib/ga4-attribution";
import { recordAutomaticDecisionWorkspaceAcceptanceEvidence } from "@/lib/decision-workspace-acceptance";
import { getGoogleConnectorAccessToken } from "@/lib/google-connector-auth";
import { sessionErrorStatus } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured.");
    const body = (await request.json()) as { since?: string; until?: string };
    if (!body.since || !body.until)
      throw new Error("GA4 attribution requires since and until dates.");
    const accessToken = await getGoogleConnectorAccessToken(request);
    const attribution = await fetchGa4DataDrivenAttribution({
      accessToken,
      propertyId,
      since: body.since,
      until: body.until,
    });
    const evidence = await recordAutomaticDecisionWorkspaceAcceptanceEvidence({
      requirementId: "T2.2.3",
      measuredAt: new Date().toISOString(),
      acceptanceMet: true,
      summary: `GA4 property ${attribution.propertyId} verified ${attribution.reportingAttributionModel} attribution for ${body.since} through ${body.until}.`,
      runId: `ga4:${attribution.propertyId}:${body.since}:${body.until}`,
      requestOrigin: new URL(request.url).origin,
    });
    return NextResponse.json({ attribution, evidence });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load GA4 attribution.",
      },
      { status: sessionErrorStatus(error) },
    );
  }
}
