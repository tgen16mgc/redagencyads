import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateContextualChat } from "@/lib/ai/chat";
import { chatRequestSchema } from "@/lib/ai/chat-contract";
import { chatContextFingerprint } from "@/lib/ai/chat-context";
import { chatClientKey, consumeChatRateLimit, isSameOriginRequest } from "@/lib/ai/chat-security";
import {
  hasNineRouterCredentials,
  NineRouterAbortError,
  NineRouterProviderError,
  NineRouterTimeoutError,
} from "@/lib/ai/transport";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin chat requests are not allowed." }, { status: 403 });
  }

  const rateLimit = consumeChatRateLimit(chatClientKey(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many chat requests. Please wait before trying again." },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const body = chatRequestSchema.parse(await request.json());
    if (chatContextFingerprint(body.context) !== body.contextFingerprint) {
      return NextResponse.json({ error: "Workspace context changed before the request was sent." }, { status: 400 });
    }
    if (!hasNineRouterCredentials()) {
      return NextResponse.json({ error: "The smart assistant is not configured for this workspace." }, { status: 503 });
    }

    const reply = await generateContextualChat(body, request.signal);
    return NextResponse.json({
      requestId: body.requestId,
      contextFingerprint: body.contextFingerprint,
      provider: "9router",
      reply,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid chat request." }, { status: 400 });
    }
    if (error instanceof NineRouterTimeoutError) {
      return NextResponse.json({ error: "The smart assistant took too long to answer. Try a shorter question." }, { status: 504 });
    }
    if (error instanceof NineRouterProviderError) {
      return NextResponse.json({ error: "The smart assistant is temporarily unavailable." }, { status: 502 });
    }
    if (error instanceof NineRouterAbortError) {
      return NextResponse.json({ error: "Chat request cancelled." }, { status: 499 });
    }
    return NextResponse.json({ error: "Unable to answer this workspace question." }, { status: 500 });
  }
}
