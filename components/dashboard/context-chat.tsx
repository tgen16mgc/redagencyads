"use client";

import * as React from "react";
import { AlertCircleIcon, BotMessageSquareIcon, RotateCcwIcon, SendIcon, SquareIcon, Trash2Icon, UserIcon, XIcon } from "lucide-react";
import type { DashboardView } from "@/lib/dashboard-access";
import { CHAT_LIMITS, type ChatContext } from "@/lib/ai/chat-contract";
import { chatContextFingerprint } from "@/lib/ai/chat-context";
import {
  appendChatMessage,
  emptyChatThreads,
  removeChatMessage,
  requestHistory,
  type ChatDisplayMessage,
} from "@/lib/ai/chat-thread";
import type { InterfaceLanguage } from "@/lib/types";
import { contextChatCopy } from "@/components/dashboard/context-chat-copy";
import { ContextChatLauncher } from "@/components/dashboard/context-chat-launcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type PendingViews = Record<DashboardView, boolean>;

const EMPTY_PENDING: PendingViews = {
  overview: false,
  ads: false,
  competitor: false,
  tiktok: false,
  publisher: false,
};

export type ContextChatHandle = {
  clearAll: () => void;
};

function messageId(prefix: string) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export const ContextChat = React.forwardRef<ContextChatHandle, {
  activeView: DashboardView;
  language: InterfaceLanguage;
  available: boolean;
  open: boolean;
  showStandaloneLauncher: boolean;
  getContext: (view: DashboardView) => ChatContext;
  onOpenChange: (open: boolean) => void;
}>(function ContextChat({ activeView, language, available, open, showStandaloneLauncher, getContext, onOpenChange }, ref) {
  const isMobile = useIsMobile();
  const [threads, setThreads] = React.useState(emptyChatThreads);
  const [pendingViews, setPendingViews] = React.useState<PendingViews>(EMPTY_PENDING);
  const [input, setInput] = React.useState("");
  const controllers = React.useRef(new Map<DashboardView, AbortController>());
  const getContextRef = React.useRef(getContext);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  getContextRef.current = getContext;

  const copy = contextChatCopy(language, activeView);
  const messages = threads[activeView];
  const isPending = pendingViews[activeView];
  const activeFingerprint = chatContextFingerprint(getContext(activeView));
  const latestAnnouncement = [...messages].reverse().find((message) => message.role === "assistant" && message.status === "complete")?.content || "";

  const clearAll = React.useCallback(() => {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    setThreads(emptyChatThreads());
    setPendingViews(EMPTY_PENDING);
    setInput("");
  }, []);

  React.useImperativeHandle(ref, () => ({ clearAll }), [clearAll]);

  React.useEffect(() => {
    if (!open) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "end" });
  }, [isPending, messages.length, open]);

  React.useEffect(() => () => {
    for (const controller of controllers.current.values()) controller.abort();
  }, []);

  const setViewPending = React.useCallback((view: DashboardView, pending: boolean) => {
    setPendingViews((current) => ({ ...current, [view]: pending }));
  }, []);

  const sendMessage = React.useCallback(async (questionOverride?: string, reuseLastUser = false) => {
    const originView = activeView;
    const question = (questionOverride ?? input).trim();
    if (!question || pendingViews[originView] || !available) return;

    const context = getContextRef.current(originView);
    const contextFingerprint = chatContextFingerprint(context);
    const requestId = messageId("request").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    const userMessage: ChatDisplayMessage = {
      id: messageId("user"),
      role: "user",
      content: question.slice(0, CHAT_LIMITS.userMessageCharacters),
      status: "complete",
    };
    const currentMessages = threads[originView];
    const nextMessages = reuseLastUser ? currentMessages : [...currentMessages, userMessage];

    if (!reuseLastUser) setThreads((current) => appendChatMessage(current, originView, userMessage));
    setInput("");
    setViewPending(originView, true);
    const controller = new AbortController();
    controllers.current.set(originView, controller);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          requestId,
          contextFingerprint,
          language,
          context,
          messages: requestHistory(nextMessages),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || copy.genericError);

      setThreads((current) => appendChatMessage(current, originView, {
        id: messageId("assistant"),
        role: "assistant",
        content: String(json.reply || copy.genericError).slice(0, CHAT_LIMITS.assistantMessageCharacters),
        status: "complete",
        basedOnFingerprint: String(json.contextFingerprint || contextFingerprint),
      }));
    } catch (error) {
      const errorText = controller.signal.aborted
        ? copy.cancelled
        : error instanceof Error ? error.message : copy.genericError;
      setThreads((current) => appendChatMessage(current, originView, {
        id: messageId("error"),
        role: "assistant",
        content: errorText,
        status: "error",
        retryContent: question,
      }));
    } finally {
      controllers.current.delete(originView);
      setViewPending(originView, false);
    }
  }, [activeView, available, copy.cancelled, copy.genericError, input, language, pendingViews, setViewPending, threads]);

  const retryMessage = React.useCallback((message: ChatDisplayMessage) => {
    if (!message.retryContent) return;
    setThreads((current) => removeChatMessage(current, activeView, message.id));
    void sendMessage(message.retryContent, true);
  }, [activeView, sendMessage]);

  const clearCurrent = () => {
    controllers.current.get(activeView)?.abort();
    setThreads((current) => ({ ...current, [activeView]: [] }));
  };

  return (
    <>
      {showStandaloneLauncher ? (
        <ContextChatLauncher activeView={activeView} language={language} available={available} onOpen={() => onOpenChange(true)} />
      ) : null}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "context-chat-panel gap-0 overflow-hidden p-0",
            isMobile ? "max-h-[92svh] rounded-t-2xl" : "w-full sm:max-w-lg",
          )}
          data-slot="context-chat"
          showCloseButton={false}
        >
          <SheetHeader className="border-b px-4 py-4 pr-14">
            <SheetClose
              render={
                <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3" aria-label={copy.close} />
              }
            >
              <XIcon />
            </SheetClose>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="context-chat-context-pill rounded-full">
                <BotMessageSquareIcon />
                {copy.viewLabel}
              </Badge>
              <Badge variant={available ? "success" : "outline"} className="rounded-full">
                {available ? "9router live" : copy.unavailable}
              </Badge>
            </div>
            <SheetTitle className="mt-2 text-lg">{copy.title}</SheetTitle>
            <SheetDescription>{copy.description}</SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-busy={isPending}>
            {!available ? (
              <div className="context-chat-empty border-warning/25 bg-warning/5">
                <AlertCircleIcon className="size-5 text-warning" />
                <div>
                  <p className="font-medium">{copy.unavailable}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.unavailableDescription}</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="context-chat-empty">
                <BotMessageSquareIcon className="size-6 text-primary" />
                <div>
                  <h3 className="font-heading text-base font-semibold">{copy.emptyTitle}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.emptyDescription}</p>
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {copy.suggestions.map((suggestion, index) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void sendMessage(suggestion)}
                      className="context-chat-suggestion h-auto min-h-9 whitespace-normal rounded-full px-3 py-2 text-left"
                      style={{ "--suggestion-index": index } as React.CSSProperties}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((message) => {
                  const stale = message.basedOnFingerprint && message.basedOnFingerprint !== activeFingerprint;
                  return (
                    <article
                      key={message.id}
                      className={cn(
                        "context-chat-message flex gap-2",
                        message.role === "user" && "justify-end",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <span className={cn("mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border", message.status === "error" ? "text-destructive" : "text-primary")}>
                          {message.status === "error" ? <AlertCircleIcon className="size-4" /> : <BotMessageSquareIcon className="size-4" />}
                        </span>
                      ) : null}
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-6",
                        message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card",
                        message.status === "error" && "border-destructive/35 bg-destructive/5 text-destructive",
                      )}>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        {stale ? <p className="mt-2 text-[11px] text-muted-foreground">{copy.stale}</p> : null}
                        {message.status === "error" && message.retryContent ? (
                          <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => retryMessage(message)}>
                            <RotateCcwIcon />
                            {copy.retry}
                          </Button>
                        ) : null}
                      </div>
                      {message.role === "user" ? (
                        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground">
                          <UserIcon className="size-4" />
                        </span>
                      ) : null}
                    </article>
                  );
                })}
                {isPending ? (
                  <div className="context-chat-message flex items-center gap-2" role="status">
                    <span className="flex size-7 items-center justify-center rounded-full border text-primary"><BotMessageSquareIcon className="size-4" /></span>
                    <div className="context-chat-typing rounded-2xl rounded-bl-md border bg-card px-3 py-3" aria-label={copy.working}>
                      <span /><span /><span />
                    </div>
                    <span className="text-xs text-muted-foreground">{copy.working}</span>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <span className="sr-only" aria-live="polite">{latestAnnouncement}</span>

          <SheetFooter className="border-t bg-popover/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, CHAT_LIMITS.userMessageCharacters))}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  void sendMessage();
                }}
                placeholder={available ? copy.placeholder : copy.unavailable}
                disabled={!available}
                rows={3}
                className="max-h-36 min-h-20 resize-none"
              />
              {isPending ? (
                <Button type="button" variant="outline" size="icon-lg" onClick={() => controllers.current.get(activeView)?.abort()} aria-label={copy.cancel}>
                  <SquareIcon />
                </Button>
              ) : (
                <Button type="button" size="icon-lg" onClick={() => void sendMessage()} disabled={!available || !input.trim()} aria-label={copy.send}>
                  <SendIcon />
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] leading-4 text-muted-foreground">{copy.privacy}</p>
              {messages.length ? (
                <Button type="button" variant="ghost" size="icon" onClick={clearCurrent} aria-label={copy.clear} title={copy.clear}>
                  <Trash2Icon />
                </Button>
              ) : null}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
});
