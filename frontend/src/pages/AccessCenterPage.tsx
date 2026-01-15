import React, { useEffect, useMemo, useState } from "react";
import { AccessRequest, Area, AreaAccess, api } from "../api/client";
import AreaBadge from "../components/AreaBadge";
import { useTranslation } from "react-i18next";

type AdminUser = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  areas: { area_id: number; area_name: string }[];
};

export default function AccessCenterPage({
  areas,
  accessMap,
  userRole,
  refreshAccess,
}: {
  areas: Area[];
  accessMap: Record<number, AreaAccess>;
  userRole?: string;
  refreshAccess: () => void;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [catalog, setCatalog] = useState<Area[]>(areas);
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [requestAreaId, setRequestAreaId] = useState<number | "">("");
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adminRequests, setAdminRequests] = useState<AccessRequest[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [grantUserId, setGrantUserId] = useState<number | "">("");
  const [grantAreaIds, setGrantAreaIds] = useState<number[]>([]);
  const [granting, setGranting] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const accessibleIds = useMemo(() => new Set(Object.keys(accessMap).map((k) => Number(k))), [accessMap]);

  const loadCatalog = async () => {
    try {
      const res = (await api.listAllAreas()) as Area[];
      setCatalog(res);
    } catch {
      setCatalog(areas);
    }
  };

  const loadMyRequests = async () => {
    try {
      const res = (await api.myAccessRequests()) as AccessRequest[];
      setMyRequests(res);
    } catch {
      setMyRequests([]);
    }
  };

  const loadAdminRequests = async () => {
    if (userRole !== "SUPER_ADMIN") return;
    setLoadingAdmin(true);
    try {
      const res = (await api.adminListAccessRequests("PENDING")) as AccessRequest[];
      setAdminRequests(res);
    } catch {
      setAdminRequests([]);
    } finally {
      setLoadingAdmin(false);
    }
  };

  const loadUsers = async () => {
    if (userRole !== "SUPER_ADMIN") return;
    try {
      const res = (await api.adminListUsers()) as AdminUser[];
      setUsers(res);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadMyRequests();
    loadAdminRequests();
    loadUsers();
  }, []);

  const statusLabel = (status?: string | null) => {
    const normalized = (status || "").toUpperCase();
    if (normalized === "PENDING") return tCommon("status.pending");
    if (normalized === "APPROVED") return tCommon("status.approved");
    if (normalized === "REJECTED") return tCommon("status.rejected");
    return status || "—";
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestAreaId) return;
    setSubmitting(true);
    setToast(null);
    try {
      await api.createAccessRequests([Number(requestAreaId)], requestReason || undefined);
      setToast(tDash("accessCenter.toast.requestSubmitted"));
      setRequestAreaId("");
      setRequestReason("");
      await loadMyRequests();
    } catch (err: any) {
      setToast(err?.message || tDash("accessCenter.toast.unableToSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (req: AccessRequest) => {
    try {
      await api.adminApproveRequest(req.id);
      setToast(tDash("accessCenter.toast.requestApproved"));
      await loadAdminRequests();
      refreshAccess();
    } catch (e: any) {
      setToast(e?.message || tDash("accessCenter.toast.approvalFailed"));
    }
  };

  const reject = async (req: AccessRequest) => {
    try {
      const note = decisionNotes[req.id] || undefined;
      await api.adminRejectRequest(req.id, note);
      setDecisionNotes((prev) => ({ ...prev, [req.id]: "" }));
      setToast(tDash("accessCenter.toast.requestRejected"));
      await loadAdminRequests();
    } catch (e: any) {
      setToast(e?.message || tDash("accessCenter.toast.rejectionFailed"));
    }
  };

  const grantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId || grantAreaIds.length === 0) return;
    setGranting(true);
    setToast(null);
    try {
      await api.adminGrantAreas(Number(grantUserId), grantAreaIds);
      setToast(tDash("accessCenter.toast.accessGranted"));
      setGrantAreaIds([]);
      setGrantUserId("");
      await loadUsers();
      refreshAccess();
    } catch (err: any) {
      setToast(err?.message || tDash("accessCenter.toast.unableToGrant"));
    } finally {
      setGranting(false);
    }
  };

  const requestableAreas = catalog.filter((a) => !accessibleIds.has(a.id));

  return (
    <div className="pageStack">
      {toast && (
        <div className="inlinePanel">
          <div className="muted">{toast}</div>
        </div>
      )}

      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tDash("accessCenter.eyebrow")}</div>
            <div className="h2">{tDash("accessCenter.title")}</div>
            <div className="muted">{tDash("accessCenter.subtitle")}</div>
          </div>
        </div>
        <div className="tagRow" style={{ marginBottom: 12 }}>
          {accessibleIds.size === 0 && <span className="muted">{tDash("accessCenter.noAccessYet")}</span>}
          {catalog
            .filter((a) => accessibleIds.has(a.id))
            .map((a) => (
              <AreaBadge key={a.id} name={a.name} color={a.color} size="sm" />
            ))}
        </div>

        <div className="cardSubsection">
          <div className="h3">{tDash("accessCenter.requestAccess.title")}</div>
          <form className="formGrid" onSubmit={submitRequest}>
            <div className="formGroup">
              <label className="fieldLabel">{tCommon("labels.area")}</label>
              <select
                className="input select"
                value={requestAreaId}
                onChange={(e) => setRequestAreaId(Number(e.target.value) || "")}
              >
                <option value="">{tDash("accessCenter.requestAccess.selectArea")}</option>
                {requestableAreas.map((a) => (
                  <option key={a.id} value={a.id} style={{ color: a.color || undefined }}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <label className="fieldLabel">{tCommon("labels.reason")}</label>
              <textarea
                className="input"
                style={{ minHeight: 80 }}
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder={tCommon("placeholders.tellAdminWhy")}
              />
            </div>
            <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
              <button className="btn btnPrimary" type="submit" disabled={submitting}>
                {submitting ? tCommon("actions.submitting") : tDash("accessCenter.requestAccess.submit")}
              </button>
            </div>
          </form>
          {myRequests.length > 0 && (
            <div className="inlinePanel" style={{ marginTop: 10 }}>
              <div className="h3">{tDash("accessCenter.recentRequests.title")}</div>
              <div className="table">
                <div className="tableHead" style={{ gridTemplateColumns: "1fr 1fr 120px" }}>
                  <div>{tCommon("labels.area")}</div>
                  <div>{tCommon("labels.message")}</div>
                  <div>{tCommon("labels.status")}</div>
                </div>
                <div className="tableBody">
                  {myRequests.map((r) => (
                    <div key={r.id} className="tableRow" style={{ gridTemplateColumns: "1fr 1fr 120px" }}>
                      <div>{r.area ? <AreaBadge name={r.area.name} color={r.area.color} size="sm" /> : "—"}</div>
                      <div className="muted">{r.message || "—"}</div>
                      <div>
                        <span className={`pill ${r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : "danger"}`}>
                          {statusLabel(r.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {userRole === "SUPER_ADMIN" && (
        <>
          <div className="card">
            <div className="cardHeader">
              <div>
                <div className="eyebrow">{tDash("accessCenter.superAdmin.eyebrow")}</div>
                <div className="h2">{tDash("accessCenter.superAdmin.title")}</div>
                <div className="muted">{tDash("accessCenter.superAdmin.subtitle")}</div>
              </div>
            </div>
            {loadingAdmin && <div className="muted">{tCommon("loading.loading")}</div>}
            {!loadingAdmin && adminRequests.length === 0 && (
              <div className="emptyState">
                <div className="emptyTitle">{tDash("accessCenter.superAdmin.empty.title")}</div>
                <div className="emptyText">{tDash("accessCenter.superAdmin.empty.text")}</div>
              </div>
            )}
            {!loadingAdmin && adminRequests.length > 0 && (
              <div className="inboxList">
                {adminRequests.map((r) => (
                  <div key={r.id} className="inboxRow">
                    <div className="inboxMain">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {r.area ? <AreaBadge name={r.area.name} color={r.area.color} size="sm" /> : tCommon("labels.area")}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>{r.requester?.email}</div>
                        </div>
                        <span className="pill warning">{statusLabel("PENDING")}</span>
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>{r.message || tDash("accessCenter.superAdmin.noMessage")}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {tDash("accessCenter.superAdmin.requestedOn", { date: new Date(r.created_at).toLocaleDateString() })}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn btnPrimary" onClick={() => approve(r)}>{tDash("accessCenter.superAdmin.approve")}</button>
                      <button className="btn btnDangerGhost" onClick={() => reject(r)}>{tDash("accessCenter.superAdmin.reject")}</button>
                    </div>
                    <div className="inlinePanel" style={{ gridColumn: "1 / -1" }}>
                      <label className="fieldLabel">{tDash("accessCenter.superAdmin.decisionNote.label")}</label>
                      <textarea
                        className="input"
                        style={{ minHeight: 60 }}
                        value={decisionNotes[r.id] || ""}
                        onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder={tDash("accessCenter.superAdmin.decisionNote.placeholder")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="cardHeader">
              <div>
                <div className="eyebrow">{tDash("accessCenter.manual.eyebrow")}</div>
                <div className="h2">{tDash("accessCenter.manual.title")}</div>
                <div className="muted">{tDash("accessCenter.manual.subtitle")}</div>
              </div>
            </div>
            <form className="formGrid" onSubmit={grantAccess}>
              <div className="formGroup">
                <label className="fieldLabel">{tDash("accessCenter.manual.user")}</label>
                <select
                  className="input select"
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(Number(e.target.value) || "")}
                >
                  <option value="">{tDash("accessCenter.manual.selectUser")}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                <label className="fieldLabel">{tDash("accessCenter.manual.areasToGrant")}</label>
                <div className="checkGrid">
                  {catalog.map((a) => (
                    <label key={a.id} className="checkRow">
                      <input
                        type="checkbox"
                        checked={grantAreaIds.includes(a.id)}
                        onChange={(e) => {
                          if (e.target.checked) setGrantAreaIds((prev) => [...prev, a.id]);
                          else setGrantAreaIds((prev) => prev.filter((id) => id !== a.id));
                        }}
                      />
                      <AreaBadge name={a.name} color={a.color} size="sm" />
                      <span className="muted">{a.key}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
                <button className="btn btnPrimary" type="submit" disabled={granting}>
                  {granting ? tDash("documentDetails.actions.saving") : tDash("accessCenter.manual.grantAccess")}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
