import { NextResponse } from "next/server";
import { buildTikTokAcceptanceSnapshot } from "@/lib/tiktok-acceptance";

export async function GET() {
  return NextResponse.json({
    acceptance: await buildTikTokAcceptanceSnapshot(),
  });
}
