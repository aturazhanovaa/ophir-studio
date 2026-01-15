import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Area } from "../components/Sidebar";
import { DocumentDetail, api } from "../api/client";
import AreaBadge from "../components/AreaBadge";
import { useLocaleNavigate } from "../router/useLocaleNavigate";
import { useTranslation } from "react-i18next";

export default function DocumentDetailsPage({
  areas,
  canManage,
  onSelectArea,
}: {
  areas: Area[];
  canManage: (areaId?: number | null) => boolean;
  onSelectArea: (id: number) => void;
}) {
  const { docId } = useParams();
  const navigate = useLocaleNavigate();
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState<number | null>(null);

  const numericId = Number(docId);

  const area = useMemo(() => {
    if (!doc) return null;
    return areas.find((a) => a.id === doc.area_id) ?? null;
  }, [areas, doc]);

  useEffect(() => {
    if (doc?.area_id) onSelectArea(doc.area_id);
  }, [doc?.area_id, onSelectArea]);

  const loadDoc = async () => {
    if (!numericId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = (await api.getDocument(numericId)) as DocumentDetail;
      setDoc(detail);
      setTitle(detail.title);
      setTags(detail.tags?.join(", ") || "");
    } catch (e: any) {
      setError(e.message || tDash("documentDetails.errors.unableToLoad"));
      setDoc(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoc();
  }, [numericId]);

  const handleUpdate = async () => {
    if (!doc) return;
    setSaving(true);
    setMessage(null);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api.updateDocument(doc.id, { title: title || doc.title, tags: tagList });
      setMessage(tDash("documentDetails.messages.saved"));
      await loadDoc();
    } catch (e: any) {
      setError(e.message || tDash("documentDetails.errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc || !uploadFile) {
      setMessage(tDash("documentDetails.errors.chooseFile"));
      return;
    }
    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      await api.uploadVersion(doc.id, uploadFile);
      setUploadFile(null);
      setMessage(tDash("documentDetails.messages.versionUploaded"));
      await loadDoc();
    } catch (e: any) {
      setError(e.message || tDash("documents.errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!doc) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setMessage(tDash("documentDetails.messages.confirmDelete"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.deleteDocument(doc.id);
      navigate("/documents");
    } catch (e: any) {
      setError(e.message || tDash("documentDetails.errors.deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (version?: number) => {
    if (!doc) return;
    const target = version ?? doc.latest_version;
    setDownloadingVersion(target);
    setError(null);
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
      setError(e.message || tDash("documentDetails.errors.downloadFailed"));
    } finally {
      setDownloadingVersion(null);
    }
  };

  if (!numericId) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">{tDash("documentDetails.empty.noneTitle")}</div>
          <div className="emptyText">{tDash("documentDetails.empty.noneText")}</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <div className="skeletonLine" style={{ width: "50%" }} />
        <div className="skeletonLine" />
        <div className="skeletonLine short" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">{tDash("documentDetails.empty.notFoundTitle")}</div>
          <div className="emptyText">{tDash("documentDetails.empty.notFoundText")}</div>
        </div>
      </div>
    );
  }

  const latestUploaded = doc.versions[0]?.created_at || doc.created_at;
  const manageAllowed = canManage(doc.area_id);

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tDash("documentDetails.eyebrow")}</div>
            <div className="h2">{doc.title}</div>
            <div className="muted">v{doc.latest_version} · {doc.mime_type || tDash("documentDetails.fileFallback")}</div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => navigate("/documents")}>{tCommon("actions.backToList")}</button>
            <button className="btn" onClick={() => handleDownload()}>
              {downloadingVersion === doc.latest_version ? tCommon("actions.downloading") : tCommon("actions.download")}
            </button>
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
              <div>{area ? <AreaBadge name={area.name} color={area.color} size="sm" /> : "—"}</div>
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

        {manageAllowed && (
          <div className="cardSubsection formGrid">
            <div className="formGroup">
              <label className="fieldLabel">{tCommon("labels.title")}</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">{tCommon("labels.tagsCommaSeparated")}</label>
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="formGroup">
              <button className="btn btnPrimary" onClick={handleUpdate} disabled={saving}>
                {saving ? tDash("documentDetails.actions.saving") : tCommon("actions.saveChanges")}
              </button>
            </div>
          </div>
        )}

        {message && <div className="muted" style={{ marginTop: 8 }}>{message}</div>}
        {error && <div className="formError">{error}</div>}
      </div>

      {manageAllowed && (
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tDash("documentDetails.versioning.eyebrow")}</div>
              <div className="h2">{tDash("documentDetails.versioning.title")}</div>
            </div>
          </div>
          <form className="row" onSubmit={handleUploadVersion} style={{ alignItems: "flex-end" }}>
            <div className="formGroup" style={{ flex: 1 }}>
              <label className="fieldLabel">{tCommon("labels.file")}</label>
              <input className="input" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <button className="btn btnPrimary" type="submit" disabled={uploading}>
              {uploading ? tCommon("actions.uploading") : tDash("documentDetails.versioning.uploadVersion")}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tDash("documentDetails.versions.eyebrow")}</div>
            <div className="h2">{tDash("documentDetails.versions.title")}</div>
          </div>
        </div>
        <div className="table">
          <div className="tableHead" style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
            <div>{tCommon("labels.version")}</div>
            <div>{tDash("documentDetails.versions.uploaded")}</div>
            <div>{tCommon("labels.file")}</div>
            <div />
          </div>
          <div className="tableBody">
            {doc.versions.map((v) => (
              <div key={v.id} className="tableRow" style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
                <div>v{v.version}</div>
                <div>{new Date(v.created_at).toLocaleString()}</div>
                <div className="muted">{v.original_name}</div>
                <div style={{ textAlign: "right" }}>
                  <button className="btn btnGhost" onClick={() => handleDownload(v.version)} disabled={downloadingVersion === v.version}>
                    {downloadingVersion === v.version ? tCommon("actions.downloading") : tCommon("actions.download")}
                  </button>
                </div>
              </div>
            ))}
            {doc.versions.length === 0 && <div className="muted">{tDash("documentDetails.versions.none")}</div>}
          </div>
        </div>
      </div>

      {manageAllowed && (
        <div className="card dangerZone">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tDash("documentDetails.danger.eyebrow")}</div>
              <div className="h2">{tDash("documentDetails.danger.title")}</div>
              <div className="muted">{tDash("documentDetails.danger.subtitle")}</div>
            </div>
            <button className="btn btnDangerGhost" onClick={handleDelete} disabled={saving}>
              {saving && confirmDelete ? tDash("documentDetails.actions.deleting") : tCommon("actions.delete")}
            </button>
          </div>
          {confirmDelete && <div className="muted">{tDash("documentDetails.danger.confirming")}</div>}
        </div>
      )}
    </div>
  );
}
