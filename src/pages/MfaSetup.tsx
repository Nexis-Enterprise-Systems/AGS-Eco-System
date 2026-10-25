import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHeadOfficeBranding } from "../hooks/useBusinessUnits";
import { BrandLogo } from "../components/BrandLogo";
import { TotpEnrollment } from "../components/TotpEnrollment";

// Mandatory first-time 2FA enrollment. Every account lands here on
// first login (or any time its verified-factor count is zero) and
// there is no way past it other than completing setup or signing
// out — deliberately no "skip for now". This is what makes 2FA
// mandatory rather than a suggestion sitting in Account & Security.
export function MfaSetup() {
  const { session, needsMfaSetup, refreshMfaState, signOut } = useAuth();
  const { branding: settings } = useHeadOfficeBranding();

  if (!session) return <Navigate to="/login" replace />;
  if (!needsMfaSetup) return <Navigate to="/" replace />;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface-muted px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandLogo src={settings?.logo_url} maxWidth={220} />
          <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">Eco System</div>
          <p className="text-sm text-ink-muted">
            Two-factor authentication is required on every account before you can continue.
          </p>
        </div>

        <TotpEnrollment onVerified={() => refreshMfaState()} />

        <button className="mt-4 w-full text-center text-xs text-ink-muted hover:underline" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
