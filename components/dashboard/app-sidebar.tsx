"use client";

import * as React from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon, SettingsIcon, SparklesIcon, WaypointsIcon } from "lucide-react";
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
  expanded: boolean;
  onActiveViewChange: (value: T) => void;
  onExpandedChange: (expanded: boolean) => void;
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
  expanded,
  showWorkflow,
  workflowLabel,
  workflowItems,
  onActiveViewChange,
  onExpandedChange,
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
            <span className="v2-rail-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="v2-app-rail" data-expanded={expanded} data-print-hidden>
        <div className="v2-rail-primary">
          <div className="v2-rail-brand-row">
            <button
              type="button"
              className="v2-brand-button"
              aria-label="Decision Workspace"
              title="Decision Workspace"
              onClick={() => onActiveViewChange(appItems[0].value)}
            >
              <WaypointsIcon aria-hidden="true" />
              <span className="v2-rail-brand-label">Decision Workspace</span>
            </button>
            <button
              type="button"
              className="v2-rail-collapse"
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              aria-pressed={expanded}
              onClick={() => onExpandedChange(!expanded)}
            >
              {expanded ? <PanelLeftCloseIcon aria-hidden="true" /> : <PanelLeftOpenIcon aria-hidden="true" />}
            </button>
          </div>
          {nav}
          {showWorkflow ? (
            <div className="v2-rail-workflow">
              <div className="v2-rail-section-label">{workflowLabel}</div>
              {workflowItems.map(({ value, label, icon: Icon, state, stateLabel }) => (
                <button
                  key={value}
                  type="button"
                  className="v2-rail-workflow-item"
                  data-state={state}
                  title={`${label}: ${stateLabel}`}
                  onClick={() => onActiveViewChange("ads" as T)}
                >
                  <Icon aria-hidden="true" />
                  <span className="v2-rail-label">{label}</span>
                  <span className="v2-workflow-state">{stateLabel}</span>
                </button>
              ))}
            </div>
          ) : null}
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
            <span className="v2-rail-label">{aiSetupLabel}</span>
          </button>
          <button
            type="button"
            className="v2-rail-button"
            aria-label="Workspace settings"
            title="Workspace settings"
            onClick={onOpenSettings}
          >
            <SettingsIcon aria-hidden="true" />
            <span className="v2-rail-label">Workspace settings</span>
          </button>
          <button
            type="button"
            className="v2-avatar-button"
            aria-label={`${userName} profile`}
            title={`${userName} profile`}
            onClick={onOpenProfile}
          >
            <span className="v2-sidebar-avatar">
              {userAvatarDataUrl ? <img src={userAvatarDataUrl} alt="" className="size-full object-cover" /> : userInitials}
            </span>
            <span className="v2-rail-profile-label">{userName}</span>
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
