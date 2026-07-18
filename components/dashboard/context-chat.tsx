"use client";

import * as React from "react";
import {
  AlertCircleIcon,
  BotMessageSquareIcon,
  RotateCcwIcon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";
import type { DashboardView } from "@/lib/dashboard-access";
import { CHAT_LIMITS, type ChatContext } from "@/lib/ai/chat-contract";
import { chatContextFingerprint } from "@/lib/ai/chat-context";
import {
  appendChatMessage,
  clearChatThread,
  emptyChatThreads,
  messagesForContext,
  removeChatMessage,
  requestHistory,
  type ChatDisplayMessage,
  type ChatThreads,
} from "@/lib/ai/chat-thread";
import type { InterfaceLanguage } from "@/lib/types";
import { CONTEXT_CHAT_PANEL_ID, contextChatCopy } from "@/components/dashboard/context-chat-copy";
import { ContextChatLauncher } from "@/components/dashboard/context-chat-launcher";
import { ContextChatMarkdown } from "@/components/dashboard/context-chat-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PendingRequestIds = Record<DashboardView, string | null>;
type AbortIntent = "cancel" | "clear" | "context-change" | "reset" | "unmount";

type ActiveRequest = {
  id: string;
  view: DashboardView;
  fingerprint: string;
  question: string;
  controller: AbortController;
  abortIntent?: AbortIntent;
};

const EMPTY_PENDING_REQUEST_IDS: PendingRequestIds = {
  overview: null,
  ads: null,
  competitor: null,
  tiktok: null,
  publisher: null,
};

export type ContextChatHandle = {
  clearAll: () => void;
};

function messageId(prefix: string) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

function dialogOriginStyle(trigger: DOMRect, popup: DOMRect) {
  const x = trigger.left + trigger.width / 2 - (popup.left + popup.width / 2);
  const y = trigger.top + trigger.height / 2 - (popup.top + popup.height / 2);
  return {
    x: `${x}px`,
    y: `${y}px`,
    scaleX: String(Math.max(0.04, trigger.width / popup.width)),
    scaleY: String(Math.max(0.04, trigger.height / popup.height)),
  };
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
  const [threads, setThreads] = React.useState(emptyChatThreads);
  const [pendingRequestIds, setPendingRequestIds] = React.useState<PendingRequestIds>(EMPTY_PENDING_REQUEST_IDS);
  const [input, setInput] = React.useState("");
  const [announcement, setAnnouncement] = React.useState("");
  const threadsRef = React.useRef<ChatThreads>(threads);
  const requests = React.useRef(new Map<DashboardView, ActiveRequest>());
  const getContextRef = React.useRef(getContext);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const latestAssistantRef = React.useRef<HTMLElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const motionFrameRef = React.useRef<number | null>(null);
  const originFrameRef = React.useRef<number | null>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const activeViewRef = React.useRef(activeView);
  const activeContextRef = React.useRef("");
  const openRef = React.useRef(open);
  getContextRef.current = getContext;
  activeViewRef.current = activeView;
  openRef.current = open;

  const copy = contextChatCopy(language, activeView);
  const activeFingerprint = chatContextFingerprint(getContext(activeView));
  const messages = messagesForContext(threads, activeView, activeFingerprint);
  const isPending = pendingRequestIds[activeView] !== null;
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.status === "complete");

  const updateThreads = React.useCallback((updater: (current: ChatThreads) => ChatThreads) => {
    const next = updater(threadsRef.current);
    threadsRef.current = next;
    setThreads(next);
    return next;
  }, []);

  const releaseRequest = React.useCallback((view: DashboardView, requestId: string) => {
    if (requests.current.get(view)?.id !== requestId) return;
    requests.current.delete(view);
    setPendingRequestIds((current) => current[view] === requestId ? { ...current, [view]: null } : current);
  }, []);

  const abortRequest = React.useCallback((view: DashboardView, intent: AbortIntent, releaseImmediately = false) => {
    const request = requests.current.get(view);
    if (!request) return;
    request.abortIntent = intent;
    request.controller.abort();
    if (releaseImmediately) releaseRequest(view, request.id);
  }, [releaseRequest]);

  const clearAll = React.useCallback(() => {
    for (const request of requests.current.values()) {
      request.abortIntent = "reset";
      request.controller.abort();
    }
    requests.current.clear();
    const empty = emptyChatThreads();
    threadsRef.current = empty;
    setThreads(empty);
    setPendingRequestIds(EMPTY_PENDING_REQUEST_IDS);
    setInput("");
    setAnnouncement("");
  }, []);

  React.useImperativeHandle(ref, () => ({ clearAll }), [clearAll]);

  const measureDialogOrigin = React.useCallback((popup: HTMLDivElement, captureOpener = false) => {
    if (captureOpener) {
      const activeElement = document.activeElement;
      const trigger = document.querySelector<HTMLElement>('[data-context-chat-trigger="true"][aria-expanded="true"]');
      openerRef.current = trigger || (activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null);
    }

    const opener = openerRef.current;
    if (!opener) {
      popup.style.removeProperty("--chat-origin-x");
      popup.style.removeProperty("--chat-origin-y");
      popup.style.removeProperty("--chat-origin-scale-x");
      popup.style.removeProperty("--chat-origin-scale-y");
      return;
    }
    const origin = dialogOriginStyle(opener.getBoundingClientRect(), popup.getBoundingClientRect());
    popup.style.setProperty("--chat-origin-x", origin.x);
    popup.style.setProperty("--chat-origin-y", origin.y);
    popup.style.setProperty("--chat-origin-scale-x", origin.scaleX);
    popup.style.setProperty("--chat-origin-scale-y", origin.scaleY);
  }, []);

  const startDialogMotion = React.useCallback((popup: HTMLDivElement) => {
    if (motionFrameRef.current !== null) cancelAnimationFrame(motionFrameRef.current);
    measureDialogOrigin(popup, true);
    popup.dataset.chatMotion = "preparing";
    void popup.offsetWidth;
    motionFrameRef.current = requestAnimationFrame(() => {
      motionFrameRef.current = requestAnimationFrame(() => {
        motionFrameRef.current = null;
        if (openRef.current && popup.isConnected) popup.dataset.chatMotion = "open";
      });
    });
  }, [measureDialogOrigin]);

  const setPopupNode = React.useCallback((popup: HTMLDivElement | null) => {
    popupRef.current = popup;
    if (popup && openRef.current) startDialogMotion(popup);
  }, [startDialogMotion]);

  React.useLayoutEffect(() => {
    if (!open || !popupRef.current) return;
    startDialogMotion(popupRef.current);
  }, [open, startDialogMotion]);

  React.useEffect(() => {
    const scheduleOriginMeasurement = () => {
      if (originFrameRef.current !== null) cancelAnimationFrame(originFrameRef.current);
      originFrameRef.current = requestAnimationFrame(() => {
        originFrameRef.current = null;
        const popup = popupRef.current;
        if (popup?.isConnected && openerRef.current?.isConnected) measureDialogOrigin(popup);
      });
    };

    window.addEventListener("resize", scheduleOriginMeasurement);
    window.visualViewport?.addEventListener("resize", scheduleOriginMeasurement);
    window.visualViewport?.addEventListener("scroll", scheduleOriginMeasurement);
    return () => {
      window.removeEventListener("resize", scheduleOriginMeasurement);
      window.visualViewport?.removeEventListener("resize", scheduleOriginMeasurement);
      window.visualViewport?.removeEventListener("scroll", scheduleOriginMeasurement);
      if (originFrameRef.current !== null) cancelAnimationFrame(originFrameRef.current);
    };
  }, [measureDialogOrigin]);

  React.useEffect(() => {
    const contextKey = `${activeView}:${activeFingerprint}`;
    if (activeContextRef.current === contextKey) return;
    const request = requests.current.get(activeView);
    if (request && request.fingerprint !== activeFingerprint) {
      abortRequest(activeView, "context-change", true);
    }
    activeContextRef.current = contextKey;
    setInput("");
    setAnnouncement("");
  }, [abortRequest, activeFingerprint, activeView]);

  React.useEffect(() => {
    if (!open) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = !isPending && latestAssistantRef.current ? latestAssistantRef.current : messagesEndRef.current;
    target?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: isPending ? "end" : "start" });
  }, [isPending, latestAssistant?.id, messages.length, open]);

  React.useEffect(() => () => {
    if (motionFrameRef.current !== null) cancelAnimationFrame(motionFrameRef.current);
    if (originFrameRef.current !== null) cancelAnimationFrame(originFrameRef.current);
    for (const request of requests.current.values()) {
      request.abortIntent = "unmount";
      request.controller.abort();
    }
  }, []);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen && popupRef.current?.isConnected) {
      if (originFrameRef.current !== null) cancelAnimationFrame(originFrameRef.current);
      originFrameRef.current = null;
      measureDialogOrigin(popupRef.current);
    }
    onOpenChange(nextOpen);
  }, [measureDialogOrigin, onOpenChange]);

  const sendMessage = React.useCallback(async (questionOverride?: string, reuseLastUser = false) => {
    const originView = activeView;
    const question = (questionOverride ?? input).trim();
    if (!question || requests.current.has(originView) || !available) return;

    const context = getContextRef.current(originView);
    const fingerprint = chatContextFingerprint(context);
    const originCopy = contextChatCopy(language, originView);
    const requestId = messageId("request").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    const userMessage: ChatDisplayMessage = {
      id: messageId("user"),
      role: "user",
      content: question.slice(0, CHAT_LIMITS.userMessageCharacters),
      status: "complete",
    };
    const currentMessages = messagesForContext(threadsRef.current, originView, fingerprint);
    const nextMessages = reuseLastUser ? currentMessages : [...currentMessages, userMessage];

    if (!reuseLastUser) {
      updateThreads((current) => appendChatMessage(current, originView, fingerprint, userMessage));
    }
    setInput("");
    setAnnouncement("");

    const request: ActiveRequest = {
      id: requestId,
      view: originView,
      fingerprint,
      question,
      controller: new AbortController(),
    };
    requests.current.set(originView, request);
    setPendingRequestIds((current) => ({ ...current, [originView]: requestId }));

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: request.controller.signal,
        body: JSON.stringify({
          requestId,
          contextFingerprint: fingerprint,
          language,
          context,
          messages: requestHistory(nextMessages),
        }),
      });
      const json = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : originCopy.genericError);

      if (requests.current.get(originView)?.id !== requestId || request.abortIntent) return;
      if (chatContextFingerprint(getContextRef.current(originView)) !== fingerprint) return;
      const responseFingerprint = typeof json.contextFingerprint === "string" ? json.contextFingerprint : fingerprint;
      if (responseFingerprint !== fingerprint) return;

      updateThreads((current) => appendChatMessage(current, originView, fingerprint, {
        id: messageId("assistant"),
        role: "assistant",
        content: String(json.reply || originCopy.genericError).slice(0, CHAT_LIMITS.assistantMessageCharacters),
        status: "complete",
        basedOnFingerprint: fingerprint,
      }));
      if (originView === activeViewRef.current) setAnnouncement(originCopy.responseReady);
    } catch (error) {
      if (requests.current.get(originView)?.id !== requestId) return;
      const contextStillMatches = chatContextFingerprint(getContextRef.current(originView)) === fingerprint;
      if (request.controller.signal.aborted) {
        if (request.abortIntent === "cancel" && contextStillMatches) {
          updateThreads((current) => appendChatMessage(current, originView, fingerprint, {
            id: messageId("notice"),
            role: "assistant",
            content: originCopy.cancelled,
            status: "notice",
            retryContent: question,
          }));
        }
        return;
      }
      if (!contextStillMatches) return;
      updateThreads((current) => appendChatMessage(current, originView, fingerprint, {
        id: messageId("error"),
        role: "assistant",
        content: error instanceof Error ? error.message : originCopy.genericError,
        status: "error",
        retryContent: question,
      }));
    } finally {
      releaseRequest(originView, requestId);
    }
  }, [activeView, available, input, language, releaseRequest, updateThreads]);

  const retryMessage = React.useCallback((message: ChatDisplayMessage) => {
    if (!message.retryContent) return;
    updateThreads((current) => removeChatMessage(current, activeView, activeFingerprint, message.id));
    void sendMessage(message.retryContent, true);
  }, [activeFingerprint, activeView, sendMessage, updateThreads]);

  const clearCurrent = React.useCallback(() => {
    abortRequest(activeView, "clear", true);
    updateThreads((current) => clearChatThread(current, activeView, activeFingerprint));
    setInput("");
    setAnnouncement("");
  }, [abortRequest, activeFingerprint, activeView, updateThreads]);

  const chatPanel = (
    <section
      id={CONTEXT_CHAT_PANEL_ID}
      data-slot="context-chat"
      className="context-chat-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]"
    >
      <header className="context-chat-header relative border-b px-4 py-3.5 pr-16 sm:px-5 sm:py-4 sm:pr-18">
        <DialogClose
          render={
            <Button
              ref={closeButtonRef}
              type="button"
              variant="ghost"
              size="icon-lg"
              className="absolute top-2.5 right-2.5"
              aria-label={copy.close}
            />
          }
        >
          <XIcon />
        </DialogClose>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="context-chat-context-pill rounded-full">
            <BotMessageSquareIcon />
            {copy.viewLabel}
          </Badge>
          <Badge variant={available ? "success" : "outline"} className="rounded-full">
            {available ? copy.live : copy.unavailable}
          </Badge>
        </div>
        <DialogTitle className="mt-2 font-heading text-lg font-semibold">{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </header>

      <div className="context-chat-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5" aria-busy={isPending}>
        {!available ? (
          <div className="context-chat-empty border-warning/25 bg-warning/5">
            <AlertCircleIcon className="size-5 text-warning" />
            <div className="min-w-0">
              <p className="font-medium">{copy.unavailable}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.unavailableDescription}</p>
            </div>
            <DialogClose render={<Button type="button" variant="outline" size="lg" className="mt-1 w-fit" />}>
              {copy.close}
            </DialogClose>
          </div>
        ) : messages.length === 0 ? (
          <div className="context-chat-empty context-chat-empty-state">
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
                  className="context-chat-suggestion h-auto min-h-11 whitespace-normal rounded-full px-3 py-2 text-left"
                  style={{ "--suggestion-index": index } as React.CSSProperties}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <article
                key={message.id}
                ref={message.id === latestAssistant?.id ? latestAssistantRef : undefined}
                className={cn("context-chat-message flex gap-2", message.role === "user" && "justify-end")}
              >
                {message.role === "assistant" ? (
                  <span className={cn(
                    "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border",
                    message.status === "error" ? "text-destructive" : "text-primary",
                  )}>
                    {message.status === "error" ? <AlertCircleIcon className="size-4" /> : <BotMessageSquareIcon className="size-4" />}
                  </span>
                ) : null}
                <div className={cn(
                  "min-w-0 rounded-2xl px-3 py-2.5 text-sm leading-6",
                  message.role === "user"
                    ? "max-w-[85%] rounded-br-md bg-primary text-primary-foreground"
                    : "context-chat-assistant-message max-w-[calc(100%_-_2.25rem)] flex-1 rounded-bl-md border bg-card",
                  message.status === "error" && "border-destructive/35 bg-destructive/5 text-destructive",
                  message.status === "notice" && "bg-muted/50 text-foreground",
                )}>
                  {message.role === "assistant" && message.status === "complete" ? (
                    <ContextChatMarkdown content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                  {message.status !== "complete" && message.retryContent ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 -ml-2 min-h-11"
                      onClick={() => retryMessage(message)}
                    >
                      <RotateCcwIcon data-icon="inline-start" />
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
            ))}
            {isPending ? (
              <div className="context-chat-message flex items-center gap-2" role="status">
                <span className="flex size-7 items-center justify-center rounded-full border text-primary">
                  <BotMessageSquareIcon className="size-4" />
                </span>
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

      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>

      {available ? (
        <footer className="context-chat-footer border-t bg-popover/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, CHAT_LIMITS.userMessageCharacters))}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                void sendMessage();
              }}
              placeholder={copy.placeholder}
              rows={3}
              className="context-chat-composer max-h-36 min-h-20 resize-none text-base sm:text-sm"
            />
            {isPending ? (
              <Button type="button" variant="outline" size="icon-lg" onClick={() => abortRequest(activeView, "cancel")} aria-label={copy.cancel}>
                <SquareIcon />
              </Button>
            ) : (
              <Button type="button" size="icon-lg" onClick={() => void sendMessage()} disabled={!input.trim()} aria-label={copy.send}>
                <SendIcon />
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="context-chat-privacy text-[11px] leading-4 text-muted-foreground">{copy.privacy}</p>
            {messages.length ? (
              <Button type="button" variant="ghost" size="icon-lg" onClick={clearCurrent} aria-label={copy.clear} title={copy.clear}>
                <Trash2Icon />
              </Button>
            ) : null}
          </div>
        </footer>
      ) : null}
    </section>
  );

  return (
    <>
      {showStandaloneLauncher ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 px-2 sm:px-4" data-print-hidden>
          <div className="context-chat-island pointer-events-auto relative mx-auto overflow-hidden">
            <ContextChatLauncher
              activeView={activeView}
              language={language}
              available={available}
              open={open}
              onToggle={() => handleOpenChange(!open)}
            />
          </div>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          ref={setPopupNode}
          showCloseButton={false}
          initialFocus={() => available ? textareaRef.current : closeButtonRef.current}
          finalFocus={() => openerRef.current?.isConnected ? openerRef.current : null}
          className={cn(
            "context-chat-dialog top-auto bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex w-[min(48rem,calc(100vw-1rem))] translate-y-0 overflow-visible rounded-3xl bg-transparent shadow-none",
            available
              ? "h-[min(42rem,calc(100dvh-1rem-env(safe-area-inset-bottom)))]"
              : "h-auto max-h-[calc(100dvh-1rem-env(safe-area-inset-bottom))]",
          )}
        >
          <div className="context-chat-morph-shell" aria-hidden="true" />
          <div className="context-chat-panel-surface" aria-hidden="true" />
          {chatPanel}
        </DialogContent>
      </Dialog>
    </>
  );
});
