import { describe, expect, it } from "vitest";
import { buildContextualChatSystemPrompt, chatResponseBudget } from "@/lib/ai/chat";
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
    expect(prompt).toContain("standard request");
    expect(prompt).toContain("220 words or fewer");
    expect(prompt).toContain("Put the direct answer or recommendation in the first two sentences");
    expect(prompt).toContain("**Why:**");
    expect(prompt).toContain("summarizes the decision trace");
    expect(prompt).toContain("interface presents provider reasoning separately");
    expect(prompt).toContain("Never use emoji");
    expect(prompt).toContain("professional and client-ready");
  });

  it("adapts output and reasoning budgets to question complexity", () => {
    const base: Omit<ChatRequest, "messages"> = {
      requestId: "request_1",
      contextFingerprint: "00000000",
      language: "en",
      context: { view: "overview", authenticated: false, capabilities: [] },
    };

    expect(chatResponseBudget({ ...base, messages: [{ role: "user", content: "What needs setup?" }] }))
      .toEqual({ complexity: "quick", maxTokens: 700, reasoningEffort: "minimal", wordLimit: 140 });
    expect(chatResponseBudget({ ...base, messages: [{ role: "user", content: "Compare these results and summarize the risks." }] }))
      .toEqual({ complexity: "standard", maxTokens: 1200, reasoningEffort: "low", wordLimit: 220 });
    expect(chatResponseBudget({ ...base, messages: [{ role: "user", content: "Create a comprehensive strategy audit." }] }))
      .toEqual({ complexity: "deep", maxTokens: 2400, reasoningEffort: "medium", wordLimit: 350 });
  });
});
