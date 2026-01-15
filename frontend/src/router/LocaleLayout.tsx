import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import i18n from "../i18n";
import { detectLocale, normalizeLocale, persistLocale } from "../i18n/locale";

export default function LocaleLayout() {
  const params = useParams();
  const location = useLocation();
  const locale = normalizeLocale(params.locale);

  useEffect(() => {
    if (!locale) return;
    document.documentElement.lang = locale;
    persistLocale(locale);
    void i18n.changeLanguage(locale);
  }, [locale]);

  if (!locale) {
    const detected = detectLocale();
    const parts = location.pathname.split("/").filter(Boolean);
    const looksLikeLocale = /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0] ?? "");
    const restParts = parts.length <= 1 ? parts : looksLikeLocale ? parts.slice(1) : parts;
    const restPath = restParts.length ? `/${restParts.join("/")}` : "";
    return <Navigate to={`/${detected}${restPath}${location.search}${location.hash}`} replace />;
  }
  return <Outlet />;
}
