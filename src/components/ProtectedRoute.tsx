import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../lib/types";

export function ProtectedRoute({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: UserRole[];
}) {
  const { session, profile, loading, needsMfaSetup, needsMfaChallenge } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-ink-muted">Loading…</div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // 2FA is mandatory, not optional, for every account. An account
  // that has never enrolled a factor is sent to /mfa-setup, which has
  // no skip — that's what actually makes it mandatory rather than a
  // suggestion. An account that has enrolled but hasn't completed the
  // code challenge in THIS session goes to /mfa-challenge. Either way
  // this is a UX convenience, not the real enforcement — Postgres
  // itself refuses data access below aal2, see
  // supabase/migrations/0002_mandatory_mfa.sql.
  if (needsMfaSetup) return <Navigate to="/mfa-setup" replace />;
  if (needsMfaChallenge) return <Navigate to="/mfa-challenge" replace />;

  if (allow && profile && !allow.includes(profile.role)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-ink-muted">
        You don't have access to this page.
      </div>
    );
  }

  return <>{children}</>;
}
