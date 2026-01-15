import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate } from "react-router-dom";
import { detectLocale } from "../i18n/locale";
export default function RootRedirect() {
    const locale = detectLocale();
    return _jsx(Navigate, { to: `/${locale}`, replace: true });
}
