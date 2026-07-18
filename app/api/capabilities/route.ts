import { NextResponse } from "next/server";
import { hasNineRouterCredentials } from "@/lib/ai/transport";
import { buildCapabilitySnapshot, isFacebookOAuthConfigured } from "@/lib/capabilities";
import { hasTokenSession } from "@/lib/session";

export async function GET() {
  const authenticated = await hasTokenSession();
  const capabilities = buildCapabilitySnapshot({
    authenticated,
    apifyConfigured: Boolean(process.env.APIFY_TOKEN),
    competitorActorConfigured: Boolean(process.env.APIFY_META_ADS_ACTOR_ID),
    nineRouterConfigured: hasNineRouterCredentials(),
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
