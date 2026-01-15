import { useParams } from "react-router-dom";
import { DEFAULT_LOCALE, normalizeLocale } from "../i18n/locale";
export function useLocale() {
    const params = useParams();
    return normalizeLocale(params.locale) ?? DEFAULT_LOCALE;
}
