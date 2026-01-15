import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from "react-router-dom";
import RootRedirect from "./RootRedirect";
import LocaleLayout from "./LocaleLayout";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "./useLocale";
function RequireAuth({ children }) {
    const { token } = useAuth();
    const locale = useLocale();
    if (!token)
        return _jsx(Navigate, { to: `/${locale}/login`, replace: true });
    return _jsx(_Fragment, { children: children });
}
function RedirectIfAuthed({ children }) {
    const { token } = useAuth();
    const locale = useLocale();
    if (token)
        return _jsx(Navigate, { to: `/${locale}/dashboard`, replace: true });
    return _jsx(_Fragment, { children: children });
}
export default function AppRouter() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(RootRedirect, {}) }), _jsx(Route, { path: ".", element: _jsx(RootRedirect, {}) }), _jsxs(Route, { path: ":locale", element: _jsx(LocaleLayout, {}), children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "dashboard", replace: true }) }), _jsx(Route, { path: "login", element: _jsx(RedirectIfAuthed, { children: _jsx(Login, {}) }) }), _jsx(Route, { path: "*", element: _jsx(RequireAuth, { children: _jsx(Dashboard, {}) }) })] }), _jsx(Route, { path: "*", element: _jsx(RootRedirect, {}) })] }));
}
