import React, { useEffect, useState } from "react";
import { AccessRequest, api } from "../api/client";
import AreaBadge from "./AreaBadge";
import { useTranslation } from "react-i18next";

export default function AccessRequestsPanel({
  onToast,
  refreshMyAccess,
}: {
  onToast: (msg: string, tone?: "info" | "danger" | "success") => void;
  refreshMyAccess: () => void;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>({});

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = (await api.adminListAccessRequests(statusFilter === "PENDING" ? "PENDING" : undefined)) as AccessRequest[];
      setRequests(res);
    } catch (e: any) {
      onToast(e.message || tDash("accessRequests.errors.failedToLoad"), "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const approveRequest = async (req: AccessRequest) => {
    try {
      await api.adminApproveRequest(req.id);
      onToast(tDash("accessCenter.toast.requestApproved"), "success");
      await loadRequests();
      refreshMyAccess();
    } catch (e: any) {
      onToast(e.message || tDash("accessRequests.errors.failedToApprove"), "danger");
    }
  };

  const rejectRequest = async (req: AccessRequest) => {
    try {
      const note = decisionNotes[req.id] || undefined;
      await api.adminRejectRequest(req.id, note);
      onToast(tDash("accessCenter.toast.requestRejected"), "info");
      setDecisionNotes((prev) => ({ ...prev, [req.id]: "" }));
      await loadRequests();
    } catch (e: any) {
      onToast(e.message || tDash("accessRequests.errors.failedToReject"), "danger");
    }
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("accessCenter.superAdmin.eyebrow")}</div>
          <div className="h2">{tDash("accessRequests.title")}</div>
          <div className="muted">{tDash("accessRequests.subtitle")}</div>
        </div>
        <div className="row">
          <button
            className={`btn ${statusFilter === "PENDING" ? "btnPrimary" : ""}`}
            onClick={() => setStatusFilter("PENDING")}
          >
            {tCommon("status.pending")}
          </button>
          <button
            className={`btn ${statusFilter === "ALL" ? "btnPrimary" : ""}`}
            onClick={() => setStatusFilter("ALL")}
          >
            {tDash("accessRequests.filters.all")}
          </button>
        </div>
      </div>

      {loading && <div className="muted">{tDash("myAccess.history.loading")}</div>}
      {!loading && requests.length === 0 && (
        <div className="emptyState">
          <div className="emptyTitle">{tDash("accessRequests.empty.title")}</div>
          <div className="emptyText">{tDash("accessCenter.superAdmin.empty.text")}</div>
        </div>
      )}
      {!loading && requests.length > 0 && (
        <div className="inboxList">
          {requests.map((r) => (
            <div key={r.id} className="inboxRow">
              <div className="inboxMain">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.area ? <AreaBadge name={r.area.name} color={r.area.color} size="sm" /> : tCommon("labels.area")}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{r.requester?.email}</div>
                  </div>
                  <span className={`pill ${r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : "danger"}`}>
                    {r.status === "PENDING" ? tCommon("status.pending") : r.status === "APPROVED" ? tCommon("status.approved") : tCommon("status.rejected")}
                  </span>
                </div>
                <div className="muted" style={{ marginTop: 6 }}>{r.message || tDash("accessCenter.superAdmin.noMessage")}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {tDash("accessCenter.superAdmin.requestedOn", { date: new Date(r.created_at).toLocaleDateString() })}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {r.status === "PENDING" ? (
                  <>
                    <button className="btn btnPrimary" onClick={() => approveRequest(r)}>{tDash("accessCenter.superAdmin.approve")}</button>
                    <button className="btn btnDangerGhost" onClick={() => rejectRequest(r)}>{tDash("accessCenter.superAdmin.reject")}</button>
                  </>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.decided_by_user_id ? tDash("accessRequests.decidedOn", { date: new Date(r.decided_at || "").toLocaleDateString() }) : ""}
                  </div>
                )}
              </div>
              {r.status === "PENDING" && (
                <div className="inlinePanel">
                  <label className="fieldLabel">{tDash("accessCenter.superAdmin.decisionNote.label")}</label>
                  <textarea
                    className="input"
                    style={{ minHeight: 70 }}
                    value={decisionNotes[r.id] || ""}
                    onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder={tDash("accessCenter.superAdmin.decisionNote.placeholder")}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
