import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./styles/ui.css";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AppRouter from "./router";
import "./i18n";
import { useTranslation } from "react-i18next";

function App() {
  const { loading } = useAuth();
  const { t } = useTranslation("common");
  if (loading) {
    return <div className="appLoading">{t("loading.workspace")}</div>;
  }
  return <AppRouter />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
