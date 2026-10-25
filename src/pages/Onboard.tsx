import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useHeadOfficeBranding } from "../hooks/useBusinessUnits";
import { BrandLogo } from "../components/BrandLogo";
import { ThemeToggle } from "../components/ThemeToggle";
import { AgreementText } from "../components/AgreementText";
import { buildAgreementPdf, downloadBlob } from "../lib/agreementPdf";
import {
  CERT_KINDS,
  HEALTH_CONDITIONS,
  formatSortCode,
  isValidNi,
  newId,
  normaliseDraft,
  uploadOnboardingDoc,
  type CertEntry,
  type Draft,
} from "../lib/onboarding";
import { AddressFields, NameInput, PhoneInput } from "../components/FormattedInputs";
import { addressProblem, isValidPhone } from "../lib/format";

// Public onboarding form (no login). Opened from the one-time link an
// admin copies from People. Every call goes through the token-checked
// functions in migration 0011; nothing here can read anyone else's data.
// Six steps, saved as the person goes (see docs/ONBOARDING_DESIGN.md).

interface Info {
  onboarding_id: string;
  person_type: "employee" | "subcontractor";
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  engagement_type: "individual" | "limited_company" | null;
  draft: unknown;
  step: number;
  agreement: string | null;
  agreement_name: string | null;
}

const STEPS = ["Personal", "Tax and bank", "Safety and health", "Certificates", "Agreement", "Sign"] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function Shell({ children, logo }: { children: ReactNode; logo?: string | null }) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-surface-muted">
      <ThemeToggle className="absolute right-5 top-4" />
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <BrandLogo src={logo} maxWidth={200} />
          <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">Welcome to AGS</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Onboard() {
  const { token = "" } = useParams();
  const { branding } = useHeadOfficeBranding();
  const [info, setInfo] = useState<Info | null>(null);
  const [problem, setProblem] = useState<"invalid" | "expired" | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(() => normaliseDraft(null));
  const [step, setStep] = useState(1);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [stepError, setStepError] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);
  const [copy, setCopy] = useState<{ blob: Blob; name: string } | null>(null);
  const ready = useRef(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("onboarding_get", { p_token: token });
    if (error || !data) {
      setProblem("invalid");
      setLoading(false);
      return null;
    }
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string") {
      setProblem(d.error === "expired" ? "expired" : "invalid");
      setLoading(false);
      return null;
    }
    return d as unknown as Info;
  }, [token]);

  useEffect(() => {
    let active = true;
    (async () => {
      const i = await load();
      if (!active || !i) return;
      const dr = normaliseDraft(i.draft);
      if (!dr.personal.phone && i.phone) dr.personal.phone = i.phone;
      // Sub-contractors always work on site, so they are never asked.
      if (i.person_type === "subcontractor") dr.safety.site_work = true;
      setInfo(i);
      setDraft(dr);
      setStep(Math.min(Math.max(i.step || 1, 1), 6));
      setLoading(false);
      setTimeout(() => {
        ready.current = true;
      }, 0);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // Refresh the agreement text on the agreement step, since it includes
  // the address entered earlier.
  useEffect(() => {
    if (step !== 5 || !info) return;
    let active = true;
    (async () => {
      const i = await load();
      if (active && i) setInfo((cur) => (cur ? { ...cur, agreement: i.agreement, agreement_name: i.agreement_name } : cur));
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Autosave, debounced.
  useEffect(() => {
    if (!ready.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("onboarding_save", { p_token: token, p_draft: draft, p_step: step });
      const d = data as Record<string, unknown> | null;
      if (error || (d && typeof d.error === "string")) {
        setSaveState("error");
        if (d && d.error === "expired") setProblem("expired");
      } else setSaveState("saved");
    }, 700);
    return () => clearTimeout(t);
  }, [draft, step, token]);

  const update = useCallback(<K extends keyof Draft>(key: K, patch: Partial<Draft[K]>) => {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as object), ...(patch as object) } }));
  }, []);

  const personType = info?.person_type ?? "employee";
  const siteWork = draft.safety.site_work === true;
  // Sole traders do not need public liability insurance; limited companies do.
  const needsInsurance = personType === "subcontractor" && draft.tax.engagement_type === "limited_company";

  function validate(s: number): string | null {
    const p = draft.personal;
    const t = draft.tax;
    if (s === 1) {
      if (!p.dob) return "Please enter your date of birth.";
      if (!p.phone?.trim() || !isValidPhone(p.phone)) return "Please enter a full phone number, for example 07700 900123 or 0208 1234567.";
      const addrErr = addressProblem({
        line1: p.address_line1 ?? "",
        line2: p.address_line2 ?? "",
        town: p.town ?? "",
        postcode: p.postcode ?? "",
        county: p.county ?? "",
      });
      if (addrErr) return addrErr;
    }
    if (s === 2) {
      if (!t.ni_number || !isValidNi(t.ni_number)) return "Please enter a valid National Insurance number, for example QQ123456C.";
      if (!t.bank_name?.trim()) return "Please enter your bank name.";
      if (!/^\d{8}$/.test((t.account_number ?? "").replace(/\s/g, ""))) return "The account number should be 8 digits.";
      if (!/^\d{6}$/.test((t.sort_code ?? "").replace(/\D/g, ""))) return "The sort code should be 6 digits.";
      if (personType === "subcontractor") {
        if (!/^\d{10}$/.test((t.utr ?? "").replace(/\s/g, ""))) return "Your UTR should be 10 digits.";
        if (!t.engagement_type) return "Please say whether you work as an individual or through a limited company.";
        if (t.engagement_type === "limited_company" && (!t.company_name?.trim() || !t.company_number?.trim()))
          return "Please enter your company name and number.";
      } else if (!t.starter_statement) return "Please choose the statement that applies to you.";
    }
    if (s === 3) {
      const e = { name: draft.safety.emergency.name, phone: draft.safety.emergency.phone ?? "", relationship: draft.safety.emergency.relationship };
      if (!e.name?.trim() || !e.phone.trim() || !e.relationship?.trim()) return "Please give an emergency contact: name, phone and relationship.";
      if (!isValidPhone(e.phone)) return "Please enter the emergency contact's full phone number.";
      if (personType === "employee" && (draft.safety.site_work === null || draft.safety.site_work === undefined))
        return "Please say whether you will work on site.";
      if (siteWork) {
        if (!draft.health.consent) return "Please tick to confirm you have read the health information notice.";
        if (!draft.health.doctor.name?.trim() || !draft.health.doctor.phone?.trim() || !isValidPhone(draft.health.doctor.phone))
          return "Please give your doctor's name and full phone number.";
        for (const c of HEALTH_CONDITIONS) {
          const cond = draft.health.conditions[c.key];
          if (cond?.on && !cond.controlled?.trim()) return `Please say how your ${c.label.toLowerCase()} is controlled.`;
        }
      }
    }
    if (s === 4) {
      if (personType === "employee" && !draft.rtw.file_path) return "Please upload a document that shows your right to work in the UK.";
      if (siteWork && !draft.certs.some((c) => c.kind === "cscs")) return "Please add your CSCS card.";
      if (needsInsurance && !draft.certs.some((c) => c.kind === "public_liability"))
        return "Please add your public liability insurance.";
      for (const c of draft.certs) {
        if (!c.file_path) return "Each certificate needs a photo or PDF. Please upload one or remove the entry.";
        if (!c.expiry) return "Each certificate needs an expiry date.";
      }
    }
    if (s === 5 && info?.agreement && !draft.agreed) return "Please tick to confirm you have read the agreement.";
    return null;
  }

  function next() {
    const err = validate(step);
    setStepError(err);
    if (!err) {
      setStep((s) => Math.min(s + 1, 6));
      window.scrollTo({ top: 0 });
    }
  }

  async function sign() {
    for (let s = 1; s <= 5; s++) {
      const err = validate(s);
      if (err) {
        setStep(s);
        setStepError(err);
        return;
      }
    }
    if (signature.trim().length < 3) {
      setStepError("Please type your full name to sign.");
      return;
    }
    setSigning(true);
    setStepError(null);
    // Make sure the latest answers are saved before signing.
    await supabase.rpc("onboarding_save", { p_token: token, p_draft: draft, p_step: 6 });
    // Build the PDF copy from the final wording and store it with the record.
    // If this fails the signing still goes ahead; the office can regenerate it.
    let finalDraft = draft;
    try {
      const latest = await load();
      if (latest?.agreement && info) {
        const signedAt = new Date();
        const title = latest.agreement_name ?? "Agreement";
        const blob = await buildAgreementPdf({ title, body: latest.agreement, signatureName: signature.trim(), signedAt });
        const fileName = `${title.replace(/[^A-Za-z0-9]+/g, "_")}_signed.pdf`;
        const up = await uploadOnboardingDoc(info.onboarding_id, new File([blob], fileName, { type: "application/pdf" }));
        if (!("error" in up)) {
          finalDraft = { ...draft, signed_pdf_path: up.path } as typeof draft;
          await supabase.rpc("onboarding_save", { p_token: token, p_draft: finalDraft, p_step: 6 });
        }
        setCopy({ blob, name: fileName });
      }
    } catch {
      /* PDF is a convenience copy; carry on */
    }
    const { data, error } = await supabase.rpc("onboarding_sign", { p_token: token, p_signature: signature.trim() });
    setSigning(false);
    const d = data as Record<string, unknown> | null;
    if (error) setStepError(error.message);
    else if (d && typeof d.error === "string") setProblem(d.error === "expired" ? "expired" : "invalid");
    else setDone(true);
  }

  if (loading) return <Shell logo={branding?.logo_url}><div className="text-center text-sm text-ink-muted">Loading…</div></Shell>;

  if (done)
    return (
      <Shell logo={branding?.logo_url}>
        <div className="card space-y-3 p-8 text-center">
          <h1 className="font-display text-3xl">Thank you</h1>
          <p className="text-sm text-ink-muted">
            Your details and signed agreement have been sent to AGS. We will review them and be in touch. You can close this page.
          </p>
          {copy && (
            <button type="button" className="btn-secondary" onClick={() => downloadBlob(copy.blob, copy.name)}>
              Download your signed copy (PDF)
            </button>
          )}
        </div>
      </Shell>
    );

  if (problem || !info)
    return (
      <Shell logo={branding?.logo_url}>
        <div className="card space-y-3 p-8 text-center">
          <h1 className="font-display text-3xl">{problem === "expired" ? "This link has expired" : "This link is not active"}</h1>
          <p className="text-sm text-ink-muted">
            {problem === "expired"
              ? "Onboarding links last 7 days. Please ask AGS to send you a new one."
              : "It may have been used already or replaced. If you think this is wrong, please contact AGS."}
          </p>
        </div>
      </Shell>
    );

  return (
    <Shell logo={branding?.logo_url}>
      <div className="mb-6">
        <h1 className="font-display text-3xl">Hello {info.full_name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {personType === "employee"
            ? "Please complete these details before you start. It takes about 10 minutes and saves as you go, so you can stop and come back on this link."
            : "Please complete these details before you start work. It takes about 10 minutes and saves as you go, so you can stop and come back on this link."}
        </p>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
          <span>
            Step {step} of 6 · {STEPS[step - 1]}
          </span>
          <span>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved, check your connection" : ""}</span>
        </div>
        <div className="h-1 w-full rounded-full bg-line">
          <div className="h-1 rounded-full bg-brand-primary transition-all" style={{ width: `${(step / 6) * 100}%` }} />
        </div>
      </div>

      <div className="card space-y-5 p-6 sm:p-8">
        {step === 1 && (
          <>
            <h2 className="font-display text-2xl">Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input className="input" value={info.full_name} disabled />
              </Field>
              <Field label="Email">
                <input className="input" value={info.email} disabled />
              </Field>
              <Field label="Date of birth">
                <input type="date" className="input" value={draft.personal.dob ?? ""} onChange={(e) => update("personal", { dob: e.target.value })} />
              </Field>
              <Field label="Phone">
                <PhoneInput value={draft.personal.phone ?? ""} onChange={(v) => update("personal", { phone: v })} />
              </Field>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Home address</h3>
              <AddressFields
                required
                value={{
                  line1: draft.personal.address_line1 ?? "",
                  line2: draft.personal.address_line2 ?? "",
                  town: draft.personal.town ?? "",
                  postcode: draft.personal.postcode ?? "",
                  county: draft.personal.county ?? "",
                }}
                onChange={(a) =>
                  update("personal", { address_line1: a.line1, address_line2: a.line2, town: a.town, postcode: a.postcode, county: a.county })
                }
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-2xl">Tax and bank</h2>
            <p className="text-sm text-ink-muted">
              {personType === "subcontractor"
                ? "Needed to pay you and to verify you under the Construction Industry Scheme."
                : "Needed to set you up on payroll."}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="National Insurance number" hint="For example QQ 12 34 56 C">
                <input className="input uppercase" value={draft.tax.ni_number ?? ""} onChange={(e) => update("tax", { ni_number: e.target.value.toUpperCase() })} />
              </Field>
              {personType === "subcontractor" && (
                <Field label="How do you work?">
                  <select className="input" value={draft.tax.engagement_type ?? ""} onChange={(e) => update("tax", { engagement_type: e.target.value })}>
                    <option value="">Choose…</option>
                    <option value="individual">As an individual (sole trader)</option>
                    <option value="limited_company">Through a limited company</option>
                  </select>
                </Field>
              )}
              {personType === "subcontractor" && (
                <Field label="UTR (Unique Taxpayer Reference)" hint="10 digits">
                  <input className="input" inputMode="numeric" value={draft.tax.utr ?? ""} onChange={(e) => update("tax", { utr: e.target.value })} />
                </Field>
              )}
              {personType === "subcontractor" && draft.tax.engagement_type === "limited_company" && (
                <>
                  <Field label="Company name">
                    <NameInput value={draft.tax.company_name ?? ""} onChange={(v) => update("tax", { company_name: v })} />
                  </Field>
                  <Field label="Company number">
                    <input className="input" value={draft.tax.company_number ?? ""} onChange={(e) => update("tax", { company_number: e.target.value })} />
                  </Field>
                </>
              )}
              <Field label="Bank name">
                <NameInput value={draft.tax.bank_name ?? ""} onChange={(v) => update("tax", { bank_name: v })} />
              </Field>
              <Field label="Account number" hint="8 digits">
                <input className="input" inputMode="numeric" value={draft.tax.account_number ?? ""} onChange={(e) => update("tax", { account_number: e.target.value })} />
              </Field>
              <Field label="Sort code">
                <input className="input" inputMode="numeric" value={draft.tax.sort_code ?? ""} onChange={(e) => update("tax", { sort_code: formatSortCode(e.target.value) })} />
              </Field>
            </div>
            {personType === "employee" && (
              <div className="space-y-3">
                <Field label="Starter statement" hint="HMRC asks every new employee to choose one of these.">
                  <select className="input" value={draft.tax.starter_statement ?? ""} onChange={(e) => update("tax", { starter_statement: e.target.value })}>
                    <option value="">Choose…</option>
                    <option value="A">A. This is my first job since 6 April and I have not been receiving taxable benefits</option>
                    <option value="B">B. This is now my only job</option>
                    <option value="C">C. I have another job or receive a pension</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={draft.tax.student_loan === true} onChange={(e) => update("tax", { student_loan: e.target.checked })} />
                  I have a student or postgraduate loan that is being repaid
                </label>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-2xl">Safety and health</h2>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Emergency contact</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Name">
                  <NameInput value={draft.safety.emergency.name ?? ""} onChange={(v) => setDraft((d) => ({ ...d, safety: { ...d.safety, emergency: { ...d.safety.emergency, name: v } } }))} person />
                </Field>
                <Field label="Phone">
                  <PhoneInput value={draft.safety.emergency.phone ?? ""} onChange={(v) => setDraft((d) => ({ ...d, safety: { ...d.safety, emergency: { ...d.safety.emergency, phone: v } } }))} />
                </Field>
                <Field label="Relationship">
                  <NameInput value={draft.safety.emergency.relationship ?? ""} onChange={(v) => setDraft((d) => ({ ...d, safety: { ...d.safety, emergency: { ...d.safety.emergency, relationship: v } } }))} />
                </Field>
              </div>
            </div>

            {personType === "employee" && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Will you work on site?</h3>
                <div className="flex gap-3">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, safety: { ...d.safety, site_work: v } }))}
                      className={draft.safety.site_work === v ? "btn-primary" : "btn-secondary"}
                    >
                      {v ? "Yes, I will be on site" : "No, office or remote only"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {siteWork && (
              <div className="space-y-4 border-t border-line pt-5">
                <h3 className="text-sm font-semibold">Health information</h3>
                <div className="rounded-sm border border-line bg-surface-muted p-3 text-sm text-ink-muted">
                  We ask this so that we can look after you on site and respond properly in an emergency. Only the directors of AGS can see it. It is kept
                  separately from the rest of your record, never shared outside AGS other than with emergency services, and deleted after you leave in line with our retention policy.
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={draft.health.consent === true} onChange={(e) => update("health", { consent: e.target.checked })} />
                  I have read this and I am happy to give this information.
                </label>
                <p className="text-sm text-ink-muted">Tick any that apply to you.</p>
                {HEALTH_CONDITIONS.map((c) => {
                  const cond = draft.health.conditions[c.key] ?? { on: false };
                  const set = (patch: Partial<typeof cond>) =>
                    setDraft((d) => ({ ...d, health: { ...d.health, conditions: { ...d.health.conditions, [c.key]: { ...cond, ...patch } } } }));
                  return (
                    <div key={c.key} className="rounded-sm border border-line p-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={cond.on} onChange={(e) => set({ on: e.target.checked })} />
                        {c.label}
                      </label>
                      {cond.on && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field label="How is it controlled?">
                            <input className="input" value={cond.controlled ?? ""} onChange={(e) => set({ controlled: e.target.value })} />
                          </Field>
                          <Field label="Medication, if any">
                            <input className="input" value={cond.medication ?? ""} onChange={(e) => set({ medication: e.target.value })} />
                          </Field>
                        </div>
                      )}
                    </div>
                  );
                })}
                <h3 className="pt-2 text-sm font-semibold">Your doctor</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Doctor's name">
                    <NameInput value={draft.health.doctor.name ?? ""} onChange={(v) => setDraft((d) => ({ ...d, health: { ...d.health, doctor: { ...d.health.doctor, name: v } } }))} person />
                  </Field>
                  <Field label="Surgery">
                    <NameInput value={draft.health.doctor.surgery ?? ""} onChange={(v) => setDraft((d) => ({ ...d, health: { ...d.health, doctor: { ...d.health.doctor, surgery: v } } }))} />
                  </Field>
                  <Field label="Surgery phone">
                    <PhoneInput value={draft.health.doctor.phone ?? ""} onChange={(v) => setDraft((d) => ({ ...d, health: { ...d.health, doctor: { ...d.health.doctor, phone: v } } }))} />
                  </Field>
                </div>
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <CertificatesStep
            onboardingId={info.onboarding_id}
            personType={personType}
            siteWork={siteWork}
            needsInsurance={needsInsurance}
            draft={draft}
            setDraft={setDraft}
          />
        )}

        {step === 5 && (
          <>
            <h2 className="font-display text-2xl">{info.agreement_name ?? "Agreement"}</h2>
            {info.agreement ? (
              <>
                <p className="text-sm text-ink-muted">Please read this carefully. You will sign it on the next step.</p>
                <AgreementText text={info.agreement} className="max-h-[55vh] overflow-auto rounded-sm border border-line bg-surface p-4" />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={draft.agreed === true} onChange={(e) => setDraft((d) => ({ ...d, agreed: e.target.checked }))} />
                  I have read and understood this agreement.
                </label>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                There is no agreement to sign at this stage. AGS will send it separately. On the next step you will confirm that the details you have given are correct.
              </p>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <h2 className="font-display text-2xl">Sign</h2>
            <p className="text-sm text-ink-muted">
              {info.agreement
                ? "By typing your full name you are signing the agreement and confirming that the details you have given are correct."
                : "By typing your full name you are confirming that the details you have given are correct."}
            </p>
            <Field label="Type your full name">
              <NameInput className="input font-display text-xl" person value={signature} onChange={setSignature} autoComplete="off" />
            </Field>
            <p className="text-xs text-ink-muted">Signed on {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</p>
          </>
        )}

        {stepError && <p className="text-sm text-red-600 dark:text-red-400">{stepError}</p>}

        <div className="flex items-center justify-between border-t border-line pt-5">
          <button className="btn-secondary" type="button" disabled={step === 1} onClick={() => { setStepError(null); setStep((s) => Math.max(1, s - 1)); window.scrollTo({ top: 0 }); }}>
            Back
          </button>
          {step < 6 ? (
            <button className="btn-primary" type="button" onClick={next}>
              Continue
            </button>
          ) : (
            <button className="btn-primary" type="button" disabled={signing} onClick={sign}>
              {signing ? "Submitting…" : "Sign and submit"}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function CertificatesStep({
  onboardingId,
  personType,
  siteWork,
  needsInsurance,
  draft,
  setDraft,
}: {
  onboardingId: string;
  personType: "employee" | "subcontractor";
  siteWork: boolean;
  needsInsurance: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const kinds = useMemo(
    () => CERT_KINDS.filter((k) => k.key !== "right_to_work" && (!k.forTypes || k.forTypes.includes(personType))),
    [personType]
  );

  async function upload(file: File, apply: (path: string, name: string) => void, key: string) {
    setUploading(key);
    setUploadError(null);
    const res = await uploadOnboardingDoc(onboardingId, file);
    setUploading(null);
    if ("error" in res) setUploadError(res.error);
    else apply(res.path, res.name);
  }

  function addCert() {
    const has = (k: string) => draft.certs.some((c) => c.kind === k);
    const kind = siteWork && !has("cscs") ? "cscs" : needsInsurance && !has("public_liability") ? "public_liability" : "first_aid";
    setDraft((d) => ({ ...d, certs: [...d.certs, { id: newId(), kind, number: "", expiry: "", file_path: "", file_name: "" }] }));
  }

  function patchCert(id: string, patch: Partial<CertEntry>) {
    setDraft((d) => ({ ...d, certs: d.certs.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }

  const required: string[] = [];
  if (personType === "employee") required.push("proof of your right to work in the UK");
  if (siteWork) required.push("your CSCS card");
  if (needsInsurance) required.push("your public liability insurance");

  return (
    <>
      <h2 className="font-display text-2xl">Certificates and documents</h2>
      {required.length > 0 && <p className="text-sm text-ink-muted">Required: {required.join(", ")}. Add any other tickets you hold. A clear photo or a PDF is fine.</p>}

      {personType === "employee" && (
        <div className="rounded-sm border border-line p-4">
          <h3 className="mb-1 text-sm font-semibold">Right to work</h3>
          <p className="mb-3 text-xs text-ink-muted">For example your passport, or your share code confirmation. We will check it with you.</p>
          {draft.rtw.file_path ? (
            <div className="flex items-center justify-between text-sm">
              <span>{draft.rtw.file_name}</span>
              <button className="text-xs text-ink-muted underline" type="button" onClick={() => setDraft((d) => ({ ...d, rtw: {} }))}>
                Remove
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f, (path, name) => setDraft((d) => ({ ...d, rtw: { file_path: path, file_name: name } })), "rtw");
              }}
            />
          )}
          {uploading === "rtw" && <p className="mt-2 text-xs text-ink-muted">Uploading…</p>}
        </div>
      )}

      {draft.certs.map((c) => (
        <div key={c.id} className="space-y-3 rounded-sm border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <select className="input" value={c.kind} onChange={(e) => patchCert(c.id, { kind: e.target.value })}>
                {kinds.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number">
              <input className="input" value={c.number} onChange={(e) => patchCert(c.id, { number: e.target.value })} />
            </Field>
            <Field label="Expiry date">
              <input type="date" className="input" value={c.expiry} onChange={(e) => patchCert(c.id, { expiry: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3">
            {c.file_path ? (
              <span className="text-sm">{c.file_name}</span>
            ) : (
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f, (path, name) => patchCert(c.id, { file_path: path, file_name: name }), c.id);
                }}
              />
            )}
            <button className="text-xs text-ink-muted underline" type="button" onClick={() => setDraft((d) => ({ ...d, certs: d.certs.filter((x) => x.id !== c.id) }))}>
              Remove
            </button>
          </div>
          {uploading === c.id && <p className="text-xs text-ink-muted">Uploading…</p>}
        </div>
      ))}

      {uploadError && <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
      <button className="btn-secondary" type="button" onClick={addCert}>
        Add a certificate
      </button>
    </>
  );
}
