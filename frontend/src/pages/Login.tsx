import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setErr(e.message || t("loginFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="authShell">
      <div className="authCard card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <LanguageSwitcher />
        </div>
        <div className="badge accent">{t("secureWorkspace")}</div>
        <div className="h1">{t("welcomeBack")}</div>
        <div className="muted">{t("subtitle")}</div>
        <div className="spacer-lg" />
        <label className="fieldLabel">{t("email")}</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email")} />
        <div className="spacer-sm" />
        <label className="fieldLabel">{t("password")}</label>
        <input
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          type="password"
        />
        <div className="spacer-lg" />
        <button className="btn btnPrimary" style={{ width: "100%" }} onClick={onSubmit} disabled={busy}>
          {busy ? t("signingIn") : t("signIn")}
        </button>
        {err && <div className="formError">{err}</div>}
      </div>
    </div>
  );
}
