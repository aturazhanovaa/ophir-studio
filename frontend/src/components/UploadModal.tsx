import React, { useState } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";

export default function UploadModal({
  areaId,
  onClose,
  onUploaded,
}: {
  areaId: number;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { t: tCommon } = useTranslation("common");
  const { t: tDash } = useTranslation("dashboard");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    if (!title.trim()) return setErr(tCommon("validation.required.title"));
    if (!file) return setErr(tCommon("validation.required.file"));
    setBusy(true);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api.uploadDocument(areaId, title.trim(), file, tagList);
      onUploaded();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modalOverlay">
      <div className="card modalCard">
        <div className="cardHeader">
          <div>
            <div className="h2">{tDash("documents.uploadModal.title")}</div>
            <div className="muted">{tDash("documents.uploadModal.subtitle")}</div>
          </div>
          <button className="btn btnGhost" onClick={onClose}>{tCommon("actions.close")}</button>
        </div>

        <label className="fieldLabel">{tCommon("labels.title")}</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tDash("documents.uploadModal.titlePlaceholder")} />
        <div className="spacer-sm" />
        <label className="fieldLabel">{tDash("documents.uploadModal.tags")}</label>
        <input
          className="input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={tDash("documents.uploadModal.tagsPlaceholder")}
        />
        <div className="spacer-sm" />
        <label className="fieldLabel">{tCommon("labels.file")}</label>
        <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

        {err && <div className="formError">{err}</div>}

        <div className="modalActions">
          <button className="btn" onClick={onClose}>{tCommon("actions.cancel")}</button>
          <button className="btn btnPrimary" disabled={busy} onClick={onSubmit}>
            {busy ? tCommon("actions.uploading") : tCommon("actions.upload")}
          </button>
        </div>
      </div>
    </div>
  );
}
