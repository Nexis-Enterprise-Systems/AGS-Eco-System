import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import { useTable } from "../hooks/useTable";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { ImportModal, type ImportField } from "../components/ImportModal";
import type { Client, Project, ProjectStage } from "../lib/types";
import { NameInput } from "../components/FormattedInputs";

const STAGES: ProjectStage[] = [
  "discovery",
  "audit",
  "proposal",
  "agreement",
  "build",
  "rollout",
  "retainer",
  "complete",
  "on_hold",
];

const STAGE_COLORS: Record<ProjectStage, string> = {
  discovery: "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300",
  audit: "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300",
  proposal: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  agreement: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  build: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  rollout: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  retainer: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  complete: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  on_hold: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

const IMPORT_FIELDS: ImportField[] = [
  { key: "client_name", label: "Client name (must match an existing client)", required: true },
  { key: "name", label: "Project name", required: true },
  { key: "description", label: "Description" },
  { key: "stage", label: "Stage (discovery/audit/proposal/agreement/build/rollout/retainer/complete/on_hold)" },
  { key: "start_date", label: "Start date (YYYY-MM-DD)" },
  { key: "target_end_date", label: "Target end date (YYYY-MM-DD)" },
  { key: "build_fee", label: "Build fee" },
  { key: "monthly_retainer", label: "Monthly retainer" },
];

export function Projects() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isStaff = profile?.role === "admin" || profile?.role === "staff";
  const { rows: allProjects, loading, create, createMany } = useTable<Project>("projects", { orderBy: "created_at" });
  const { rows: clients } = useTable<Client>("clients");
  // Same client-side narrowing as Clients.tsx/Dashboard.tsx. Projects
  // have no business_unit_id of their own (see MULTI_ENTITY_SPEC.md) —
  // a project's unit is always its client's unit.
  const { effectiveUnitId, units } = useBusinessUnitContext();
  const clientIdsInScope = new Set(
    effectiveUnitId ? clients.filter((c) => c.business_unit_id === effectiveUnitId).map((c) => c.id) : null
  );
  const projects = effectiveUnitId ? allProjects.filter((p) => clientIdsInScope.has(p.client_id)) : allProjects;
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const clientName = (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? "—";
  // A project has no business_unit_id of its own — it's always its
  // client's unit (see MULTI_ENTITY_SPEC.md).
  const businessUnitFor = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return units.find((u) => u.id === client?.business_unit_id) ?? null;
  };

  const columns: Column<Project>[] = [
    { key: "name", header: "Project", render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "client", header: "Client", render: (p) => clientName(p.client_id) },
    ...(units.length > 1
      ? [
          {
            key: "business_unit",
            header: "Business unit",
            render: (p: Project) => {
              const unit = businessUnitFor(p.client_id);
              return unit ? (
                <span className="badge bg-surface-muted text-ink-muted">
                  {unit.company_name}
                  {unit.is_head_office ? " · Head Office" : ""}
                </span>
              ) : (
                "—"
              );
            },
          } as Column<Project>,
        ]
      : []),
    {
      key: "stage",
      header: "Stage",
      render: (p) => <span className={`badge capitalize ${STAGE_COLORS[p.stage]}`}>{p.stage.replace("_", " ")}</span>,
    },
    { key: "target_end_date", header: "Target end", render: (p) => p.target_end_date ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Every engagement, from discovery through retainer."
        actions={
          isStaff ? (
            <>
              <button className="btn-secondary" onClick={() => setShowImport(true)}>
                Import CSV/Excel
              </button>
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                + Add project
              </button>
            </>
          ) : null
        }
      />

      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        <DataTable columns={columns} rows={projects} onRowClick={(p) => navigate(`/projects/${p.id}`)} emptyLabel="No projects yet." />
      )}

      {showForm && (
        <ProjectFormModal
          clients={clients}
          onClose={() => setShowForm(false)}
          onSave={async (values) => {
            const res = await create({ ...values, created_by: profile?.id });
            if (!res.error) setShowForm(false);
            return res;
          }}
        />
      )}

      {showImport && (
        <ImportModal<Partial<Project> & { client_name?: string }>
          title="Import projects"
          fields={IMPORT_FIELDS}
          onClose={() => setShowImport(false)}
          transformRow={(mapped) => {
            const match = clients.find((c) => c.name.toLowerCase() === mapped.client_name?.toLowerCase());
            return {
              client_id: match?.id ?? "",
              name: mapped.name,
              description: mapped.description || null,
              stage: (STAGES.includes(mapped.stage as ProjectStage) ? mapped.stage : "discovery") as ProjectStage,
              start_date: mapped.start_date || null,
              target_end_date: mapped.target_end_date || null,
              build_fee: mapped.build_fee ? Number(mapped.build_fee) : null,
              monthly_retainer: mapped.monthly_retainer ? Number(mapped.monthly_retainer) : null,
              created_by: profile?.id,
            };
          }}
          onImport={(imported) => {
            const valid = imported.filter((r) => r.name && r.client_id);
            const skipped = imported.length - valid.length;
            return createMany(valid).then((res) => ({
              ...res,
              error: skipped > 0 ? `${skipped} row(s) skipped — client name didn't match any existing client.` : res.error,
            }));
          }}
        />
      )}
    </div>
  );
}

function ProjectFormModal({
  clients,
  onClose,
  onSave,
}: {
  clients: Client[];
  onClose: () => void;
  onSave: (values: Partial<Project>) => Promise<{ error: string | null }>;
}) {
  const [form, setForm] = useState<Partial<Project>>({ stage: "discovery", currency: "AED" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!form.name || !form.client_id) {
      setError("Project name and client are required.");
      return;
    }
    setBusy(true);
    const res = await onSave(form);
    if (res.error) setError(res.error);
    setBusy(false);
  }

  return (
    <Modal title="Add project" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Client *</label>
          <select className="input" value={form.client_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Project name *</label>
          <NameInput value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        </div>
        <div>
          <label className="label">Stage</label>
          <select className="input" value={form.stage ?? "discovery"} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as ProjectStage }))}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date</label>
            <input type="date" className="input" value={form.start_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Target end date</label>
            <input type="date" className="input" value={form.target_end_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, target_end_date: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Build fee (AED)</label>
            <input type="number" className="input" value={form.build_fee ?? ""} onChange={(e) => setForm((f) => ({ ...f, build_fee: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Monthly retainer (AED)</label>
            <input type="number" className="input" value={form.monthly_retainer ?? ""} onChange={(e) => setForm((f) => ({ ...f, monthly_retainer: Number(e.target.value) }))} />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={handleSubmit}>
            {busy ? "Saving…" : "Save project"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
