import React, { useEffect, useState } from "react";
import { DocumentDetail } from "../api/client";
import { useTranslation } from "react-i18next";

export default function EditDocumentModal({
  doc,
  onClose,
  onSave,
}: {
  doc: DocumentDetail;
  onClose: () => void;
  onSave: (payload: { title: string; tags: string[] }) => Promise<void>;
}) {
  const { t: tCommon } = useTranslation("common");
  const { t: tDash } = useTranslation("dashboard");
  const [title, setTitle] = useState(doc.title);
  const [tags, setTags] = useState<string>(doc.tags.join(", "));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(doc.title);
    setTags(doc.tags.join(", "));
  }, [doc]);

  const onSubmit = async () => {
    setErr(null);
    if (!title.trim()) return setErr(tCommon("validation.required.title"));
    setBusy(true);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await onSave({ title: title.trim(), tags: tagList });
      onClose();
    } catch (e: any) {
      setErr(e.message || tDash("documentDetails.errors.failedToSave"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modalOverlay">
      <div className="card modalCard">
        <div className="cardHeader">
          <div>
            <div className="h2">{tDash("documents.editModal.title")}</div>
            <div className="muted">{doc.original_name}</div>
          </div>
          <button className="btn btnGhost" onClick={onClose}>{tCommon("actions.close")}</button>
        </div>

        <label className="fieldLabel">{tCommon("labels.title")}</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="spacer-sm" />
        <label className="fieldLabel">{tDash("documents.editModal.tags")}</label>
        <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />

        {err && <div className="formError">{err}</div>}

        <div className="modalActions">
          <button className="btn" onClick={onClose}>{tCommon("actions.cancel")}</button>
          <button className="btn btnPrimary" disabled={busy} onClick={onSubmit}>
            {busy ? tCommon("actions.saving") : tCommon("actions.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
