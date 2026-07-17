import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confidenceValue,
  errorMessage,
  nineRouterCompletion,
  parseJsonObject,
  promptInputJson,
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

describe("promptInputJson", () => {
  it("parses JSON that follows the Input JSON marker", () => {
    const prompt = 'Instructions here\n\nInput JSON:\n{"totals":{"spend":100}}';
    expect(promptInputJson(prompt)).toEqual({ totals: { spend: 100 } });
  });

  it("returns null when the marker is absent", () => {
    expect(promptInputJson('{"spend":1}')).toBeNull();
  });

  it("returns null when the content after the marker is not valid JSON", () => {
    expect(promptInputJson("Input JSON:\nnot json")).toBeNull();
  });

  it("uses the last marker occurrence", () => {
    const prompt = 'Input JSON:\n{"a":1}\nmore text\nInput JSON:\n{"b":2}';
    expect(promptInputJson(prompt)).toEqual({ b: 2 });
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
});
