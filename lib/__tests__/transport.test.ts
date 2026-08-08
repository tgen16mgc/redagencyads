import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confidenceValue,
  errorMessage,
  nineRouterChatCompletion,
  nineRouterChatCompletionStream,
  nineRouterCompletion,
  parseJsonObject,
  stringArray,
  stringValue,
} from "../ai/transport";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function nineRouterResponse(content: string, finishReason: string) {
  return new Response(JSON.stringify({
    choices: [{ finish_reason: finishReason, message: { content } }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("parseJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(parseJsonObject('{"verdict":"ok"}')).toEqual({ verdict: "ok" });
  });

  it("strips ```json code fences before parsing", () => {
    const fenced = '```json\n{"confidence":"high"}\n```';
    expect(parseJsonObject(fenced)).toEqual({ confidence: "high" });
  });

  it("strips bare ``` code fences before parsing", () => {
    expect(parseJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("extracts the object when wrapped in prose", () => {
    const text = 'Here is the verdict you asked for:\n{"verdict":"scale"}\nThanks!';
    expect(parseJsonObject(text)).toEqual({ verdict: "scale" });
  });

  it("does not treat braces inside string values as structure", () => {
    const text = '{"note":"use {curly} braces","ok":true}';
    expect(parseJsonObject(text)).toEqual({ note: "use {curly} braces", ok: true });
  });

  it("handles escaped quotes inside string values", () => {
    const text = '{"quote":"she said \\"hi\\"","n":2}';
    expect(parseJsonObject(text)).toEqual({ quote: 'she said "hi"', n: 2 });
  });

  it("returns the first complete object when multiple are present", () => {
    const text = '{"first":1} {"second":2}';
    expect(parseJsonObject(text)).toEqual({ first: 1 });
  });

  it("parses nested objects by matching balanced braces", () => {
    const text = 'noise {"outer":{"inner":"v"},"k":1} trailing';
    expect(parseJsonObject(text)).toEqual({ outer: { inner: "v" }, k: 1 });
  });

  it("throws when no valid JSON object is present", () => {
    expect(() => parseJsonObject("no json here")).toThrow();
  });
});

describe("stringValue", () => {
  it("returns the value when it is a string", () => {
    expect(stringValue("hello")).toBe("hello");
  });

  it("returns the fallback for non-string values", () => {
    expect(stringValue(42)).toBe("");
    expect(stringValue(null)).toBe("");
    expect(stringValue(undefined, "default")).toBe("default");
  });
});

describe("stringArray", () => {
  it("maps an array to strings and drops falsy entries", () => {
    expect(stringArray(["a", "", "b"])).toEqual(["a", "b"]);
  });

  it("drops non-string array items rather than coercing them", () => {
    expect(stringArray(["keep", 5, null, "also"])).toEqual(["keep", "also"]);
  });

  it("wraps a non-empty trimmed string into a single-element array", () => {
    expect(stringArray("  hi  ")).toEqual(["hi"]);
  });

  it("returns an empty array for empty or non-string non-array input", () => {
    expect(stringArray("   ")).toEqual([]);
    expect(stringArray(null)).toEqual([]);
    expect(stringArray(123)).toEqual([]);
  });
});

describe("confidenceValue", () => {
  it("passes through valid confidence levels", () => {
    expect(confidenceValue("low")).toBe("low");
    expect(confidenceValue("medium")).toBe("medium");
    expect(confidenceValue("high")).toBe("high");
  });

  it("defaults unknown values to medium", () => {
    expect(confidenceValue("very-high")).toBe("medium");
    expect(confidenceValue(undefined)).toBe("medium");
    expect(confidenceValue(null)).toBe("medium");
  });
});

describe("errorMessage", () => {
  it("returns the message from an Error instance", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns a generic message for non-Error values", () => {
    expect(errorMessage("string error")).toBe("request failed");
    expect(errorMessage(null)).toBe("request failed");
  });
});

describe("nineRouterCompletion", () => {
  it("retries length-truncated JSON with a larger output budget", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubEnv("NINEROUTER_URL", "http://localhost:20128");
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(nineRouterResponse('{"summary":"cut off', "length"))
      .mockResolvedValueOnce(nineRouterResponse('{"summary":"complete"}', "stop"));
    vi.stubGlobal("fetch", fetchSpy);

    const content = await nineRouterCompletion("Return JSON", { jsonMode: true, maxTokens: 1800 });

    expect(content).toBe('{"summary":"complete"}');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body));
    expect(firstBody.max_tokens).toBe(1800);
    expect(secondBody.max_tokens).toBe(2400);
  });

  it("rejects unusable JSON after the retry instead of returning it to callers", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(nineRouterResponse("not json", "stop"))
      .mockResolvedValueOnce(nineRouterResponse('{"still":"cut off', "length"));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(nineRouterCompletion("Return JSON", { jsonMode: true, maxTokens: 1800 }))
      .rejects.toThrow("valid JSON");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("retries transient gateway failures for streamed chat", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response("gateway unavailable", { status: 530, headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(nineRouterResponse("Recovered", "stop"));
    vi.stubGlobal("fetch", fetchSpy);
    const deltas: string[] = [];

    const answer = await nineRouterChatCompletionStream(
      [{ role: "user", content: "Question" }],
      { onDelta: (delta) => deltas.push(delta) },
    );

    expect(answer).toBe("Recovered");
    expect(deltas).toEqual(["Recovered"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects a length-truncated stream instead of presenting it as complete", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const body = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Incomplete answer" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })));
    const deltas: string[] = [];

    await expect(nineRouterChatCompletionStream(
      [{ role: "user", content: "Question" }],
      { onDelta: (delta) => deltas.push(delta) },
    )).rejects.toThrow("output limit");
    expect(deltas).toEqual(["Incomplete answer"]);
  });

  it("streams provider reasoning separately from the final answer", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    const body = [
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "hidden reasoning" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Streamed " } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "answer" } }] })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })));
    const deltas: string[] = [];
    const reasoning: string[] = [];

    const answer = await nineRouterChatCompletionStream(
      [{ role: "user", content: "Question" }],
      {
        onDelta: (delta) => deltas.push(delta),
        onReasoningDelta: (delta) => reasoning.push(delta),
      },
    );

    expect(answer).toBe("Streamed answer");
    expect(deltas).toEqual(["Streamed ", "answer"]);
    expect(reasoning).toEqual(["hidden reasoning"]);
  });

  it("routes adaptive reasoning requests through OpenRouter Nemotron", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "openrouter-key");
    vi.stubEnv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free");
    const body = [
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_details: [{ type: "reasoning.text", text: "Check constraints. " }] } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Recommendation" }, finish_reason: "stop" }] })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    const fetchSpy = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const reasoning: string[] = [];

    const answer = await nineRouterChatCompletionStream(
      [{ role: "user", content: "Create a detailed strategy" }],
      {
        maxTokens: 2400,
        reasoningEffort: "medium",
        onDelta: () => {},
        onReasoningDelta: (delta) => reasoning.push(delta),
      },
    );

    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(requestBody).toMatchObject({
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      max_tokens: 2400,
      reasoning: { effort: "medium", exclude: false },
      include_reasoning: true,
      stream: true,
    });
    expect(reasoning).toEqual(["Check constraints. "]);
    expect(answer).toBe("Recommendation");
  });

  it("sends system and conversation messages to the existing 9router endpoint", async () => {
    vi.stubEnv("NINEROUTER_KEY", "test-key");
    vi.stubEnv("NINEROUTER_URL", "http://localhost:20128/v1");
    const fetchSpy = vi.fn().mockResolvedValue(nineRouterResponse("Answer", "stop"));
    vi.stubGlobal("fetch", fetchSpy);

    await nineRouterChatCompletion([
      { role: "system", content: "Use workspace context." },
      { role: "user", content: "What should I fix?" },
    ], { maxTokens: 1400 });

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("http://localhost:20128/v1/chat/completions");
    expect(body.messages).toEqual([
      { role: "system", content: "Use workspace context." },
      { role: "user", content: "What should I fix?" },
    ]);
    expect(body.max_tokens).toBe(1400);
  });
});
