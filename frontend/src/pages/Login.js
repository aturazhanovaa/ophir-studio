import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
export default function Login() {
    const { t } = useTranslation("auth");
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const onSubmit = async () => {
        setErr(null);
        setBusy(true);
        try {
            await login(email, password);
        }
        catch (e) {
            setErr(e.message || t("loginFailed"));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx("div", { className: "authShell", children: _jsxs("div", { className: "authCard card", children: [_jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: _jsx(LanguageSwitcher, {}) }), _jsx("div", { className: "badge accent", children: t("secureWorkspace") }), _jsx("div", { className: "h1", children: t("welcomeBack") }), _jsx("div", { className: "muted", children: t("subtitle") }), _jsx("div", { className: "spacer-lg" }), _jsx("label", { className: "fieldLabel", children: t("email") }), _jsx("input", { className: "input", value: email, onChange: (e) => setEmail(e.target.value), placeholder: t("email") }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: t("password") }), _jsx("input", { className: "input", value: password, onChange: (e) => setPassword(e.target.value), placeholder: t("password"), type: "password" }), _jsx("div", { className: "spacer-lg" }), _jsx("button", { className: "btn btnPrimary", style: { width: "100%" }, onClick: onSubmit, disabled: busy, children: busy ? t("signingIn") : t("signIn") }), err && _jsx("div", { className: "formError", children: err })] }) }));
}
