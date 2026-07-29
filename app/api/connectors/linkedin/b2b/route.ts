import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchLinkedInB2BBreakdown, rollupLinkedInJobTitles, rollupLinkedInTargetAccounts } from "@/lib/connector-adapters";
import { incrementalWindow } from "@/lib/data-pipeline";
import { requireConnectorSessionAccessToken } from "@/lib/interactive-connector-auth";
import { sessionErrorStatus } from "@/lib/session";

const schema = z.object({
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  targetAccounts: z.array(z.string().min(1).max(240)).max(200).default([]),
}).refine((body) => !body.since || !body.until || body.since <= body.until, { message: "since must be on or before until", path: ["until"] });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (!process.env.LINKEDIN_AD_ACCOUNT_ID) throw new Error("LINKEDIN_AD_ACCOUNT_ID is required.");
    const fallback = incrementalWindow(new Date(), 30);
    const accessToken = await requireConnectorSessionAccessToken(
      request,
      "linkedin",
    );
    const breakdown = await fetchLinkedInB2BBreakdown({ accessToken, accountId: process.env.LINKEDIN_AD_ACCOUNT_ID, since: body.since || fallback.since, until: body.until || fallback.until });
    return NextResponse.json({
      targetAccounts: rollupLinkedInTargetAccounts(breakdown.companyRows, body.targetAccounts),
      jobTitles: rollupLinkedInJobTitles(breakdown.jobTitleRows),
      source: "linkedin_ads_reporting",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load LinkedIn B2B reporting." }, { status: sessionErrorStatus(error) });
  }
}
