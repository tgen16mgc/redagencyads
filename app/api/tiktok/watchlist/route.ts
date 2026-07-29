import { NextResponse } from "next/server";
import { z } from "zod";
import { readTikTokWatchlist, saveTikTokWatchlist } from "@/lib/tiktok-watchlist";

export async function GET() { return NextResponse.json({ watchlist: await readTikTokWatchlist() }); }
export async function PUT(request: Request) {
  try { const { handles } = z.object({ handles: z.array(z.string().min(1).max(120)).max(50) }).parse(await request.json()); return NextResponse.json({ watchlist: await saveTikTokWatchlist(handles) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save TikTok watchlist." }, { status: 400 }); }
}
