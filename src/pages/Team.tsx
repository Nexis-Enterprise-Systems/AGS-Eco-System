import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { supabase } from "../lib/supabase";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import type { TeamDirectoryEntry } from "../lib/types";

// "Who's who" across the whole system — every signed-in person,
// including a sub-contractor (who otherwise can't see any other
// profile at all), can see a colleague's name, photo, role and
// business unit here, even across units. Email/phone only show up
// for someone an admin has explicitly made visible (System Settings
// -> User Management -> Team Members) — most people show with just a
// name and a role. Powered by get_team_directory(), a masked read
// that doesn't touch the existing profiles RLS. See
// supabase/migrations/0007_user_profiles.sql.
export function Team() {
  const { units } = useBusinessUnitContext();
  const [people, setPeople] = useState<TeamDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .rpc("get_team_directory")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to load team directory:", error.message);
        }
        setPeople((data as TeamDirectoryEntry[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const unitName = (id: string | null) => {
    if (!id) return "All units";
    return units.find((u) => u.id === id)?.company_name ?? null;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Team" subtitle="Everyone signed in to this system, across every business unit." />

      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : people.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-muted">No one to show yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            const unit = unitName(p.business_unit_id);
            return (
              <div key={p.id} className="card flex items-start gap-3 p-4">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-sm font-semibold text-brand-primary">
                    {p.full_name.slice(0, 1).toUpperCase() || "?"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.full_name || "—"}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                    <span className="capitalize">{p.role}</span>
                    {units.length > 1 && unit && (
                      <>
                        <span>·</span>
                        <span>{unit}</span>
                      </>
                    )}
                  </div>
                  {(p.email || p.phone) && (
                    <div className="mt-1.5 space-y-0.5 text-xs">
                      {p.email && <div className="truncate text-ink-muted">{p.email}</div>}
                      {p.phone && <div className="text-ink-muted">{p.phone}</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
