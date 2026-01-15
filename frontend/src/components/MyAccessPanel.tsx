import React, { useEffect, useMemo, useState } from "react";
import { AccessRequest, Area, AreaAccess, api } from "../api/client";
import ConfirmModal from "./ConfirmModal";
import { useTranslation } from "react-i18next";

export default function MyAccessPanel({
  areas,
  accessMap,
  onRefresh,
  onSelectArea,
  pushToast,
  isSuperAdmin = false,
}: {
  areas: Area[];
  accessMap: Record<number, AreaAccess>;
  onRefresh: () => void;
  onSelectArea: (id: number) => void;
  pushToast: (msg: string, tone?: "info" | "danger" | "success") => void;
  isSuperAdmin?: boolean;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [catalog, setCatalog] = useState<Area[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AccessRequest | null>(null);

  const loadCatalog = async () => {
    try {
      const res = (await api.listAllAreas()) as Area[];
      setCatalog(res);
    } catch (e) {
      // ignore
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = (await api.myAccessRequests()) as AccessRequest[];
      setRequests(res);
    } catch (e: any) {
      pushToast(e.message || tDash("myAccess.errors.failedToLoadRequests"), "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadRequests();
  }, []);

  const availableToRequest = useMemo(() => catalog.filter((a) => !accessMap[a.id]), [catalog, accessMap]);

  const pendingAreaIds = useMemo(
    () =>
      requests
        .filter((r) => r.status === "PENDING")
        .map((r) => r.area_id),
    [requests]
  );

  const statusTone: Record<string, string> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    CANCELLED: "subtle",
  };

  const selectableAreas = availableToRequest.filter((a) => !pendingAreaIds.includes(a.id));

  const onSubmitRequest = async () => {
    setFormError(null);
    if (!selectedAreaIds.length) {
      setFormError(
        selectableAreas.length === 0
          ? tDash("myAccess.requestModal.errors.noAreasAvailable")
          : tDash("myAccess.requestModal.errors.selectAtLeastOne")
      );
      return;
    }
    try {
      await api.createAccessRequests(selectedAreaIds, message || undefined);
      pushToast(tDash("myAccess.toast.requestSent"), "success");
      setShowModal(false);
      setSelectedAreaIds([]);
      setMessage("");
      await loadRequests();
    } catch (e: any) {
      setFormError(e.message || tDash("myAccess.requestModal.errors.failedToSubmit"));
    }
  };

  const cancelRequest = async () => {
    if (!cancelTarget) return;
    try {
      await api.cancelAccessRequest(cancelTarget.id);
      pushToast(tDash("myAccess.toast.requestCancelled"), "info");
      setCancelTarget(null);
      await loadRequests();
      await onRefresh();
    } catch (e: any) {
      pushToast(e.message || tDash("myAccess.errors.failedToCancel"), "danger");
    }
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("myAccess.eyebrow")}</div>
          <div className="h2">{tDash("myAccess.title")}</div>
          <div className="muted">{tDash("myAccess.subtitle")}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={onRefresh}>{tDash("myAccess.refresh")}</button>
          {!isSuperAdmin && (
            <button className="btn btnPrimary" onClick={() => setShowModal(true)}>
              {tDash("myAccess.requestAccess")}
            </button>
          )}
        </div>
      </div>

      <div className="cardBody">
        <div className="cardSubsection">
          <div className="h3">{tDash("myAccess.allowedAreas.title")}</div>
          <div className="grid twoCols">
            {areas.length === 0 && <span className="muted">{tDash("myAccess.allowedAreas.none")}</span>}
            {areas.map((a) => (
              <div key={a.id} className="card" style={{ boxShadow: "none", borderStyle: "dashed" }}>
                <div className="h3" style={{ marginBottom: 4 }}>{a.name}</div>
                <div className="muted">{a.key}</div>
                <div className="tagRow" style={{ marginTop: 8 }}>
                  <span className="pill success">{tCommon("status.approved")}</span>
                </div>
                <button className="btn" style={{ marginTop: 10 }} onClick={() => onSelectArea(a.id)}>
                  {tCommon("actions.open")}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="cardSubsection">
          <div className="h3">{tDash("myAccess.history.title")}</div>
          {loading && <div className="muted">{tDash("myAccess.history.loading")}</div>}
          {!loading && requests.length === 0 && (
            <div className="emptyState">
              <div className="emptyTitle">{tDash("myAccess.history.empty.title")}</div>
              <div className="emptyText">{tDash("myAccess.history.empty.text")}</div>
            </div>
          )}
          {!loading && requests.length > 0 && (
            <div className="grid twoCols">
              {requests.map((r) => (
                <div key={r.id} className="card" style={{ boxShadow: "none", borderStyle: "dashed" }}>
                  <div className="h3">{r.area?.name || tCommon("labels.area")}</div>
                  <div className="tagRow" style={{ marginTop: 4 }}>
                    <span className={`pill ${statusTone[r.status] || ""}`}>{tDash(`myAccess.status.${r.status.toLowerCase()}`)}</span>
                    {r.message && <span className="pill subtle">{tDash("myAccess.history.note")}</span>}
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>{r.message || tDash("myAccess.history.noMessage")}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {tDash("myAccess.history.requestedOn", { date: new Date(r.created_at).toLocaleDateString() })}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    {r.status === "PENDING" && (
                      <button className="btn btnGhost" onClick={() => setCancelTarget(r)}>
                        {tCommon("actions.cancel")}
                      </button>
                    )}
                    {r.status === "APPROVED" && accessMap[r.area_id] && (
                      <button className="btn" onClick={() => onSelectArea(r.area_id)}>
                        {tDash("myAccess.history.goToArea")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isSuperAdmin && showModal && (
        <div className="modalOverlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="card modalCard">
            <div className="h3">{tDash("myAccess.requestModal.title")}</div>
            <div className="muted" style={{ marginBottom: 10 }}>
              {tDash("myAccess.requestModal.subtitle")}
            </div>
            <div className="cardSubsection" style={{ maxHeight: 280, overflowY: "auto" }}>
              {availableToRequest.length === 0 && (
                <div className="emptyState">
                  <div className="emptyTitle">{tDash("myAccess.requestModal.empty.title")}</div>
                  <div className="emptyText">{tDash("myAccess.requestModal.empty.text")}</div>
                </div>
              )}
              {availableToRequest.map((a) => {
                const disabled = pendingAreaIds.includes(a.id);
                const checked = selectedAreaIds.includes(a.id);
                return (
                  <label key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                    <div className="row" style={{ alignItems: "center", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={checked || disabled}
                        disabled={disabled}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedAreaIds([...selectedAreaIds, a.id]);
                          else setSelectedAreaIds(selectedAreaIds.filter((id) => id !== a.id));
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                        <div className="muted">{a.key}</div>
                      </div>
                    </div>
                    {disabled && <span className="pill warning">{tCommon("status.pending")}</span>}
                  </label>
                );
              })}
            </div>

            <div className="spacer-sm" />
            <label className="fieldLabel">{tDash("myAccess.requestModal.messageLabel")}</label>
            <textarea
              className="input"
              placeholder={tDash("myAccess.requestModal.messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ minHeight: 80 }}
            />

            {formError && <div className="formError">{formError}</div>}
            <div className="modalActions">
              <button className="btn" onClick={() => setShowModal(false)}>
                {tCommon("actions.close")}
              </button>
              <button className="btn btnPrimary" onClick={onSubmitRequest} disabled={selectableAreas.length === 0}>
                {tDash("myAccess.requestModal.submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <ConfirmModal
          title={tDash("myAccess.cancelModal.title")}
          message={tDash("myAccess.cancelModal.message")}
          confirmLabel={tDash("myAccess.cancelModal.confirm")}
          onClose={() => setCancelTarget(null)}
          onConfirm={cancelRequest}
        />
      )}
    </div>
  );
}
