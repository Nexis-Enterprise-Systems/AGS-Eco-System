import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useNavigate } from "react-router-dom";
import { useBusinessUnits } from "../../hooks/useBusinessUnits";
import { useBusinessUnitContext } from "../../context/BusinessUnitContext";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../../components/Modal";
import type { BusinessUnit, Region } from "../../lib/types";
import { NameInput } from "../../components/FormattedInputs";

const REGION_OPTIONS: { value: Region; label: string }[] = [
  { value: "gb", label: "United Kingdom" },
  { value: "ae", label: "United Arab Emirates" },
  { value: "other", label: "Other" },
];

// Business Units — the admin surface for a client structured as a
// Head Office plus separate business units (see MULTI_ENTITY_SPEC.md).
// A single-entity client only ever has the one Head Office row here
// and never needs to add another; this page is what turns that into a
// genuine multi-entity system when a client needs it.
export function BusinessUnits() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { rows: units, loading, create } = useBusinessUnits();
  const { refresh } = useBusinessUnitContext();
  const [showCreate, setShowCreate] = useState(false);

  // Only a Head Office admin can create a unit — mirrors
  // business_units_head_office_admin_all in 0005_business_units.sql.
  // A unit's own local admin can manage their own unit's profile and
  // branding, but not add or remove units.
  const canCreate = profile?.role === "admin" && !profile.business_unit_id;

  const sorted = [...units].sort((a, b) => {
    if (a.is_head_office !== b.is_head_office) return a.is_head_office ? -1 : 1;
    return a.company_name.localeCompare(b.company_name);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Units"
        subtitle="Head Office plus any separate business units — each can be its own legal entity and its own branding."
        back={{ label: "Back to Settings", onClick: () => navigate("/settings") }}
        actions={
          canCreate ? (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + Add business unit
            </button>
          ) : null
        }
      />

      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((u) => (
            <button
              key={u.id}
              onClick={() => navigate(`/settings/business-units/${u.id}`)}
              className="card flex flex-col items-start gap-2 p-6 text-left transition-shadow hover:shadow-md"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <h2 className="truncate text-sm font-semibold">{u.company_name}</h2>
                {u.is_head_office && (
                  <span className="badge shrink-0 bg-brand-primary/10 text-brand-primary">Head Office</span>
                )}
              </div>
              {u.trading_name && <p className="text-xs text-ink-muted">Trading as {u.trading_name}</p>}
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-ink-muted">
                <span className="badge bg-surface-muted">
                  {REGION_OPTIONS.find((r) => r.value === u.region)?.label ?? u.region}
                </span>
                <span className="badge bg-surface-muted">
                  {u.use_custom_branding ? "Custom branding" : "Inherits Head Office branding"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateUnitModal
          onClose={() => setShowCreate(false)}
          onCreate={async (values) => {
            const res = await create(values);
            if (!res.error && res.data) {
              await refresh();
              setShowCreate(false);
              navigate(`/settings/business-units/${res.data.id}`);
            }
            return res;
          }}
        />
      )}
    </div>
  );
}

function CreateUnitModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (values: Partial<BusinessUnit>) => Promise<{ error: string | null }>;
}) {
  const [companyName, setCompanyName] = useState("");
  const [region, setRegion] = useState<Region>("gb");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    setBusy(true);
    const res = await onCreate({ company_name: companyName.trim(), region });
    if (res.error) setError(res.error);
    setBusy(false);
  }

  return (
    <Modal title="Add business unit" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Company name *</label>
          <NameInput value={companyName} onChange={(v) => setCompanyName(v)} />
        </div>
        <div>
          <label className="label">Region</label>
          <select className="input" value={region} onChange={(e) => setRegion(e.target.value as Region)}>
            {REGION_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            This can't be changed once the unit is created — same as the region on a single-entity Company Profile.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          You can fill in the rest — trading name, contact details, registration/VAT numbers and branding — after
          creating the unit.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={handleSubmit}>
            {busy ? "Creating…" : "Create business unit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
