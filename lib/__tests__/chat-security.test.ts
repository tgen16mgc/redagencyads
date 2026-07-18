import { describe, expect, it } from "vitest";
import { consumeChatRateLimit, isSameOriginRequest, resetChatRateLimits } from "../ai/chat-security";

describe("chat request security", () => {
  it("requires same-origin browser requests", () => {
    const sameOrigin = new Request("https://app.example/api/ai/chat", {
      headers: { origin: "https://app.example", host: "app.example", "sec-fetch-site": "same-origin" },
    });
    const crossOrigin = new Request("https://app.example/api/ai/chat", {
      headers: { origin: "https://attacker.example", host: "app.example", "sec-fetch-site": "cross-site" },
    });
    const noOrigin = new Request("https://app.example/api/ai/chat", { headers: { host: "app.example" } });

    expect(isSameOriginRequest(sameOrigin)).toBe(true);
    expect(isSameOriginRequest(crossOrigin)).toBe(false);
    expect(isSameOriginRequest(noOrigin)).toBe(false);
  });

  it("limits public provider usage per client window", () => {
    resetChatRateLimits();
    for (let index = 0; index < 20; index += 1) {
      expect(consumeChatRateLimit("client", 1_000).allowed).toBe(true);
    }
    const blocked = consumeChatRateLimit("client", 1_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(300);
  });
});
