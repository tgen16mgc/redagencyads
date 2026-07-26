import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCompetitorSpy } from "@/lib/ai/competitor";
import type { CompetitorSpyAd, DashboardReport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const providerSchema = z.enum(["auto", "9router", "prompt"]).default("auto");
const languageSchema = z.enum(["en", "vi"]).default("en");

function isDashboardReport(value: unknown): value is DashboardReport {
  return Boolean(
    value &&
      typeof value === "object" &&
      "account" in value &&
      "selectedPack" in value &&
      "totals" in value &&
      "health" in value,
  );
}

function isCompetitorSpyAd(value: unknown): value is CompetitorSpyAd {
  return Boolean(value && typeof value === "object" && "id" in value && "source" in value);
}

const bodySchema = z.object({
  competitors: z.array(z.string()).max(40),
  market: z.string().max(2000),
  platform: z.enum(["meta", "google", "linkedin", "tiktok", "mixed"]),
  notes: z.string().max(60000),
  manualEvidence: z.array(z.object({
    id: z.string(),
    text: z.string(),
    advertiser: z.string().optional(),
    sourceUrl: z.string().optional(),
  })).optional(),
  extractedAds: z.array(z.custom<CompetitorSpyAd>(isCompetitorSpyAd)).optional(),
  report: z.custom<DashboardReport>(isDashboardReport).nullable().optional(),
  language: languageSchema,
  provider: providerSchema,
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const competitor = await generateCompetitorSpy(body);
    return NextResponse.json({ competitor });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate competitor spy report." },
      { status: 400 },
    );
  }
}
