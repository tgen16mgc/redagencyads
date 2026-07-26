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

export type ChatLifecycleCopy = {
  cancelled: string;
  genericError: string;
  responseReady: string;
};

type ActiveRequest = {
  id: string;
  fingerprint: string;
  question: string;
  controller: AbortController;
  abortIntent?: ChatAbortIntent;
};

type ChatFetch = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  body: string;
}) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export type ChatLifecycleOptions = {
  fetchFn: ChatFetch;
  getContext: (view: DashboardView) => ChatContext;
  readThreads: () => ChatThreads;
  applyThreads: (updater: (current: ChatThreads) => ChatThreads) => void;
  setPending: (view: DashboardView, requestId: string | null) => void;
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

export function createChatLifecycle(options: ChatLifecycleOptions) {
  const { fetchFn, getContext, readThreads, applyThreads, setPending, onReply } = options;
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
        headers: { "content-type": "application/json" },
        signal: request.controller.signal,
        body: JSON.stringify({
          requestId,
          contextFingerprint: fingerprint,
          language: input.language,
          context: input.context,
          messages: input.history,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : copy.genericError);

      if (requests.get(view)?.id !== requestId || request.abortIntent) return;
      if (chatContextFingerprint(getContext(view)) !== fingerprint) return;
      const responseFingerprint = typeof json.contextFingerprint === "string" ? json.contextFingerprint : fingerprint;
      if (responseFingerprint !== fingerprint) return;

      applyThreads((current) => appendChatMessage(current, view, fingerprint, {
        id: messageId("assistant"),
        role: "assistant",
        content: String(json.reply || copy.genericError).slice(0, CHAT_LIMITS.assistantMessageCharacters),
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
      applyThreads((current) => appendChatMessage(current, view, fingerprint, {
        id: messageId("error"),
        role: "assistant",
        content: error instanceof Error ? error.message : copy.genericError,
        status: "error",
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
