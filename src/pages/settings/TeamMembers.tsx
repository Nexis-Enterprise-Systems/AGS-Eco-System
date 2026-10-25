import { useTable } from "../../hooks/useTable";
import { useBusinessUnitContext } from "../../context/BusinessUnitContext";
import { DataTable, type Column } from "../../components/DataTable";
import type { Profile } from "../../lib/types";

// The "Team Members" tab of System Settings -> User Management — the
// admin control for who's visible in the Team directory beyond the
// basic name/photo/role every signed-in person already sees.
// show_contact_details is off by default for everyone (see
// supabase/migrations/0007_user_profiles.sql); an admin switches it on
// per person, e.g. a role that genuinely needs to be reachable —
// deliberately per-person rather than a single global switch, since
// that's what was asked for: visibility that depends on who the
// person is, decided by the admin, not a fixed rule baked into a role.
export function TeamMembers() {
  const { rows, loading, update } = useTable<Profile>("profiles", { orderBy: "full_name", ascending: true });
  const { units } = useBusinessUnitContext();

  const unitName = (id: string | null) => {
    if (!id) return "All units";
    return units.find((u) => u.id === id)?.company_name ?? "—";
  };

  const columns: Column<Profile>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <div className="flex items-center gap-2">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
              {(p.full_name || p.email).slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-medium">{p.full_name || "—"}</span>
        </div>
      ),
    },
    { key: "email", header: "Email", render: (p) => p.email },
    { key: "role", header: "Role", render: (p) => <span className="capitalize">{p.role}</span> },
    { key: "unit", header: "Business unit", render: (p) => unitName(p.business_unit_id) },
    {
      key: "visibility",
      header: "Email & phone visible in Team directory",
      render: (p) => (
        <label className="flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={p.show_contact_details}
            onChange={(e) => update(p.id, { show_contact_details: e.target.checked })}
          />
          {p.show_contact_details ? "Visible" : "Hidden"}
        </label>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Team Members</h2>
        <p className="text-sm text-ink-muted">
          Everyone who's signed in already appears to colleagues in the Team directory by name, photo and role.
          Switch on "visible" for anyone whose email and phone should show there too — a site manager or team lead,
          for example — and leave it off for anyone who shouldn't be directly contactable that way.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        <DataTable columns={columns} rows={rows} emptyLabel="No team members yet." />
      )}
    </div>
  );
}
