import { NextResponse } from "next/server";
import { createCreativeAsset, listCreativeAssets, publicCreativeAsset } from "@/lib/creative-dam";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ assets: (await listCreativeAssets()).map(publicCreativeAsset) });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Creative file is required.");
    if (file.size > 250 * 1024 * 1024) throw new Error("Creative file exceeds the 250 MB limit.");
    const tags = String(form.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const asset = await createCreativeAsset({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      name: String(form.get("name") || "") || undefined,
      platform: (String(form.get("platform") || "multi") as Parameters<typeof createCreativeAsset>[0]["platform"]),
      concept: String(form.get("concept") || "") || undefined,
      hook: String(form.get("hook") || "") || undefined,
      talent: String(form.get("talent") || "") || undefined,
      tags,
      rightsExpiry: String(form.get("rightsExpiry") || "") || undefined,
    });
    return NextResponse.json({ asset: publicCreativeAsset(asset) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create creative asset." }, { status: 400 });
  }
}
