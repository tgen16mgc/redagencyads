import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchCompetitorAds } from "@/lib/competitor-spy";
import { requireToken } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  source: z.enum(["meta_official", "apify"]).default("apify"),
  competitors: z.array(z.string().min(1)).max(8).default([]),
  country: z.string().min(2).max(2).default("VN"),
  limit: z.number().int().min(1).max(80).default(20),
  libraryUrls: z.array(z.string().url()).max(8).default([]),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (!body.competitors.length && !body.libraryUrls.length) {
      throw new Error("Add competitor names or Meta Ad Library URLs before fetching ads.");
    }
    const token = body.source === "meta_official" ? await requireToken() : undefined;
    const result = await fetchCompetitorAds({ ...body, token });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch competitor ads." },
      { status: 400 },
    );
  }
}
