import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import LocalizedNavLink from "../../router/LocalizedNavLink";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canEditLegal, canViewLegal } from "./legalAccess";
import LegalOverviewPage from "./LegalOverviewPage";
import LegalDocumentsPage from "./LegalDocumentsPage";
import LegalNewDocumentPage from "./LegalNewDocumentPage";
import LegalDocumentDetailPage from "./LegalDocumentDetailPage";
import LegalTemplatesPage from "./LegalTemplatesPage";
import LegalTemplateEditorPage from "./LegalTemplateEditorPage";
import LegalExamplesPage from "./LegalExamplesPage";
import Toast from "../../components/Toast";
import { useTranslation } from "react-i18next";
export default function LegalModule() {
    const { user } = useAuth();
    const locale = useLocale();
    const navigate = useNavigate();
    const { t: tLegal } = useTranslation("legal");
    const [toast, setToast] = React.useState(null);
    if (!canViewLegal(user)) {
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tLegal("module.noAccess.title") }), _jsx("div", { className: "emptyText", children: tLegal("module.noAccess.text") })] }) }));
    }
    const showCreate = canEditLegal(user);
    const pushToast = (message, tone = "info") => {
        setToast({ id: Date.now(), message, tone });
        setTimeout(() => setToast(null), 3200);
    };
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card toolbarCard", children: [_jsxs("div", { className: "toolbarLeft", children: [_jsx("div", { className: "eyebrow", children: tLegal("module.eyebrow") }), _jsx("div", { className: "h2", style: { marginBottom: 2 }, children: tLegal("module.title") }), _jsx("div", { className: "muted", children: tLegal("module.subtitle") })] }), _jsx("div", { className: "row", style: { gap: 10 }, children: showCreate && (_jsx("button", { className: "btn btnPrimary", onClick: () => navigate(`/${locale}/legal/documents/new`), children: tLegal("module.actions.createDocument") })) })] }), _jsxs("div", { className: "row", style: { gap: 10, flexWrap: "wrap" }, children: [_jsx(LocalizedNavLink, { to: "/legal", className: ({ isActive }) => `pill ${isActive ? "" : "subtle"}`, children: tLegal("module.tabs.overview") }), _jsx(LocalizedNavLink, { to: "/legal/documents", className: ({ isActive }) => `pill ${isActive ? "" : "subtle"}`, children: tLegal("module.tabs.documents") }), _jsx(LocalizedNavLink, { to: "/legal/templates", className: ({ isActive }) => `pill ${isActive ? "" : "subtle"}`, children: tLegal("module.tabs.templates") }), _jsx(LocalizedNavLink, { to: "/legal/examples", className: ({ isActive }) => `pill ${isActive ? "" : "subtle"}`, children: tLegal("module.tabs.examples") })] }), _jsxs(Routes, { children: [_jsx(Route, { index: true, element: _jsx(LegalOverviewPage, {}) }), _jsx(Route, { path: "documents", element: _jsx(LegalDocumentsPage, {}) }), _jsx(Route, { path: "documents/new", element: _jsx(LegalNewDocumentPage, { onToast: pushToast }) }), _jsx(Route, { path: "documents/:id", element: _jsx(LegalDocumentDetailPage, {}) }), _jsx(Route, { path: "templates", element: _jsx(LegalTemplatesPage, { onToast: pushToast }) }), _jsx(Route, { path: "templates/new", element: _jsx(LegalTemplateEditorPage, { mode: "create", onToast: pushToast }) }), _jsx(Route, { path: "templates/:id", element: _jsx(LegalTemplateEditorPage, { mode: "edit", onToast: pushToast }) }), _jsx(Route, { path: "examples", element: _jsx(LegalExamplesPage, { onToast: pushToast }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: `/${locale}/legal`, replace: true }) })] }), _jsx(Toast, { toast: toast })] }));
}
