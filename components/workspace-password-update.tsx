"use client";

import * as React from "react";
import { CheckIcon, EyeIcon, EyeOffIcon, LockKeyholeIcon, MoonIcon, SunIcon } from "lucide-react";
import { AuthStory } from "@/components/workspace-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function WorkspacePasswordUpdate() {
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [complete, setComplete] = React.useState(false);
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    const nextTheme = window.localStorage.getItem("decision-workspace-theme") === "light" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("light", nextTheme === "light");
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("decision-workspace-theme", next);
      document.documentElement.classList.toggle("light", next === "light");
      return next;
    });
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 10) {
      setError("Use at least 10 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError("The recovery session is invalid or expired. Request a new reset email.");
      return;
    }
    setComplete(true);
  }

  return (
    <main className="v2-auth-shell">
      <AuthStory />
      <section className="v2-auth-stage" aria-label="Update workspace password">
        <div className="v2-auth-stage-nav">
          <a href="/landing">Back to website</a>
          <button type="button" className="v2-auth-theme" aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"} onClick={toggleTheme}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <div className="v2-auth-card v2-auth-card-compact">
          {complete ? (
            <div className="v2-auth-complete">
              <span className="v2-auth-complete-icon"><CheckIcon /></span>
              <h2>Password updated</h2>
              <p>Your new password is active. You can return to Decision Workspace now.</p>
              <a className="v2-auth-primary" href="/">Continue to workspace</a>
            </div>
          ) : (
            <>
              <header className="v2-auth-card-header">
                <span className="v2-auth-security"><LockKeyholeIcon /></span>
                <h2>Choose a new password</h2>
                <p>Use a strong password you do not reuse for another account.</p>
              </header>
              {error ? <div className="v2-auth-error" role="alert">{error}</div> : null}
              <form className="v2-auth-form" onSubmit={updatePassword}>
                <label className="v2-auth-field">
                  <span className="v2-auth-label"><LockKeyholeIcon />New password</span>
                  <span className="v2-auth-input">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={10} required />
                    <button type="button" className="v2-auth-reveal" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </span>
                </label>
                <label className="v2-auth-field">
                  <span className="v2-auth-label"><LockKeyholeIcon />Confirm password</span>
                  <span className="v2-auth-input">
                    <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={10} required />
                  </span>
                </label>
                <button type="submit" className="v2-auth-primary" disabled={busy}>
                  {busy ? <><span className="v2-auth-spinner" />Updating…</> : "Update password"}
                </button>
              </form>
              <div className="v2-auth-footer v2-auth-footer-spacious"><a href="/">Back to sign in</a></div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
