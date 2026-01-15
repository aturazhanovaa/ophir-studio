import React from "react";
import { useTranslation } from "react-i18next";

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t: tCommon } = useTranslation("common");
  const finalConfirmLabel = confirmLabel ?? tCommon("actions.confirm");
  return (
    <div className="modalOverlay">
      <div className="card modalCard">
        <div className="cardHeader">
          <div className="h2">{title}</div>
          <button className="btn btnGhost" onClick={onClose}>{tCommon("actions.close")}</button>
        </div>
        <div className="muted">{message}</div>
        <div className="modalActions">
          <button className="btn" onClick={onClose}>{tCommon("actions.cancel")}</button>
          <button className="btn btnDanger" onClick={onConfirm}>{finalConfirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
