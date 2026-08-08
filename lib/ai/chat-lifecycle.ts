import type { DashboardView } from "@/lib/dashboard-access";
import { CHAT_LIMITS, type ChatContext } from "@/lib/ai/chat-contract";
import { chatContextFingerprint } from "@/lib/ai/chat-context";
import {
  appendChatMessage,
  messagesForContext,
  requestHistory,
  type ChatDisplayMessage,
  type ChatThreads,
} from "@/lib/ai/chat-thread";
import type { InterfaceLanguage } from "@/lib/types";

export type ChatAbortIntent = "cancel" | "clear" | "context-change" | "reset" | "unmount";

export type ChatProgressStage = "preparing" | "analyzing" | "working" | "responding";

export type ChatLifecycleCopy = {
  cancelled: string;
  connectionError: string;
  genericError: string;
  interrupted: string;
  invalidResponse: string;
  responseReady: string;
};

type ActiveRequest = {
  id: string;
  fingerprint: string;
  question: string;
  controller: AbortController;
  abortIntent?: ChatAbortIntent;
};

type ChatFetchResponse = {
  ok: boolean;
  status?: number;
  headers?: { get: (name: string) => string | null };
  body?: ReadableStream<Uint8Array> | null;
  json: () => Promise<unknown>;
};

type ChatFetch = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  body: string;
}) => Promise<ChatFetchResponse>;

export type ChatLifecycleOptions = {
  fetchFn: ChatFetch;
  getContext: (view: DashboardView) => ChatContext;
  readThreads: () => ChatThreads;
  applyThreads: (updater: (current: ChatThreads) => ChatThreads) => void;
  setPending: (view: DashboardView, requestId: string | null) => void;
  onProgress?: (view: DashboardView, requestId: string, progress: { stage: ChatProgressStage; content: string }) => void;
  onReply: (view: DashboardView, announcement: string) => void;
};

export type ChatSendInput = {
  view: DashboardView;
  question: string;
  language: InterfaceLanguage;
  copy: ChatLifecycleCopy;
  reuseLastUser?: boolean;
};

function messageId(prefix: string) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

class ChatStreamError extends Error {
  constructor(message: string, public readonly partialReply: string) {
    super(message);
    this.name = "ChatStreamError";
  }
}

function isProgressStage(value: unknown): value is ChatProgressStage {
  return value === "preparing" || value === "analyzing" || value === "working" || value === "responding";
}

async function readChatResponse(
  response: ChatFetchResponse,
  copy: ChatLifecycleCopy,
  onProgress: (stage: ChatProgressStage, content: string) => void,
) {
  const contentType = response.headers?.get("content-type") || "";
  if (response.ok && contentType.includes("application/x-ndjson") && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let responseFingerprint: string | undefined;

    const consumeLine = (line: string) => {
      if (!line.trim()) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return;
      }

      if (event.type === "status" && isProgressStage(event.stage)) {
        onProgress(event.stage, content);
        return;
      }
      if (event.type === "delta" && typeof event.delta === "string") {
        content = `${content}${event.delta}`.slice(0, CHAT_LIMITS.assistantMessageCharacters);
        onProgress("responding", content);
        return;
      }
      if (event.type === "done") {
        if (typeof event.reply === "string" && event.reply.trim()) {
          content = event.reply.slice(0, CHAT_LIMITS.assistantMessageCharacters);
        }
        if (typeof event.contextFingerprint === "string") responseFingerprint = event.contextFingerprint;
        return;
      }
      if (event.type === "error") {
        throw new ChatStreamError(
          typeof event.error === "string" ? event.error : copy.genericError,
          content,
        );
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        lines.forEach(consumeLine);
      }
      buffer += decoder.decode();
      if (buffer) consumeLine(buffer);
    } catch (error) {
      if (error instanceof ChatStreamError || !content) throw error;
      throw new ChatStreamError(copy.connectionError, content);
    }
    if (!content.trim()) throw new Error(copy.invalidResponse);
    return { reply: content, contextFingerprint: responseFingerprint };
  }

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : copy.invalidResponse);
  if (typeof json.reply !== "string" || !json.reply.trim()) throw new Error(copy.invalidResponse);
  return {
    reply: json.reply.slice(0, CHAT_LIMITS.assistantMessageCharacters),
    contextFingerprint: typeof json.contextFingerprint === "string" ? json.contextFingerprint : undefined,
  };
}

export function createChatLifecycle(options: ChatLifecycleOptions) {
  const { fetchFn, getContext, readThreads, applyThreads, setPending, onProgress, onReply } = options;
  const requests = new Map<DashboardView, ActiveRequest>();

  function releaseRequest(view: DashboardView, requestId: string) {
    if (requests.get(view)?.id !== requestId) return;
    requests.delete(view);
    setPending(view, null);
  }

  function abort(view: DashboardView, intent: ChatAbortIntent, releaseImmediately = false) {
    const request = requests.get(view);
    if (!request) return;
    request.abortIntent = intent;
    request.controller.abort();
    if (releaseImmediately) releaseRequest(view, request.id);
  }

  function abortOnContextChange(view: DashboardView, fingerprint: string) {
    const request = requests.get(view);
    if (request && request.fingerprint !== fingerprint) abort(view, "context-change", true);
  }

  function reset() {
    for (const request of requests.values()) {
      request.abortIntent = "reset";
      request.controller.abort();
    }
    requests.clear();
  }

  function dispose() {
    for (const request of requests.values()) {
      request.abortIntent = "unmount";
      request.controller.abort();
    }
  }

  async function run(view: DashboardView, request: ActiveRequest, input: {
    context: ChatContext;
    language: InterfaceLanguage;
    copy: ChatLifecycleCopy;
    history: ReturnType<typeof requestHistory>;
  }) {
    const { copy } = input;
    const { id: requestId, fingerprint } = request;
    try {
      const response = await fetchFn("/api/ai/chat", {
        method: "POST",
        headers: {
          "accept": "application/x-ndjson, application/json",
          "content-type": "application/json",
        },
        signal: request.controller.signal,
        body: JSON.stringify({
          requestId,
          contextFingerprint: fingerprint,
          language: input.language,
          context: input.context,
          messages: input.history,
        }),
      });
      const result = await readChatResponse(response, copy, (stage, content) => {
        if (requests.get(view)?.id !== requestId || request.abortIntent) return;
        onProgress?.(view, requestId, { stage, content });
      });

      if (requests.get(view)?.id !== requestId || request.abortIntent) return;
      if (chatContextFingerprint(getContext(view)) !== fingerprint) return;
      const responseFingerprint = result.contextFingerprint || fingerprint;
      if (responseFingerprint !== fingerprint) return;

      applyThreads((current) => appendChatMessage(current, view, fingerprint, {
        id: messageId("assistant"),
        role: "assistant",
        content: result.reply,
        status: "complete",
        basedOnFingerprint: fingerprint,
      }));
      onReply(view, copy.responseReady);
    } catch (error) {
      if (requests.get(view)?.id !== requestId) return;
      const contextStillMatches = chatContextFingerprint(getContext(view)) === fingerprint;
      if (request.controller.signal.aborted) {
        if (request.abortIntent === "cancel" && contextStillMatches) {
          applyThreads((current) => appendChatMessage(current, view, fingerprint, {
            id: messageId("notice"),
            role: "assistant",
            content: copy.cancelled,
            status: "notice",
            retryContent: request.question,
          }));
        }
        return;
      }
      if (!contextStillMatches) return;
      const partialReply = error instanceof ChatStreamError ? error.partialReply.trim() : "";
      const message = error instanceof TypeError
        ? copy.connectionError
        : error instanceof Error ? error.message : copy.genericError;
      applyThreads((current) => appendChatMessage(current, view, fingerprint, {
        id: messageId(partialReply ? "notice" : "error"),
        role: "assistant",
        content: partialReply ? `${partialReply}\n\n${copy.interrupted}` : message,
        status: partialReply ? "notice" : "error",
        retryContent: request.question,
      }));
    } finally {
      releaseRequest(view, requestId);
    }
  }

  function send(input: ChatSendInput): Promise<void> | null {
    const { view } = input;
    const question = input.question.trim();
    if (!question || requests.has(view)) return null;

    const context = getContext(view);
    const fingerprint = chatContextFingerprint(context);
    const requestId = messageId("request").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    const userMessage: ChatDisplayMessage = {
      id: messageId("user"),
      role: "user",
      content: question.slice(0, CHAT_LIMITS.userMessageCharacters),
      status: "complete",
    };
    const currentMessages = messagesForContext(readThreads(), view, fingerprint);
    const nextMessages = input.reuseLastUser ? currentMessages : [...currentMessages, userMessage];
    if (!input.reuseLastUser) {
      applyThreads((current) => appendChatMessage(current, view, fingerprint, userMessage));
    }

    const request: ActiveRequest = { id: requestId, fingerprint, question, controller: new AbortController() };
    requests.set(view, request);
    setPending(view, requestId);

    return run(view, request, {
      context,
      language: input.language,
      copy: input.copy,
      history: requestHistory(nextMessages),
    });
  }

  return { send, abort, abortOnContextChange, reset, dispose };
}

export type ChatLifecycle = ReturnType<typeof createChatLifecycle>;
