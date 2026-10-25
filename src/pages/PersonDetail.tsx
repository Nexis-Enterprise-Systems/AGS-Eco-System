import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
import { CopyLink } from "../components/CopyLink";
import { AddCertificateModal } from "../components/AddCertificateModal";
import { AgreementText } from "../components/AgreementText";
import { AddressText } from "../components/FormattedInputs";
import { buildAgreementPdf, downloadBlob } from "../lib/agreementPdf";
import { supabase } from "../lib/supabase";
import { ONBOARDING_BUCKET, certLabel, inviteUrl, HEALTH_CONDITIONS } from "../lib/onboarding";
import { personStatus, type PersonWithOnboarding } from "./PeopleList";
import type {
  OnboardingRow,
  PersonCertificateRow,
  PersonHealthRow,
  PersonPrivateRow,
  PersonRow,
  SignedAgreementRow,
} from "../lib/types";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "documents", label: "Documents" },
  { key: "agreement", label: "Agreement" },
  { key: "health", label: "Health" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 border-b border-line py-2 text-sm last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="col-span-2">{value || <span className="text-ink-muted">—</span>}</dd>
    </div>
  );
}

function fmtDate(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

// A person's profile: the one place everything from onboarding is
// housed, and where an admin reviews a signed submission.
export function PersonDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState<PersonRow | null>(null);
  const [onb, setOnb] = useState<OnboardingRow | null>(null);
  const [priv, setPriv] = useState<PersonPrivateRow | null>(null);
  const [health, setHealth] = useState<PersonHealthRow | null>(null);
  const [certs, setCerts] = useState<PersonCertificateRow[]>([]);
  const [agreements, setAgreements] = useState<SignedAgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("profile");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [addingCert, setAddingCert] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const { data: p, error: err } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
    if (err || !p) {
      setError(err?.message ?? "Person not found.");
      setLoading(false);
      return;
    }
    setPerson(p as PersonRow);
    const [o, pr, h, c, a] = await Promise.all([
      supabase.from("onboardings").select("*").eq("person_id", id).order("created_at", { ascending: false }).limit(1),
      supabase.from("person_private").select("*").eq("person_id", id).maybeSingle(),
      supabase.from("person_health").select("*").eq("person_id", id).maybeSingle(),
      supabase.from("person_certificates").select("*").eq("person_id", id).order("expiry_date"),
      supabase.from("signed_agreements").select("*").eq("person_id", id).order("signed_at", { ascending: false }),
    ]);
    setOnb(((o.data ?? [])[0] as OnboardingRow | undefined) ?? null);
    setPriv((pr.data as PersonPrivateRow | null) ?? null);
    setHealth((h.data as PersonHealthRow | null) ?? null);
    setCerts((c.data ?? []) as PersonCertificateRow[]);
    setAgreements((a.data ?? []) as SignedAgreementRow[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function newLink() {
    if (!onb) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("onboarding_reissue", { p_onboarding_id: onb.id });
    setBusy(false);
    if (err) setError(err.message);
    else {
      setLink(inviteUrl(data as unknown as string));
      load();
    }
  }

  async function review(accept: boolean) {
    if (!onb) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("onboarding_review", {
      p_onboarding_id: onb.id,
      p_accept: accept,
      p_reason: accept ? null : reason,
    });
    setBusy(false);
    if (err) setError(err.message);
    else {
      setRejecting(false);
      setReason("");
      load();
    }
  }

  async function openFile(path: string) {
    const { data, error: err } = await supabase.storage.from(ONBOARDING_BUCKET).createSignedUrl(path, 300);
    if (err || !data) setError(err?.message ?? "Could not open the file.");
    else window.open(data.signedUrl, "_blank", "noopener");
  }

  // Stored PDF if there is one; otherwise rebuilt from the frozen wording.
  async function downloadAgreement(a: SignedAgreementRow) {
    setError(null);
    const fileName = `${a.template_name.replace(/[^A-Za-z0-9]+/g, "_")}_signed.pdf`;
    if (a.pdf_path) {
      const { data } = await supabase.storage.from(ONBOARDING_BUCKET).createSignedUrl(a.pdf_path, 300, { download: fileName });
      if (data) {
        window.location.href = data.signedUrl;
        return;
      }
    }
    try {
      const blob = await buildAgreementPdf({
        title: a.template_name,
        body: a.body_text,
        signatureName: a.signature_name,
        signedAt: new Date(a.signed_at),
      });
      downloadBlob(blob, fileName);
    } catch {
      setError("Could not create the PDF.");
    }
  }

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;
  if (!person)
    return (
      <div className="space-y-3">
        <PageHeader title="Person not found" back={{ label: "Back to People", onClick: () => navigate("/people") }} />
        <div className="card p-6 text-sm text-red-700 dark:text-red-300">{error}</div>
      </div>
    );

  const status = personStatus({ ...person, onboarding: onb } as PersonWithOnboarding);
  const isSub = person.person_type === "subcontractor";
  const waiting = onb && (onb.status === "invited" || onb.status === "in_progress" || onb.status === "expired" || onb.status === "rejected");

  return (
    <div className="space-y-6">
      <PageHeader
        title={person.full_name}
        subtitle={`${isSub ? "Sub-contractor" : "Employee"}${person.job_title ? " · " + person.job_title : ""}`}
        badge={<span className={`badge ${status.className}`}>{status.label}</span>}
        back={{ label: "Back to People", onClick: () => navigate("/people") }}
      />

      {error && <div className="card border-red-300 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold">Onboarding</h2>
        {!onb && <p className="text-sm text-ink-muted">No onboarding has been started for this person.</p>}
        {onb && (
          <>
            <p className="text-sm text-ink-muted">
              Invited {fmtDate(onb.invited_at)}
              {onb.signed_at ? ` · signed ${fmtDate(onb.signed_at)}` : ""}
              {onb.reviewed_at ? ` · reviewed ${fmtDate(onb.reviewed_at)}` : ""}
              {onb.status === "invited" || onb.status === "in_progress" ? ` · link expires ${fmtDate(onb.token_expires_at)}` : ""}
              {onb.status === "in_progress" ? ` · now on step ${onb.step} of 6` : ""}
            </p>
            {onb.status === "rejected" && onb.reject_reason && <p className="text-sm">Rejected: {onb.reject_reason}</p>}
            <div className="flex flex-wrap gap-2">
              {waiting && (
                <button className="btn-secondary" disabled={busy} onClick={newLink}>
                  Create a new invite link
                </button>
              )}
              {onb.status === "signed" && (
                <>
                  <button className="btn-primary" disabled={busy} onClick={() => review(true)}>
                    Accept
                  </button>
                  <button className="btn-secondary" disabled={busy} onClick={() => setRejecting(true)}>
                    Reject
                  </button>
                </>
              )}
            </div>
            {onb.status === "signed" && (
              <p className="text-xs text-ink-muted">
                Check the details, documents and agreement below.{" "}
                {isSub
                  ? "For a sub-contractor, also verify their CIS status and record the status check before you accept."
                  : "For an employee, check their right-to-work document before you accept."}{" "}
                Accepting puts them on the invite list so they can create a login. Nobody gets a login before this point.
              </p>
            )}
            {(onb.status === "accepted" || person.status === "active") && (
              <div className="space-y-2 text-sm">
                <p className="text-ink-muted">
                  Accepted. To give them a login, send them this link. They sign up with {person.email}.
                </p>
                <CopyLink url={`${window.location.origin}/signup`} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-b-2 border-brand-primary text-brand-primary" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-6">
            <h3 className="mb-2 text-sm font-semibold">Details</h3>
            <dl>
              <Row label="Email" value={person.email} />
              <Row label="Phone" value={person.phone} />
              <Row label={isSub ? "Trade" : "Job title"} value={person.job_title} />
              {isSub && <Row label="Works as" value={person.engagement_type === "limited_company" ? "Limited company" : "Individual"} />}
              <Row label="Start date" value={fmtDate(person.start_date)} />
              <Row
                label={isSub ? "Rate" : "Pay"}
                value={person.rate != null ? `£${Number(person.rate).toLocaleString("en-GB", { minimumFractionDigits: 2 })} per ${person.rate_unit}` : ""}
              />
            </dl>
          </div>
          <div className="card p-6">
            <h3 className="mb-2 text-sm font-semibold">Personal and payment details</h3>
            {priv ? (
              <dl>
                <Row label="Date of birth" value={fmtDate(priv.date_of_birth)} />
                <Row label="Address" value={<AddressText text={priv.address} />} />
                <Row label="NI number" value={priv.ni_number} />
                {isSub && <Row label="UTR" value={priv.utr} />}
                {isSub && priv.company_name && <Row label="Company" value={`${priv.company_name} (${priv.company_number})`} />}
                <Row label="Bank" value={priv.bank_name} />
                <Row label="Account / sort code" value={priv.account_number ? `${priv.account_number} / ${priv.sort_code}` : ""} />
                {!isSub && <Row label="Starter statement" value={priv.starter_statement} />}
                {!isSub && <Row label="Student loan" value={priv.student_loan ? "Yes" : "No"} />}
                <Row
                  label="Emergency contact"
                  value={priv.emergency_name ? `${priv.emergency_name} (${priv.emergency_relationship}), ${priv.emergency_phone}` : ""}
                />
              </dl>
            ) : (
              <p className="text-sm text-ink-muted">Not submitted yet. These appear once the person has signed.</p>
            )}
            <p className="mt-3 text-xs text-ink-muted">Only admins can see this section.</p>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="card p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Certificates and documents</h3>
            <button className="btn-secondary" onClick={() => setAddingCert(true)}>
              Add or renew certificate
            </button>
          </div>
          {certs.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing uploaded yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Number</th>
                  <th className="py-2 font-medium">Expires</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => {
                  const replaced = certs.some(
                    (o) => o.id !== c.id && o.kind === c.kind && (c.kind !== "other" || o.number === c.number) && (o.expiry_date ?? "") > (c.expiry_date ?? "")
                  );
                  const days = c.expiry_date ? Math.ceil((new Date(c.expiry_date).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="py-2">{certLabel(c.kind)}</td>
                      <td className="py-2">{c.number || "—"}</td>
                      <td className="py-2">
                        {fmtDate(c.expiry_date) || "—"}
                        {replaced && <span className="badge ml-2 bg-surface-muted text-ink-muted">Replaced</span>}
                        {!replaced && days != null && days < 0 && <span className="badge ml-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">Expired</span>}
                        {!replaced && days != null && days >= 0 && days <= 60 && (
                          <span className="badge ml-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{days} days</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {c.file_path && (
                          <button className="text-xs text-brand-primary hover:underline" onClick={() => openFile(c.file_path!)}>
                            View file
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "agreement" && (
        <div className="space-y-4">
          {agreements.length === 0 ? (
            <div className="card p-6 text-sm text-ink-muted">No signed agreement yet.</div>
          ) : (
            agreements.map((a) => (
              <div key={a.id} className="card space-y-3 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {a.template_name}
                    {a.template_version ? ` (version ${a.template_version})` : ""}
                  </h3>
                  <span className="text-xs text-ink-muted">
                    Signed by {a.signature_name} on {fmtDate(a.signed_at)}
                  </span>
                </div>
                <div>
                  <button type="button" className="btn-secondary" onClick={() => downloadAgreement(a)}>
                    Download signed PDF
                  </button>
                </div>
                <AgreementText text={a.body_text} className="max-h-[60vh] overflow-auto rounded-sm border border-line bg-surface p-4" />
                <p className="text-xs text-ink-muted">This is the exact wording that was signed. It is never changed.</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "health" && (
        <div className="card space-y-3 p-6">
          <h3 className="text-sm font-semibold">Health information</h3>
          <p className="text-xs text-ink-muted">
            Special category data. Admins only, held separately, never shown elsewhere in the system. Delete it when the person leaves in line with the retention policy.
          </p>
          {!health ? (
            <p className="text-sm text-ink-muted">Nothing recorded. Either not submitted yet, or the person does not work on site.</p>
          ) : (
            <HealthView data={health.data} />
          )}
        </div>
      )}

      {link && (
        <Modal title="New invite link" onClose={() => setLink(null)}>
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">Send this to {person.full_name}. It works for 7 days. The previous link no longer works.</p>
            <CopyLink url={link} />
            <div className="flex justify-end">
              <button className="btn-secondary" onClick={() => setLink(null)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {addingCert && (
        <AddCertificateModal
          personId={person.id}
          personType={person.person_type}
          onClose={() => setAddingCert(false)}
          onSaved={() => {
            setAddingCert(false);
            load();
          }}
        />
      )}

      {rejecting && (
        <Modal title="Reject onboarding" onClose={() => setRejecting(false)}>
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">Say why. You can then create a new link for them to try again.</p>
            <textarea className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setRejecting(false)}>
                Cancel
              </button>
              <button className="btn-danger" disabled={busy || !reason.trim()} onClick={() => review(false)}>
                Reject
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function HealthView({ data }: { data: Record<string, unknown> }) {
  const conditions = (data.conditions ?? {}) as Record<string, { on?: boolean; controlled?: string; medication?: string }>;
  const doctor = (data.doctor ?? {}) as { name?: string; surgery?: string; phone?: string };
  const active = HEALTH_CONDITIONS.filter((c) => conditions[c.key]?.on);
  return (
    <dl>
      {active.length === 0 && <Row label="Conditions" value="None declared" />}
      {active.map((c) => (
        <Row
          key={c.key}
          label={c.label}
          value={`Controlled by: ${conditions[c.key].controlled || "—"}. Medication: ${conditions[c.key].medication || "none"}.`}
        />
      ))}
      <Row label="Doctor" value={[doctor.name, doctor.surgery, doctor.phone].filter(Boolean).join(", ")} />
    </dl>
  );
}
