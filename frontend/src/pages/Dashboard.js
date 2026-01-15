import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AnalyticsPanel from "../components/AnalyticsPanel";
import Toast from "../components/Toast";
import AccessRequestsPanel from "../components/AccessRequestsPanel";
import UsersPanel from "../components/UsersPanel";
import AppShell from "../components/AppShell";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { stripLocalePrefix } from "../i18n/locale";
import { useLocale } from "../router/useLocale";
import DocumentsPage from "./DocumentsPage";
import DocumentDetailsPage from "./DocumentDetailsPage";
import AccessCenterPage from "./AccessCenterPage";
import OverviewPage from "./OverviewPage";
import AskAIPage from "./AskAIPage";
import PlaygroundPage from "./PlaygroundPage";
import TagsAdminPage from "./TagsAdminPage";
import CaseStudiesPage from "./CaseStudiesPage";
import VerifyPage from "./VerifyPage";
import KnowledgeBasePage from "./KnowledgeBasePage";
import { useTranslation } from "react-i18next";
export default function Dashboard() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const locale = useLocale();
    const { t: tDash } = useTranslation("dashboard");
    const [areas, setAreas] = useState([]);
    const [areasLoading, setAreasLoading] = useState(false);
    const [accessMap, setAccessMap] = useState({});
    const [selectedAreaId, setSelectedAreaId] = useState(null);
    const [err, setErr] = useState(null);
    const [toast, setToast] = useState(null);
    const pushToast = (message, tone = "info") => {
        setToast({ id: Date.now(), message, tone });
        setTimeout(() => setToast(null), 3200);
    };
    const canManageArea = (areaId) => {
        if (!areaId)
            return false;
        if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN")
            return true;
        const m = accessMap[areaId];
        return !!m;
    };
    const loadAreas = async () => {
        setAreasLoading(true);
        try {
            const a = await api.listAreas();
            setAreas(a);
        }
        catch (e) {
            const message = e?.message || "Failed to load areas.";
            if (/unauthenticated|unauthorized/i.test(message)) {
                logout();
                return;
            }
            setErr(message);
        }
        finally {
            setAreasLoading(false);
        }
    };
    const loadAccess = async () => {
        try {
            const mems = (await api.myMemberships());
            const map = {};
            mems.forEach((m) => (map[m.area_id] = m));
            setAccessMap(map);
        }
        catch {
            // ignore
        }
    };
    useEffect(() => {
        loadAreas();
        loadAccess();
    }, []);
    useEffect(() => {
        if (!areas.length)
            return;
        if (selectedAreaId && !areas.find((a) => a.id === selectedAreaId)) {
            setSelectedAreaId(areas[0].id);
        }
        else if (!selectedAreaId) {
            setSelectedAreaId(areas[0].id);
        }
    }, [areas, selectedAreaId]);
    const pageTitle = useMemo(() => {
        const { restPath } = stripLocalePrefix(location.pathname);
        const path = restPath;
        if (path.startsWith("/dashboard"))
            return tDash("pageTitles.dashboard");
        if (path.startsWith("/areas") || path.startsWith("/access"))
            return tDash("pageTitles.accessCenter");
        if (path.startsWith("/documents/"))
            return tDash("pageTitles.documentDetails");
        if (path.startsWith("/documents"))
            return tDash("pageTitles.documents");
        if (path.startsWith("/case-studies"))
            return tDash("pageTitles.caseStudies");
        if (path.startsWith("/analytics"))
            return tDash("pageTitles.analytics");
        if (path.startsWith("/knowledge-base"))
            return tDash("pageTitles.knowledgeBase");
        if (path.startsWith("/admin/users"))
            return tDash("pageTitles.adminUsers");
        if (path.startsWith("/admin/tags"))
            return tDash("pageTitles.adminTags");
        if (path.startsWith("/admin/verify"))
            return tDash("pageTitles.verification");
        if (path.startsWith("/admin/requests"))
            return tDash("pageTitles.adminAccessRequests");
        if (path.startsWith("/admin/settings"))
            return tDash("pageTitles.adminSettings");
        if (path.startsWith("/ask"))
            return tDash("pageTitles.askAi");
        if (path.startsWith("/playground"))
            return tDash("pageTitles.playground");
        return tDash("pageTitles.workspace");
    }, [location.pathname, tDash]);
    return (_jsxs(AppShell, { user: user, onLogout: logout, topBar: {
            areas,
            selectedAreaId,
            onSelectArea: (id) => setSelectedAreaId(id),
            onRequestAccess: () => navigate(`/${locale}/access`),
            pageTitle,
            breadcrumb: tDash("breadcrumb"),
            showSearch: true,
            showAreaSelector: stripLocalePrefix(location.pathname).restPath.startsWith("/documents") ||
                stripLocalePrefix(location.pathname).restPath.startsWith("/analytics"),
            primaryActionLabel: tDash("primaryAction"),
            showPrimaryAction: user?.role !== "SUPER_ADMIN",
        }, children: [err && (_jsx("div", { className: "card errorBanner", style: { border: "1px solid rgba(239,68,68,0.3)" }, children: err })), _jsx("div", { className: "pageContainer", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/:locale/dashboard", element: _jsx(OverviewPage, { areas: areas, accessMap: accessMap, loading: areasLoading, isSuperAdmin: user?.role === "SUPER_ADMIN", onOpenAccess: () => navigate(`/${locale}/access`), onOpenDocuments: () => navigate(`/${locale}/documents`), onOpenAsk: () => navigate(`/${locale}/ask`) }) }), _jsx(Route, { path: "/:locale/areas", element: _jsx(Navigate, { to: `/${locale}/access`, replace: true }) }), _jsx(Route, { path: "/:locale/access", element: _jsx(AccessCenterPage, { areas: areas, accessMap: accessMap, userRole: user?.role, refreshAccess: () => {
                                    loadAreas();
                                    loadAccess();
                                } }) }), _jsx(Route, { path: "/:locale/documents", element: _jsx(DocumentsPage, { areaId: selectedAreaId, canManage: canManageArea, areas: areas, onSelectArea: (id) => setSelectedAreaId(id) }) }), _jsx(Route, { path: "/:locale/case-studies", element: _jsx(CaseStudiesPage, {}) }), _jsx(Route, { path: "/:locale/knowledge-base", element: _jsx(KnowledgeBasePage, {}) }), _jsx(Route, { path: "/:locale/documents/:docId", element: _jsx(DocumentDetailsPage, { areas: areas, canManage: canManageArea, onSelectArea: (id) => setSelectedAreaId(id) }) }), _jsx(Route, { path: "/:locale/playground", element: _jsx(PlaygroundPage, {}) }), _jsx(Route, { path: "/:locale/analytics", element: _jsx(AnalyticsPanel, { areaId: selectedAreaId, areas: areas }) }), _jsx(Route, { path: "/:locale/ask", element: _jsx(AskAIPage, { areas: areas, selectedAreaId: selectedAreaId, onSelectArea: (id) => setSelectedAreaId(id) }) }), _jsx(Route, { path: "/:locale/admin/users", element: user?.role === "SUPER_ADMIN" ? (_jsx(UsersPanel, { onToast: pushToast, refreshMyAccess: () => {
                                    loadAreas();
                                    loadAccess();
                                } })) : (_jsx(Navigate, { to: `/${locale}/documents`, replace: true })) }), _jsx(Route, { path: "/:locale/admin/tags", element: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" ? (_jsx(TagsAdminPage, {})) : (_jsx(Navigate, { to: `/${locale}/knowledge-base`, replace: true })) }), _jsx(Route, { path: "/:locale/admin/verify", element: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" ? (_jsx(VerifyPage, {})) : (_jsx(Navigate, { to: `/${locale}/dashboard`, replace: true })) }), _jsx(Route, { path: "/:locale/admin/requests", element: user?.role === "SUPER_ADMIN" ? (_jsx(AccessRequestsPanel, { onToast: pushToast, refreshMyAccess: () => {
                                    loadAreas();
                                    loadAccess();
                                } })) : (_jsx(Navigate, { to: `/${locale}/documents`, replace: true })) }), _jsx(Route, { path: "/:locale/admin/settings", element: user?.role === "SUPER_ADMIN" ? (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("settings.comingSoonTitle") }), _jsx("div", { className: "emptyText", children: tDash("settings.comingSoonText") })] }) })) : (_jsx(Navigate, { to: `/${locale}/documents`, replace: true })) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: `/${locale}/dashboard`, replace: true }) })] }) }), _jsx(Toast, { toast: toast })] }));
}
