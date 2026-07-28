"use client";

import * as React from "react";
import { CheckIcon, LogOutIcon, SparklesIcon, WaypointsIcon } from "lucide-react";
import type { CapabilityState } from "@/lib/capabilities";
import type { DashboardWorkflowState, DashboardWorkflowStep } from "@/lib/dashboard-workflow";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  aiStatusTitle: string;
  aiStatusState: CapabilityState;
  showClearSession: boolean;
  clearSessionTitle: string;
  clearSessionDescription: string;
  clearSessionCancel: string;
  clearSessionConfirm: string;
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
  aiStatusTitle,
  aiStatusState,
  showClearSession,
  clearSessionTitle,
  clearSessionDescription,
  clearSessionCancel,
  clearSessionConfirm,
  onActiveViewChange,
  onLogout,
}: AppSidebarProps<T>) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const aiStatusDotClass = aiStatusState === "available"
    ? "bg-success"
    : aiStatusState === "degraded"
      ? "bg-warning"
      : "bg-muted-foreground";

  const handleActiveViewChange = React.useCallback(
    (value: T) => {
      onActiveViewChange(value);
      if (isMobile) setOpenMobile(false);
    },
    [isMobile, onActiveViewChange, setOpenMobile],
  );

  return (
    <Sidebar collapsible="icon" data-print-hidden>
      <SidebarHeader className="p-3 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<div />}
              size="lg"
              tooltip="Decision Workspace"
              className="h-auto border border-sidebar-border/80 bg-sidebar-accent/35 p-2.5 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-1"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/70 ring-1 ring-sidebar-border group-data-[collapsible=icon]:size-8">
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
        <nav aria-label={functionsLabel}>
          <SidebarGroup className="px-3 py-2">
            <SidebarGroupLabel className="px-1 text-[11px] font-medium tracking-[0.08em]">{functionsLabel}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {appItems.map(({ value, label, icon: Icon }) => (
                  <SidebarMenuItem key={value}>
                    <SidebarMenuButton
                      isActive={activeView === value}
                      onClick={() => handleActiveViewChange(value)}
                      aria-current={activeView === value ? "page" : undefined}
                      tooltip={label}
                      className="h-10"
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
        {showWorkflow ? (
          <SidebarGroup className="px-3 py-2">
            <SidebarGroupLabel className="px-1 text-[11px] font-medium tracking-[0.08em]">{workflowLabel}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {workflowItems.map(({ value, label, icon: Icon, state, stateLabel }) => {
                  const StateIcon = state === "complete" ? CheckIcon : Icon;
                  return (
                    <SidebarMenuItem key={value}>
                      <SidebarMenuButton
                        render={<div />}
                        isActive={false}
                        aria-current={state === "current" ? "step" : undefined}
                        tooltip={label}
                        className={cn(
                          "h-9 text-sidebar-foreground/80",
                          state === "current" && "bg-sidebar-accent/70 text-sidebar-accent-foreground ring-1 ring-sidebar-ring/30",
                          state === "complete" && "text-muted-foreground",
                        )}
                      >
                        <StateIcon className={cn(state === "complete" && "text-success", state === "current" && "text-primary")} />
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
          <SidebarGroupLabel className="px-4 text-[11px] font-medium tracking-[0.08em]">{aiSetupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <div
              role="status"
              aria-live="polite"
              className="mx-3 flex items-center gap-2 rounded-lg border border-sidebar-border/70 bg-background/35 px-3 py-2.5 group-data-[collapsible=icon]:mx-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
              title={aiProviderLabel}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", aiStatusDotClass)} aria-hidden="true" />
              <SparklesIcon className="size-4 shrink-0 text-sidebar-foreground/80" aria-hidden="true" />
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-xs font-medium">{aiStatusTitle}</span>
                <span className="block truncate text-[11px] font-normal text-sidebar-foreground/65">{aiProviderLabel}</span>
              </span>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {showClearSession ? (
        <SidebarFooter className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setLogoutOpen(true)}
                tooltip={clearSessionLabel}
                className="h-10 border border-sidebar-border/70 text-sidebar-foreground/80 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOutIcon />
                <span>{clearSessionLabel}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{clearSessionTitle}</AlertDialogTitle>
                <AlertDialogDescription>{clearSessionDescription}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{clearSessionCancel}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onLogout}>{clearSessionConfirm}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}
