"use client";

import * as React from "react";
import { CheckIcon, ClipboardIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function MetaConnectDialog({
  open,
  onOpenChange,
  oauthConfigured,
  returnTo,
  token,
  loading,
  error,
  onTokenChange,
  onConnectToken,
  onUseSample,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oauthConfigured: boolean | null;
  returnTo: "ads" | "publisher";
  token: string;
  loading: boolean;
  error: string;
  onTokenChange: (token: string) => void;
  onConnectToken: () => Promise<void>;
  onUseSample: () => void;
}) {
  const [manual, setManual] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setManual(false);
      setCopied(false);
    }
  }, [open]);

  async function copyError() {
    if (!error) return;
    await navigator.clipboard.writeText(error);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-3xl border border-border bg-popover p-6">
        <DialogHeader>
          <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheckIcon className="size-5" /></span>
          <DialogTitle className="text-xl font-semibold">{manual ? "Connect Meta with an access token" : "Connect Meta"}</DialogTitle>
          <DialogDescription className="mt-1 leading-5">
            {manual
              ? "Facebook Login is not configured on this deployment. Validate a private Meta token through the encrypted server session instead."
              : "Authorize read-only access so the diagnosis can calculate CPC, CPA and ROAS from verified delivery data."}
          </DialogDescription>
        </DialogHeader>

        {!manual ? (
          <div className="mt-5 grid gap-4">
            <span className="w-fit rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Read-only connection</span>
            <div className="grid gap-3 rounded-2xl bg-card p-4 text-sm">
              <PermissionRow>Read campaign delivery and spend</PermissionRow>
              <PermissionRow>Read conversion events used by the selected funnel</PermissionRow>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">No publishing or budget-change permission is requested.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Meta access token
              <Input type="password" value={token} onChange={(event) => onTokenChange(event.target.value)} placeholder="Paste a private Meta access token" autoComplete="off" disabled={loading} />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">The token is validated server-side, encrypted, and stored only in an HttpOnly cookie.</p>
            {error ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p>{error}</p>
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => void copyError()}>
                  <ClipboardIcon data-icon="inline-start" />{copied ? "Error details copied" : "Copy error details"}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="mt-6">
          {!manual ? <Button type="button" variant="ghost" className="mr-auto" onClick={onUseSample}>Use sample report</Button> : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!manual ? (
            <Button
              type="button"
              disabled={oauthConfigured === null}
              onClick={() => {
                if (oauthConfigured) window.location.assign(`/api/auth/facebook/start?returnTo=${returnTo}`);
                else setManual(true);
              }}
            >
              {oauthConfigured === null ? <Spinner data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />}
              {oauthConfigured === false ? "Use access token" : "Continue to Meta"}
            </Button>
          ) : (
            <Button type="button" disabled={loading || token.trim().length < 20} onClick={() => void onConnectToken()}>
              {loading ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
              {loading ? "Validating…" : "Connect Meta"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3"><span className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground"><CheckIcon className="size-3.5" /></span><span>{children}</span></div>;
}
