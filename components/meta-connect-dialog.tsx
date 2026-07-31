"use client";

import * as React from "react";
import { CircleHelpIcon, ClipboardIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
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
  returnTo: "ads" | "publisher" | "settings";
  token: string;
  loading: boolean;
  error: string;
  onTokenChange: (token: string) => void;
  onConnectToken: () => Promise<void>;
  onUseSample: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
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
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[640px] rounded-3xl border border-border bg-popover p-6 shadow-2xl [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:size-7">
        <DialogHeader className="pr-8">
          <DialogTitle>Connect Meta</DialogTitle>
          <DialogDescription className="mt-1 leading-5">Use Facebook Login (recommended) or paste a Meta access token.</DialogDescription>
        </DialogHeader>

        <div className="mt-6 grid gap-4">
          <div className="flex items-start gap-3 text-sm">
            <CircleHelpIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-medium">Secure token session</div>
              <p className="text-muted-foreground">Validated server-side and stored in an encrypted HttpOnly session.</p>
            </div>
          </div>

          <Button
            type="button"
            className="mt-8 w-full"
            disabled={oauthConfigured !== true}
            onClick={() => window.location.assign(`/api/auth/facebook/start?returnTo=${returnTo}`)}
          >
            {oauthConfigured === null ? <Spinner data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />}
            {oauthConfigured === null ? "Checking Facebook Login…" : oauthConfigured ? "Continue with Facebook" : "Facebook Login unavailable"}
          </Button>

          <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />or use an access token<span className="h-px flex-1 bg-border" />
          </div>

          <label className="grid gap-2 text-sm font-medium">
            <span>Meta access token <span className="text-destructive">*</span></span>
            <Input type="password" value={token} onChange={(event) => onTokenChange(event.target.value)} placeholder="Paste Meta access token" autoComplete="off" disabled={loading} />
          </label>
          <p className="text-[11px] leading-4 text-muted-foreground">Permissions: ads_read, pages_show_list, pages_read_engagement, pages_manage_posts.<br />Accounts load only after validation.</p>
          {error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p>{error}</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => void copyError()}>
                <ClipboardIcon data-icon="inline-start" />{copied ? "Error details copied" : "Copy error details"}
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-6">
          {returnTo !== "settings" ? <Button type="button" variant="ghost" className="mr-auto" onClick={onUseSample}>Use sample report</Button> : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={loading || token.trim().length < 20} onClick={() => void onConnectToken()}>
            {loading ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
            {loading ? "Validating…" : "Validate token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
