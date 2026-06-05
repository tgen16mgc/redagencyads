import { NextResponse } from "next/server";
import { activeAdSetPreviews } from "@/lib/adset-preview";
import { getAdSets } from "@/lib/meta";
import { requireToken } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    if (!accountId) throw new Error("accountId is required.");
    const campaignIds = url.searchParams.getAll("campaignId");
    const token = await requireToken();
    const adsets = await getAdSets(token, accountId, campaignIds);
    return NextResponse.json({ adsets: activeAdSetPreviews(adsets) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load ad sets." },
      { status: 400 },
    );
  }
}
