import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from "react-i18next";
export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose, }) {
    const { t: tCommon } = useTranslation("common");
    const finalConfirmLabel = confirmLabel ?? tCommon("actions.confirm");
    return (_jsx("div", { className: "modalOverlay", children: _jsxs("div", { className: "card modalCard", children: [_jsxs("div", { className: "cardHeader", children: [_jsx("div", { className: "h2", children: title }), _jsx("button", { className: "btn btnGhost", onClick: onClose, children: tCommon("actions.close") })] }), _jsx("div", { className: "muted", children: message }), _jsxs("div", { className: "modalActions", children: [_jsx("button", { className: "btn", onClick: onClose, children: tCommon("actions.cancel") }), _jsx("button", { className: "btn btnDanger", onClick: onConfirm, children: finalConfirmLabel })] })] }) }));
}
