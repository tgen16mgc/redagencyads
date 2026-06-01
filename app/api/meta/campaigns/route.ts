import { NextResponse } from "next/server";
import { getCampaigns } from "@/lib/meta";
import { requireToken } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    if (!accountId) throw new Error("accountId is required.");
    const token = await requireToken();
    const campaigns = await getCampaigns(token, accountId);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load campaigns." },
      { status: 400 },
    );
  }
}
