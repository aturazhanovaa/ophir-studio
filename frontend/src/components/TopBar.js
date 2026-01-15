import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from "react-i18next";
export default function TopBar({ user, areas, selectedAreaId, onSelectArea, onRequestAccess, onLogout, pageTitle, breadcrumb, showSearch = true, showAreaSelector = true, primaryActionLabel = "Access Center", showPrimaryAction = true, onToggleSidebar, }) {
    const { t: tNav } = useTranslation("nav");
    const { t: tCommon } = useTranslation("common");
    const [profileOpen, setProfileOpen] = useState(false);
    const initials = (user?.full_name || user?.email || "U")
        .split("@")[0]
        .split(" ")
        .map((s) => s[0]?.toUpperCase())
        .join("")
        .slice(0, 2);
    return (_jsxs("div", { className: "topbar", children: [_jsxs("div", { className: "topbarLeft", children: [onToggleSidebar && (_jsx("button", { className: "btn iconButton sidebarToggle", onClick: onToggleSidebar, type: "button", "aria-label": tNav("aria.openNavigation"), children: tNav("menu") })), _jsxs("div", { className: "topbarTitle", children: [breadcrumb && _jsxs("div", { className: "breadcrumb", children: [breadcrumb, " /"] }), _jsx("div", { className: "pageTitle", children: pageTitle })] }), showAreaSelector && (_jsxs("div", { className: "areaSwitcher", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.area") }), _jsxs("select", { className: "input select areaSelect", value: selectedAreaId ?? "", onChange: (e) => {
                                    const next = Number(e.target.value) || null;
                                    onSelectArea(next);
                                }, children: [_jsx("option", { value: "", children: tCommon("placeholders.selectArea") }), areas.map((a) => (_jsx("option", { value: a.id, style: { color: a.color || undefined }, children: a.name }, a.id)))] })] }))] }), showSearch && (_jsx("div", { className: "topbarSearch", children: _jsx("input", { className: "input", placeholder: tCommon("placeholders.searchContent"), "aria-label": tCommon("placeholders.searchContent") }) })), _jsxs("div", { className: "topbarActions", children: [showPrimaryAction && (_jsx("button", { className: "btn btnPrimary", onClick: onRequestAccess, type: "button", children: primaryActionLabel })), _jsx(LanguageSwitcher, {}), _jsxs("div", { className: "menuWrapper", children: [_jsxs("button", { className: "btn profileButton", onClick: () => setProfileOpen((v) => !v), "aria-haspopup": "menu", "aria-expanded": profileOpen, type: "button", children: [_jsx("div", { className: "avatar", children: initials || "U" }), _jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-start" }, children: [_jsx("span", { style: { fontWeight: 700 }, children: user?.full_name || tCommon("user.fallbackName") }), _jsx("span", { className: "muted", style: { fontSize: 12 }, children: user?.email })] })] }), profileOpen && (_jsxs("div", { className: "menu", style: { right: 0, minWidth: 220 }, children: [_jsxs("div", { className: "menuItem", style: { cursor: "default" }, children: [_jsx("div", { style: { fontWeight: 700 }, children: user?.full_name || tCommon("user.fallbackName") }), _jsx("div", { className: "muted", style: { fontSize: 12 }, children: user?.email }), _jsx("div", { style: { marginTop: 6 }, children: _jsx("span", { className: "pill subtle", children: user?.role || "USER" }) })] }), _jsx("button", { className: "menuItem", onClick: onLogout, type: "button", children: tCommon("actions.signOut") })] }))] })] })] }));
}
