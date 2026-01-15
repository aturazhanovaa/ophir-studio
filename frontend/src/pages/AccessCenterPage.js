import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import AreaBadge from "../components/AreaBadge";
import { useTranslation } from "react-i18next";
export default function AccessCenterPage({ areas, accessMap, userRole, refreshAccess, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [catalog, setCatalog] = useState(areas);
    const [myRequests, setMyRequests] = useState([]);
    const [requestAreaId, setRequestAreaId] = useState("");
    const [requestReason, setRequestReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [adminRequests, setAdminRequests] = useState([]);
    const [loadingAdmin, setLoadingAdmin] = useState(false);
    const [users, setUsers] = useState([]);
    const [grantUserId, setGrantUserId] = useState("");
    const [grantAreaIds, setGrantAreaIds] = useState([]);
    const [granting, setGranting] = useState(false);
    const [decisionNotes, setDecisionNotes] = useState({});
    const [toast, setToast] = useState(null);
    const accessibleIds = useMemo(() => new Set(Object.keys(accessMap).map((k) => Number(k))), [accessMap]);
    const loadCatalog = async () => {
        try {
            const res = (await api.listAllAreas());
            setCatalog(res);
        }
        catch {
            setCatalog(areas);
        }
    };
    const loadMyRequests = async () => {
        try {
            const res = (await api.myAccessRequests());
            setMyRequests(res);
        }
        catch {
            setMyRequests([]);
        }
    };
    const loadAdminRequests = async () => {
        if (userRole !== "SUPER_ADMIN")
            return;
        setLoadingAdmin(true);
        try {
            const res = (await api.adminListAccessRequests("PENDING"));
            setAdminRequests(res);
        }
        catch {
            setAdminRequests([]);
        }
        finally {
            setLoadingAdmin(false);
        }
    };
    const loadUsers = async () => {
        if (userRole !== "SUPER_ADMIN")
            return;
        try {
            const res = (await api.adminListUsers());
            setUsers(res);
        }
        catch {
            setUsers([]);
        }
    };
    useEffect(() => {
        loadCatalog();
        loadMyRequests();
        loadAdminRequests();
        loadUsers();
    }, []);
    const statusLabel = (status) => {
        const normalized = (status || "").toUpperCase();
        if (normalized === "PENDING")
            return tCommon("status.pending");
        if (normalized === "APPROVED")
            return tCommon("status.approved");
        if (normalized === "REJECTED")
            return tCommon("status.rejected");
        return status || "—";
    };
    const submitRequest = async (e) => {
        e.preventDefault();
        if (!requestAreaId)
            return;
        setSubmitting(true);
        setToast(null);
        try {
            await api.createAccessRequests([Number(requestAreaId)], requestReason || undefined);
            setToast(tDash("accessCenter.toast.requestSubmitted"));
            setRequestAreaId("");
            setRequestReason("");
            await loadMyRequests();
        }
        catch (err) {
            setToast(err?.message || tDash("accessCenter.toast.unableToSubmit"));
        }
        finally {
            setSubmitting(false);
        }
    };
    const approve = async (req) => {
        try {
            await api.adminApproveRequest(req.id);
            setToast(tDash("accessCenter.toast.requestApproved"));
            await loadAdminRequests();
            refreshAccess();
        }
        catch (e) {
            setToast(e?.message || tDash("accessCenter.toast.approvalFailed"));
        }
    };
    const reject = async (req) => {
        try {
            const note = decisionNotes[req.id] || undefined;
            await api.adminRejectRequest(req.id, note);
            setDecisionNotes((prev) => ({ ...prev, [req.id]: "" }));
            setToast(tDash("accessCenter.toast.requestRejected"));
            await loadAdminRequests();
        }
        catch (e) {
            setToast(e?.message || tDash("accessCenter.toast.rejectionFailed"));
        }
    };
    const grantAccess = async (e) => {
        e.preventDefault();
        if (!grantUserId || grantAreaIds.length === 0)
            return;
        setGranting(true);
        setToast(null);
        try {
            await api.adminGrantAreas(Number(grantUserId), grantAreaIds);
            setToast(tDash("accessCenter.toast.accessGranted"));
            setGrantAreaIds([]);
            setGrantUserId("");
            await loadUsers();
            refreshAccess();
        }
        catch (err) {
            setToast(err?.message || tDash("accessCenter.toast.unableToGrant"));
        }
        finally {
            setGranting(false);
        }
    };
    const requestableAreas = catalog.filter((a) => !accessibleIds.has(a.id));
    return (_jsxs("div", { className: "pageStack", children: [toast && (_jsx("div", { className: "inlinePanel", children: _jsx("div", { className: "muted", children: toast }) })), _jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("accessCenter.eyebrow") }), _jsx("div", { className: "h2", children: tDash("accessCenter.title") }), _jsx("div", { className: "muted", children: tDash("accessCenter.subtitle") })] }) }), _jsxs("div", { className: "tagRow", style: { marginBottom: 12 }, children: [accessibleIds.size === 0 && _jsx("span", { className: "muted", children: tDash("accessCenter.noAccessYet") }), catalog
                                .filter((a) => accessibleIds.has(a.id))
                                .map((a) => (_jsx(AreaBadge, { name: a.name, color: a.color, size: "sm" }, a.id)))] }), _jsxs("div", { className: "cardSubsection", children: [_jsx("div", { className: "h3", children: tDash("accessCenter.requestAccess.title") }), _jsxs("form", { className: "formGrid", onSubmit: submitRequest, children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.area") }), _jsxs("select", { className: "input select", value: requestAreaId, onChange: (e) => setRequestAreaId(Number(e.target.value) || ""), children: [_jsx("option", { value: "", children: tDash("accessCenter.requestAccess.selectArea") }), requestableAreas.map((a) => (_jsx("option", { value: a.id, style: { color: a.color || undefined }, children: a.name }, a.id)))] })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.reason") }), _jsx("textarea", { className: "input", style: { minHeight: 80 }, value: requestReason, onChange: (e) => setRequestReason(e.target.value), placeholder: tCommon("placeholders.tellAdminWhy") })] }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("button", { className: "btn btnPrimary", type: "submit", disabled: submitting, children: submitting ? tCommon("actions.submitting") : tDash("accessCenter.requestAccess.submit") }) })] }), myRequests.length > 0 && (_jsxs("div", { className: "inlinePanel", style: { marginTop: 10 }, children: [_jsx("div", { className: "h3", children: tDash("accessCenter.recentRequests.title") }), _jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "1fr 1fr 120px" }, children: [_jsx("div", { children: tCommon("labels.area") }), _jsx("div", { children: tCommon("labels.message") }), _jsx("div", { children: tCommon("labels.status") })] }), _jsx("div", { className: "tableBody", children: myRequests.map((r) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "1fr 1fr 120px" }, children: [_jsx("div", { children: r.area ? _jsx(AreaBadge, { name: r.area.name, color: r.area.color, size: "sm" }) : "—" }), _jsx("div", { className: "muted", children: r.message || "—" }), _jsx("div", { children: _jsx("span", { className: `pill ${r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : "danger"}`, children: statusLabel(r.status) }) })] }, r.id))) })] })] }))] })] }), userRole === "SUPER_ADMIN" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("accessCenter.superAdmin.eyebrow") }), _jsx("div", { className: "h2", children: tDash("accessCenter.superAdmin.title") }), _jsx("div", { className: "muted", children: tDash("accessCenter.superAdmin.subtitle") })] }) }), loadingAdmin && _jsx("div", { className: "muted", children: tCommon("loading.loading") }), !loadingAdmin && adminRequests.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("accessCenter.superAdmin.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("accessCenter.superAdmin.empty.text") })] })), !loadingAdmin && adminRequests.length > 0 && (_jsx("div", { className: "inboxList", children: adminRequests.map((r) => (_jsxs("div", { className: "inboxRow", children: [_jsxs("div", { className: "inboxMain", children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: r.area ? _jsx(AreaBadge, { name: r.area.name, color: r.area.color, size: "sm" }) : tCommon("labels.area") }), _jsx("div", { className: "muted", style: { fontSize: 12 }, children: r.requester?.email })] }), _jsx("span", { className: "pill warning", children: statusLabel("PENDING") })] }), _jsx("div", { className: "muted", style: { marginTop: 6 }, children: r.message || tDash("accessCenter.superAdmin.noMessage") }), _jsx("div", { className: "muted", style: { fontSize: 12, marginTop: 4 }, children: tDash("accessCenter.superAdmin.requestedOn", { date: new Date(r.created_at).toLocaleDateString() }) })] }), _jsxs("div", { className: "row", style: { gap: 8 }, children: [_jsx("button", { className: "btn btnPrimary", onClick: () => approve(r), children: tDash("accessCenter.superAdmin.approve") }), _jsx("button", { className: "btn btnDangerGhost", onClick: () => reject(r), children: tDash("accessCenter.superAdmin.reject") })] }), _jsxs("div", { className: "inlinePanel", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tDash("accessCenter.superAdmin.decisionNote.label") }), _jsx("textarea", { className: "input", style: { minHeight: 60 }, value: decisionNotes[r.id] || "", onChange: (e) => setDecisionNotes((prev) => ({ ...prev, [r.id]: e.target.value })), placeholder: tDash("accessCenter.superAdmin.decisionNote.placeholder") })] })] }, r.id))) }))] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("accessCenter.manual.eyebrow") }), _jsx("div", { className: "h2", children: tDash("accessCenter.manual.title") }), _jsx("div", { className: "muted", children: tDash("accessCenter.manual.subtitle") })] }) }), _jsxs("form", { className: "formGrid", onSubmit: grantAccess, children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tDash("accessCenter.manual.user") }), _jsxs("select", { className: "input select", value: grantUserId, onChange: (e) => setGrantUserId(Number(e.target.value) || ""), children: [_jsx("option", { value: "", children: tDash("accessCenter.manual.selectUser") }), users.map((u) => (_jsxs("option", { value: u.id, children: [u.full_name || u.email, " (", u.role, ")"] }, u.id)))] })] }), _jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: tDash("accessCenter.manual.areasToGrant") }), _jsx("div", { className: "checkGrid", children: catalog.map((a) => (_jsxs("label", { className: "checkRow", children: [_jsx("input", { type: "checkbox", checked: grantAreaIds.includes(a.id), onChange: (e) => {
                                                                if (e.target.checked)
                                                                    setGrantAreaIds((prev) => [...prev, a.id]);
                                                                else
                                                                    setGrantAreaIds((prev) => prev.filter((id) => id !== a.id));
                                                            } }), _jsx(AreaBadge, { name: a.name, color: a.color, size: "sm" }), _jsx("span", { className: "muted", children: a.key })] }, a.id))) })] }), _jsx("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: _jsx("button", { className: "btn btnPrimary", type: "submit", disabled: granting, children: granting ? tDash("documentDetails.actions.saving") : tDash("accessCenter.manual.grantAccess") }) })] })] })] }))] }));
}
