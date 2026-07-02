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
  })
  .superRefine((value, ctx) => {
    if (!value.message && !value.link && !value.media) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Message, link, or media is required." });
    }
    if ((value.target === "instagram" || value.target === "both") && !value.media) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Instagram posts require an image, video, or GIF attachment." });
    }
    if (value.target === "instagram" && value.mode === "scheduled") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Instagram scheduling is not available here yet; use Facebook or publish now." });
    }
  });

const pagePostSchema = z.union([pagePostItemSchema, z.object({ items: z.array(pagePostItemSchema).min(1) })]);

type PagePostItem = z.infer<typeof pagePostItemSchema>;

function errorMessage(error: unknown, fallback = "Unable to submit Page post.") {
  return error instanceof Error ? error.message : fallback;
}

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) return pagePostSchema.parse(await request.json());

  const formData = await request.formData();
  const mediaFile = formData.get("mediaFile");
  return pagePostItemSchema.parse({
    pageId: String(formData.get("pageId") || ""),
    message: String(formData.get("message") || ""),
    link: String(formData.get("link") || ""),
    mode: String(formData.get("mode") || "publish_now"),
    scheduledFor: String(formData.get("scheduledFor") || "") || undefined,
    target: String(formData.get("target") || "facebook"),
    media: mediaFile instanceof File ? { type: String(formData.get("mediaType") || "image"), name: mediaFile.name, file: mediaFile } : undefined,
  });
}

function publishItem(token: string, item: PagePostItem) {
  return publishPageFeedPost({
    token,
    pageId: item.pageId,
    message: item.message || undefined,
    link: item.link || undefined,
    mode: item.mode,
    scheduledFor: item.scheduledFor,
    target: item.target,
    media: item.media,
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
