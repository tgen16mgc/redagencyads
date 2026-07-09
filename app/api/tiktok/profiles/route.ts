import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTikTokProfiles } from "@/lib/tiktok";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  profiles: z.array(z.string().min(1)).min(1).max(10),
  resultsPerPage: z.number().int().min(1).max(100).default(20),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await fetchTikTokProfiles(body);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch TikTok profiles." },
      { status: 400 },
    );
  }
}
