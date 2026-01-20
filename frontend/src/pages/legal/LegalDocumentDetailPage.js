import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canApproveLegal, canEditLegal } from "./legalAccess";
const PH_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
function renderPlaceholders(body, vars) {
    return (body || "").replace(PH_RE, (m, key) => {
        const v = vars?.[key];
        if (v === undefined || v === null)
            return m;
        return String(v);
    });
}
function downloadBlob(blob, filename) {
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
    const [doc, setDoc] = useState(null);
    const [versions, setVersions] = useState([]);
    const [audit, setAudit] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState("content");
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
        if (!docId)
            return;
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
        }
        catch (e) {
            setError(e?.message || "Failed to load document.");
        }
        finally {
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
        }
        catch {
            return {};
        }
    }, [varsText]);
    const placeholders = useMemo(() => {
        const found = new Set();
        let m;
        while ((m = PH_RE.exec(content || ""))) {
            found.add(m[1]);
        }
        PH_RE.lastIndex = 0;
        return Array.from(found).sort();
    }, [content]);
    const preview = useMemo(() => renderPlaceholders(content, variablesObj), [content, variablesObj]);
    const canEditThis = useMemo(() => {
        if (!doc)
            return false;
        if (!canEdit)
            return false;
        return doc.status === "DRAFT" || doc.status === "CHANGES_REQUESTED";
    }, [doc, canEdit]);
    const save = async () => {
        if (!doc)
            return;
        setSaving(true);
        setError(null);
        try {
            let variables = {};
            try {
                variables = JSON.parse(varsText || "{}");
            }
            catch {
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
        }
        catch (e) {
            setError(e?.message || "Save failed.");
        }
        finally {
            setSaving(false);
        }
    };
    const submitForReview = async () => {
        if (!doc)
            return;
        setSaving(true);
        setError(null);
        try {
            const updated = await api.submitLegalDocumentForReview(doc.id, {});
            setDoc(updated);
            await load();
        }
        catch (e) {
            setError(e?.message || "Submit for review failed.");
        }
        finally {
            setSaving(false);
        }
    };
    const approve = async () => {
        if (!doc)
            return;
        const comment = window.prompt("Approval comment (optional):") || undefined;
        setSaving(true);
        setError(null);
        try {
            const updated = await api.approveLegalDocument(doc.id, { comment });
            setDoc(updated);
            await load();
        }
        catch (e) {
            setError(e?.message || "Approve failed.");
        }
        finally {
            setSaving(false);
        }
    };
    const requestChanges = async () => {
        if (!doc)
            return;
        const comment = window.prompt("What changes are needed? (optional):") || undefined;
        setSaving(true);
        setError(null);
        try {
            const updated = await api.requestChangesLegalDocument(doc.id, { comment });
            setDoc(updated);
            await load();
        }
        catch (e) {
            setError(e?.message || "Request changes failed.");
        }
        finally {
            setSaving(false);
        }
    };
    const markSigned = async () => {
        if (!doc)
            return;
        const ok = window.confirm("Mark this document as signed?");
        if (!ok)
            return;
        setSaving(true);
        setError(null);
        try {
            await api.markSignedLegalDocument(doc.id);
            await load();
        }
        catch (e) {
            setError(e?.message || "Failed to mark signed.");
        }
        finally {
            setSaving(false);
        }
    };
    const archive = async () => {
        if (!doc)
            return;
        const ok = window.confirm("Archive this document?");
        if (!ok)
            return;
        setSaving(true);
        setError(null);
        try {
            await api.archiveLegalDocument(doc.id);
            await load();
        }
        catch (e) {
            setError(e?.message || "Archive failed.");
        }
        finally {
            setSaving(false);
        }
    };
    const exportDoc = async (format) => {
        if (!doc)
            return;
        setSaving(true);
        setError(null);
        try {
            const { blob, filename } = await api.exportLegalDocument(doc.id, format);
            downloadBlob(blob, filename);
            await load();
        }
        catch (e) {
            setError(e?.message || "Export failed.");
        }
        finally {
            setSaving(false);
        }
    };
    if (!docId) {
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: "Not found" }), _jsx("div", { className: "emptyText", children: "Invalid document ID." })] }) }));
    }
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Legal document" }), _jsx("div", { className: "h2", children: doc?.title || (loading ? "Loading…" : "Document") }), doc && (_jsxs("div", { className: "row", style: { gap: 10, flexWrap: "wrap", marginTop: 6 }, children: [_jsx("span", { className: `pill ${doc.status === "APPROVED" || doc.status === "SIGNED" ? "" : "subtle"}`, children: doc.status }), _jsx("span", { className: "pill subtle", children: doc.type }), doc.counterparty_name && _jsx("span", { className: "pill subtle", children: doc.counterparty_name })] }))] }), _jsxs("div", { className: "row", style: { gap: 10, flexWrap: "wrap" }, children: [_jsx("button", { className: "btn", onClick: () => navigate(`/${locale}/legal/documents`), type: "button", children: "Back" }), doc && canEditThis && (_jsx("button", { className: "btn btnPrimary", onClick: () => setEditing((v) => !v), disabled: saving, type: "button", children: editing ? "Cancel edit" : "Edit" })), doc && canEditThis && (_jsx("button", { className: "btn", onClick: submitForReview, disabled: saving, type: "button", children: "Submit for review" })), doc && doc.status === "IN_REVIEW" && canApprove && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btnPrimary", onClick: approve, disabled: saving, type: "button", children: "Approve" }), _jsx("button", { className: "btn", onClick: requestChanges, disabled: saving, type: "button", children: "Request changes" })] })), doc && doc.status === "APPROVED" && canEdit && (_jsx("button", { className: "btn btnPrimary", onClick: markSigned, disabled: saving, type: "button", children: "Mark as signed" })), doc && (doc.status === "APPROVED" || doc.status === "SIGNED") && (_jsx("button", { className: "btn", onClick: () => exportDoc("docx"), disabled: saving, type: "button", children: "Export" })), doc && canEdit && doc.status !== "ARCHIVED" && (_jsx("button", { className: "btn btnGhost", onClick: archive, disabled: saving, type: "button", children: "Archive" }))] })] }), error && _jsx("div", { className: "errorBanner", children: error })] }), _jsxs("div", { className: "row", style: { gap: 10, flexWrap: "wrap" }, children: [_jsx("button", { className: `pill ${tab === "content" ? "" : "subtle"}`, onClick: () => setTab("content"), type: "button", children: "Content" }), _jsx("button", { className: `pill ${tab === "versions" ? "" : "subtle"}`, onClick: () => setTab("versions"), type: "button", children: "Versions" }), _jsx("button", { className: `pill ${tab === "approvals" ? "" : "subtle"}`, onClick: () => setTab("approvals"), type: "button", children: "Approvals" }), _jsx("button", { className: `pill ${tab === "comments" ? "" : "subtle"}`, onClick: () => setTab("comments"), type: "button", children: "Comments" }), _jsx("button", { className: `pill ${tab === "audit" ? "" : "subtle"}`, onClick: () => setTab("audit"), type: "button", children: "Audit log" })] }), tab === "content" && (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Content" }), _jsx("div", { className: "h3", children: "Draft + placeholders" }), _jsxs("div", { className: "muted", children: ["Use placeholders like ", "{{client_name}}", " and keep variables as JSON."] })] }), doc && (_jsxs("div", { className: "row", style: { gap: 10, flexWrap: "wrap" }, children: [_jsx("button", { className: "btn btnGhost", onClick: () => exportDoc("txt"), disabled: saving, type: "button", children: "Download TXT" }), _jsx("button", { className: "btn btnGhost", onClick: () => exportDoc("pdf"), disabled: saving, type: "button", children: "Download PDF (stub)" }), _jsx("button", { className: "btn btnGhost", onClick: () => exportDoc("docx"), disabled: saving, type: "button", children: "Download DOCX (stub)" })] }))] }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: "Title" }), _jsx("input", { className: "input", value: title, onChange: (e) => setTitle(e.target.value), disabled: !editing })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: "Counterparty" }), _jsx("input", { className: "input", value: counterpartyName, onChange: (e) => setCounterpartyName(e.target.value), disabled: !editing })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: "Counterparty email" }), _jsx("input", { className: "input", value: counterpartyEmail, onChange: (e) => setCounterpartyEmail(e.target.value), disabled: !editing })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: "Content" }), _jsx("textarea", { className: "input", style: { minHeight: 220 }, value: content, onChange: (e) => setContent(e.target.value), disabled: !editing })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: "Variables (JSON)" }), _jsx("textarea", { className: "input", style: { minHeight: 160 }, value: varsText, onChange: (e) => setVarsText(e.target.value), disabled: !editing })] }), editing && (_jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("button", { className: "btn btnPrimary", onClick: save, disabled: saving, type: "button", children: saving ? "Saving…" : "Save changes" }) }))] }), _jsxs("div", { className: "cardSubsection", children: [_jsx("div", { className: "h3", children: "Preview" }), placeholders.length > 0 && (_jsx("div", { className: "row", style: { gap: 8, flexWrap: "wrap", margin: "10px 0" }, children: placeholders.map((p) => (_jsx("span", { className: "pill subtle", children: p }, p))) })), _jsx("textarea", { className: "input", style: { minHeight: 220 }, value: preview, readOnly: true })] })] })), tab === "versions" && (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Versions" }), _jsx("div", { className: "h3", children: "Saved snapshots" }), _jsx("div", { className: "muted", children: "A new version is created on every save." })] }) }), versions.length === 0 ? (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: "No versions" }), _jsx("div", { className: "emptyText", children: "Create or edit the document to generate versions." })] })) : (_jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "120px 1fr 140px" }, children: [_jsx("div", { children: "Version" }), _jsx("div", { children: "Created" }), _jsx("div", { children: "Actor" })] }), _jsx("div", { className: "tableBody", children: versions.map((v) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "120px 1fr 140px" }, children: [_jsxs("div", { children: ["v", v.version_number] }), _jsx("div", { className: "muted", children: new Date(v.created_at).toLocaleString() }), _jsx("div", { className: "muted", children: v.created_by ?? "—" })] }, v.id))) })] }))] })), tab === "approvals" && (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Approvals" }), _jsx("div", { className: "h3", children: "Review steps" }), _jsx("div", { className: "muted", children: "Approvals are created when submitting for review." })] }) }), doc?.approvals?.length ? (_jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "90px 120px 140px 1fr" }, children: [_jsx("div", { children: "Step" }), _jsx("div", { children: "Approver" }), _jsx("div", { children: "Decision" }), _jsx("div", { children: "Comment" })] }), _jsx("div", { className: "tableBody", children: doc.approvals.map((a) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "90px 120px 140px 1fr" }, children: [_jsxs("div", { children: ["#", a.step_number] }), _jsx("div", { className: "muted", children: a.approver_id }), _jsx("div", { children: _jsx("span", { className: `pill ${a.decision === "APPROVED" ? "" : "subtle"}`, children: a.decision }) }), _jsx("div", { className: "muted", children: a.comment || "—" })] }, a.id))) })] })) : (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: "No approvals" }), _jsx("div", { className: "emptyText", children: "Submit the document for review to start an approval workflow." })] }))] })), tab === "comments" && (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: "Comments" }), _jsx("div", { className: "emptyText", children: "Comments UI is coming soon. Use \u201CRequest changes\u201D for now." })] }) })), tab === "audit" && (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Audit log" }), _jsx("div", { className: "h3", children: "Document history" }), _jsx("div", { className: "muted", children: "All key actions are tracked server-side." })] }), _jsx("button", { className: "btn btnGhost", onClick: load, disabled: loading, type: "button", children: "Refresh" })] }), audit.length === 0 ? (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: "No audit entries" }), _jsx("div", { className: "emptyText", children: "Create, edit, and workflow actions will show up here." })] })) : (_jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "1fr 120px 160px" }, children: [_jsx("div", { children: "Action" }), _jsx("div", { children: "Actor" }), _jsx("div", { children: "When" })] }), _jsx("div", { className: "tableBody", children: audit.map((a) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "1fr 120px 160px" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: a.action }), a.metadata && Object.keys(a.metadata).length > 0 && (_jsx("div", { className: "muted", style: { fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: JSON.stringify(a.metadata) }))] }), _jsx("div", { className: "muted", children: a.actor_id ?? "—" }), _jsx("div", { className: "muted", children: new Date(a.created_at).toLocaleString() })] }, a.id))) })] }))] }))] }));
}
