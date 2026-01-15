import React, { useState } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";

export default function VersionUploadModal({
  docId,
  title,
  onClose,
  onUploaded,
}: {
  docId: number;
  title: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { t: tCommon } = useTranslation("common");
  const { t: tDash } = useTranslation("dashboard");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    if (!file) return setErr(tCommon("validation.required.file"));
    setBusy(true);
    try {
      await api.uploadVersion(docId, file);
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
            <div className="h2">{tDash("documentDetails.versioning.title")}</div>
            <div className="muted">{title}</div>
          </div>
          <button className="btn btnGhost" onClick={onClose}>{tCommon("actions.close")}</button>
        </div>

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
