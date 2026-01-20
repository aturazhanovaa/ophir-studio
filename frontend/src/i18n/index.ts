import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "../locales/en/common.json";
import commonIt from "../locales/it/common.json";
import navEn from "../locales/en/nav.json";
import navIt from "../locales/it/nav.json";
import authEn from "../locales/en/auth.json";
import authIt from "../locales/it/auth.json";
import dashboardEn from "../locales/en/dashboard.json";
import dashboardIt from "../locales/it/dashboard.json";
import errorsEn from "../locales/en/errors.json";
import errorsIt from "../locales/it/errors.json";
import legalEn from "../locales/en/legal.json";
import legalIt from "../locales/it/legal.json";

import { detectLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./locale";

export const I18N_NAMESPACES = ["common", "nav", "auth", "dashboard", "errors", "legal"] as const;

const initialLanguage = typeof window !== "undefined" ? detectLocale() : DEFAULT_LOCALE;

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: commonEn,
      nav: navEn,
      auth: authEn,
      dashboard: dashboardEn,
      errors: errorsEn,
      legal: legalEn,
    },
    it: {
      common: commonIt,
      nav: navIt,
      auth: authIt,
      dashboard: dashboardIt,
      errors: errorsIt,
      legal: legalIt,
    },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  ns: [...I18N_NAMESPACES],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export default i18n;
