import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { detectLocale } from "../i18n/locale";

export default function InvalidLocaleRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const detected = detectLocale();
    const parts = location.pathname.split("/").filter(Boolean);
    const restPath = "/" + parts.slice(1).join("/");
    navigate(`/${detected}${restPath === "/" ? "" : restPath}${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
