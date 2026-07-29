import { NextResponse } from "next/server";
import {
  buildBacklogPlatformContracts,
  buildConnectorContracts,
  connectorEnvReadiness,
} from "@/lib/connectors";
import { hasTokenSession } from "@/lib/session";
import { cookies } from "next/headers";
import {
  connectorTokenNeedsRefresh,
  decryptConnectorToken,
} from "@/lib/connector-oauth";

export async function GET() {
  const readiness = connectorEnvReadiness();
  const store = await cookies();
  const googleSession = decryptConnectorToken(
    store.get("connector_token_google")?.value,
  );
  const linkedinSession = decryptConnectorToken(
    store.get("connector_token_linkedin")?.value,
  );
  const googleConnected = Boolean(
    googleSession &&
      googleSession.provider === "google" &&
      !connectorTokenNeedsRefresh(googleSession),
  );
  const linkedinConnected = Boolean(
    linkedinSession &&
      linkedinSession.provider === "linkedin" &&
      !connectorTokenNeedsRefresh(linkedinSession),
  );
  return NextResponse.json({
    connectors: buildConnectorContracts({
      metaAuthenticated: await hasTokenSession(),
      apifyConfigured: Boolean(process.env.APIFY_TOKEN),
      tiktokFeedConfigured: Boolean(
        process.env.TIKTOK_CCL_API_URL && process.env.TIKTOK_CCL_ACCESS_TOKEN,
      ),
      ...readiness,
      googleAdsConnected: googleConnected,
      youtubeConnected: googleConnected,
      ga4Connected: googleConnected,
      linkedinConnected,
    }),
    backlogPlatforms: buildBacklogPlatformContracts(),
    checkedAt: new Date().toISOString(),
  });
}
