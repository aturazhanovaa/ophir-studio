import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import i18n from "../i18n";
export default class ErrorBoundary extends React.Component {
    state = { hasError: false, message: "" };
    static getDerivedStateFromError(error) {
        return { hasError: true, message: error.message || i18n.t("errors:unexpected") };
    }
    componentDidCatch(error) {
        // Keep console output for debugging in development.
        console.error("UI ErrorBoundary caught:", error);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "pageStack", style: { padding: 24 }, children: _jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: i18n.t("errors:somethingWentWrong") }), _jsx("div", { className: "h3", children: i18n.t("errors:couldNotRender") })] }) }), _jsx("div", { className: "muted", children: i18n.t("errors:errorPrefix", { message: this.state.message }) }), _jsx("div", { className: "modalActions", children: _jsx("button", { className: "btn btnPrimary", onClick: () => window.location.reload(), type: "button", children: i18n.t("common:actions.reload") }) })] }) }));
        }
        return this.props.children;
    }
}
