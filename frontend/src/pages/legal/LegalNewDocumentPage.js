import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canEditLegal } from "./legalAccess";
import { useTranslation } from "react-i18next";
function kvToObject(items) {
    const out = {};
    items.forEach((kv) => {
        const k = kv.key.trim();
        if (!k)
            return;
        out[k] = kv.value;
    });
    return out;
}
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
function extractPlaceholders(body) {
    const found = new Set();
    let m;
    while ((m = PLACEHOLDER_RE.exec(body || ""))) {
        found.add(m[1]);
    }
    PLACEHOLDER_RE.lastIndex = 0;
    return Array.from(found).sort();
}
export default function LegalNewDocumentPage({ onToast, }) {
    const { user } = useAuth();
    const locale = useLocale();
    const navigate = useNavigate();
    const location = useLocation();
    const canEdit = canEditLegal(user);
    const { t: tLegal } = useTranslation("legal");
    const { t: tCommon } = useTranslation("common");
    const [mode, setMode] = useState("template");
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [error, setError] = useState(null);
    // Template wizard state
    const [step, setStep] = useState(1);
    const [templateId, setTemplateId] = useState(null);
    const [docTitle, setDocTitle] = useState("");
    const [vars, setVars] = useState({});
    const [preview, setPreview] = useState("");
    const [usedExampleIds, setUsedExampleIds] = useState([]);
    const [creating, setCreating] = useState(false);
    const [templateSearch, setTemplateSearch] = useState("");
    const [templateTypeFilter, setTemplateTypeFilter] = useState("");
    const [exampleOptions, setExampleOptions] = useState([]);
    const [selectedExampleIds, setSelectedExampleIds] = useState([]);
    // Blank doc state
    const [blankType, setBlankType] = useState(tLegal("newDoc.blank.defaultType"));
    const [blankCounterparty, setBlankCounterparty] = useState("");
    const [blankEmail, setBlankEmail] = useState("");
    const [blankDue, setBlankDue] = useState("");
    const [blankExpiry, setBlankExpiry] = useState("");
    const [blankContent, setBlankContent] = useState("");
    const [blankVars, setBlankVars] = useState([{ key: "client_name", value: "" }]);
    const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId) || null, [templates, templateId]);
    const loadExampleOptions = async (tid) => {
        try {
            const [linked, global] = await Promise.all([
                api.listTemplateExamples(tid),
                api.listLegalExamples({ status: "READY", scope: "GLOBAL", limit: 200, offset: 0 }).then((r) => r.items),
            ]);
            const merged = [];
            const seen = new Set();
            linked.forEach((e) => {
                if (seen.has(e.id))
                    return;
                seen.add(e.id);
                merged.push(e);
            });
            global.forEach((e) => {
                if (seen.has(e.id))
                    return;
                seen.add(e.id);
                merged.push(e);
            });
            setExampleOptions(merged.filter((e) => e.status === "READY"));
            setSelectedExampleIds(linked.filter((e) => e.status === "READY").map((e) => e.id));
        }
        catch {
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
            }
            else if (res.length && templateId == null) {
                setTemplateId(res[0].id);
            }
            if (!res.length)
                setMode("blank");
        }
        catch {
            // ignore; templates may be restricted by role
        }
        finally {
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
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tLegal("newDoc.noAccess.title") }), _jsx("div", { className: "emptyText", children: tLegal("newDoc.noAccess.text") })] }) }));
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
        }
        catch (e) {
            const msg = e?.message || tLegal("newDoc.errors.failedToCreate");
            setError(msg);
            onToast?.(msg, "danger");
        }
        finally {
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
        }
        catch (e) {
            const msg = e?.message || tLegal("newDoc.errors.failedToCreate");
            setError(msg);
            onToast?.(msg, "danger");
        }
        finally {
            setCreating(false);
        }
    };
    const generatePreview = async () => {
        if (!selectedTemplate)
            return;
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
        }
        catch (e) {
            const msg = e?.message || tLegal("newDoc.errors.failedToGenerate");
            setError(msg);
            onToast?.(msg, "danger");
        }
        finally {
            setCreating(false);
        }
    };
    const templateTypes = useMemo(() => Array.from(new Set(templates.map((t) => t.type).filter(Boolean))).sort(), [templates]);
    const filteredTemplates = useMemo(() => {
        const term = templateSearch.trim().toLowerCase();
        return templates.filter((t) => {
            if (templateTypeFilter && t.type !== templateTypeFilter)
                return false;
            if (!term)
                return true;
            return ((t.name || "").toLowerCase().includes(term) ||
                (t.type || "").toLowerCase().includes(term) ||
                (t.body || "").toLowerCase().includes(term));
        });
    }, [templates, templateSearch, templateTypeFilter]);
    const templateVarKeys = useMemo(() => {
        const declared = Array.isArray(selectedTemplate?.variables) ? (selectedTemplate?.variables).map(String) : [];
        const discovered = extractPlaceholders(selectedTemplate?.body || "");
        const uniq = new Set();
        [...declared, ...discovered].map((s) => s.trim()).filter(Boolean).forEach((k) => uniq.add(k));
        return Array.from(uniq).sort();
    }, [selectedTemplate]);
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tLegal("newDoc.eyebrow") }), _jsx("div", { className: "h3", children: tLegal("newDoc.title") }), _jsx("div", { className: "muted", children: tLegal("newDoc.subtitle") })] }), _jsx("button", { className: "btn", onClick: () => navigate(`/${locale}/legal/documents`), type: "button", children: tCommon("actions.back") })] }), _jsxs("div", { className: "row", style: {
                            gap: 10,
                            flexWrap: "wrap",
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            background: "var(--surface)",
                            padding: "8px 0",
                        }, children: [_jsx("button", { className: `btn ${mode === "template" ? "btnPrimary" : ""}`, onClick: () => { setMode("template"); setStep(1); }, type: "button", children: tLegal("newDoc.mode.fromTemplate") }), _jsx("button", { className: `btn ${mode === "blank" ? "btnPrimary" : ""}`, onClick: () => setMode("blank"), type: "button", children: tLegal("newDoc.mode.blank") })] }), error && _jsx("div", { className: "errorBanner", style: { marginTop: 12 }, children: error })] }), mode === "template" && (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tLegal("newDoc.wizard.eyebrow") }), _jsx("div", { className: "h3", children: tLegal("newDoc.wizard.title") }), _jsx("div", { className: "muted", children: tLegal("newDoc.wizard.step", { step, total: 4 }) })] }), _jsx("button", { className: "btn btnGhost", onClick: loadTemplates, disabled: loadingTemplates, type: "button", children: tCommon("actions.reload") })] }), filteredTemplates.length === 0 && templates.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tLegal("newDoc.wizard.noTemplates.title") }), _jsx("div", { className: "emptyText", children: tLegal("newDoc.wizard.noTemplates.text") })] })), templates.length > 0 && (_jsxs(_Fragment, { children: [step === 1 && (_jsxs("div", { className: "formGrid", children: [_jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.wizard.step1.search") }), _jsx("input", { className: "input", value: templateSearch, onChange: (e) => setTemplateSearch(e.target.value), placeholder: tLegal("newDoc.wizard.step1.searchPlaceholder") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.wizard.step1.type") }), _jsxs("select", { className: "input select", value: templateTypeFilter, onChange: (e) => setTemplateTypeFilter(e.target.value), children: [_jsx("option", { value: "", children: tLegal("newDoc.wizard.step1.allTypes") }), templateTypes.map((t) => (_jsx("option", { value: t, children: t }, t)))] })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.wizard.step1.titleLabel") }), _jsx("input", { className: "input", value: docTitle, onChange: (e) => setDocTitle(e.target.value), placeholder: selectedTemplate?.name || tLegal("newDoc.wizard.step1.titlePlaceholder") })] }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("div", { className: "grid twoCols", children: filteredTemplates.map((t) => (_jsxs("button", { className: `card quickAction cardHover`, onClick: () => setTemplateId(t.id), type: "button", style: { textAlign: "left", borderColor: templateId === t.id ? "rgba(0, 174, 239, 0.55)" : undefined }, children: [_jsx("div", { className: "h3", style: { marginBottom: 6 }, children: t.name }), _jsx("div", { className: "muted", style: { marginBottom: 10 }, children: t.type }), _jsx("div", { className: "muted", style: { fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: t.body?.slice(0, 120) || "—" })] }, t.id))) }) }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("button", { className: "btn btnPrimary", onClick: () => setStep(2), disabled: !selectedTemplate, type: "button", children: tLegal("actions.next") }) })] })), step === 2 && (_jsxs("div", { className: "formGrid", children: [templateVarKeys.length === 0 && (_jsx("div", { className: "muted", style: { gridColumn: "1 / -1" }, children: tLegal("newDoc.wizard.step2.noVars") })), templateVarKeys.map((name) => (_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: name }), _jsx("input", { className: "input", value: vars[name] ?? "", onChange: (e) => setVars((v) => ({ ...v, [name]: e.target.value })) })] }, name))), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.wizard.step2.examplesLabel") }), _jsx("div", { className: "muted", children: tLegal("newDoc.wizard.step2.examplesHelp") }), _jsxs("div", { className: "checkGrid", style: { marginTop: 10 }, children: [exampleOptions.map((ex) => (_jsxs("label", { className: "checkRow", children: [_jsx("input", { type: "checkbox", checked: selectedExampleIds.includes(ex.id), onChange: (e) => {
                                                                    if (e.target.checked)
                                                                        setSelectedExampleIds((v) => [...v, ex.id]);
                                                                    else
                                                                        setSelectedExampleIds((v) => v.filter((x) => x !== ex.id));
                                                                } }), _jsx("span", { children: ex.title }), _jsx("span", { className: "muted", children: ex.document_type })] }, ex.id))), !exampleOptions.length && _jsx("div", { className: "muted", children: tLegal("newDoc.wizard.step2.noExamples") })] })] }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsxs("div", { className: "row", style: { gap: 10 }, children: [_jsx("button", { className: "btn", onClick: () => setStep(1), type: "button", children: tCommon("actions.back") }), _jsx("button", { className: "btn btnPrimary", onClick: generatePreview, disabled: creating, type: "button", children: creating ? tLegal("newDoc.wizard.step2.generating") : tLegal("newDoc.wizard.step2.generate") })] }) })] })), step === 3 && (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.wizard.step3.preview") }), _jsx("textarea", { className: "input", style: { minHeight: 220 }, value: preview, readOnly: true })] }), _jsx("div", { className: "muted", children: tLegal("newDoc.wizard.step3.usedExamples", { count: usedExampleIds.length }) }), _jsxs("div", { className: "row", style: { gap: 10 }, children: [_jsx("button", { className: "btn", onClick: () => setStep(2), type: "button", children: tCommon("actions.back") }), _jsx("button", { className: "btn btnPrimary", onClick: () => setStep(4), type: "button", children: tLegal("actions.next") })] })] })), step === 4 && (_jsxs("div", { className: "pageStack", children: [_jsx("div", { className: "muted", children: tLegal("newDoc.wizard.step4.help") }), _jsxs("div", { className: "row", style: { gap: 10 }, children: [_jsx("button", { className: "btn", onClick: () => setStep(3), type: "button", children: tCommon("actions.back") }), _jsx("button", { className: "btn btnPrimary", onClick: createFromTemplate, disabled: creating, type: "button", children: creating ? tCommon("actions.saving") : tLegal("newDoc.wizard.step4.create") })] })] }))] }))] })), mode === "blank" && (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tLegal("newDoc.blank.eyebrow") }), _jsx("div", { className: "h3", children: tLegal("newDoc.blank.title") }), _jsx("div", { className: "muted", children: tLegal("newDoc.blank.subtitle", { example: "{{client_name}}" }) })] }) }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.title") }), _jsx("input", { className: "input", value: docTitle, onChange: (e) => setDocTitle(e.target.value), placeholder: tLegal("newDoc.blank.titlePlaceholder") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.blank.type") }), _jsx("input", { className: "input", value: blankType, onChange: (e) => setBlankType(e.target.value), placeholder: tLegal("newDoc.blank.typePlaceholder") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.blank.counterparty") }), _jsx("input", { className: "input", value: blankCounterparty, onChange: (e) => setBlankCounterparty(e.target.value), placeholder: tLegal("newDoc.blank.counterpartyPlaceholder") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.blank.counterpartyEmail") }), _jsx("input", { className: "input", value: blankEmail, onChange: (e) => setBlankEmail(e.target.value), placeholder: "email@company.com" })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.blank.dueDate") }), _jsx("input", { type: "date", className: "input", value: blankDue, onChange: (e) => setBlankDue(e.target.value) })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.blank.expiryDate") }), _jsx("input", { type: "date", className: "input", value: blankExpiry, onChange: (e) => setBlankExpiry(e.target.value) })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.blank.content") }), _jsx("textarea", { className: "input", style: { minHeight: 240 }, value: blankContent, onChange: (e) => setBlankContent(e.target.value) })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tLegal("newDoc.blank.variables") }), _jsxs("div", { className: "pageStack", style: { gap: 10 }, children: [blankVars.map((kv, idx) => (_jsxs("div", { className: "row", style: { gap: 10 }, children: [_jsx("input", { className: "input", value: kv.key, onChange: (e) => setBlankVars((v) => v.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x))), placeholder: "variable_name" }), _jsx("input", { className: "input", value: kv.value, onChange: (e) => setBlankVars((v) => v.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x))), placeholder: "Value" }), _jsx("button", { className: "btn btnGhost", onClick: () => setBlankVars((v) => v.filter((_, i) => i !== idx)), type: "button", "aria-label": tLegal("newDoc.blank.removeVar"), children: tCommon("actions.delete") })] }, idx))), _jsx("button", { className: "btn btnGhost", onClick: () => setBlankVars((v) => [...v, { key: "", value: "" }]), type: "button", children: tLegal("newDoc.blank.addVar") })] })] }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("button", { className: "btn btnPrimary", onClick: createBlank, disabled: creating, type: "button", children: creating ? tCommon("actions.saving") : tLegal("newDoc.blank.create") }) })] })] }))] }));
}
