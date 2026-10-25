import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { applyCompanyIdentity, applyTheme } from "../lib/theme";
import { useAuth } from "./AuthContext";
import type { BusinessUnit } from "../lib/types";

const VIEWING_UNIT_STORAGE_KEY = "nexis_viewing_business_unit_id";

// Business Units, in one place, for every authenticated page. See
// MULTI_ENTITY_SPEC.md for the full design. Three things live here:
//
// 1. `units` — every business unit this deployment has (RLS lets any
//    authenticated user read all of them; only a Head Office admin can
//    create/delete one).
// 2. The "viewing as" switcher — a Head Office-scoped admin
//    (profile.business_unit_id === null) can pick one unit to view the
//    app as, or "All units". This is a client-side convenience only —
//    it changes what's DISPLAYED, never what Row Level Security
//    allows: a Head Office admin already receives every unit's rows
//    from the database (that's what business_unit_id === null means),
//    the switcher just narrows what pages choose to show. A
//    unit-scoped person never sees a switcher; their own unit is
//    always `effectiveUnitId`, not optional.
// 3. `activeBranding` — the unit whose logo/colours the app should be
//    themed with right now: the effective unit's own branding if it
//    set `use_custom_branding`, otherwise the Head Office unit's
//    (every unit falls back to Head Office by default).
interface BusinessUnitContextValue {
  units: BusinessUnit[];
  loading: boolean;
  headOffice: BusinessUnit | null;
  isHeadOfficeScoped: boolean;
  viewingUnitId: string | null;
  setViewingUnitId: (id: string | null) => void;
  effectiveUnitId: string | null;
  activeBranding: BusinessUnit | null;
  refresh: () => Promise<void>;
}

const BusinessUnitContext = createContext<BusinessUnitContextValue | undefined>(undefined);

export function BusinessUnitProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingUnitId, setViewingUnitIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(VIEWING_UNIT_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const isHeadOfficeScoped = !profile?.business_unit_id;

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("business_units").select("*").order("created_at", { ascending: true });
    setUnits((data as BusinessUnit[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  const setViewingUnitId = useCallback((id: string | null) => {
    setViewingUnitIdState(id);
    try {
      if (id) localStorage.setItem(VIEWING_UNIT_STORAGE_KEY, id);
      else localStorage.removeItem(VIEWING_UNIT_STORAGE_KEY);
    } catch {
      // Best-effort only — the switcher still works for this page load
      // even if localStorage is unavailable, it just won't be
      // remembered next visit.
    }
  }, []);

  const headOffice = useMemo(() => units.find((u) => u.is_head_office) ?? null, [units]);

  // A unit-scoped person's effective unit is always their own,
  // whatever the (unused, for them) switcher state says. A Head
  // Office-scoped admin's effective unit is whatever they've switched
  // to, or null for "All units".
  const effectiveUnitId = profile?.business_unit_id ?? (isHeadOfficeScoped ? viewingUnitId : null);

  const activeBranding = useMemo(() => {
    const target = effectiveUnitId ? units.find((u) => u.id === effectiveUnitId) : headOffice;
    if (!target) return headOffice;
    return target.use_custom_branding ? target : headOffice;
  }, [effectiveUnitId, units, headOffice]);

  useEffect(() => {
    if (!activeBranding) return;
    applyTheme(activeBranding);
    applyCompanyIdentity(activeBranding.company_name, activeBranding.logo_url);
  }, [activeBranding]);

  return (
    <BusinessUnitContext.Provider
      value={{
        units,
        loading,
        headOffice,
        isHeadOfficeScoped,
        viewingUnitId,
        setViewingUnitId,
        effectiveUnitId,
        activeBranding,
        refresh,
      }}
    >
      {children}
    </BusinessUnitContext.Provider>
  );
}

export function useBusinessUnitContext() {
  const ctx = useContext(BusinessUnitContext);
  if (!ctx) throw new Error("useBusinessUnitContext must be used within BusinessUnitProvider");
  return ctx;
}
