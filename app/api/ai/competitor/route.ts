import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCompetitorSpy } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  prompt: z.string().min(100),
  provider: z.enum(["auto", "9router", "prompt"]).default("auto"),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const competitor = await generateCompetitorSpy(body.prompt, body.provider);
    return NextResponse.json({ competitor });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate competitor spy report." },
      { status: 400 },
    );
  }
}
