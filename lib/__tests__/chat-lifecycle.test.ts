import { describe, expect, it } from "vitest";
import type { DashboardView } from "../dashboard-access";
import type { ChatContext } from "../ai/chat-contract";
import { chatContextFingerprint } from "../ai/chat-context";
import { createChatLifecycle, type ChatLifecycleCopy } from "../ai/chat-lifecycle";
import { emptyChatThreads, messagesForContext } from "../ai/chat-thread";

const copy: ChatLifecycleCopy = {
  cancelled: "Request stopped.",
  genericError: "Could not get an answer.",
  responseReady: "Assistant response ready.",
};

function overviewContext(workspaceLabel: string): ChatContext {
  return { view: "overview", workspaceLabel, authenticated: true, capabilities: [] };
}

function createHarness() {
  const contexts = new Map<DashboardView, ChatContext>();
  let threads = emptyChatThreads();
  const pendingLog: Array<{ view: DashboardView; requestId: string | null }> = [];
  const replies: Array<{ view: DashboardView; announcement: string }> = [];
  const calls: Array<{
    body: Record<string, unknown>;
    respond: (payload: unknown, ok?: boolean) => void;
    fail: (error: Error) => void;
  }> = [];

  const lifecycle = createChatLifecycle({
    fetchFn: (_url, init) => new Promise((resolve, reject) => {
      calls.push({
        body: JSON.parse(init.body) as Record<string, unknown>,
        respond: (payload, ok = true) => resolve({ ok, json: async () => payload }),
        fail: reject,
      });
    }),
    getContext: (view) => contexts.get(view)!,
    readThreads: () => threads,
    applyThreads: (updater) => { threads = updater(threads); },
    setPending: (view, requestId) => pendingLog.push({ view, requestId }),
    onReply: (view, announcement) => replies.push({ view, announcement }),
  });

  return {
    lifecycle,
    contexts,
    calls,
    pendingLog,
    replies,
    send: (view: DashboardView, question: string, reuseLastUser = false) =>
      lifecycle.send({ view, question, language: "en", copy, reuseLastUser }),
    messages: (view: DashboardView) => threads[view].messages,
    messagesFor: (view: DashboardView, context: ChatContext) =>
      messagesForContext(threads, view, chatContextFingerprint(context)),
  };
}

describe("chat lifecycle", () => {
  it("delivers a reply to the originating view's thread", async () => {
    const harness = createHarness();
    const context = overviewContext("Workspace A");
    const fingerprint = chatContextFingerprint(context);
    harness.contexts.set("overview", context);

    const settled = harness.send("overview", "  How is spend?  ");
    expect(settled).not.toBeNull();
    expect(harness.pendingLog).toEqual([{ view: "overview", requestId: harness.calls[0].body.requestId }]);
    expect(harness.calls[0].body.contextFingerprint).toBe(fingerprint);
    expect(harness.calls[0].body.messages).toEqual([{ role: "user", content: "How is spend?" }]);

    harness.calls[0].respond({ contextFingerprint: fingerprint, reply: "Spend looks fine." });
    await settled;

    const messages = harness.messagesFor("overview", context);
    expect(messages.map((message) => [message.role, message.content, message.status])).toEqual([
      ["user", "How is spend?", "complete"],
      ["assistant", "Spend looks fine.", "complete"],
    ]);
    expect(messages[1].basedOnFingerprint).toBe(fingerprint);
    expect(harness.messages("competitor")).toEqual([]);
    expect(harness.replies).toEqual([{ view: "overview", announcement: copy.responseReady }]);
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });
  });

  it("rejects empty questions and re-sends while a request is in flight", () => {
    const harness = createHarness();
    harness.contexts.set("overview", overviewContext("Workspace A"));

    expect(harness.send("overview", "   ")).toBeNull();
    expect(harness.send("overview", "First question")).not.toBeNull();
    expect(harness.send("overview", "Second question")).toBeNull();
    expect(harness.calls).toHaveLength(1);
    expect(harness.messages("overview").map((message) => message.content)).toEqual(["First question"]);
  });

  it("cancel appends a retryable notice when the context still matches", async () => {
    const harness = createHarness();
    harness.contexts.set("overview", overviewContext("Workspace A"));

    const settled = harness.send("overview", "cancel me");
    harness.lifecycle.abort("overview", "cancel");
    harness.calls[0].fail(new Error("aborted"));
    await settled;

    const messages = harness.messages("overview");
    expect(messages.map((message) => [message.content, message.status])).toEqual([
      ["cancel me", "complete"],
      [copy.cancelled, "notice"],
    ]);
    expect(messages[1].retryContent).toBe("cancel me");
    expect(harness.replies).toEqual([]);
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });
  });

  it("cancel stays silent when the context changed mid-flight", async () => {
    const harness = createHarness();
    harness.contexts.set("overview", overviewContext("Workspace A"));

    const settled = harness.send("overview", "cancel me");
    harness.contexts.set("overview", overviewContext("Workspace B"));
    harness.lifecycle.abort("overview", "cancel");
    harness.calls[0].fail(new Error("aborted"));
    await settled;

    expect(harness.messages("overview").map((message) => message.content)).toEqual(["cancel me"]);
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });
  });

  it("cancel drops a response that raced the abort without a notice", async () => {
    const harness = createHarness();
    const context = overviewContext("Workspace A");
    harness.contexts.set("overview", context);

    const settled = harness.send("overview", "cancel me");
    harness.lifecycle.abort("overview", "cancel");
    harness.calls[0].respond({ contextFingerprint: chatContextFingerprint(context), reply: "Too late" });
    await settled;

    expect(harness.messages("overview").map((message) => message.content)).toEqual(["cancel me"]);
    expect(harness.replies).toEqual([]);
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });
  });

  it("clear releases immediately and drops the late response without a notice", async () => {
    const harness = createHarness();
    const context = overviewContext("Workspace A");
    harness.contexts.set("overview", context);

    const settled = harness.send("overview", "clear-request");
    harness.lifecycle.abort("overview", "clear", true);
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });

    harness.calls[0].respond({ contextFingerprint: chatContextFingerprint(context), reply: "Reply: clear-request" });
    await settled;

    expect(harness.messages("overview").map((message) => message.content)).toEqual(["clear-request"]);
    expect(harness.replies).toEqual([]);
  });

  it("aborts on a context change and lets a matching fingerprint request finish", async () => {
    const harness = createHarness();
    const contextA = overviewContext("Workspace A");
    const contextB = overviewContext("Workspace B");
    harness.contexts.set("overview", contextA);

    const staleSettled = harness.send("overview", "old context question");
    harness.contexts.set("overview", contextB);
    harness.lifecycle.abortOnContextChange("overview", chatContextFingerprint(contextB));
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });
    harness.calls[0].fail(new Error("aborted"));
    await staleSettled;
    expect(harness.messagesFor("overview", contextA).map((message) => message.status)).toEqual(["complete"]);

    const freshSettled = harness.send("overview", "new context question");
    harness.lifecycle.abortOnContextChange("overview", chatContextFingerprint(contextB));
    harness.calls[1].respond({ contextFingerprint: chatContextFingerprint(contextB), reply: "Fresh answer" });
    await freshSettled;
    expect(harness.messagesFor("overview", contextB).map((message) => message.content)).toEqual([
      "new context question",
      "Fresh answer",
    ]);
  });

  it("never lets an older response overwrite a newer request's thread", async () => {
    const harness = createHarness();
    const context = overviewContext("Workspace A");
    const fingerprint = chatContextFingerprint(context);
    harness.contexts.set("overview", context);

    const oldSettled = harness.send("overview", "slow-old-request");
    harness.lifecycle.abort("overview", "clear", true);
    const newSettled = harness.send("overview", "fast-new-request");

    harness.calls[1].respond({ contextFingerprint: fingerprint, reply: "Reply: fast-new-request" });
    await newSettled;
    harness.calls[0].respond({ contextFingerprint: fingerprint, reply: "Reply: slow-old-request" });
    await oldSettled;

    expect(harness.messages("overview").map((message) => message.content)).toEqual([
      "slow-old-request",
      "fast-new-request",
      "Reply: fast-new-request",
    ]);
  });

  it("reset abandons in-flight requests across views without releasing pending state", async () => {
    const harness = createHarness();
    const overview = overviewContext("Workspace A");
    const competitor = overviewContext("Competitor context");
    harness.contexts.set("overview", overview);
    harness.contexts.set("competitor", competitor);

    const overviewSettled = harness.send("overview", "overview question");
    const competitorSettled = harness.send("competitor", "competitor question");
    harness.lifecycle.reset();
    const pendingLength = harness.pendingLog.length;

    harness.calls[0].fail(new Error("aborted"));
    harness.calls[1].respond({ contextFingerprint: chatContextFingerprint(competitor), reply: "Too late" });
    await Promise.all([overviewSettled, competitorSettled]);

    expect(harness.messages("overview").map((message) => message.content)).toEqual(["overview question"]);
    expect(harness.messages("competitor").map((message) => message.content)).toEqual(["competitor question"]);
    expect(harness.pendingLog.length).toBe(pendingLength);
    expect(harness.send("overview", "after reset")).not.toBeNull();
  });

  it("unmount abort stays silent but releases pending state", async () => {
    const harness = createHarness();
    harness.contexts.set("overview", overviewContext("Workspace A"));

    const settled = harness.send("overview", "unmount question");
    harness.lifecycle.dispose();
    harness.calls[0].fail(new Error("aborted"));
    await settled;

    expect(harness.messages("overview").map((message) => message.content)).toEqual(["unmount question"]);
    expect(harness.replies).toEqual([]);
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });
  });

  it("drops a reply when the live context no longer matches the request", async () => {
    const harness = createHarness();
    const contextA = overviewContext("Workspace A");
    harness.contexts.set("overview", contextA);

    const settled = harness.send("overview", "stale context question");
    harness.contexts.set("overview", overviewContext("Workspace B"));
    harness.calls[0].respond({ contextFingerprint: chatContextFingerprint(contextA), reply: "Stale answer" });
    await settled;

    expect(harness.messagesFor("overview", contextA).map((message) => message.content)).toEqual(["stale context question"]);
    expect(harness.replies).toEqual([]);
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });
  });

  it("drops a reply whose response fingerprint disagrees and accepts one without a fingerprint", async () => {
    const harness = createHarness();
    const context = overviewContext("Workspace A");
    harness.contexts.set("overview", context);

    const mismatched = harness.send("overview", "first question");
    harness.calls[0].respond({ contextFingerprint: "deadbeef", reply: "Wrong context" });
    await mismatched;
    expect(harness.messages("overview").map((message) => message.content)).toEqual(["first question"]);

    const unfingerprinted = harness.send("overview", "second question");
    harness.calls[1].respond({ reply: "Accepted answer" });
    await unfingerprinted;
    expect(harness.messages("overview").at(-1)?.content).toBe("Accepted answer");
  });

  it("appends retryable error messages for server and network failures", async () => {
    const harness = createHarness();
    harness.contexts.set("overview", overviewContext("Workspace A"));

    const serverError = harness.send("overview", "server question");
    harness.calls[0].respond({ error: "Rate limited" }, false);
    await serverError;

    const networkError = harness.send("overview", "network question");
    harness.calls[1].fail(new Error("boom"));
    await networkError;

    const failures = harness.messages("overview").filter((message) => message.status === "error");
    expect(failures.map((message) => [message.content, message.retryContent])).toEqual([
      ["Rate limited", "server question"],
      ["boom", "network question"],
    ]);
    expect(harness.pendingLog.at(-1)).toEqual({ view: "overview", requestId: null });
  });

  it("reuses the last user message on retry instead of appending a duplicate", async () => {
    const harness = createHarness();
    const context = overviewContext("Workspace A");
    harness.contexts.set("overview", context);

    const failed = harness.send("overview", "Question");
    harness.calls[0].respond({}, false);
    await failed;
    expect(harness.messages("overview")).toHaveLength(2);

    const retried = harness.send("overview", "Question", true);
    expect(harness.messages("overview")).toHaveLength(2);
    expect(harness.calls[1].body.messages).toEqual([{ role: "user", content: "Question" }]);

    harness.calls[1].respond({ contextFingerprint: chatContextFingerprint(context), reply: "Recovered" });
    await retried;
    expect(harness.messages("overview").at(-1)?.content).toBe("Recovered");
  });
});
