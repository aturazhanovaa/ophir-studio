import React, { useState } from "react";
import LocalizedNavLink from "../router/LocalizedNavLink";
import { AuthUser } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";

export type Area = { id: number; key: string; name: string; color?: string | null };

export default function Sidebar({
  user,
  onLogout,
  onClose,
}: {
  user: AuthUser | null;
  onLogout?: () => void;
  onClose?: () => void;
}) {
  const { t: tNav } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const [adminOpen, setAdminOpen] = useState(true);

  const navItems = [
    { label: tNav("items.dashboard"), path: "/dashboard" },
    { label: tNav("items.documents"), path: "/documents" },
    { label: tNav("items.knowledgeBase"), path: "/knowledge-base" },
    { label: tNav("items.askAi"), path: "/ask" },
    { label: tNav("items.playground"), path: "/playground" },
    { label: tNav("items.analytics"), path: "/analytics" },
  ];

  if (user?.role !== "SUPER_ADMIN") {
    navItems.push({ label: tNav("items.access"), path: "/access" });
  }

  if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
    navItems.push({ label: tNav("items.tagAdmin"), path: "/admin/tags" });
    navItems.push({ label: tNav("items.verification"), path: "/admin/verify" });
  }

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="sidebar">
      <div className="sidebarHeader">
        <div className="brandMark">
          <span className="brandCircle" />
          <span>{tCommon("app.brand")}</span>
        </div>
        {onClose && (
          <button className="btn btnGhost sidebarClose" onClick={onClose} type="button" aria-label={tNav("aria.closeNavigation")}>
            {tCommon("actions.close")}
          </button>
        )}
      </div>

      <div className="navList">
        <div className="eyebrow">{tNav("navigation")}</div>
        {navItems.map((item) => (
          <LocalizedNavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={({ isActive }) => `navItem ${isActive ? "navItemActive" : ""}`}
          >
            {item.label}
          </LocalizedNavLink>
        ))}
      </div>

      {user?.role === "SUPER_ADMIN" && (
        <div className="navList">
          <button className="navSectionHeader" onClick={() => setAdminOpen((v) => !v)}>
            <span>{tNav("admin")}</span>
            <span className="muted" style={{ fontSize: 12 }}>{adminOpen ? tNav("hide") : tNav("show")}</span>
          </button>
          {adminOpen && (
            <>
              <LocalizedNavLink to="/admin/users" onClick={handleNavClick} className={({ isActive }) => `navItem ${isActive ? "navItemActive" : ""}`}>
                {tNav("items.users")}
              </LocalizedNavLink>
              <LocalizedNavLink to="/admin/requests" onClick={handleNavClick} className={({ isActive }) => `navItem ${isActive ? "navItemActive" : ""}`}>
                {tNav("items.accessRequests")}
              </LocalizedNavLink>
              <LocalizedNavLink to="/admin/settings" onClick={handleNavClick} className={({ isActive }) => `navItem ${isActive ? "navItemActive" : ""}`}>
                {tNav("items.settings")}
              </LocalizedNavLink>
            </>
          )}
        </div>
      )}

      {onLogout && (
        <button className="btn btnGhost" onClick={onLogout} style={{ width: "100%" }}>
          {tCommon("actions.signOut")}
        </button>
      )}
    </div>
  );
}
