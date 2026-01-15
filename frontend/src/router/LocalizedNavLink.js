import { jsx as _jsx } from "react/jsx-runtime";
import { NavLink } from "react-router-dom";
import { withLocalePrefix } from "../i18n/locale";
import { useLocale } from "./useLocale";
export default function LocalizedNavLink({ to, ...props }) {
    const locale = useLocale();
    return _jsx(NavLink, { ...props, to: withLocalePrefix(locale, to) });
}
