import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LegalExample, LegalTemplate } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canEditLegal } from "./legalAccess";
import { useTranslation } from "react-i18next";

type KV = { key: string; value: string };

function kvToObject(items: KV[]) {
  const out: Record<string, any> = {};
  items.forEach((kv) => {
    const k = kv.key.trim();
    if (!k) return;
    out[k] = kv.value;
  });
  return out;
}

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

export default function LegalNewDocumentPage({
  onToast,
}: {
  onToast?: (msg: string, tone?: "info" | "danger" | "success") => void;
}) {
  const { user } = useAuth();
  const locale = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const canEdit = canEditLegal(user);
  const { t: tLegal } = useTranslation("legal");
  const { t: tCommon } = useTranslation("common");

  const [mode, setMode] = useState<"template" | "blank">("template");
  const [templates, setTemplates] = useState<LegalTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string>("");
  const [usedExampleIds, setUsedExampleIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateTypeFilter, setTemplateTypeFilter] = useState("");
  const [exampleOptions, setExampleOptions] = useState<LegalExample[]>([]);
  const [selectedExampleIds, setSelectedExampleIds] = useState<string[]>([]);

  // Blank doc state
  const [blankType, setBlankType] = useState(tLegal("newDoc.blank.defaultType"));
  const [blankCounterparty, setBlankCounterparty] = useState("");
  const [blankEmail, setBlankEmail] = useState("");
  const [blankDue, setBlankDue] = useState("");
  const [blankExpiry, setBlankExpiry] = useState("");
  const [blankContent, setBlankContent] = useState("");
  const [blankVars, setBlankVars] = useState<KV[]>([{ key: "client_name", value: "" }]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId]
  );

  const loadExampleOptions = async (tid: number) => {
    try {
      const [linked, global] = await Promise.all([
        api.listTemplateExamples(tid),
        api.listLegalExamples({ status: "READY", scope: "GLOBAL", limit: 200, offset: 0 }).then((r) => r.items),
      ]);
      const merged: LegalExample[] = [];
      const seen = new Set<string>();
      linked.forEach((e) => {
        if (seen.has(e.id)) return;
        seen.add(e.id);
        merged.push(e);
      });
      global.forEach((e) => {
        if (seen.has(e.id)) return;
        seen.add(e.id);
        merged.push(e);
      });
      setExampleOptions(merged.filter((e) => e.status === "READY"));
      setSelectedExampleIds(linked.filter((e) => e.status === "READY").map((e) => e.id));
    } catch {
      setExampleOptions([]);
      setSelectedExampleIds([]);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.listLegalTemplates();
      setTemplates(res);
      const qs = new URLSearchParams(location.search);
      const fromUrl = qs.get("template");
      const parsed = fromUrl ? Number(fromUrl) : null;
      if (res.length && parsed && res.some((t) => t.id === parsed)) {
        setTemplateId(parsed);
        setMode("template");
        setStep(2);
      } else if (res.length && templateId == null) {
        setTemplateId(res[0].id);
      }
      if (!res.length) setMode("blank");
    } catch {
      // ignore; templates may be restricted by role
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    const onFocus = () => loadTemplates();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    setError(null);
  }, [mode, step]);

  useEffect(() => {
    if (mode === "template" && templateId) {
      loadExampleOptions(templateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, mode]);

  if (!canEdit) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">{tLegal("newDoc.noAccess.title")}</div>
          <div className="emptyText">{tLegal("newDoc.noAccess.text")}</div>
        </div>
      </div>
    );
  }

  const createBlank = async () => {
    setCreating(true);
    setError(null);
    try {
      const due = blankDue ? new Date(blankDue).toISOString() : null;
      const expiry = blankExpiry ? new Date(blankExpiry).toISOString() : null;
      const created = await api.createLegalDocument({
        title: docTitle.trim() || tLegal("newDoc.blank.untitled"),
        type: blankType.trim() || tLegal("newDoc.blank.defaultType"),
        counterparty_name: blankCounterparty.trim() || undefined,
        counterparty_email: blankEmail.trim() || undefined,
        content: blankContent || "",
        variables: kvToObject(blankVars),
        due_date: due,
        expiry_date: expiry,
      });
      navigate(`/${locale}/legal/documents/${created.id}?edit=1`);
      onToast?.(tLegal("newDoc.toast.created"), "success");
    } catch (e: any) {
      const msg = e?.message || tLegal("newDoc.errors.failedToCreate");
      setError(msg);
      onToast?.(msg, "danger");
    } finally {
      setCreating(false);
    }
  };

  const createFromTemplate = async () => {
    if (!selectedTemplate) {
      setError(tLegal("newDoc.errors.pickTemplate"));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await api.createLegalDocument({
        title: docTitle.trim() || selectedTemplate.name,
        type: selectedTemplate.type,
        content: preview,
        variables: {
          ...vars,
          _template_id: selectedTemplate.id,
          _approver_ids: selectedTemplate.default_approvers || [],
          used_example_ids: usedExampleIds,
        },
      });
      navigate(`/${locale}/legal/documents/${created.id}`);
      onToast?.(tLegal("newDoc.toast.created"), "success");
    } catch (e: any) {
      const msg = e?.message || tLegal("newDoc.errors.failedToCreate");
      setError(msg);
      onToast?.(msg, "danger");
    } finally {
      setCreating(false);
    }
  };

  const generatePreview = async () => {
    if (!selectedTemplate) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.generateLegalTemplate(selectedTemplate.id, {
        variables: vars,
        selected_example_ids: selectedExampleIds,
        title: docTitle.trim() || undefined,
      });
      setPreview(res.content);
      setUsedExampleIds(res.used_example_ids || []);
      setStep(3);
    } catch (e: any) {
      const msg = e?.message || tLegal("newDoc.errors.failedToGenerate");
      setError(msg);
      onToast?.(msg, "danger");
    } finally {
      setCreating(false);
    }
  };

  const templateTypes = useMemo(
    () => Array.from(new Set(templates.map((t) => t.type).filter(Boolean))).sort(),
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.trim().toLowerCase();
    return templates.filter((t) => {
      if (templateTypeFilter && t.type !== templateTypeFilter) return false;
      if (!term) return true;
      return (
        (t.name || "").toLowerCase().includes(term) ||
        (t.type || "").toLowerCase().includes(term) ||
        (t.body || "").toLowerCase().includes(term)
      );
    });
  }, [templates, templateSearch, templateTypeFilter]);

  const templateVarKeys = useMemo(() => {
    const declared = Array.isArray(selectedTemplate?.variables) ? (selectedTemplate?.variables as any[]).map(String) : [];
    const discovered = extractPlaceholders(selectedTemplate?.body || "");
    const uniq = new Set<string>();
    [...declared, ...discovered].map((s) => s.trim()).filter(Boolean).forEach((k) => uniq.add(k));
    return Array.from(uniq).sort();
  }, [selectedTemplate]);

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tLegal("newDoc.eyebrow")}</div>
            <div className="h3">{tLegal("newDoc.title")}</div>
            <div className="muted">{tLegal("newDoc.subtitle")}</div>
          </div>
          <button className="btn" onClick={() => navigate(`/${locale}/legal/documents`)} type="button">{tCommon("actions.back")}</button>
        </div>

        <div
          className="row"
          style={{
            gap: 10,
            flexWrap: "wrap",
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: "var(--surface)",
            padding: "8px 0",
          }}
        >
          <button className={`btn ${mode === "template" ? "btnPrimary" : ""}`} onClick={() => { setMode("template"); setStep(1); }} type="button">
            {tLegal("newDoc.mode.fromTemplate")}
          </button>
          <button className={`btn ${mode === "blank" ? "btnPrimary" : ""}`} onClick={() => setMode("blank")} type="button">
            {tLegal("newDoc.mode.blank")}
          </button>
        </div>

        {error && <div className="errorBanner" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {mode === "template" && (
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tLegal("newDoc.wizard.eyebrow")}</div>
              <div className="h3">{tLegal("newDoc.wizard.title")}</div>
              <div className="muted">{tLegal("newDoc.wizard.step", { step, total: 4 })}</div>
            </div>
            <button className="btn btnGhost" onClick={loadTemplates} disabled={loadingTemplates} type="button">
              {tCommon("actions.reload")}
            </button>
          </div>

          {filteredTemplates.length === 0 && templates.length === 0 && (
            <div className="emptyState">
              <div className="emptyTitle">{tLegal("newDoc.wizard.noTemplates.title")}</div>
              <div className="emptyText">{tLegal("newDoc.wizard.noTemplates.text")}</div>
            </div>
          )}

          {templates.length > 0 && (
            <>
              {step === 1 && (
                <div className="formGrid">
                  <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                    <label className="fieldLabel">{tLegal("newDoc.wizard.step1.search")}</label>
                    <input className="input" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder={tLegal("newDoc.wizard.step1.searchPlaceholder")} />
                  </div>
                  <div className="formGroup">
                    <label className="fieldLabel">{tLegal("newDoc.wizard.step1.type")}</label>
                    <select className="input select" value={templateTypeFilter} onChange={(e) => setTemplateTypeFilter(e.target.value)}>
                      <option value="">{tLegal("newDoc.wizard.step1.allTypes")}</option>
                      {templateTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="formGroup">
                    <label className="fieldLabel">{tLegal("newDoc.wizard.step1.titleLabel")}</label>
                    <input className="input" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder={selectedTemplate?.name || tLegal("newDoc.wizard.step1.titlePlaceholder")} />
                  </div>

                  <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                    <div className="grid twoCols">
                      {filteredTemplates.map((t) => (
                        <button
                          key={t.id}
                          className={`card quickAction cardHover`}
                          onClick={() => setTemplateId(t.id)}
                          type="button"
                          style={{ textAlign: "left", borderColor: templateId === t.id ? "rgba(0, 174, 239, 0.55)" : undefined }}
                        >
                          <div className="h3" style={{ marginBottom: 6 }}>{t.name}</div>
                          <div className="muted" style={{ marginBottom: 10 }}>{t.type}</div>
                          <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {t.body?.slice(0, 120) || "—"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                    <button className="btn btnPrimary" onClick={() => setStep(2)} disabled={!selectedTemplate} type="button">
                      {tLegal("actions.next")}
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="formGrid">
                  {templateVarKeys.length === 0 && (
                    <div className="muted" style={{ gridColumn: "1 / -1" }}>
                      {tLegal("newDoc.wizard.step2.noVars")}
                    </div>
                  )}
                  {templateVarKeys.map((name) => (
                    <div key={name} className="formGroup">
                      <label className="fieldLabel">{name}</label>
                      <input
                        className="input"
                        value={vars[name] ?? ""}
                        onChange={(e) => setVars((v) => ({ ...v, [name]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                    <label className="fieldLabel">{tLegal("newDoc.wizard.step2.examplesLabel")}</label>
                    <div className="muted">{tLegal("newDoc.wizard.step2.examplesHelp")}</div>
                    <div className="checkGrid" style={{ marginTop: 10 }}>
                      {exampleOptions.map((ex) => (
                        <label key={ex.id} className="checkRow">
                          <input
                            type="checkbox"
                            checked={selectedExampleIds.includes(ex.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedExampleIds((v) => [...v, ex.id]);
                              else setSelectedExampleIds((v) => v.filter((x) => x !== ex.id));
                            }}
                          />
                          <span>{ex.title}</span>
                          <span className="muted">{ex.document_type}</span>
                        </label>
                      ))}
                      {!exampleOptions.length && <div className="muted">{tLegal("newDoc.wizard.step2.noExamples")}</div>}
                    </div>
                  </div>
                  <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                    <div className="row" style={{ gap: 10 }}>
                      <button className="btn" onClick={() => setStep(1)} type="button">
                        {tCommon("actions.back")}
                      </button>
                      <button className="btn btnPrimary" onClick={generatePreview} disabled={creating} type="button">
                        {creating ? tLegal("newDoc.wizard.step2.generating") : tLegal("newDoc.wizard.step2.generate")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="pageStack">
                  <div className="formGroup">
                    <label className="fieldLabel">{tLegal("newDoc.wizard.step3.preview")}</label>
                    <textarea className="input" style={{ minHeight: 220 }} value={preview} readOnly />
                  </div>
                  <div className="muted">{tLegal("newDoc.wizard.step3.usedExamples", { count: usedExampleIds.length })}</div>
                  <div className="row" style={{ gap: 10 }}>
                    <button className="btn" onClick={() => setStep(2)} type="button">
                      {tCommon("actions.back")}
                    </button>
                    <button className="btn btnPrimary" onClick={() => setStep(4)} type="button">
                      {tLegal("actions.next")}
                    </button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="pageStack">
                  <div className="muted">
                    {tLegal("newDoc.wizard.step4.help")}
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <button className="btn" onClick={() => setStep(3)} type="button">
                      {tCommon("actions.back")}
                    </button>
                    <button className="btn btnPrimary" onClick={createFromTemplate} disabled={creating} type="button">
                      {creating ? tCommon("actions.saving") : tLegal("newDoc.wizard.step4.create")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === "blank" && (
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tLegal("newDoc.blank.eyebrow")}</div>
              <div className="h3">{tLegal("newDoc.blank.title")}</div>
              <div className="muted">{tLegal("newDoc.blank.subtitle", { example: "{{client_name}}" })}</div>
            </div>
          </div>

          <div className="formGrid">
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <label className="fieldLabel">{tCommon("labels.title")}</label>
              <input className="input" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder={tLegal("newDoc.blank.titlePlaceholder")} />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">{tLegal("newDoc.blank.type")}</label>
              <input className="input" value={blankType} onChange={(e) => setBlankType(e.target.value)} placeholder={tLegal("newDoc.blank.typePlaceholder")} />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">{tLegal("newDoc.blank.counterparty")}</label>
              <input className="input" value={blankCounterparty} onChange={(e) => setBlankCounterparty(e.target.value)} placeholder={tLegal("newDoc.blank.counterpartyPlaceholder")} />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">{tLegal("newDoc.blank.counterpartyEmail")}</label>
              <input className="input" value={blankEmail} onChange={(e) => setBlankEmail(e.target.value)} placeholder="email@company.com" />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">{tLegal("newDoc.blank.dueDate")}</label>
              <input type="date" className="input" value={blankDue} onChange={(e) => setBlankDue(e.target.value)} />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">{tLegal("newDoc.blank.expiryDate")}</label>
              <input type="date" className="input" value={blankExpiry} onChange={(e) => setBlankExpiry(e.target.value)} />
            </div>
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <label className="fieldLabel">{tLegal("newDoc.blank.content")}</label>
              <textarea className="input" style={{ minHeight: 240 }} value={blankContent} onChange={(e) => setBlankContent(e.target.value)} />
            </div>
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <label className="fieldLabel">{tLegal("newDoc.blank.variables")}</label>
              <div className="pageStack" style={{ gap: 10 }}>
                {blankVars.map((kv, idx) => (
                  <div key={idx} className="row" style={{ gap: 10 }}>
                    <input
                      className="input"
                      value={kv.key}
                      onChange={(e) => setBlankVars((v) => v.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))}
                      placeholder="variable_name"
                    />
                    <input
                      className="input"
                      value={kv.value}
                      onChange={(e) => setBlankVars((v) => v.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                      placeholder="Value"
                    />
                    <button
                      className="btn btnGhost"
                      onClick={() => setBlankVars((v) => v.filter((_, i) => i !== idx))}
                      type="button"
                      aria-label={tLegal("newDoc.blank.removeVar")}
                    >
                      {tCommon("actions.delete")}
                    </button>
                  </div>
                ))}
                <button className="btn btnGhost" onClick={() => setBlankVars((v) => [...v, { key: "", value: "" }])} type="button">{tLegal("newDoc.blank.addVar")}</button>
              </div>
            </div>
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <button className="btn btnPrimary" onClick={createBlank} disabled={creating} type="button">
                {creating ? tCommon("actions.saving") : tLegal("newDoc.blank.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
