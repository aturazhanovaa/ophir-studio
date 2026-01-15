import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

type DrawerProps = {
  open: boolean;
  title?: string;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function Drawer({ open, onClose, children, title, footer, width = 460 }: DrawerProps) {
  const { t: tCommon } = useTranslation("common");
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawerOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawerPanel" style={{ width }}>
        <div className="drawerHeader">
          <div>
            {title && <div className="h3" style={{ margin: 0 }}>{title}</div>}
          </div>
          <button className="btn btnGhost" onClick={onClose}>{tCommon("actions.close")}</button>
        </div>
        <div className="drawerBody">{children}</div>
        {footer && <div className="drawerFooter">{footer}</div>}
      </div>
    </div>
  );
}
