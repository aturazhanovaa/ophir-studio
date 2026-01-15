import React, { useState } from "react";
import { AuthUser } from "../auth/AuthContext";
import { Area } from "../api/client";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from "react-i18next";

export type TopBarProps = {
  user: AuthUser | null;
  areas: Area[];
  selectedAreaId: number | null;
  onSelectArea: (id: number | null) => void;
  onRequestAccess: () => void;
  onLogout: () => void;
  pageTitle: string;
  breadcrumb?: string;
  showSearch?: boolean;
  showAreaSelector?: boolean;
  primaryActionLabel?: string;
  showPrimaryAction?: boolean;
  onToggleSidebar?: () => void;
};

export default function TopBar({
  user,
  areas,
  selectedAreaId,
  onSelectArea,
  onRequestAccess,
  onLogout,
  pageTitle,
  breadcrumb,
  showSearch = true,
  showAreaSelector = true,
  primaryActionLabel = "Access Center",
  showPrimaryAction = true,
  onToggleSidebar,
}: TopBarProps) {
  const { t: tNav } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = (user?.full_name || user?.email || "U")
    .split("@")[0]
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <div className="topbar">
      <div className="topbarLeft">
        {onToggleSidebar && (
          <button className="btn iconButton sidebarToggle" onClick={onToggleSidebar} type="button" aria-label={tNav("aria.openNavigation")}>
            {tNav("menu")}
          </button>
        )}
        <div className="topbarTitle">
          {breadcrumb && <div className="breadcrumb">{breadcrumb} /</div>}
          <div className="pageTitle">{pageTitle}</div>
        </div>
        {showAreaSelector && (
          <div className="areaSwitcher">
            <label className="fieldLabel">{tCommon("labels.area")}</label>
            <select
              className="input select areaSelect"
              value={selectedAreaId ?? ""}
              onChange={(e) => {
                const next = Number(e.target.value) || null;
                onSelectArea(next);
              }}
            >
              <option value="">{tCommon("placeholders.selectArea")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id} style={{ color: a.color || undefined }}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showSearch && (
        <div className="topbarSearch">
          <input className="input" placeholder={tCommon("placeholders.searchContent")} aria-label={tCommon("placeholders.searchContent")} />
        </div>
      )}

      <div className="topbarActions">
        {showPrimaryAction && (
          <button className="btn btnPrimary" onClick={onRequestAccess} type="button">
            {primaryActionLabel}
          </button>
        )}
        <LanguageSwitcher />
        <div className="menuWrapper">
          <button
            className="btn profileButton"
            onClick={() => setProfileOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            type="button"
          >
            <div className="avatar">{initials || "U"}</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontWeight: 700 }}>{user?.full_name || tCommon("user.fallbackName")}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                {user?.email}
              </span>
            </div>
          </button>
          {profileOpen && (
            <div className="menu" style={{ right: 0, minWidth: 220 }}>
              <div className="menuItem" style={{ cursor: "default" }}>
                <div style={{ fontWeight: 700 }}>{user?.full_name || tCommon("user.fallbackName")}</div>
                <div className="muted" style={{ fontSize: 12 }}>{user?.email}</div>
                <div style={{ marginTop: 6 }}>
                  <span className="pill subtle">{user?.role || "USER"}</span>
                </div>
              </div>
              <button className="menuItem" onClick={onLogout} type="button">
                {tCommon("actions.signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
