import { useNavigate, type NavigateOptions } from "react-router-dom";
import { withLocalePrefix } from "../i18n/locale";
import { useLocale } from "./useLocale";

export function useLocaleNavigate() {
  const navigate = useNavigate();
  const locale = useLocale();

  return (to: string, options?: NavigateOptions) => {
    navigate(withLocalePrefix(locale, to), options);
  };
}

