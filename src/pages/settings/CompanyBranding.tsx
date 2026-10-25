import { Navigate } from "react-router-dom";
import { useBusinessUnitContext } from "../../context/BusinessUnitContext";

// Same move as CompanyProfile.tsx — branding is now edited per business
// unit (System Settings → Business Units → a unit's own page, which has
// a Branding section with the inherit/override toggle). Redirects any
// existing link to Head Office's own unit page rather than a dead page.
export function CompanyBranding() {
  const { headOffice, loading } = useBusinessUnitContext();

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;
  if (headOffice) return <Navigate to={`/settings/business-units/${headOffice.id}`} replace />;
  return <Navigate to="/settings/business-units" replace />;
}
