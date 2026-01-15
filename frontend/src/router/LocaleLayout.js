import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import i18n from "../i18n";
import { detectLocale, normalizeLocale, persistLocale } from "../i18n/locale";
export default function LocaleLayout() {
    const params = useParams();
    const location = useLocation();
    const locale = normalizeLocale(params.locale);
    useEffect(() => {
        if (!locale)
            return;
        document.documentElement.lang = locale;
        persistLocale(locale);
        void i18n.changeLanguage(locale);
    }, [locale]);
    if (!locale) {
        const detected = detectLocale();
        const parts = location.pathname.split("/").filter(Boolean);
        const restPath = "/" + parts.slice(1).join("/");
        return _jsx(Navigate, { to: `/${detected}${restPath === "/" ? "" : restPath}${location.search}${location.hash}`, replace: true });
    }
    return _jsx(Outlet, {});
}
