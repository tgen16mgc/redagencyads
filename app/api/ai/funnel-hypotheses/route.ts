import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { funnelHypothesisRequestSchema } from "@/lib/ai/funnel-hypothesis-contract";
import { generateFunnelHypotheses } from "@/lib/ai/funnel-hypothesis";
import { chatClientKey, consumeChatRateLimit, isSameOriginRequest } from "@/lib/ai/chat-security";
import { activeAiProviderName, hasAiProviderCredentials, NineRouterAbortError, NineRouterTimeoutError } from "@/lib/ai/transport";

export const runtime = "nodejs";
export const maxDuration = 120;
// Workspace authentication and membership are enforced by middleware for /api/ai/*.
function reply(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "cache-control": "private, no-store", ...headers } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return reply({ code: "forbidden" }, 403);
  const limit = consumeChatRateLimit(`funnel:${chatClientKey(request)}`);
  if (!limit.allowed) return reply({ code: "rate_limit" }, 429, { "retry-after": String(limit.retryAfterSeconds) });
  try {
    if (Number(request.headers.get("content-length")) > 24_000) return reply({ code: "invalid_request" }, 413);
    const raw = await request.text();
    if (raw.length > 24_000) return reply({ code: "invalid_request" }, 413);
    const input = funnelHypothesisRequestSchema.parse(JSON.parse(raw));
    if (!hasAiProviderCredentials()) return reply({ code: "not_configured" }, 503);
    const result = await generateFunnelHypotheses(input, request.signal);
    return reply({ ...result, provider: activeAiProviderName() });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return reply({ code: "invalid_request" }, 400);
    if (error instanceof NineRouterTimeoutError) return reply({ code: "timeout" }, 504);
    if (error instanceof NineRouterAbortError) return reply({ code: "cancelled" }, 499);
    // Never expose upstream diagnostics, credentials or report content.
    return reply({ code: "provider_unavailable" }, 502);
  }
}
