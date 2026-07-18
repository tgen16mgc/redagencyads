import { describe, expect, it } from "vitest";
import { buildContextualChatSystemPrompt } from "@/lib/ai/chat";
import type { ChatRequest } from "@/lib/ai/chat-contract";

describe("contextual chat prompt", () => {
  it("requests structured Markdown and prohibits emoji", () => {
    const request: ChatRequest = {
      requestId: "request_1",
      contextFingerprint: "00000000",
      language: "en",
      context: {
        view: "overview",
        authenticated: false,
        capabilities: [],
      },
      messages: [{ role: "user", content: "Write a client-ready summary" }],
    };

    const prompt = buildContextualChatSystemPrompt(request);
    expect(prompt).toContain("GitHub-flavored Markdown");
    expect(prompt).toContain("compact tables");
    expect(prompt).toContain("Never use emoji");
    expect(prompt).toContain("professional and client-ready");
  });
});
