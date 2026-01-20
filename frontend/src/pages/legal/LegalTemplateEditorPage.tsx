import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, LegalTemplate } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canManageLegalTemplates } from "./legalAccess";
import ChipEditor from "./components/ChipEditor";
import UserMultiSelect, { type UserRef } from "./components/UserMultiSelect";
import { type LegalExample } from "../../api/client";
import { canEditLegal } from "./legalAccess";

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function extractPlaceholders(body: string) {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(body || ""))) {
    found.add(m[1]);
  }
  PLACEHOLDER_RE.lastIndex = 0;
  return Array.from(found).sort();
}

export default function LegalTemplateEditorPage({
  mode,
  onToast,
}: {
  mode: "create" | "edit";
  onToast?: (msg: string, tone?: "info" | "danger" | "success") => void;
}) {
  const { user } = useAuth();
  const locale = useLocale();
  const navigate = useNavigate();
  const { id } = useParams();
  const { t: tLegal } = useTranslation("legal");

  const canAdmin = canManageLegalTemplates(user);
  const canUploadExamples = canEditLegal(user);
  const templateId = mode === "edit" ? Number(id) : null;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<LegalTemplate | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [body, setBody] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [approverIds, setApproverIds] = useState<number[]>([]);

  const [users, setUsers] = useState<UserRef[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [examples, setExamples] = useState<LegalExample[]>([]);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [exampleFiles, setExampleFiles] = useState<File[]>([]);
  const [exampleType, setExampleType] = useState("");
  const [exampleUploading, setExampleUploading] = useState(false);

  const discovered = useMemo(() => extractPlaceholders(body), [body]);

  const loadTemplate = async () => {
    if (mode !== "edit" || !templateId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLegalTemplate(templateId);
      setTemplate(res);
      setName(res.name || "");
      setType(res.type || "");
      setBody(res.body || "");
      setVariables(Array.isArray(res.variables) ? (res.variables as any[]).map(String) : []);
      setApproverIds(Array.isArray(res.default_approvers) ? res.default_approvers : []);
    } catch (e: any) {
      setError(e?.message || tLegal("templateEditor.errors.failedToLoad"));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!canAdmin) return;
    setUsersLoading(true);
    try {
      const res = await api.listLegalUsers();
      setUsers(res);
    } catch {
      // ignore; keep empty
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate();
    loadUsers();
    if (templateId) loadExamples(templateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, canAdmin]);

  const loadExamples = async (tid: number) => {
    setExamplesLoading(true);
    try {
      const res = await api.listTemplateExamples(tid);
      setExamples(res);
    } catch {
      setExamples([]);
    } finally {
      setExamplesLoading(false);
    }
  };

  if (!canAdmin) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">{tLegal("templateEditor.noAccess.title")}</div>
          <div className="emptyText">{tLegal("templateEditor.noAccess.text")}</div>
        </div>
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim() || !type.trim() || !body.trim()) {
        const msg = tLegal("templateEditor.errors.requiredFields");
        setError(msg);
        onToast?.(msg, "danger");
        setSaving(false);
        return;
      }
      const payload = {
        name: name.trim(),
        type: type.trim(),
        body: body,
        variables,
        default_approvers: approverIds,
      };

      if (mode === "edit" && templateId) {
        const updated = await api.updateLegalTemplate(templateId, payload);
        setTemplate(updated);
        onToast?.(tLegal("templateEditor.toast.saved"), "success");
      } else {
        const created = await api.createLegalTemplate(payload as any);
        onToast?.(tLegal("templateEditor.toast.created"), "success");
        navigate(`/${locale}/legal/templates/${created.id}`);
      }
    } catch (e: any) {
      setError(e?.message || tLegal("templateEditor.errors.failedToSave"));
      onToast?.(e?.message || tLegal("templateEditor.errors.failedToSave"), "danger");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (mode !== "edit" || !templateId) return;
    const ok = window.confirm(tLegal("templateEditor.confirmDelete", { name }));
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteLegalTemplate(templateId);
      onToast?.(tLegal("templateEditor.toast.deleted"), "success");
      navigate(`/${locale}/legal/templates`);
    } catch (e: any) {
      setError(e?.message || tLegal("templateEditor.errors.failedToDelete"));
      onToast?.(e?.message || tLegal("templateEditor.errors.failedToDelete"), "danger");
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (mode !== "edit" || !template) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createLegalTemplate({
        name: `${template.name} (${tLegal("templates.actions.copySuffix")})`,
        type: template.type,
        body: template.body,
        variables: Array.isArray(template.variables) ? template.variables : [],
        default_approvers: template.default_approvers || [],
      });
      onToast?.(tLegal("templates.toast.duplicated"), "success");
      navigate(`/${locale}/legal/templates/${created.id}`);
    } catch (e: any) {
      setError(e?.message || tLegal("templates.errors.failedToDuplicate"));
      onToast?.(e?.message || tLegal("templates.errors.failedToDuplicate"), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tLegal("templateEditor.eyebrow")}</div>
            <div className="h3">
              {mode === "edit" ? tLegal("templateEditor.titleEdit") : tLegal("templateEditor.titleCreate")}
            </div>
            <div className="muted">{tLegal("templateEditor.subtitle")}</div>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => navigate(`/${locale}/legal/templates`)} type="button">
              {tLegal("templateEditor.actions.backToList")}
            </button>
            {mode === "edit" && (
              <button className="btn btnGhost" onClick={duplicate} disabled={saving} type="button">
                {tLegal("templates.actions.duplicate")}
              </button>
            )}
            {mode === "edit" && (
              <button className="btn btnGhost" onClick={del} disabled={saving} type="button">
                {tLegal("templateEditor.actions.delete")}
              </button>
            )}
            <button className="btn btnPrimary" onClick={save} disabled={saving || loading} type="button">
              {saving ? tLegal("templateEditor.actions.saving") : tLegal("templateEditor.actions.save")}
            </button>
          </div>
        </div>

        {error && <div className="errorBanner">{error}</div>}

        <div className="formGrid">
          <div className="formGroup">
            <label className="fieldLabel">{tLegal("templateEditor.fields.name")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={loading || saving} />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">{tLegal("templateEditor.fields.type")}</label>
            <input className="input" value={type} onChange={(e) => setType(e.target.value)} disabled={loading || saving} />
          </div>

          <ChipEditor
            label={tLegal("templateEditor.fields.variables")}
            value={variables}
            onChange={setVariables}
            placeholder={tLegal("templateEditor.fields.variablesPlaceholder")}
            suggestions={discovered}
            removeAriaLabel={(key) => tLegal("templateEditor.actions.removeVar", { key })}
            addPrefix={tLegal("templateEditor.actions.addPrefix")}
          />

          <UserMultiSelect
            label={tLegal("templateEditor.fields.approvers")}
            users={users}
            value={approverIds}
            onChange={setApproverIds}
            disabled={usersLoading || loading || saving}
            placeholder={tLegal("templateEditor.fields.approversPlaceholder")}
            emptyText={tLegal("templateEditor.users.empty")}
            noMatchesText={tLegal("templateEditor.users.noMatches")}
          />

          <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
            <label className="fieldLabel">{tLegal("templateEditor.fields.body")}</label>
            <textarea
              className="input"
              style={{ minHeight: 260 }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={loading || saving}
              placeholder={tLegal("templateEditor.fields.bodyPlaceholder", { example: "{{client_name}}" })}
            />
            {discovered.length > 0 && (
              <div className="muted" style={{ marginTop: 8 }}>
                {tLegal("templateEditor.discoveredVars", { count: discovered.length })}
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === "edit" && templateId && (
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tLegal("templateExamples.eyebrow")}</div>
              <div className="h3">{tLegal("templateExamples.title")}</div>
              <div className="muted">{tLegal("templateExamples.subtitle")}</div>
            </div>
            <button className="btn btnGhost" onClick={() => loadExamples(templateId)} disabled={examplesLoading} type="button">
              {tLegal("templateExamples.actions.refresh")}
            </button>
          </div>

          {canUploadExamples && (
            <div className="cardSubsection">
              <div className="formGrid">
                <div className="formGroup">
                  <label className="fieldLabel">{tLegal("templateExamples.upload.documentType")}</label>
                  <input
                    className="input"
                    value={exampleType}
                    onChange={(e) => setExampleType(e.target.value)}
                    placeholder={type || tLegal("templateExamples.upload.typePlaceholder")}
                  />
                </div>
                <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                  <label className="fieldLabel">{tLegal("templateExamples.upload.files")}</label>
                  <input
                    className="input"
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.md"
                    onChange={(e) => setExampleFiles(Array.from(e.target.files || []))}
                  />
                </div>
                <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                  <button
                    className="btn btnPrimary"
                    disabled={exampleUploading || !exampleFiles.length}
                    onClick={async () => {
                      setExampleUploading(true);
                      try {
                        await api.uploadLegalExamples({
                          files: exampleFiles,
                          document_type: (exampleType || type || "Contract").trim(),
                          template_id: templateId,
                          scope: "TEMPLATE",
                        });
                        onToast?.(tLegal("templateExamples.toast.uploaded"), "success");
                        setExampleFiles([]);
                        setExampleType("");
                        await loadExamples(templateId);
                      } catch (e: any) {
                        onToast?.(e?.message || tLegal("templateExamples.errors.failedToUpload"), "danger");
                      } finally {
                        setExampleUploading(false);
                      }
                    }}
                    type="button"
                  >
                    {exampleUploading ? tLegal("templateExamples.upload.uploading") : tLegal("templateExamples.upload.upload")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!examplesLoading && examples.length === 0 && (
            <div className="emptyState">
              <div className="emptyTitle">{tLegal("templateExamples.empty.title")}</div>
              <div className="emptyText">{tLegal("templateExamples.empty.text")}</div>
            </div>
          )}

          {examples.length > 0 && (
            <div className="table">
              <div className="tableHead" style={{ gridTemplateColumns: "1fr 0.6fr 0.6fr 0.9fr auto" }}>
                <div>{tLegal("templateExamples.table.file")}</div>
                <div>{tLegal("templateExamples.table.type")}</div>
                <div>{tLegal("templateExamples.table.status")}</div>
                <div>{tLegal("templateExamples.table.uploaded")}</div>
                <div />
              </div>
              <div className="tableBody">
                {examples.map((ex) => (
                  <div key={ex.id} className="tableRow" style={{ gridTemplateColumns: "1fr 0.6fr 0.6fr 0.9fr auto" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{ex.title}</div>
                      <div className="muted">{ex.file_name}</div>
                    </div>
                    <div className="muted">{ex.document_type}</div>
                    <div>
                      <span className={`pill ${ex.status === "READY" ? "" : "subtle"}`}>{ex.status}</span>
                      {ex.status === "FAILED" && ex.error_message && <div className="muted">{ex.error_message}</div>}
                    </div>
                    <div className="muted">{new Date(ex.uploaded_at).toLocaleString()}</div>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button
                        className="btn btnGhost"
                        onClick={async () => {
                          const { blob, filename } = await api.downloadLegalExample(ex.id);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = filename;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        type="button"
                      >
                        {tLegal("templateExamples.actions.download")}
                      </button>
                      {ex.status === "FAILED" && canUploadExamples && (
                        <button className="btn btnGhost" onClick={() => api.retryLegalExample(ex.id).then(() => loadExamples(templateId))} type="button">
                          {tLegal("templateExamples.actions.retry")}
                        </button>
                      )}
                      <button
                        className="btn btnGhost"
                        onClick={async () => {
                          const nextTitle = window.prompt(tLegal("templateExamples.promptRename"), ex.title);
                          if (!nextTitle || !nextTitle.trim()) return;
                          await api.updateLegalExample(ex.id, { title: nextTitle.trim() });
                          await loadExamples(templateId);
                          onToast?.(tLegal("templateExamples.toast.renamed"), "success");
                        }}
                        type="button"
                      >
                        {tLegal("templateExamples.actions.rename")}
                      </button>
                      <button
                        className="btn btnGhost"
                        onClick={async () => {
                          await api.updateLegalExample(ex.id, { template_id: null });
                          await loadExamples(templateId);
                          onToast?.(tLegal("templateExamples.toast.detached"), "success");
                        }}
                        type="button"
                      >
                        {tLegal("templateExamples.actions.detach")}
                      </button>
                      <button
                        className="btn btnGhost"
                        onClick={async () => {
                          const ok = window.confirm(tLegal("templateExamples.confirmDelete", { name: ex.title }));
                          if (!ok) return;
                          await api.deleteLegalExample(ex.id);
                          await loadExamples(templateId);
                          onToast?.(tLegal("templateExamples.toast.deleted"), "success");
                        }}
                        type="button"
                      >
                        {tLegal("templateExamples.actions.delete")}
                      </button>
                    </div>
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
