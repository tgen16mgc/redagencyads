import { afterEach, describe, expect, it, vi } from "vitest";
import { isAbortError, jsonFetch } from "@/lib/api-client";

function pendingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(init.signal?.reason ?? new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("jsonFetch", () => {
  it("identifies caller cancellation without treating ordinary errors as aborts", () => {
    expect(isAbortError(new DOMException("Cancelled", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("Request failed"))).toBe(false);
  });

  it("returns parsed json on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ accounts: [{ id: "act_1" }] }), { status: 200 })),
    );
    await expect(jsonFetch<{ accounts: { id: string }[] }>("/api/meta/accounts")).resolves.toEqual({
      accounts: [{ id: "act_1" }],
    });
  });

  it("throws the error envelope message on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Session expired." }), { status: 401 })),
    );
    await expect(jsonFetch("/api/session")).rejects.toThrow("Session expired.");
  });

  it("falls back to a generic message when the error body is not json", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })));
    await expect(jsonFetch("/api/session")).rejects.toThrow("Request failed.");
  });

  it("maps its own timeout abort to a friendly message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", pendingFetch());
    const promise = jsonFetch("/api/session", { timeoutMs: 8000 });
    const outcome = expect(promise).rejects.toThrow("Request timed out after 8s. Try again.");
    await vi.advanceTimersByTimeAsync(8000);
    await outcome;
  });

  it("uses a caller-supplied signal and rethrows its abort untouched", async () => {
    const fetchMock = pendingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const promise = jsonFetch("/api/session", { signal: controller.signal });
    const outcome = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await outcome;
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps the timeout active when a caller also supplies a cancellation signal", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", pendingFetch());
    const controller = new AbortController();
    const promise = jsonFetch("/api/session", { signal: controller.signal, timeoutMs: 4000 });
    const outcome = expect(promise).rejects.toThrow("Request timed out after 4s. Try again.");
    await vi.advanceTimersByTimeAsync(4000);
    await outcome;
  });
});
