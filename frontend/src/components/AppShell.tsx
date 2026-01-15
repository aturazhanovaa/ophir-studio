import React, { useState } from "react";
import { AuthUser } from "../auth/AuthContext";
import Sidebar from "./Sidebar";
import TopBar, { TopBarProps } from "./TopBar";
import { useTranslation } from "react-i18next";

type AppShellProps = {
  user: AuthUser | null;
  onLogout: () => void;
  topBar: Omit<TopBarProps, "user" | "onLogout" | "onToggleSidebar">;
  children: React.ReactNode;
};

export default function AppShell({ user, onLogout, topBar, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t: tNav } = useTranslation("nav");

  return (
    <div className="appShell">
      <aside className={`appSidebar ${sidebarOpen ? "open" : ""}`}>
        <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
      </aside>

      <div className="appMain">
        <TopBar
          {...topBar}
          user={user}
          onLogout={onLogout}
          onToggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="appContent">{children}</main>
      </div>

      {sidebarOpen && (
        <button
          className="appOverlay"
          onClick={() => setSidebarOpen(false)}
          aria-label={tNav("aria.closeNavigation")}
          type="button"
        />
      )}
    </div>
  );
}
