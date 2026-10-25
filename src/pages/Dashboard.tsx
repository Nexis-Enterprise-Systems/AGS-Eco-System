import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import { useTable } from "../hooks/useTable";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import type { Client, Project } from "../lib/types";
import { loadCompliance, type ComplianceItem } from "../lib/compliance";
import {
  WIDGETS,
  WIDGET_BY_ID,
  canCustomise,
  defaultLayout,
  type DashboardData,
  type LayoutItem,
  type WidgetSize,
} from "../dashboard/registry";

// Literal class names so Tailwind includes them. 4-column grid on wide
// screens, 2 on medium, 1 on phones (anything wider than a quarter then
// goes full width on a phone).
const SPAN: Record<WidgetSize, string> = {
  1: "lg:col-span-1",
  2: "sm:col-span-2 lg:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
  4: "sm:col-span-2 lg:col-span-4",
};
const SIZE_LABELS: { size: WidgetSize; label: string; title: string }[] = [
  { size: 1, label: "S", title: "Quarter width" },
  { size: 2, label: "M", title: "Half width" },
  { size: 3, label: "L", title: "Three quarters" },
  { size: 4, label: "Full", title: "Full width" },
];

export function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role ?? "staff";
  const { units, effectiveUnitId, isHeadOfficeScoped } = useBusinessUnitContext();
  const { rows: allClients, loading: loadingClients } = useTable<Client>("clients");
  const { rows: allProjects, loading: loadingProjects } = useTable<Project>("projects");
  const { layout, loading: loadingLayout, storedIn, save } = useDashboardLayout(profile?.id, role);

  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [loadingCompliance, setLoadingCompliance] = useState(role === "admin");
  useEffect(() => {
    if (role !== "admin") return;
    loadCompliance().then((r) => {
      setCompliance(r.items);
      setLoadingCompliance(false);
    });
  }, [role]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LayoutItem[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Row Level Security already limits what comes back from Supabase —
  // a unit-scoped person only ever receives their own unit's rows. A
  // Head Office admin (business_unit_id null) receives every unit's
  // rows and narrows client-side to whichever unit the Business Unit
  // switcher is currently set to, or sees everything for "All units".
  const clients = effectiveUnitId ? allClients.filter((c) => c.business_unit_id === effectiveUnitId) : allClients;
  const clientIdsInScope = new Set(clients.map((c) => c.id));
  const projects = effectiveUnitId ? allProjects.filter((p) => clientIdsInScope.has(p.client_id)) : allProjects;
  const activeProjects = projects.filter((p) => !["complete", "on_hold"].includes(p.stage));
  const showBreakdown = isHeadOfficeScoped && !effectiveUnitId && units.length > 1;

  const data: DashboardData = {
    clients,
    projects,
    activeProjects,
    allClients,
    allProjects,
    units,
    loadingClients,
    loadingProjects,
    showBreakdown,
    compliance,
    loadingCompliance,
  };

  const mayCustomise = canCustomise(role);
  const current = editing ? draft : layout;
  const visible = current.filter((item) => {
    const def = WIDGET_BY_ID[item.id];
    return def && (!def.isAvailable || def.isAvailable(data));
  });
  const addable = WIDGETS.filter(
    (w) => w.roles.includes(role) && !draft.some((d) => d.id === w.id) && (!w.isAvailable || w.isAvailable(data)),
  );

  function startEditing() {
    setDraft(layout.map((l) => ({ ...l })));
    setMessage(null);
    setEditing(true);
  }

  function moveTo(fromId: string, toId: string) {
    if (fromId === toId) return;
    setDraft((d) => {
      const from = d.findIndex((i) => i.id === fromId);
      const to = d.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0) return d;
      const next = [...d];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function nudge(id: string, delta: -1 | 1) {
    setDraft((d) => {
      const i = d.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const res = await save(draft);
    setSaving(false);
    if (res.error) {
      setMessage(res.error);
      return;
    }
    setEditing(false);
    setMessage("Dashboard layout saved.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome${profile?.full_name ? `, ${profile.full_name}` : ""}`}
        subtitle={`Here's what's happening across your clients and projects${
          effectiveUnitId ? " for the unit you're viewing." : units.length > 1 ? ", across every business unit." : "."
        }`}
        actions={
          mayCustomise ? (
            editing ? (
              <>
                <button className="btn-secondary" onClick={() => setDraft(defaultLayout(role))} disabled={saving}>
                  Reset to default
                </button>
                <button className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save layout"}
                </button>
              </>
            ) : (
              <button className="btn-secondary" onClick={startEditing} disabled={loadingLayout}>
                Customise dashboard
              </button>
            )
          ) : null
        }
      />

      {message && !editing && (
        <div className="rounded-sm bg-green-50 dark:bg-green-900/30 px-4 py-2 text-sm text-green-700 dark:text-green-300">{message}</div>
      )}

      {editing && (
        <section className="card space-y-3 p-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Customise your dashboard</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Drag a tile by its title bar to move it, or use the arrows. Pick a width with S, M, L or Full. Remove a tile with
              Hide, and add hidden ones back below.
            </p>
          </div>
          {storedIn === "browser" && (
            <div className="rounded-sm bg-amber-100 dark:bg-amber-900/40 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Your layout will be saved on this device only. It will follow you across devices once migration
              0009_dashboard_layouts.sql has been run on this system's database.
            </div>
          )}
          <div>
            <div className="label">Available tiles</div>
            {addable.length === 0 ? (
              <p className="text-sm text-ink-muted">Every tile available to you is already on your dashboard.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {addable.map((w) => (
                  <div key={w.id} className="flex items-start justify-between gap-3 rounded-sm border border-line p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{w.title}</div>
                      <div className="text-xs text-ink-muted">{w.description}</div>
                    </div>
                    <button
                      className="btn-secondary shrink-0 px-3 py-1 text-xs"
                      onClick={() => setDraft((d) => [...d, { id: w.id, size: w.defaultSize }])}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {loadingLayout ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          Your dashboard is empty. {mayCustomise ? "Choose “Customise dashboard” to add tiles." : ""}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((item, index) => {
            const def = WIDGET_BY_ID[item.id];
            return (
              <div
                key={item.id}
                className={`card flex flex-col overflow-hidden ${SPAN[item.size]} ${
                  editing && overId === item.id && dragId !== item.id ? "ring-2 ring-brand-accent" : ""
                } ${editing && dragId === item.id ? "opacity-50" : ""}`}
                draggable={editing}
                onDragStart={(e) => {
                  setDragId(item.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", item.id);
                }}
                onDragOver={(e) => {
                  if (!editing || !dragId) return;
                  e.preventDefault();
                  setOverId(item.id);
                }}
                onDrop={(e) => {
                  if (!editing || !dragId) return;
                  e.preventDefault();
                  moveTo(dragId, item.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
              >
                {editing ? (
                  <div className="flex cursor-grab items-center justify-between gap-2 border-b border-line bg-surface-muted px-3 py-2 text-xs active:cursor-grabbing">
                    <span className="truncate font-medium" title="Drag to move">
                      ⠿ {def.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        className="rounded-sm px-1.5 py-0.5 text-ink-muted hover:bg-line disabled:opacity-30"
                        aria-label={`Move ${def.title} earlier`}
                        disabled={index === 0}
                        onClick={() => nudge(item.id, -1)}
                      >
                        ←
                      </button>
                      <button
                        className="rounded-sm px-1.5 py-0.5 text-ink-muted hover:bg-line disabled:opacity-30"
                        aria-label={`Move ${def.title} later`}
                        disabled={index === visible.length - 1}
                        onClick={() => nudge(item.id, 1)}
                      >
                        →
                      </button>
                      {SIZE_LABELS.map((s) => (
                        <button
                          key={s.size}
                          title={s.title}
                          aria-pressed={item.size === s.size}
                          className={`rounded-sm px-1.5 py-0.5 ${
                            item.size === s.size ? "bg-brand-primary text-on-primary" : "text-ink-muted hover:bg-line"
                          }`}
                          onClick={() =>
                            setDraft((d) => d.map((x) => (x.id === item.id ? { ...x, size: s.size } : x)))
                          }
                        >
                          {s.label}
                        </button>
                      ))}
                      <button
                        className="rounded-sm px-1.5 py-0.5 text-red-600 dark:text-red-400 hover:bg-line"
                        onClick={() => setDraft((d) => d.filter((x) => x.id !== item.id))}
                      >
                        Hide
                      </button>
                    </span>
                  </div>
                ) : (
                  !def.bare && (
                    <div className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {def.title}
                    </div>
                  )
                )}
                <div className={`flex-1 ${editing ? "pointer-events-none select-none" : ""}`}>{def.render(data)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
