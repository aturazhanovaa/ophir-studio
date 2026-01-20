import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, LegalTemplate } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLocale } from "../../router/useLocale";
import { canManageLegalTemplates } from "./legalAccess";
import { useTranslation } from "react-i18next";

export default function LegalTemplatesPage({ onToast }: { onToast?: (msg: string, tone?: "info" | "danger" | "success") => void }) {
  const { user } = useAuth();
  const locale = useLocale();
  const navigate = useNavigate();
  const { t: tLegal } = useTranslation("legal");
  const { t: tCommon } = useTranslation("common");

  const canAdmin = canManageLegalTemplates(user);

  const [templates, setTemplates] = useState<LegalTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listLegalTemplates();
      setTemplates(res);
    } catch (e: any) {
      setError(e?.message || tLegal("templates.errors.failedToLoad"));
      setTemplates([]);
    } finally {
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
      if (typeFilter && t.type !== typeFilter) return false;
      if (!term) return true;
      return (
        (t.name || "").toLowerCase().includes(term) ||
        (t.type || "").toLowerCase().includes(term) ||
        (t.body || "").toLowerCase().includes(term)
      );
    });
  }, [templates, query, typeFilter]);

  const duplicate = async (t: LegalTemplate) => {
    if (!canAdmin) return;
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
    } catch (e: any) {
      setError(e?.message || tLegal("templates.errors.failedToDuplicate"));
      onToast?.(e?.message || tLegal("templates.errors.failedToDuplicate"), "danger");
    }
  };

  const remove = async (t: LegalTemplate) => {
    if (!canAdmin) return;
    const ok = window.confirm(tLegal("templates.confirmDelete", { name: t.name }));
    if (!ok) return;
    setError(null);
    try {
      await api.deleteLegalTemplate(t.id);
      onToast?.(tLegal("templates.toast.deleted"), "success");
      await load();
    } catch (e: any) {
      setError(e?.message || tLegal("templates.errors.failedToDelete"));
      onToast?.(e?.message || tLegal("templates.errors.failedToDelete"), "danger");
    }
  };

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tLegal("templates.eyebrow")}</div>
            <div className="h3">{tLegal("templates.title")}</div>
            <div className="muted">{tLegal("templates.subtitle", { example: "{{client_name}}" })}</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            {canAdmin && (
              <button className="btn btnPrimary" onClick={() => navigate(`/${locale}/legal/templates/new`)} type="button">
                {tLegal("templates.actions.createTemplate")}
              </button>
            )}
            <button className="btn btnGhost" onClick={load} disabled={loading} type="button">
              {tCommon("actions.reload")}
            </button>
          </div>
        </div>

        <div className="formGrid">
          <div className="formGroup">
            <label className="fieldLabel">{tLegal("templates.filters.search")}</label>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tLegal("templates.filters.searchPlaceholder")} />
          </div>
          <div className="formGroup">
            <label className="fieldLabel">{tLegal("templates.filters.type")}</label>
            <select className="input select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{tLegal("templates.filters.allTypes")}</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="errorBanner">{error}</div>}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="card">
          <div className="emptyState">
            <div className="emptyTitle">{tLegal("templates.empty.title")}</div>
            <div className="emptyText">{tLegal("templates.empty.text")}</div>
            {canAdmin && (
              <button className="btn btnPrimary" onClick={() => navigate(`/${locale}/legal/templates/new`)} type="button">
                {tLegal("templates.actions.createTemplate")}
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card">
          <div className="table">
            <div className="tableHead" style={{ gridTemplateColumns: "1fr 0.6fr 0.5fr 0.6fr 0.7fr auto" }}>
              <div>{tLegal("templates.table.name")}</div>
              <div>{tLegal("templates.table.type")}</div>
              <div>{tLegal("templates.table.variables")}</div>
              <div>{tLegal("templates.table.approvers")}</div>
              <div>{tLegal("templates.table.updated")}</div>
              <div />
            </div>
            <div className="tableBody">
              {filtered.map((t) => (
                <div key={t.id} className="tableRow" style={{ gridTemplateColumns: "1fr 0.6fr 0.5fr 0.6fr 0.7fr auto" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{t.name}</div>
                    <div className="muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.body?.slice(0, 120) || "—"}
                    </div>
                  </div>
                  <div className="muted">{t.type}</div>
                  <div className="muted">{Array.isArray(t.variables) ? t.variables.length : 0}</div>
                  <div className="muted">{Array.isArray(t.default_approvers) ? t.default_approvers.length : 0}</div>
                  <div className="muted">{new Date(t.updated_at).toLocaleString()}</div>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button className="btn btnGhost" onClick={() => navigate(`/${locale}/legal/templates/${t.id}`)} type="button">
                      {canAdmin ? tCommon("actions.edit") : tCommon("actions.open")}
                    </button>
                    {canAdmin && (
                      <button className="btn btnGhost" onClick={() => duplicate(t)} type="button">
                        {tLegal("templates.actions.duplicate")}
                      </button>
                    )}
                    {canAdmin && (
                      <button className="btn btnGhost" onClick={() => remove(t)} type="button">
                        {tCommon("actions.delete")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
