import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import { useTable } from "../hooks/useTable";
import { useDefaultBusinessUnitId } from "../hooks/useBusinessUnits";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { ImportModal, type ImportField } from "../components/ImportModal";
import type { Client, ClientStatus } from "../lib/types";
import { NameInput, PhoneInput } from "../components/FormattedInputs";

const STATUS_COLORS: Record<ClientStatus, string> = {
  prospect: "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300",
  active: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  paused: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  archived: "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400",
};

// Synonym lists cover the default export column headers from the
// accounting platforms clients are most likely to already use — Xero
// ("Contacts" export), QuickBooks Online ("Customers" export) and Zoho
// Books ("Contacts" export) — plus a few generic CRM/spreadsheet
// spellings, so a raw export usually needs zero manual mapping. Not
// exhaustive (export formats vary by region/version), which is why the
// mapping step still shows every column for anyone left unmatched.
const IMPORT_FIELDS: ImportField[] = [
  {
    key: "name",
    label: "Client name",
    required: true,
    synonyms: [
      "ContactName", // Xero
      "Company", "Company Name", "Customer", "Display Name As", // QuickBooks
      "Contact Name", "Company Name", "Display Name", // Zoho Books
      "Client", "Client Name", "Organisation", "Organization",
    ],
  },
  {
    key: "trading_name",
    label: "Trading name",
    synonyms: ["Trading Name", "DBA", "Doing Business As", "Legal Name"],
  },
  {
    key: "contact_name",
    label: "Contact name",
    synonyms: [
      "POAttentionTo", "SAAttentionTo", // Xero (attention-to on the address)
      "First Name", "Last Name", "Full Name", "Primary Contact", // QuickBooks/Zoho
      "Attention", "Attn", "Contact Person",
    ],
  },
  {
    key: "contact_email",
    label: "Contact email",
    synonyms: ["EmailAddress", "Email", "Email Address", "Primary Email"],
  },
  {
    key: "contact_phone",
    label: "Contact phone",
    synonyms: ["PhoneNumber", "Phone", "Phone Number", "Mobile", "Mobile Phone", "Work Phone", "Telephone"],
  },
  {
    key: "address",
    label: "Address",
    synonyms: [
      "POAddressLine1", "SAAddressLine1", // Xero
      "Billing Address", "Billing address", "Bill Address", // QuickBooks/Zoho
      "Street Address", "Address Line 1",
    ],
  },
];

export function Clients() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { rows: allRows, loading, create, createMany, remove } = useTable<Client>("clients", {
    orderBy: "created_at",
  });
  // Every client belongs to a business unit (not null in the
  // database) — see MULTI_ENTITY_SPEC.md. Defaults new records to the
  // creator's own unit, or Head Office if they're not unit-scoped.
  const defaultBusinessUnitId = useDefaultBusinessUnitId();
  // Row Level Security already limits what a unit-scoped person
  // receives; a Head Office admin receives every unit's clients and
  // this narrows to whichever unit the Business Unit switcher (in the
  // Sidebar) is currently set to, same convention as the Dashboard.
  const { effectiveUnitId } = useBusinessUnitContext();
  const rows = effectiveUnitId ? allRows.filter((c) => c.business_unit_id === effectiveUnitId) : allRows;
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const columns: Column<Client>[] = [
    { key: "name", header: "Name", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "contact_name", header: "Contact" },
    { key: "contact_email", header: "Email" },
    { key: "contact_phone", header: "Phone" },
    {
      key: "status",
      header: "Status",
      render: (c) => <span className={`badge capitalize ${STATUS_COLORS[c.status]}`}>{c.status}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <button
          className="text-xs text-red-600 dark:text-red-400 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete ${c.name}? This cannot be undone.`)) remove(c.id);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="All clients, active and prospective."
        actions={
          <>
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
            + Add client
          </button>
          </>
        }
      />

      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        <DataTable columns={columns} rows={rows} onRowClick={(c) => navigate(`/clients/${c.id}`)} emptyLabel="No clients yet — add one or import a list." />
      )}

      {showForm && (
        <ClientFormModal
          onClose={() => setShowForm(false)}
          onSave={async (values) => {
            if (!defaultBusinessUnitId) {
              return { error: "Still loading — give it a second and try again." };
            }
            const res = await create({ ...values, created_by: profile?.id, business_unit_id: defaultBusinessUnitId });
            if (!res.error) setShowForm(false);
            return res;
          }}
        />
      )}

      {showImport && (
        <ImportModal<Partial<Client>>
          title="Import clients"
          fields={IMPORT_FIELDS}
          onClose={() => setShowImport(false)}
          transformRow={(mapped) => ({
            name: mapped.name,
            trading_name: mapped.trading_name || null,
            contact_name: mapped.contact_name || null,
            contact_email: mapped.contact_email || null,
            contact_phone: mapped.contact_phone || null,
            address: mapped.address || null,
            business_unit_id: defaultBusinessUnitId ?? undefined,
            status: "active",
            created_by: profile?.id,
          })}
          onImport={(imported) => createMany(imported.filter((r) => r.name))}
        />
      )}
    </div>
  );
}

function ClientFormModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (values: Partial<Client>) => Promise<{ error: string | null }>;
}) {
  const [form, setForm] = useState<Partial<Client>>({ status: "active" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!form.name) {
      setError("Client name is required.");
      return;
    }
    setBusy(true);
    const res = await onSave(form);
    if (res.error) setError(res.error);
    setBusy(false);
  }

  return (
    <Modal title="Add client" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Client name *</label>
          <NameInput value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        </div>
        <div>
          <label className="label">Trading name</label>
          <NameInput value={form.trading_name ?? ""} onChange={(v) => setForm((f) => ({ ...f, trading_name: v }))} />
        </div>
        <div>
          <label className="label">Contact name</label>
          <NameInput value={form.contact_name ?? ""} onChange={(v) => setForm((f) => ({ ...f, contact_name: v }))} person />
        </div>
        <div>
          <label className="label">Contact email</label>
          <input className="input" value={form.contact_email ?? ""} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
        </div>
        <div>
          <label className="label">Contact phone</label>
          <PhoneInput value={form.contact_phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, contact_phone: v }))} />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.status ?? "active"}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClientStatus }))}
          >
            <option value="prospect">Prospect</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={handleSubmit}>
            {busy ? "Saving…" : "Save client"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
