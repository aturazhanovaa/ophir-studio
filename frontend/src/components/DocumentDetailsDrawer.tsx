import React, { useEffect, useMemo, useState } from "react";
import { Area } from "./Sidebar";
import Drawer from "./Drawer";
import AreaBadge from "./AreaBadge";
import { DocumentDetail, api } from "../api/client";
import { useTranslation } from "react-i18next";

type DetailIntent = "view" | "rename" | "version";

export default function DocumentDetailsDrawer({
  open,
  docId,
  areas,
  canManage,
  onClose,
  onUpdated,
  onDeleted,
  onAreaSync,
  intent = "view",
}: {
  open: boolean;
  docId: number | null;
  areas: Area[];
  canManage: (areaId?: number | null) => boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onAreaSync?: (id: number) => void;
  intent?: DetailIntent;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState<number | null>(null);

  const area = useMemo(() => {
    if (!doc) return null;
    return areas.find((a) => a.id === doc.area_id) ?? null;
  }, [areas, doc]);

  useEffect(() => {
    if (!open) {
      setDoc(null);
      setError(null);
      setMessage(null);
      setUploadFile(null);
      setConfirmDelete(false);
      return;
    }
    const loadDoc = async () => {
      if (!docId) return;
      setLoading(true);
      setError(null);
      try {
        const detail = (await api.getDocument(docId)) as DocumentDetail;
        setDoc(detail);
        setTitle(detail.title);
        setTags(detail.tags?.join(", ") || "");
        if (detail.area_id && onAreaSync) onAreaSync(detail.area_id);
      } catch (e: any) {
        setError(e.message || tDash("documentDetails.errors.unableToLoad"));
        setDoc(null);
      } finally {
        setLoading(false);
      }
    };
    loadDoc();
  }, [docId, open, onAreaSync]);

  const manageAllowed = canManage(doc?.area_id);

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
      await reloadDoc();
      onUpdated();
    } catch (e: any) {
      setError(e.message || tDash("documentDetails.errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const reloadDoc = async () => {
    if (!docId) return;
    try {
      const detail = (await api.getDocument(docId)) as DocumentDetail;
      setDoc(detail);
      setTitle(detail.title);
      setTags(detail.tags?.join(", ") || "");
    } catch (e: any) {
      setError(e.message || tDash("documentDetails.errors.unableToLoad"));
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
      await reloadDoc();
      onUpdated();
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
      onDeleted();
      onClose();
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

  const latestUploaded = doc?.versions[0]?.created_at || doc?.created_at;

  return (
    <Drawer open={open} onClose={onClose} title={tDash("documents.drawer.title")} width={520}>
      {loading && (
        <div className="stack">
          <div className="skeletonLine" style={{ width: "60%" }} />
          <div className="skeletonLine" />
          <div className="skeletonLine short" />
        </div>
      )}

      {!loading && !doc && (
        <div className="emptyState">
          <div className="emptyTitle">{tDash("documentDetails.empty.notFoundTitle")}</div>
          <div className="emptyText">{tDash("documents.drawer.notFoundText")}</div>
        </div>
      )}

      {!loading && doc && (
        <div className="drawerContent">
          <div className="stack">
            <div className="eyebrow">{tDash("documentDetails.eyebrow")}</div>
            <div className="h2">{doc.title}</div>
            <div className="muted">v{doc.latest_version} · {doc.mime_type || tDash("documentDetails.fileFallback")}</div>
          </div>

          <div className="metaGrid">
            <div>
              <div className="muted">{tCommon("labels.area")}</div>
              <div>{area ? <AreaBadge name={area.name} color={area.color} size="sm" /> : "—"}</div>
            </div>
            <div>
              <div className="muted">{tDash("documents.drawer.fileName")}</div>
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

          <div className="tagRow">
            {doc.tags && doc.tags.length ? (
              doc.tags.map((t) => <span key={t} className="pill">{t}</span>)
            ) : (
              <span className="muted">{tCommon("empty.noTags")}</span>
            )}
          </div>

          <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => handleDownload()}>
                {downloadingVersion === doc.latest_version ? tCommon("actions.downloading") : tCommon("actions.download")}
              </button>
              <button className="btn" onClick={() => onUpdated()}>
                {tDash("documents.drawer.refreshList")}
              </button>
            </div>
            {manageAllowed && (
              <button className="btn btnDangerGhost" onClick={handleDelete} disabled={saving}>
                {saving && confirmDelete ? tDash("documentDetails.actions.deleting") : tCommon("actions.delete")}
              </button>
            )}
          </div>

          {manageAllowed && (
            <div className="drawerSection" id="rename">
              <div className="sectionHeader">
                <div>
                  <div className="h3">{tDash("documents.drawer.metadata.title")}</div>
                  <div className="muted">{tDash("documents.drawer.metadata.subtitle")}</div>
                </div>
                {intent === "rename" && <span className="pill subtle">{tDash("documents.drawer.fromRowMenu")}</span>}
              </div>
              <div className="formGroup">
                <label className="fieldLabel">{tCommon("labels.title")}</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="formGroup">
                <label className="fieldLabel">{tCommon("labels.tagsCommaSeparated")}</label>
                <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <button className="btn btnPrimary" onClick={handleUpdate} disabled={saving}>
                {saving ? tCommon("actions.saving") : tCommon("actions.saveChanges")}
              </button>
            </div>
          )}

          {manageAllowed && (
            <div className="drawerSection" id="versions">
              <div className="sectionHeader">
                <div>
                  <div className="h3">{tDash("documentDetails.versioning.title")}</div>
                  <div className="muted">{tDash("documents.drawer.versioning.subtitle")}</div>
                </div>
                {intent === "version" && <span className="pill subtle">{tDash("documents.drawer.fromRowMenu")}</span>}
              </div>
              <form className="row" onSubmit={handleUploadVersion} style={{ alignItems: "flex-end", gap: 8 }}>
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

          <div className="drawerSection">
            <div className="sectionHeader">
              <div>
                <div className="h3">{tDash("documentDetails.versions.eyebrow")}</div>
                <div className="muted">{tDash("documents.drawer.versions.subtitle")}</div>
              </div>
            </div>
            <div className="table tight">
              <div className="tableHead" style={{ gridTemplateColumns: "80px 1fr 1fr auto" }}>
                <div>{tCommon("labels.version")}</div>
                <div>{tDash("documentDetails.versions.uploaded")}</div>
                <div>{tCommon("labels.file")}</div>
                <div />
              </div>
              <div className="tableBody">
                {doc.versions.map((v) => (
                  <div key={v.id} className="tableRow" style={{ gridTemplateColumns: "80px 1fr 1fr auto" }}>
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

          {message && <div className="muted" style={{ marginTop: 8 }}>{message}</div>}
          {error && <div className="formError">{error}</div>}
        </div>
      )}
    </Drawer>
  );
}
