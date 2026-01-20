import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, LegalExample, LegalExampleStatus, LegalTemplate } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canEditLegal } from "./legalAccess";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LegalExamplesPage({ onToast }: { onToast?: (msg: string, tone?: "info" | "danger" | "success") => void }) {
  const { user } = useAuth();
  const locale = useLocale();
  const navigate = useNavigate();
  const { t: tLegal } = useTranslation("legal");
  const { t: tCommon } = useTranslation("common");

  const canUpload = canEditLegal(user);
  const canDelete = user?.role === "LEGAL_ADMIN" || user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState<LegalExample[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState<"" | LegalExampleStatus>("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [templates, setTemplates] = useState<LegalTemplate[]>([]);

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadType, setUploadType] = useState("Contract");
  const [uploading, setUploading] = useState(false);

  const loadTemplates = async () => {
    try {
      const res = await api.listLegalTemplates();
      setTemplates(res);
    } catch {
      setTemplates([]);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listLegalExamples({
        q: q.trim() || undefined,
        document_type: type.trim() || undefined,
        status: status || undefined,
        template_id: templateId === "" ? undefined : templateId,
        limit: 100,
        offset: 0,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      setError(e?.message || tLegal("examples.errors.failedToLoad"));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    load();
  }, [q, type, status, templateId]);

  const types = useMemo(() => Array.from(new Set(items.map((i) => i.document_type).filter(Boolean))).sort(), [items]);
  const templateNameById = useMemo(() => new Map(templates.map((t) => [t.id, t.name])), [templates]);

  const doUpload = async () => {
    if (!canUpload) return;
    if (!uploadFiles.length) {
      setError(tLegal("examples.errors.pickFiles"));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await api.uploadLegalExamples({ files: uploadFiles, document_type: uploadType });
      onToast?.(tLegal("examples.toast.uploaded"), "success");
      setUploadFiles([]);
      await load();
    } catch (e: any) {
      const msg = e?.message || tLegal("examples.errors.failedToUpload");
      setError(msg);
      onToast?.(msg, "danger");
    } finally {
      setUploading(false);
    }
  };

  const download = async (ex: LegalExample) => {
    try {
      const { blob, filename } = await api.downloadLegalExample(ex.id);
      downloadBlob(blob, filename);
    } catch (e: any) {
      onToast?.(e?.message || tLegal("examples.errors.failedToDownload"), "danger");
    }
  };

  const retry = async (ex: LegalExample) => {
    try {
      await api.retryLegalExample(ex.id);
      onToast?.(tLegal("examples.toast.retryQueued"), "success");
      await load();
    } catch (e: any) {
      onToast?.(e?.message || tLegal("examples.errors.failedToRetry"), "danger");
    }
  };

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tLegal("examples.eyebrow")}</div>
            <div className="h3">{tLegal("examples.title")}</div>
            <div className="muted">{tLegal("examples.subtitle")}</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btnGhost" onClick={load} disabled={loading} type="button">
              {tCommon("actions.reload")}
            </button>
          </div>
        </div>

        <div className="formGrid">
          <div className="formGroup">
            <label className="fieldLabel">{tLegal("examples.filters.search")}</label>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tLegal("examples.filters.searchPlaceholder")} />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">{tLegal("examples.filters.type")}</label>
            <input className="input" value={type} onChange={(e) => setType(e.target.value)} placeholder={types[0] ? `e.g. ${types[0]}` : "e.g. NDA"} />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">{tLegal("examples.filters.template")}</label>
            <select className="input select" value={String(templateId)} onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{tLegal("examples.filters.allTemplates")}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="formGroup">
            <label className="fieldLabel">{tLegal("examples.filters.status")}</label>
            <select className="input select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="">{tLegal("examples.filters.allStatuses")}</option>
              <option value="READY">READY</option>
              <option value="EXTRACTING">EXTRACTING</option>
              <option value="FAILED">FAILED</option>
              <option value="UPLOADED">UPLOADED</option>
            </select>
          </div>
        </div>

        {canUpload && (
          <div className="cardSubsection">
            <div className="h3">{tLegal("examples.upload.title")}</div>
            <div className="muted">{tLegal("examples.upload.subtitle")}</div>
            <div className="formGrid" style={{ marginTop: 10 }}>
              <div className="formGroup">
                <label className="fieldLabel">{tLegal("examples.upload.documentType")}</label>
                <input className="input" value={uploadType} onChange={(e) => setUploadType(e.target.value)} />
              </div>
              <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                <label className="fieldLabel">{tLegal("examples.upload.files")}</label>
                <input
                  className="input"
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                />
              </div>
              <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                <button className="btn btnPrimary" onClick={doUpload} disabled={uploading} type="button">
                  {uploading ? tLegal("examples.upload.uploading") : tLegal("examples.upload.upload")}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="errorBanner">{error}</div>}
      </div>

      {!loading && items.length === 0 && (
        <div className="card">
          <div className="emptyState">
            <div className="emptyTitle">{tLegal("examples.empty.title")}</div>
            <div className="emptyText">{tLegal("examples.empty.text")}</div>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="muted" style={{ marginBottom: 8 }}>
            {tLegal("examples.table.count", { count: total })}
          </div>
          <div className="table">
            <div className="tableHead" style={{ gridTemplateColumns: "1fr 0.6fr 0.7fr 0.6fr 0.8fr 0.9fr auto" }}>
              <div>{tLegal("examples.table.title")}</div>
              <div>{tLegal("examples.table.type")}</div>
              <div>{tLegal("examples.table.template")}</div>
              <div>{tLegal("examples.table.status")}</div>
              <div>{tLegal("examples.table.uploadedBy")}</div>
              <div>{tLegal("examples.table.updated")}</div>
              <div />
            </div>
            <div className="tableBody">
              {items.map((ex) => (
                <div key={ex.id} className="tableRow" style={{ gridTemplateColumns: "1fr 0.6fr 0.7fr 0.6fr 0.8fr 0.9fr auto" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{ex.title}</div>
                    <div className="muted">{ex.file_name} • {(ex.file_size / (1024 * 1024)).toFixed(1)}MB</div>
                  </div>
                  <div className="muted">{ex.document_type}</div>
                  <div>
                    {ex.template_id ? (
                      <button className="btn btnGhost" onClick={() => navigate(`/${locale}/legal/templates/${ex.template_id}`)} type="button">
                        {templateNameById.get(ex.template_id) || `#${ex.template_id}`}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                  <div>
                    <span className={`pill ${ex.status === "READY" ? "" : "subtle"}`}>{ex.status}</span>
                    {ex.status === "FAILED" && ex.error_message && <div className="muted">{ex.error_message}</div>}
                  </div>
                  <div className="muted">{ex.uploaded_by_name || ex.uploaded_by_email || `#${ex.uploaded_by}`}</div>
                  <div className="muted">{new Date(ex.updated_at).toLocaleString()}</div>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button className="btn btnGhost" onClick={() => download(ex)} type="button">
                      {tCommon("actions.download")}
                    </button>
                    {ex.status === "FAILED" && canUpload && (
                      <button className="btn btnGhost" onClick={() => retry(ex)} type="button">
                        {tLegal("examples.actions.retry")}
                      </button>
                    )}
                    {canUpload && (
                      <button
                        className="btn btnGhost"
                        onClick={async () => {
                          const nextTitle = window.prompt(tLegal("examples.promptRename"), ex.title);
                          if (!nextTitle || !nextTitle.trim()) return;
                          await api.updateLegalExample(ex.id, { title: nextTitle.trim() });
                          onToast?.(tLegal("examples.toast.renamed"), "success");
                          await load();
                        }}
                        type="button"
                      >
                        {tLegal("examples.actions.rename")}
                      </button>
                    )}
                    {canUpload && (
                      <button
                        className="btn btnGhost"
                        onClick={async () => {
                          const val = window.prompt(tLegal("examples.promptAttachTemplate"), ex.template_id ? String(ex.template_id) : "");
                          if (val === null) return;
                          const next = val.trim() ? Number(val.trim()) : null;
                          if (val.trim() && !Number.isFinite(next)) return;
                          await api.updateLegalExample(ex.id, { template_id: next as any });
                          onToast?.(tLegal("examples.toast.updated"), "success");
                          await load();
                        }}
                        type="button"
                      >
                        {tLegal("examples.actions.attachDetach")}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="btn btnGhost"
                        onClick={async () => {
                          const ok = window.confirm(tLegal("examples.confirmDelete", { name: ex.title }));
                          if (!ok) return;
                          await api.deleteLegalExample(ex.id);
                          onToast?.(tLegal("examples.toast.deleted"), "success");
                          await load();
                        }}
                        type="button"
                      >
                        {tLegal("examples.actions.delete")}
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
