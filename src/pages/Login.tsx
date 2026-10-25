import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHeadOfficeBranding } from "../hooks/useBusinessUnits";
import { BrandLogo } from "../components/BrandLogo";
import { ThemeToggle } from "../components/ThemeToggle";

export function Login() {
  const { session, signIn } = useAuth();
  // Pre-auth: which unit someone belongs to is only known once they've
  // signed in, so the login screen always shows the Head Office unit's
  // branding — see supabase/migrations/0006_business_units_phase2.sql.
  const { branding: settings } = useHeadOfficeBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-surface-muted px-4">
      <ThemeToggle className="absolute right-6 top-5" />
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandLogo src={settings?.logo_url} maxWidth={220} />
          <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">Eco System</div>
          <p className="text-sm text-ink-muted">Sign in to continue</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="email">
              Email
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
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-muted">
          Been invited?{" "}
          <Link className="text-brand-primary hover:underline" to="/signup">
            Create your account
          </Link>
        </p>
      </div>
    </div>
  );
}
