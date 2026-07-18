import type { DashboardView } from "@/lib/dashboard-access";
import type { ChatRequestMessage } from "@/lib/ai/chat-contract";

export type ChatDisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "error";
  basedOnFingerprint?: string;
  retryContent?: string;
};

export type ChatThreads = Record<DashboardView, ChatDisplayMessage[]>;

export function emptyChatThreads(): ChatThreads {
  return { overview: [], ads: [], competitor: [], tiktok: [], publisher: [] };
}

export function appendChatMessage(threads: ChatThreads, view: DashboardView, message: ChatDisplayMessage): ChatThreads {
  return { ...threads, [view]: [...threads[view], message] };
}

export function removeChatMessage(threads: ChatThreads, view: DashboardView, id: string): ChatThreads {
  return { ...threads, [view]: threads[view].filter((message) => message.id !== id) };
}

export function requestHistory(messages: ChatDisplayMessage[]): ChatRequestMessage[] {
  return messages
    .filter((message) => message.status === "complete")
    .slice(-12)
    .map(({ role, content }) => ({ role, content }));
}
