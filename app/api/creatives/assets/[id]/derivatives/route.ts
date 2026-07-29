import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCreativeDerivatives, publicCreativeAsset } from "@/lib/creative-dam";

const bodySchema = z.object({ ratios: z.array(z.enum(["9:16", "1:1", "4:5", "16:9"])).min(1).max(4).optional(), caption: z.string().max(500).optional(), overlayText: z.string().max(240).optional() });

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    return NextResponse.json({ asset: publicCreativeAsset(await generateCreativeDerivatives(decodeURIComponent(id), body)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate creative derivatives." }, { status: 400 });
  }
}
