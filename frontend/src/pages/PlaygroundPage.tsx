import React, { useEffect, useMemo, useState } from "react";
import { api, Tag, TagCategory } from "../api/client";
import { useTranslation } from "react-i18next";

const OBJECTIVES = [
  "outreach email",
  "professional network message",
  "discovery call opener",
  "proposal section",
  "FAQ answer",
];
const CORE_CATEGORY_KEYS = ["sector", "use_case", "audience", "funnel_stage", "geography"];
const REQUIRE_CORE_FOR_OBJECTIVE = new Set([
  "outreach email",
  "professional network message",
  "proposal section",
  "FAQ answer",
]);

export default function PlaygroundPage() {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [objective, setObjective] = useState(OBJECTIVES[0]);
  const [context, setContext] = useState("");
  const [filters, setFilters] = useState<Record<string, number[]>>({});
  const [language, setLanguage] = useState("en");
  const [result, setResult] = useState<any>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tagsByCategory = useMemo(() => {
    const map: Record<string, Tag[]> = {};
    tags.forEach((tag) => {
      const key = tag.category?.key || "other";
      if (!map[key]) map[key] = [];
      map[key].push(tag);
    });
    Object.values(map).forEach((group) => group.sort((a, b) => a.label.localeCompare(b.label)));
    return map;
  }, [tags]);

  const visibleCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (CORE_CATEGORY_KEYS.includes(cat.key)) return true;
      return (tagsByCategory[cat.key] || []).length > 0;
    });
  }, [categories, tagsByCategory]);

  const loadTags = async () => {
    try {
      const [cats, tagRes] = await Promise.all([api.listTagCategories(), api.listTags({ includeDeprecated: false })]);
      setCategories(cats as TagCategory[]);
      setTags(tagRes as Tag[]);
    } catch (e: any) {
      setError(e.message || tDash("playground.errors.failedToLoadTags"));
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const toggleFilterTag = (categoryKey: string, tagId: number) => {
    const current = filters[categoryKey] || [];
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    setFilters({ ...filters, [categoryKey]: next });
  };

  const missingCriticalFilters = () => {
    const sector = filters["sector"] || [];
    const useCase = filters["use_case"] || [];
    return sector.length === 0 || useCase.length === 0;
  };

  const requiresCoreFilters = REQUIRE_CORE_FOR_OBJECTIVE.has(objective);
  const missingCoreFilters = missingCriticalFilters();

  const runDraft = async () => {
    if (requiresCoreFilters && missingCoreFilters) {
      setError(tDash("playground.errors.selectCoreFilters"));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.runPlayground({
        objective,
        context,
        filters: {
          ...filters,
          language,
        },
      });
      setResult(res);
      setRunId(res.run_id);
    } catch (e: any) {
      setError(e.message || tDash("playground.errors.failedToRun"));
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (rating: string) => {
    if (!runId) return;
    try {
      await api.submitPlaygroundFeedback(runId, { rating, comment: comment.trim() || undefined });
      setComment("");
    } catch (e: any) {
      setError(e.message || tDash("playground.errors.failedToSubmitFeedback"));
    }
  };

  const objectiveLabel = (key: string) => {
    if (key === "outreach email") return tDash("playground.objectives.outreachEmail");
    if (key === "professional network message") return tDash("playground.objectives.professionalNetworkMessage");
    if (key === "discovery call opener") return tDash("playground.objectives.discoveryCallOpener");
    if (key === "proposal section") return tDash("playground.objectives.proposalSection");
    if (key === "FAQ answer") return tDash("playground.objectives.faqAnswer");
    return key;
  };

  return (
    <div className="pageStack">
      <div className="hero">
        <div className="heroCopy">
          <div className="eyebrow">{tDash("playground.hero.eyebrow")}</div>
          <div className="h1">{tDash("playground.hero.title")}</div>
          <div className="muted">{tDash("playground.hero.subtitle")}</div>
        </div>
        <div className="heroMeta">
          <div className="metricCard">
            <div className="metricLabel">{tDash("playground.metrics.confidenceMode")}</div>
            <div className="metricValue">{result?.confidence_label || tDash("playground.metrics.na")}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">{tDash("playground.metrics.sourcesUsed")}</div>
            <div className="metricValue">{result?.sources?.length || 0}</div>
          </div>
        </div>
      </div>

      {error && <div className="errorBanner">{error}</div>}

      <div className="playgroundLayout">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tDash("playground.inputs.eyebrow")}</div>
              <div className="h3">{tDash("playground.inputs.title")}</div>
            </div>
          </div>

          <div className="formGrid">
            <div>
              <label className="fieldLabel">{tCommon("labels.objective")}</label>
              <select className="select" value={objective} onChange={(e) => setObjective(e.target.value)}>
                {OBJECTIVES.map((opt) => (
                  <option key={opt} value={opt}>
                    {objectiveLabel(opt)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fieldLabel">{tCommon("labels.language")}</label>
              <input className="input" value={language} onChange={(e) => setLanguage(e.target.value)} />
            </div>
            <div>
              <label className="fieldLabel">{tCommon("labels.context")}</label>
              <textarea
                className="input"
                rows={3}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={tCommon("placeholders.addBackground")}
              />
            </div>
          </div>

          {missingCoreFilters && (
            <div className="pill warning" style={{ marginTop: 10 }}>
              {tDash("playground.warnings.missingCoreFilters")}
            </div>
          )}

          {requiresCoreFilters && missingCoreFilters && (
            <div className="muted small" style={{ marginTop: 6 }}>
              {tDash("playground.warnings.requiresCoreFilters")}
            </div>
          )}

          <div className="inlinePanel">
            <div className="eyebrow">{tDash("playground.filters.eyebrow")}</div>
            <div className="checkGrid">
              {visibleCategories.map((cat) => (
                <div key={cat.id} className="card" style={{ boxShadow: "none" }}>
                  <div className="h3">{cat.name}</div>
                  <div className="tagRow">
                    {(tagsByCategory[cat.key] || []).map((tag) => (
                      <label key={tag.id} className="checkRow">
                        <input
                          type="checkbox"
                          checked={(filters[cat.key] || []).includes(tag.id)}
                          onChange={() => toggleFilterTag(cat.key, tag.id)}
                        />
                        <span>{tag.label}</span>
                      </label>
                    ))}
                    {!tagsByCategory[cat.key]?.length && <span className="muted">{tDash("playground.filters.noTagsYet")}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="modalActions">
            <button className="btn btnPrimary" onClick={runDraft} disabled={loading || (requiresCoreFilters && missingCoreFilters)}>
              {loading ? tDash("playground.actions.drafting") : tDash("playground.actions.generateDraft")}
            </button>
          </div>
        </div>

        <div className="card playgroundOutput">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tDash("playground.output.eyebrow")}</div>
              <div className="h3">{tDash("playground.output.title")}</div>
            </div>
            {result && (
              <span className={`pill ${result.confidence_label === "LOW" ? "warning" : "success"}`}>
                {result.confidence_label}
              </span>
            )}
          </div>

          <div className="answerBlock">
            <pre className="answerText">{result?.draft || tDash("playground.output.empty")}</pre>
          </div>

          {result && result.sources?.length === 0 && (
            <div className="inlinePanel">
              <div className="eyebrow">{tDash("playground.output.noSources.title")}</div>
              <div className="muted small">
                {tDash("playground.output.noSources.text")}
              </div>
            </div>
          )}

          {result && result.sources?.length > 0 && result.sources.every((s: any) => s.status !== "APPROVED") && (
            <div className="inlinePanel">
              <div className="eyebrow">{tDash("playground.output.onlyDraftSources.title")}</div>
              <div className="muted small">
                {tDash("playground.output.onlyDraftSources.text")}
              </div>
            </div>
          )}

          {result?.warnings?.length > 0 && (
            <div className="inlinePanel">
              <div className="eyebrow">{tDash("playground.output.coverageCheck")}</div>
              <div className="tagRow">
                {result.warnings.map((w: string, idx: number) => (
                  <span key={`${w}-${idx}`} className="pill warning">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="inlinePanel">
            <div className="eyebrow">{tDash("playground.sourcesUsed.eyebrow")}</div>
            <div className="sourceList">
              {result?.sources?.map((source: any) => (
                <div key={`${source.source_type}-${source.source_id}`} className="sourceRow">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="h3">{source.title}</div>
                    <span className="pill">{source.status}</span>
                  </div>
                  <div className="muted small">
                    {tDash("playground.sourcesUsed.score", { sourceType: source.source_type, score: Number(source.score || 0).toFixed(2) })}
                  </div>
                </div>
              ))}
              {!result?.sources?.length && (
                <div className="emptyState">
                  <div className="emptyTitle">{tDash("playground.sourcesUsed.empty.title")}</div>
                  <div className="emptyText">{tDash("playground.sourcesUsed.empty.text")}</div>
                </div>
              )}
            </div>
          </div>

          <div className="inlinePanel">
            <div className="eyebrow">{tDash("playground.feedback.eyebrow")}</div>
            <div className="row">
              <button className="btn" onClick={() => submitFeedback("USEFUL")} disabled={!runId}>
                {tDash("playground.feedback.useful")}
              </button>
              <button className="btn btnDangerGhost" onClick={() => submitFeedback("NOT_USEFUL")} disabled={!runId}>
                {tDash("playground.feedback.notUseful")}
              </button>
            </div>
            <textarea
              className="input"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tDash("playground.feedback.optionalComment")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
