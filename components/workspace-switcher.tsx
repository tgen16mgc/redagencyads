"use client";

import * as React from "react";
import {
  Avatar,
  Button as HeroButton,
  Description,
  Dropdown,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import {
  BriefcaseBusinessIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  Settings2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceDirectoryEntry } from "@/lib/account-workspace-settings";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "The workspace action could not be completed.");
  return data;
}

function workspaceInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "WS";
}

function roleLabel(role: WorkspaceDirectoryEntry["role"]) {
  return role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "analyst" ? "Analyst" : "Viewer";
}

export function WorkspaceSwitcher({
  currentName,
  enabled,
  onManage,
}: {
  currentName: string;
  enabled: boolean;
  onManage: () => void;
}) {
  const [workspaces, setWorkspaces] = React.useState<WorkspaceDirectoryEntry[]>([]);
  const [loading, setLoading] = React.useState(enabled);
  const [busyId, setBusyId] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [createError, setCreateError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setLoading(false);
      return;
    }

    fetch("/api/workspace/workspaces", {
      headers: { accept: "application/json" },
    })
      .then((response) => readJsonResponse<{ workspaces: WorkspaceDirectoryEntry[] }>(response))
      .then((data) => {
        if (!cancelled) setWorkspaces(data.workspaces);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Your workspaces could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  async function switchWorkspace(workspace: WorkspaceDirectoryEntry) {
    if (workspace.isCurrent || busyId) return;
    setBusyId(workspace.id);
    try {
      await readJsonResponse(await fetch("/api/workspace/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "switch", workspaceId: workspace.id }),
      }));
      toast.success(`Switched to ${workspace.name}`);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workspace could not be switched.");
      setBusyId("");
    }
  }

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    if (newName.trim().length < 2 || busyId) return;
    setBusyId("create");
    setCreateError("");
    try {
      await readJsonResponse(await fetch("/api/workspace/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", name: newName }),
      }));
      toast.success(`${newName.trim()} created`);
      window.location.reload();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "The workspace could not be created.");
      setBusyId("");
    }
  }

  const current = workspaces.find((workspace) => workspace.isCurrent);

  if (!enabled) {
    return (
      <HeroButton
        className="heroui-scope h-auto w-full justify-start gap-3 rounded-xl border border-border bg-surface-secondary px-3 py-2.5 text-foreground shadow-none"
        fullWidth
        variant="secondary"
        onPress={onManage}
      >
        <Avatar className="size-8 shrink-0" color="accent" size="sm" variant="soft">
          <Avatar.Fallback>{workspaceInitials(currentName)}</Avatar.Fallback>
        </Avatar>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold">{currentName}</span>
          <span className="block text-[11px] text-muted">Local development workspace</span>
        </span>
        <Settings2Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </HeroButton>
    );
  }

  return (
    <>
      <Dropdown>
        <HeroButton
          aria-label="Switch workspace"
          className="heroui-scope h-auto w-full justify-start gap-3 rounded-xl border border-border bg-surface-secondary px-3 py-2.5 text-foreground shadow-none"
          fullWidth
          variant="secondary"
        >
          <Avatar className="size-8 shrink-0" color="accent" size="sm" variant="soft">
            <Avatar.Fallback>{workspaceInitials(current?.name || currentName)}</Avatar.Fallback>
          </Avatar>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold">{current?.name || currentName}</span>
            <span className="block text-[11px] text-muted">{current ? roleLabel(current.role) : loading ? "Loading workspaces..." : "Current workspace"}</span>
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted" aria-hidden="true" />
        </HeroButton>
        <Dropdown.Popover className="heroui-scope min-w-[280px] rounded-2xl border border-border bg-overlay p-1 shadow-xl">
          <Dropdown.Menu
            onAction={(key) => {
              const action = String(key);
              if (action === "manage") onManage();
              else if (action === "create") setCreateOpen(true);
              else if (action.startsWith("workspace:")) {
                const selected = workspaces.find((workspace) => workspace.id === action.slice("workspace:".length));
                if (selected) void switchWorkspace(selected);
              }
            }}
          >
            <Dropdown.Section>
              {workspaces.map((workspace) => (
                <Dropdown.Item
                  key={workspace.id}
                  id={`workspace:${workspace.id}`}
                  textValue={workspace.name}
                >
                  <Avatar className="size-8 shrink-0" color={workspace.isCurrent ? "accent" : "default"} size="sm" variant="soft">
                    <Avatar.Fallback>{workspaceInitials(workspace.name)}</Avatar.Fallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Label className="truncate">{workspace.name}</Label>
                    <Description>{roleLabel(workspace.role)}{busyId === workspace.id ? " · Switching..." : ""}</Description>
                  </span>
                  {workspace.isCurrent ? <CheckIcon className="size-4 text-accent" aria-label="Current workspace" /> : null}
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
            <Dropdown.Section>
              <Dropdown.Item id="create" textValue="Create workspace">
                <PlusIcon className="size-4 text-muted" aria-hidden="true" />
                <Label>Create workspace</Label>
              </Dropdown.Item>
              <Dropdown.Item id="manage" textValue="Workspace settings">
                <Settings2Icon className="size-4 text-muted" aria-hidden="true" />
                <Label>Workspace settings</Label>
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <Modal.Backdrop className="heroui-scope" isOpen={createOpen} onOpenChange={setCreateOpen} variant="blur">
        <Modal.Container placement="auto" size="sm">
          <Modal.Dialog>
            <form onSubmit={createWorkspace}>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                  <BriefcaseBusinessIcon className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Create a workspace</Modal.Heading>
                <p className="mt-1 text-sm leading-5 text-muted">Start a separate team space with its own members, Meta connection, and saved reports.</p>
              </Modal.Header>
              <Modal.Body>
                <TextField isInvalid={Boolean(createError)} name="workspaceName" variant="secondary">
                  <Label>Workspace name</Label>
                  <Input autoFocus maxLength={120} placeholder="e.g. Red Agency — Growth" value={newName} onChange={(event) => setNewName(event.target.value)} />
                  {createError ? <p className="mt-1 text-xs text-danger">{createError}</p> : null}
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <HeroButton slot="close" type="button" variant="secondary">Cancel</HeroButton>
                <HeroButton isDisabled={newName.trim().length < 2 || Boolean(busyId)} type="submit">
                  {busyId === "create" ? "Creating..." : "Create workspace"}
                </HeroButton>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
