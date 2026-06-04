import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchCompetitorAds } from "@/lib/competitor-spy";
import {
  normalizeCompetitorCountry,
  normalizeCompetitorLimit,
  normalizeCompetitorNames,
  normalizeCompetitorUrls,
} from "@/lib/competitor-input";
import { requireToken } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  source: z.enum(["public", "meta_official", "apify"]).default("public"),
  competitors: z.array(z.string()).default([]),
  country: z.string().default("VN"),
  limit: z.number().default(20),
  libraryUrls: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const competitors = normalizeCompetitorNames(body.competitors);
    const libraryUrls = normalizeCompetitorUrls(body.libraryUrls);
    if (!competitors.length && !libraryUrls.length) {
      throw new Error("Add competitor names or Meta Ad Library URLs before fetching ads.");
    }
    const token = body.source === "meta_official" ? await requireToken() : undefined;
    const result = await fetchCompetitorAds({
      source: body.source,
      competitors,
      country: normalizeCompetitorCountry(body.country),
      limit: normalizeCompetitorLimit(body.limit),
      libraryUrls,
      token,
    });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch competitor ads." },
      { status: 400 },
    );
  }
}
