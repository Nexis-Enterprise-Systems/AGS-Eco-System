import { Navigate } from "react-router-dom";
import { useBusinessUnitContext } from "../../context/BusinessUnitContext";

// This page's content moved into Business Units (System Settings →
// Business Units → Head Office) once a client could have more than one
// company profile — see MULTI_ENTITY_SPEC.md. The route stays live as
// a redirect so any existing bookmark or link still lands somewhere
// useful instead of a dead page.
export function CompanyProfile() {
  const { headOffice, loading } = useBusinessUnitContext();

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;
  if (headOffice) return <Navigate to={`/settings/business-units/${headOffice.id}`} replace />;
  return <Navigate to="/settings/business-units" replace />;
}
