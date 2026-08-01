"use client";

import * as React from "react";
import {
  CircleAlertIcon,
  CircleHelpIcon,
  ImagePlusIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkspaceSessionStatus } from "@/components/workspace-auth";
import {
  defaultAccountWorkspaceSettings,
  initialsFromName,
  profileSettingsSchema,
  validatePasswordChange,
  workspaceSettingsSchema,
  type AccountWorkspaceSettingsData,
} from "@/lib/account-workspace-settings";
import { cn } from "@/lib/utils";

export type SettingsTab = "profile" | "workspace";

type LocalSettings = {
  data: AccountWorkspaceSettingsData;
  avatarDataUrl?: string;
};

function localStorageKey(email: string) {
  return `decision-workspace-account-settings-v1:${email || "local"}`;
}

function readLocalSettings(fallback: AccountWorkspaceSettingsData) {
  try {
    const raw = window.localStorage.getItem(localStorageKey(fallback.profile.email));
    if (!raw) return { data: fallback } satisfies LocalSettings;
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      data: {
        profile: {
          ...fallback.profile,
          ...parsed.data?.profile,
          avatarDataUrl: parsed.data?.profile.avatarDataUrl || parsed.avatarDataUrl,
          email: fallback.profile.email,
        },
        workspace: { ...fallback.workspace, ...parsed.data?.workspace },
      },
    } satisfies LocalSettings;
  } catch {
    return { data: fallback } satisfies LocalSettings;
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

export function AccountWorkspaceSettingsDialog({
  open,
  initialTab,
  session,
  metaConnected,
  onOpenChange,
  onOpenMeta,
  onForgetMeta,
  onProfileSaved,
}: {
  open: boolean;
  initialTab: SettingsTab;
  session: WorkspaceSessionStatus;
  metaConnected: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenMeta: () => void;
  onForgetMeta: () => Promise<void>;
  onProfileSaved: (profile: { name: string; initials: string; avatarDataUrl?: string }) => void;
}) {
  const fallback = React.useMemo(() => defaultAccountWorkspaceSettings(session.user || {}), [session.user]);
  const [tab, setTab] = React.useState<SettingsTab>(initialTab);
  const [saved, setSaved] = React.useState<AccountWorkspaceSettingsData>(fallback);
  const [draft, setDraft] = React.useState<AccountWorkspaceSettingsData>(fallback);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTab(initialTab);
    setError("");
    setLoading(true);

    const local = readLocalSettings(fallback);
    setSaved(local.data);
    setDraft(local.data);

    if (!session.required) {
      setLoading(false);
      return;
    }

    fetch("/api/workspace/settings", { headers: { accept: "application/json" } })
      .then((response) => readJsonResponse<AccountWorkspaceSettingsData>(response))
      .then((data) => {
        if (cancelled) return;
        setSaved(data);
        setDraft(data);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Settings could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fallback, initialTab, open, session.required]);

  const profileDirty = JSON.stringify(draft.profile) !== JSON.stringify(saved.profile);
  const workspaceDirty = JSON.stringify(draft.workspace) !== JSON.stringify(saved.workspace);
  const activeDirty = tab === "profile" ? profileDirty : workspaceDirty;
  const activeValid = tab === "profile"
    ? profileSettingsSchema.safeParse(draft.profile).success
    : workspaceSettingsSchema.safeParse(draft.workspace).success;

  function choosePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 1_500_000) {
      toast.error("Choose an image smaller than 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({
      ...current,
      profile: { ...current.profile, avatarDataUrl: typeof reader.result === "string" ? reader.result : undefined },
    }));
    reader.readAsDataURL(file);
  }

  async function saveActiveTab() {
    if (!activeDirty || !activeValid || saving) return;
    setSaving(true);
    setError("");
    try {
      let responseData = draft;
      if (session.required) {
        const body = tab === "profile"
          ? { tab, profile: profileSettingsSchema.parse(draft.profile) }
          : { tab, workspace: workspaceSettingsSchema.parse(draft.workspace) };
        responseData = await readJsonResponse<AccountWorkspaceSettingsData>(await fetch("/api/workspace/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }));
      }

      const next = tab === "profile"
        ? { profile: responseData.profile, workspace: draft.workspace }
        : { profile: draft.profile, workspace: responseData.workspace };
      const persisted = tab === "profile"
        ? { profile: responseData.profile, workspace: saved.workspace }
        : { profile: saved.profile, workspace: responseData.workspace };
      window.localStorage.setItem(localStorageKey(persisted.profile.email), JSON.stringify({
        data: persisted,
      } satisfies LocalSettings));
      setSaved((current) => tab === "profile"
        ? { ...current, profile: responseData.profile }
        : { ...current, workspace: responseData.workspace });
      setDraft(next);
      if (tab === "profile") {
        onProfileSaved({ name: responseData.profile.fullName, initials: initialsFromName(responseData.profile.fullName), avatarDataUrl: responseData.profile.avatarDataUrl });
      }
      toast.success(tab === "profile" ? "Profile settings saved" : "Workspace settings saved");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100svh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[800px] flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-popover p-6 shadow-2xl [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:size-7">
          <DialogHeader className="pr-10">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Manage personal preferences or workspace-wide controls.</DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(value) => setTab(value as SettingsTab)} className="min-h-0 flex-1 gap-0">
            <TabsList variant="line" className="h-8 w-fit max-w-full justify-start rounded-none border-b border-border p-0">
              <TabsTrigger value="profile" className="flex-none px-3">Profile</TabsTrigger>
              <TabsTrigger value="workspace" className="flex-none px-3">Workspace settings</TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto pt-5 md:min-h-[378px]">
              {error ? (
                <Alert variant="destructive" className="mb-4">
                  <CircleAlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <TabsContent value="profile">
                <div className="grid gap-8 md:grid-cols-2">
                  <section className="space-y-3" aria-labelledby="profile-details-heading">
                    <SettingsSectionHeading id="profile-details-heading" title="Profile details" description="Visible to teammates in this workspace." />
                    <div className="flex items-center gap-3 py-1">
                      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/12 text-sm font-medium text-primary">
                        {draft.profile.avatarDataUrl ? <img src={draft.profile.avatarDataUrl} alt="Profile preview" className="size-full object-cover" /> : initialsFromName(draft.profile.fullName)}
                      </span>
                      <input ref={photoInputRef} type="file" accept="image/*" className="sr-only" onChange={choosePhoto} />
                      <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()}>
                        <ImagePlusIcon data-icon="inline-start" />Change photo
                      </Button>
                    </div>
                    <Field>
                      <FieldLabel>Full name</FieldLabel>
                      <Input value={draft.profile.fullName} maxLength={120} disabled={loading} onChange={(event) => setDraft((current) => ({ ...current, profile: { ...current.profile, fullName: event.target.value } }))} />
                    </Field>
                    <Field>
                      <FieldLabel className="text-muted-foreground">Work email</FieldLabel>
                      <Input value={draft.profile.email} type="email" disabled />
                    </Field>
                    <div className="pt-1 text-sm font-medium">Personal default</div>
                    <Field>
                      <FieldLabel>Time zone</FieldLabel>
                      <Input value={draft.profile.timeZone} list="workspace-time-zones" disabled={loading} onChange={(event) => setDraft((current) => ({ ...current, profile: { ...current.profile, timeZone: event.target.value } }))} />
                    </Field>
                  </section>

                  <section className="space-y-3" aria-labelledby="alerts-security-heading">
                    <SettingsSectionHeading id="alerts-security-heading" title="Alerts & security" description="Control high-signal alerts and account security." />
                    <SettingsSwitch checked={draft.profile.weeklyPerformanceDigest} label="Weekly performance digest" onCheckedChange={(checked) => setDraft((current) => ({ ...current, profile: { ...current.profile, weeklyPerformanceDigest: checked } }))} />
                    <SettingsSwitch checked={draft.profile.evidenceFreshnessAlerts} label="Evidence freshness alerts" onCheckedChange={(checked) => setDraft((current) => ({ ...current, profile: { ...current.profile, evidenceFreshnessAlerts: checked } }))} />
                    <SettingsSwitch checked={draft.profile.campaignAnomalyAlerts} label="Campaign anomaly alerts" onCheckedChange={(checked) => setDraft((current) => ({ ...current, profile: { ...current.profile, campaignAnomalyAlerts: checked } }))} />
                    <div className="mt-4 border-t border-border pt-5">
                      <div className="flex items-start gap-3">
                        <CircleHelpIcon className="mt-0.5 size-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">Password</div>
                          <div className="text-sm text-muted-foreground">Protected account · current session active</div>
                        </div>
                        <Button type="button" variant="outline" size="sm" disabled={!session.required} onClick={() => setPasswordOpen(true)}>Change password</Button>
                      </div>
                      {!session.required ? <p className="mt-2 pl-7 text-xs text-muted-foreground">Password changes become available when Supabase workspace auth is configured.</p> : null}
                    </div>
                  </section>
                </div>
              </TabsContent>

              <TabsContent value="workspace">
                <div className="grid gap-8 md:grid-cols-2">
                  <section className="space-y-3" aria-labelledby="workspace-basics-heading">
                    <SettingsSectionHeading id="workspace-basics-heading" title="Workspace basics" description="Shared defaults apply to every report and member." />
                    <Field>
                      <FieldLabel>Workspace name</FieldLabel>
                      <Input value={draft.workspace.name} maxLength={120} disabled={loading || !draft.workspace.canManage} onChange={(event) => setDraft((current) => ({ ...current, workspace: { ...current.workspace, name: event.target.value } }))} />
                    </Field>
                    <Field>
                      <FieldLabel>Default time zone</FieldLabel>
                      <Input value={draft.workspace.timeZone} list="workspace-time-zones" disabled={loading || !draft.workspace.canManage} onChange={(event) => setDraft((current) => ({ ...current, workspace: { ...current.workspace, timeZone: event.target.value } }))} />
                    </Field>
                    <div className="border-t border-border pt-5">
                      <div className={cn("flex items-start gap-3", metaConnected ? "text-success" : "text-warning")}>
                        {metaConnected ? <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" /> : <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">Meta Ads</div>
                          <div className="text-sm text-muted-foreground">{metaConnected ? "Connected for owned accounts" : "Required for owned accounts"}</div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button type="button" size="sm" variant={metaConnected ? "outline" : "default"} onClick={onOpenMeta}>{metaConnected ? "Reconnect" : "Connect Meta"}</Button>
                          {metaConnected ? <Button type="button" size="sm" variant="destructive" onClick={() => void onForgetMeta()}>Forget Meta</Button> : null}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3" aria-labelledby="members-access-heading">
                    <SettingsSectionHeading id="members-access-heading" title="Members & access" description="Roles and security policies are workspace-owned." />
                    <div className="flex items-start gap-3 py-1">
                      <CircleHelpIcon className="mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{draft.workspace.memberCount} active {draft.workspace.memberCount === 1 ? "member" : "members"}</div>
                        <div className="text-sm text-muted-foreground">{draft.workspace.roleSummary}</div>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => toast.info("Member access is managed from the workspace_members roster.")}>Manage</Button>
                    </div>
                    <div className="pt-4">
                      <SettingsSwitch checked={draft.workspace.requireTwoFactorAuthentication} disabled={!draft.workspace.canManage} label="Require two-factor authentication" onCheckedChange={(checked) => setDraft((current) => ({ ...current, workspace: { ...current.workspace, requireTwoFactorAuthentication: checked } }))} />
                      <SettingsSwitch checked={draft.workspace.approvalBeforePublishing} disabled={!draft.workspace.canManage} label="Approval before publishing" onCheckedChange={(checked) => setDraft((current) => ({ ...current, workspace: { ...current.workspace, approvalBeforePublishing: checked } }))} />
                    </div>
                    <div className="mt-4 border-t border-border pt-5">
                      <div className="flex items-start gap-3 text-destructive">
                        <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">Danger zone</div>
                          <div className="text-sm text-muted-foreground">Transfer ownership before deleting the workspace.</div>
                        </div>
                        <Button type="button" variant="destructive" size="sm" onClick={() => toast.warning("Workspace deletion is locked until ownership and connected-data exports are reviewed.")}>Review</Button>
                      </div>
                    </div>
                  </section>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <datalist id="workspace-time-zones">
            <option value="Asia/Ho_Chi_Minh" />
            <option value="Asia/Bangkok" />
            <option value="Asia/Singapore" />
            <option value="Asia/Tokyo" />
            <option value="Europe/London" />
            <option value="America/New_York" />
          </datalist>

          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="button" disabled={!activeDirty || !activeValid || saving || loading || (tab === "workspace" && !draft.workspace.canManage)} onClick={() => void saveActiveTab()}>
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}

function SettingsSectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div>
      <h3 id={id} className="font-heading text-base font-semibold">{title}</h3>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function SettingsSwitch({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className={cn("flex min-h-7 items-center gap-4 text-sm", disabled && "opacity-50")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={cn("relative h-[18px] w-8 shrink-0 rounded-full bg-muted transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring", checked && "bg-primary")}
        onClick={() => onCheckedChange(!checked)}
      >
        <span className={cn("absolute left-0.5 top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform", checked && "translate-x-3.5")} />
      </button>
      <span>{label}</span>
    </div>
  );
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const validation = validatePasswordChange(currentPassword, newPassword, confirmPassword);

  React.useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [open]);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!validation.valid || busy) return;
    setBusy(true);
    setError("");
    try {
      await readJsonResponse<{ ok: boolean }>(await fetch("/api/workspace/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      }));
      toast.success("Password updated", { description: "All other active sessions have been signed out." });
      onOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The password could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[480px] rounded-3xl border border-border bg-popover p-6 shadow-2xl [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:size-7">
        <form onSubmit={updatePassword}>
          <DialogHeader className="pr-8">
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Changing your password signs out all other active sessions.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-5">
            <Field>
              <FieldLabel>Current password <span className="text-destructive">*</span></FieldLabel>
              <Input type="password" value={currentPassword} autoComplete="current-password" placeholder="Enter current password" required disabled={busy} onChange={(event) => setCurrentPassword(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>New password <span className="text-destructive">*</span></FieldLabel>
              <Input type="password" value={newPassword} autoComplete="new-password" placeholder="Enter new password" required minLength={12} disabled={busy} onChange={(event) => setNewPassword(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Confirm new password <span className="text-destructive">*</span></FieldLabel>
              <Input type="password" value={confirmPassword} autoComplete="new-password" placeholder="Repeat new password" required disabled={busy} aria-invalid={confirmPassword.length > 0 && !validation.matches} onChange={(event) => setConfirmPassword(event.target.value)} />
            </Field>
            <p className="text-[11px] leading-4 text-muted-foreground">12+ characters · Uppercase · Lowercase · Number · Symbol · Different from current password</p>
            {error ? <Alert variant="destructive"><CircleAlertIcon /><AlertDescription>{error}</AlertDescription></Alert> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!validation.valid || busy}>
              {busy ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
              {busy ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
