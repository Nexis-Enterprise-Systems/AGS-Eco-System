import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { DataTable, type Column } from "../components/DataTable";
import { AddPersonModal } from "../components/AddPersonModal";
import type { OnboardingRow, PersonRow, PersonType } from "../lib/types";

export interface PersonWithOnboarding extends PersonRow {
  onboarding: OnboardingRow | null;
}

const BADGE_GREEN = "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
const BADGE_AMBER = "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
const BADGE_BLUE = "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300";
const BADGE_GREY = "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400";
const BADGE_RED = "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";

export function personStatus(p: PersonWithOnboarding): { label: string; className: string } {
  if (p.status === "active") return { label: "Active", className: BADGE_GREEN };
  if (p.status === "archived") return { label: "Archived", className: BADGE_GREY };
  switch (p.onboarding?.status) {
    case "signed":
      return { label: "Awaiting review", className: BADGE_BLUE };
    case "in_progress":
      return { label: "In progress", className: BADGE_AMBER };
    case "expired":
      return { label: "Link expired", className: BADGE_RED };
    case "rejected":
      return { label: "Rejected", className: BADGE_RED };
    case "accepted":
      return { label: "Active", className: BADGE_GREEN };
    default:
      return { label: "Invited", className: BADGE_AMBER };
  }
}

// One list for the three People tabs. `type` limits it to employees or
// sub-contractors; omit it for the Overview of everyone.
export function PeopleList({ type }: { type?: PersonType }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PersonWithOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    let q = supabase.from("people").select("*").order("created_at", { ascending: false });
    if (type) q = q.eq("person_type", type);
    const { data: people, error: err } = await q;
    if (err) {
      setError(
        /does not exist|schema cache/i.test(err.message)
          ? "The onboarding tables are not in this database yet. Run migration 0011_people_onboarding.sql in the Supabase SQL editor."
          : err.message
      );
      setLoading(false);
      return;
    }
    setError(null);
    const { data: onbs } = await supabase.from("onboardings").select("*").order("created_at", { ascending: false });
    const latest = new Map<string, OnboardingRow>();
    ((onbs ?? []) as OnboardingRow[]).forEach((o) => {
      if (!latest.has(o.person_id)) latest.set(o.person_id, o);
    });
    setRows(((people ?? []) as PersonRow[]).map((p) => ({ ...p, onboarding: latest.get(p.id) ?? null })));
    setLoading(false);
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<PersonWithOnboarding>[] = [
    { key: "full_name", header: "Name", render: (p) => <span className="font-medium">{p.full_name}</span> },
    ...(type
      ? []
      : [
          {
            key: "person_type",
            header: "Type",
            render: (p: PersonWithOnboarding) => (p.person_type === "employee" ? "Employee" : "Sub-contractor"),
          },
        ]),
    { key: "job_title", header: type === "subcontractor" ? "Trade" : "Role", render: (p) => p.job_title || "—" },
    { key: "email", header: "Email" },
    {
      key: "status",
      header: "Status",
      render: (p) => {
        const s = personStatus(p);
        return <span className={`badge ${s.className}`}>{s.label}</span>;
      },
    },
  ];

  const typeLabel = type === "employee" ? "employee" : type === "subcontractor" ? "sub-contractor" : "person";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">
          {type === "employee"
            ? "Employees. Agreements, time away and documents sit on each record."
            : type === "subcontractor"
              ? "Sub-contractors, individuals and limited companies. Agencies are held under Suppliers."
              : "Everyone who works for AGS, employees and sub-contractors."}
        </p>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + Add {typeLabel}
        </button>
      </div>

      {error && <div className="card border-red-300 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        !error && (
          <DataTable
            columns={columns}
            rows={rows}
            onRowClick={(p) => navigate(`/people/${p.id}`)}
            emptyLabel={`No ${typeLabel === "person" ? "people" : typeLabel + "s"} yet. Use Add to send the first onboarding link.`}
          />
        )
      )}

      {adding && (
        <AddPersonModal
          initialType={type ?? "employee"}
          onClose={() => setAdding(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
