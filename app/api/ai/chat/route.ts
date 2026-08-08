import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateContextualChat, generateContextualChatStream } from "@/lib/ai/chat";
import { chatRequestSchema, type ChatRequest } from "@/lib/ai/chat-contract";
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

function publicChatError(error: unknown) {
  if (error instanceof NineRouterTimeoutError) {
    return { status: 504, message: "The smart assistant took too long to answer. Retry—the conversation is saved." };
  }
  if (error instanceof NineRouterProviderError) {
    return { status: 502, message: "The AI provider is temporarily unavailable. Retry in a moment." };
  }
  if (error instanceof NineRouterAbortError) {
    return { status: 499, message: "Chat request cancelled." };
  }
  return { status: 500, message: "The assistant could not complete this request. Retry—the conversation is saved." };
}

function streamedChatResponse(body: ChatRequest, requestSignal: AbortSignal) {
  const encoder = new TextEncoder();
  const upstreamController = new AbortController();
  let cancelled = false;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let deltaTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingDelta = "";
  let answer = "";

  const abortUpstream = () => upstreamController.abort();
  requestSignal.addEventListener("abort", abortUpstream, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (event: Record<string, unknown>) => {
        if (cancelled || closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          cancelled = true;
          upstreamController.abort();
        }
      };
      const flushDelta = () => {
        deltaTimer = undefined;
        if (!pendingDelta) return;
        write({ type: "delta", delta: pendingDelta });
        pendingDelta = "";
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (deltaTimer) clearTimeout(deltaTimer);
        requestSignal.removeEventListener("abort", abortUpstream);
        if (!cancelled) controller.close();
      };

      write({ type: "status", stage: "preparing" });
      heartbeat = setInterval(() => write({ type: "status", stage: "working" }), 8_000);

      void (async () => {
        try {
          write({ type: "status", stage: "analyzing" });
          let responding = false;
          const reply = await generateContextualChatStream(body, {
            signal: upstreamController.signal,
            onDelta: (delta) => {
              if (!responding) {
                responding = true;
                write({ type: "status", stage: "responding" });
              }
              answer += delta;
              pendingDelta += delta;
              if (!deltaTimer) deltaTimer = setTimeout(flushDelta, 32);
            },
          });
          if (deltaTimer) clearTimeout(deltaTimer);
          flushDelta();
          write({
            type: "done",
            requestId: body.requestId,
            contextFingerprint: body.contextFingerprint,
            provider: "9router",
            reply: reply || answer,
          });
        } catch (error) {
          if (!cancelled) {
            if (deltaTimer) clearTimeout(deltaTimer);
            flushDelta();
            const failure = publicChatError(error);
            write({ type: "error", error: failure.message, retryable: failure.status !== 499 });
          }
        } finally {
          close();
        }
      })();
    },
    cancel() {
      cancelled = true;
      upstreamController.abort();
      if (heartbeat) clearInterval(heartbeat);
      if (deltaTimer) clearTimeout(deltaTimer);
      requestSignal.removeEventListener("abort", abortUpstream);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

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

    if (request.headers.get("accept")?.includes("application/x-ndjson")) {
      return streamedChatResponse(body, request.signal);
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
    const failure = publicChatError(error);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
