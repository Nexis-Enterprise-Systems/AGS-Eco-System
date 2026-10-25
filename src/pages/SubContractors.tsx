import { useState } from "react";
import { useTable } from "../hooks/useTable";
import { useDefaultBusinessUnitId } from "../hooks/useBusinessUnits";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { ImportModal, type ImportField } from "../components/ImportModal";
import type { SubContractor } from "../lib/types";
import { NameInput, PhoneInput } from "../components/FormattedInputs";

const IMPORT_FIELDS: ImportField[] = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "specialty", label: "Specialty" },
];

export function SubContractorsPanel() {
  const { rows: allRows, loading, create, createMany, update, remove } = useTable<SubContractor>("sub_contractors", {
    orderBy: "created_at",
  });
  // Every sub-contractor belongs to a business unit (not null in the
  // database) — see MULTI_ENTITY_SPEC.md.
  const defaultBusinessUnitId = useDefaultBusinessUnitId();
  // Same client-side narrowing as Clients.tsx/Dashboard.tsx — RLS
  // already scopes a unit-scoped person; this narrows a Head Office
  // admin's view to whichever unit the switcher is set to.
  const { effectiveUnitId } = useBusinessUnitContext();
  const rows = effectiveUnitId ? allRows.filter((s) => s.business_unit_id === effectiveUnitId) : allRows;
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<SubContractor | null>(null);

  const columns: Column<SubContractor>[] = [
    { key: "name", header: "Name", render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "specialty", header: "Specialty" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <span className={`badge ${s.status === "active" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"}`}>
          {s.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (s) => (
        <div className="flex gap-3">
          <button
            className="text-xs text-brand-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(s);
            }}
          >
            Edit
          </button>
          <button
            className="text-xs text-red-600 dark:text-red-400 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete ${s.name}?`)) remove(s.id);
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">
          External team members you assign to specific client projects. This is the template's roster; it will be replaced
          by the full sub-contractor record described in the People design.
        </p>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            disabled={!defaultBusinessUnitId}
            title={!defaultBusinessUnitId ? "Still loading…" : undefined}
            onClick={() => setShowImport(true)}
          >
            Import CSV/Excel
          </button>
          <button
            className="btn-primary"
            disabled={!defaultBusinessUnitId}
            title={!defaultBusinessUnitId ? "Still loading…" : undefined}
            onClick={() => setShowForm(true)}
          >
            + Add sub-contractor
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        <DataTable columns={columns} rows={rows} emptyLabel="No sub-contractors yet." />
      )}

      {showForm && (
        <SubContractorFormModal
          onClose={() => setShowForm(false)}
          onSave={async (values) => {
            if (!defaultBusinessUnitId) {
              return { error: "Still loading — give it a second and try again." };
            }
            const res = await create({ ...values, business_unit_id: defaultBusinessUnitId });
            if (!res.error) setShowForm(false);
            return res;
          }}
        />
      )}

      {editing && (
        <SubContractorFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const res = await update(editing.id, values);
            if (!res.error) setEditing(null);
            return res;
          }}
        />
      )}

      {showImport && (
        <ImportModal<Partial<SubContractor>>
          title="Import sub-contractors"
          fields={IMPORT_FIELDS}
          onClose={() => setShowImport(false)}
          transformRow={(mapped) => ({
            name: mapped.name,
            email: mapped.email || null,
            phone: mapped.phone || null,
            specialty: mapped.specialty || null,
            business_unit_id: defaultBusinessUnitId ?? undefined,
            status: "active",
          })}
          onImport={(imported) => createMany(imported.filter((r) => r.name))}
        />
      )}
    </div>
  );
}

function SubContractorFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: SubContractor;
  onClose: () => void;
  onSave: (values: Partial<SubContractor>) => Promise<{ error: string | null }>;
}) {
  const [form, setForm] = useState<Partial<SubContractor>>(initial ?? { status: "active" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!form.name) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    const res = await onSave(form);
    if (res.error) setError(res.error);
    setBusy(false);
  }

  return (
    <Modal title={initial ? "Edit sub-contractor" : "Add sub-contractor"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Name *</label>
          <NameInput value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} person />
        </div>
        <div>
          <label className="label">Specialty</label>
          <input className="input" value={form.specialty ?? ""} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} placeholder="e.g. Backend / Supabase, QA, UI/UX" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="label">Phone</label>
          <PhoneInput value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status ?? "active"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SubContractor["status"] }))}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={handleSubmit}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
