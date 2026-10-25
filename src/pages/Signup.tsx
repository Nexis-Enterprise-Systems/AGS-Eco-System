import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHeadOfficeBranding } from "../hooks/useBusinessUnits";
import { BrandLogo } from "../components/BrandLogo";
import { supabase } from "../lib/supabase";
import { NameInput } from "../components/FormattedInputs";

// Self-service account creation. Anyone can reach this page, but an
// account can only actually be created for an email an admin has
// already added on the Invited Users page (+ Add, or Import
// CSV/Excel). That's enforced twice: here, as a friendlier
// "not recognized" message before the user even sets a password, and
// — the part that actually matters — inside the handle_new_user
// trigger in supabase/migrations/0003_self_signup.sql, which refuses
// the signup at the database level for any email not on the list.
// Same pattern as mandatory 2FA: a client-side convenience backed by
// a real database check that can't be bypassed by going around this
// page.
export function Signup() {
  const { session, signUp } = useAuth();
  // Pre-auth, same as Login — always the Head Office unit's branding.
  const { branding: settings } = useHeadOfficeBranding();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [recognized, setRecognized] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // Debounced "is this email invited?" check via the check_invite RPC
  // — pure UX, purely optional. It only ever confirms/denies the one
  // email typed in, never lists the rest of the allowlist.
  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setRecognized(null);
      return;
    }
    let active = true;
    setChecking(true);
    const timer = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc("check_invite", { p_email: trimmed });
      if (!active) return;
      setChecking(false);
      if (err) {
        setRecognized(null);
        return;
      }
      const match = data?.[0];
      setRecognized(!!match);
      setFullName((current) => current || match?.full_name || "");
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [email]);

  if (session) return <Navigate to="/" replace />;

  if (awaitingConfirmation) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-muted px-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold">Check your email</h1>
          <p className="text-sm text-ink-muted">
            We've sent a confirmation link to <strong>{email}</strong>. Click it, then come back and sign in.
          </p>
          <Link className="mt-6 inline-block text-sm text-brand-primary hover:underline" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    const { error: err, needsEmailConfirmation } = await signUp(email.trim(), password, fullName.trim());
    setBusy(false);

    if (err) {
      setError(err);
      return;
    }
    if (needsEmailConfirmation) {
      setAwaitingConfirmation(true);
    }
    // Otherwise the session is already active — AuthProvider's own
    // auth-state listener picks it up, the `if (session)` redirect
    // above fires, and ProtectedRoute sends them on to /mfa-setup from
    // there, same as any other first login.
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface-muted px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandLogo src={settings?.logo_url} maxWidth={220} />
          <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">Eco System</div>
          <p className="text-sm text-ink-muted">Create your account</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {checking && <p className="mt-1 text-xs text-ink-muted">Checking…</p>}
            {!checking && recognized === true && (
              <p className="mt-1 text-xs text-green-700 dark:text-green-300">Recognized — you're clear to continue.</p>
            )}
            {!checking && recognized === false && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Not recognized yet. Double-check this matches the email your administrator gave you exactly.
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="fullName">
              Full name
            </label>
            <NameInput id="fullName" type="text" required person value={fullName} onChange={setFullName} autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-muted">
          Already have an account?{" "}
          <Link className="text-brand-primary hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
