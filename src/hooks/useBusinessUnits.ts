import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { applyCompanyIdentity, applyTheme } from "../lib/theme";
import { useTable } from "./useTable";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import type { BusinessUnit } from "../lib/types";

// The full CRUD list of business units — the engine behind the
// Business Units admin page (src/pages/settings/BusinessUnits.tsx).
// Row Level Security does the real access control: any authenticated
// user can read every row (branding has to resolve for everyone), but
// only a Head Office admin can create/delete one, and a unit's own
// admin can only update their own row — see
// supabase/migrations/0005_business_units.sql.
export function useBusinessUnits() {
  return useTable<BusinessUnit>("business_units", { orderBy: "created_at", ascending: true });
}

// The business unit a NEW record (client, sub-contractor) should be
// created in. Prefers whichever unit is currently "in scope" — the
// viewer's own unit if they're unit-scoped, or the Business Unit
// switcher's current selection for a Head Office admin — falling back
// to the Head Office unit while that's still resolving. See
// MULTI_ENTITY_SPEC.md and BusinessUnitContext.
//
// This is a stopgap for forms that don't yet offer their own unit
// picker (Clients, Sub-Contractors "+ Add"/import) — once a page lets
// someone choose the unit explicitly, prefer that over this hook.
export function useDefaultBusinessUnitId() {
  const { effectiveUnitId, headOffice, loading } = useBusinessUnitContext();
  if (effectiveUnitId) return effectiveUnitId;
  if (loading) return null;
  return headOffice?.id ?? null;
}

// The subset of a business unit's fields the pre-auth Login/Signup
// screens need. Resolved via the get_head_office_branding() RPC
// (supabase/migrations/0006_business_units_phase2.sql) rather than a
// direct table read, because business_units' own RLS only allows
// authenticated reads — and even if it didn't, a table read would also
// hand an anonymous visitor every OTHER unit's contact/registration
// details, which this RPC deliberately doesn't.
export interface HeadOfficeBranding {
  company_name: string;
  logo_url: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_surface: string;
  color_surface_muted: string;
  color_ink: string;
  color_ink_muted: string;
}

export function useHeadOfficeBranding() {
  const [branding, setBranding] = useState<HeadOfficeBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .rpc("get_head_office_branding")
      .then(({ data, error }) => {
        if (!active) return;
        const row = ((data as HeadOfficeBranding[] | null) ?? [])[0] ?? null;
        if (!error && row) {
          applyTheme(row);
          applyCompanyIdentity(row.company_name, row.logo_url);
        }
        setBranding(row);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { branding, loading };
}
