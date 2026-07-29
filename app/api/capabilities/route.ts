import { NextResponse } from "next/server";
import { hasNineRouterCredentials } from "@/lib/ai/transport";
import {
  buildCapabilitySnapshot,
  isFacebookOAuthConfigured,
} from "@/lib/capabilities";
import { connectorEnvReadiness } from "@/lib/connectors";
import { hasTokenSession } from "@/lib/session";

export async function GET() {
  const authenticated = await hasTokenSession();
  const connectorReadiness = connectorEnvReadiness();
  const capabilities = buildCapabilitySnapshot({
    authenticated,
    apifyConfigured: Boolean(process.env.APIFY_TOKEN),
    competitorActorConfigured: Boolean(process.env.APIFY_META_ADS_ACTOR_ID),
    tiktokAdLibraryConfigured: Boolean(
      process.env.TIKTOK_CCL_API_URL && process.env.TIKTOK_CCL_ACCESS_TOKEN,
    ),
    nineRouterConfigured: hasNineRouterCredentials(),
    ...connectorReadiness,
  });

  return NextResponse.json({
    capabilities,
    facebookOAuthConfigured: isFacebookOAuthConfigured({
      appId: process.env.META_APP_ID,
      appSecret: process.env.META_APP_SECRET,
      loginConfigId: process.env.META_LOGIN_CONFIG_ID,
    }),
    checkedAt: new Date().toISOString(),
  });
}
