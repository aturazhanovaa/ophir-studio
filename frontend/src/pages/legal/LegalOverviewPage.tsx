import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, LegalOverview } from "../../api/client";
import { useLocale } from "../../router/useLocale";

export default function LegalOverviewPage() {
  const locale = useLocale();
  const navigate = useNavigate();
  const [data, setData] = useState<LegalOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.legalOverview();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load Legal overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cards = useMemo(() => {
    const c = data?.counts || {};
    return [
      { key: "DRAFT", label: "Drafts", value: c.DRAFT ?? 0 },
      { key: "IN_REVIEW", label: "In Review", value: c.IN_REVIEW ?? 0 },
      { key: "APPROVED", label: "Approved", value: c.APPROVED ?? 0 },
      { key: "SIGNED", label: "Signed", value: c.SIGNED ?? 0 },
      { key: "REJECTED", label: "Rejected", value: c.REJECTED ?? 0 },
      { key: "EXPIRING_SOON", label: "Expiring Soon (30d)", value: data?.expiring_soon ?? 0 },
    ];
  }, [data]);

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div style={{ width: "100%" }}>
            <div className="eyebrow">Legal overview</div>
            <div className="h3">Search documents</div>
            <div className="row" style={{ gap: 10, marginTop: 10 }}>
              <input
                className="input"
                placeholder="Search by title, counterparty, or owner email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="btn btnPrimary"
                onClick={() => navigate(`/${locale}/legal/documents${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)}
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {error && <div className="errorBanner">{error}</div>}
      </div>

      <div className="grid twoCols">
        {cards.map((c) => (
          <div key={c.key} className="statCard">
            <div className="muted">{c.label}</div>
            <div className="statValue">{loading ? "…" : String(c.value)}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">Recent activity</div>
            <div className="h3">Audit trail (latest 20)</div>
          </div>
          <button className="btn btnGhost" onClick={load} disabled={loading} type="button">
            Refresh
          </button>
        </div>

        {!loading && data?.recent_activity?.length === 0 && (
          <div className="emptyState">
            <div className="emptyTitle">No activity yet</div>
            <div className="emptyText">Actions like create, edit, submit, approve, and exports will appear here.</div>
          </div>
        )}

        {data?.recent_activity?.length ? (
          <div className="table">
            <div className="tableHead" style={{ gridTemplateColumns: "1fr 140px 140px auto" }}>
              <div>Action</div>
              <div>Actor</div>
              <div>When</div>
              <div />
            </div>
            <div className="tableBody">
              {data.recent_activity.map((a) => (
                <div key={a.id} className="tableRow" style={{ gridTemplateColumns: "1fr 140px 140px auto" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.action}</div>
                    {a.document_id && <div className="muted">Document #{a.document_id}</div>}
                  </div>
                  <div className="muted">{a.actor_id ?? "—"}</div>
                  <div className="muted">{new Date(a.created_at).toLocaleString()}</div>
                  <div style={{ textAlign: "right" }}>
                    {a.document_id ? (
                      <button className="btn btnGhost" onClick={() => navigate(`/${locale}/legal/documents/${a.document_id}`)} type="button">
                        View
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

