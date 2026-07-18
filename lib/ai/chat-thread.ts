import type { DashboardView } from "@/lib/dashboard-access";
import type { ChatRequestMessage } from "@/lib/ai/chat-contract";

export type ChatDisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "error" | "notice";
  basedOnFingerprint?: string;
  retryContent?: string;
};

export type ChatThread = {
  fingerprint: string | null;
  messages: ChatDisplayMessage[];
};

export type ChatThreads = Record<DashboardView, ChatThread>;

function emptyChatThread(): ChatThread {
  return { fingerprint: null, messages: [] };
}

export function emptyChatThreads(): ChatThreads {
  return {
    overview: emptyChatThread(),
    ads: emptyChatThread(),
    competitor: emptyChatThread(),
    tiktok: emptyChatThread(),
    publisher: emptyChatThread(),
  };
}

export function messagesForContext(threads: ChatThreads, view: DashboardView, fingerprint: string): ChatDisplayMessage[] {
  const thread = threads[view];
  return thread.fingerprint === fingerprint ? thread.messages : [];
}

export function appendChatMessage(
  threads: ChatThreads,
  view: DashboardView,
  fingerprint: string,
  message: ChatDisplayMessage,
): ChatThreads {
  const messages = messagesForContext(threads, view, fingerprint);
  return {
    ...threads,
    [view]: { fingerprint, messages: [...messages, message] },
  };
}

export function removeChatMessage(
  threads: ChatThreads,
  view: DashboardView,
  fingerprint: string,
  id: string,
): ChatThreads {
  return {
    ...threads,
    [view]: {
      fingerprint,
      messages: messagesForContext(threads, view, fingerprint).filter((message) => message.id !== id),
    },
  };
}

export function clearChatThread(threads: ChatThreads, view: DashboardView, fingerprint: string): ChatThreads {
  return { ...threads, [view]: { fingerprint, messages: [] } };
}

export function requestHistory(messages: ChatDisplayMessage[]): ChatRequestMessage[] {
  return messages
    .filter((message) => message.status === "complete")
    .slice(-12)
    .map(({ role, content }) => ({ role, content }));
}
