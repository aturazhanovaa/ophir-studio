import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canEditLegal } from "./legalAccess";
const STATUS_OPTIONS = [
    { value: "", label: "All statuses" },
    { value: "DRAFT", label: "Draft" },
    { value: "IN_REVIEW", label: "In Review" },
    { value: "CHANGES_REQUESTED", label: "Changes Requested" },
    { value: "APPROVED", label: "Approved" },
    { value: "SIGNED", label: "Signed" },
    { value: "REJECTED", label: "Rejected" },
    { value: "ARCHIVED", label: "Archived" },
];
function downloadBlob(blob, filename) {
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
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [q, setQ] = useState(initialQ);
    const [status, setStatus] = useState("");
    const [type, setType] = useState("");
    const [counterparty, setCounterparty] = useState("");
    const [sort, setSort] = useState("updated");
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
        }
        catch (e) {
            setError(e?.message || "Failed to load legal documents.");
            setDocs([]);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, [q, status, type, counterparty, sort]);
    useEffect(() => {
        if (initialQ !== q)
            setQ(initialQ);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialQ]);
    const types = useMemo(() => {
        const set = new Set();
        docs.forEach((d) => {
            if (d.type)
                set.add(d.type);
        });
        return Array.from(set).sort();
    }, [docs]);
    const handleExport = async (doc, format) => {
        try {
            const { blob, filename } = await api.exportLegalDocument(doc.id, format);
            downloadBlob(blob, filename);
        }
        catch (e) {
            setError(e?.message || "Export failed.");
        }
    };
    const handleArchive = async (doc) => {
        if (!canEdit)
            return;
        const ok = window.confirm(`Archive “${doc.title}”?`);
        if (!ok)
            return;
        try {
            await api.archiveLegalDocument(doc.id);
            await load();
        }
        catch (e) {
            setError(e?.message || "Archive failed.");
        }
    };
    const handleSubmitReview = async (doc) => {
        if (!canEdit)
            return;
        try {
            await api.submitLegalDocumentForReview(doc.id, {});
            await load();
        }
        catch (e) {
            setError(e?.message || "Submit for review failed.");
        }
    };
    const handleDuplicate = async (doc) => {
        if (!canEdit)
            return;
        try {
            const created = await api.duplicateLegalDocument(doc.id);
            navigate(`/${locale}/legal/documents/${created.id}?edit=1`);
        }
        catch (e) {
            setError(e?.message || "Duplicate failed.");
        }
    };
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Documents" }), _jsx("div", { className: "h3", children: "All legal documents" }), _jsx("div", { className: "muted", children: "Filter by status, type, and counterparty." })] }), canEdit && (_jsx("button", { className: "btn btnPrimary", onClick: () => navigate(`/${locale}/legal/documents/new`), type: "button", children: "New document" }))] }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: "Search" }), _jsx("input", { className: "input", value: q, onChange: (e) => setQ(e.target.value), placeholder: "Title, counterparty, owner email\u2026" })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: "Status" }), _jsx("select", { className: "input select", value: status, onChange: (e) => setStatus(e.target.value), children: STATUS_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value || "ALL"))) })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: "Type" }), _jsx("input", { className: "input", value: type, onChange: (e) => setType(e.target.value), placeholder: types.length ? `e.g. ${types[0]}` : "e.g. MSA" })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: "Counterparty" }), _jsx("input", { className: "input", value: counterparty, onChange: (e) => setCounterparty(e.target.value), placeholder: "Company / client name" })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: "Sort" }), _jsxs("select", { className: "input select", value: sort, onChange: (e) => setSort(e.target.value), children: [_jsx("option", { value: "updated", children: "Last updated" }), _jsx("option", { value: "expiry", children: "Expiry date" })] })] }), _jsx("div", { className: "formGroup", style: { alignSelf: "end" }, children: _jsx("button", { className: "btn", onClick: load, disabled: loading, type: "button", children: "Refresh" }) })] }), error && _jsx("div", { className: "errorBanner", children: error })] }), !loading && docs.length === 0 && (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: "No documents" }), _jsx("div", { className: "emptyText", children: canEdit ? "Create your first legal document to get started." : "No legal documents are available." })] }) })), docs.length > 0 && (_jsx("div", { className: "card", children: _jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "1.2fr 0.8fr 0.9fr 0.6fr 0.8fr 0.8fr auto" }, children: [_jsx("div", { children: "Title" }), _jsx("div", { children: "Type" }), _jsx("div", { children: "Counterparty" }), _jsx("div", { children: "Status" }), _jsx("div", { children: "Owner" }), _jsx("div", { children: "Updated" }), _jsx("div", {})] }), _jsx("div", { className: "tableBody", children: docs.map((d) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "1.2fr 0.8fr 0.9fr 0.6fr 0.8fr 0.8fr auto" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: d.title }), d.expiry_date && _jsxs("div", { className: "muted", children: ["Expiry: ", new Date(d.expiry_date).toLocaleDateString()] })] }), _jsx("div", { className: "muted", children: d.type }), _jsx("div", { className: "muted", children: d.counterparty_name || "—" }), _jsx("div", { children: _jsx("span", { className: `pill ${d.status === "APPROVED" || d.status === "SIGNED" ? "" : "subtle"}`, children: d.status }) }), _jsx("div", { className: "muted", children: d.owner_name || d.owner_email || `#${d.owner_id}` }), _jsx("div", { className: "muted", children: new Date(d.updated_at).toLocaleString() }), _jsxs("div", { style: { textAlign: "right" }, className: "row", children: [_jsx("button", { className: "btn btnGhost", onClick: () => navigate(`/${locale}/legal/documents/${d.id}`), type: "button", children: "View" }), canEdit && (d.status === "DRAFT" || d.status === "CHANGES_REQUESTED") && (_jsx("button", { className: "btn btnGhost", onClick: () => navigate(`/${locale}/legal/documents/${d.id}?edit=1`), type: "button", children: "Edit" })), canEdit && (_jsx("button", { className: "btn btnGhost", onClick: () => handleDuplicate(d), type: "button", children: "Duplicate" })), canEdit && (d.status === "DRAFT" || d.status === "CHANGES_REQUESTED") && (_jsx("button", { className: "btn btnGhost", onClick: () => handleSubmitReview(d), type: "button", children: "Submit" })), _jsx("button", { className: "btn btnGhost", onClick: () => handleExport(d, "docx"), type: "button", children: "Download" }), canEdit && d.status !== "ARCHIVED" && (_jsx("button", { className: "btn btnGhost", onClick: () => handleArchive(d), type: "button", children: "Archive" }))] })] }, d.id))) })] }) }))] }));
}
