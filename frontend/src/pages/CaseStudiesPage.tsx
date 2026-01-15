import React, { useEffect, useMemo, useState } from "react";
import { api, ContentItem, KnowledgeBaseArea, Tag, TagCategory } from "../api/client";
import { useTranslation } from "react-i18next";

const SORT_OPTIONS = [
  { value: "relevant", labelKey: "relevant" },
  { value: "recent", labelKey: "recent" },
  { value: "roi", labelKey: "roi" },
];

export default function CaseStudiesPage() {
  const { t: tDash } = useTranslation("dashboard");
  const [areas, setAreas] = useState<KnowledgeBaseArea[]>([]);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [filters, setFilters] = useState({
    status: "APPROVED",
    language: "",
    sort: "relevant",
  });
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

  const loadMeta = async () => {
    try {
      const [areaRes, categoryRes, tagRes] = await Promise.all([
        api.listKbAreas(),
        api.listTagCategories(),
        api.listTags({ includeDeprecated: false }),
      ]);
      setAreas(areaRes as KnowledgeBaseArea[]);
      setCategories(categoryRes as TagCategory[]);
      setTags(tagRes as Tag[]);
    } catch (e: any) {
      setError(e.message || tDash("caseStudies.errors.failedToLoadMetadata"));
    }
  };

  const loadItems = async () => {
    try {
      const caseArea = areas.find((a) => a.key === "case-studies");
      if (!caseArea) return;
      const res = await api.listContentItems({
        areaId: caseArea.id,
        status: filters.status || undefined,
        language: filters.language || undefined,
        tagIds: filterTagIds,
      });
      setItems(res as ContentItem[]);
    } catch (e: any) {
      setError(e.message || tDash("caseStudies.errors.failedToLoadItems"));
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (!areas.length) return;
    loadItems();
  }, [areas, filters, filterTagIds.join(",")]);

  const primaryKeys = ["sector", "use_case", "audience", "funnel_stage", "geography"];
  const primaryCategories = useMemo(
    () => categories.filter((cat) => primaryKeys.includes(cat.key)),
    [categories]
  );

  const toggleTag = (tagId: number) => {
    setFilterTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const roiScore = (item: ContentItem) => {
    const text = `${item.metrics || ""} ${item.body || ""}`;
    const matches = text.match(/\d+(\.\d+)?%?/g) || [];
    return matches.length;
  };

  const sortedItems = useMemo(() => {
    const base = [...items];
    if (filters.sort === "recent") {
      return base.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    if (filters.sort === "roi") {
      return base.sort((a, b) => roiScore(b) - roiScore(a));
    }
    return base;
  }, [items, filters.sort]);

  return (
    <div className="pageStack">
      <div className="hero">
        <div className="heroCopy">
          <div className="eyebrow">{tDash("caseStudies.hero.eyebrow")}</div>
          <div className="h1">{tDash("caseStudies.hero.title")}</div>
          <div className="muted">
            {tDash("caseStudies.hero.subtitle")}
          </div>
        </div>
        <div className="heroMeta">
          <div className="metricCard">
            <div className="metricLabel">{tDash("caseStudies.metrics.approvedCaseStudies")}</div>
            <div className="metricValue">{items.filter((i) => i.status === "APPROVED").length}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">{tDash("caseStudies.metrics.activeFilters")}</div>
            <div className="metricValue">{filterTagIds.length}</div>
          </div>
        </div>
      </div>

      {error && <div className="errorBanner">{error}</div>}

      <div className="filterPanel">
        <div className="filterRow">
          <select
            className="select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">{tDash("caseStudies.filters.anyStatus")}</option>
            <option value="APPROVED">{tDash("caseStudies.status.approved")}</option>
            <option value="DRAFT">{tDash("caseStudies.status.draft")}</option>
            <option value="ARCHIVED">{tDash("caseStudies.status.archived")}</option>
          </select>
          <input
            className="input"
            placeholder={tDash("caseStudies.filters.languagePlaceholder")}
            value={filters.language}
            onChange={(e) => setFilters({ ...filters, language: e.target.value })}
          />
          <select
            className="select"
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {tDash(`caseStudies.sort.${opt.labelKey}`)}
              </option>
            ))}
          </select>
        </div>

        {primaryCategories.map((cat) => (
          <div key={cat.id}>
            <div className="eyebrow">{cat.name}</div>
            <div className="chipGroup">
              {(tagsByCategory[cat.key] || []).map((tag) => (
                <button
                  key={tag.id}
                  className={`chip ${filterTagIds.includes(tag.id) ? "active" : ""}`}
                  data-category={cat.key}
                  onClick={() => toggleTag(tag.id)}
                  type="button"
                  aria-pressed={filterTagIds.includes(tag.id)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="caseGrid">
        {sortedItems.length ? (
          sortedItems.map((item) => {
            const challenge = item.summary || item.body.split(".")[0] || tDash("caseStudies.fallback.challengePending");
            const solution = item.body || tDash("caseStudies.fallback.solutionPending");
            return (
              <div key={item.id} className="caseCard cardHover">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  {item.status === "APPROVED" ? (
                    <span className="pill success">{tDash("caseStudies.status.approved")}</span>
                  ) : (
                    <span className="pill subtle">{item.status}</span>
                  )}
                  <span className="muted small">{new Date(item.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="h3">{item.title}</div>
                <div className="tagRow">
                  {item.tags.slice(0, 4).map((tag) => (
                    <span key={tag.id} className="pill">
                      {tag.label}
                    </span>
                  ))}
                </div>
                <div>
                  <div className="muted small">{tDash("caseStudies.card.challenge")}</div>
                  <div className="clamp">{challenge}</div>
                </div>
                <div>
                  <div className="muted small">{tDash("caseStudies.card.solution")}</div>
                  <div className="clamp">{solution.slice(0, 140)}</div>
                </div>
                <div className="caseOutcome">
                  <div className="metricLabel">{tDash("caseStudies.card.outcome")}</div>
                  <div className="metricValue">{item.metrics || tDash("caseStudies.fallback.metricsInReview")}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="emptyState">
            <div className="emptyTitle">{tDash("caseStudies.empty.title")}</div>
            <div className="emptyText">{tDash("caseStudies.empty.text")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
