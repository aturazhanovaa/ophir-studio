import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
export default function Drawer({ open, onClose, children, title, footer, width = 460 }) {
    const { t: tCommon } = useTranslation("common");
    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape")
                onClose();
        };
        if (open)
            window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);
    if (!open)
        return null;
    return (_jsx("div", { className: "drawerOverlay", onClick: (e) => e.target === e.currentTarget && onClose(), children: _jsxs("div", { className: "drawerPanel", style: { width }, children: [_jsxs("div", { className: "drawerHeader", children: [_jsx("div", { children: title && _jsx("div", { className: "h3", style: { margin: 0 }, children: title }) }), _jsx("button", { className: "btn btnGhost", onClick: onClose, children: tCommon("actions.close") })] }), _jsx("div", { className: "drawerBody", children: children }), footer && _jsx("div", { className: "drawerFooter", children: footer })] }) }));
}
