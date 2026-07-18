import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContextualChat, hasNineRouterCredentials } = vi.hoisted(() => ({
  generateContextualChat: vi.fn(),
  hasNineRouterCredentials: vi.fn(),
}));

vi.mock("@/lib/ai/chat", () => ({ generateContextualChat }));
vi.mock("@/lib/ai/transport", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/transport")>();
  return { ...original, hasNineRouterCredentials };
});

import { buildOverviewChatContext, chatContextFingerprint } from "@/lib/ai/chat-context";
import { resetChatRateLimits } from "@/lib/ai/chat-security";
import { NineRouterProviderError, NineRouterTimeoutError } from "@/lib/ai/transport";
import { POST } from "./route";

function validBody() {
  const context = buildOverviewChatContext({
    authenticated: false,
    capabilities: [{ key: "ai_enhancement", state: "available" }],
  });
  return {
    requestId: "request_1",
    contextFingerprint: chatContextFingerprint(context),
    language: "en",
    context,
    messages: [{ role: "user", content: "What can I do here?" }],
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      host: "localhost",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChatRateLimits();
    hasNineRouterCredentials.mockReturnValue(true);
    generateContextualChat.mockResolvedValue("Use the available workspace.");
  });

  it("returns a contextual 9router reply", async () => {
    const response = await POST(request(validBody()));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.provider).toBe("9router");
    expect(json.requestId).toBe("request_1");
    expect(json.reply).toBe("Use the available workspace.");
    expect(generateContextualChat).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ view: "overview" }) }), expect.any(AbortSignal));
  });

  it("rejects cross-origin requests before using provider quota", async () => {
    const response = await POST(request(validBody(), { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }));

    expect(response.status).toBe(403);
    expect(generateContextualChat).not.toHaveBeenCalled();
  });

  it("returns service unavailable when 9router is not configured", async () => {
    hasNineRouterCredentials.mockReturnValue(false);

    const response = await POST(request(validBody()));

    expect(response.status).toBe(503);
    expect(generateContextualChat).not.toHaveBeenCalled();
  });

  it("rejects a stale or forged context fingerprint", async () => {
    const body = { ...validBody(), contextFingerprint: "00000000" };

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(generateContextualChat).not.toHaveBeenCalled();
  });

  it("rejects assistant-only history", async () => {
    const body = { ...validBody(), messages: [{ role: "assistant", content: "No user question" }] };

    const response = await POST(request(body));

    expect(response.status).toBe(400);
  });

  it("maps provider failures and timeouts without exposing upstream details", async () => {
    generateContextualChat.mockRejectedValueOnce(new NineRouterProviderError("private upstream detail", 503));
    const providerResponse = await POST(request(validBody()));
    const providerJson = await providerResponse.json();

    generateContextualChat.mockRejectedValueOnce(new NineRouterTimeoutError("private timeout detail"));
    const timeoutResponse = await POST(request(validBody(), { "x-forwarded-for": "second-client" }));
    const timeoutJson = await timeoutResponse.json();

    expect(providerResponse.status).toBe(502);
    expect(providerJson.error).toBe("The smart assistant is temporarily unavailable.");
    expect(JSON.stringify(providerJson)).not.toContain("private upstream detail");
    expect(timeoutResponse.status).toBe(504);
    expect(timeoutJson.error).toBe("The smart assistant took too long to answer. Try a shorter question.");
  });
});
