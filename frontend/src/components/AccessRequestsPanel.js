import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import AreaBadge from "./AreaBadge";
import { useTranslation } from "react-i18next";
export default function AccessRequestsPanel({ onToast, refreshMyAccess, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState("PENDING");
    const [decisionNotes, setDecisionNotes] = useState({});
    const loadRequests = async () => {
        setLoading(true);
        try {
            const res = (await api.adminListAccessRequests(statusFilter === "PENDING" ? "PENDING" : undefined));
            setRequests(res);
        }
        catch (e) {
            onToast(e.message || tDash("accessRequests.errors.failedToLoad"), "danger");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadRequests();
    }, [statusFilter]);
    const approveRequest = async (req) => {
        try {
            await api.adminApproveRequest(req.id);
            onToast(tDash("accessCenter.toast.requestApproved"), "success");
            await loadRequests();
            refreshMyAccess();
        }
        catch (e) {
            onToast(e.message || tDash("accessRequests.errors.failedToApprove"), "danger");
        }
    };
    const rejectRequest = async (req) => {
        try {
            const note = decisionNotes[req.id] || undefined;
            await api.adminRejectRequest(req.id, note);
            onToast(tDash("accessCenter.toast.requestRejected"), "info");
            setDecisionNotes((prev) => ({ ...prev, [req.id]: "" }));
            await loadRequests();
        }
        catch (e) {
            onToast(e.message || tDash("accessRequests.errors.failedToReject"), "danger");
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("accessCenter.superAdmin.eyebrow") }), _jsx("div", { className: "h2", children: tDash("accessRequests.title") }), _jsx("div", { className: "muted", children: tDash("accessRequests.subtitle") })] }), _jsxs("div", { className: "row", children: [_jsx("button", { className: `btn ${statusFilter === "PENDING" ? "btnPrimary" : ""}`, onClick: () => setStatusFilter("PENDING"), children: tCommon("status.pending") }), _jsx("button", { className: `btn ${statusFilter === "ALL" ? "btnPrimary" : ""}`, onClick: () => setStatusFilter("ALL"), children: tDash("accessRequests.filters.all") })] })] }), loading && _jsx("div", { className: "muted", children: tDash("myAccess.history.loading") }), !loading && requests.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("accessRequests.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("accessCenter.superAdmin.empty.text") })] })), !loading && requests.length > 0 && (_jsx("div", { className: "inboxList", children: requests.map((r) => (_jsxs("div", { className: "inboxRow", children: [_jsxs("div", { className: "inboxMain", children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: r.area ? _jsx(AreaBadge, { name: r.area.name, color: r.area.color, size: "sm" }) : tCommon("labels.area") }), _jsx("div", { className: "muted", style: { fontSize: 12 }, children: r.requester?.email })] }), _jsx("span", { className: `pill ${r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : "danger"}`, children: r.status === "PENDING" ? tCommon("status.pending") : r.status === "APPROVED" ? tCommon("status.approved") : tCommon("status.rejected") })] }), _jsx("div", { className: "muted", style: { marginTop: 6 }, children: r.message || tDash("accessCenter.superAdmin.noMessage") }), _jsx("div", { className: "muted", style: { fontSize: 12, marginTop: 4 }, children: tDash("accessCenter.superAdmin.requestedOn", { date: new Date(r.created_at).toLocaleDateString() }) })] }), _jsx("div", { className: "row", style: { gap: 8 }, children: r.status === "PENDING" ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btnPrimary", onClick: () => approveRequest(r), children: tDash("accessCenter.superAdmin.approve") }), _jsx("button", { className: "btn btnDangerGhost", onClick: () => rejectRequest(r), children: tDash("accessCenter.superAdmin.reject") })] })) : (_jsx("div", { className: "muted", style: { fontSize: 12 }, children: r.decided_by_user_id ? tDash("accessRequests.decidedOn", { date: new Date(r.decided_at || "").toLocaleDateString() }) : "" })) }), r.status === "PENDING" && (_jsxs("div", { className: "inlinePanel", children: [_jsx("label", { className: "fieldLabel", children: tDash("accessCenter.superAdmin.decisionNote.label") }), _jsx("textarea", { className: "input", style: { minHeight: 70 }, value: decisionNotes[r.id] || "", onChange: (e) => setDecisionNotes((prev) => ({ ...prev, [r.id]: e.target.value })), placeholder: tDash("accessCenter.superAdmin.decisionNote.placeholder") })] }))] }, r.id))) }))] }));
}
