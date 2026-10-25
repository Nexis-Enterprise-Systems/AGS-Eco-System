import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useTable } from "../hooks/useTable";
import type { Client, Project } from "../lib/types";
import { AddressFields, AddressText, NameInput, PhoneInput } from "../components/FormattedInputs";
import { parseAddress, serialiseAddress } from "../lib/format";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const { rows: allProjects } = useTable<Project>("projects");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setClient((data as Client) ?? null);
        setForm((data as Client) ?? {});
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    if (!id) return;
    const { data } = await supabase.from("clients").update(form).eq("id", id).select().single();
    setClient((data as Client) ?? null);
    setEditing(false);
  }

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;
  if (!client) return <div className="text-sm text-ink-muted">Client not found.</div>;

  const projects = allProjects.filter((p) => p.client_id === client.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        subtitle={client.trading_name ? `Trading as ${client.trading_name}` : undefined}
        back={{ label: "Back to Clients", onClick: () => navigate("/clients") }}
        actions={
          <button className="btn-secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </button>
        }
      />

      <section className="card space-y-4 p-6">
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field kind="person" label="Contact name" value={form.contact_name} onChange={(v) => setForm((f) => ({ ...f, contact_name: v }))} />
            <Field label="Contact email" value={form.contact_email} onChange={(v) => setForm((f) => ({ ...f, contact_email: v }))} />
            <Field kind="phone" label="Contact phone" value={form.contact_phone} onChange={(v) => setForm((f) => ({ ...f, contact_phone: v }))} />
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <AddressFields value={parseAddress(form.address)} onChange={(a) => setForm((f) => ({ ...f, address: serialiseAddress(a) || null }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary" onClick={handleSave}>
                Save changes
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <InfoRow label="Contact" value={client.contact_name} />
            <InfoRow label="Email" value={client.contact_email} />
            <InfoRow label="Phone" value={client.contact_phone} />
            <div>
              <div className="label">Address</div>
              <AddressText text={client.address} />
            </div>
            {client.notes && (
              <div className="sm:col-span-2">
                <div className="label">Notes</div>
                <p className="text-ink">{client.notes}</p>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Projects</h2>
        <div className="card divide-y divide-black/5">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-muted">
              <span className="font-medium">{p.name}</span>
              <span className="badge bg-brand-primary/10 text-brand-primary capitalize">{p.stage.replace("_", " ")}</span>
            </Link>
          ))}
          {projects.length === 0 && <div className="px-4 py-6 text-center text-sm text-ink-muted">No projects for this client yet.</div>}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  kind,
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  kind?: "person" | "phone";
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {kind === "phone" ? (
        <PhoneInput value={value} onChange={onChange} />
      ) : kind === "person" ? (
        <NameInput person value={value} onChange={onChange} />
      ) : (
        <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}
