import { useNavigate } from "react-router-dom";
import { withLocalePrefix } from "../i18n/locale";
import { useLocale } from "./useLocale";
export function useLocaleNavigate() {
    const navigate = useNavigate();
    const locale = useLocale();
    return (to, options) => {
        navigate(withLocalePrefix(locale, to), options);
    };
}
