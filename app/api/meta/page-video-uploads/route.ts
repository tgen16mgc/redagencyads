import { NextResponse } from "next/server";
import { z } from "zod";
import {
  finishFacebookVideoUpload,
  startFacebookVideoUpload,
  transferFacebookVideoUpload,
} from "@/lib/meta-pages";
import { openMetaVideoUploadTicket, sealMetaVideoUploadTicket } from "@/lib/meta-video-upload-ticket";
import { requireToken } from "@/lib/session";

export const maxDuration = 300;

const MAX_VIDEO_FILE_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_VIDEO_CHUNK_BYTES = 4 * 1024 * 1024;

const startSchema = z.object({
  phase: z.literal("start"),
  pageId: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_VIDEO_FILE_BYTES),
});

const finishSchema = z.object({
  phase: z.literal("finish"),
  ticket: z.string().min(1),
  message: z.string().trim().optional(),
  link: z.string().trim().url().optional(),
  mode: z.enum(["publish_now", "scheduled"]),
  scheduledFor: z.string().optional(),
  fileName: z.string().trim().min(1).max(255),
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to upload Facebook video.";
}

export async function POST(request: Request) {
  try {
    const token = await requireToken();
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      if (formData.get("phase") !== "transfer") throw new Error("Invalid video upload phase.");

      const ticket = String(formData.get("ticket") || "");
      const startOffset = Number(formData.get("startOffset"));
      const videoChunk = formData.get("videoChunk");
      const upload = openMetaVideoUploadTicket(ticket, token);

      if (!upload) throw new Error("Video upload session expired. Start the upload again.");
      if (!Number.isInteger(startOffset) || startOffset < 0) throw new Error("Invalid video upload offset.");
      if (!(videoChunk instanceof File) || !videoChunk.size) throw new Error("Video upload chunk is missing.");
      if (videoChunk.size > MAX_VIDEO_CHUNK_BYTES) throw new Error("Video upload chunk exceeds the platform request limit.");

      const progress = await transferFacebookVideoUpload({
        pageId: upload.pageId,
        pageAccessToken: upload.pageAccessToken,
        uploadSessionId: upload.uploadSessionId,
        startOffset,
        chunk: videoChunk,
      });
      return NextResponse.json({ upload: progress });
    }

    const rawBody = await request.json();
    if (rawBody?.phase === "start") {
      const body = startSchema.parse(rawBody);
      const upload = await startFacebookVideoUpload({ token, pageId: body.pageId, fileSize: body.fileSize });
      const ticket = sealMetaVideoUploadTicket(
        {
          pageId: upload.pageId,
          pageName: upload.pageName,
          pageAccessToken: upload.pageAccessToken,
          uploadSessionId: upload.uploadSessionId,
          videoId: upload.videoId,
        },
        token,
      );
      return NextResponse.json({ upload: { ticket, startOffset: upload.startOffset, endOffset: upload.endOffset } });
    }

    const body = finishSchema.parse(rawBody);
    const upload = openMetaVideoUploadTicket(body.ticket, token);
    if (!upload) throw new Error("Video upload session expired. Start the upload again.");

    const submission = await finishFacebookVideoUpload({
      ...upload,
      message: body.message,
      link: body.link,
      mode: body.mode,
      scheduledFor: body.scheduledFor,
      fileName: body.fileName,
    });
    return NextResponse.json({ submission });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
