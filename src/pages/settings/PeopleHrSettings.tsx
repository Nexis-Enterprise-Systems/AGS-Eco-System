import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { AgreementText } from "../../components/AgreementText";
import { supabase } from "../../lib/supabase";
import type { ContractTemplateRow, ContractTemplateStatus, JobRoleRow } from "../../lib/types";

const TABS = [
  { key: "templates", label: "Contract templates" },
  { key: "roles", label: "Job roles" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_LABEL: Record<ContractTemplateStatus, string> = {
  draft: "Draft",
  solicitor_review: "With solicitor",
  approved: "Approved",
  retired: "Retired",
};

const STATUS_CLASS: Record<ContractTemplateStatus, string> = {
  draft: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  solicitor_review: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  approved: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  retired: "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400",
};

// Settings -> People & HR. Holds the wording the People module builds
// contracts from: versioned contract templates (with {{merge_fields}})
// and the job roles library. Legal wording is owned by AGS's solicitor;
// this page stores it, versions it and records its review status.
export function PeopleHrSettings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("templates");

  return (
    <div className="space-y-6">
      <PageHeader
        title="People & HR"
        subtitle="Contract templates and job roles used when people are added to the system."
        back={{ label: "Back to Settings", onClick: () => navigate("/settings") }}
      />
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
      {tab === "templates" ? <TemplatesPanel /> : <RolesPanel />}
    </div>
  );
}

function TemplatesPanel() {
  const [rows, setRows] = useState<ContractTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"agreement" | "notes">("agreement");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("contract_templates")
      .select("*")
      .order("key")
      .order("version", { ascending: false });
    if (err) {
      setError(
        /relation|does not exist|schema cache/i.test(err.message)
          ? "The People & HR tables are not in this database yet. Run migration 0010_people_templates.sql in the Supabase SQL editor."
          : err.message
      );
    } else {
      setError(null);
      const list = (data ?? []) as ContractTemplateRow[];
      setRows(list);
      setSelectedId((cur) => cur ?? list[0]?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    setEditing(false);
    setReviewer(selected?.reviewed_by ?? "");
  }, [selectedId, selected?.reviewed_by]);

  async function setStatus(status: ContractTemplateStatus) {
    if (!selected) return;
    if (status === "approved" && !reviewer.trim()) {
      setError("Enter the name of the solicitor or firm who reviewed it before marking it approved.");
      return;
    }
    setBusy(true);
    const patch: Partial<ContractTemplateRow> = {
      status,
      updated_at: new Date().toISOString(),
      reviewed_by: status === "approved" ? reviewer.trim() : selected.reviewed_by,
      reviewed_on: status === "approved" ? new Date().toISOString().slice(0, 10) : selected.reviewed_on,
    };
    const { error: err } = await supabase.from("contract_templates").update(patch).eq("id", selected.id);
    setBusy(false);
    if (err) setError(err.message);
    else {
      setError(null);
      await load();
    }
  }

  async function saveNewVersion() {
    if (!selected) return;
    setBusy(true);
    const nextVersion = Math.max(...rows.filter((r) => r.key === selected.key).map((r) => r.version)) + 1;
    const keys = Array.from(new Set<string>((draftBody.match(/\{\{\w+\}\}/g) ?? []).map((m: string) => m.slice(2, -2)))).sort();
    const { data, error: err } = await supabase
      .from("contract_templates")
      .insert({
        key: selected.key,
        name: selected.name,
        employee_type: selected.employee_type,
        version: nextVersion,
        status: "draft",
        body_md: draftBody,
        notes_md: selected.notes_md,
        fields: keys.map((k) => ({ key: k, label: k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) })),
      })
      .select("id")
      .single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setEditing(false);
    await load();
    if (data) setSelectedId((data as { id: string }).id);
  }

  function downloadMd() {
    if (!selected) return;
    const blob = new Blob([selected.body_md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selected.key}-v${selected.version}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;

  return (
    <div className="space-y-4">
      {error && <div className="card border-red-300 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {rows.length === 0 && !error && <div className="card p-6 text-sm text-ink-muted">No templates yet.</div>}
      {rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`card block w-full p-4 text-left ${r.id === selectedId ? "ring-1 ring-brand-primary" : ""}`}
              >
                <div className="text-sm font-medium">{r.name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                  <span>Version {r.version}</span>
                  <span className={`badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="card space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                  <p className="text-xs text-ink-muted">
                    Version {selected.version} · {selected.fields.length} merge fields
                    {selected.reviewed_by ? ` · reviewed by ${selected.reviewed_by} on ${selected.reviewed_on}` : ""}
                  </p>
                </div>
                <span className={`badge ${STATUS_CLASS[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>

              {selected.status !== "approved" && (
                <div className="rounded-md border border-line bg-surface-muted p-3 text-sm text-ink-muted">
                  This wording has not been approved by a solicitor. Do not issue it to anyone as a signed contract
                  until it is marked approved.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button className={view === "agreement" ? "btn-primary" : "btn-secondary"} onClick={() => setView("agreement")}>
                  Agreement
                </button>
                <button className={view === "notes" ? "btn-primary" : "btn-secondary"} onClick={() => setView("notes")}>
                  Notes for solicitor
                </button>
                <button className="btn-secondary" onClick={downloadMd}>
                  Download
                </button>
                {!editing && view === "agreement" && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setDraftBody(selected.body_md);
                      setEditing(true);
                    }}
                  >
                    Edit as new version
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-3">
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    rows={28}
                    className="w-full rounded-md border border-line bg-surface p-3 font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={busy || draftBody === selected.body_md} onClick={saveNewVersion}>
                      Save as version {Math.max(...rows.filter((r) => r.key === selected.key).map((r) => r.version)) + 1}
                    </button>
                    <button className="btn-secondary" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <AgreementText text={view === "agreement" ? selected.body_md : selected.notes_md} className="max-h-[60vh] overflow-auto rounded-sm border border-line bg-surface p-4" />
              )}

              {view === "agreement" && !editing && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-ink-muted">Merge fields ({selected.fields.length})</summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.fields.map((f) => (
                      <code key={f.key} className="rounded border border-line px-1.5 py-0.5 text-xs">
                        {`{{${f.key}}}`}
                      </code>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
                <label className="text-xs text-ink-muted">
                  Reviewed by (solicitor or firm)
                  <input
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    className="mt-1 block w-64 rounded-md border border-line bg-surface p-2 text-sm text-ink"
                  />
                </label>
                {selected.status === "draft" && (
                  <button className="btn-secondary" disabled={busy} onClick={() => setStatus("solicitor_review")}>
                    Mark as sent to solicitor
                  </button>
                )}
                {selected.status !== "approved" && (
                  <button className="btn-primary" disabled={busy} onClick={() => setStatus("approved")}>
                    Mark as approved
                  </button>
                )}
                {selected.status === "approved" && (
                  <button className="btn-secondary" disabled={busy} onClick={() => setStatus("retired")}>
                    Retire
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RolesPanel() {
  const [rows, setRows] = useState<JobRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<JobRoleRow> | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("job_roles").select("*").order("title");
    if (err) {
      setError(
        /relation|does not exist|schema cache/i.test(err.message)
          ? "The People & HR tables are not in this database yet. Run migration 0010_people_templates.sql in the Supabase SQL editor."
          : err.message
      );
    } else {
      setError(null);
      setRows((data ?? []) as JobRoleRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing?.title?.trim()) {
      setError("A job role needs a title.");
      return;
    }
    const payload = {
      title: editing.title.trim(),
      summary: editing.summary ?? "",
      duties: editing.duties ?? "",
      reports_to: editing.reports_to ?? "",
      place_of_work: editing.place_of_work ?? "",
      typical_hours: editing.typical_hours ?? "",
      status: editing.status ?? "draft",
      updated_at: new Date().toISOString(),
    };
    const { error: err } = editing.id
      ? await supabase.from("job_roles").update(payload).eq("id", editing.id)
      : await supabase.from("job_roles").insert(payload);
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setEditing(null);
    await load();
  }

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const field = (label: string, key: keyof JobRoleRow, rowsN = 0) => (
    <label className="block text-xs text-ink-muted">
      {label}
      {rowsN > 0 ? (
        <textarea
          rows={rowsN}
          value={(editing?.[key] as string) ?? ""}
          onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
          className="mt-1 block w-full rounded-md border border-line bg-surface p-2 text-sm text-ink"
        />
      ) : (
        <input
          value={(editing?.[key] as string) ?? ""}
          onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
          className="mt-1 block w-full rounded-md border border-line bg-surface p-2 text-sm text-ink"
        />
      )}
    </label>
  );

  return (
    <div className="space-y-4">
      {error && <div className="card border-red-300 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {!editing && (
        <>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setEditing({ status: "draft" })}>
              Add job role
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <button key={r.id} onClick={() => setEditing(r)} className="card block w-full p-4 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.title}</span>
                  <span className="badge bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">{r.status}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{r.summary}</p>
              </button>
            ))}
            {rows.length === 0 && !error && <div className="card p-6 text-sm text-ink-muted">No job roles yet.</div>}
          </div>
        </>
      )}
      {editing && (
        <div className="card space-y-3 p-6">
          {field("Job title", "title")}
          {field("Role summary", "summary", 3)}
          {field("Main duties and responsibilities (one per line)", "duties", 10)}
          <div className="grid gap-3 sm:grid-cols-3">
            {field("Reports to", "reports_to")}
            {field("Place of work", "place_of_work")}
            {field("Typical hours", "typical_hours")}
          </div>
          <label className="block text-xs text-ink-muted">
            Status
            <select
              value={editing.status ?? "draft"}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as JobRoleRow["status"] })}
              className="mt-1 block rounded-md border border-line bg-surface p-2 text-sm text-ink"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </label>
          <p className="text-xs text-ink-muted">
            A change here does not alter any contract already issued. Signed contracts keep their own copy of the role.
          </p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save}>
              Save
            </button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
