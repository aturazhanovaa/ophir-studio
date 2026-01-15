import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import ConfirmModal from "./ConfirmModal";
import { useTranslation } from "react-i18next";
export default function MyAccessPanel({ areas, accessMap, onRefresh, onSelectArea, pushToast, isSuperAdmin = false, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [catalog, setCatalog] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedAreaIds, setSelectedAreaIds] = useState([]);
    const [message, setMessage] = useState("");
    const [formError, setFormError] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const loadCatalog = async () => {
        try {
            const res = (await api.listAllAreas());
            setCatalog(res);
        }
        catch (e) {
            // ignore
        }
    };
    const loadRequests = async () => {
        setLoading(true);
        try {
            const res = (await api.myAccessRequests());
            setRequests(res);
        }
        catch (e) {
            pushToast(e.message || tDash("myAccess.errors.failedToLoadRequests"), "danger");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadCatalog();
        loadRequests();
    }, []);
    const availableToRequest = useMemo(() => catalog.filter((a) => !accessMap[a.id]), [catalog, accessMap]);
    const pendingAreaIds = useMemo(() => requests
        .filter((r) => r.status === "PENDING")
        .map((r) => r.area_id), [requests]);
    const statusTone = {
        PENDING: "warning",
        APPROVED: "success",
        REJECTED: "danger",
        CANCELLED: "subtle",
    };
    const selectableAreas = availableToRequest.filter((a) => !pendingAreaIds.includes(a.id));
    const onSubmitRequest = async () => {
        setFormError(null);
        if (!selectedAreaIds.length) {
            setFormError(selectableAreas.length === 0
                ? tDash("myAccess.requestModal.errors.noAreasAvailable")
                : tDash("myAccess.requestModal.errors.selectAtLeastOne"));
            return;
        }
        try {
            await api.createAccessRequests(selectedAreaIds, message || undefined);
            pushToast(tDash("myAccess.toast.requestSent"), "success");
            setShowModal(false);
            setSelectedAreaIds([]);
            setMessage("");
            await loadRequests();
        }
        catch (e) {
            setFormError(e.message || tDash("myAccess.requestModal.errors.failedToSubmit"));
        }
    };
    const cancelRequest = async () => {
        if (!cancelTarget)
            return;
        try {
            await api.cancelAccessRequest(cancelTarget.id);
            pushToast(tDash("myAccess.toast.requestCancelled"), "info");
            setCancelTarget(null);
            await loadRequests();
            await onRefresh();
        }
        catch (e) {
            pushToast(e.message || tDash("myAccess.errors.failedToCancel"), "danger");
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("myAccess.eyebrow") }), _jsx("div", { className: "h2", children: tDash("myAccess.title") }), _jsx("div", { className: "muted", children: tDash("myAccess.subtitle") })] }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn", onClick: onRefresh, children: tDash("myAccess.refresh") }), !isSuperAdmin && (_jsx("button", { className: "btn btnPrimary", onClick: () => setShowModal(true), children: tDash("myAccess.requestAccess") }))] })] }), _jsxs("div", { className: "cardBody", children: [_jsxs("div", { className: "cardSubsection", children: [_jsx("div", { className: "h3", children: tDash("myAccess.allowedAreas.title") }), _jsxs("div", { className: "grid twoCols", children: [areas.length === 0 && _jsx("span", { className: "muted", children: tDash("myAccess.allowedAreas.none") }), areas.map((a) => (_jsxs("div", { className: "card", style: { boxShadow: "none", borderStyle: "dashed" }, children: [_jsx("div", { className: "h3", style: { marginBottom: 4 }, children: a.name }), _jsx("div", { className: "muted", children: a.key }), _jsx("div", { className: "tagRow", style: { marginTop: 8 }, children: _jsx("span", { className: "pill success", children: tCommon("status.approved") }) }), _jsx("button", { className: "btn", style: { marginTop: 10 }, onClick: () => onSelectArea(a.id), children: tCommon("actions.open") })] }, a.id)))] })] }), _jsxs("div", { className: "cardSubsection", children: [_jsx("div", { className: "h3", children: tDash("myAccess.history.title") }), loading && _jsx("div", { className: "muted", children: tDash("myAccess.history.loading") }), !loading && requests.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("myAccess.history.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("myAccess.history.empty.text") })] })), !loading && requests.length > 0 && (_jsx("div", { className: "grid twoCols", children: requests.map((r) => (_jsxs("div", { className: "card", style: { boxShadow: "none", borderStyle: "dashed" }, children: [_jsx("div", { className: "h3", children: r.area?.name || tCommon("labels.area") }), _jsxs("div", { className: "tagRow", style: { marginTop: 4 }, children: [_jsx("span", { className: `pill ${statusTone[r.status] || ""}`, children: tDash(`myAccess.status.${r.status.toLowerCase()}`) }), r.message && _jsx("span", { className: "pill subtle", children: tDash("myAccess.history.note") })] }), _jsx("div", { className: "muted", style: { marginTop: 8 }, children: r.message || tDash("myAccess.history.noMessage") }), _jsx("div", { className: "muted", style: { fontSize: 12, marginTop: 6 }, children: tDash("myAccess.history.requestedOn", { date: new Date(r.created_at).toLocaleDateString() }) }), _jsxs("div", { className: "row", style: { gap: 8, marginTop: 10 }, children: [r.status === "PENDING" && (_jsx("button", { className: "btn btnGhost", onClick: () => setCancelTarget(r), children: tCommon("actions.cancel") })), r.status === "APPROVED" && accessMap[r.area_id] && (_jsx("button", { className: "btn", onClick: () => onSelectArea(r.area_id), children: tDash("myAccess.history.goToArea") }))] })] }, r.id))) }))] })] }), !isSuperAdmin && showModal && (_jsx("div", { className: "modalOverlay", onClick: (e) => e.target === e.currentTarget && setShowModal(false), children: _jsxs("div", { className: "card modalCard", children: [_jsx("div", { className: "h3", children: tDash("myAccess.requestModal.title") }), _jsx("div", { className: "muted", style: { marginBottom: 10 }, children: tDash("myAccess.requestModal.subtitle") }), _jsxs("div", { className: "cardSubsection", style: { maxHeight: 280, overflowY: "auto" }, children: [availableToRequest.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("myAccess.requestModal.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("myAccess.requestModal.empty.text") })] })), availableToRequest.map((a) => {
                                    const disabled = pendingAreaIds.includes(a.id);
                                    const checked = selectedAreaIds.includes(a.id);
                                    return (_jsxs("label", { className: "row", style: { justifyContent: "space-between" }, children: [_jsxs("div", { className: "row", style: { alignItems: "center", gap: 10 }, children: [_jsx("input", { type: "checkbox", checked: checked || disabled, disabled: disabled, onChange: (e) => {
                                                            if (e.target.checked)
                                                                setSelectedAreaIds([...selectedAreaIds, a.id]);
                                                            else
                                                                setSelectedAreaIds(selectedAreaIds.filter((id) => id !== a.id));
                                                        } }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600 }, children: a.name }), _jsx("div", { className: "muted", children: a.key })] })] }), disabled && _jsx("span", { className: "pill warning", children: tCommon("status.pending") })] }, a.id));
                                })] }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tDash("myAccess.requestModal.messageLabel") }), _jsx("textarea", { className: "input", placeholder: tDash("myAccess.requestModal.messagePlaceholder"), value: message, onChange: (e) => setMessage(e.target.value), style: { minHeight: 80 } }), formError && _jsx("div", { className: "formError", children: formError }), _jsxs("div", { className: "modalActions", children: [_jsx("button", { className: "btn", onClick: () => setShowModal(false), children: tCommon("actions.close") }), _jsx("button", { className: "btn btnPrimary", onClick: onSubmitRequest, disabled: selectableAreas.length === 0, children: tDash("myAccess.requestModal.submit") })] })] }) })), cancelTarget && (_jsx(ConfirmModal, { title: tDash("myAccess.cancelModal.title"), message: tDash("myAccess.cancelModal.message"), confirmLabel: tDash("myAccess.cancelModal.confirm"), onClose: () => setCancelTarget(null), onConfirm: cancelRequest }))] }));
}
