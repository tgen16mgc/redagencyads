"use client";

import * as React from "react";
import {
  Avatar,
  Button as HeroButton,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import {
  MailPlusIcon,
  RefreshCcwIcon,
  Trash2Icon,
  UserRoundMinusIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import { initialsFromName, type WorkspaceRole, type WorkspaceSettings } from "@/lib/account-workspace-settings";

type InviteRole = Exclude<WorkspaceRole, "owner">;

const roleCopy: Record<WorkspaceRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Full control, including ownership decisions" },
  admin: { label: "Admin", description: "Manage members and workspace settings" },
  analyst: { label: "Analyst", description: "Analyze data and build reports" },
  viewer: { label: "Viewer", description: "Read-only workspace access" },
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function roleColor(role: WorkspaceRole) {
  if (role === "owner") return "accent" as const;
  if (role === "admin") return "success" as const;
  if (role === "analyst") return "warning" as const;
  return "default" as const;
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export function WorkspaceMembersDialog({
  open,
  workspace,
  onOpenChange,
  onRefresh,
}: {
  open: boolean;
  workspace: WorkspaceSettings;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
}) {
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<InviteRole>("analyst");
  const [busyKey, setBusyKey] = React.useState("");
  const [error, setError] = React.useState("");
  const [removeTarget, setRemoveTarget] = React.useState<{ userId: string; name: string } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setEmail("");
      setFullName("");
      setInviteRole("analyst");
      setBusyKey("");
      setError("");
      setRemoveTarget(null);
    }
  }, [open]);

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    if (!workspace.canManage || busyKey || !email.trim()) return;
    setBusyKey("invite");
    setError("");
    try {
      const result = await readJsonResponse<{ emailSent: boolean; inviteUrl: string }>(await fetch("/api/workspace/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, fullName, role: inviteRole }),
      }));
      await onRefresh();
      setEmail("");
      setFullName("");
      if (result.emailSent) {
        toast.success(`Invitation sent to ${email.trim().toLowerCase()}`);
      } else {
        await navigator.clipboard?.writeText(result.inviteUrl).catch(() => undefined);
        toast.warning("Invitation saved", { description: "Email delivery is not configured, so the sign-in link was copied for you to share." });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The invitation could not be sent.");
    } finally {
      setBusyKey("");
    }
  }

  async function updateRole(userId: string, role: InviteRole) {
    if (busyKey) return;
    setBusyKey(`member:${userId}`);
    setError("");
    try {
      await readJsonResponse(await fetch("/api/workspace/members", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, role }),
      }));
      await onRefresh();
      toast.success("Member role updated");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The member role could not be updated.");
    } finally {
      setBusyKey("");
    }
  }

  async function removeMember() {
    if (!removeTarget || busyKey) return;
    setBusyKey(`remove:${removeTarget.userId}`);
    setError("");
    try {
      await readJsonResponse(await fetch("/api/workspace/members", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: removeTarget.userId }),
      }));
      await onRefresh();
      toast.success(`${removeTarget.name} removed from ${workspace.name}`);
      setRemoveTarget(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The member could not be removed.");
    } finally {
      setBusyKey("");
    }
  }

  async function revokeInvite(inviteId: string) {
    if (busyKey) return;
    setBusyKey(`invite:${inviteId}`);
    setError("");
    try {
      await readJsonResponse(await fetch(`/api/workspace/invites?id=${encodeURIComponent(inviteId)}`, { method: "DELETE" }));
      await onRefresh();
      toast.success("Invitation revoked");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The invitation could not be revoked.");
    } finally {
      setBusyKey("");
    }
  }

  function canManageTarget(userId: string, role: WorkspaceRole) {
    if (!workspace.canManage || userId === workspace.currentUserId || role === "owner") return false;
    return workspace.currentUserRole === "owner" || role !== "admin";
  }

  return (
    <>
      <Modal.Backdrop className="heroui-scope" isOpen={open} onOpenChange={onOpenChange} variant="blur">
        <Modal.Container placement="auto" scroll="inside" size="lg">
          <Modal.Dialog className="max-h-[calc(100svh-1.5rem)] sm:max-w-[760px]">
            <Modal.CloseTrigger />
            <Modal.Header className="border-b border-border pb-5">
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <UsersRoundIcon className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Members & access</Modal.Heading>
              <p className="mt-1 text-sm leading-5 text-muted">Invite teammates, assign roles, and remove access for {workspace.name}.</p>
            </Modal.Header>

            <Modal.Body className="gap-6 p-5 text-foreground sm:p-6">
              {error ? (
                <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
              ) : null}

              {workspace.canManage ? (
                <form className="rounded-2xl border border-border bg-surface-secondary p-4" onSubmit={inviteMember}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground"><MailPlusIcon className="size-4" /></span>
                    <div>
                      <h3 className="text-sm font-semibold">Invite a teammate</h3>
                      <p className="mt-0.5 text-xs text-muted">They join after signing in with the invited email address.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
                    <TextField isRequired name="email" type="email" variant="secondary">
                      <Label>Work email</Label>
                      <Input autoComplete="off" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                    </TextField>
                    <TextField name="fullName" variant="secondary">
                      <Label>Name <span className="text-muted">(optional)</span></Label>
                      <Input autoComplete="off" maxLength={120} placeholder="Teammate name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                    </TextField>
                    <Select aria-label="Invitation role" value={inviteRole} variant="secondary" onChange={(value) => setInviteRole(value as InviteRole)}>
                      <Label>Role</Label>
                      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                      <Select.Popover className="heroui-scope">
                        <ListBox>
                          {(["admin", "analyst", "viewer"] as const).map((role) => (
                            <ListBox.Item key={role} id={role} textValue={roleCopy[role].label}>
                              <span className="flex flex-col"><Label>{roleCopy[role].label}</Label><Description>{roleCopy[role].description}</Description></span>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <HeroButton isDisabled={!email.trim() || Boolean(busyKey)} type="submit">
                      <MailPlusIcon className="size-4" />
                      {busyKey === "invite" ? "Sending..." : "Send invitation"}
                    </HeroButton>
                  </div>
                </form>
              ) : null}

              <section aria-labelledby="active-members-heading">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 id="active-members-heading" className="text-sm font-semibold">Active members</h3>
                    <p className="mt-1 text-xs text-muted">{workspace.memberCount} {workspace.memberCount === 1 ? "person has" : "people have"} access.</p>
                  </div>
                  <Chip size="sm" variant="soft"><Chip.Label>{workspace.roleSummary}</Chip.Label></Chip>
                </div>
                <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                  {workspace.members.map((member) => {
                    const editable = canManageTarget(member.userId, member.role);
                    return (
                      <div key={member.userId} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Avatar color={roleColor(member.role)} size="md" variant="soft">
                            {member.avatarDataUrl ? <Avatar.Image alt={member.fullName || member.email} src={member.avatarDataUrl} /> : null}
                            <Avatar.Fallback>{initialsFromName(member.fullName || member.email)}</Avatar.Fallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold">{member.fullName || member.email}</span>
                              {member.userId === workspace.currentUserId ? <Chip size="sm" variant="soft"><Chip.Label>You</Chip.Label></Chip> : null}
                            </div>
                            <p className="truncate text-xs text-muted">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:w-[250px] sm:justify-end">
                          {member.role === "owner" || !workspace.canManage ? (
                            <Chip color={roleColor(member.role)} size="sm" variant="soft"><Chip.Label>{roleCopy[member.role].label}</Chip.Label></Chip>
                          ) : (
                            <Select
                              aria-label={`Role for ${member.fullName || member.email}`}
                              className="min-w-0 flex-1"
                              isDisabled={!editable || Boolean(busyKey)}
                              value={member.role}
                              variant="secondary"
                              onChange={(value) => void updateRole(member.userId, value as InviteRole)}
                            >
                              <Select.Trigger className="h-9"><Select.Value /><Select.Indicator /></Select.Trigger>
                              <Select.Popover className="heroui-scope">
                                <ListBox>
                                  {(["admin", "analyst", "viewer"] as const).map((role) => (
                                    <ListBox.Item key={role} id={role} textValue={roleCopy[role].label}>
                                      <Label>{roleCopy[role].label}</Label><ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          )}
                          {workspace.canManage && member.role !== "owner" ? (
                            <HeroButton
                              isIconOnly
                              aria-label={`Remove ${member.fullName || member.email}`}
                              isDisabled={!editable || Boolean(busyKey)}
                              size="sm"
                              variant="tertiary"
                              onPress={() => setRemoveTarget({ userId: member.userId, name: member.fullName || member.email })}
                            >
                              <UserRoundMinusIcon className="size-4 text-danger" />
                            </HeroButton>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {workspace.canManage && workspace.pendingInvites.length ? (
                <section aria-labelledby="pending-invites-heading">
                  <h3 id="pending-invites-heading" className="text-sm font-semibold">Pending invitations</h3>
                  <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                    {workspace.pendingInvites.map((invite) => (
                      <div key={invite.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{invite.fullName || invite.email}</div>
                          <div className="truncate text-xs text-muted">{invite.email} · expires {formatExpiry(invite.expiresAt)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Chip color={roleColor(invite.role)} size="sm" variant="soft"><Chip.Label>{roleCopy[invite.role].label}</Chip.Label></Chip>
                          <HeroButton
                            isIconOnly
                            aria-label={`Resend invitation to ${invite.email}`}
                            isDisabled={Boolean(busyKey)}
                            size="sm"
                            variant="tertiary"
                            onPress={() => {
                              setEmail(invite.email);
                              setFullName(invite.fullName);
                              setInviteRole(invite.role);
                              toast.message("Invitation loaded", { description: "Use Send invitation to renew it for another 7 days." });
                            }}
                          >
                            <RefreshCcwIcon className="size-4" />
                          </HeroButton>
                          <HeroButton isIconOnly aria-label={`Revoke invitation to ${invite.email}`} isDisabled={Boolean(busyKey)} size="sm" variant="tertiary" onPress={() => void revokeInvite(invite.id)}>
                            <Trash2Icon className="size-4 text-danger" />
                          </HeroButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </Modal.Body>

            <Modal.Footer className="border-t border-border">
              <HeroButton slot="close">Done</HeroButton>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop className="heroui-scope" isOpen={Boolean(removeTarget)} onOpenChange={(isOpen) => { if (!isOpen) setRemoveTarget(null); }} variant="blur">
        <Modal.Container placement="auto" size="xs">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-danger-soft text-danger-soft-foreground"><UserRoundMinusIcon className="size-5" /></Modal.Icon>
              <Modal.Heading>Remove workspace access?</Modal.Heading>
              <p className="mt-1 text-sm leading-5 text-muted">{removeTarget?.name} will immediately lose access to {workspace.name}. Their historical workspace data remains available to the team.</p>
            </Modal.Header>
            <Modal.Footer>
              <HeroButton slot="close" variant="secondary">Cancel</HeroButton>
              <HeroButton className="bg-danger text-danger-foreground hover:bg-danger/90" isDisabled={Boolean(busyKey)} onPress={() => void removeMember()}>
                {busyKey.startsWith("remove:") ? "Removing..." : "Remove access"}
              </HeroButton>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
