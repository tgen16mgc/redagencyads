import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVerdict } from "@/lib/ai";

const bodySchema = z.object({
  prompt: z.string().min(100),
  provider: z.enum(["auto", "openai", "openrouter", "prompt"]).default("auto"),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const verdict = await generateVerdict(body.prompt, body.provider);
    return NextResponse.json({ verdict });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate verdict." },
      { status: 400 },
    );
  }
}
