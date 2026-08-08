import { describe, expect, it } from "vitest";
import { buildContextualChatSystemPrompt } from "@/lib/ai/chat";
import type { ChatRequest } from "@/lib/ai/chat-contract";

describe("contextual chat prompt", () => {
  it("requests concise, skimmable answers with a safe decision trace", () => {
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
    expect(prompt).toContain("180 words or fewer");
    expect(prompt).toContain("Put the direct answer or recommendation in the first two sentences");
    expect(prompt).toContain("**Why:**");
    expect(prompt).toContain("concise decision trace");
    expect(prompt).toContain("Never reveal hidden chain-of-thought");
    expect(prompt).toContain("Never use emoji");
    expect(prompt).toContain("professional and client-ready");
  });
});
