import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import CopilotChat from "./CopilotChat";
import { api } from "../api/client";
import { useAskPreferences } from "../utils/preferences";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
export default function AskAIDrawer({ open, onClose, areas, selectedAreaId, onSelectArea, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [areaId, setAreaId] = useState(selectedAreaId);
    const { user } = useAuth();
    const prefs = useAskPreferences(user?.id);
    useEffect(() => {
        setAreaId(selectedAreaId);
    }, [selectedAreaId, open]);
    const activeArea = useMemo(() => areas.find((a) => a.id === areaId) ?? null, [areas, areaId]);
    const ask = async (_, question, options) => {
        if (!areaId)
            throw new Error(tDash("askAiDrawer.errors.selectAreaFirst"));
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
    if (!open)
        return null;
    return (_jsx("div", { className: "modalOverlay", onClick: (e) => e.target === e.currentTarget && onClose(), children: _jsxs("div", { className: "card modalCard", style: { width: "min(720px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }, children: [_jsxs("div", { className: "cardHeader", style: { justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("pageTitles.askAi") }), _jsx("div", { className: "h2", children: tDash("askAiDrawer.title") }), _jsx("div", { className: "muted", children: tDash("askAiDrawer.subtitle") })] }), _jsx("button", { className: "btn", onClick: onClose, children: tCommon("actions.close") })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto", paddingBottom: 8 }, children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.area") }), _jsxs("select", { className: "input select", value: areaId ?? "", onChange: (e) => {
                                        const next = Number(e.target.value) || null;
                                        setAreaId(next);
                                        onSelectArea(next);
                                    }, children: [_jsx("option", { value: "", children: tDash("askAiDrawer.chooseArea") }), areas.map((a) => (_jsx("option", { value: a.id, children: a.name }, a.id)))] })] }), activeArea ? (_jsx(CopilotChat, { area: activeArea.name, ask: ask })) : (_jsxs("div", { className: "emptyState", style: { marginTop: 12 }, children: [_jsx("div", { className: "emptyTitle", children: tDash("askAiDrawer.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("askAiDrawer.empty.text") })] }))] })] }) }));
}
