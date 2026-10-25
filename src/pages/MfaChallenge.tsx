import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useHeadOfficeBranding } from "../hooks/useBusinessUnits";
import { BrandLogo } from "../components/BrandLogo";

// Shown right after a correct password sign-in when the account has a
// 2FA factor enrolled (aal currentLevel < nextLevel). ProtectedRoute
// redirects here for any signed-in-but-not-yet-verified session, so
// this is the one place the 6-digit code gate actually happens.
export function MfaChallenge() {
  const { session, needsMfaChallenge, refreshMfaState, signOut } = useAuth();
  const { branding: settings } = useHeadOfficeBranding();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loadingFactor, setLoadingFactor] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
      if (!active) return;
      if (err) {
        setError(err.message);
      } else {
        const verified = data?.totp?.find((f) => f.status === "verified");
        setFactorId(verified?.id ?? null);
      }
      setLoadingFactor(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!session) return <Navigate to="/login" replace />;
  if (!needsMfaChallenge) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr || !challenge) {
      setError(challengeErr?.message ?? "Could not start the verification challenge.");
      setBusy(false);
      return;
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    if (verifyErr) {
      setError("That code didn't work — check your authenticator app and try again.");
      setBusy(false);
      return;
    }

    await refreshMfaState();
    setBusy(false);
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface-muted px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandLogo src={settings?.logo_url} maxWidth={220} />
          <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">Eco System</div>
          <p className="text-sm text-ink-muted">Enter the 6-digit code from your authenticator app.</p>
        </div>

        {loadingFactor ? (
          <p className="text-center text-sm text-ink-muted">Loading…</p>
        ) : !factorId ? (
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            Your account is set up for 2FA but no verified authenticator was found. Contact an admin.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="code">
                Verification code
              </label>
              <input
                id="code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                required
                className="input text-center text-lg tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button className="btn-primary w-full" type="submit" disabled={busy || code.length < 6}>
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        <button className="mt-4 w-full text-center text-xs text-ink-muted hover:underline" onClick={() => signOut()}>
          Sign in with a different account
        </button>
      </div>
    </div>
  );
}
