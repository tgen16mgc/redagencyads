import { describe, expect, it } from "vitest";
import { CHAT_LIMITS } from "../ai/chat-contract";
import {
  appendChatMessage,
  clearChatThread,
  emptyChatThreads,
  messagesForContext,
  requestHistory,
} from "../ai/chat-thread";

describe("chat thread helpers", () => {
  it("keeps responses isolated to their originating workspace", () => {
    const initial = emptyChatThreads();
    const withPerformance = appendChatMessage(initial, "ads", "performance-context", { id: "a", role: "assistant", content: "Performance answer", status: "complete" });
    const withTikTok = appendChatMessage(withPerformance, "tiktok", "tiktok-context", { id: "b", role: "assistant", content: "TikTok answer", status: "complete" });

    expect(messagesForContext(withTikTok, "ads", "performance-context").map((message) => message.content)).toEqual(["Performance answer"]);
    expect(messagesForContext(withTikTok, "tiktok", "tiktok-context").map((message) => message.content)).toEqual(["TikTok answer"]);
    expect(messagesForContext(withTikTok, "competitor", "competitor-context")).toEqual([]);
  });

  it("starts a clean thread when workspace context changes", () => {
    const oldContext = appendChatMessage(emptyChatThreads(), "ads", "account-a", {
      id: "old",
      role: "user",
      content: "Private account A question",
      status: "complete",
    });

    expect(messagesForContext(oldContext, "ads", "account-b")).toEqual([]);

    const newContext = appendChatMessage(oldContext, "ads", "account-b", {
      id: "new",
      role: "user",
      content: "Account B question",
      status: "complete",
    });

    expect(requestHistory(messagesForContext(newContext, "ads", "account-b"))).toEqual([
      { role: "user", content: "Account B question" },
    ]);
  });

  it("clears only the active context thread", () => {
    const withMessage = appendChatMessage(emptyChatThreads(), "competitor", "context-a", {
      id: "1",
      role: "user",
      content: "Question",
      status: "complete",
    });
    const cleared = clearChatThread(withMessage, "competitor", "context-a");

    expect(messagesForContext(cleared, "competitor", "context-a")).toEqual([]);
  });

  it("excludes UI error messages from provider history", () => {
    const history = requestHistory([
      { id: "1", role: "user", content: "Question", status: "complete" },
      { id: "2", role: "assistant", content: "Provider failed", status: "error", retryContent: "Question" },
      { id: "3", role: "assistant", content: "Request stopped", status: "notice", retryContent: "Question" },
    ]);

    expect(history).toEqual([{ role: "user", content: "Question" }]);
  });

  it("keeps recent history within the API character budget", () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: "x".repeat(index % 2 === 0 ? CHAT_LIMITS.userMessageCharacters : CHAT_LIMITS.assistantMessageCharacters),
      status: "complete" as const,
    }));

    const history = requestHistory(messages);
    const characters = history.reduce((total, message) => total + message.content.length, 0);

    expect(characters).toBeLessThanOrEqual(CHAT_LIMITS.historyCharacters);
    expect(history.at(-1)?.content).toBe(messages.at(-1)?.content);
    expect(history.length).toBeLessThan(messages.length);
  });
});
