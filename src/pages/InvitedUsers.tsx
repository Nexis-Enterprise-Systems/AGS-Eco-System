import { useState } from "react";
import { useTable } from "../hooks/useTable";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { ImportModal, type ImportField } from "../components/ImportModal";
import { useAuth } from "../context/AuthContext";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import type { InvitedUser } from "../lib/types";
import { NameInput } from "../components/FormattedInputs";

const IMPORT_FIELDS: ImportField[] = [
  { key: "email", label: "Email", required: true },
  { key: "full_name", label: "Full name" },
  { key: "role", label: "Role (staff or subcontractor)" },
];

// Bulk-onboarding: an admin adds/imports the email addresses they
// expect to sign up (one-off, or hundreds via CSV/Excel), then sends
// everyone the same /signup link. Each person creates their own
// account and password themselves — nobody has to be created one at a
// time in Supabase's Authentication -> Users screen anymore. See
// supabase/migrations/0003_self_signup.sql for the database side of
// this (which is what actually enforces the allowlist, not this UI).
// The "Invites" tab of System Settings -> User Management
// (src/pages/settings/UserManagement.tsx). Embedded as a panel — no
// own header/back-link, the parent page provides those — so it can
// sit alongside the Team Members tab.
export function InvitedUsersPanel() {
  const { profile } = useAuth();
  const { rows, loading, create, createMany, update, remove } = useTable<InvitedUser>("invited_users", {
    orderBy: "created_at",
  });
  const { units, isHeadOfficeScoped, effectiveUnitId } = useBusinessUnitContext();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<InvitedUser | null>(null);
  const [copied, setCopied] = useState(false);
  // Which unit a new invite lands in. A unit-scoped admin can only ever
  // invite into their own unit (Row Level Security enforces this too —
  // see invited_users_admin_all in 0006_business_units_phase2.sql), so
  // they never see this control at all. A Head Office admin picks —
  // defaults to whichever unit the Business Unit switcher is currently
  // set to, or "All units" (a Head-Office-level invite) otherwise.
  const [targetUnitId, setTargetUnitId] = useState<string | null>(effectiveUnitId ?? null);
  const resolvedUnitId = isHeadOfficeScoped ? targetUnitId : profile?.business_unit_id ?? null;

  const signupUrl = `${window.location.origin}/signup`;

  const columns: Column<InvitedUser>[] = [
    { key: "email", header: "Email", render: (u) => <span className="font-medium">{u.email}</span> },
    { key: "full_name", header: "Name", render: (u) => u.full_name || "—" },
    { key: "role", header: "Role", render: (u) => <span className="capitalize">{u.role}</span> },
    ...(units.length > 1
      ? [
          {
            key: "business_unit",
            header: "Business unit",
            render: (u: InvitedUser) =>
              u.business_unit_id ? units.find((x) => x.id === u.business_unit_id)?.company_name ?? "—" : "All units",
          } as Column<InvitedUser>,
        ]
      : []),
    {
      key: "status",
      header: "Status",
      render: (u) =>
        u.accepted_at ? (
          <span className="badge bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">Account created</span>
        ) : (
          <span className="badge bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Pending</span>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <div className="flex gap-3">
          {!u.accepted_at && (
            <button
              className="text-xs text-brand-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(u);
              }}
            >
              Edit
            </button>
          )}
          <button
            className="text-xs text-red-600 dark:text-red-400 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              const msg = u.accepted_at
                ? `Remove this record for ${u.email}? Their account already exists and won't be affected.`
                : `Revoke the invite for ${u.email}? They won't be able to create an account until you re-invite them.`;
              if (confirm(msg)) remove(u.id);
            }}
          >
            {u.accepted_at ? "Remove record" : "Revoke"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Invites</h2>
          <p className="text-sm text-ink-muted">
            Add or import the email addresses you expect to sign up, then send everyone the link below — anyone on
            this list can create their own account and password without you setting one up manually.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            Import CSV/Excel
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Add invite
          </button>
        </div>
      </div>

      <div className="card flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Signup link — send to everyone on the list above
          </div>
          <div className="truncate text-sm">{signupUrl}</div>
        </div>
        <button
          className="btn-secondary shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(signupUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      {isHeadOfficeScoped && units.length > 1 && (
        <div className="card flex items-center gap-3 p-4">
          <label className="label mb-0 shrink-0">New invites go to</label>
          <select
            className="input max-w-xs"
            value={targetUnitId ?? ""}
            onChange={(e) => setTargetUnitId(e.target.value || null)}
          >
            <option value="">All units (Head Office level)</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.company_name}
                {u.is_head_office ? " (Head Office)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        <DataTable columns={columns} rows={rows} emptyLabel="No invites yet — add or import email addresses above." />
      )}

      {showForm && (
        <InviteFormModal
          onClose={() => setShowForm(false)}
          onSave={async (values) => {
            const res = await create({ ...values, invited_by: profile?.id ?? null, business_unit_id: resolvedUnitId });
            if (!res.error) setShowForm(false);
            return res;
          }}
        />
      )}

      {editing && (
        <InviteFormModal
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
        <ImportModal<Partial<InvitedUser>>
          title="Import invited users"
          fields={IMPORT_FIELDS}
          onClose={() => setShowImport(false)}
          transformRow={(mapped) => ({
            email: mapped.email.trim().toLowerCase(),
            full_name: mapped.full_name || "",
            role: mapped.role?.trim().toLowerCase() === "subcontractor" ? "subcontractor" : "staff",
            invited_by: profile?.id ?? null,
            business_unit_id: resolvedUnitId,
          })}
          onImport={(imported) => createMany(imported.filter((r) => r.email))}
        />
      )}
    </div>
  );
}

function InviteFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: InvitedUser;
  onClose: () => void;
  onSave: (values: Partial<InvitedUser>) => Promise<{ error: string | null }>;
}) {
  const [form, setForm] = useState<Partial<InvitedUser>>(initial ?? { role: "staff" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!form.email) {
      setError("Email is required.");
      return;
    }
    setBusy(true);
    const res = await onSave({ ...form, email: form.email.trim().toLowerCase() });
    if (res.error) setError(res.error);
    setBusy(false);
  }

  return (
    <Modal title={initial ? "Edit invite" : "Add invite"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Email *</label>
          <input
            className="input"
            type="email"
            value={form.email ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Full name</label>
          <NameInput
            value={form.full_name ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
          person />
        </div>
        <div>
          <label className="label">Role</label>
          <select
            className="input"
            value={form.role ?? "staff"}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as InvitedUser["role"] }))}
          >
            <option value="staff">Staff</option>
            <option value="subcontractor">Sub-contractor</option>
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            Admin accounts can't be self-created here — after someone signs up, promote them to admin in the
            Supabase Table Editor (profiles table) if needed.
          </p>
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
