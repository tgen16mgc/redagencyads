"use client";

import { BotMessageSquareIcon } from "lucide-react";
import type { DashboardView } from "@/lib/dashboard-access";
import type { InterfaceLanguage } from "@/lib/types";
import { CONTEXT_CHAT_PANEL_ID, contextChatCopy } from "@/components/dashboard/context-chat-copy";
import { Button } from "@/components/ui/button";

export function ContextChatLauncher({
  activeView,
  language,
  available,
  open,
  onToggle,
}: {
  activeView: DashboardView;
  language: InterfaceLanguage;
  available: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const copy = contextChatCopy(language, activeView);
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onToggle}
      data-open={open ? "true" : "false"}
      data-context-chat-trigger="true"
      className="context-chat-standalone-pill h-full w-full rounded-[inherit] border-0 px-4"
      aria-label={`${copy.assistantLabel}: ${copy.viewLabel}`}
      aria-expanded={open}
      aria-controls={CONTEXT_CHAT_PANEL_ID}
    >
      <span className="context-chat-pulse" data-available={available ? "true" : "false"} aria-hidden="true" />
      <BotMessageSquareIcon />
      <span className="font-medium">{copy.viewLabel}</span>
      <span className="text-muted-foreground">·</span>
      <span>{copy.assistantLabel}</span>
    </Button>
  );
}
