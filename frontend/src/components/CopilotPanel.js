import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CopilotChat from "./CopilotChat";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
export default function CopilotPanel({ areaId, areaKey, }) {
    const { t: tDash } = useTranslation("dashboard");
    if (!areaId || !areaKey) {
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("copilot.empty.chooseWorkspaceTitle") }), _jsx("div", { className: "emptyText", children: tDash("copilot.empty.chooseWorkspaceText") })] }) }));
    }
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("copilot.eyebrow") }), _jsx("div", { className: "h2", children: tDash("copilot.title", { area: areaKey }) }), _jsx("div", { className: "muted", children: tDash("copilot.subtitle") })] }) }), _jsx(CopilotChat, { area: areaKey, ask: async (_area, question, options) => {
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
                } })] }));
}
