import { NextResponse } from "next/server";
import { isAllowedMetaPreviewImageUrl, supportedPdfImageFormat } from "@/lib/meta-preview-image";
import { requireToken, sessionErrorStatus } from "@/lib/session";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    await requireToken();
    const source = new URL(request.url).searchParams.get("url") || "";
    if (!isAllowedMetaPreviewImageUrl(source)) {
      return NextResponse.json({ error: "Unsupported Meta preview image URL." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(source, {
        headers: { Accept: "image/jpeg,image/png" },
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok || !isAllowedMetaPreviewImageUrl(response.url || source)) {
      return NextResponse.json({ error: "Meta preview image could not be loaded." }, { status: 502 });
    }
    const contentType = response.headers.get("content-type") || "";
    if (!supportedPdfImageFormat(contentType)) {
      return NextResponse.json({ error: "Meta preview image format is not supported." }, { status: 415 });
    }
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Meta preview image is too large." }, { status: 413 });
    }
    const image = await response.arrayBuffer();
    if (image.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Meta preview image is too large." }, { status: 413 });
    }

    return new NextResponse(image, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Meta preview image." },
      { status: sessionErrorStatus(error) },
    );
  }
}
