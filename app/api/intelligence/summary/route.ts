import { NextResponse } from "next/server";
import { buildCrossChannelSnapshot } from "@/lib/cross-channel";
import { getDefaultPipelineStore } from "@/lib/data-pipeline";
import { fetchGa4DataDrivenAttribution } from "@/lib/ga4-attribution";
import { getGoogleConnectorAccessToken } from "@/lib/google-connector-auth";
import type { DashboardReport, TikTokLibraryReport } from "@/lib/types";

function snapshotDateRange(
  metaReport: DashboardReport | null | undefined,
  pipelineDates: string[],
) {
  if (metaReport?.dateRange.since && metaReport.dateRange.until)
    return metaReport.dateRange;
  const dates = pipelineDates.filter(Boolean).sort();
  if (dates.length) return { since: dates[0], until: dates.at(-1)! };
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - 29);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      metaReport?: DashboardReport | null;
      tiktokReport?: TikTokLibraryReport | null;
      previousRows?: Parameters<
        typeof buildCrossChannelSnapshot
      >[0]["previousRows"];
      attributionModel?: Parameters<
        typeof buildCrossChannelSnapshot
      >[0]["attributionModel"];
      customAttributionWeights?: Parameters<
        typeof buildCrossChannelSnapshot
      >[0]["customAttributionWeights"];
      ltv?: number;
    };
    const pipeline = await getDefaultPipelineStore().read();
    let dataDrivenAttribution: Parameters<
      typeof buildCrossChannelSnapshot
    >[0]["dataDrivenAttribution"];
    let dataDrivenAttributionWarning: string | undefined;
    if (body.attributionModel === "data_driven") {
      try {
        const propertyId = process.env.GA4_PROPERTY_ID;
        if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured.");
        const accessToken = await getGoogleConnectorAccessToken(request);
        const dateRange = snapshotDateRange(
          body.metaReport,
          pipeline.performanceRows.map((row) => row.date),
        );
        dataDrivenAttribution = await fetchGa4DataDrivenAttribution({
          accessToken,
          propertyId,
          ...dateRange,
        });
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : "GA4 attribution is unavailable.";
        dataDrivenAttributionWarning = `GA4 data-driven attribution is unavailable (${detail}); last-click values are shown.`;
      }
    }
    const snapshot = buildCrossChannelSnapshot({
      metaReport: body.metaReport,
      tiktokReport: body.tiktokReport,
      connectorPerformanceRows: pipeline.performanceRows,
      connectorCreativeRows: pipeline.creativeRows,
      previousRows: body.previousRows,
      attributionModel: body.attributionModel,
      customAttributionWeights: body.customAttributionWeights,
      dataDrivenAttribution,
      dataDrivenAttributionWarning,
      ltv: body.ltv,
    });
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build cross-channel snapshot.",
      },
      { status: 400 },
    );
  }
}
