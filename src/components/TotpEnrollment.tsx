import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Shared TOTP enroll-and-verify flow, used by both the mandatory
// first-time setup screen (MfaSetup.tsx) and the "replace authenticator"
// flow on the Account page. Supabase's enroll() call returns a
// ready-to-render SVG QR code and a plain-text secret as a fallback —
// no separate QR library needed.
export function TotpEnrollment({
  onVerified,
  onCancel,
}: {
  onVerified: (factorId: string) => void;
  onCancel?: () => void;
}) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;

    async function start() {
      // Clean up any stale unverified factor left over from an
      // abandoned attempt (e.g. a dev double-mount) before starting a
      // fresh one — Supabase would otherwise accumulate them.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const stale = existing?.totp?.filter((f) => f.status === "unverified") ?? [];
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      if (!active) return;

      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (!active) return;
      if (err || !data) {
        setError(err?.message ?? "Could not start 2FA setup. Refresh and try again.");
        setStarting(false);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStarting(false);
    }

    start();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr || !challenge) {
      setError(challengeErr?.message ?? "Could not verify that code.");
      setBusy(false);
      return;
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    if (verifyErr) {
      setError("That code didn't match — check your authenticator app and try again.");
      setBusy(false);
      return;
    }

    setBusy(false);
    onVerified(factorId);
  }

  if (starting) return <p className="text-sm text-ink-muted">Starting setup…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm">Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
      {qrCode && (
        <div className="flex justify-center rounded-lg border border-line bg-white p-4">
          <img src={qrCode} alt="Scan with your authenticator app" className="h-40 w-40" />
        </div>
      )}
      {secret && (
        <p className="break-all text-center text-xs text-ink-muted">
          Can't scan it? Enter this key manually: <span className="font-mono">{secret}</span>
        </p>
      )}
      <div>
        <label className="label" htmlFor="totp-code">
          Verification code
        </label>
        <input
          id="totp-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          className="input text-center text-lg tracking-[0.5em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn-primary" disabled={busy || !factorId || code.length < 6} onClick={handleVerify}>
          {busy ? "Verifying…" : "Confirm and enable"}
        </button>
      </div>
    </div>
  );
}
