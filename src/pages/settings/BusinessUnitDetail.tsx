import { useEffect, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { hexToRgbTriplet, rgbTripletToHex } from "../../lib/theme";
import { useAuth } from "../../context/AuthContext";
import { useBusinessUnitContext } from "../../context/BusinessUnitContext";
import type { BusinessUnit, Region } from "../../lib/types";
import { AddressFields, NameInput, PhoneInput } from "../../components/FormattedInputs";
import { parseAddress, serialiseAddress } from "../../lib/format";

const REGION_LABELS: Record<Region, { label: string; registrationLabel: string }> = {
  gb: { label: "United Kingdom", registrationLabel: "Companies House number" },
  ae: { label: "United Arab Emirates", registrationLabel: "Trade licence number" },
  other: { label: "Other", registrationLabel: "Business registration number" },
};

const COLOR_FIELDS = [
  { key: "color_primary", label: "Primary" },
  { key: "color_secondary", label: "Secondary" },
  { key: "color_accent", label: "Accent" },
] as const;

type ProfileFormState = Pick<
  BusinessUnit,
  | "company_name"
  | "trading_name"
  | "contact_email"
  | "contact_phone"
  | "address"
  | "business_registration_number"
  | "vat_number"
>;

// A single business unit's own profile + branding — the per-unit
// replacement for the old single-page Company Profile / Company
// Branding (which only ever had one company to describe). The Head
// Office unit is edited here too, through the same page — it's just
// the row with is_head_office = true, badge-marked and without a
// delete option. See MULTI_ENTITY_SPEC.md.
export function BusinessUnitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { headOffice, refresh: refreshContext } = useBusinessUnitContext();

  const [unit, setUnit] = useState<BusinessUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [useCustomBranding, setUseCustomBranding] = useState(false);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [allowProfilePhotos, setAllowProfilePhotos] = useState(true);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from("business_units")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        const row = (data as BusinessUnit) ?? null;
        setUnit(row);
        if (row) {
          setForm({
            company_name: row.company_name,
            trading_name: row.trading_name ?? "",
            contact_email: row.contact_email ?? "",
            contact_phone: row.contact_phone ?? "",
            address: row.address ?? "",
            business_registration_number: row.business_registration_number ?? "",
            vat_number: row.vat_number ?? "",
          });
          setUseCustomBranding(row.use_custom_branding);
          setColors({
            color_primary: row.color_primary,
            color_secondary: row.color_secondary,
            color_accent: row.color_accent,
          });
          setLogoUrl(row.logo_url);
          setAllowProfilePhotos(row.allow_profile_photos);
        }
        setLoading(false);
      });
  }, [id]);

  // A unit's own local admin can only update their own unit
  // (business_units_unit_admin_update_own); a Head Office admin can
  // update any unit. Only a Head Office admin can delete one — and
  // never the Head Office unit itself, which this page never offers as
  // an option regardless of what the database would technically allow.
  const isHeadOfficeAdmin = profile?.role === "admin" && !profile.business_unit_id;
  const canEdit = isHeadOfficeAdmin || profile?.business_unit_id === id;
  const canDelete = isHeadOfficeAdmin && !!unit && !unit.is_head_office;

  async function handleSave() {
    if (!id || !form) return;
    setBusy(true);
    const payload: Partial<BusinessUnit> = {
      company_name: form.company_name,
      trading_name: form.trading_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      address: form.address || null,
      business_registration_number: form.business_registration_number || null,
      vat_number: form.vat_number || null,
      use_custom_branding: useCustomBranding,
      logo_url: logoUrl,
      allow_profile_photos: allowProfilePhotos,
      ...(useCustomBranding ? colors : {}),
    };
    const { data, error } = await supabase.from("business_units").update(payload).eq("id", id).select().single();
    if (error) {
      setSavedMessage(`Error: ${error.message}`);
    } else {
      setUnit(data as BusinessUnit);
      setSavedMessage("Saved.");
      await refreshContext();
    }
    setBusy(false);
    setTimeout(() => setSavedMessage(null), 2500);
  }

  async function handleLogoUpload(file: File) {
    if (!id) return;
    setUploadingLogo(true);
    const path = `logo-${id}-${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (!uploadErr) {
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    }
    setUploadingLogo(false);
  }

  async function handleDelete() {
    if (!id || !unit) return;
    if (!confirm(`Delete ${unit.company_name}? This can't be undone.`)) return;
    const { error } = await supabase.from("business_units").delete().eq("id", id);
    if (error) {
      // Most likely a foreign-key violation — this unit still has
      // clients or sub-contractors pointing at it. Reassign or remove
      // those first (there's no automatic delete-cascade here on
      // purpose — losing a client silently would be far worse than a
      // blocked delete).
      setDeleteError(
        /foreign key/i.test(error.message)
          ? "Can't delete — this unit still has clients or sub-contractors assigned to it. Reassign or remove those first."
          : error.message
      );
      return;
    }
    await refreshContext();
    navigate("/settings/business-units");
  }

  if (loading || !unit || !form) {
    return <div className="text-sm text-ink-muted">Loading…</div>;
  }

  const regionInfo = REGION_LABELS[unit.region] ?? REGION_LABELS.other;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={unit.company_name}
        badge={unit.is_head_office ? <span className="badge bg-brand-primary/10 text-brand-primary">Head Office</span> : undefined}
        subtitle={
          unit.is_head_office
            ? "This unit's branding is shown before anyone signs in, and is the fallback for every other unit that hasn't set its own."
            : "A separate business unit — its own legal entity details and, optionally, its own branding."
        }
        back={{ label: "Back to Business Units", onClick: () => navigate("/settings/business-units") }}
        actions={
          canDelete ? (
            <button className="text-xs text-red-600 dark:text-red-400 hover:underline" onClick={handleDelete}>
              Delete unit
            </button>
          ) : null
        }
      />

      {deleteError && <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-700 dark:text-red-300">{deleteError}</div>}
      {savedMessage && <div className="rounded-lg bg-green-50 dark:bg-green-900/30 px-4 py-2 text-sm text-green-700 dark:text-green-300">{savedMessage}</div>}

      {!canEdit ? (
        <div className="card p-6 text-sm text-ink-muted">You don't have access to edit this business unit.</div>
      ) : (
        <>
          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Profile</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Company name *</label>
                <NameInput
                  value={form.company_name}
                  onChange={(v) => setForm((f) => f && { ...f, company_name: v })}
                />
              </div>
              <div>
                <label className="label">Trading as (if applicable)</label>
                <NameInput
                  value={form.trading_name ?? ""}
                  onChange={(v) => setForm((f) => f && { ...f, trading_name: v })}
                />
              </div>
              <div>
                <label className="label">Email address</label>
                <input
                  className="input"
                  type="email"
                  value={form.contact_email ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, contact_email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone number</label>
                <PhoneInput
                  value={form.contact_phone ?? ""}
                  onChange={(v) => setForm((f) => f && { ...f, contact_phone: v })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <AddressFields
                  value={parseAddress(form.address)}
                  onChange={(a) => setForm((f) => f && { ...f, address: serialiseAddress(a) })}
                />
              </div>
              <div>
                <label className="label">Region</label>
                <div className="input flex cursor-not-allowed items-center bg-surface-muted text-ink-muted">
                  {regionInfo.label}
                </div>
                <p className="mt-1 text-xs text-ink-muted">Set when this unit was created — can't be changed here.</p>
              </div>
              <div>
                <label className="label">{regionInfo.registrationLabel}</label>
                <input
                  className="input"
                  value={form.business_registration_number ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, business_registration_number: e.target.value })}
                />
              </div>
              <div>
                <label className="label">VAT number (if applicable)</label>
                <input
                  className="input"
                  value={form.vat_number ?? ""}
                  onChange={(e) => setForm((f) => f && { ...f, vat_number: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Branding</h2>

            <label className="flex items-start gap-3 rounded-lg border border-line p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={useCustomBranding}
                onChange={(e) => setUseCustomBranding(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">Use this unit's own branding</span>
                <span className="block text-xs text-ink-muted">
                  Off by default — this unit shows Head Office's logo and colours until you turn this on.
                </span>
              </span>
            </label>

            {!useCustomBranding ? (
              <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-3">
                {headOffice?.logo_url && (
                  <img src={headOffice.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                )}
                <div className="text-xs text-ink-muted">
                  Currently showing <strong>{headOffice?.company_name ?? "Head Office"}</strong>'s branding.
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="label">Logo</div>
                  <div className="flex items-center gap-3">
                    {logoUrl && <img src={logoUrl} alt="" className="h-14 max-w-[180px] object-contain" />}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingLogo}
                      onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {COLOR_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="label">{f.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-10 w-12 cursor-pointer rounded border border-line"
                          value={rgbTripletToHex(colors[f.key] ?? "0 0 0")}
                          onChange={(e) => setColors((c) => ({ ...c, [f.key]: hexToRgbTriplet(e.target.value) }))}
                        />
                        <input
                          className="input"
                          value={colors[f.key] ?? ""}
                          onChange={(e) => setColors((c) => ({ ...c, [f.key]: e.target.value }))}
                          placeholder="R G B"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Team</h2>
            <label className="flex items-start gap-3 rounded-lg border border-line p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={allowProfilePhotos}
                onChange={(e) => setAllowProfilePhotos(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">Allow profile photos</span>
                <span className="block text-xs text-ink-muted">
                  Lets this unit's people upload a photo on their own My Profile page, shown across the system and
                  in the Team directory. On by default — switch off if this client doesn't want photos at all.
                </span>
              </span>
            </label>
          </section>

          <button className="btn-primary" disabled={busy} onClick={handleSave}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      )}
    </div>
  );
}
