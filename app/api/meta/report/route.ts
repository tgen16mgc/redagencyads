import { NextResponse } from "next/server";
import { z } from "zod";
import { buildReport } from "@/lib/meta";
import { requireToken } from "@/lib/session";

const packSchema = z.enum(["lead_gen", "messages", "sales_roas", "traffic", "awareness"]).optional();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = z.string().min(1).parse(url.searchParams.get("accountId"));
    const since = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(url.searchParams.get("since"));
    const until = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(url.searchParams.get("until"));
    const campaignIds = url.searchParams.getAll("campaignId").filter(Boolean);
    const pack = packSchema.parse(url.searchParams.get("pack") || undefined);
    const token = await requireToken();
    const report = await buildReport({ token, accountId, campaignIds, since, until, pack });
    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to build report." },
      { status: 400 },
    );
  }
}
