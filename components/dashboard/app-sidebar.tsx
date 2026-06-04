"use client";

import * as React from "react";
import { CheckIcon, LogOutIcon, SparklesIcon } from "lucide-react";
import type { DashboardWorkflowState, DashboardWorkflowStep } from "@/lib/dashboard-workflow";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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
  clearSessionLabel: string;
  functionsLabel: string;
  showWorkflow: boolean;
  workflowLabel: string;
  workflowItems: WorkflowSidebarItem[];
  aiSetupLabel: string;
  onActiveViewChange: (value: T) => void;
  onLogout: () => void;
};

export function AppSidebar<T extends string>({
  activeView,
  aiProviderLabel,
  appItems,
  clearSessionLabel,
  functionsLabel,
  showWorkflow,
  workflowLabel,
  workflowItems,
  aiSetupLabel,
  onActiveViewChange,
  onLogout,
}: AppSidebarProps<T>) {
  return (
    <Sidebar collapsible="icon" data-print-hidden>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Meta Ads Console">
              <img src="/red-agency-logo.png" alt="Red Agency" className="size-5 rounded-sm object-contain" />
              <span>Meta Ads Console</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{functionsLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appItems.map(({ value, label, icon: Icon }) => (
                <SidebarMenuItem key={value}>
                  <SidebarMenuButton
                    isActive={activeView === value}
                    onClick={() => onActiveViewChange(value)}
                    aria-current={activeView === value ? "page" : undefined}
                    tooltip={label}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showWorkflow ? (
          <SidebarGroup>
            <SidebarGroupLabel>{workflowLabel}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workflowItems.map(({ value, label, icon: Icon, state, stateLabel }) => {
                  const StateIcon = state === "complete" ? CheckIcon : Icon;
                  return (
                    <SidebarMenuItem key={value}>
                      <SidebarMenuButton
                        isActive={state === "current"}
                        disabled={state === "pending"}
                        aria-current={state === "current" ? "step" : undefined}
                        tooltip={label}
                        className={cn(state === "complete" && "text-muted-foreground")}
                      >
                        <StateIcon />
                        <span>{label}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
                          {stateLabel}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        <SidebarGroup>
          <SidebarGroupLabel>{aiSetupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={aiProviderLabel}>
                  <SparklesIcon />
                  <span>{aiProviderLabel}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} tooltip={clearSessionLabel}>
              <LogOutIcon />
              <span>{clearSessionLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
