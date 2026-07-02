import { NextResponse } from "next/server";
import { z } from "zod";
import { publishPageFeedPost } from "@/lib/meta-pages";
import { requireToken } from "@/lib/session";

const pagePostSchema = z.object({
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
});

export async function POST(request: Request) {
  try {
    const body = pagePostSchema.parse(await request.json());
    const token = await requireToken();
    const submission = await publishPageFeedPost({
      token,
      pageId: body.pageId,
      message: body.message || undefined,
      link: body.link || undefined,
      mode: body.mode,
      scheduledFor: body.scheduledFor,
    });
    return NextResponse.json({ submission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit Page post." },
      { status: 400 },
    );
  }
}
