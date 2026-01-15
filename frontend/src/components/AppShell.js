import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useTranslation } from "react-i18next";
export default function AppShell({ user, onLogout, topBar, children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { t: tNav } = useTranslation("nav");
    return (_jsxs("div", { className: "appShell", children: [_jsx("aside", { className: `appSidebar ${sidebarOpen ? "open" : ""}`, children: _jsx(Sidebar, { user: user, onClose: () => setSidebarOpen(false) }) }), _jsxs("div", { className: "appMain", children: [_jsx(TopBar, { ...topBar, user: user, onLogout: onLogout, onToggleSidebar: () => setSidebarOpen(true) }), _jsx("main", { className: "appContent", children: children })] }), sidebarOpen && (_jsx("button", { className: "appOverlay", onClick: () => setSidebarOpen(false), "aria-label": tNav("aria.closeNavigation"), type: "button" }))] }));
}
