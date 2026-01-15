import { useParams } from "react-router-dom";
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "../i18n/locale";

export function useLocale(): SupportedLocale {
  const params = useParams();
  return normalizeLocale(params.locale) ?? DEFAULT_LOCALE;
}

