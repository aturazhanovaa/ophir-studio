import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LegalDocument, LegalDocumentStatus } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canEditLegal } from "./legalAccess";

const STATUS_OPTIONS: Array<{ value: "" | LegalDocumentStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "CHANGES_REQUESTED", label: "Changes Requested" },
  { value: "APPROVED", label: "Approved" },
  { value: "SIGNED", label: "Signed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LegalDocumentsPage() {
  const { user } = useAuth();
  const locale = useLocale();
  const navigate = useNavigate();
  const location = useLocation();

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialQ = qs.get("q") || "";

  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<"" | LegalDocumentStatus>("");
  const [type, setType] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [sort, setSort] = useState<"updated" | "expiry">("updated");

  const canEdit = canEditLegal(user);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listLegalDocuments({
        q: q.trim() || undefined,
        status: status || undefined,
        type: type.trim() || undefined,
        counterparty: counterparty.trim() || undefined,
        sort,
      });
      setDocs(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load legal documents.");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q, status, type, counterparty, sort]);

  useEffect(() => {
    if (initialQ !== q) setQ(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  const types = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((d) => {
      if (d.type) set.add(d.type);
    });
    return Array.from(set).sort();
  }, [docs]);

  const handleExport = async (doc: LegalDocument, format: "txt" | "pdf" | "docx") => {
    try {
      const { blob, filename } = await api.exportLegalDocument(doc.id, format);
      downloadBlob(blob, filename);
    } catch (e: any) {
      setError(e?.message || "Export failed.");
    }
  };

  const handleArchive = async (doc: LegalDocument) => {
    if (!canEdit) return;
    const ok = window.confirm(`Archive “${doc.title}”?`);
    if (!ok) return;
    try {
      await api.archiveLegalDocument(doc.id);
      await load();
    } catch (e: any) {
      setError(e?.message || "Archive failed.");
    }
  };

  const handleSubmitReview = async (doc: LegalDocument) => {
    if (!canEdit) return;
    try {
      await api.submitLegalDocumentForReview(doc.id, {});
      await load();
    } catch (e: any) {
      setError(e?.message || "Submit for review failed.");
    }
  };

  const handleDuplicate = async (doc: LegalDocument) => {
    if (!canEdit) return;
    try {
      const created = await api.duplicateLegalDocument(doc.id);
      navigate(`/${locale}/legal/documents/${created.id}?edit=1`);
    } catch (e: any) {
      setError(e?.message || "Duplicate failed.");
    }
  };

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">Documents</div>
            <div className="h3">All legal documents</div>
            <div className="muted">Filter by status, type, and counterparty.</div>
          </div>
          {canEdit && (
            <button className="btn btnPrimary" onClick={() => navigate(`/${locale}/legal/documents/new`)} type="button">
              New document
            </button>
          )}
        </div>

        <div className="formGrid">
          <div className="formGroup">
            <label className="fieldLabel">Search</label>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, counterparty, owner email…" />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">Status</label>
            <select className="input select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "ALL"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="formGroup">
            <label className="fieldLabel">Type</label>
            <input className="input" value={type} onChange={(e) => setType(e.target.value)} placeholder={types.length ? `e.g. ${types[0]}` : "e.g. MSA"} />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">Counterparty</label>
            <input className="input" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Company / client name" />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">Sort</label>
            <select className="input select" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="updated">Last updated</option>
              <option value="expiry">Expiry date</option>
            </select>
          </div>
          <div className="formGroup" style={{ alignSelf: "end" }}>
            <button className="btn" onClick={load} disabled={loading} type="button">
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="errorBanner">{error}</div>}
      </div>

      {!loading && docs.length === 0 && (
        <div className="card">
          <div className="emptyState">
            <div className="emptyTitle">No documents</div>
            <div className="emptyText">{canEdit ? "Create your first legal document to get started." : "No legal documents are available."}</div>
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div className="card">
          <div className="table">
            <div className="tableHead" style={{ gridTemplateColumns: "1.2fr 0.8fr 0.9fr 0.6fr 0.8fr 0.8fr auto" }}>
              <div>Title</div>
              <div>Type</div>
              <div>Counterparty</div>
              <div>Status</div>
              <div>Owner</div>
              <div>Updated</div>
              <div />
            </div>
            <div className="tableBody">
              {docs.map((d) => (
                <div key={d.id} className="tableRow" style={{ gridTemplateColumns: "1.2fr 0.8fr 0.9fr 0.6fr 0.8fr 0.8fr auto" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{d.title}</div>
                    {d.expiry_date && <div className="muted">Expiry: {new Date(d.expiry_date).toLocaleDateString()}</div>}
                  </div>
                  <div className="muted">{d.type}</div>
                  <div className="muted">{d.counterparty_name || "—"}</div>
                  <div>
                    <span className={`pill ${d.status === "APPROVED" || d.status === "SIGNED" ? "" : "subtle"}`}>{d.status}</span>
                  </div>
                  <div className="muted">{d.owner_name || d.owner_email || `#${d.owner_id}`}</div>
                  <div className="muted">{new Date(d.updated_at).toLocaleString()}</div>
                  <div style={{ textAlign: "right" }} className="row">
                    <button className="btn btnGhost" onClick={() => navigate(`/${locale}/legal/documents/${d.id}`)} type="button">
                      View
                    </button>
                    {canEdit && (d.status === "DRAFT" || d.status === "CHANGES_REQUESTED") && (
                      <button className="btn btnGhost" onClick={() => navigate(`/${locale}/legal/documents/${d.id}?edit=1`)} type="button">
                        Edit
                      </button>
                    )}
                    {canEdit && (
                      <button className="btn btnGhost" onClick={() => handleDuplicate(d)} type="button">
                        Duplicate
                      </button>
                    )}
                    {canEdit && (d.status === "DRAFT" || d.status === "CHANGES_REQUESTED") && (
                      <button className="btn btnGhost" onClick={() => handleSubmitReview(d)} type="button">
                        Submit
                      </button>
                    )}
                    <button className="btn btnGhost" onClick={() => handleExport(d, "docx")} type="button">
                      Download
                    </button>
                    {canEdit && d.status !== "ARCHIVED" && (
                      <button className="btn btnGhost" onClick={() => handleArchive(d)} type="button">
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

