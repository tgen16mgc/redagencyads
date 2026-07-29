import { NextResponse } from "next/server";
import { addCreativeAssetVersion, publicCreativeAsset } from "@/lib/creative-dam";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Creative version file is required.");
    if (file.size > 250 * 1024 * 1024) throw new Error("Creative version exceeds the 250 MB limit.");
    const asset = await addCreativeAssetVersion(decodeURIComponent(id), { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, mimeType: file.type || "application/octet-stream" });
    return NextResponse.json({ asset: publicCreativeAsset(asset) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add creative version." }, { status: 400 });
  }
}
