import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTikTokAdLibrary } from "@/lib/tiktok";

export const runtime = "nodejs";
export const maxDuration = 300;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const bodySchema = z.object({
  region: z.string().min(2).max(8),
  queryType: z.enum(["1", "2", "url"]),
  query: z.string().min(1),
  startDate: dateSchema,
  endDate: dateSchema,
  maxAds: z.number().int().min(1).max(100).default(20),
  fetchDetails: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const report = await fetchTikTokAdLibrary(body);
    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch TikTok Ad Library rows." },
      { status: 400 },
    );
  }
}
