import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./styles/ui.css";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AppRouter from "./router";
import "./i18n";
import { useTranslation } from "react-i18next";
function App() {
    const { loading } = useAuth();
    const { t } = useTranslation("common");
    if (loading) {
        return _jsx("div", { className: "appLoading", children: t("loading.workspace") });
    }
    return _jsx(AppRouter, {});
}
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(ErrorBoundary, { children: _jsx(AuthProvider, { children: _jsx(BrowserRouter, { children: _jsx(App, {}) }) }) }) }));
