import type { PagePostMode, PagePostSubmission } from "@/lib/types";
import { PAGE_VIDEO_UPLOAD_CHUNK_BYTES } from "@/lib/page-video-upload-limits";

const UPLOAD_ROUTE = "/api/meta/page-video-uploads";
const INVALID_UPLOAD_PROGRESS_MESSAGE = "Meta returned invalid video upload progress. Please retry the upload.";

type JsonObject = Record<string, unknown>;
type PublisherResponseOptions = { tooLargeMessage?: string };

export const PUBLISH_UPLOAD_TOO_LARGE_MESSAGE =
  "This media upload is too large for a single request. Use a public hosted media URL or retry with a smaller file.";

export async function readPublisherJson<T extends JsonObject>(
  response: Response,
  fallback: string,
  options: PublisherResponseOptions = {},
): Promise<T> {
  const text = await response.text();
  let json: JsonObject | null = null;

  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) json = parsed as JsonObject;
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    if (response.status === 413 || /request entity too large|payload too large/i.test(text)) {
      throw new Error(options.tooLargeMessage || PUBLISH_UPLOAD_TOO_LARGE_MESSAGE);
    }

    const apiError = typeof json?.error === "string" ? json.error.trim() : "";
    const contentType = response.headers.get("content-type") || "";
    const plainError = contentType.startsWith("text/plain") && text.trim().length <= 300 ? text.trim() : "";
    throw new Error(apiError || plainError || fallback);
  }

  if (!json) throw new Error(fallback);
  return json as T;
}

type FacebookVideoUploadInput = {
  pageId: string;
  message: string;
  link: string;
  mode: PagePostMode;
  scheduledFor: string;
  file: File;
};

type UploadOptions = {
  fetchImpl?: typeof fetch;
  onProgress?: (percent: number) => void;
};

type UploadProgress = {
  ticket: string;
  startOffset: number;
  endOffset: number;
};

function parseOffset(value: unknown) {
  const offset = typeof value === "number" ? value : Number(value);
  return Number.isInteger(offset) ? offset : NaN;
}

function assertUploadProgress(startOffset: number, endOffset: number, fileSize: number) {
  if (
    !Number.isInteger(startOffset)
    || !Number.isInteger(endOffset)
    || startOffset < 0
    || startOffset >= fileSize
    || endOffset <= startOffset
    || endOffset > fileSize
  ) {
    throw new Error(INVALID_UPLOAD_PROGRESS_MESSAGE);
  }
}

export async function uploadFacebookVideo(
  input: FacebookVideoUploadInput,
  options: UploadOptions = {},
): Promise<PagePostSubmission> {
  if (!input.file.size) throw new Error("Choose a non-empty video file before publishing.");

  const fetchImpl = options.fetchImpl || fetch;
  options.onProgress?.(0);

  const startResponse = await fetchImpl(UPLOAD_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phase: "start",
      pageId: input.pageId,
      fileName: input.file.name,
      fileSize: input.file.size,
    }),
  });
  const startJson = await readPublisherJson<{ upload: UploadProgress }>(startResponse, "Unable to start the video upload.");
  const ticket = startJson.upload?.ticket;
  let startOffset = parseOffset(startJson.upload?.startOffset);
  let endOffset = parseOffset(startJson.upload?.endOffset);

  if (!ticket) throw new Error(INVALID_UPLOAD_PROGRESS_MESSAGE);
  assertUploadProgress(startOffset, endOffset, input.file.size);

  let transferCount = 0;
  while (startOffset < input.file.size) {
    assertUploadProgress(startOffset, endOffset, input.file.size);
    if (transferCount++ > 10_000) throw new Error(INVALID_UPLOAD_PROGRESS_MESSAGE);

    const formData = new FormData();
    formData.set("phase", "transfer");
    formData.set("ticket", ticket);
    formData.set("startOffset", String(startOffset));
    const chunkEndOffset = Math.min(endOffset, startOffset + PAGE_VIDEO_UPLOAD_CHUNK_BYTES);
    formData.set("videoChunk", input.file.slice(startOffset, chunkEndOffset, input.file.type), input.file.name);

    const transferResponse = await fetchImpl(UPLOAD_ROUTE, { method: "POST", body: formData });
    const transferJson = await readPublisherJson<{ upload: Pick<UploadProgress, "startOffset" | "endOffset"> }>(
      transferResponse,
      "Unable to transfer the video upload.",
      { tooLargeMessage: "The video transfer chunk exceeded the deployment request limit. Please retry the upload." },
    );
    const nextStartOffset = parseOffset(transferJson.upload?.startOffset);
    const nextEndOffset = parseOffset(transferJson.upload?.endOffset);

    if (nextStartOffset !== chunkEndOffset || nextStartOffset > input.file.size) {
      throw new Error(INVALID_UPLOAD_PROGRESS_MESSAGE);
    }

    startOffset = nextStartOffset;
    endOffset = nextEndOffset;
    options.onProgress?.(Math.min(100, Math.round((startOffset / input.file.size) * 100)));
  }

  const finishResponse = await fetchImpl(UPLOAD_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phase: "finish",
      ticket,
      message: input.message.trim() || undefined,
      link: input.link.trim() || undefined,
      mode: input.mode,
      scheduledFor: input.mode === "scheduled" ? new Date(input.scheduledFor).toISOString() : undefined,
      fileName: input.file.name,
    }),
  });
  const finishJson = await readPublisherJson<{ submission: PagePostSubmission }>(finishResponse, "Unable to finish the video upload.");
  options.onProgress?.(100);
  return finishJson.submission;
}
