import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useLocale } from "../../router/useLocale";
export default function LegalOverviewPage() {
    const locale = useLocale();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [q, setQ] = useState("");
    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.legalOverview();
            setData(res);
        }
        catch (e) {
            setError(e?.message || "Failed to load Legal overview.");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);
    const cards = useMemo(() => {
        const c = data?.counts || {};
        return [
            { key: "DRAFT", label: "Drafts", value: c.DRAFT ?? 0 },
            { key: "IN_REVIEW", label: "In Review", value: c.IN_REVIEW ?? 0 },
            { key: "APPROVED", label: "Approved", value: c.APPROVED ?? 0 },
            { key: "SIGNED", label: "Signed", value: c.SIGNED ?? 0 },
            { key: "REJECTED", label: "Rejected", value: c.REJECTED ?? 0 },
            { key: "EXPIRING_SOON", label: "Expiring Soon (30d)", value: data?.expiring_soon ?? 0 },
        ];
    }, [data]);
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { style: { width: "100%" }, children: [_jsx("div", { className: "eyebrow", children: "Legal overview" }), _jsx("div", { className: "h3", children: "Search documents" }), _jsxs("div", { className: "row", style: { gap: 10, marginTop: 10 }, children: [_jsx("input", { className: "input", placeholder: "Search by title, counterparty, or owner email\u2026", value: q, onChange: (e) => setQ(e.target.value) }), _jsx("button", { className: "btn btnPrimary", onClick: () => navigate(`/${locale}/legal/documents${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`), children: "Search" })] })] }) }), error && _jsx("div", { className: "errorBanner", children: error })] }), _jsx("div", { className: "grid twoCols", children: cards.map((c) => (_jsxs("div", { className: "statCard", children: [_jsx("div", { className: "muted", children: c.label }), _jsx("div", { className: "statValue", children: loading ? "…" : String(c.value) })] }, c.key))) }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Recent activity" }), _jsx("div", { className: "h3", children: "Audit trail (latest 20)" })] }), _jsx("button", { className: "btn btnGhost", onClick: load, disabled: loading, type: "button", children: "Refresh" })] }), !loading && data?.recent_activity?.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: "No activity yet" }), _jsx("div", { className: "emptyText", children: "Actions like create, edit, submit, approve, and exports will appear here." })] })), data?.recent_activity?.length ? (_jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "1fr 140px 140px auto" }, children: [_jsx("div", { children: "Action" }), _jsx("div", { children: "Actor" }), _jsx("div", { children: "When" }), _jsx("div", {})] }), _jsx("div", { className: "tableBody", children: data.recent_activity.map((a) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "1fr 140px 140px auto" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: a.action }), a.document_id && _jsxs("div", { className: "muted", children: ["Document #", a.document_id] })] }), _jsx("div", { className: "muted", children: a.actor_id ?? "—" }), _jsx("div", { className: "muted", children: new Date(a.created_at).toLocaleString() }), _jsx("div", { style: { textAlign: "right" }, children: a.document_id ? (_jsx("button", { className: "btn btnGhost", onClick: () => navigate(`/${locale}/legal/documents/${a.document_id}`), type: "button", children: "View" })) : (_jsx("span", { className: "muted", children: "\u2014" })) })] }, a.id))) })] })) : null] })] }));
}
