import React from "react";

export type ToastMessage = {
  id: number;
  message: string;
  tone?: "success" | "danger" | "info";
};

export default function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  return <div className={`toast ${toast.tone ?? "info"}`}>{toast.message}</div>;
}
