import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import AreaBadge from "./AreaBadge";
import { useTranslation } from "react-i18next";
export default function AreasPanel({ userRole, accessMap, onOpenArea, pushToast, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState([]);
    const loadCatalog = async () => {
        setLoading(true);
        try {
            const res = (await api.listAllAreas());
            setCatalog(res);
        }
        catch (e) {
            pushToast(e.message || tDash("areasPanel.errors.failedToLoadAreas"), "danger");
        }
        finally {
            setLoading(false);
        }
    };
    const loadRequests = async () => {
        try {
            const res = (await api.myAccessRequests());
            setRequests(res);
        }
        catch {
            // ignore
        }
    };
    useEffect(() => {
        loadCatalog();
        loadRequests();
    }, []);
    const accessibleIds = new Set(Object.keys(accessMap).map((k) => Number(k)));
    const pendingByArea = useMemo(() => {
        const m = {};
        requests.forEach((r) => {
            if (r.status === "PENDING")
                m[r.area_id] = r;
        });
        return m;
    }, [requests]);
    const requestArea = async (areaId) => {
        try {
            await api.createAccessRequests([areaId]);
            pushToast(tDash("accessCenter.toast.requestSubmitted"), "success");
            await loadRequests();
        }
        catch (e) {
            pushToast(e.message || tDash("areasPanel.errors.unableToRequest"), "danger");
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("areasPanel.eyebrow") }), _jsx("div", { className: "h2", children: tDash("areasPanel.title") }), _jsx("div", { className: "muted", children: tDash("areasPanel.subtitle") })] }) }), loading && _jsx("div", { className: "muted", children: tDash("areasPanel.loadingAreas") }), !loading && (_jsx("div", { className: "grid twoCols", children: catalog.map((area) => {
                    const hasAccess = accessibleIds.has(area.id) || userRole === "SUPER_ADMIN";
                    const pending = pendingByArea[area.id];
                    return (_jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between", alignItems: "center" }, children: [_jsx(AreaBadge, { name: area.name, color: area.color, size: "sm" }), _jsx("div", { className: "muted small", children: tDash("areasPanel.key", { key: area.key }) })] }), _jsxs("div", { className: "tagRow", style: { marginBottom: 12 }, children: [hasAccess && _jsx("span", { className: "pill success", children: tCommon("status.approved") }), !hasAccess && pending && _jsx("span", { className: "pill warning", children: tCommon("status.pending") }), !hasAccess && !pending && _jsx("span", { className: "pill warning", children: tDash("areasPanel.requestNeeded") })] }), hasAccess ? (_jsx("button", { className: "btn", onClick: () => onOpenArea(area.id), children: tCommon("actions.open") })) : (userRole !== "SUPER_ADMIN" && (_jsx("button", { className: "btn btnPrimary", onClick: () => requestArea(area.id), disabled: !!pending, children: pending ? tDash("areasPanel.requested") : tDash("areasPanel.requestAccess") }))), userRole === "SUPER_ADMIN" && _jsx("div", { className: "muted", style: { marginTop: 8, fontSize: 12 }, children: tDash("areasPanel.superAdminHasAccess") })] }, area.id));
                }) }))] }));
}
