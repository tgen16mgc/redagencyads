"use client";

import * as React from "react";
import { Button as HeroButton } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  MailIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
  WaypointsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceIdentity = {
  email: string;
  name: string;
  role: string;
  initials: string;
  avatarDataUrl?: string;
};

export type WorkspaceSessionStatus = {
  authenticated: boolean;
  configured: boolean;
  required: boolean;
  googleConfigured: boolean;
  googleAuthUrl: string | null;
  resetConfigured?: boolean;
  accessRequestConfigured?: boolean;
  signedInAt?: number | null;
  user: WorkspaceIdentity | null;
};

type AuthView = "sign-in" | "reset" | "reset-sent" | "request" | "request-sent";

export function WorkspaceAuth({
  status,
  theme,
  initialError,
  onThemeChange,
  onAuthenticated,
}: {
  status: WorkspaceSessionStatus;
  theme: "dark" | "light";
  initialError?: string;
  onThemeChange: () => void;
  onAuthenticated: (next: WorkspaceSessionStatus) => void;
}) {
  const [view, setView] = React.useState<AuthView>("sign-in");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [keepSignedIn, setKeepSignedIn] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  async function submitJson(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    return data;
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const next = await submitJson("/api/workspace/session", { email, password, keepSignedIn }) as WorkspaceSessionStatus;
      onAuthenticated(next);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Workspace sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await submitJson(view === "reset" ? "/api/workspace/reset" : "/api/workspace/access", { email });
      setView(view === "reset" ? "reset-sent" : "request-sent");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function moveTo(next: AuthView) {
    setView(next);
    setError("");
  }

  return (
    <main className="v2-auth-shell">
      <AuthStory />
      <section className="v2-auth-stage" aria-label="Workspace authentication">
        <div className="v2-auth-stage-nav">
          <a href="/landing"><ArrowLeftIcon />Back to website</a>
          <button type="button" className="v2-auth-theme" aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"} onClick={onThemeChange}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <div className={cn("v2-auth-card", view !== "sign-in" && "v2-auth-card-compact")}>
          {view === "sign-in" ? (
            <SignInForm
              busy={busy}
              configured={status.configured}
              email={email}
              error={error}
              googleAuthUrl={status.googleConfigured ? status.googleAuthUrl : null}
              keepSignedIn={keepSignedIn}
              password={password}
              showPassword={showPassword}
              onEmailChange={setEmail}
              onForgot={() => moveTo("reset")}
              onGoogleUnavailable={() => setError("Google sign-in is not configured on this deployment.")}
              onKeepSignedInChange={setKeepSignedIn}
              onPasswordChange={setPassword}
              onRequest={() => moveTo("request")}
              onShowPasswordChange={setShowPassword}
              onSubmit={signIn}
            />
          ) : view === "reset" || view === "request" ? (
            <EmailRequestForm
              busy={busy}
              email={email}
              error={error}
              kind={view}
              onBack={() => moveTo("sign-in")}
              onEmailChange={setEmail}
              onSubmit={submitEmail}
            />
          ) : (
            <RequestComplete email={email} kind={view} onBack={() => moveTo("sign-in")} />
          )}
        </div>
      </section>
    </main>
  );
}

export function AuthStory() {
  return (
    <section className="v2-auth-story" aria-label="Red Agency Ads Decision Workspace">
      <div className="v2-auth-glow" aria-hidden="true" />
      <div className="v2-auth-brand">
        <span><WaypointsIcon /></span>
        <div><b>Red Agency Ads</b><small>Decision Workspace</small></div>
      </div>
      <div className="v2-auth-message">
        <span className="v2-auth-ai-chip">Paid media decision operations</span>
        <h1>Welcome back to <br />the decision loop.</h1>
        <p>Move from signal to Verdict without losing the evidence, review state, or next action along the way.</p>
      </div>
      <div className="v2-auth-pulse">
        <div className="v2-auth-pulse-heading">
          <span>Today&apos;s decision pulse</span>
          <b>3 items ready</b>
        </div>
        <div className="v2-auth-pulse-row"><i data-tone="stable" /><span>Efficiency</span><b>Stable</b></div>
        <div className="v2-auth-pulse-row"><i data-tone="watch" /><span>Creative fatigue</span><b>Review</b></div>
        <div className="v2-auth-pulse-row"><i data-tone="move" /><span>Scale candidate</span><b>Ready</b></div>
      </div>
      <div className="v2-auth-trust"><ShieldCheckIcon />Private workspace · connected sources stay protected</div>
    </section>
  );
}

function AuthHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="v2-auth-card-header">
      <span className="v2-auth-security"><LockKeyholeIcon /></span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function SignInForm({
  busy,
  configured,
  email,
  error,
  googleAuthUrl,
  keepSignedIn,
  password,
  showPassword,
  onEmailChange,
  onForgot,
  onGoogleUnavailable,
  onKeepSignedInChange,
  onPasswordChange,
  onRequest,
  onShowPasswordChange,
  onSubmit,
}: {
  busy: boolean;
  configured: boolean;
  email: string;
  error: string;
  googleAuthUrl: string | null;
  keepSignedIn: boolean;
  password: string;
  showPassword: boolean;
  onEmailChange: (value: string) => void;
  onForgot: () => void;
  onGoogleUnavailable: () => void;
  onKeepSignedInChange: (value: boolean) => void;
  onPasswordChange: (value: string) => void;
  onRequest: () => void;
  onShowPasswordChange: (value: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <>
      <AuthHeader title="Log in to your workspace" description="Continue from the same evidence, Verdict, and reviewed next action." />
      {error ? <div className="v2-auth-error" role="alert">{error}</div> : null}
      {!configured && !error ? <div className="v2-auth-error" role="status">Workspace authentication is not configured on this deployment.</div> : null}
      <form className="v2-auth-form" onSubmit={onSubmit}>
        <AuthField icon={MailIcon} label="Work email">
          <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} autoComplete="email" placeholder="name@company.com" required />
        </AuthField>
        <AuthField icon={LockKeyholeIcon} label="Password">
          <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => onPasswordChange(event.target.value)} autoComplete="current-password" placeholder="Enter your password" minLength={8} required />
          <button type="button" className="v2-auth-reveal" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => onShowPasswordChange(!showPassword)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
        </AuthField>
        <div className="v2-auth-options">
          <label className="v2-auth-checkbox"><input type="checkbox" checked={keepSignedIn} onChange={(event) => onKeepSignedInChange(event.target.checked)} /><span><CheckIcon /></span>Keep me signed in</label>
          <button type="button" className="v2-auth-link" onClick={onForgot}>Forgot password?</button>
        </div>
        <button type="submit" className="v2-auth-primary" disabled={busy || !configured}>
          {busy ? <><span className="v2-auth-spinner" />Authenticating…</> : error ? "Try again" : "Sign in"}
        </button>
      </form>
      <div className="v2-auth-divider"><span />OR<span /></div>
      <HeroButton
        fullWidth
        variant="outline"
        className="v2-auth-google"
        onPress={() => { if (googleAuthUrl) window.location.href = googleAuthUrl; else onGoogleUnavailable(); }}
      >
        <Icon icon="logos:google-icon" aria-hidden="true" />
        Continue with Google
      </HeroButton>
      <div className="v2-auth-footer">Need a workspace invite? <button type="button" onClick={onRequest}>Request access</button></div>
    </>
  );
}

function EmailRequestForm({ busy, email, error, kind, onBack, onEmailChange, onSubmit }: {
  busy: boolean;
  email: string;
  error: string;
  kind: "reset" | "request";
  onBack: () => void;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const reset = kind === "reset";
  return (
    <>
      <AuthHeader
        title={reset ? "Reset your password" : "Request workspace access"}
        description={reset ? "Enter your work email and we’ll send a secure reset link." : "Ask an administrator to invite your work email to this workspace."}
      />
      {error ? <div className="v2-auth-error" role="alert">{error}</div> : null}
      <form className="v2-auth-form" onSubmit={onSubmit}>
        <AuthField icon={MailIcon} label="Work email">
          <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} autoComplete="email" placeholder="name@company.com" required />
        </AuthField>
        <button type="submit" className="v2-auth-primary" disabled={busy || !email}>
          {busy ? <><span className="v2-auth-spinner" />Sending…</> : reset ? "Send reset link" : "Request access"}
        </button>
      </form>
      <div className="v2-auth-footer v2-auth-footer-spacious">{reset ? "Remember your password?" : "Already have access?"} <button type="button" onClick={onBack}>Back to sign in</button></div>
    </>
  );
}

function RequestComplete({ email, kind, onBack }: { email: string; kind: "reset-sent" | "request-sent"; onBack: () => void }) {
  const reset = kind === "reset-sent";
  return (
    <div className="v2-auth-complete">
      <span className="v2-auth-complete-icon"><CheckIcon /></span>
      <h2>{reset ? "Check your inbox" : "Access requested"}</h2>
      <p>{reset ? "A secure password reset link was sent to" : "Your workspace access request was sent for"}</p>
      <b>{email}</b>
      <p className="v2-auth-complete-note">{reset ? "The link expires for your security. Check spam if it does not arrive shortly." : "A workspace administrator will review the request and follow up by email."}</p>
      <button type="button" className="v2-auth-primary" onClick={onBack}><ArrowLeftIcon />Back to sign in</button>
    </div>
  );
}

function AuthField({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <label className="v2-auth-field">
      <span className="v2-auth-label"><Icon />{label}</span>
      <span className="v2-auth-input">{children}</span>
    </label>
  );
}
