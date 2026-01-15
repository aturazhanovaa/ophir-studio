import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import LocalizedNavLink from "../router/LocalizedNavLink";
import { useTranslation } from "react-i18next";
export default function Sidebar({ user, onLogout, onClose, }) {
    const { t: tNav } = useTranslation("nav");
    const { t: tCommon } = useTranslation("common");
    const [adminOpen, setAdminOpen] = useState(true);
    const navItems = [
        { label: tNav("items.dashboard"), path: "/dashboard" },
        { label: tNav("items.documents"), path: "/documents" },
        { label: tNav("items.knowledgeBase"), path: "/knowledge-base" },
        { label: tNav("items.askAi"), path: "/ask" },
        { label: tNav("items.playground"), path: "/playground" },
        { label: tNav("items.analytics"), path: "/analytics" },
    ];
    if (user?.role !== "SUPER_ADMIN") {
        navItems.push({ label: tNav("items.access"), path: "/access" });
    }
    if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
        navItems.push({ label: tNav("items.tagAdmin"), path: "/admin/tags" });
        navItems.push({ label: tNav("items.verification"), path: "/admin/verify" });
    }
    const handleNavClick = () => {
        if (onClose)
            onClose();
    };
    return (_jsxs("div", { className: "sidebar", children: [_jsxs("div", { className: "sidebarHeader", children: [_jsxs("div", { className: "brandMark", children: [_jsx("span", { className: "brandCircle" }), _jsx("span", { children: tCommon("app.brand") })] }), onClose && (_jsx("button", { className: "btn btnGhost sidebarClose", onClick: onClose, type: "button", "aria-label": tNav("aria.closeNavigation"), children: tCommon("actions.close") }))] }), _jsxs("div", { className: "navList", children: [_jsx("div", { className: "eyebrow", children: tNav("navigation") }), navItems.map((item) => (_jsx(LocalizedNavLink, { to: item.path, onClick: handleNavClick, className: ({ isActive }) => `navItem ${isActive ? "navItemActive" : ""}`, children: item.label }, item.path)))] }), user?.role === "SUPER_ADMIN" && (_jsxs("div", { className: "navList", children: [_jsxs("button", { className: "navSectionHeader", onClick: () => setAdminOpen((v) => !v), children: [_jsx("span", { children: tNav("admin") }), _jsx("span", { className: "muted", style: { fontSize: 12 }, children: adminOpen ? tNav("hide") : tNav("show") })] }), adminOpen && (_jsxs(_Fragment, { children: [_jsx(LocalizedNavLink, { to: "/admin/users", onClick: handleNavClick, className: ({ isActive }) => `navItem ${isActive ? "navItemActive" : ""}`, children: tNav("items.users") }), _jsx(LocalizedNavLink, { to: "/admin/requests", onClick: handleNavClick, className: ({ isActive }) => `navItem ${isActive ? "navItemActive" : ""}`, children: tNav("items.accessRequests") }), _jsx(LocalizedNavLink, { to: "/admin/settings", onClick: handleNavClick, className: ({ isActive }) => `navItem ${isActive ? "navItemActive" : ""}`, children: tNav("items.settings") })] }))] })), onLogout && (_jsx("button", { className: "btn btnGhost", onClick: onLogout, style: { width: "100%" }, children: tCommon("actions.signOut") }))] }));
}
