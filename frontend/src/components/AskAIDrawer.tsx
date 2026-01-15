import React, { useEffect, useMemo, useState } from "react";
import CopilotChat from "./CopilotChat";
import { Area } from "./Sidebar";
import { api, AccuracyLevel, AnswerTone } from "../api/client";
import { useAskPreferences } from "../utils/preferences";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";

export default function AskAIDrawer({
  open,
  onClose,
  areas,
  selectedAreaId,
  onSelectArea,
}: {
  open: boolean;
  onClose: () => void;
  areas: Area[];
  selectedAreaId: number | null;
  onSelectArea: (id: number | null) => void;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [areaId, setAreaId] = useState<number | null>(selectedAreaId);
  const { user } = useAuth();
  const prefs = useAskPreferences(user?.id);

  useEffect(() => {
    setAreaId(selectedAreaId);
  }, [selectedAreaId, open]);

  const activeArea = useMemo(() => areas.find((a) => a.id === areaId) ?? null, [areas, areaId]);

  const ask = async (_: string, question: string, options: { accuracy: AccuracyLevel; tone: AnswerTone }) => {
    if (!areaId) throw new Error(tDash("askAiDrawer.errors.selectAreaFirst"));
    const res = await api.copilotAsk(question, areaId, {
      top_k: 6,
      accuracy_level: options.accuracy ?? prefs.accuracy,
      answer_tone: options.tone ?? prefs.tone,
    });
    return {
      answer: res.answer ?? "",
      matches: res.matches ?? res.sources ?? [],
      meta: res.meta ?? null,
    };
  };

  if (!open) return null;

  return (
    <div className="modalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="card modalCard"
        style={{ width: "min(720px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="cardHeader" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow">{tDash("pageTitles.askAi")}</div>
            <div className="h2">{tDash("askAiDrawer.title")}</div>
            <div className="muted">{tDash("askAiDrawer.subtitle")}</div>
          </div>
          <button className="btn" onClick={onClose}>{tCommon("actions.close")}</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto", paddingBottom: 8 }}>
          <div className="formGroup">
            <label className="fieldLabel">{tCommon("labels.area")}</label>
            <select
              className="input select"
              value={areaId ?? ""}
              onChange={(e) => {
                const next = Number(e.target.value) || null;
                setAreaId(next);
                onSelectArea(next);
              }}
            >
              <option value="">{tDash("askAiDrawer.chooseArea")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {activeArea ? (
            <CopilotChat area={activeArea.name} ask={ask} />
          ) : (
            <div className="emptyState" style={{ marginTop: 12 }}>
              <div className="emptyTitle">{tDash("askAiDrawer.empty.title")}</div>
              <div className="emptyText">{tDash("askAiDrawer.empty.text")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
