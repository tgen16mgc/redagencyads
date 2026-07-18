import { describe, expect, it } from "vitest";
import { appendChatMessage, emptyChatThreads, requestHistory } from "../ai/chat-thread";

describe("chat thread helpers", () => {
  it("keeps responses isolated to their originating workspace", () => {
    const initial = emptyChatThreads();
    const withPerformance = appendChatMessage(initial, "ads", { id: "a", role: "assistant", content: "Performance answer", status: "complete" });
    const withTikTok = appendChatMessage(withPerformance, "tiktok", { id: "b", role: "assistant", content: "TikTok answer", status: "complete" });

    expect(withTikTok.ads.map((message) => message.content)).toEqual(["Performance answer"]);
    expect(withTikTok.tiktok.map((message) => message.content)).toEqual(["TikTok answer"]);
    expect(withTikTok.competitor).toEqual([]);
  });

  it("excludes UI error messages from provider history", () => {
    const history = requestHistory([
      { id: "1", role: "user", content: "Question", status: "complete" },
      { id: "2", role: "assistant", content: "Provider failed", status: "error", retryContent: "Question" },
    ]);

    expect(history).toEqual([{ role: "user", content: "Question" }]);
  });
});
