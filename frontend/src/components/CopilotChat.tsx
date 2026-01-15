import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AccuracyLevel, AnswerTone, CopilotMeta, CopilotSource, Highlight } from "../api/client";
import { useAskPreferences } from "../utils/preferences";
import { useTranslation } from "react-i18next";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  matches?: CopilotSource[];
  meta?: CopilotMeta | null;
  createdAt?: number;
  sourcesOpen?: boolean;
};

type CopilotPanelProps = {
  area: string;
  ask: (
    area: string,
    question: string,
    options: { accuracy: AccuracyLevel; tone: AnswerTone }
  ) => Promise<{ answer: string; matches?: CopilotSource[]; meta?: CopilotMeta | null }>;
};

function renderHighlights(text: string, highlights: Highlight[] = []) {
  if (!highlights.length) return <>{text}</>;
  const sorted = [...highlights]
    .map((h) => ({ start: Math.max(0, h.start), end: Math.min(text.length, h.end) }))
    .sort((a, b) => a.start - b.start)
    .slice(0, 5);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((h, idx) => {
    if (h.start > cursor) {
      parts.push(<span key={`t-${idx}-${cursor}`}>{text.slice(cursor, h.start)}</span>);
    }
    parts.push(
      <mark key={`h-${idx}`} className="highlight">
        {text.slice(h.start, h.end)}
      </mark>
    );
    cursor = h.end;
  });
  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }
  return <>{parts}</>;
}

export default function CopilotPanel({ area, ask }: CopilotPanelProps) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { user } = useAuth();
  const { accuracy, tone, setAccuracy, setTone } = useAskPreferences(user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const canSend = input.trim().length > 0 && !loading;

  const cleanedMessages = useMemo(() => messages, [messages]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const onSend = async () => {
    const q = input.trim();
    if (!q || loading) return;

    setError(null);
    setLoading(true);

    const userMsg: ChatMessage = { role: "user", content: q, createdAt: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    scrollToBottom();

    try {
      const res = await ask(area, q, { accuracy, tone });
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.answer ?? "",
        matches: res.matches ?? [],
        meta: res.meta ?? null,
        createdAt: Date.now(),
        sourcesOpen: false,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      scrollToBottom();
    } catch (e: any) {
      setError(e?.message || tDash("copilot.chat.errors.requestFailed"));
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const toggleSources = (idx: number) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, sourcesOpen: !m.sourcesOpen } : m))
    );
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") onSend();
  };

  const onClear = () => {
    setMessages([]);
    setError(null);
  };

  const copyLastAnswer = async () => {
    const last = [...cleanedMessages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    await navigator.clipboard.writeText(last.content);
  };

  const lastAssistant = [...cleanedMessages].reverse().find((m) => m.role === "assistant");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="card copilotCard">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("copilot.eyebrow")}</div>
          <div className="h2">{tDash("copilot.chat.title")}</div>
        </div>
        <div className="row">
              <div className="menuWrapper" ref={settingsRef}>
            <button className="btn btnGhost" onClick={() => setSettingsOpen((s) => !s)}>
              {tDash("copilot.chat.answerSettings")}
            </button>
            {settingsOpen && (
              <div className="menu settingsMenu">
                <div className="muted" style={{ fontSize: 12 }}>{tDash("copilot.chat.accuracy")}</div>
                <select
                  className="input select"
                  value={accuracy}
                  onChange={(e) => setAccuracy(e.target.value as AccuracyLevel)}
                >
                  <option value="HIGH">{tDash("copilot.chat.accuracyOptions.high")}</option>
                  <option value="MEDIUM">{tDash("copilot.chat.accuracyOptions.medium")}</option>
                  <option value="LOW">{tDash("copilot.chat.accuracyOptions.low")}</option>
                </select>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{tDash("copilot.chat.tone")}</div>
                <select
                  className="input select"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as AnswerTone)}
                >
                  <option value="TECHNICAL">{tDash("analytics.tone.technical")}</option>
                  <option value="EXECUTIVE">{tDash("analytics.tone.executive")}</option>
                  <option value="COLLOQUIAL">{tDash("analytics.tone.colloquial")}</option>
                </select>
              </div>
            )}
          </div>
          <button className="btn" onClick={copyLastAnswer} disabled={!lastAssistant}>
            {tCommon("actions.copy")}
          </button>
          <button className="btn" onClick={onClear} disabled={!messages.length}>
            {tCommon("actions.clear")}
          </button>
        </div>
      </div>

      <div className="chatList" ref={listRef}>
        {cleanedMessages.length === 0 ? (
          <div className="emptyState">
            <div className="emptyTitle">{tDash("copilot.chat.empty.title")}</div>
            <div className="emptyText">
              {tDash("copilot.chat.empty.examplePrefix")} <span className="kbd">{tDash("copilot.chat.empty.example")}</span>
            </div>
          </div>
        ) : (
          cleanedMessages.map((m, idx) => (
            <div key={idx} className={`bubble ${m.role === "user" ? "bubbleUser" : "bubbleAssistant"}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <div className="chatRole">{m.role === "user" ? tDash("copilot.chat.roles.you") : tDash("copilot.chat.roles.assistant")}</div>
                {m.role === "assistant" && m.meta?.evidence_level === "low" && (
                  <span className="pill subtle" style={{ background: "#fef3c7", color: "#92400e" }}>
                    {tDash("copilot.chat.lowEvidence")}
                  </span>
                )}
              </div>
              <div className="chatText">{m.content}</div>

              {m.role === "assistant" && (m.matches?.length ?? 0) > 0 && (
                <div className="sourcesToggle">
                  <button className="btn btnGhost" onClick={() => toggleSources(idx)}>
                    {m.sourcesOpen ? tDash("copilot.chat.hideSources") : tDash("copilot.chat.showSources")}
                  </button>
                </div>
              )}

              {m.role === "assistant" && m.sourcesOpen && (m.matches?.length ?? 0) > 0 && (
                <div className="sourcesPanel">
                  <div className="sourcesTitle">{tDash("copilot.chat.sourcesTitle")}</div>
                  {(m.matches ?? []).slice(0, 5).map((c, i) => (
                    <div key={i} className="sourceCard">
                      <div className="sourceHeading">
                        <div className="muted">{c.document_title ?? tDash("copilot.chat.documentFallback")}</div>
                        <div className="pill subtle">{tDash("copilot.chat.chunk", { index: c.chunk_index ?? 0 })}</div>
                        {c.heading_path && (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {c.heading_path}
                          </div>
                        )}
                      </div>
                      <div className="sourceText">{renderHighlights(c.chunk_text, c.highlights)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="bubble bubbleAssistant">
            <div className="chatRole">{tDash("copilot.chat.roles.assistant")}</div>
            <div className="skeletonLine" />
            <div className="skeletonLine short" />
          </div>
        )}

        {error && <div className="errorBanner">{error}</div>}
      </div>

      <div className="chatInputBar">
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={tDash("copilot.chat.inputPlaceholder")}
        />
        <button className="btn btnPrimary" onClick={onSend} disabled={!canSend}>
          {tDash("copilot.chat.ask")}
        </button>
      </div>
    </div>
  );
}
