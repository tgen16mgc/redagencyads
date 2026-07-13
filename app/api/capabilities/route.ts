import { NextResponse } from "next/server";
import { hasNineRouterCredentials } from "@/lib/ai/transport";
import { buildCapabilitySnapshot } from "@/lib/capabilities";
import { hasTokenSession } from "@/lib/session";

export async function GET() {
  const authenticated = await hasTokenSession();
  const capabilities = buildCapabilitySnapshot({
    authenticated,
    apifyConfigured: Boolean(process.env.APIFY_TOKEN),
    nineRouterConfigured: hasNineRouterCredentials(),
  });

  return NextResponse.json({
    capabilities,
    checkedAt: new Date().toISOString(),
  });
}
