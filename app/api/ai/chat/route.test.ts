import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  activeAiProviderName,
  chatResponseBudget,
  generateContextualChat,
  generateContextualChatStream,
  hasAiProviderCredentials,
} = vi.hoisted(() => ({
  activeAiProviderName: vi.fn(),
  chatResponseBudget: vi.fn(),
  generateContextualChat: vi.fn(),
  generateContextualChatStream: vi.fn(),
  hasAiProviderCredentials: vi.fn(),
}));

vi.mock("@/lib/ai/chat", () => ({ chatResponseBudget, generateContextualChat, generateContextualChatStream }));
vi.mock("@/lib/ai/transport", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/transport")>();
  return { ...original, activeAiProviderName, hasAiProviderCredentials };
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
    activeAiProviderName.mockReturnValue("openrouter");
    chatResponseBudget.mockReturnValue({ complexity: "quick", maxTokens: 700, reasoningEffort: "minimal", wordLimit: 140 });
    hasAiProviderCredentials.mockReturnValue(true);
    generateContextualChat.mockResolvedValue("Use the available workspace.");
    generateContextualChatStream.mockImplementation(async (_body: unknown, options: {
      onDelta: (delta: string) => void;
      onReasoningDelta?: (delta: string) => void;
    }) => {
      options.onReasoningDelta?.("Checked the available capabilities.");
      options.onDelta("Use the available ");
      options.onDelta("workspace.");
      return "Use the available workspace.";
    });
  });

  it("returns a contextual OpenRouter reply with an adaptive budget", async () => {
    const response = await POST(request(validBody()));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.provider).toBe("openrouter");
    expect(json.complexity).toBe("quick");
    expect(json.maxTokens).toBe(700);
    expect(json.requestId).toBe("request_1");
    expect(json.reply).toBe("Use the available workspace.");
    expect(generateContextualChat).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ view: "overview" }) }), expect.any(AbortSignal));
  });

  it("streams progress and answer events when the client requests NDJSON", async () => {
    const response = await POST(request(validBody(), { accept: "application/x-ndjson" }));
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));

    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(events.some((event) => event.type === "status" && event.stage === "analyzing")).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: "meta", complexity: "quick", maxTokens: 700 }));
    expect(events.filter((event) => event.type === "reasoning_delta").map((event) => event.delta).join(""))
      .toBe("Checked the available capabilities.");
    expect(events.filter((event) => event.type === "delta").map((event) => event.delta).join(""))
      .toBe("Use the available workspace.");
    expect(events.at(-1)).toEqual(expect.objectContaining({
      type: "done",
      contextFingerprint: validBody().contextFingerprint,
      provider: "openrouter",
      complexity: "quick",
      maxTokens: 700,
      reasoning: "Checked the available capabilities.",
      reply: "Use the available workspace.",
    }));
  });

  it("rejects cross-origin requests before using provider quota", async () => {
    const response = await POST(request(validBody(), { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }));

    expect(response.status).toBe(403);
    expect(generateContextualChat).not.toHaveBeenCalled();
  });

  it("returns service unavailable when no AI gateway is configured", async () => {
    hasAiProviderCredentials.mockReturnValue(false);

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
    expect(providerJson.error).toBe("The AI provider is temporarily unavailable. Retry in a moment.");
    expect(JSON.stringify(providerJson)).not.toContain("private upstream detail");
    expect(timeoutResponse.status).toBe(504);
    expect(timeoutJson.error).toBe("The smart assistant took too long to answer. Retry—the conversation is saved.");
  });
});
