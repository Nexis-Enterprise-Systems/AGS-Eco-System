import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { BusinessUnit, Client, Project, UserRole } from "../lib/types";
import { certLabel } from "../lib/onboarding";
import type { ComplianceItem } from "../lib/compliance";

// ---------------------------------------------------------------------
// Dashboard widget registry.
//
// Every tile that can appear on the dashboard is declared here: what it
// is called, which roles may use it, how wide it starts, and how it
// draws. To add a tile later (jobs due, WIP, enquiries...) add one entry
// to WIDGETS. Nothing else needs to change: the picker, the layout
// editor and saving all work from this list.
// ---------------------------------------------------------------------

export type WidgetSize = 1 | 2 | 3 | 4; // columns out of 4
export interface LayoutItem {
  id: string;
  size: WidgetSize;
}

export interface DashboardData {
  clients: Client[];
  projects: Project[];
  activeProjects: Project[];
  allClients: Client[];
  allProjects: Project[];
  units: BusinessUnit[];
  loadingClients: boolean;
  loadingProjects: boolean;
  showBreakdown: boolean;
  /** Certificates for active people (admins only; empty for others). */
  compliance: ComplianceItem[];
  loadingCompliance: boolean;
}

export interface WidgetDef {
  id: string;
  title: string;
  description: string;
  /** Roles allowed to see this widget at all. */
  roles: UserRole[];
  defaultSize: WidgetSize;
  /** Stat tiles draw their own content with no title bar. */
  bare?: boolean;
  /** Hide from the picker when it would show nothing useful. */
  isAvailable?: (d: DashboardData) => boolean;
  render: (d: DashboardData) => ReactNode;
}

const ALL: UserRole[] = ["admin", "staff", "subcontractor"];
const STAFF: UserRole[] = ["admin", "staff"];

function Stat({ label, value, to }: { label: string; value: number | string; to: string }) {
  return (
    <Link to={to} className="block h-full p-5 hover:bg-surface-muted">
      <div className="text-3xl font-medium">{value}</div>
      <div className="mt-1 text-sm text-ink-muted">{label}</div>
    </Link>
  );
}

export const WIDGETS: WidgetDef[] = [
  {
    id: "stat_clients",
    bare: true,
    title: "Clients",
    description: "How many clients you can see.",
    roles: STAFF,
    defaultSize: 1,
    render: (d) => <Stat label="Clients" value={d.loadingClients ? "…" : d.clients.length} to="/clients" />,
  },
  {
    id: "stat_active_projects",
    bare: true,
    title: "Active projects",
    description: "Projects that are not complete or on hold.",
    roles: ALL,
    defaultSize: 1,
    render: (d) => <Stat label="Active projects" value={d.loadingProjects ? "…" : d.activeProjects.length} to="/projects" />,
  },
  {
    id: "stat_total_projects",
    bare: true,
    title: "Total projects",
    description: "Every project you can see.",
    roles: ALL,
    defaultSize: 1,
    render: (d) => <Stat label="Total projects" value={d.loadingProjects ? "…" : d.projects.length} to="/projects" />,
  },
  {
    id: "compliance_expiring",
    title: "Certificates expiring",
    description: "Expired certificates and any due within 30 days, for employees and sub-contractors.",
    roles: ["admin"],
    defaultSize: 2,
    render: (d) => {
      const due = d.compliance.filter((c) => c.days_left <= 30);
      if (d.loadingCompliance) return <div className="p-4 text-sm text-ink-muted">Loading…</div>;
      if (due.length === 0) return <div className="p-4 text-sm text-ink-muted">Nothing expired or due in the next 30 days.</div>;
      return (
        <div className="divide-y divide-line">
          {due.slice(0, 6).map((c) => (
            <Link key={c.certificate_id} to={`/people/${c.person_id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-muted">
              <span className="min-w-0 truncate">
                <span className="font-medium">{c.full_name}</span>
                <span className="text-ink-muted"> · {certLabel(c.kind)}</span>
              </span>
              <span className={`shrink-0 text-xs ${c.days_left < 0 ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300"}`}>
                {c.days_left < 0 ? "Expired" : c.days_left === 0 ? "Today" : `${c.days_left} days`}
              </span>
            </Link>
          ))}
          {due.length > 6 && (
            <Link to="/people" className="block px-4 py-2 text-xs text-brand-primary hover:underline">
              {due.length - 6} more on the People page
            </Link>
          )}
        </div>
      );
    },
  },
  {
    id: "recent_projects",
    title: "Recent projects",
    description: "The six most recent projects, with their stage.",
    roles: ALL,
    defaultSize: 2,
    render: (d) => (
      <div className="divide-y divide-line">
        {d.projects.slice(0, 6).map((p) => {
          const client = d.clients.find((c) => c.id === p.client_id);
          const unit = d.units.find((u) => u.id === client?.business_unit_id);
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-muted">
              <span className="min-w-0 truncate font-medium">{p.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {d.units.length > 1 && unit && (
                  <span className="badge bg-surface-muted text-ink-muted">
                    {unit.company_name}
                    {unit.is_head_office ? " · Head Office" : ""}
                  </span>
                )}
                <span className="badge bg-brand-primary/10 text-brand-primary capitalize">{p.stage.replace("_", " ")}</span>
              </span>
            </Link>
          );
        })}
        {d.projects.length === 0 && !d.loadingProjects && (
          <div className="px-4 py-6 text-center text-sm text-ink-muted">No projects yet.</div>
        )}
      </div>
    ),
  },
  {
    id: "by_business_unit",
    title: "By business unit",
    description: "Clients and projects for each business unit.",
    roles: STAFF,
    defaultSize: 2,
    isAvailable: (d) => d.showBreakdown,
    render: (d) => (
      <div className="divide-y divide-line">
        {[...d.units]
          .sort((a, b) => (a.is_head_office === b.is_head_office ? 0 : a.is_head_office ? -1 : 1))
          .map((u) => {
            const unitClientIds = new Set(d.allClients.filter((c) => c.business_unit_id === u.id).map((c) => c.id));
            const unitProjectCount = d.allProjects.filter((p) => unitClientIds.has(p.client_id)).length;
            return (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">
                  {u.company_name}
                  {u.is_head_office && <span className="badge ml-2 bg-brand-primary/10 text-brand-primary">Head Office</span>}
                </span>
                <span className="text-ink-muted">
                  {unitClientIds.size} client{unitClientIds.size === 1 ? "" : "s"} · {unitProjectCount} project
                  {unitProjectCount === 1 ? "" : "s"}
                </span>
              </div>
            );
          })}
      </div>
    ),
  },
];

export const WIDGET_BY_ID: Record<string, WidgetDef> = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));

/** Layout a person gets until they change it: every widget their role may see. */
export function defaultLayout(role: UserRole): LayoutItem[] {
  return WIDGETS.filter((w) => w.roles.includes(role)).map((w) => ({ id: w.id, size: w.defaultSize }));
}

/** Only staff and admins can rearrange. Sub-contractors get the fixed default. */
export function canCustomise(role: UserRole): boolean {
  return role === "admin" || role === "staff";
}

/** Drop unknown widgets, widgets this role may not see, and duplicates. */
export function sanitiseLayout(layout: unknown, role: UserRole): LayoutItem[] {
  if (!Array.isArray(layout)) return defaultLayout(role);
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const raw of layout as { id?: unknown; size?: unknown }[]) {
    const def = typeof raw?.id === "string" ? WIDGET_BY_ID[raw.id] : undefined;
    if (!def || !def.roles.includes(role) || seen.has(def.id)) continue;
    const size = [1, 2, 3, 4].includes(Number(raw.size)) ? (Number(raw.size) as WidgetSize) : def.defaultSize;
    seen.add(def.id);
    out.push({ id: def.id, size });
  }
  return out;
}
