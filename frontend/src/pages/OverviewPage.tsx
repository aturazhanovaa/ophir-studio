import React, { useMemo } from "react";
import { Area, AreaAccess } from "../api/client";
import { useTranslation } from "react-i18next";

export default function OverviewPage({
  areas,
  accessMap,
  isSuperAdmin,
  onOpenAccess,
  onOpenDocuments,
  onOpenAsk,
  onOpenLegalNew,
  canCreateLegal,
  loading,
}: {
  areas: Area[];
  accessMap: Record<number, AreaAccess>;
  isSuperAdmin: boolean;
  onOpenAccess: () => void;
  onOpenDocuments: () => void;
  onOpenAsk: () => void;
  onOpenLegalNew: () => void;
  canCreateLegal: boolean;
  loading: boolean;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const accessCount = useMemo(() => Object.keys(accessMap).length, [accessMap]);

  return (
    <div className="pageStack">
      <div className="grid twoCols">
        <StatCard
          label={tDash("overview.areasAvailable")}
          value={loading ? tCommon("loading.loading") : String(areas.length)}
          helper={!loading && areas.length === 0 ? tDash("overview.noAreasCreated") : undefined}
        />
        <StatCard
          label={tDash("overview.areasYouCanAccess")}
          value={loading ? tCommon("loading.loading") : String(accessCount)}
          helper={!loading && accessCount === 0 ? tDash("overview.requestAccessToBegin") : undefined}
        />
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tDash("overview.quickActions")}</div>
            <div className="h3">{tDash("overview.jumpToWorkflows")}</div>
          </div>
        </div>
        <div className="grid twoCols">
          <ActionCard
            title={tDash("overview.documentsTitle")}
            description={tDash("overview.documentsDesc")}
            onClick={onOpenDocuments}
          />
          {canCreateLegal && (
            <ActionCard
              title={tDash("overview.legalCreateTitle")}
              description={tDash("overview.legalCreateDesc")}
              onClick={onOpenLegalNew}
            />
          )}
          <ActionCard
            title={tDash("overview.askAiTitle")}
            description={tDash("overview.askAiDesc")}
            onClick={onOpenAsk}
          />
          {!isSuperAdmin && (
            <ActionCard
              title={tDash("overview.accessCenterTitle")}
              description={tDash("overview.accessCenterDesc")}
              onClick={onOpenAccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: React.ReactNode; helper?: string }) {
  return (
    <div className="statCard">
      <div className="muted">{label}</div>
      <div className="statValue">{value}</div>
      {helper && <div className="muted small">{helper}</div>}
    </div>
  );
}

function ActionCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  const { t: tCommon } = useTranslation("common");
  return (
    <button className="card quickAction cardHover" onClick={onClick} type="button">
      <div className="h3">{title}</div>
      <div className="muted">{description}</div>
      <div className="actionRow">
        <span className="pill subtle">{tCommon("actions.open")}</span>
      </div>
    </button>
  );
}
