import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, LegalAuditLog, LegalDocumentDetail, LegalVersion } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canApproveLegal, canEditLegal } from "./legalAccess";

const PH_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function renderPlaceholders(body: string, vars: Record<string, any>) {
  return (body || "").replace(PH_RE, (m, key) => {
    const v = vars?.[key];
    if (v === undefined || v === null) return m;
    return String(v);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LegalDocumentDetailPage() {
  const { id } = useParams();
  const docId = Number(id);
  const locale = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const canEdit = canEditLegal(user);
  const canApprove = canApproveLegal(user);

  const [doc, setDoc] = useState<LegalDocumentDetail | null>(null);
  const [versions, setVersions] = useState<LegalVersion[]>([]);
  const [audit, setAudit] = useState<LegalAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "versions" | "approvals" | "comments" | "audit">("content");

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialEdit = qs.get("edit") === "1";
  const [editing, setEditing] = useState(initialEdit);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [content, setContent] = useState("");
  const [varsText, setVarsText] = useState("{}");

  const load = async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, v, a] = await Promise.all([
        api.getLegalDocument(docId),
        api.getLegalVersions(docId),
        api.getLegalAudit(docId),
      ]);
      setDoc(d);
      setVersions(v);
      setAudit(a);
      setTitle(d.title || "");
      setCounterpartyName(d.counterparty_name || "");
      setCounterpartyEmail(d.counterparty_email || "");
      setContent(d.content || "");
      setVarsText(JSON.stringify(d.variables || {}, null, 2));
    } catch (e: any) {
      setError(e?.message || "Failed to load document.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [docId]);

  const variablesObj = useMemo(() => {
    try {
      const v = JSON.parse(varsText || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }, [varsText]);

  const placeholders = useMemo(() => {
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = PH_RE.exec(content || ""))) {
      found.add(m[1]);
    }
    PH_RE.lastIndex = 0;
    return Array.from(found).sort();
  }, [content]);

  const preview = useMemo(() => renderPlaceholders(content, variablesObj), [content, variablesObj]);

  const canEditThis = useMemo(() => {
    if (!doc) return false;
    if (!canEdit) return false;
    return doc.status === "DRAFT" || doc.status === "CHANGES_REQUESTED";
  }, [doc, canEdit]);

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    setError(null);
    try {
      let variables: any = {};
      try {
        variables = JSON.parse(varsText || "{}");
      } catch {
        throw new Error("Variables must be valid JSON.");
      }
      const updated = await api.updateLegalDocument(doc.id, {
        title,
        counterparty_name: counterpartyName,
        counterparty_email: counterpartyEmail,
        content,
        variables,
      });
      setDoc((d) => (d ? { ...d, ...updated, approvals: d.approvals } : null));
      setEditing(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    if (!doc) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.submitLegalDocumentForReview(doc.id, {});
      setDoc(updated);
      await load();
    } catch (e: any) {
      setError(e?.message || "Submit for review failed.");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!doc) return;
    const comment = window.prompt("Approval comment (optional):") || undefined;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.approveLegalDocument(doc.id, { comment });
      setDoc(updated);
      await load();
    } catch (e: any) {
      setError(e?.message || "Approve failed.");
    } finally {
      setSaving(false);
    }
  };

  const requestChanges = async () => {
    if (!doc) return;
    const comment = window.prompt("What changes are needed? (optional):") || undefined;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.requestChangesLegalDocument(doc.id, { comment });
      setDoc(updated);
      await load();
    } catch (e: any) {
      setError(e?.message || "Request changes failed.");
    } finally {
      setSaving(false);
    }
  };

  const markSigned = async () => {
    if (!doc) return;
    const ok = window.confirm("Mark this document as signed?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await api.markSignedLegalDocument(doc.id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to mark signed.");
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!doc) return;
    const ok = window.confirm("Archive this document?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await api.archiveLegalDocument(doc.id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Archive failed.");
    } finally {
      setSaving(false);
    }
  };

  const exportDoc = async (format: "txt" | "pdf" | "docx") => {
    if (!doc) return;
    setSaving(true);
    setError(null);
    try {
      const { blob, filename } = await api.exportLegalDocument(doc.id, format);
      downloadBlob(blob, filename);
      await load();
    } catch (e: any) {
      setError(e?.message || "Export failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!docId) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">Not found</div>
          <div className="emptyText">Invalid document ID.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">Legal document</div>
            <div className="h2">{doc?.title || (loading ? "Loading…" : "Document")}</div>
            {doc && (
              <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                <span className={`pill ${doc.status === "APPROVED" || doc.status === "SIGNED" ? "" : "subtle"}`}>{doc.status}</span>
                <span className="pill subtle">{doc.type}</span>
                {doc.counterparty_name && <span className="pill subtle">{doc.counterparty_name}</span>}
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => navigate(`/${locale}/legal/documents`)} type="button">
              Back
            </button>

            {doc && canEditThis && (
              <button className="btn btnPrimary" onClick={() => setEditing((v) => !v)} disabled={saving} type="button">
                {editing ? "Cancel edit" : "Edit"}
              </button>
            )}

            {doc && canEditThis && (
              <button className="btn" onClick={submitForReview} disabled={saving} type="button">
                Submit for review
              </button>
            )}

            {doc && doc.status === "IN_REVIEW" && canApprove && (
              <>
                <button className="btn btnPrimary" onClick={approve} disabled={saving} type="button">
                  Approve
                </button>
                <button className="btn" onClick={requestChanges} disabled={saving} type="button">
                  Request changes
                </button>
              </>
            )}

            {doc && doc.status === "APPROVED" && canEdit && (
              <button className="btn btnPrimary" onClick={markSigned} disabled={saving} type="button">
                Mark as signed
              </button>
            )}

            {doc && (doc.status === "APPROVED" || doc.status === "SIGNED") && (
              <button className="btn" onClick={() => exportDoc("docx")} disabled={saving} type="button">
                Export
              </button>
            )}

            {doc && canEdit && doc.status !== "ARCHIVED" && (
              <button className="btn btnGhost" onClick={archive} disabled={saving} type="button">
                Archive
              </button>
            )}
          </div>
        </div>

        {error && <div className="errorBanner">{error}</div>}
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button className={`pill ${tab === "content" ? "" : "subtle"}`} onClick={() => setTab("content")} type="button">
          Content
        </button>
        <button className={`pill ${tab === "versions" ? "" : "subtle"}`} onClick={() => setTab("versions")} type="button">
          Versions
        </button>
        <button className={`pill ${tab === "approvals" ? "" : "subtle"}`} onClick={() => setTab("approvals")} type="button">
          Approvals
        </button>
        <button className={`pill ${tab === "comments" ? "" : "subtle"}`} onClick={() => setTab("comments")} type="button">
          Comments
        </button>
        <button className={`pill ${tab === "audit" ? "" : "subtle"}`} onClick={() => setTab("audit")} type="button">
          Audit log
        </button>
      </div>

      {tab === "content" && (
        <div className="card">
          <div className="cardHeader">
              <div>
                <div className="eyebrow">Content</div>
                <div className="h3">Draft + placeholders</div>
              <div className="muted">Use placeholders like {"{{client_name}}"} and keep variables as JSON.</div>
              </div>
            {doc && (
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button className="btn btnGhost" onClick={() => exportDoc("txt")} disabled={saving} type="button">
                  Download TXT
                </button>
                <button className="btn btnGhost" onClick={() => exportDoc("pdf")} disabled={saving} type="button">
                  Download PDF (stub)
                </button>
                <button className="btn btnGhost" onClick={() => exportDoc("docx")} disabled={saving} type="button">
                  Download DOCX (stub)
                </button>
              </div>
            )}
          </div>

          <div className="formGrid">
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <label className="fieldLabel">Title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editing} />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">Counterparty</label>
              <input className="input" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} disabled={!editing} />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">Counterparty email</label>
              <input className="input" value={counterpartyEmail} onChange={(e) => setCounterpartyEmail(e.target.value)} disabled={!editing} />
            </div>
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <label className="fieldLabel">Content</label>
              <textarea className="input" style={{ minHeight: 220 }} value={content} onChange={(e) => setContent(e.target.value)} disabled={!editing} />
            </div>
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <label className="fieldLabel">Variables (JSON)</label>
              <textarea className="input" style={{ minHeight: 160 }} value={varsText} onChange={(e) => setVarsText(e.target.value)} disabled={!editing} />
            </div>
            {editing && (
              <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                <button className="btn btnPrimary" onClick={save} disabled={saving} type="button">
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>

          <div className="cardSubsection">
            <div className="h3">Preview</div>
            {placeholders.length > 0 && (
              <div className="row" style={{ gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
                {placeholders.map((p) => (
                  <span key={p} className="pill subtle">
                    {p}
                  </span>
                ))}
              </div>
            )}
            <textarea className="input" style={{ minHeight: 220 }} value={preview} readOnly />
          </div>
        </div>
      )}

      {tab === "versions" && (
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">Versions</div>
              <div className="h3">Saved snapshots</div>
              <div className="muted">A new version is created on every save.</div>
            </div>
          </div>
          {versions.length === 0 ? (
            <div className="emptyState">
              <div className="emptyTitle">No versions</div>
              <div className="emptyText">Create or edit the document to generate versions.</div>
            </div>
          ) : (
            <div className="table">
              <div className="tableHead" style={{ gridTemplateColumns: "120px 1fr 140px" }}>
                <div>Version</div>
                <div>Created</div>
                <div>Actor</div>
              </div>
              <div className="tableBody">
                {versions.map((v) => (
                  <div key={v.id} className="tableRow" style={{ gridTemplateColumns: "120px 1fr 140px" }}>
                    <div>v{v.version_number}</div>
                    <div className="muted">{new Date(v.created_at).toLocaleString()}</div>
                    <div className="muted">{v.created_by ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "approvals" && (
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">Approvals</div>
              <div className="h3">Review steps</div>
              <div className="muted">Approvals are created when submitting for review.</div>
            </div>
          </div>
          {doc?.approvals?.length ? (
            <div className="table">
              <div className="tableHead" style={{ gridTemplateColumns: "90px 120px 140px 1fr" }}>
                <div>Step</div>
                <div>Approver</div>
                <div>Decision</div>
                <div>Comment</div>
              </div>
              <div className="tableBody">
                {doc.approvals.map((a) => (
                  <div key={a.id} className="tableRow" style={{ gridTemplateColumns: "90px 120px 140px 1fr" }}>
                    <div>#{a.step_number}</div>
                    <div className="muted">{a.approver_id}</div>
                    <div>
                      <span className={`pill ${a.decision === "APPROVED" ? "" : "subtle"}`}>{a.decision}</span>
                    </div>
                    <div className="muted">{a.comment || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="emptyState">
              <div className="emptyTitle">No approvals</div>
              <div className="emptyText">Submit the document for review to start an approval workflow.</div>
            </div>
          )}
        </div>
      )}

      {tab === "comments" && (
        <div className="card">
          <div className="emptyState">
            <div className="emptyTitle">Comments</div>
            <div className="emptyText">Comments UI is coming soon. Use “Request changes” for now.</div>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">Audit log</div>
              <div className="h3">Document history</div>
              <div className="muted">All key actions are tracked server-side.</div>
            </div>
            <button className="btn btnGhost" onClick={load} disabled={loading} type="button">
              Refresh
            </button>
          </div>
          {audit.length === 0 ? (
            <div className="emptyState">
              <div className="emptyTitle">No audit entries</div>
              <div className="emptyText">Create, edit, and workflow actions will show up here.</div>
            </div>
          ) : (
            <div className="table">
              <div className="tableHead" style={{ gridTemplateColumns: "1fr 120px 160px" }}>
                <div>Action</div>
                <div>Actor</div>
                <div>When</div>
              </div>
              <div className="tableBody">
                {audit.map((a) => (
                  <div key={a.id} className="tableRow" style={{ gridTemplateColumns: "1fr 120px 160px" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{a.action}</div>
                      {a.metadata && Object.keys(a.metadata).length > 0 && (
                        <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {JSON.stringify(a.metadata)}
                        </div>
                      )}
                    </div>
                    <div className="muted">{a.actor_id ?? "—"}</div>
                    <div className="muted">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
