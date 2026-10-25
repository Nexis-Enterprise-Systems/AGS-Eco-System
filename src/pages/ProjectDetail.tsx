import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useTable } from "../hooks/useTable";
import type {
  AuditDocument,
  Client,
  Project,
  ProjectStage,
  ProjectSubContractor,
  SubContractor,
} from "../lib/types";

const STAGES: ProjectStage[] = [
  "discovery",
  "audit",
  "proposal",
  "agreement",
  "build",
  "rollout",
  "retainer",
  "complete",
  "on_hold",
];

const DOC_TYPES: AuditDocument["doc_type"][] = ["audit_export", "findings", "proposal", "agreement", "other"];

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isStaff = profile?.role === "admin" || profile?.role === "staff";

  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "team" | "documents">("overview");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single()
      .then(async ({ data }) => {
        const p = (data as Project) ?? null;
        setProject(p);
        if (p) {
          const { data: c } = await supabase.from("clients").select("*").eq("id", p.client_id).single();
          setClient((c as Client) ?? null);
        }
        setLoading(false);
      });
  }, [id]);

  async function updateStage(stage: ProjectStage) {
    if (!id) return;
    const { data } = await supabase.from("projects").update({ stage }).eq("id", id).select().single();
    setProject((data as Project) ?? null);
  }

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;
  if (!project) return <div className="text-sm text-ink-muted">Project not found.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        subtitle={client?.name}
        back={{ label: "Back to Projects", onClick: () => navigate("/projects") }}
        actions={
          isStaff ? (
            <select className="input w-48" value={project.stage} onChange={(e) => updateStage(e.target.value as ProjectStage)}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
          ) : null
        }
      />

      <div className="flex gap-1 border-b border-line">
        {(["overview", "team", "documents"] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-b-2 border-brand-primary text-brand-primary" : "text-ink-muted"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab project={project} />}
      {tab === "team" && <TeamTab projectId={project.id} isStaff={isStaff} />}
      {tab === "documents" && <DocumentsTab projectId={project.id} isStaff={isStaff} />}
    </div>
  );
}

function OverviewTab({ project }: { project: Project }) {
  return (
    <section className="card grid gap-4 p-6 text-sm sm:grid-cols-2">
      <InfoRow label="Start date" value={project.start_date} />
      <InfoRow label="Target end date" value={project.target_end_date} />
      <InfoRow label="Build fee" value={project.build_fee ? `${project.currency} ${project.build_fee.toLocaleString()}` : null} />
      <InfoRow label="Monthly retainer" value={project.monthly_retainer ? `${project.currency} ${project.monthly_retainer.toLocaleString()}` : null} />
      {project.description && (
        <div className="sm:col-span-2">
          <div className="label">Description</div>
          <p>{project.description}</p>
        </div>
      )}
      {project.notes && (
        <div className="sm:col-span-2">
          <div className="label">Notes</div>
          <p>{project.notes}</p>
        </div>
      )}
    </section>
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

// -------------------------------------------------------------------
// Team tab — assign sub-contractors to this project. This is what
// scopes their access: RLS on clients/projects only lets a
// sub-contractor see rows tied to a project they're assigned to here.
// -------------------------------------------------------------------
function TeamTab({ projectId, isStaff }: { projectId: string; isStaff: boolean }) {
  const { rows: subContractors } = useTable<SubContractor>("sub_contractors");
  const [assignments, setAssignments] = useState<ProjectSubContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState("");

  async function refresh() {
    setLoading(true);
    const { data } = await supabase.from("project_subcontractors").select("*").eq("project_id", projectId);
    setAssignments((data as ProjectSubContractor[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleAssign() {
    if (!selected) return;
    await supabase.from("project_subcontractors").insert({
      project_id: projectId,
      sub_contractor_id: selected,
      role_on_project: role || null,
    });
    setSelected("");
    setRole("");
    await refresh();
  }

  async function handleUnassign(subContractorId: string) {
    await supabase.from("project_subcontractors").delete().eq("project_id", projectId).eq("sub_contractor_id", subContractorId);
    await refresh();
  }

  const assignedContractors = assignments
    .map((a) => ({ assignment: a, sc: subContractors.find((s) => s.id === a.sub_contractor_id) }))
    .filter((row) => row.sc);

  const unassigned = subContractors.filter((s) => !assignments.some((a) => a.sub_contractor_id === s.id));

  return (
    <section className="space-y-4">
      <div className="card divide-y divide-black/5">
        {loading ? (
          <div className="p-4 text-sm text-ink-muted">Loading…</div>
        ) : assignedContractors.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-muted">No sub-contractors assigned to this project yet.</div>
        ) : (
          assignedContractors.map(({ assignment, sc }) => (
            <div key={assignment.sub_contractor_id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{sc!.name}</div>
                <div className="text-xs text-ink-muted">{assignment.role_on_project || sc!.specialty || "—"}</div>
              </div>
              {isStaff && (
                <button className="text-xs text-red-600 dark:text-red-400 hover:underline" onClick={() => handleUnassign(sc!.id)}>
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {isStaff && unassigned.length > 0 && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label">Assign sub-contractor</label>
            <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select…</option>
              {unassigned.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Role on this project</label>
            <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Lead developer" />
          </div>
          <button className="btn-primary" onClick={handleAssign}>
            Assign
          </button>
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------------
// Documents tab — durable audit-reference material for this project
// (audit export, findings doc, proposal, agreement). Internal only —
// staff/admin, never surfaced to clients or sub-contractors.
// -------------------------------------------------------------------
function DocumentsTab({ projectId, isStaff }: { projectId: string; isStaff: boolean }) {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<AuditDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<AuditDocument["doc_type"]>("audit_export");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase
      .from("audit_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false });
    setDocs((data as AuditDocument[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    const path = `${projectId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("audit-documents").upload(path, file);
    if (uploadErr) {
      setError(uploadErr.message);
      setUploading(false);
      return;
    }
    const { error: insertErr } = await supabase.from("audit_documents").insert({
      project_id: projectId,
      file_name: file.name,
      storage_path: path,
      doc_type: docType,
      uploaded_by: profile?.id,
    });
    if (insertErr) setError(insertErr.message);
    setUploading(false);
    await refresh();
  }

  async function handleDownload(doc: AuditDocument) {
    const { data, error: err } = await supabase.storage.from("audit-documents").createSignedUrl(doc.storage_path, 60);
    if (!err && data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(doc: AuditDocument) {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    await supabase.storage.from("audit-documents").remove([doc.storage_path]);
    await supabase.from("audit_documents").delete().eq("id", doc.id);
    await refresh();
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-ink-muted">
        Reference material from the audit that led to this project — kept here for the build team, not shown to the
        client or sub-contractors.
      </p>

      {isStaff && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label">Document type</label>
            <select className="input" value={docType} onChange={(e) => setDocType(e.target.value as AuditDocument["doc_type"])}>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Upload file</label>
            <input type="file" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="card divide-y divide-black/5">
        {loading ? (
          <div className="p-4 text-sm text-ink-muted">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-muted">No documents uploaded for this project yet.</div>
        ) : (
          docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{doc.file_name}</div>
                <div className="text-xs capitalize text-ink-muted">
                  {doc.doc_type.replace("_", " ")} · {new Date(doc.uploaded_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-3">
                <button className="text-xs text-brand-primary hover:underline" onClick={() => handleDownload(doc)}>
                  Download
                </button>
                {isStaff && (
                  <button className="text-xs text-red-600 dark:text-red-400 hover:underline" onClick={() => handleDelete(doc)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
