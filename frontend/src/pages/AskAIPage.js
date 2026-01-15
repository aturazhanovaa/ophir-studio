import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useAskPreferences } from "../utils/preferences";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
function relativeTime(dateStr) {
    if (!dateStr)
        return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime()))
        return "";
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1)
        return i18n.t("dashboard:askAi.time.justNow");
    if (minutes < 60)
        return i18n.t("dashboard:askAi.time.minutesAgo", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24)
        return i18n.t("dashboard:askAi.time.hoursAgo", { count: hours });
    const days = Math.round(hours / 24);
    return i18n.t("dashboard:askAi.time.daysAgo", { count: days });
}
function renderHighlights(text, highlights = []) {
    if (!highlights.length)
        return _jsx(_Fragment, { children: text });
    const sorted = [...highlights]
        .map((h) => ({ start: Math.max(0, h.start), end: Math.min(text.length, h.end) }))
        .sort((a, b) => a.start - b.start)
        .slice(0, 6);
    const parts = [];
    let cursor = 0;
    sorted.forEach((h, idx) => {
        if (h.start > cursor)
            parts.push(_jsx("span", { children: text.slice(cursor, h.start) }, `t-${idx}-${cursor}`));
        parts.push(_jsx("mark", { className: "highlight", children: text.slice(h.start, h.end) }, `h-${idx}`));
        cursor = h.end;
    });
    if (cursor < text.length)
        parts.push(_jsx("span", { children: text.slice(cursor) }, "tail"));
    return _jsx(_Fragment, { children: parts });
}
const SAMPLE_PROMPT_KEYS = ["prompt1", "prompt2", "prompt3"];
export default function AskAIPage({ areas, selectedAreaId, onSelectArea, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const { user } = useAuth();
    const { accuracy, tone, setAccuracy, setTone } = useAskPreferences(user?.id);
    const [conversations, setConversations] = useState([]);
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [search, setSearch] = useState("");
    const [areaScope, setAreaScope] = useState(selectedAreaId);
    const [loadingList, setLoadingList] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    const [titleDraft, setTitleDraft] = useState(() => tDash("askAi.newChat"));
    const [input, setInput] = useState("");
    const [openSourcesId, setOpenSourcesId] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [showSettings, setShowSettings] = useState(true);
    const [accuracyTarget, setAccuracyTarget] = useState(accuracy === "HIGH" ? 92 : accuracy === "LOW" ? 75 : 85);
    const listRef = useRef(null);
    const bottomRef = useRef(null);
    const areaMap = useMemo(() => {
        const map = {};
        areas.forEach((a) => (map[a.id] = a));
        return map;
    }, [areas]);
    useEffect(() => {
        setAreaScope(selectedAreaId);
    }, [selectedAreaId]);
    const filtered = useMemo(() => {
        if (!search.trim())
            return conversations;
        const q = search.toLowerCase();
        return conversations.filter((c) => (c.title || tDash("askAi.newChat")).toLowerCase().includes(q));
    }, [conversations, search, tDash]);
    const samplePrompts = useMemo(() => SAMPLE_PROMPT_KEYS.map((k) => tDash(`askAi.samplePrompts.${k}`)), [tDash]);
    useEffect(() => {
        const handler = (e) => {
            if (!e.target.closest(".menuWrapper"))
                setOpenMenuId(null);
        };
        window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, []);
    const scrollToBottom = () => {
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    };
    const updateConversationSummary = (detail) => {
        const preview = detail.last_message_preview || detail.messages?.[detail.messages.length - 1]?.content || "";
        setConversations((prev) => {
            const base = {
                id: detail.id,
                title: detail.title,
                area_id: detail.area_id,
                created_by_user_id: detail.created_by_user_id,
                created_at: detail.created_at,
                updated_at: detail.updated_at,
                last_message_preview: preview,
            };
            const others = prev.filter((c) => c.id !== detail.id);
            const next = [base, ...others];
            next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            return next;
        });
    };
    const loadConversation = async (conversationId) => {
        setLoadingMessages(true);
        setError(null);
        try {
            const detail = (await api.getConversation(conversationId));
            setSelectedConversationId(detail.id);
            setMessages(detail.messages || []);
            setTitleDraft(detail.title || tDash("askAi.newChat"));
            setOpenSourcesId(null);
            updateConversationSummary(detail);
            scrollToBottom();
        }
        catch (e) {
            setError(e?.message || tDash("askAi.errors.unableToLoadConversation"));
            setMessages([]);
        }
        finally {
            setLoadingMessages(false);
        }
    };
    const loadConversations = async () => {
        setLoadingList(true);
        setError(null);
        try {
            const res = (await api.listConversations());
            const sorted = [...res].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            setConversations(sorted);
            const stillSelected = sorted.find((c) => c.id === selectedConversationId);
            const nextId = stillSelected?.id ?? sorted[0]?.id ?? null;
            if (nextId)
                await loadConversation(nextId);
        }
        catch (e) {
            setError(e?.message || tDash("askAi.errors.unableToLoadConversations"));
            setConversations([]);
            setMessages([]);
        }
        finally {
            setLoadingList(false);
        }
    };
    useEffect(() => {
        loadConversations();
    }, []);
    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    const handleCreateConversation = async () => {
        setCreating(true);
        setError(null);
        try {
            const detail = (await api.createConversation(areaScope ?? undefined));
            updateConversationSummary(detail);
            setSelectedConversationId(detail.id);
            setMessages(detail.messages || []);
            setTitleDraft(detail.title || tDash("askAi.newChat"));
            return detail;
        }
        catch (e) {
            setError(e?.message || tDash("askAi.errors.unableToCreateChat"));
            return null;
        }
        finally {
            setCreating(false);
        }
    };
    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || sending)
            return;
        setError(null);
        setSending(true);
        setOpenSourcesId(null);
        let conversationId = selectedConversationId;
        if (!conversationId) {
            const created = await handleCreateConversation();
            conversationId = created?.id || null;
        }
        if (!conversationId) {
            setSending(false);
            return;
        }
        const optimistic = {
            id: `temp-${Date.now()}`,
            conversation_id: conversationId,
            role: "user",
            content: trimmed,
            created_at: new Date().toISOString(),
        };
        optimistic.meta = { tone, accuracy_level: accuracy };
        setMessages((prev) => [...prev, optimistic]);
        setInput("");
        scrollToBottom();
        try {
            const effectiveAccuracy = accuracyTarget >= 90 ? "HIGH" : accuracyTarget <= 75 ? "LOW" : "MEDIUM";
            setAccuracy(effectiveAccuracy);
            const res = await api.copilotAsk(trimmed, areaScope ?? null, {
                accuracy_level: effectiveAccuracy,
                answer_tone: tone,
                conversation_id: conversationId,
            });
            const nextConversationId = res.conversation_id || conversationId;
            if (nextConversationId && nextConversationId !== selectedConversationId) {
                setSelectedConversationId(nextConversationId);
            }
            await loadConversation(nextConversationId || conversationId);
        }
        catch (e) {
            setError(e?.message || tDash("askAi.errors.requestFailed"));
            setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        }
        finally {
            setSending(false);
        }
    };
    const handleDelete = async (conversationId) => {
        try {
            await api.deleteConversation(conversationId);
            setConversations((prev) => prev.filter((c) => c.id !== conversationId));
            if (selectedConversationId === conversationId) {
                setSelectedConversationId(null);
                setMessages([]);
            }
        }
        catch (e) {
            setError(e?.message || tDash("askAi.errors.unableToDeleteConversation"));
        }
    };
    const saveTitle = async () => {
        if (!selectedConversationId)
            return;
        const next = titleDraft.trim() || tDash("askAi.newChat");
        try {
            const detail = (await api.updateConversation(selectedConversationId, { title: next }));
            setTitleDraft(detail.title || tDash("askAi.newChat"));
            updateConversationSummary(detail);
        }
        catch (e) {
            setError(e?.message || tDash("askAi.errors.unableToRenameConversation"));
        }
    };
    const onComposerKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    const renderMessage = (msg) => {
        const rawMeta = msg.meta || msg.metadata || {};
        const nestedMeta = rawMeta.meta || rawMeta;
        const meta = nestedMeta;
        const sources = nestedMeta?.sources ||
            rawMeta?.sources ||
            rawMeta?.metadata?.sources ||
            [];
        const isAssistant = msg.role === "assistant";
        const showSources = openSourcesId === msg.id;
        const confidence = meta?.confidence_percent;
        const accuracyPercent = meta?.accuracy_percent ?? rawMeta?.accuracy_percent;
        const areaChips = meta?.areas ||
            Array.from(new Map(sources
                .filter((s) => s.area_id !== undefined && s.area_id !== null)
                .map((s) => [s.area_id, { id: s.area_id, name: s.area_name, color: s.area_color }])).values());
        return (_jsxs("div", { className: `chatBubble ${isAssistant ? "assistant" : "user"}`, children: [_jsxs("div", { className: "bubbleHeader", children: [_jsx("span", { className: "chatRole", children: isAssistant ? tDash("copilot.chat.roles.assistant") : tDash("copilot.chat.roles.you") }), _jsxs("div", { className: "bubbleMeta", children: [typeof confidence === "number" && (_jsx("span", { className: "pill subtle", children: tDash("askAi.meta.confidence", { confidence }) })), typeof accuracyPercent === "number" && (_jsx("span", { className: "pill subtle", children: tDash("askAi.meta.accuracy", { accuracy: accuracyPercent }) })), _jsx("span", { className: "muted small", children: relativeTime(msg.created_at) })] })] }), isAssistant && areaChips?.length ? (_jsx("div", { className: "areaChipRow", children: areaChips.map((area) => (_jsxs("span", { className: "pill subtle", style: { borderColor: area.color || "#d1d5db" }, children: [_jsx("span", { className: "areaDot", style: { background: area.color || "#9ca3af" } }), area.name || tCommon("labels.area")] }, area.id || area.name))) })) : null, _jsx("div", { className: "chatText", children: msg.content }), isAssistant && (_jsxs("div", { className: "bubbleActions", children: [_jsx("button", { className: "btn btnGhost", onClick: () => navigator.clipboard.writeText(msg.content), children: tCommon("actions.copy") }), _jsx("button", { className: "btn btnGhost", onClick: () => navigator.clipboard.writeText(`## Answer\n${msg.content}`), children: tDash("askAi.actions.exportMd") }), sources.length > 0 && (_jsx("button", { className: "btn btnGhost", onClick: () => setOpenSourcesId(showSources ? null : msg.id), children: showSources ? tDash("copilot.chat.hideSources") : tDash("askAi.actions.sourcesUsed") }))] })), isAssistant && showSources && sources.length > 0 && (_jsxs("div", { className: "sourcesPanel", children: [_jsx("div", { className: "sourcesTitle", children: tDash("askAi.actions.sourcesUsed") }), sources.slice(0, 6).map((s, idx) => (_jsxs("div", { className: "sourceCard", children: [_jsxs("div", { className: "sourceHeading", children: [_jsx("div", { className: "muted", children: s.document_title ?? tDash("askAi.sources.document", { id: s.document_id }) }), _jsx("div", { className: "pill subtle", children: tDash("copilot.chat.chunk", { index: s.chunk_index ?? 0 }) }), (s.area_name || s.area_id) && (_jsxs("div", { className: "pill subtle", style: { borderColor: s.area_color || "#d1d5db" }, children: [_jsx("span", { className: "areaDot", style: { background: s.area_color || "#9ca3af" } }), s.area_name || tDash("askAi.sources.area", { id: s.area_id })] })), s.heading_path && _jsx("div", { className: "muted", style: { fontSize: 12 }, children: s.heading_path })] }), _jsx("div", { className: "sourceText", children: renderHighlights(s.chunk_text, s.highlights) })] }, `${msg.id}-src-${idx}`)))] }))] }, msg.id));
    };
    const activeArea = areaScope ? areaMap[areaScope] : null;
    const scopeLabel = areaScope ? activeArea?.name || tCommon("labels.area") : tDash("askAi.scope.allAreas");
    const scopeColor = areaScope ? activeArea?.color || "#6b7280" : "#6b7280";
    const emptyState = (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("askAi.empty.startTitle") }), _jsx("div", { className: "emptyText", children: tDash("askAi.empty.startText") }), _jsx("div", { className: "tagRow", style: { marginTop: 6, gap: 6 }, children: samplePrompts.map((p) => (_jsx("button", { className: "btn btnGhost", onClick: () => setInput(p), children: p }, p))) }), _jsx("button", { className: "btn btnPrimary", style: { marginTop: 10 }, onClick: handleCreateConversation, disabled: !selectedAreaId, children: tDash("askAi.newChat") })] }));
    const settingsPanel = (_jsxs("div", { className: `settingsPanel ${showSettings ? "open" : "closed"}`, children: [_jsxs("div", { className: "settingsHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("askAi.settings.eyebrow") }), _jsx("div", { className: "h3", children: tDash("askAi.settings.title") })] }), _jsx("button", { className: "btn btnGhost", onClick: () => setShowSettings((s) => !s), children: showSettings ? tCommon("actions.close") : tCommon("actions.open") })] }), _jsxs("div", { className: "settingsSection", children: [_jsx("div", { className: "muted small", style: { marginBottom: 6 }, children: tDash("askAi.settings.toneHelp") }), _jsx("div", { className: "toneGrid", children: [
                            { key: "EXECUTIVE", label: tDash("analytics.tone.executive"), desc: tDash("askAi.settings.tones.executiveDesc") },
                            { key: "TECHNICAL", label: tDash("analytics.tone.technical"), desc: tDash("askAi.settings.tones.technicalDesc") },
                            { key: "COLLOQUIAL", label: tDash("analytics.tone.colloquial"), desc: tDash("askAi.settings.tones.colloquialDesc") },
                        ].map((t) => (_jsxs("button", { className: `toneCard ${tone === t.key ? "active" : ""}`, onClick: () => setTone(t.key), children: [_jsx("div", { className: "toneLabel", children: t.label }), _jsx("div", { className: "muted small", children: t.desc })] }, t.key))) })] }), _jsxs("div", { className: "settingsSection", children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsxs("div", { children: [_jsx("div", { className: "h3", style: { marginBottom: 4 }, children: tDash("askAi.settings.accuracyTarget") }), _jsx("div", { className: "muted small", children: tDash("askAi.settings.accuracyHelp") })] }), _jsxs("span", { className: "pill subtle", children: [accuracyTarget, "%"] })] }), _jsx("input", { type: "range", min: 70, max: 95, step: 1, value: accuracyTarget, onChange: (e) => setAccuracyTarget(Number(e.target.value)), className: "slider" }), _jsx("div", { className: "muted small", children: accuracyTarget >= 90
                            ? tDash("askAi.settings.accuracyMode.high")
                            : accuracyTarget <= 75
                                ? tDash("askAi.settings.accuracyMode.fast")
                                : tDash("askAi.settings.accuracyMode.balanced") })] }), _jsx("div", { className: "muted small", children: tDash("askAi.settings.appliesToNewMessages") })] }));
    const accentColor = activeArea?.color || "#e5e7eb";
    const chatHeader = (_jsxs("div", { className: "chatHeader", style: { borderLeft: `4px solid ${accentColor}` }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("input", { className: "input", value: titleDraft, onChange: (e) => setTitleDraft(e.target.value), onBlur: saveTitle, onKeyDown: (e) => e.key === "Enter" && saveTitle(), placeholder: tDash("askAi.conversationTitlePlaceholder") }), _jsxs("div", { className: "row", style: { gap: 6, alignItems: "center", marginTop: 4 }, children: [_jsxs("span", { className: "pill subtle", style: { borderColor: scopeColor }, children: [_jsx("span", { className: "areaDot", style: { background: scopeColor } }), scopeLabel] }), _jsx("span", { className: "muted small", children: tDash("askAi.scopedToSelection") })] })] }), _jsx("button", { className: "btn", onClick: () => setShowSettings((s) => !s), children: tDash("askAi.settings.button") })] }));
    return (_jsxs("div", { className: "askWorkspace", children: [_jsxs("div", { className: "askScopeBar", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("askAi.scope.eyebrow") }), _jsx("div", { className: "muted small", children: tDash("askAi.scope.subtitle") })] }), _jsxs("select", { className: "input select", value: areaScope ?? "", onChange: (e) => {
                            const val = e.target.value;
                            const next = val === "" ? null : Number(val);
                            setAreaScope(next);
                            onSelectArea(next);
                        }, children: [_jsx("option", { value: "", children: tDash("askAi.scope.allAreas") }), areas.map((a) => (_jsx("option", { value: a.id, children: a.name }, a.id)))] })] }), _jsxs("div", { className: "historyPanel", children: [_jsxs("div", { className: "historyHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("pageTitles.askAi") }), _jsx("div", { className: "h2", children: tDash("askAi.history.title") })] }), _jsx("button", { className: "btn btnPrimary", onClick: handleCreateConversation, disabled: creating, children: creating ? tDash("askAi.history.creating") : tDash("askAi.newChat") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tDash("askAi.history.searchLabel") }), _jsx("input", { className: "input", placeholder: tDash("askAi.history.searchPlaceholder"), value: search, onChange: (e) => setSearch(e.target.value) })] }), _jsx("div", { className: "conversationList calm", ref: listRef, children: loadingList ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "skeletonLine", style: { height: 48 } }), _jsx("div", { className: "skeletonLine", style: { height: 48 } })] })) : filtered.length ? (filtered.map((c) => (_jsxs("div", { className: `conversationRow ${c.id === selectedConversationId ? "active" : ""}`, onClick: () => loadConversation(c.id), children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between", gap: 6, alignItems: "center" }, children: [_jsxs("div", { className: "conversationTitle clamp", children: [c.area_id && areaMap[c.area_id] && (_jsx("span", { className: "areaDot", style: {
                                                        width: 8,
                                                        height: 8,
                                                        background: areaMap[c.area_id].color || "#9ca3af",
                                                        borderRadius: "50%",
                                                        display: "inline-block",
                                                    } })), _jsx("span", { className: "titleText", children: c.title || tDash("askAi.newChat") })] }), _jsxs("div", { className: "menuWrapper convoMenu", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { className: "btn btnGhost iconButton", onClick: () => setOpenMenuId((id) => (id === c.id ? null : c.id)), children: "\u22EF" }), openMenuId === c.id && (_jsx("div", { className: "menu", style: { right: 0 }, children: _jsx("button", { className: "menuItem danger", onClick: () => handleDelete(c.id), children: tCommon("actions.delete") }) }))] })] }), _jsx("div", { className: "muted small", children: relativeTime(c.updated_at) })] }, c.id)))) : (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("askAi.history.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("askAi.history.empty.text") })] })) })] }), _jsxs("div", { className: "chatColumn", children: [chatHeader, _jsxs("div", { className: "messageWindow calm", children: [error && _jsx("div", { className: "errorBanner", children: error }), loadingMessages ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "chatBubble assistant", children: [_jsx("div", { className: "chatRole", children: tDash("copilot.chat.roles.assistant") }), _jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine short" })] }), _jsxs("div", { className: "chatBubble user", children: [_jsx("div", { className: "chatRole", children: tDash("copilot.chat.roles.you") }), _jsx("div", { className: "skeletonLine" })] })] })) : messages.length ? (messages.map((m) => renderMessage(m))) : (emptyState), _jsx("div", { ref: bottomRef })] }), _jsxs("div", { className: "composer", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.message") }), _jsx("textarea", { className: "input", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: onComposerKeyDown, placeholder: tDash("askAi.composer.placeholder") }), _jsxs("div", { className: "row", style: { justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }, children: [error ? _jsx("span", { className: "formError", children: error }) : _jsx("span", { className: "muted small", children: tDash("askAi.composer.scopedHint") }), _jsx("button", { className: "btn btnPrimary", onClick: handleSend, disabled: sending || !input.trim(), children: sending ? tDash("askAi.composer.sending") : tDash("askAi.composer.send") })] })] })] }), settingsPanel] }));
}
