"use client";

import { BotMessageSquareIcon } from "lucide-react";
import type { DashboardView } from "@/lib/dashboard-access";
import type { InterfaceLanguage } from "@/lib/types";
import { contextChatCopy } from "@/components/dashboard/context-chat-copy";
import { Button } from "@/components/ui/button";

export function ContextChatLauncher({
  activeView,
  language,
  available,
  onOpen,
}: {
  activeView: DashboardView;
  language: InterfaceLanguage;
  available: boolean;
  onOpen: () => void;
}) {
  const copy = contextChatCopy(language, activeView);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 px-4" data-print-hidden>
      <div className="mx-auto flex max-w-screen-2xl justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onOpen}
          className="context-chat-standalone-pill pointer-events-auto h-12 rounded-full px-4"
          aria-label={`${copy.assistantLabel}: ${copy.viewLabel}`}
        >
          <span className="context-chat-pulse" data-available={available ? "true" : "false"} aria-hidden="true" />
          <BotMessageSquareIcon />
          <span className="font-medium">{copy.viewLabel}</span>
          <span className="text-muted-foreground">·</span>
          <span>{copy.assistantLabel}</span>
        </Button>
      </div>
    </div>
  );
}
