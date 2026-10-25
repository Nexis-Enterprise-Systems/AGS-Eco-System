import { useState } from "react";
import { Modal } from "./Modal";
import { supabase } from "../lib/supabase";
import { CERT_KINDS, ONBOARDING_BUCKET, newId } from "../lib/onboarding";
import type { PersonType } from "../lib/types";

// Office adds a new certificate, or a renewal. A renewal is just a new
// certificate with a later expiry; the system treats the latest as current
// and the reminders for the old one stop by themselves.
export function AddCertificateModal({
  personId,
  personType,
  onClose,
  onSaved,
}: {
  personId: string;
  personType: PersonType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const kinds = CERT_KINDS.filter((k) => !k.forTypes || k.forTypes.includes(personType));
  const [kind, setKind] = useState(kinds[0]?.key ?? "other");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!expiry) {
      setError("Please enter the expiry date.");
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      setError("That file is over 10MB.");
      return;
    }
    setBusy(true);
    setError(null);
    let path: string | null = null;
    if (file) {
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
      path = `person/${personId}/${newId()}-${safe}`;
      const up = await supabase.storage.from(ONBOARDING_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (up.error) {
        setError(up.error.message);
        setBusy(false);
        return;
      }
    }
    const { error: err } = await supabase
      .from("person_certificates")
      .insert({ person_id: personId, kind, number: number.trim(), expiry_date: expiry, file_path: path, source: "office" });
    setBusy(false);
    if (err) setError(err.message);
    else onSaved();
  }

  return (
    <Modal title="Add or renew a certificate" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          For a renewal, add the new certificate with its new expiry date. It replaces the old one in the expiry list automatically.
        </p>
        <div>
          <label className="label">Certificate</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Number or reference</label>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <label className="label">Expiry date</label>
            <input type="date" className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Copy of certificate (optional)</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        {error && <div className="rounded-sm bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
