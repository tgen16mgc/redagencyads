"use client";

import * as React from "react";
import { CheckIcon, LogOutIcon, SparklesIcon, WaypointsIcon } from "lucide-react";
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
  useSidebar,
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
  showClearSession: boolean;
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
  showClearSession,
  onActiveViewChange,
  onLogout,
}: AppSidebarProps<T>) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleActiveViewChange = React.useCallback(
    (value: T) => {
      onActiveViewChange(value);
      if (isMobile) setOpenMobile(false);
    },
    [isMobile, onActiveViewChange, setOpenMobile],
  );

  return (
    <Sidebar collapsible="icon" data-print-hidden>
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<div />}
              size="lg"
              tooltip="Decision Workspace"
              className="h-auto border border-sidebar-border/80 bg-sidebar-accent/35 p-3 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/70 ring-1 ring-sidebar-border group-data-[collapsible=icon]:size-8">
                <WaypointsIcon aria-hidden="true" />
              </span>
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-sm font-semibold leading-5">Decision Workspace</span>
                <span className="block truncate text-xs font-normal text-sidebar-foreground/65">Evidence to action</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{functionsLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {appItems.map(({ value, label, icon: Icon }) => (
                <SidebarMenuItem key={value}>
                  <SidebarMenuButton
                    size="lg"
                    isActive={activeView === value}
                    onClick={() => handleActiveViewChange(value)}
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
                        render={<div />}
                        isActive={state === "current"}
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
                <SidebarMenuButton
                  render={<div />}
                  tooltip={aiProviderLabel}
                  className="h-auto items-start border border-sidebar-border/70 bg-background/35 p-3 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-2"
                >
                  <SparklesIcon className="mt-0.5 group-data-[collapsible=icon]:mt-0" />
                  <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <span className="block truncate text-sm font-medium">{aiProviderLabel}</span>
                    <span className="block truncate text-[11px] font-normal text-sidebar-foreground/65">Workspace AI status</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {showClearSession ? (
        <SidebarFooter className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onLogout}
                tooltip={clearSessionLabel}
                className="border border-sidebar-border/70 text-sidebar-foreground/80 hover:text-sidebar-foreground"
              >
                <LogOutIcon />
                <span>{clearSessionLabel}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}
