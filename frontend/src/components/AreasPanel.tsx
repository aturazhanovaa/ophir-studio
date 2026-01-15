import React, { useEffect, useMemo, useState } from "react";
import { AccessRequest, Area, AreaAccess, api } from "../api/client";
import AreaBadge from "./AreaBadge";
import { useTranslation } from "react-i18next";

export default function AreasPanel({
  userRole,
  accessMap,
  onOpenArea,
  pushToast,
}: {
  userRole?: string;
  accessMap: Record<number, AreaAccess>;
  onOpenArea: (id: number) => void;
  pushToast: (msg: string, tone?: "info" | "danger" | "success") => void;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [catalog, setCatalog] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<AccessRequest[]>([]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const res = (await api.listAllAreas()) as Area[];
      setCatalog(res);
    } catch (e: any) {
      pushToast(e.message || tDash("areasPanel.errors.failedToLoadAreas"), "danger");
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const res = (await api.myAccessRequests()) as AccessRequest[];
      setRequests(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCatalog();
    loadRequests();
  }, []);

  const accessibleIds = new Set(Object.keys(accessMap).map((k) => Number(k)));
  const pendingByArea = useMemo(() => {
    const m: Record<number, AccessRequest> = {};
    requests.forEach((r) => {
      if (r.status === "PENDING") m[r.area_id] = r;
    });
    return m;
  }, [requests]);

  const requestArea = async (areaId: number) => {
    try {
      await api.createAccessRequests([areaId]);
      pushToast(tDash("accessCenter.toast.requestSubmitted"), "success");
      await loadRequests();
    } catch (e: any) {
      pushToast(e.message || tDash("areasPanel.errors.unableToRequest"), "danger");
    }
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("areasPanel.eyebrow")}</div>
          <div className="h2">{tDash("areasPanel.title")}</div>
          <div className="muted">{tDash("areasPanel.subtitle")}</div>
        </div>
      </div>

      {loading && <div className="muted">{tDash("areasPanel.loadingAreas")}</div>}

      {!loading && (
        <div className="grid twoCols">
          {catalog.map((area) => {
            const hasAccess = accessibleIds.has(area.id) || userRole === "SUPER_ADMIN";
            const pending = pendingByArea[area.id];
            return (
              <div key={area.id} className="card" style={{ boxShadow: "none" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <AreaBadge name={area.name} color={area.color} size="sm" />
                  <div className="muted small">{tDash("areasPanel.key", { key: area.key })}</div>
                </div>
                <div className="tagRow" style={{ marginBottom: 12 }}>
                  {hasAccess && <span className="pill success">{tCommon("status.approved")}</span>}
                  {!hasAccess && pending && <span className="pill warning">{tCommon("status.pending")}</span>}
                  {!hasAccess && !pending && <span className="pill warning">{tDash("areasPanel.requestNeeded")}</span>}
                </div>
                {hasAccess ? (
                  <button className="btn" onClick={() => onOpenArea(area.id)}>{tCommon("actions.open")}</button>
                ) : (
                  userRole !== "SUPER_ADMIN" && (
                    <button
                      className="btn btnPrimary"
                      onClick={() => requestArea(area.id)}
                      disabled={!!pending}
                    >
                      {pending ? tDash("areasPanel.requested") : tDash("areasPanel.requestAccess")}
                    </button>
                  )
                )}
                {userRole === "SUPER_ADMIN" && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>{tDash("areasPanel.superAdminHasAccess")}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
