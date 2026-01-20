import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canEditLegal } from "./legalAccess";
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
export default function LegalExamplesPage({ onToast }) {
    const { user } = useAuth();
    const locale = useLocale();
    const navigate = useNavigate();
    const { t: tLegal } = useTranslation("legal");
    const { t: tCommon } = useTranslation("common");
    const canUpload = canEditLegal(user);
    const canDelete = user?.role === "LEGAL_ADMIN" || user?.role === "SUPER_ADMIN";
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [q, setQ] = useState("");
    const [type, setType] = useState("");
    const [status, setStatus] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [templates, setTemplates] = useState([]);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadType, setUploadType] = useState("Contract");
    const [uploading, setUploading] = useState(false);
    const loadTemplates = async () => {
        try {
            const res = await api.listLegalTemplates();
            setTemplates(res);
        }
        catch {
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
        }
        catch (e) {
            setError(e?.message || tLegal("examples.errors.failedToLoad"));
            setItems([]);
            setTotal(0);
        }
        finally {
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
        if (!canUpload)
            return;
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
        }
        catch (e) {
            const msg = e?.message || tLegal("examples.errors.failedToUpload");
            setError(msg);
            onToast?.(msg, "danger");
        }
        finally {
            setUploading(false);
        }
    };
    const download = async (ex) => {
        try {
            const { blob, filename } = await api.downloadLegalExample(ex.id);
            downloadBlob(blob, filename);
        }
        catch (e) {
            onToast?.(e?.message || tLegal("examples.errors.failedToDownload"), "danger");
        }
    };
    const retry = async (ex) => {
        try {
            await api.retryLegalExample(ex.id);
            onToast?.(tLegal("examples.toast.retryQueued"), "success");
            await load();
        }
        catch (e) {
            onToast?.(e?.message || tLegal("examples.errors.failedToRetry"), "danger");
        }
    };
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tLegal("examples.eyebrow") }), _jsx("div", { className: "h3", children: tLegal("examples.title") }), _jsx("div", { className: "muted", children: tLegal("examples.subtitle") })] }), _jsx("div", { className: "row", style: { gap: 10 }, children: _jsx("button", { className: "btn btnGhost", onClick: load, disabled: loading, type: "button", children: tCommon("actions.reload") }) })] }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("examples.filters.search") }), _jsx("input", { className: "input", value: q, onChange: (e) => setQ(e.target.value), placeholder: tLegal("examples.filters.searchPlaceholder") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("examples.filters.type") }), _jsx("input", { className: "input", value: type, onChange: (e) => setType(e.target.value), placeholder: types[0] ? `e.g. ${types[0]}` : "e.g. NDA" })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("examples.filters.template") }), _jsxs("select", { className: "input select", value: String(templateId), onChange: (e) => setTemplateId(e.target.value ? Number(e.target.value) : ""), children: [_jsx("option", { value: "", children: tLegal("examples.filters.allTemplates") }), templates.map((t) => (_jsx("option", { value: t.id, children: t.name }, t.id)))] })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("examples.filters.status") }), _jsxs("select", { className: "input select", value: status, onChange: (e) => setStatus(e.target.value), children: [_jsx("option", { value: "", children: tLegal("examples.filters.allStatuses") }), _jsx("option", { value: "READY", children: "READY" }), _jsx("option", { value: "EXTRACTING", children: "EXTRACTING" }), _jsx("option", { value: "FAILED", children: "FAILED" }), _jsx("option", { value: "UPLOADED", children: "UPLOADED" })] })] })] }), canUpload && (_jsxs("div", { className: "cardSubsection", children: [_jsx("div", { className: "h3", children: tLegal("examples.upload.title") }), _jsx("div", { className: "muted", children: tLegal("examples.upload.subtitle") }), _jsxs("div", { className: "formGrid", style: { marginTop: 10 }, children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("examples.upload.documentType") }), _jsx("input", { className: "input", value: uploadType, onChange: (e) => setUploadType(e.target.value) })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tLegal("examples.upload.files") }), _jsx("input", { className: "input", type: "file", multiple: true, accept: ".pdf,.docx,.txt,.md", onChange: (e) => setUploadFiles(Array.from(e.target.files || [])) })] }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("button", { className: "btn btnPrimary", onClick: doUpload, disabled: uploading, type: "button", children: uploading ? tLegal("examples.upload.uploading") : tLegal("examples.upload.upload") }) })] })] })), error && _jsx("div", { className: "errorBanner", children: error })] }), !loading && items.length === 0 && (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tLegal("examples.empty.title") }), _jsx("div", { className: "emptyText", children: tLegal("examples.empty.text") })] }) })), items.length > 0 && (_jsxs("div", { className: "card", children: [_jsx("div", { className: "muted", style: { marginBottom: 8 }, children: tLegal("examples.table.count", { count: total }) }), _jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "1fr 0.6fr 0.7fr 0.6fr 0.8fr 0.9fr auto" }, children: [_jsx("div", { children: tLegal("examples.table.title") }), _jsx("div", { children: tLegal("examples.table.type") }), _jsx("div", { children: tLegal("examples.table.template") }), _jsx("div", { children: tLegal("examples.table.status") }), _jsx("div", { children: tLegal("examples.table.uploadedBy") }), _jsx("div", { children: tLegal("examples.table.updated") }), _jsx("div", {})] }), _jsx("div", { className: "tableBody", children: items.map((ex) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "1fr 0.6fr 0.7fr 0.6fr 0.8fr 0.9fr auto" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: ex.title }), _jsxs("div", { className: "muted", children: [ex.file_name, " \u2022 ", (ex.file_size / (1024 * 1024)).toFixed(1), "MB"] })] }), _jsx("div", { className: "muted", children: ex.document_type }), _jsx("div", { children: ex.template_id ? (_jsx("button", { className: "btn btnGhost", onClick: () => navigate(`/${locale}/legal/templates/${ex.template_id}`), type: "button", children: templateNameById.get(ex.template_id) || `#${ex.template_id}` })) : (_jsx("span", { className: "muted", children: "\u2014" })) }), _jsxs("div", { children: [_jsx("span", { className: `pill ${ex.status === "READY" ? "" : "subtle"}`, children: ex.status }), ex.status === "FAILED" && ex.error_message && _jsx("div", { className: "muted", children: ex.error_message })] }), _jsx("div", { className: "muted", children: ex.uploaded_by_name || ex.uploaded_by_email || `#${ex.uploaded_by}` }), _jsx("div", { className: "muted", children: new Date(ex.updated_at).toLocaleString() }), _jsxs("div", { className: "row", style: { justifyContent: "flex-end" }, children: [_jsx("button", { className: "btn btnGhost", onClick: () => download(ex), type: "button", children: tCommon("actions.download") }), ex.status === "FAILED" && canUpload && (_jsx("button", { className: "btn btnGhost", onClick: () => retry(ex), type: "button", children: tLegal("examples.actions.retry") })), canUpload && (_jsx("button", { className: "btn btnGhost", onClick: async () => {
                                                        const nextTitle = window.prompt(tLegal("examples.promptRename"), ex.title);
                                                        if (!nextTitle || !nextTitle.trim())
                                                            return;
                                                        await api.updateLegalExample(ex.id, { title: nextTitle.trim() });
                                                        onToast?.(tLegal("examples.toast.renamed"), "success");
                                                        await load();
                                                    }, type: "button", children: tLegal("examples.actions.rename") })), canUpload && (_jsx("button", { className: "btn btnGhost", onClick: async () => {
                                                        const val = window.prompt(tLegal("examples.promptAttachTemplate"), ex.template_id ? String(ex.template_id) : "");
                                                        if (val === null)
                                                            return;
                                                        const next = val.trim() ? Number(val.trim()) : null;
                                                        if (val.trim() && !Number.isFinite(next))
                                                            return;
                                                        await api.updateLegalExample(ex.id, { template_id: next });
                                                        onToast?.(tLegal("examples.toast.updated"), "success");
                                                        await load();
                                                    }, type: "button", children: tLegal("examples.actions.attachDetach") })), canDelete && (_jsx("button", { className: "btn btnGhost", onClick: async () => {
                                                        const ok = window.confirm(tLegal("examples.confirmDelete", { name: ex.title }));
                                                        if (!ok)
                                                            return;
                                                        await api.deleteLegalExample(ex.id);
                                                        onToast?.(tLegal("examples.toast.deleted"), "success");
                                                        await load();
                                                    }, type: "button", children: tLegal("examples.actions.delete") }))] })] }, ex.id))) })] })] }))] }));
}
