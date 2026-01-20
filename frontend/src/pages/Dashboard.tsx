import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AnalyticsPanel from "../components/AnalyticsPanel";
import Toast, { ToastMessage } from "../components/Toast";
import AccessRequestsPanel from "../components/AccessRequestsPanel";
import UsersPanel from "../components/UsersPanel";
import AppShell from "../components/AppShell";
import { api, Area, AreaAccess } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { stripLocalePrefix } from "../i18n/locale";
import { useLocale } from "../router/useLocale";
import DocumentsPage from "./DocumentsPage";
import DocumentDetailsPage from "./DocumentDetailsPage";
import AccessCenterPage from "./AccessCenterPage";
import OverviewPage from "./OverviewPage";
import AskAIPage from "./AskAIPage";
import PlaygroundPage from "./PlaygroundPage";
import TagsAdminPage from "./TagsAdminPage";
import CaseStudiesPage from "./CaseStudiesPage";
import VerifyPage from "./VerifyPage";
import KnowledgeBasePage from "./KnowledgeBasePage";
import LegalModule from "./legal/LegalModule";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locale = useLocale();
  const { t: tDash } = useTranslation("dashboard");

  const [areas, setAreas] = useState<Area[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [accessMap, setAccessMap] = useState<Record<number, AreaAccess>>({});
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const pushToast = (message: string, tone: ToastMessage["tone"] = "info") => {
    setToast({ id: Date.now(), message, tone });
    setTimeout(() => setToast(null), 3200);
  };

  const canManageArea = (areaId?: number | null) => {
    if (!areaId) return false;
    if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") return true;
    const m = accessMap[areaId];
    return !!m;
  };

  const loadAreas = async () => {
    setAreasLoading(true);
    try {
      const a = await api.listAreas();
      setAreas(a as Area[]);
    } catch (e: any) {
      const message = e?.message || "Failed to load areas.";
      if (/unauthenticated|unauthorized/i.test(message)) {
        logout();
        return;
      }
      setErr(message);
    } finally {
      setAreasLoading(false);
    }
  };

  const loadAccess = async () => {
    try {
      const mems = (await api.myMemberships()) as AreaAccess[];
      const map: Record<number, AreaAccess> = {};
      mems.forEach((m) => (map[m.area_id] = m));
      setAccessMap(map);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAreas();
    loadAccess();
  }, []);

  useEffect(() => {
    if (!areas.length) return;
    if (selectedAreaId && !areas.find((a) => a.id === selectedAreaId)) {
      setSelectedAreaId(areas[0].id);
    } else if (!selectedAreaId) {
      setSelectedAreaId(areas[0].id);
    }
  }, [areas, selectedAreaId]);

  const pageTitle = useMemo(() => {
    const { restPath } = stripLocalePrefix(location.pathname);
    const path = restPath;
    if (path.startsWith("/dashboard")) return tDash("pageTitles.dashboard");
    if (path.startsWith("/areas") || path.startsWith("/access")) return tDash("pageTitles.accessCenter");
    if (path.startsWith("/documents/")) return tDash("pageTitles.documentDetails");
    if (path.startsWith("/documents")) return tDash("pageTitles.documents");
    if (path.startsWith("/case-studies")) return tDash("pageTitles.caseStudies");
    if (path.startsWith("/analytics")) return tDash("pageTitles.analytics");
    if (path.startsWith("/knowledge-base")) return tDash("pageTitles.knowledgeBase");
    if (path.startsWith("/admin/users")) return tDash("pageTitles.adminUsers");
    if (path.startsWith("/admin/tags")) return tDash("pageTitles.adminTags");
    if (path.startsWith("/admin/verify")) return tDash("pageTitles.verification");
    if (path.startsWith("/admin/requests")) return tDash("pageTitles.adminAccessRequests");
    if (path.startsWith("/admin/settings")) return tDash("pageTitles.adminSettings");
    if (path.startsWith("/ask")) return tDash("pageTitles.askAi");
    if (path.startsWith("/playground")) return tDash("pageTitles.playground");
    if (path.startsWith("/legal")) return tDash("pageTitles.legal");
    return tDash("pageTitles.workspace");
  }, [location.pathname, tDash]);

  return (
    <AppShell
      user={user}
      onLogout={logout}
      topBar={{
        areas,
        selectedAreaId,
        onSelectArea: (id) => setSelectedAreaId(id),
        onRequestAccess: () => navigate(`/${locale}/access`),
        pageTitle,
        breadcrumb: tDash("breadcrumb"),
        showSearch: true,
        showAreaSelector:
          stripLocalePrefix(location.pathname).restPath.startsWith("/documents") ||
          stripLocalePrefix(location.pathname).restPath.startsWith("/analytics"),
        primaryActionLabel: tDash("primaryAction"),
        showPrimaryAction: user?.role !== "SUPER_ADMIN",
      }}
    >
      {err && (
        <div className="card errorBanner" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
          {err}
        </div>
      )}

      <div className="pageContainer">
        <Routes>
          <Route
            path="dashboard"
            element={
              <OverviewPage
                areas={areas}
                accessMap={accessMap}
                loading={areasLoading}
                isSuperAdmin={user?.role === "SUPER_ADMIN"}
                onOpenAccess={() => navigate(`/${locale}/access`)}
                onOpenDocuments={() => navigate(`/${locale}/documents`)}
                onOpenAsk={() => navigate(`/${locale}/ask`)}
                onOpenLegalNew={() => navigate(`/${locale}/legal/documents/new`)}
                canCreateLegal={
                  user?.role === "SUPER_ADMIN" ||
                  user?.role === "ADMIN" ||
                  user?.role === "LEGAL_ADMIN" ||
                  user?.role === "LEGAL_EDITOR"
                }
              />
            }
          />
              <Route path="areas" element={<Navigate to="../access" replace />} />
              <Route
                path="access"
                element={
                  <AccessCenterPage
                    areas={areas}
                    accessMap={accessMap}
                    userRole={user?.role}
                    refreshAccess={() => {
                      loadAreas();
                      loadAccess();
                    }}
                  />
                }
              />
              <Route
                path="documents"
                element={
                  <DocumentsPage
                    areaId={selectedAreaId}
                    canManage={canManageArea}
                    areas={areas}
                    onSelectArea={(id) => setSelectedAreaId(id)}
                  />
                }
              />
              <Route path="case-studies" element={<CaseStudiesPage />} />
              <Route path="knowledge-base" element={<KnowledgeBasePage />} />
              <Route
                path="documents/:docId"
                element={
                  <DocumentDetailsPage
                    areas={areas}
                    canManage={canManageArea}
                    onSelectArea={(id) => setSelectedAreaId(id)}
                  />
                }
              />
              <Route path="playground" element={<PlaygroundPage />} />
              <Route
                path="analytics"
                element={
                  user?.role === "SUPER_ADMIN" ? (
                    <AnalyticsPanel areaId={selectedAreaId} areas={areas} />
                  ) : (
                    <Navigate to={`/${locale}/dashboard`} replace />
                  )
                }
              />
              <Route
                path="ask"
                element={
                  <AskAIPage
                    areas={areas}
                    selectedAreaId={selectedAreaId}
                    onSelectArea={(id) => setSelectedAreaId(id)}
                  />
                }
              />
              <Route path="legal/*" element={<LegalModule />} />
              <Route
                path="admin/users"
                element={
                  user?.role === "SUPER_ADMIN" ? (
                    <UsersPanel
                      onToast={pushToast}
                      refreshMyAccess={() => {
                        loadAreas();
                        loadAccess();
                      }}
                    />
                  ) : (
                    <Navigate to={`/${locale}/documents`} replace />
                  )
                }
              />
              <Route
                path="admin/tags"
                element={
                  user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" ? (
                    <TagsAdminPage />
                  ) : (
                    <Navigate to={`/${locale}/knowledge-base`} replace />
                  )
                }
              />
              <Route
                path="admin/verify"
                element={
                  user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" ? (
                    <VerifyPage />
                  ) : (
                    <Navigate to={`/${locale}/dashboard`} replace />
                  )
                }
              />
              <Route
                path="admin/requests"
                element={
                  user?.role === "SUPER_ADMIN" ? (
                    <AccessRequestsPanel
                      onToast={pushToast}
                      refreshMyAccess={() => {
                        loadAreas();
                        loadAccess();
                      }}
                    />
                  ) : (
                    <Navigate to={`/${locale}/documents`} replace />
                  )
                }
              />
              <Route
                path="admin/settings"
                element={
                  user?.role === "SUPER_ADMIN" ? (
                    <div className="card">
                      <div className="emptyState">
                        <div className="emptyTitle">{tDash("settings.comingSoonTitle")}</div>
                        <div className="emptyText">{tDash("settings.comingSoonText")}</div>
                      </div>
                    </div>
                  ) : (
                    <Navigate to={`/${locale}/documents`} replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to={`/${locale}/dashboard`} replace />} />
            </Routes>
          </div>

      <Toast toast={toast} />
    </AppShell>
  );
}
