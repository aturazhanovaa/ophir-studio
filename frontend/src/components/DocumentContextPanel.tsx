import React, { useState } from "react";
import { DocumentDetail, api } from "../api/client";
import AreaBadge from "./AreaBadge";
import { useTranslation } from "react-i18next";

export default function DocumentContextPanel({
  doc,
  loading,
  canManage,
  areaKey,
  areaId,
  areaColor,
  onUploadVersion,
  onRename,
  onDelete,
  onBack,
}: {
  doc: DocumentDetail | null;
  loading: boolean;
  canManage: boolean;
  areaKey: string | null;
  areaId: number | null;
  areaColor?: string | null;
  onUploadVersion: () => void;
  onRename: () => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [downloadErr, setDownloadErr] = useState<string | null>(null);
  const [downloadingVersion, setDownloadingVersion] = useState<number | null>(null);

  const handleDownload = async (version?: number) => {
    if (!doc) return;
    setDownloadErr(null);
    const v = version ?? doc.latest_version;
    setDownloadingVersion(v);
    try {
      const { blob, filename } = await api.downloadDocument(doc.id, version);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setDownloadErr(e?.message || tDash("documentDetails.errors.downloadFailed"));
    } finally {
      setDownloadingVersion(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="skeletonLine" style={{ width: "50%" }} />
        <div className="spacer-sm" />
        <div className="skeletonLine" />
        <div className="skeletonLine short" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">{tDash("documents.detailPanel.empty.title")}</div>
          <div className="emptyText">{tDash("documents.contextPanel.empty.text")}</div>
        </div>
      </div>
    );
  }

  const latestUploaded = doc.versions[0]?.created_at || doc.created_at;

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("documentDetails.eyebrow")}</div>
          <div className="h2">{doc.title}</div>
          <div className="muted">v{doc.latest_version} · {doc.mime_type || tDash("documentDetails.fileFallback")}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={onBack}>{tCommon("actions.back")}</button>
        </div>
      </div>

      <div className="tagRow">
        {doc.tags && doc.tags.length ? (
          doc.tags.map((t) => <span key={t} className="pill">{t}</span>)
        ) : (
          <span className="muted">{tCommon("empty.noTags")}</span>
        )}
      </div>

      <div className="cardSubsection">
        <div className="grid twoCols">
          <div>
            <div className="muted">{tCommon("labels.area")}</div>
            {areaKey ? <AreaBadge name={areaKey} color={areaColor} size="sm" /> : <div>—</div>}
          </div>
          <div>
            <div className="muted">{tCommon("labels.file")}</div>
            <div>{doc.original_name}</div>
          </div>
          <div>
            <div className="muted">{tCommon("labels.created")}</div>
            <div>{new Date(doc.created_at).toLocaleString()}</div>
          </div>
          <div>
            <div className="muted">{tCommon("labels.updated")}</div>
            <div>{latestUploaded ? new Date(latestUploaded).toLocaleString() : "—"}</div>
          </div>
        </div>
      </div>

      <div className="cardSubsection row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => handleDownload()}>
          {downloadingVersion === doc.latest_version ? tCommon("actions.downloading") : tCommon("actions.download")}
        </button>
        {canManage && (
          <>
            <button className="btn" onClick={onRename}>{tDash("documents.actions.rename")}</button>
            <button className="btn" onClick={onUploadVersion}>{tDash("documentDetails.versioning.uploadVersion")}</button>
            <button className="btn btnDangerGhost" onClick={onDelete}>{tCommon("actions.delete")}</button>
          </>
        )}
      </div>
      {downloadErr && <div className="formError">{downloadErr}</div>}

      <div className="divider" />
      <div className="h3">{tDash("documentDetails.versions.eyebrow")}</div>
      <div className="table">
        <div className="tableHead">
          <div>{tCommon("labels.version")}</div>
          <div>{tDash("documentDetails.versions.uploaded")}</div>
          <div>{tCommon("labels.file")}</div>
          <div />
        </div>
        <div className="tableBody">
          {doc.versions.map((v) => (
            <div key={v.id} className="tableRow">
              <div>v{v.version}</div>
              <div>{new Date(v.created_at).toLocaleString()}</div>
              <div className="muted">{v.original_name}</div>
              <div style={{ textAlign: "right" }}>
                <button
                  className="btn btnGhost"
                  onClick={() => handleDownload(v.version)}
                  disabled={downloadingVersion === v.version}
                >
                  {downloadingVersion === v.version ? tCommon("actions.downloading") : tCommon("actions.download")}
                </button>
              </div>
            </div>
          ))}
          {doc.versions.length === 0 && (
            <div className="emptyState">
              <div className="emptyText">{tDash("documentDetails.versions.none")}</div>
            </div>
          )}
          {downloadErr && <div className="formError">{downloadErr}</div>}
        </div>
      </div>

    </div>
  );
}
