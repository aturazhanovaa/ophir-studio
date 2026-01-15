import React from "react";
import CopilotChat from "./CopilotChat";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";

export default function CopilotPanel({
  areaId,
  areaKey,
}: {
  areaId: number | null;
  areaKey: string | null;
}) {
  const { t: tDash } = useTranslation("dashboard");
  if (!areaId || !areaKey) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">{tDash("copilot.empty.chooseWorkspaceTitle")}</div>
          <div className="emptyText">{tDash("copilot.empty.chooseWorkspaceText")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("copilot.eyebrow")}</div>
          <div className="h2">{tDash("copilot.title", { area: areaKey })}</div>
          <div className="muted">{tDash("copilot.subtitle")}</div>
        </div>
      </div>
      <CopilotChat
        area={areaKey}
        ask={async (_area, question, options) => {
          const res = await api.copilotAsk(question, areaId, {
            top_k: 6,
            accuracy_level: options.accuracy,
            answer_tone: options.tone,
          });
          return {
            answer: res.answer ?? "",
            matches: res.matches ?? res.sources ?? [],
            meta: res.meta ?? null,
          };
        }}
      />
    </div>
  );
}
