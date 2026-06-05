import { NextResponse } from "next/server";
import { z } from "zod";
import { generateInsights } from "@/lib/ai";

const bodySchema = z.object({
  prompt: z.string().min(100),
  provider: z.enum(["auto", "kiro", "prompt"]).default("auto"),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const insights = await generateInsights(body.prompt, body.provider);
    return NextResponse.json({ insights });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate insights." },
      { status: 400 },
    );
  }
}
