import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { certLabel } from "../lib/onboarding";
import { daysText, expiryBand, loadCompliance, type ComplianceItem } from "../lib/compliance";

const BADGE: Record<string, string> = {
  expired: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  "30": "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  "60": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  ok: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
};

const FILTERS = [
  { key: "attention", label: "Needs attention" },
  { key: "expired", label: "Expired" },
  { key: "30", label: "Next 30 days" },
  { key: "60", label: "Next 60 days" },
  { key: "all", label: "Everything" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function fmt(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Every tracked certificate in one list, soonest expiry first. This is the
// working view for chasing renewals.
export function CompliancePanel() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("attention");
  const [type, setType] = useState<"all" | "employee" | "subcontractor">("all");

  useEffect(() => {
    loadCompliance().then((r) => {
      setItems(r.items);
      setError(r.error ?? null);
      setLoading(false);
    });
  }, []);

  const counts = useMemo(() => {
    const c = { expired: 0, "30": 0, "60": 0 };
    for (const i of items) {
      const b = expiryBand(i.days_left);
      if (b !== "ok") c[b]++;
    }
    return c;
  }, [items]);

  const shown = items.filter((i) => {
    if (type !== "all" && i.person_type !== type) return false;
    const b = expiryBand(i.days_left);
    if (filter === "all") return true;
    if (filter === "attention") return b === "expired" || b === "30";
    if (filter === "60") return b === "60";
    return b === filter;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ["expired", "Expired", counts.expired],
          ["30", "Expiring in 30 days", counts["30"]],
          ["60", "Expiring in 31–60 days", counts["60"]],
        ] as const).map(([k, label, n]) => (
          <button key={k} className="card p-4 text-left hover:bg-surface-muted" onClick={() => setFilter(k)}>
            <div className="text-3xl font-medium">{loading ? "…" : n}</div>
            <div className="mt-1 text-sm text-ink-muted">{label}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f.key ? "border-brand-primary bg-brand-primary text-white" : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select className="input ml-auto w-auto py-1 text-xs" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">Employees and sub-contractors</option>
          <option value="employee">Employees</option>
          <option value="subcontractor">Sub-contractors</option>
        </select>
      </div>

      {error && <div className="rounded-sm bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2 font-medium">Person</th>
              <th className="px-4 py-2 font-medium">Certificate</th>
              <th className="px-4 py-2 font-medium">Expires</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.certificate_id} className="border-b border-line last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-2">
                  <Link to={`/people/${i.person_id}`} className="font-medium text-brand-primary hover:underline">
                    {i.full_name}
                  </Link>
                  <div className="text-xs text-ink-muted">{i.person_type === "employee" ? "Employee" : "Sub-contractor"}</div>
                </td>
                <td className="px-4 py-2">
                  {certLabel(i.kind)}
                  {i.number ? <span className="text-ink-muted"> · {i.number}</span> : null}
                </td>
                <td className="px-4 py-2">{fmt(i.expiry_date)}</td>
                <td className="px-4 py-2">
                  <span className={`badge ${BADGE[expiryBand(i.days_left)]}`}>{daysText(i.days_left)}</span>
                </td>
              </tr>
            ))}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-muted">
                  Nothing here. {filter === "attention" ? "No certificates are expired or due within 30 days." : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-muted">
        Only active people are tracked. When a renewed certificate is added to someone&apos;s profile it replaces the old one here
        automatically. Email reminders to the person and to AGS (30, 14 and 7 days before, and on expiry) are set up separately.
      </p>
    </div>
  );
}
