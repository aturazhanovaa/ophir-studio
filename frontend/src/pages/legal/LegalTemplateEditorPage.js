import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canManageLegalTemplates } from "./legalAccess";
import ChipEditor from "./components/ChipEditor";
import UserMultiSelect from "./components/UserMultiSelect";
import { canEditLegal } from "./legalAccess";
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
export default function LegalTemplateEditorPage({ mode, onToast, }) {
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
    const [error, setError] = useState(null);
    const [template, setTemplate] = useState(null);
    const [name, setName] = useState("");
    const [type, setType] = useState("");
    const [body, setBody] = useState("");
    const [variables, setVariables] = useState([]);
    const [approverIds, setApproverIds] = useState([]);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [examples, setExamples] = useState([]);
    const [examplesLoading, setExamplesLoading] = useState(false);
    const [exampleFiles, setExampleFiles] = useState([]);
    const [exampleType, setExampleType] = useState("");
    const [exampleUploading, setExampleUploading] = useState(false);
    const discovered = useMemo(() => extractPlaceholders(body), [body]);
    const loadTemplate = async () => {
        if (mode !== "edit" || !templateId)
            return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.getLegalTemplate(templateId);
            setTemplate(res);
            setName(res.name || "");
            setType(res.type || "");
            setBody(res.body || "");
            setVariables(Array.isArray(res.variables) ? res.variables.map(String) : []);
            setApproverIds(Array.isArray(res.default_approvers) ? res.default_approvers : []);
        }
        catch (e) {
            setError(e?.message || tLegal("templateEditor.errors.failedToLoad"));
        }
        finally {
            setLoading(false);
        }
    };
    const loadUsers = async () => {
        if (!canAdmin)
            return;
        setUsersLoading(true);
        try {
            const res = await api.listLegalUsers();
            setUsers(res);
        }
        catch {
            // ignore; keep empty
        }
        finally {
            setUsersLoading(false);
        }
    };
    useEffect(() => {
        loadTemplate();
        loadUsers();
        if (templateId)
            loadExamples(templateId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId, canAdmin]);
    const loadExamples = async (tid) => {
        setExamplesLoading(true);
        try {
            const res = await api.listTemplateExamples(tid);
            setExamples(res);
        }
        catch {
            setExamples([]);
        }
        finally {
            setExamplesLoading(false);
        }
    };
    if (!canAdmin) {
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tLegal("templateEditor.noAccess.title") }), _jsx("div", { className: "emptyText", children: tLegal("templateEditor.noAccess.text") })] }) }));
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
            }
            else {
                const created = await api.createLegalTemplate(payload);
                onToast?.(tLegal("templateEditor.toast.created"), "success");
                navigate(`/${locale}/legal/templates/${created.id}`);
            }
        }
        catch (e) {
            setError(e?.message || tLegal("templateEditor.errors.failedToSave"));
            onToast?.(e?.message || tLegal("templateEditor.errors.failedToSave"), "danger");
        }
        finally {
            setSaving(false);
        }
    };
    const del = async () => {
        if (mode !== "edit" || !templateId)
            return;
        const ok = window.confirm(tLegal("templateEditor.confirmDelete", { name }));
        if (!ok)
            return;
        setSaving(true);
        setError(null);
        try {
            await api.deleteLegalTemplate(templateId);
            onToast?.(tLegal("templateEditor.toast.deleted"), "success");
            navigate(`/${locale}/legal/templates`);
        }
        catch (e) {
            setError(e?.message || tLegal("templateEditor.errors.failedToDelete"));
            onToast?.(e?.message || tLegal("templateEditor.errors.failedToDelete"), "danger");
        }
        finally {
            setSaving(false);
        }
    };
    const duplicate = async () => {
        if (mode !== "edit" || !template)
            return;
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
        }
        catch (e) {
            setError(e?.message || tLegal("templates.errors.failedToDuplicate"));
            onToast?.(e?.message || tLegal("templates.errors.failedToDuplicate"), "danger");
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tLegal("templateEditor.eyebrow") }), _jsx("div", { className: "h3", children: mode === "edit" ? tLegal("templateEditor.titleEdit") : tLegal("templateEditor.titleCreate") }), _jsx("div", { className: "muted", children: tLegal("templateEditor.subtitle") })] }), _jsxs("div", { className: "row", style: { gap: 10, flexWrap: "wrap" }, children: [_jsx("button", { className: "btn", onClick: () => navigate(`/${locale}/legal/templates`), type: "button", children: tLegal("templateEditor.actions.backToList") }), mode === "edit" && (_jsx("button", { className: "btn btnGhost", onClick: duplicate, disabled: saving, type: "button", children: tLegal("templates.actions.duplicate") })), mode === "edit" && (_jsx("button", { className: "btn btnGhost", onClick: del, disabled: saving, type: "button", children: tLegal("templateEditor.actions.delete") })), _jsx("button", { className: "btn btnPrimary", onClick: save, disabled: saving || loading, type: "button", children: saving ? tLegal("templateEditor.actions.saving") : tLegal("templateEditor.actions.save") })] })] }), error && _jsx("div", { className: "errorBanner", children: error }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("templateEditor.fields.name") }), _jsx("input", { className: "input", value: name, onChange: (e) => setName(e.target.value), disabled: loading || saving })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("templateEditor.fields.type") }), _jsx("input", { className: "input", value: type, onChange: (e) => setType(e.target.value), disabled: loading || saving })] }), _jsx(ChipEditor, { label: tLegal("templateEditor.fields.variables"), value: variables, onChange: setVariables, placeholder: tLegal("templateEditor.fields.variablesPlaceholder"), suggestions: discovered, removeAriaLabel: (key) => tLegal("templateEditor.actions.removeVar", { key }), addPrefix: tLegal("templateEditor.actions.addPrefix") }), _jsx(UserMultiSelect, { label: tLegal("templateEditor.fields.approvers"), users: users, value: approverIds, onChange: setApproverIds, disabled: usersLoading || loading || saving, placeholder: tLegal("templateEditor.fields.approversPlaceholder"), emptyText: tLegal("templateEditor.users.empty"), noMatchesText: tLegal("templateEditor.users.noMatches") }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tLegal("templateEditor.fields.body") }), _jsx("textarea", { className: "input", style: { minHeight: 260 }, value: body, onChange: (e) => setBody(e.target.value), disabled: loading || saving, placeholder: tLegal("templateEditor.fields.bodyPlaceholder", { example: "{{client_name}}" }) }), discovered.length > 0 && (_jsx("div", { className: "muted", style: { marginTop: 8 }, children: tLegal("templateEditor.discoveredVars", { count: discovered.length }) }))] })] })] }), mode === "edit" && templateId && (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tLegal("templateExamples.eyebrow") }), _jsx("div", { className: "h3", children: tLegal("templateExamples.title") }), _jsx("div", { className: "muted", children: tLegal("templateExamples.subtitle") })] }), _jsx("button", { className: "btn btnGhost", onClick: () => loadExamples(templateId), disabled: examplesLoading, type: "button", children: tLegal("templateExamples.actions.refresh") })] }), canUploadExamples && (_jsx("div", { className: "cardSubsection", children: _jsxs("div", { className: "formGrid", children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("templateExamples.upload.documentType") }), _jsx("input", { className: "input", value: exampleType, onChange: (e) => setExampleType(e.target.value), placeholder: type || tLegal("templateExamples.upload.typePlaceholder") })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tLegal("templateExamples.upload.files") }), _jsx("input", { className: "input", type: "file", multiple: true, accept: ".pdf,.docx,.txt,.md", onChange: (e) => setExampleFiles(Array.from(e.target.files || [])) })] }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("button", { className: "btn btnPrimary", disabled: exampleUploading || !exampleFiles.length, onClick: async () => {
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
                                            }
                                            catch (e) {
                                                onToast?.(e?.message || tLegal("templateExamples.errors.failedToUpload"), "danger");
                                            }
                                            finally {
                                                setExampleUploading(false);
                                            }
                                        }, type: "button", children: exampleUploading ? tLegal("templateExamples.upload.uploading") : tLegal("templateExamples.upload.upload") }) })] }) })), !examplesLoading && examples.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tLegal("templateExamples.empty.title") }), _jsx("div", { className: "emptyText", children: tLegal("templateExamples.empty.text") })] })), examples.length > 0 && (_jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "1fr 0.6fr 0.6fr 0.9fr auto" }, children: [_jsx("div", { children: tLegal("templateExamples.table.file") }), _jsx("div", { children: tLegal("templateExamples.table.type") }), _jsx("div", { children: tLegal("templateExamples.table.status") }), _jsx("div", { children: tLegal("templateExamples.table.uploaded") }), _jsx("div", {})] }), _jsx("div", { className: "tableBody", children: examples.map((ex) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "1fr 0.6fr 0.6fr 0.9fr auto" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: ex.title }), _jsx("div", { className: "muted", children: ex.file_name })] }), _jsx("div", { className: "muted", children: ex.document_type }), _jsxs("div", { children: [_jsx("span", { className: `pill ${ex.status === "READY" ? "" : "subtle"}`, children: ex.status }), ex.status === "FAILED" && ex.error_message && _jsx("div", { className: "muted", children: ex.error_message })] }), _jsx("div", { className: "muted", children: new Date(ex.uploaded_at).toLocaleString() }), _jsxs("div", { className: "row", style: { justifyContent: "flex-end" }, children: [_jsx("button", { className: "btn btnGhost", onClick: async () => {
                                                        const { blob, filename } = await api.downloadLegalExample(ex.id);
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement("a");
                                                        a.href = url;
                                                        a.download = filename;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    }, type: "button", children: tLegal("templateExamples.actions.download") }), ex.status === "FAILED" && canUploadExamples && (_jsx("button", { className: "btn btnGhost", onClick: () => api.retryLegalExample(ex.id).then(() => loadExamples(templateId)), type: "button", children: tLegal("templateExamples.actions.retry") })), _jsx("button", { className: "btn btnGhost", onClick: async () => {
                                                        const nextTitle = window.prompt(tLegal("templateExamples.promptRename"), ex.title);
                                                        if (!nextTitle || !nextTitle.trim())
                                                            return;
                                                        await api.updateLegalExample(ex.id, { title: nextTitle.trim() });
                                                        await loadExamples(templateId);
                                                        onToast?.(tLegal("templateExamples.toast.renamed"), "success");
                                                    }, type: "button", children: tLegal("templateExamples.actions.rename") }), _jsx("button", { className: "btn btnGhost", onClick: async () => {
                                                        await api.updateLegalExample(ex.id, { template_id: null });
                                                        await loadExamples(templateId);
                                                        onToast?.(tLegal("templateExamples.toast.detached"), "success");
                                                    }, type: "button", children: tLegal("templateExamples.actions.detach") }), _jsx("button", { className: "btn btnGhost", onClick: async () => {
                                                        const ok = window.confirm(tLegal("templateExamples.confirmDelete", { name: ex.title }));
                                                        if (!ok)
                                                            return;
                                                        await api.deleteLegalExample(ex.id);
                                                        await loadExamples(templateId);
                                                        onToast?.(tLegal("templateExamples.toast.deleted"), "success");
                                                    }, type: "button", children: tLegal("templateExamples.actions.delete") })] })] }, ex.id))) })] }))] }))] }));
}
