import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canManageLegalTemplates } from "./legalAccess";
import { useTranslation } from "react-i18next";
export default function LegalTemplatesPage({ onToast }) {
    const { user } = useAuth();
    const locale = useLocale();
    const navigate = useNavigate();
    const { t: tLegal } = useTranslation("legal");
    const { t: tCommon } = useTranslation("common");
    const canAdmin = canManageLegalTemplates(user);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.listLegalTemplates();
            setTemplates(res);
        }
        catch (e) {
            setError(e?.message || tLegal("templates.errors.failedToLoad"));
            setTemplates([]);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);
    const types = useMemo(() => Array.from(new Set(templates.map((t) => t.type).filter(Boolean))).sort(), [templates]);
    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase();
        return templates.filter((t) => {
            if (typeFilter && t.type !== typeFilter)
                return false;
            if (!term)
                return true;
            return ((t.name || "").toLowerCase().includes(term) ||
                (t.type || "").toLowerCase().includes(term) ||
                (t.body || "").toLowerCase().includes(term));
        });
    }, [templates, query, typeFilter]);
    const duplicate = async (t) => {
        if (!canAdmin)
            return;
        setError(null);
        try {
            const created = await api.createLegalTemplate({
                name: `${t.name} (${tLegal("templates.actions.copySuffix")})`,
                type: t.type,
                body: t.body,
                variables: Array.isArray(t.variables) ? t.variables : [],
                default_approvers: t.default_approvers || [],
            });
            onToast?.(tLegal("templates.toast.duplicated"), "success");
            navigate(`/${locale}/legal/templates/${created.id}`);
        }
        catch (e) {
            setError(e?.message || tLegal("templates.errors.failedToDuplicate"));
            onToast?.(e?.message || tLegal("templates.errors.failedToDuplicate"), "danger");
        }
    };
    const remove = async (t) => {
        if (!canAdmin)
            return;
        const ok = window.confirm(tLegal("templates.confirmDelete", { name: t.name }));
        if (!ok)
            return;
        setError(null);
        try {
            await api.deleteLegalTemplate(t.id);
            onToast?.(tLegal("templates.toast.deleted"), "success");
            await load();
        }
        catch (e) {
            setError(e?.message || tLegal("templates.errors.failedToDelete"));
            onToast?.(e?.message || tLegal("templates.errors.failedToDelete"), "danger");
        }
    };
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tLegal("templates.eyebrow") }), _jsx("div", { className: "h3", children: tLegal("templates.title") }), _jsx("div", { className: "muted", children: tLegal("templates.subtitle", { example: "{{client_name}}" }) })] }), _jsxs("div", { className: "row", style: { gap: 10 }, children: [canAdmin && (_jsx("button", { className: "btn btnPrimary", onClick: () => navigate(`/${locale}/legal/templates/new`), type: "button", children: tLegal("templates.actions.createTemplate") })), _jsx("button", { className: "btn btnGhost", onClick: load, disabled: loading, type: "button", children: tCommon("actions.reload") })] })] }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("templates.filters.search") }), _jsx("input", { className: "input", value: query, onChange: (e) => setQuery(e.target.value), placeholder: tLegal("templates.filters.searchPlaceholder") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tLegal("templates.filters.type") }), _jsxs("select", { className: "input select", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), children: [_jsx("option", { value: "", children: tLegal("templates.filters.allTypes") }), types.map((t) => (_jsx("option", { value: t, children: t }, t)))] })] })] }), error && _jsx("div", { className: "errorBanner", children: error })] }), !loading && filtered.length === 0 && (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tLegal("templates.empty.title") }), _jsx("div", { className: "emptyText", children: tLegal("templates.empty.text") }), canAdmin && (_jsx("button", { className: "btn btnPrimary", onClick: () => navigate(`/${locale}/legal/templates/new`), type: "button", children: tLegal("templates.actions.createTemplate") }))] }) })), filtered.length > 0 && (_jsx("div", { className: "card", children: _jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "1fr 0.6fr 0.5fr 0.6fr 0.7fr auto" }, children: [_jsx("div", { children: tLegal("templates.table.name") }), _jsx("div", { children: tLegal("templates.table.type") }), _jsx("div", { children: tLegal("templates.table.variables") }), _jsx("div", { children: tLegal("templates.table.approvers") }), _jsx("div", { children: tLegal("templates.table.updated") }), _jsx("div", {})] }), _jsx("div", { className: "tableBody", children: filtered.map((t) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "1fr 0.6fr 0.5fr 0.6fr 0.7fr auto" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: t.name }), _jsx("div", { className: "muted", style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: t.body?.slice(0, 120) || "—" })] }), _jsx("div", { className: "muted", children: t.type }), _jsx("div", { className: "muted", children: Array.isArray(t.variables) ? t.variables.length : 0 }), _jsx("div", { className: "muted", children: Array.isArray(t.default_approvers) ? t.default_approvers.length : 0 }), _jsx("div", { className: "muted", children: new Date(t.updated_at).toLocaleString() }), _jsxs("div", { className: "row", style: { justifyContent: "flex-end" }, children: [_jsx("button", { className: "btn btnGhost", onClick: () => navigate(`/${locale}/legal/templates/${t.id}`), type: "button", children: canAdmin ? tCommon("actions.edit") : tCommon("actions.open") }), canAdmin && (_jsx("button", { className: "btn btnGhost", onClick: () => duplicate(t), type: "button", children: tLegal("templates.actions.duplicate") })), canAdmin && (_jsx("button", { className: "btn btnGhost", onClick: () => remove(t), type: "button", children: tCommon("actions.delete") }))] })] }, t.id))) })] }) }))] }));
}
