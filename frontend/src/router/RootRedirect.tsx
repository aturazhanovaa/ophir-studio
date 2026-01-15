import React from "react";
import { Navigate } from "react-router-dom";
import { detectLocale } from "../i18n/locale";

export default function RootRedirect() {
  const locale = detectLocale();
  return <Navigate to={`/${locale}`} replace />;
}

