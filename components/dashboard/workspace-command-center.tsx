"use client";

import * as React from "react";
import {
  Button,
  Description,
  Header,
  Kbd,
  Label,
  ListBox,
  Modal,
  Popover,
  SearchField,
} from "@heroui/react";
import {
  BarChart3Icon,
  BellIcon,
  BotMessageSquareIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  DatabaseIcon,
  FileDownIcon,
  HomeIcon,
  SearchIcon,
  Settings2Icon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  WaypointsIcon,
} from "lucide-react";
import type { DashboardView } from "@/lib/dashboard-access";

export type WorkspaceCommandIcon =
  | "account"
  | "assistant"
  | "campaign"
  | "export"
  | "overview"
  | "performance"
  | "search"
  | "settings"
  | "workspace";

export type WorkspaceCommand = {
  id: string;
  group: "Navigate" | "Accounts and campaigns" | "Actions";
  label: string;
  description: string;
  icon: WorkspaceCommandIcon;
  keywords?: string[];
  onSelect: () => void;
};

export type WorkspaceNotification = {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info" | "success";
  view?: DashboardView;
  onSelect: () => void;
};

const commandIcons: Record<WorkspaceCommandIcon, React.ComponentType<{ className?: string }>> = {
  account: DatabaseIcon,
  assistant: BotMessageSquareIcon,
  campaign: BarChart3Icon,
  export: FileDownIcon,
  overview: HomeIcon,
  performance: BarChart3Icon,
  search: SearchIcon,
  settings: Settings2Icon,
  workspace: WaypointsIcon,
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function WorkspaceSearch({ commands, language }: { commands: WorkspaceCommand[]; language: "en" | "vi" }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const isVietnamese = language === "vi";

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const commandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slashShortcut = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableTarget(event.target);
      if (!commandShortcut && !slashShortcut) return;
      event.preventDefault();
      setIsOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const filtered = React.useMemo(() => {
    const needle = normalize(query);
    if (!needle) return commands.slice(0, 18);
    return commands.filter((command) => normalize([
      command.label,
      command.description,
      command.group,
      ...(command.keywords || []),
    ].join(" ")).includes(needle)).slice(0, 30);
  }, [commands, query]);

  const groups = React.useMemo(() => {
    const order: WorkspaceCommand["group"][] = ["Navigate", "Accounts and campaigns", "Actions"];
    return order
      .map((group) => ({ group, items: filtered.filter((command) => command.group === group) }))
      .filter((entry) => entry.items.length > 0);
  }, [filtered]);

  function close() {
    setIsOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function run(commandId: React.Key) {
    const command = commands.find((item) => item.id === String(commandId));
    if (!command) return;
    close();
    window.requestAnimationFrame(command.onSelect);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === "Enter" && filtered[0]) {
      event.preventDefault();
      run(filtered[0].id);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const options = resultsRef.current?.querySelectorAll<HTMLElement>("[role='option']");
    const target = event.key === "ArrowDown" ? options?.[0] : options?.[options.length - 1];
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="v2-icon-button" aria-label={isVietnamese ? "Tìm kiếm trong workspace" : "Search workspace"} onClick={() => setIsOpen(true)}>
        <SearchIcon />
      </button>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(next) => next ? setIsOpen(true) : close()}>
        <Modal.Container placement="top">
          <Modal.Dialog className="v2-command-dialog">
            <Modal.CloseTrigger />
            <Modal.Header className="v2-command-header">
              <Modal.Icon className="v2-command-icon"><SearchIcon /></Modal.Icon>
              <div>
                <Modal.Heading>{isVietnamese ? "Tìm trong Decision Workspace" : "Search Decision Workspace"}</Modal.Heading>
                <p>{isVietnamese ? "Mở workspace, tài khoản, campaign hoặc hành động thật." : "Open a workspace, account, campaign, or available action."}</p>
              </div>
            </Modal.Header>
            <Modal.Body className="v2-command-body">
              <SearchField fullWidth value={query} onChange={setQuery} aria-label={isVietnamese ? "Tìm kiếm workspace" : "Search workspace"}>
                <SearchField.Group className="v2-command-search">
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    ref={inputRef}
                    placeholder={isVietnamese ? "Tìm campaign, tài khoản hoặc hành động..." : "Search campaigns, accounts, or actions..."}
                    onKeyDown={handleSearchKeyDown}
                  />
                  <SearchField.ClearButton />
                  <Kbd className="v2-command-kbd" variant="light"><Kbd.Abbr keyValue="command" /><Kbd.Content>K</Kbd.Content></Kbd>
                </SearchField.Group>
              </SearchField>

              {groups.length ? (
                <ListBox ref={resultsRef} aria-label={isVietnamese ? "Kết quả tìm kiếm" : "Search results"} className="v2-command-results" selectionMode="none" onAction={run}>
                  {groups.map(({ group, items }) => (
                    <ListBox.Section key={group}>
                      <Header className="v2-command-group">{groupLabel(group, language)}</Header>
                      {items.map((command) => {
                        const CommandIcon = commandIcons[command.icon];
                        return (
                          <ListBox.Item key={command.id} id={command.id} textValue={command.label} className="v2-command-result">
                            <span className="v2-command-result-icon"><CommandIcon /></span>
                            <span className="min-w-0 flex-1">
                              <Label className="v2-command-result-label">{command.label}</Label>
                              <Description className="v2-command-result-description">{command.description}</Description>
                            </span>
                          </ListBox.Item>
                        );
                      })}
                    </ListBox.Section>
                  ))}
                </ListBox>
              ) : (
                <div className="v2-command-empty" role="status">
                  <SearchIcon />
                  <strong>{isVietnamese ? "Không có kết quả thật" : "No real results found"}</strong>
                  <p>{isVietnamese ? "Thử tên campaign, tài khoản, Performance hoặc Settings." : "Try a campaign, account, Performance, or Settings."}</p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="v2-command-footer">
              <span>{isVietnamese ? "Enter để mở" : "Enter to open"}</span>
              <span>{isVietnamese ? "Esc để đóng" : "Esc to close"}</span>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

export function WorkspaceNotifications({
  items,
  language,
  storageKey,
}: {
  items: WorkspaceNotification[];
  language: "en" | "vi";
  storageKey: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const isVietnamese = language === "vi";

  React.useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as unknown;
      if (Array.isArray(parsed)) setReadIds(new Set(parsed.filter((item): item is string => typeof item === "string")));
    } catch {
      setReadIds(new Set());
    }
  }, [storageKey]);

  function persist(next: Set<string>) {
    setReadIds(next);
    window.localStorage.setItem(storageKey, JSON.stringify([...next].slice(-200)));
  }

  function markRead(id: string) {
    if (readIds.has(id)) return;
    persist(new Set([...readIds, id]));
  }

  const unreadCount = items.filter((item) => !readIds.has(item.id)).length;

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger className="v2-icon-button v2-notification-trigger" aria-label={isVietnamese ? `${unreadCount} thông báo chưa đọc` : `${unreadCount} unread notifications`}>
        <BellIcon />
        {unreadCount ? <span className="v2-notification-count" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </Popover.Trigger>
      <Popover.Content className="v2-notification-popover" placement="bottom end">
        <Popover.Dialog>
          <Popover.Heading className="v2-notification-heading">
            <span><strong>{isVietnamese ? "Decision alerts" : "Decision alerts"}</strong><small>{isVietnamese ? "Chỉ những mục cần chú ý" : "Only items that need attention"}</small></span>
            {unreadCount ? <Button size="sm" variant="ghost" onPress={() => persist(new Set(items.map((item) => item.id)))}>{isVietnamese ? "Đọc tất cả" : "Mark all read"}</Button> : null}
          </Popover.Heading>
          {items.length ? (
            <div className="v2-notification-list">
              {items.map((item) => {
                const isRead = readIds.has(item.id);
                const StatusIcon = item.severity === "critical" ? ShieldAlertIcon : item.severity === "warning" ? TriangleAlertIcon : item.severity === "success" ? CircleCheckIcon : CircleAlertIcon;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    className="v2-notification-item"
                    data-severity={item.severity}
                    data-read={isRead}
                    onPress={() => {
                      markRead(item.id);
                      setIsOpen(false);
                      window.requestAnimationFrame(item.onSelect);
                    }}
                  >
                    <span className="v2-notification-icon"><StatusIcon /></span>
                    <span className="min-w-0"><strong>{item.title}</strong><small>{item.description}</small></span>
                    {!isRead ? <i aria-label={isVietnamese ? "Chưa đọc" : "Unread"} /> : null}
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="v2-notification-empty">
              <CircleCheckIcon />
              <strong>{isVietnamese ? "Không có mục cần xử lý" : "No action needed"}</strong>
              <p>{isVietnamese ? "Workspace chưa có blocker hoặc cảnh báo mới." : "The workspace has no new blockers or warnings."}</p>
            </div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function groupLabel(group: WorkspaceCommand["group"], language: "en" | "vi") {
  if (language === "en") return group;
  if (group === "Navigate") return "Điều hướng";
  if (group === "Accounts and campaigns") return "Tài khoản và campaign";
  return "Hành động";
}
