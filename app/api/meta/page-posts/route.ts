import { NextResponse } from "next/server";
import { z } from "zod";
import { publishPageFeedPost } from "@/lib/meta-pages";
import { requireToken } from "@/lib/session";

const mediaSchema = z.object({
  type: z.enum(["image", "video", "gif"]),
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "Media URL must use http or https.")
    .optional(),
  name: z.string().trim().optional(),
  file: z.instanceof(File).optional(),
});

const mediaItemsSchema = z.array(mediaSchema).min(1);

const pagePostItemSchema = z
  .object({
    pageId: z.string().min(1),
    message: z.string().trim().optional(),
    link: z
      .string()
      .trim()
      .url()
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "Link must use http or https.")
      .optional()
      .or(z.literal("")),
    mode: z.enum(["publish_now", "scheduled"]),
    scheduledFor: z.string().optional(),
    target: z.enum(["facebook", "instagram", "both"]).default("facebook"),
    media: mediaSchema.optional(),
    mediaItems: mediaItemsSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const mediaItems = normalizeMediaItems(value.mediaItems, value.media);
    if (!value.message && !value.link && mediaItems.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Message, link, or media is required." });
    }
    if ((value.target === "instagram" || value.target === "both") && mediaItems.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Instagram posts require an image, video, or GIF attachment." });
    }
    if ((value.target === "instagram" || value.target === "both") && mediaItems.length > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Multiple media attachments are only supported for Facebook posts right now." });
    }
    if ((value.target === "instagram" || value.target === "both") && mediaItems.some((item) => item.file)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Instagram publishing requires a public hosted media URL. Local file uploads are supported only for Facebook." });
    }
    if (value.target === "facebook" && mediaItems.length > 1 && mediaItems.some((item) => item.type === "video")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Multiple media Facebook posts can only use images or GIFs." });
    }
    if ((value.target === "instagram" || value.target === "both") && value.mode === "scheduled") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Instagram scheduling is not available here yet; use Facebook or publish now." });
    }
  });

const pagePostSchema = z.union([pagePostItemSchema, z.object({ items: z.array(pagePostItemSchema).min(1) })]);

type PagePostItem = z.infer<typeof pagePostItemSchema>;

type MediaMetadata = z.infer<typeof mediaSchema> & { fileIndex?: number };

function errorMessage(error: unknown, fallback = "Unable to submit Page post.") {
  return error instanceof Error ? error.message : fallback;
}

function normalizeMediaItems(mediaItems?: Array<z.infer<typeof mediaSchema>>, media?: z.infer<typeof mediaSchema>) {
  return (mediaItems?.length ? mediaItems : media ? [media] : []).filter((item) => item.url || item.file);
}

function parseMediaItemsMetadata(value: FormDataEntryValue | null): MediaMetadata[] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return JSON.parse(value) as MediaMetadata[];
}

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) return pagePostSchema.parse(await request.json());

  const formData = await request.formData();
  const mediaFiles = formData.getAll("mediaFiles").filter((file): file is File => file instanceof File);
  const mediaFile = formData.get("mediaFile");
  const mediaItems = parseMediaItemsMetadata(formData.get("mediaItems"))?.map((item) => {
    const file = typeof item.fileIndex === "number" ? mediaFiles[item.fileIndex] : undefined;
    return file ? { type: item.type, name: file.name, file } : { type: item.type, url: item.url, name: item.name };
  });

  return pagePostItemSchema.parse({
    pageId: String(formData.get("pageId") || ""),
    message: String(formData.get("message") || ""),
    link: String(formData.get("link") || ""),
    mode: String(formData.get("mode") || "publish_now"),
    scheduledFor: String(formData.get("scheduledFor") || "") || undefined,
    target: String(formData.get("target") || "facebook"),
    media:
      mediaFile instanceof File
        ? { type: String(formData.get("mediaType") || "image"), name: mediaFile.name, file: mediaFile }
        : undefined,
    mediaItems,
  });
}

function publishItem(token: string, item: PagePostItem) {
  const mediaItems = item.mediaItems ? normalizeMediaItems(item.mediaItems, item.media) : undefined;
  return publishPageFeedPost({
    token,
    pageId: item.pageId,
    message: item.message || undefined,
    link: item.link || undefined,
    mode: item.mode,
    scheduledFor: item.scheduledFor,
    target: item.target,
    media: item.media,
    ...(mediaItems ? { mediaItems } : {}),
  });
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const token = await requireToken();

    if ("items" in body) {
      const results = [];
      for (const item of body.items) {
        try {
          const submission = await publishItem(token, item);
          results.push({ ok: true, submission });
        } catch (error) {
          results.push({ ok: false, error: errorMessage(error) });
        }
      }
      return NextResponse.json({ results }, { status: results.every((result) => result.ok) ? 200 : 207 });
    }

    const submission = await publishItem(token, body);
    return NextResponse.json({ submission });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
