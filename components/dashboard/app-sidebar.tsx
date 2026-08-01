"use client";

import * as React from "react";
import { SettingsIcon, SparklesIcon, WaypointsIcon } from "lucide-react";
import type { CapabilityState } from "@/lib/capabilities";
import type { DashboardWorkflowState, DashboardWorkflowStep } from "@/lib/dashboard-workflow";
import { cn } from "@/lib/utils";

type SidebarIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type AppSidebarItem<T extends string> = {
  value: T;
  label: string;
  icon: SidebarIcon;
};

export type WorkflowSidebarItem = AppSidebarItem<DashboardWorkflowStep> & {
  state: DashboardWorkflowState;
  stateLabel: string;
};

type AppSidebarProps<T extends string> = {
  activeView: T;
  aiProviderLabel: string;
  appItems: AppSidebarItem<T>[];
  functionsLabel: string;
  showWorkflow: boolean;
  workflowLabel: string;
  workflowItems: WorkflowSidebarItem[];
  aiSetupLabel: string;
  aiStatusTitle: string;
  aiStatusState: CapabilityState;
  userName: string;
  userInitials: string;
  userAvatarDataUrl?: string;
  assistantOpen: boolean;
  onActiveViewChange: (value: T) => void;
  onOpenAssistant: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
};

export function AppSidebar<T extends string>({
  activeView,
  aiProviderLabel,
  appItems,
  functionsLabel,
  aiSetupLabel,
  aiStatusTitle,
  aiStatusState,
  userName,
  userInitials,
  userAvatarDataUrl,
  assistantOpen,
  onActiveViewChange,
  onOpenAssistant,
  onOpenProfile,
  onOpenSettings,
}: AppSidebarProps<T>) {
  const aiStatusClass = aiStatusState === "available"
    ? "bg-success"
    : aiStatusState === "degraded"
      ? "bg-warning"
      : "bg-muted-foreground";

  const nav = (
    <nav aria-label={functionsLabel} className="v2-rail-nav">
      {appItems.map(({ value, label, icon: Icon }) => {
        const active = activeView === value;
        return (
          <button
            key={value}
            type="button"
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={label}
            className={cn("v2-rail-button", active && "is-active")}
            onClick={() => onActiveViewChange(value)}
          >
            <Icon aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="v2-app-rail" data-print-hidden>
        <div className="v2-rail-primary">
          <button
            type="button"
            className="v2-brand-button"
            aria-label="Decision Workspace"
            title="Decision Workspace"
            onClick={() => onActiveViewChange(appItems[0].value)}
          >
            <WaypointsIcon aria-hidden="true" />
          </button>
          {nav}
        </div>

        <div className="v2-rail-account">
          <button
            type="button"
            className={cn("v2-rail-button", assistantOpen && "is-active")}
            aria-label={`${aiStatusTitle}: ${aiProviderLabel}`}
            aria-expanded={assistantOpen}
            title={`${aiSetupLabel}: ${aiProviderLabel}`}
            onClick={onOpenAssistant}
          >
            <SparklesIcon aria-hidden="true" />
            <span className={cn("v2-status-dot", aiStatusClass)} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="v2-rail-button"
            aria-label="Workspace settings"
            title="Workspace settings"
            onClick={onOpenSettings}
          >
            <SettingsIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className="v2-avatar-button"
            aria-label={`${userName} profile`}
            title={`${userName} profile`}
            onClick={onOpenProfile}
          >
            {userAvatarDataUrl ? <img src={userAvatarDataUrl} alt="" className="size-full object-cover" /> : userInitials}
          </button>
        </div>
      </aside>

      <div className="v2-mobile-nav" data-print-hidden>
        <button
          type="button"
          className="v2-mobile-brand"
          aria-label={`${aiStatusTitle}: ${aiProviderLabel}`}
          aria-expanded={assistantOpen}
          onClick={onOpenAssistant}
        >
          <SparklesIcon aria-hidden="true" />
          <span className={cn("v2-status-dot", aiStatusClass)} aria-hidden="true" />
        </button>
        {nav}
      </div>
    </>
  );
}
