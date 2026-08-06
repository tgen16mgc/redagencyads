"use client";

import * as React from "react";
import {
  Alert as HeroAlert,
  Button as HeroButton,
  Checkbox as HeroCheckbox,
  FieldError,
  Form,
  Input as HeroInput,
  Label as HeroLabel,
  TextField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LockKeyholeIcon,
  MailIcon,
  ShieldCheckIcon,
  UserPlusIcon,
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

type AuthView = "sign-in" | "register" | "register-sent" | "reset" | "reset-sent";

export function WorkspaceAuth({
  status,
  initialError,
  initialView = "sign-in",
  onAuthenticated,
}: {
  status: WorkspaceSessionStatus;
  initialError?: string;
  initialView?: "sign-in" | "register";
  onAuthenticated: (next: WorkspaceSessionStatus) => void;
}) {
  const [view, setView] = React.useState<AuthView>(initialView);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [keepSignedIn, setKeepSignedIn] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  React.useEffect(() => {
    setView(initialView);
  }, [initialView]);

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

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError("Accept the terms to create an account.");
      return;
    }

    setBusy(true);
    try {
      const result = await submitJson("/api/workspace/register", {
        fullName,
        email,
        password,
        acceptedTerms,
      }) as {
        confirmationRequired?: boolean;
        status?: WorkspaceSessionStatus;
      };
      if (result.status?.authenticated) {
        onAuthenticated(result.status);
        return;
      }
      setView("register-sent");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Account registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await submitJson("/api/workspace/reset", { email });
      setView("reset-sent");
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
    <main className="v2-auth-shell" data-theme="light">
      <AuthStory />
      <section className="v2-auth-stage" aria-label="Workspace authentication">
        <div className="v2-auth-stage-nav">
          <a href="/landing"><ArrowLeftIcon />Back to website</a>
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
              onRegister={() => moveTo("register")}
              onShowPasswordChange={setShowPassword}
              onSubmit={signIn}
            />
          ) : view === "register" ? (
            <RegisterForm
              acceptedTerms={acceptedTerms}
              busy={busy}
              configured={status.configured}
              confirmPassword={confirmPassword}
              email={email}
              error={error}
              fullName={fullName}
              password={password}
              showPassword={showPassword}
              onAcceptedTermsChange={setAcceptedTerms}
              onBack={() => moveTo("sign-in")}
              onConfirmPasswordChange={setConfirmPassword}
              onEmailChange={setEmail}
              onFullNameChange={setFullName}
              onPasswordChange={setPassword}
              onShowPasswordChange={setShowPassword}
              onSubmit={register}
            />
          ) : view === "reset" ? (
            <EmailRequestForm
              busy={busy}
              email={email}
              error={error}
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
  onRegister,
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
  onRegister: () => void;
  onShowPasswordChange: (value: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <>
      <AuthHeader title="Log in to your workspace" description="Continue from the same evidence, Verdict, and reviewed next action." />
      <AuthError message={error} />
      {!configured && !error ? <AuthNotice message="Workspace authentication is not configured on this deployment." /> : null}
      <Form className="v2-auth-form" onSubmit={onSubmit}>
        <AuthTextField icon={MailIcon} label="Work email" name="email" type="email" value={email} onChange={onEmailChange} autoComplete="email" placeholder="name@company.com" />
        <AuthTextField icon={LockKeyholeIcon} label="Password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={onPasswordChange} autoComplete="current-password" placeholder="Enter your password" minLength={8}>
          <button type="button" className="v2-auth-reveal" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => onShowPasswordChange(!showPassword)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
        </AuthTextField>
        <div className="v2-auth-options">
          <HeroCheckbox isSelected={keepSignedIn} onChange={onKeepSignedInChange} variant="secondary">
            <HeroCheckbox.Content className="text-xs text-muted-foreground">
              <HeroCheckbox.Control><HeroCheckbox.Indicator /></HeroCheckbox.Control>
              Keep me signed in
            </HeroCheckbox.Content>
          </HeroCheckbox>
          <button type="button" className="v2-auth-link" onClick={onForgot}>Forgot password?</button>
        </div>
        <HeroButton type="submit" fullWidth isDisabled={busy || !configured} isPending={busy} className="v2-auth-primary">
          {busy ? "Authenticating..." : error ? "Try again" : "Sign in"}
        </HeroButton>
      </Form>
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
      <div className="v2-auth-footer">New to Red Agency Ads? <button type="button" onClick={onRegister}>Create an account</button></div>
    </>
  );
}

function RegisterForm({
  acceptedTerms,
  busy,
  configured,
  confirmPassword,
  email,
  error,
  fullName,
  password,
  showPassword,
  onAcceptedTermsChange,
  onBack,
  onConfirmPasswordChange,
  onEmailChange,
  onFullNameChange,
  onPasswordChange,
  onShowPasswordChange,
  onSubmit,
}: {
  acceptedTerms: boolean;
  busy: boolean;
  configured: boolean;
  confirmPassword: string;
  email: string;
  error: string;
  fullName: string;
  password: string;
  showPassword: boolean;
  onAcceptedTermsChange: (value: boolean) => void;
  onBack: () => void;
  onConfirmPasswordChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onShowPasswordChange: (value: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  return (
    <>
      <AuthHeader title="Create your workspace account" description="Start with viewer access, explore the decision loop, and connect owned data when you're ready." />
      <AuthError message={error} />
      {!configured && !error ? <AuthNotice message="Account registration is not configured on this deployment." /> : null}
      <Form className="v2-auth-form" onSubmit={onSubmit}>
        <AuthTextField icon={UserPlusIcon} label="Full name" name="fullName" value={fullName} onChange={onFullNameChange} autoComplete="name" placeholder="Your name" minLength={2} />
        <AuthTextField icon={MailIcon} label="Work email" name="email" type="email" value={email} onChange={onEmailChange} autoComplete="email" placeholder="name@company.com" />
        <AuthTextField icon={LockKeyholeIcon} label="Password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={onPasswordChange} autoComplete="new-password" placeholder="At least 8 characters" minLength={8}>
          <button type="button" className="v2-auth-reveal" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => onShowPasswordChange(!showPassword)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
        </AuthTextField>
        <AuthTextField icon={LockKeyholeIcon} label="Confirm password" name="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={onConfirmPasswordChange} autoComplete="new-password" placeholder="Repeat your password" minLength={8} error={mismatch ? "Passwords do not match." : undefined} />
        <HeroCheckbox isRequired isInvalid={!acceptedTerms && Boolean(error)} isSelected={acceptedTerms} onChange={onAcceptedTermsChange} variant="secondary">
          <HeroCheckbox.Content className="items-start text-xs leading-5 text-muted-foreground">
            <HeroCheckbox.Control className="mt-0.5"><HeroCheckbox.Indicator /></HeroCheckbox.Control>
            <span>I agree to the <a className="text-primary hover:underline" href="/terms">Terms</a> and <a className="text-primary hover:underline" href="/privacy">Privacy Policy</a>.</span>
          </HeroCheckbox.Content>
          <FieldError>Accept the terms to create an account.</FieldError>
        </HeroCheckbox>
        <HeroButton type="submit" fullWidth isDisabled={busy || !configured || mismatch} isPending={busy} className="v2-auth-primary">
          {busy ? "Creating account..." : "Create account"}
        </HeroButton>
      </Form>
      <div className="v2-auth-footer v2-auth-footer-spacious">Already have an account? <button type="button" onClick={onBack}>Back to sign in</button></div>
    </>
  );
}

function EmailRequestForm({ busy, email, error, onBack, onEmailChange, onSubmit }: {
  busy: boolean;
  email: string;
  error: string;
  onBack: () => void;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <>
      <AuthHeader
        title="Reset your password"
        description="Enter your work email and we'll send a secure reset link."
      />
      <AuthError message={error} />
      <Form className="v2-auth-form" onSubmit={onSubmit}>
        <AuthTextField icon={MailIcon} label="Work email" name="email" type="email" value={email} onChange={onEmailChange} autoComplete="email" placeholder="name@company.com" />
        <HeroButton type="submit" fullWidth isDisabled={busy || !email} isPending={busy} className="v2-auth-primary">
          {busy ? "Sending..." : "Send reset link"}
        </HeroButton>
      </Form>
      <div className="v2-auth-footer v2-auth-footer-spacious">Remember your password? <button type="button" onClick={onBack}>Back to sign in</button></div>
    </>
  );
}

function RequestComplete({ email, kind, onBack }: { email: string; kind: "reset-sent" | "register-sent"; onBack: () => void }) {
  const reset = kind === "reset-sent";
  return (
    <div className="v2-auth-complete">
      <span className="v2-auth-complete-icon"><CheckIcon /></span>
      <h2>{reset ? "Check your inbox" : "Confirm your email"}</h2>
      <p>{reset ? "A secure password reset link was sent to" : "We sent an account confirmation link to"}</p>
      <b>{email}</b>
      <p className="v2-auth-complete-note">{reset ? "The link expires for your security. Check spam if it does not arrive shortly." : "Confirm the address, then sign in. Your viewer access is created automatically."}</p>
      <button type="button" className="v2-auth-primary" onClick={onBack}><ArrowLeftIcon />Back to sign in</button>
    </div>
  );
}

function AuthTextField({
  autoComplete,
  children,
  error,
  icon: Icon,
  label,
  minLength,
  name,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  autoComplete?: string;
  children?: React.ReactNode;
  error?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  minLength?: number;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  value: string;
}) {
  return (
    <TextField className="v2-auth-field" fullWidth isRequired isInvalid={Boolean(error)} name={name} value={value} onChange={onChange}>
      <HeroLabel className="v2-auth-label"><Icon />{label}</HeroLabel>
      <span className="v2-auth-input">
        <HeroInput autoComplete={autoComplete} minLength={minLength} placeholder={placeholder} type={type} />
        {children}
      </span>
      {error ? <FieldError className="text-xs text-danger">{error}</FieldError> : null}
    </TextField>
  );
}

function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <HeroAlert status="danger" className="v2-auth-alert" role="alert">
      <HeroAlert.Indicator />
      <HeroAlert.Content><HeroAlert.Description>{message}</HeroAlert.Description></HeroAlert.Content>
    </HeroAlert>
  );
}

function AuthNotice({ message }: { message: string }) {
  return (
    <HeroAlert status="warning" className="v2-auth-alert" role="status">
      <HeroAlert.Indicator />
      <HeroAlert.Content><HeroAlert.Description>{message}</HeroAlert.Description></HeroAlert.Content>
    </HeroAlert>
  );
}
