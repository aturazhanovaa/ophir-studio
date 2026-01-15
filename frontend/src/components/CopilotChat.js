import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAskPreferences } from "../utils/preferences";
import { useTranslation } from "react-i18next";
function renderHighlights(text, highlights = []) {
    if (!highlights.length)
        return _jsx(_Fragment, { children: text });
    const sorted = [...highlights]
        .map((h) => ({ start: Math.max(0, h.start), end: Math.min(text.length, h.end) }))
        .sort((a, b) => a.start - b.start)
        .slice(0, 5);
    const parts = [];
    let cursor = 0;
    sorted.forEach((h, idx) => {
        if (h.start > cursor) {
            parts.push(_jsx("span", { children: text.slice(cursor, h.start) }, `t-${idx}-${cursor}`));
        }
        parts.push(_jsx("mark", { className: "highlight", children: text.slice(h.start, h.end) }, `h-${idx}`));
        cursor = h.end;
    });
    if (cursor < text.length) {
        parts.push(_jsx("span", { children: text.slice(cursor) }, "tail"));
    }
    return _jsx(_Fragment, { children: parts });
}
export default function CopilotPanel({ area, ask }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const { user } = useAuth();
    const { accuracy, tone, setAccuracy, setTone } = useAskPreferences(user?.id);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const listRef = useRef(null);
    const settingsRef = useRef(null);
    const canSend = input.trim().length > 0 && !loading;
    const cleanedMessages = useMemo(() => messages, [messages]);
    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
        });
    };
    const onSend = async () => {
        const q = input.trim();
        if (!q || loading)
            return;
        setError(null);
        setLoading(true);
        const userMsg = { role: "user", content: q, createdAt: Date.now() };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        scrollToBottom();
        try {
            const res = await ask(area, q, { accuracy, tone });
            const assistantMsg = {
                role: "assistant",
                content: res.answer ?? "",
                matches: res.matches ?? [],
                meta: res.meta ?? null,
                createdAt: Date.now(),
                sourcesOpen: false,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            scrollToBottom();
        }
        catch (e) {
            setError(e?.message || tDash("copilot.chat.errors.requestFailed"));
        }
        finally {
            setLoading(false);
            scrollToBottom();
        }
    };
    const toggleSources = (idx) => {
        setMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, sourcesOpen: !m.sourcesOpen } : m)));
    };
    const onKeyDown = (e) => {
        if (e.key === "Enter")
            onSend();
    };
    const onClear = () => {
        setMessages([]);
        setError(null);
    };
    const copyLastAnswer = async () => {
        const last = [...cleanedMessages].reverse().find((m) => m.role === "assistant");
        if (!last)
            return;
        await navigator.clipboard.writeText(last.content);
    };
    const lastAssistant = [...cleanedMessages].reverse().find((m) => m.role === "assistant");
    useEffect(() => {
        const handler = (e) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target)) {
                setSettingsOpen(false);
            }
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, []);
    return (_jsxs("div", { className: "card copilotCard", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("copilot.eyebrow") }), _jsx("div", { className: "h2", children: tDash("copilot.chat.title") })] }), _jsxs("div", { className: "row", children: [_jsxs("div", { className: "menuWrapper", ref: settingsRef, children: [_jsx("button", { className: "btn btnGhost", onClick: () => setSettingsOpen((s) => !s), children: tDash("copilot.chat.answerSettings") }), settingsOpen && (_jsxs("div", { className: "menu settingsMenu", children: [_jsx("div", { className: "muted", style: { fontSize: 12 }, children: tDash("copilot.chat.accuracy") }), _jsxs("select", { className: "input select", value: accuracy, onChange: (e) => setAccuracy(e.target.value), children: [_jsx("option", { value: "HIGH", children: tDash("copilot.chat.accuracyOptions.high") }), _jsx("option", { value: "MEDIUM", children: tDash("copilot.chat.accuracyOptions.medium") }), _jsx("option", { value: "LOW", children: tDash("copilot.chat.accuracyOptions.low") })] }), _jsx("div", { className: "muted", style: { fontSize: 12, marginTop: 6 }, children: tDash("copilot.chat.tone") }), _jsxs("select", { className: "input select", value: tone, onChange: (e) => setTone(e.target.value), children: [_jsx("option", { value: "TECHNICAL", children: tDash("analytics.tone.technical") }), _jsx("option", { value: "EXECUTIVE", children: tDash("analytics.tone.executive") }), _jsx("option", { value: "COLLOQUIAL", children: tDash("analytics.tone.colloquial") })] })] }))] }), _jsx("button", { className: "btn", onClick: copyLastAnswer, disabled: !lastAssistant, children: tCommon("actions.copy") }), _jsx("button", { className: "btn", onClick: onClear, disabled: !messages.length, children: tCommon("actions.clear") })] })] }), _jsxs("div", { className: "chatList", ref: listRef, children: [cleanedMessages.length === 0 ? (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("copilot.chat.empty.title") }), _jsxs("div", { className: "emptyText", children: [tDash("copilot.chat.empty.examplePrefix"), " ", _jsx("span", { className: "kbd", children: tDash("copilot.chat.empty.example") })] })] })) : (cleanedMessages.map((m, idx) => (_jsxs("div", { className: `bubble ${m.role === "user" ? "bubbleUser" : "bubbleAssistant"}`, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }, children: [_jsx("div", { className: "chatRole", children: m.role === "user" ? tDash("copilot.chat.roles.you") : tDash("copilot.chat.roles.assistant") }), m.role === "assistant" && m.meta?.evidence_level === "low" && (_jsx("span", { className: "pill subtle", style: { background: "#fef3c7", color: "#92400e" }, children: tDash("copilot.chat.lowEvidence") }))] }), _jsx("div", { className: "chatText", children: m.content }), m.role === "assistant" && (m.matches?.length ?? 0) > 0 && (_jsx("div", { className: "sourcesToggle", children: _jsx("button", { className: "btn btnGhost", onClick: () => toggleSources(idx), children: m.sourcesOpen ? tDash("copilot.chat.hideSources") : tDash("copilot.chat.showSources") }) })), m.role === "assistant" && m.sourcesOpen && (m.matches?.length ?? 0) > 0 && (_jsxs("div", { className: "sourcesPanel", children: [_jsx("div", { className: "sourcesTitle", children: tDash("copilot.chat.sourcesTitle") }), (m.matches ?? []).slice(0, 5).map((c, i) => (_jsxs("div", { className: "sourceCard", children: [_jsxs("div", { className: "sourceHeading", children: [_jsx("div", { className: "muted", children: c.document_title ?? tDash("copilot.chat.documentFallback") }), _jsx("div", { className: "pill subtle", children: tDash("copilot.chat.chunk", { index: c.chunk_index ?? 0 }) }), c.heading_path && (_jsx("div", { className: "muted", style: { fontSize: 12 }, children: c.heading_path }))] }), _jsx("div", { className: "sourceText", children: renderHighlights(c.chunk_text, c.highlights) })] }, i)))] }))] }, idx)))), loading && (_jsxs("div", { className: "bubble bubbleAssistant", children: [_jsx("div", { className: "chatRole", children: tDash("copilot.chat.roles.assistant") }), _jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine short" })] })), error && _jsx("div", { className: "errorBanner", children: error })] }), _jsxs("div", { className: "chatInputBar", children: [_jsx("input", { className: "input", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: onKeyDown, placeholder: tDash("copilot.chat.inputPlaceholder") }), _jsx("button", { className: "btn btnPrimary", onClick: onSend, disabled: !canSend, children: tDash("copilot.chat.ask") })] })] }));
}
