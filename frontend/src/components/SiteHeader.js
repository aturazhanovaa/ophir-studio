import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
const NAV_ITEMS = [
    { label: "Industries / Verticals", to: "/knowledge-base?area=industries", match: { path: "/knowledge-base", area: "industries" } },
    { label: "Services / Solutions", to: "/knowledge-base?area=services", match: { path: "/knowledge-base", area: "services" } },
    { label: "Outreach & Sales Enablement", to: "/knowledge-base?area=outreach", match: { path: "/knowledge-base", area: "outreach" } },
    { label: "Case Studies & Proof", to: "/case-studies", match: { path: "/case-studies" } },
    { label: "Resources", to: "/knowledge-base", match: { path: "/knowledge-base" } },
    { label: "Support", to: "/access", match: { path: "/access" } },
];
export default function SiteHeader({ user, onLogout, }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const areaParam = new URLSearchParams(location.search).get("area");
    const isActive = (item) => {
        if (!item.match)
            return location.pathname === item.to;
        if (item.match.area) {
            return location.pathname === item.match.path && areaParam === item.match.area;
        }
        if (item.match.path === "/knowledge-base") {
            return location.pathname === "/knowledge-base" && !areaParam;
        }
        return location.pathname.startsWith(item.match.path);
    };
    const initials = (user?.full_name || user?.email || "U")
        .split("@")[0]
        .split(" ")
        .map((s) => s[0]?.toUpperCase())
        .join("")
        .slice(0, 2);
    return (_jsxs("header", { className: "siteHeader", children: [_jsxs("div", { className: "siteHeaderInner", children: [_jsxs("button", { className: "btn btnGhost brandMark", onClick: () => navigate("/dashboard"), "aria-label": "Home", type: "button", children: [_jsx("span", { className: "brandCircle" }), _jsx("span", { children: "Brand" })] }), _jsx("nav", { className: "siteNav", "aria-label": "Primary navigation", children: NAV_ITEMS.map((item) => (_jsx(NavLink, { to: item.to, className: `siteNavLink ${isActive(item) ? "active" : ""}`, children: item.label }, item.label))) }), _jsxs("div", { className: "siteActions", children: [_jsx("button", { className: "btn btnSecondary", onClick: () => navigate("/access"), type: "button", children: "Contact" }), _jsx("button", { className: "btn btnPrimary", onClick: () => navigate("/playground"), type: "button", children: "Book a Demo" }), _jsxs("div", { className: "menuWrapper", children: [_jsx("button", { className: "btn profileButton", onClick: () => setProfileOpen((v) => !v), "aria-haspopup": "menu", "aria-expanded": profileOpen, type: "button", children: _jsx("div", { className: "avatar", children: initials || "U" }) }), profileOpen && (_jsxs("div", { className: "menu", role: "menu", children: [_jsxs("div", { className: "menuItem", style: { cursor: "default" }, children: [_jsx("div", { style: { fontWeight: 700 }, children: user?.full_name || "User" }), _jsx("div", { className: "muted", style: { fontSize: 12 }, children: user?.email }), _jsx("div", { style: { marginTop: 6 }, children: _jsx("span", { className: "pill subtle", children: user?.role || "USER" }) })] }), _jsx("button", { className: "menuItem", onClick: onLogout, type: "button", children: "Sign out" })] }))] }), _jsx("button", { className: "btn navToggle", onClick: () => setMobileOpen(true), "aria-label": "Open navigation", type: "button", children: "Menu" })] })] }), mobileOpen && (_jsx("div", { className: "mobileNav", role: "dialog", "aria-label": "Mobile navigation", onClick: (e) => {
                    if (e.target.classList.contains("mobileNav"))
                        setMobileOpen(false);
                }, children: _jsxs("div", { className: "mobileNavPanel", children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { className: "brandMark", children: [_jsx("span", { className: "brandCircle" }), _jsx("span", { children: "Brand" })] }), _jsx("button", { className: "btn btnGhost", onClick: () => setMobileOpen(false), "aria-label": "Close navigation", type: "button", children: "Close" })] }), NAV_ITEMS.map((item) => (_jsx(NavLink, { to: item.to, className: "mobileNavLink", onClick: () => setMobileOpen(false), children: item.label }, item.label))), _jsx("div", { className: "divider" }), _jsx("button", { className: "btn btnSecondary", onClick: () => navigate("/access"), type: "button", children: "Contact" }), _jsx("button", { className: "btn btnPrimary", onClick: () => navigate("/playground"), type: "button", children: "Book a Demo" })] }) }))] }));
}
