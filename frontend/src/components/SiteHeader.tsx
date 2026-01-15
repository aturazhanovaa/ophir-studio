import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AuthUser } from "../auth/AuthContext";

const NAV_ITEMS = [
  { label: "Industries / Verticals", to: "/knowledge-base?area=industries", match: { path: "/knowledge-base", area: "industries" } },
  { label: "Services / Solutions", to: "/knowledge-base?area=services", match: { path: "/knowledge-base", area: "services" } },
  { label: "Outreach & Sales Enablement", to: "/knowledge-base?area=outreach", match: { path: "/knowledge-base", area: "outreach" } },
  { label: "Case Studies & Proof", to: "/case-studies", match: { path: "/case-studies" } },
  { label: "Resources", to: "/knowledge-base", match: { path: "/knowledge-base" } },
  { label: "Support", to: "/access", match: { path: "/access" } },
];

export default function SiteHeader({
  user,
  onLogout,
}: {
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const areaParam = new URLSearchParams(location.search).get("area");

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (!item.match) return location.pathname === item.to;
    if (item.match.area) {
      return location.pathname === item.match.path && areaParam === item.match.area;
    }
    if (item.match.path === "/knowledge-base") {
      return location.pathname === "/knowledge-base" && !areaParam;
    }
    return location.pathname.startsWith(item.match.path);
  };

  const initials = (user?.full_name || user?.email || "U")
    .split("@")[0]
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <button
          className="btn btnGhost brandMark"
          onClick={() => navigate("/dashboard")}
          aria-label="Home"
          type="button"
        >
          <span className="brandCircle" />
          <span>Brand</span>
        </button>

        <nav className="siteNav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.label} to={item.to} className={`siteNavLink ${isActive(item) ? "active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="siteActions">
          <button className="btn btnSecondary" onClick={() => navigate("/access")} type="button">
            Contact
          </button>
          <button className="btn btnPrimary" onClick={() => navigate("/playground")} type="button">
            Book a Demo
          </button>
          <div className="menuWrapper">
            <button
              className="btn profileButton"
              onClick={() => setProfileOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              type="button"
            >
              <div className="avatar">{initials || "U"}</div>
            </button>
            {profileOpen && (
              <div className="menu" role="menu">
                <div className="menuItem" style={{ cursor: "default" }}>
                  <div style={{ fontWeight: 700 }}>{user?.full_name || "User"}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {user?.email}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span className="pill subtle">{user?.role || "USER"}</span>
                  </div>
                </div>
                <button className="menuItem" onClick={onLogout} type="button">
                  Sign out
                </button>
              </div>
            )}
          </div>
          <button
            className="btn navToggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            type="button"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="mobileNav"
          role="dialog"
          aria-label="Mobile navigation"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains("mobileNav")) setMobileOpen(false);
          }}
        >
          <div className="mobileNavPanel">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="brandMark">
                <span className="brandCircle" />
                <span>Brand</span>
              </div>
              <button
                className="btn btnGhost"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                type="button"
              >
                Close
              </button>
            </div>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className="mobileNavLink"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="divider" />
            <button className="btn btnSecondary" onClick={() => navigate("/access")} type="button">
              Contact
            </button>
            <button className="btn btnPrimary" onClick={() => navigate("/playground")} type="button">
              Book a Demo
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
