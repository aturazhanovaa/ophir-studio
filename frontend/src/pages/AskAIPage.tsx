import React, { useEffect, useMemo, useRef, useState } from "react";
import { Area } from "../components/Sidebar";
import {
  AccuracyLevel,
  AnswerTone,
  Conversation,
  ConversationDetail,
  ConversationMessage,
  CopilotMeta,
  CopilotSource,
  Highlight,
  api,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useAskPreferences } from "../utils/preferences";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

function relativeTime(dateStr?: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return i18n.t("dashboard:askAi.time.justNow");
  if (minutes < 60) return i18n.t("dashboard:askAi.time.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return i18n.t("dashboard:askAi.time.hoursAgo", { count: hours });
  const days = Math.round(hours / 24);
  return i18n.t("dashboard:askAi.time.daysAgo", { count: days });
}

function renderHighlights(text: string, highlights: Highlight[] = []) {
  if (!highlights.length) return <>{text}</>;
  const sorted = [...highlights]
    .map((h) => ({ start: Math.max(0, h.start), end: Math.min(text.length, h.end) }))
    .sort((a, b) => a.start - b.start)
    .slice(0, 6);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((h, idx) => {
    if (h.start > cursor) parts.push(<span key={`t-${idx}-${cursor}`}>{text.slice(cursor, h.start)}</span>);
    parts.push(
      <mark key={`h-${idx}`} className="highlight">
        {text.slice(h.start, h.end)}
      </mark>
    );
    cursor = h.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

const SAMPLE_PROMPT_KEYS = ["prompt1", "prompt2", "prompt3"] as const;

export default function AskAIPage({
  areas,
  selectedAreaId,
  onSelectArea,
}: {
  areas: Area[];
  selectedAreaId: number | null;
  onSelectArea: (id: number | null) => void;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { user } = useAuth();
  const { accuracy, tone, setAccuracy, setTone } = useAskPreferences(user?.id);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [search, setSearch] = useState("");
  const [areaScope, setAreaScope] = useState<number | null>(selectedAreaId);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState(() => tDash("askAi.newChat"));
  const [input, setInput] = useState("");
  const [openSourcesId, setOpenSourcesId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [accuracyTarget, setAccuracyTarget] = useState(accuracy === "HIGH" ? 92 : accuracy === "LOW" ? 75 : 85);

  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const areaMap = useMemo(() => {
    const map: Record<number, Area> = {};
    areas.forEach((a) => (map[a.id] = a));
    return map;
  }, [areas]);

  useEffect(() => {
    setAreaScope(selectedAreaId);
  }, [selectedAreaId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title || tDash("askAi.newChat")).toLowerCase().includes(q));
  }, [conversations, search, tDash]);

  const samplePrompts = useMemo(() => SAMPLE_PROMPT_KEYS.map((k) => tDash(`askAi.samplePrompts.${k}`)), [tDash]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".menuWrapper")) setOpenMenuId(null);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const updateConversationSummary = (detail: ConversationDetail) => {
    const preview = detail.last_message_preview || detail.messages?.[detail.messages.length - 1]?.content || "";
    setConversations((prev) => {
      const base: Conversation = {
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

  const loadConversation = async (conversationId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const detail = (await api.getConversation(conversationId)) as ConversationDetail;
      setSelectedConversationId(detail.id);
      setMessages(detail.messages || []);
      setTitleDraft(detail.title || tDash("askAi.newChat"));
      setOpenSourcesId(null);
      updateConversationSummary(detail);
      scrollToBottom();
    } catch (e: any) {
      setError(e?.message || tDash("askAi.errors.unableToLoadConversation"));
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadConversations = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = (await api.listConversations()) as Conversation[];
      const sorted = [...res].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setConversations(sorted);
      const stillSelected = sorted.find((c) => c.id === selectedConversationId);
      const nextId = stillSelected?.id ?? sorted[0]?.id ?? null;
      if (nextId) await loadConversation(nextId);
    } catch (e: any) {
      setError(e?.message || tDash("askAi.errors.unableToLoadConversations"));
      setConversations([]);
      setMessages([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCreateConversation = async (): Promise<ConversationDetail | null> => {
    setCreating(true);
    setError(null);
    try {
      const detail = (await api.createConversation(areaScope ?? undefined)) as ConversationDetail;
      updateConversationSummary(detail);
      setSelectedConversationId(detail.id);
      setMessages(detail.messages || []);
      setTitleDraft(detail.title || tDash("askAi.newChat"));
      return detail;
    } catch (e: any) {
      setError(e?.message || tDash("askAi.errors.unableToCreateChat"));
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
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

    const optimistic: ConversationMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    (optimistic as any).meta = { tone, accuracy_level: accuracy };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    scrollToBottom();

    try {
      const effectiveAccuracy: AccuracyLevel =
        accuracyTarget >= 90 ? "HIGH" : accuracyTarget <= 75 ? "LOW" : "MEDIUM";
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
    } catch (e: any) {
      setError(e?.message || tDash("askAi.errors.requestFailed"));
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (conversationId: string) => {
    try {
      await api.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setMessages([]);
      }
    } catch (e: any) {
      setError(e?.message || tDash("askAi.errors.unableToDeleteConversation"));
    }
  };

  const saveTitle = async () => {
    if (!selectedConversationId) return;
    const next = titleDraft.trim() || tDash("askAi.newChat");
    try {
      const detail = (await api.updateConversation(selectedConversationId, { title: next })) as ConversationDetail;
      setTitleDraft(detail.title || tDash("askAi.newChat"));
      updateConversationSummary(detail);
    } catch (e: any) {
      setError(e?.message || tDash("askAi.errors.unableToRenameConversation"));
    }
  };

  const onComposerKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (msg: ConversationMessage) => {
    const rawMeta = (msg as any).meta || (msg as any).metadata || {};
    const nestedMeta = (rawMeta as any).meta || rawMeta;
    const meta = nestedMeta as CopilotMeta;
    const sources: CopilotSource[] =
      (nestedMeta?.sources as CopilotSource[]) ||
      (rawMeta?.sources as CopilotSource[]) ||
      ((rawMeta as any)?.metadata?.sources as CopilotSource[]) ||
      [];
    const isAssistant = msg.role === "assistant";
    const showSources = openSourcesId === msg.id;
    const confidence = meta?.confidence_percent;
    const accuracyPercent = (meta as any)?.accuracy_percent ?? (rawMeta as any)?.accuracy_percent;
    const areaChips =
      (meta as any)?.areas ||
      Array.from(
        new Map(
          sources
            .filter((s) => s.area_id !== undefined && s.area_id !== null)
            .map((s) => [s.area_id, { id: s.area_id, name: s.area_name, color: s.area_color }])
        ).values()
      );
    return (
      <div key={msg.id} className={`chatBubble ${isAssistant ? "assistant" : "user"}`}>
        <div className="bubbleHeader">
          <span className="chatRole">{isAssistant ? tDash("copilot.chat.roles.assistant") : tDash("copilot.chat.roles.you")}</span>
          <div className="bubbleMeta">
            {typeof confidence === "number" && (
              <span className="pill subtle">{tDash("askAi.meta.confidence", { confidence })}</span>
            )}
            {typeof accuracyPercent === "number" && (
              <span className="pill subtle">{tDash("askAi.meta.accuracy", { accuracy: accuracyPercent })}</span>
            )}
            <span className="muted small">{relativeTime(msg.created_at)}</span>
          </div>
        </div>
        {isAssistant && areaChips?.length ? (
          <div className="areaChipRow">
            {areaChips.map((area: any) => (
              <span key={area.id || area.name} className="pill subtle" style={{ borderColor: area.color || "#d1d5db" }}>
                <span className="areaDot" style={{ background: area.color || "#9ca3af" }} />
                {area.name || tCommon("labels.area")}
              </span>
            ))}
          </div>
        ) : null}
        <div className="chatText">{msg.content}</div>

        {isAssistant && (
          <div className="bubbleActions">
            <button className="btn btnGhost" onClick={() => navigator.clipboard.writeText(msg.content)}>{tCommon("actions.copy")}</button>
            <button
              className="btn btnGhost"
              onClick={() => navigator.clipboard.writeText(`## Answer\n${msg.content}`)}
            >
              {tDash("askAi.actions.exportMd")}
            </button>
            {sources.length > 0 && (
              <button className="btn btnGhost" onClick={() => setOpenSourcesId(showSources ? null : msg.id)}>
                {showSources ? tDash("copilot.chat.hideSources") : tDash("askAi.actions.sourcesUsed")}
              </button>
            )}
          </div>
        )}

        {isAssistant && showSources && sources.length > 0 && (
          <div className="sourcesPanel">
            <div className="sourcesTitle">{tDash("askAi.actions.sourcesUsed")}</div>
            {sources.slice(0, 6).map((s, idx) => (
              <div key={`${msg.id}-src-${idx}`} className="sourceCard">
                <div className="sourceHeading">
                  <div className="muted">{s.document_title ?? tDash("askAi.sources.document", { id: s.document_id })}</div>
                  <div className="pill subtle">{tDash("copilot.chat.chunk", { index: s.chunk_index ?? 0 })}</div>
                  {(s.area_name || s.area_id) && (
                    <div className="pill subtle" style={{ borderColor: s.area_color || "#d1d5db" }}>
                      <span className="areaDot" style={{ background: s.area_color || "#9ca3af" }} />
                      {s.area_name || tDash("askAi.sources.area", { id: s.area_id })}
                    </div>
                  )}
                  {s.heading_path && <div className="muted" style={{ fontSize: 12 }}>{s.heading_path}</div>}
                </div>
                <div className="sourceText">{renderHighlights(s.chunk_text, s.highlights)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const activeArea = areaScope ? areaMap[areaScope] : null;
  const scopeLabel = areaScope ? activeArea?.name || tCommon("labels.area") : tDash("askAi.scope.allAreas");
  const scopeColor = areaScope ? activeArea?.color || "#6b7280" : "#6b7280";

  const emptyState = (
    <div className="emptyState">
      <div className="emptyTitle">{tDash("askAi.empty.startTitle")}</div>
      <div className="emptyText">{tDash("askAi.empty.startText")}</div>
      <div className="tagRow" style={{ marginTop: 6, gap: 6 }}>
        {samplePrompts.map((p) => (
          <button key={p} className="btn btnGhost" onClick={() => setInput(p)}>
            {p}
          </button>
        ))}
      </div>
      <button className="btn btnPrimary" style={{ marginTop: 10 }} onClick={handleCreateConversation} disabled={!selectedAreaId}>
        {tDash("askAi.newChat")}
      </button>
    </div>
  );

  const settingsPanel = (
    <div className={`settingsPanel ${showSettings ? "open" : "closed"}`}>
      <div className="settingsHeader">
        <div>
          <div className="eyebrow">{tDash("askAi.settings.eyebrow")}</div>
          <div className="h3">{tDash("askAi.settings.title")}</div>
        </div>
        <button className="btn btnGhost" onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? tCommon("actions.close") : tCommon("actions.open")}
        </button>
      </div>
      <div className="settingsSection">
        <div className="muted small" style={{ marginBottom: 6 }}>
          {tDash("askAi.settings.toneHelp")}
        </div>
        <div className="toneGrid">
          {[
            { key: "EXECUTIVE", label: tDash("analytics.tone.executive"), desc: tDash("askAi.settings.tones.executiveDesc") },
            { key: "TECHNICAL", label: tDash("analytics.tone.technical"), desc: tDash("askAi.settings.tones.technicalDesc") },
            { key: "COLLOQUIAL", label: tDash("analytics.tone.colloquial"), desc: tDash("askAi.settings.tones.colloquialDesc") },
          ].map((t) => (
            <button
              key={t.key}
              className={`toneCard ${tone === t.key ? "active" : ""}`}
              onClick={() => setTone(t.key as AnswerTone)}
            >
              <div className="toneLabel">{t.label}</div>
              <div className="muted small">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="settingsSection">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h3" style={{ marginBottom: 4 }}>{tDash("askAi.settings.accuracyTarget")}</div>
            <div className="muted small">{tDash("askAi.settings.accuracyHelp")}</div>
          </div>
          <span className="pill subtle">{accuracyTarget}%</span>
        </div>
        <input
          type="range"
          min={70}
          max={95}
          step={1}
          value={accuracyTarget}
          onChange={(e) => setAccuracyTarget(Number(e.target.value))}
          className="slider"
        />
        <div className="muted small">
          {accuracyTarget >= 90
            ? tDash("askAi.settings.accuracyMode.high")
            : accuracyTarget <= 75
            ? tDash("askAi.settings.accuracyMode.fast")
            : tDash("askAi.settings.accuracyMode.balanced")}
        </div>
      </div>
      <div className="muted small">{tDash("askAi.settings.appliesToNewMessages")}</div>
    </div>
  );

  const accentColor = activeArea?.color || "#e5e7eb";

  const chatHeader = (
    <div className="chatHeader" style={{ borderLeft: `4px solid ${accentColor}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          className="input"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && saveTitle()}
          placeholder={tDash("askAi.conversationTitlePlaceholder")}
        />
        <div className="row" style={{ gap: 6, alignItems: "center", marginTop: 4 }}>
          <span className="pill subtle" style={{ borderColor: scopeColor }}>
            <span className="areaDot" style={{ background: scopeColor }} />
            {scopeLabel}
          </span>
          <span className="muted small">{tDash("askAi.scopedToSelection")}</span>
        </div>
      </div>
      <button className="btn" onClick={() => setShowSettings((s) => !s)}>
        {tDash("askAi.settings.button")}
      </button>
    </div>
  );

  return (
    <div className="askWorkspace">
      <div className="askScopeBar">
        <div>
          <div className="eyebrow">{tDash("askAi.scope.eyebrow")}</div>
          <div className="muted small">{tDash("askAi.scope.subtitle")}</div>
        </div>
        <select
          className="input select"
          value={areaScope ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            const next = val === "" ? null : Number(val);
            setAreaScope(next);
            onSelectArea(next);
          }}
        >
          <option value="">{tDash("askAi.scope.allAreas")}</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="historyPanel">
        <div className="historyHeader">
          <div>
            <div className="eyebrow">{tDash("pageTitles.askAi")}</div>
            <div className="h2">{tDash("askAi.history.title")}</div>
          </div>
          <button className="btn btnPrimary" onClick={handleCreateConversation} disabled={creating}>
            {creating ? tDash("askAi.history.creating") : tDash("askAi.newChat")}
          </button>
        </div>
        <div className="formGroup">
          <label className="fieldLabel">{tDash("askAi.history.searchLabel")}</label>
          <input
            className="input"
            placeholder={tDash("askAi.history.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="conversationList calm" ref={listRef}>
          {loadingList ? (
            <>
              <div className="skeletonLine" style={{ height: 48 }} />
              <div className="skeletonLine" style={{ height: 48 }} />
            </>
          ) : filtered.length ? (
            filtered.map((c) => (
              <div
                key={c.id}
                className={`conversationRow ${c.id === selectedConversationId ? "active" : ""}`}
                onClick={() => loadConversation(c.id)}
              >
                <div className="row" style={{ justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                  <div className="conversationTitle clamp">
                    {c.area_id && areaMap[c.area_id] && (
                      <span
                        className="areaDot"
                        style={{
                          width: 8,
                          height: 8,
                          background: areaMap[c.area_id].color || "#9ca3af",
                          borderRadius: "50%",
                          display: "inline-block",
                        }}
                      />
                    )}
                    <span className="titleText">{c.title || tDash("askAi.newChat")}</span>
                  </div>
                  <div className="menuWrapper convoMenu" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btnGhost iconButton"
                      onClick={() => setOpenMenuId((id) => (id === c.id ? null : c.id))}
                    >
                      ⋯
                    </button>
                    {openMenuId === c.id && (
                      <div className="menu" style={{ right: 0 }}>
                        <button className="menuItem danger" onClick={() => handleDelete(c.id)}>
                          {tCommon("actions.delete")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="muted small">{relativeTime(c.updated_at)}</div>
              </div>
            ))
          ) : (
            <div className="emptyState">
              <div className="emptyTitle">{tDash("askAi.history.empty.title")}</div>
              <div className="emptyText">{tDash("askAi.history.empty.text")}</div>
            </div>
          )}
        </div>
      </div>

      <div className="chatColumn">
        {chatHeader}
        <div className="messageWindow calm">
          {error && <div className="errorBanner">{error}</div>}
          {loadingMessages ? (
            <>
              <div className="chatBubble assistant">
                <div className="chatRole">{tDash("copilot.chat.roles.assistant")}</div>
                <div className="skeletonLine" />
                <div className="skeletonLine short" />
              </div>
              <div className="chatBubble user">
                <div className="chatRole">{tDash("copilot.chat.roles.you")}</div>
                <div className="skeletonLine" />
              </div>
            </>
          ) : messages.length ? (
            messages.map((m) => renderMessage(m))
          ) : (
            emptyState
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <label className="fieldLabel">{tCommon("labels.message")}</label>
          <textarea
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={tDash("askAi.composer.placeholder")}
          />
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            {error ? <span className="formError">{error}</span> : <span className="muted small">{tDash("askAi.composer.scopedHint")}</span>}
            <button className="btn btnPrimary" onClick={handleSend} disabled={sending || !input.trim()}>
              {sending ? tDash("askAi.composer.sending") : tDash("askAi.composer.send")}
            </button>
          </div>
        </div>
      </div>

      {settingsPanel}
    </div>
  );
}
