import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { CopyLink } from "./CopyLink";
import { supabase } from "../lib/supabase";
import { inviteUrl, RATE_UNITS, TRADES } from "../lib/onboarding";
import type { ContractTemplateRow, JobRoleRow, PersonType } from "../lib/types";
import { NameInput, PhoneInput } from "./FormattedInputs";
import { isValidPhone } from "../lib/format";

// Step 1 of onboarding: the office adds the person and gets their
// one-time link. Same form for employees and sub-contractors; only a
// few fields change with the type (docs/ONBOARDING_DESIGN.md).
export function AddPersonModal({
  initialType,
  onClose,
  onCreated,
}: {
  initialType: PersonType;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<PersonType>(initialType);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [rate, setRate] = useState("");
  const [rateUnit, setRateUnit] = useState<string>(initialType === "employee" ? "year" : "day");
  const [trade, setTrade] = useState("");
  const [tradeOther, setTradeOther] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [roles, setRoles] = useState<JobRoleRow[]>([]);
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("job_roles")
      .select("*")
      .neq("status", "retired")
      .order("title")
      .then(({ data }) => setRoles((data ?? []) as JobRoleRow[]));
    supabase
      .from("contract_templates")
      .select("*")
      .neq("status", "retired")
      .order("version", { ascending: false })
      .then(({ data }) => {
        const seen = new Set<string>();
        const latest = ((data ?? []) as ContractTemplateRow[]).filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)));
        setTemplates(latest);
      });
  }, []);

  useEffect(() => {
    setRateUnit(type === "employee" ? "year" : "day");
    setTemplateId("");
  }, [type]);

  const matching = templates.filter((t) => (type === "subcontractor" ? t.employee_type === "subcontractor" : t.employee_type !== "subcontractor"));
  const chosen = matching.find((t) => t.id === templateId) ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (phone && !isValidPhone(phone)) {
      setError("Please enter a full phone number, for example 07700 900123 or 0208 1234567.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("onboarding_create", {
      p_type: type,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
      p_job_role_id: type === "employee" && roleId ? roleId : null,
      p_job_title: type === "subcontractor" ? (trade === "Other" ? tradeOther.trim() : trade) : jobTitle,
      p_start_date: startDate || null,
      p_rate: rate ? Number(rate) : null,
      p_rate_unit: rate ? rateUnit : null,
      p_engagement_type: null,
      p_template_id: templateId || null,
    });
    setBusy(false);
    if (err) {
      setError(
        /does not exist|schema cache/i.test(err.message)
          ? "The onboarding tables are not in this database yet. Run migration 0011_people_onboarding.sql in the Supabase SQL editor."
          : err.message
      );
      return;
    }
    const res = data as unknown as { token: string };
    setLink(inviteUrl(res.token));
    onCreated();
  }

  if (link) {
    return (
      <Modal title="Invite link ready" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Send this link to {fullName} by email or WhatsApp. It works for 7 days and can only be used by them. You will not be shown it
            again, but you can create a new one from their record.
          </p>
          <CopyLink url={link} />
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add person" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={submit}>
        <div className="flex gap-2">
          {(["employee", "subcontractor"] as PersonType[]).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={type === t ? "btn-primary" : "btn-secondary"}>
              {t === "employee" ? "Employee" : "Sub-contractor"}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">Agencies are added under Suppliers, not here.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <NameInput required value={fullName} onChange={(v) => setFullName(v)} person />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <PhoneInput value={phone} onChange={(v) => setPhone(v)} />
          </div>
          {type === "employee" ? (
            <div>
              <label className="label">Job role</label>
              <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">None selected</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Trade</label>
              <select className="input" required value={trade} onChange={(e) => setTrade(e.target.value)}>
                <option value="">Choose a trade…</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              {trade === "Other" && (
                <NameInput required placeholder="Trade" value={tradeOther} onChange={(v) => setTradeOther(v)} />
              )}
            </div>
          )}
          {type === "employee" && (
            <div>
              <label className="label">Job title (if different from the role)</label>
              <input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">{type === "employee" ? "Start date" : "Start date (if known)"}</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">{type === "employee" ? "Pay" : "Rate"}</label>
            <div className="flex gap-2">
              <input className="input" inputMode="decimal" placeholder="£" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} />
              <select className="input w-32" value={rateUnit} onChange={(e) => setRateUnit(e.target.value)}>
                {RATE_UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="label">Agreement they will sign</label>
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">No agreement yet (details only)</option>
            {matching.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (v{t.version}, {t.status === "approved" ? "approved" : "not yet approved"})
              </option>
            ))}
          </select>
          {matching.length === 0 && (
            <p className="mt-1 text-xs text-ink-muted">
              There is no {type === "subcontractor" ? "sub-contractor" : "employee"} agreement template yet. Add one in Settings, People &amp; HR.
            </p>
          )}
          {chosen && chosen.status !== "approved" && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              This wording has not been approved by a solicitor. Only issue it once it has.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create invite link"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
