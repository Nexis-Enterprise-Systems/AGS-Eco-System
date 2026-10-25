import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { TotpEnrollment } from "../components/TotpEnrollment";

interface TotpFactor {
  id: string;
  status: "verified" | "unverified";
  friendly_name?: string | null;
  created_at: string;
}

// 2FA is mandatory for every account (see AuthContext / MfaSetup), so
// this page never offers a bare "turn it off" — only "replace your
// authenticator" (enroll a new one, then retire the old one), so an
// account can never end up with zero verified factors again after
// its first login.
export function Account() {
  const { profile, aal, refreshMfaState } = useAuth();
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshFactors() {
    setLoading(true);
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) setError(err.message);
    setFactors((data?.totp as TotpFactor[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refreshFactors();
  }, []);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  async function handleReplaced(newFactorId: string) {
    // Retire every other verified factor now that the new one is
    // confirmed — never leaves the account with zero factors, and
    // never removes the old one until the new one actually works.
    const others = factors.filter((f) => f.status === "verified" && f.id !== newFactorId);
    for (const f of others) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    setMessage("Your authenticator app has been updated.");
    setReplacing(false);
    await refreshFactors();
    await refreshMfaState();
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Account & Security" subtitle={profile?.full_name || profile?.email} />

      {message && <div className="rounded-lg bg-green-50 dark:bg-green-900/30 px-4 py-2 text-sm text-green-700 dark:text-green-300">{message}</div>}

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Two-factor authentication</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Every account on this system requires a 6-digit code from an authenticator app (Google Authenticator,
            Authy, 1Password, etc.) in addition to a password — it isn't optional, since the system holds client
            data. You can replace which device/app is enrolled below.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : replacing ? (
          <TotpEnrollment onVerified={handleReplaced} onCancel={() => setReplacing(false)} />
        ) : verifiedFactor ? (
          <div className="flex items-center justify-between rounded-lg border border-line p-4">
            <div>
              <div className="text-sm font-medium">Authenticator app enabled</div>
              <div className="text-xs text-ink-muted">
                {aal?.currentLevel === "aal2"
                  ? "Verified this session."
                  : `Set up ${new Date(verifiedFactor.created_at).toLocaleDateString()}.`}
              </div>
            </div>
            <button className="btn-secondary" onClick={() => setReplacing(true)}>
              Replace authenticator
            </button>
          </div>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400">
            No verified authenticator found — you'll be asked to set one up the next time you sign in.
          </p>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>
    </div>
  );
}
