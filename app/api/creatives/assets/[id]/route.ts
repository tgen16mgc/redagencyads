import { NextResponse } from "next/server";
import { z } from "zod";
import { getCreativeAsset, publicCreativeAsset, updateCreativeAsset } from "@/lib/creative-dam";

const patchSchema = z.object({
  name: z.string().min(1).max(240).optional(),
  platform: z.enum(["meta", "tiktok", "google_ads", "youtube", "linkedin", "multi"]).optional(),
  concept: z.string().max(240).optional(),
  hook: z.string().max(500).optional(),
  talent: z.string().max(240).optional(),
  tags: z.array(z.string().max(120)).max(50).optional(),
  rightsExpiry: z.string().max(40).optional(),
  linkedAdIds: z.array(z.string().max(120)).max(500).optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const asset = await getCreativeAsset(decodeURIComponent(id));
  return asset ? NextResponse.json({ asset: publicCreativeAsset(asset) }) : NextResponse.json({ error: "Creative asset not found." }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ asset: publicCreativeAsset(await updateCreativeAsset(decodeURIComponent(id), patchSchema.parse(await request.json()))) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update creative asset." }, { status: 400 });
  }
}
