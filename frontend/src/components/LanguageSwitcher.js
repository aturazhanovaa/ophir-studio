import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation, useNavigate } from "react-router-dom";
import i18n from "../i18n";
import { persistLocale, stripLocalePrefix } from "../i18n/locale";
import { useLocale } from "../router/useLocale";
import { useTranslation } from "react-i18next";
export default function LanguageSwitcher() {
    const locale = useLocale();
    const navigate = useNavigate();
    const location = useLocation();
    const { t: tCommon } = useTranslation("common");
    const setLocale = (next) => {
        if (next === locale)
            return;
        persistLocale(next);
        void i18n.changeLanguage(next);
        const { restPath } = stripLocalePrefix(location.pathname);
        navigate(`/${next}${restPath}${location.search}${location.hash}`);
    };
    return (_jsxs("div", { className: "langSwitcher", role: "group", "aria-label": tCommon("labels.language"), children: [_jsx("button", { className: `btn btnGhost ${locale === "en" ? "active" : ""}`, type: "button", onClick: () => setLocale("en"), "aria-pressed": locale === "en", children: "EN" }), _jsx("button", { className: `btn btnGhost ${locale === "it" ? "active" : ""}`, type: "button", onClick: () => setLocale("it"), "aria-pressed": locale === "it", children: "IT" })] }));
}
