import React from "react";
import { NavLink, type NavLinkProps } from "react-router-dom";
import { withLocalePrefix } from "../i18n/locale";
import { useLocale } from "./useLocale";

type Props = Omit<NavLinkProps, "to"> & { to: string };

export default function LocalizedNavLink({ to, ...props }: Props) {
  const locale = useLocale();
  return <NavLink {...props} to={withLocalePrefix(locale, to)} />;
}

