import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import LocalizedNavLink from "../../router/LocalizedNavLink";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canEditLegal, canViewLegal } from "./legalAccess";
import LegalOverviewPage from "./LegalOverviewPage";
import LegalDocumentsPage from "./LegalDocumentsPage";
import LegalNewDocumentPage from "./LegalNewDocumentPage";
import LegalDocumentDetailPage from "./LegalDocumentDetailPage";
import LegalTemplatesPage from "./LegalTemplatesPage";
import LegalTemplateEditorPage from "./LegalTemplateEditorPage";
import LegalExamplesPage from "./LegalExamplesPage";
import Toast, { type ToastMessage } from "../../components/Toast";
import { useTranslation } from "react-i18next";

export default function LegalModule() {
  const { user } = useAuth();
  const locale = useLocale();
  const navigate = useNavigate();
  const { t: tLegal } = useTranslation("legal");
  const [toast, setToast] = React.useState<ToastMessage | null>(null);

  if (!canViewLegal(user)) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">{tLegal("module.noAccess.title")}</div>
          <div className="emptyText">{tLegal("module.noAccess.text")}</div>
        </div>
      </div>
    );
  }

  const showCreate = canEditLegal(user);
  const pushToast = (message: string, tone: ToastMessage["tone"] = "info") => {
    setToast({ id: Date.now(), message, tone });
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <div className="pageStack">
      <div className="card toolbarCard">
        <div className="toolbarLeft">
          <div className="eyebrow">{tLegal("module.eyebrow")}</div>
          <div className="h2" style={{ marginBottom: 2 }}>{tLegal("module.title")}</div>
          <div className="muted">{tLegal("module.subtitle")}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {showCreate && (
            <button className="btn btnPrimary" onClick={() => navigate(`/${locale}/legal/documents/new`)}>
              {tLegal("module.actions.createDocument")}
            </button>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <LocalizedNavLink to="/legal" className={({ isActive }) => `pill ${isActive ? "" : "subtle"}`}>
          {tLegal("module.tabs.overview")}
        </LocalizedNavLink>
        <LocalizedNavLink to="/legal/documents" className={({ isActive }) => `pill ${isActive ? "" : "subtle"}`}>
          {tLegal("module.tabs.documents")}
        </LocalizedNavLink>
        <LocalizedNavLink to="/legal/templates" className={({ isActive }) => `pill ${isActive ? "" : "subtle"}`}>
          {tLegal("module.tabs.templates")}
        </LocalizedNavLink>
        <LocalizedNavLink to="/legal/examples" className={({ isActive }) => `pill ${isActive ? "" : "subtle"}`}>
          {tLegal("module.tabs.examples")}
        </LocalizedNavLink>
      </div>

      <Routes>
        <Route index element={<LegalOverviewPage />} />
        <Route path="documents" element={<LegalDocumentsPage />} />
        <Route path="documents/new" element={<LegalNewDocumentPage onToast={pushToast} />} />
        <Route path="documents/:id" element={<LegalDocumentDetailPage />} />
        <Route path="templates" element={<LegalTemplatesPage onToast={pushToast} />} />
        <Route path="templates/new" element={<LegalTemplateEditorPage mode="create" onToast={pushToast} />} />
        <Route path="templates/:id" element={<LegalTemplateEditorPage mode="edit" onToast={pushToast} />} />
        <Route path="examples" element={<LegalExamplesPage onToast={pushToast} />} />
        <Route path="*" element={<Navigate to={`/${locale}/legal`} replace />} />
      </Routes>
      <Toast toast={toast} />
    </div>
  );
}
