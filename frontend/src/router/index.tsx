import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RootRedirect from "./RootRedirect";
import LocaleLayout from "./LocaleLayout";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "./useLocale";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const locale = useLocale();
  if (!token) return <Navigate to={`/${locale}/login`} replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const locale = useLocale();
  if (token) return <Navigate to={`/${locale}/dashboard`} replace />;
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="." element={<RootRedirect />} />
      <Route path=":locale" element={<LocaleLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
