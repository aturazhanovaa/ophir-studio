import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  api,
  clearToken,
  ContentItem,
  KnowledgeBaseArea,
  KnowledgeBaseCollection,
  Tag,
  TagCategory,
} from "../api/client";
import { useTranslation } from "react-i18next";

type ContentStatus = ContentItem["status"];
const STATUS_OPTIONS: ContentStatus[] = ["DRAFT", "APPROVED", "ARCHIVED"];

type ContentForm = {
  area_id: number | null;
  collection_id: number | null;
  title: string;
  summary: string;
  body: string;
  status: ContentStatus;
  language: string;
  metrics: string;
  owner_name: string;
};

const emptyForm: ContentForm = {
  area_id: null,
  collection_id: null,
  title: "",
  summary: "",
  body: "",
  status: "DRAFT",
  language: "en",
  metrics: "",
  owner_name: "",
};

export default function KnowledgeBasePage() {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { t: tAuth } = useTranslation("auth");
  const [searchParams] = useSearchParams();
  const [areas, setAreas] = useState<KnowledgeBaseArea[]>([]);
  const [collections, setCollections] = useState<KnowledgeBaseCollection[]>([]);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    areaId: null as number | null,
    collectionId: null as number | null,
    status: "",
    language: "",
    updatedSince: "",
  });
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ContentForm>({ ...emptyForm });
  const [formTagIds, setFormTagIds] = useState<number[]>([]);
  const [tagRequest, setTagRequest] = useState({ category_id: "", label: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const areaParam = searchParams.get("area");

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

  const tagCategoryById = useMemo(() => {
    const map: Record<number, string> = {};
    tags.forEach((tag) => {
      if (tag.category?.key) map[tag.id] = tag.category.key;
    });
    return map;
  }, [tags]);

  const primaryKeys = ["sector", "use_case", "audience", "funnel_stage", "geography"];
  const primaryCategories = useMemo(
    () => categories.filter((cat) => primaryKeys.includes(cat.key)),
    [categories]
  );
  const secondaryCategories = useMemo(
    () =>
      categories.filter(
        (cat) => !primaryKeys.includes(cat.key) && (tagsByCategory[cat.key] || []).length > 0
      ),
    [categories, tagsByCategory]
  );
  const approvedCount = useMemo(() => items.filter((item) => item.status === "APPROVED").length, [items]);

  const handleError = (e: any, fallback: string) => {
    const msg = e?.message || fallback;
    setError(msg);
    if (/unauthorized|token|http 401/i.test(msg)) {
      setUnauthorized(true);
    }
  };

  const loadMeta = async () => {
    setMetaLoading(true);
    try {
      const [areaRes, collectionRes, categoryRes, tagRes] = await Promise.all([
        api.listKbAreas(),
        api.listKbCollections(),
        api.listTagCategories(),
        api.listTags({ includeDeprecated: false }),
      ]);
      setAreas(areaRes as KnowledgeBaseArea[]);
      setCollections(collectionRes as KnowledgeBaseCollection[]);
      setCategories(categoryRes as TagCategory[]);
      setTags(tagRes as Tag[]);
      setUnauthorized(false);
    } catch (e: any) {
      handleError(e, tDash("knowledgeBase.errors.failedToLoadMeta"));
    } finally {
      setMetaLoading(false);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listContentItems({
        q: filters.q || undefined,
        areaId: filters.areaId,
        collectionId: filters.collectionId,
        status: filters.status || undefined,
        language: filters.language || undefined,
        updatedSince: filters.updatedSince || undefined,
        tagIds: filterTagIds,
      });
      setItems(res as ContentItem[]);
    } catch (e: any) {
      handleError(e, tDash("knowledgeBase.errors.failedToLoadItems"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (!areas.length) return;
    if (!areaParam) return;
    const target = areas.find((a) => a.key === areaParam);
    if (target && filters.areaId !== target.id) {
      setFilters((prev) => ({ ...prev, areaId: target.id, collectionId: null }));
    }
  }, [areas, areaParam]);

  useEffect(() => {
    loadItems();
  }, [filters, filterTagIds.join(",")]);

  const reloadAll = () => {
    setError(null);
    setUnauthorized(false);
    loadMeta();
    loadItems();
  };

  const selectItem = (item: ContentItem) => {
    setSelectedId(item.id);
    setForm({
      area_id: item.area_id,
      collection_id: item.collection_id ?? null,
      title: item.title,
      summary: item.summary || "",
      body: item.body,
      status: item.status,
      language: item.language,
      metrics: item.metrics || "",
      owner_name: item.owner_name || "",
    });
    setFormTagIds(item.tags.map((t) => t.id));
    setMessage(null);
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm({ ...emptyForm });
    setFormTagIds([]);
    setMessage(null);
  };

  const saveItem = async () => {
    if (!form.area_id || !form.title.trim()) {
      setMessage(tDash("knowledgeBase.errors.areaAndTitleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        area_id: form.area_id,
        collection_id: form.collection_id || undefined,
        title: form.title,
        summary: form.summary || undefined,
        body: form.body,
        status: form.status,
        language: form.language,
        owner_name: form.owner_name || undefined,
        metrics: form.metrics || undefined,
        tag_ids: formTagIds,
      };
      if (selectedId) {
        await api.updateContentItem(selectedId, payload);
        setMessage(tDash("knowledgeBase.messages.updated"));
      } else {
        await api.createContentItem(payload);
        setMessage(tDash("knowledgeBase.messages.created"));
      }
      await loadItems();
    } catch (e: any) {
      setError(e.message || tDash("knowledgeBase.errors.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const archiveItem = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.archiveContentItem(selectedId);
      setMessage("Content archived.");
      resetForm();
      await loadItems();
    } catch (e: any) {
      setError(e.message || "Failed to archive content.");
    } finally {
      setSaving(false);
    }
  };

  const toggleFilterTag = (tagId: number) => {
    if (filterTagIds.includes(tagId)) {
      setFilterTagIds(filterTagIds.filter((id) => id !== tagId));
    } else {
      setFilterTagIds([...filterTagIds, tagId]);
    }
  };

  const toggleFormTag = (tagId: number, categoryKey?: string) => {
    setFormTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      let next = [...prev];
      if (categoryKey === "funnel_stage") {
        next = next.filter((id) => tagCategoryById[id] !== "funnel_stage");
      }
      next.push(tagId);
      return next;
    });
  };

  const setFunnelStage = (tagId: number | null) => {
    setFormTagIds((prev) => {
      const next = prev.filter((id) => tagCategoryById[id] !== "funnel_stage");
      if (tagId) next.push(tagId);
      return next;
    });
  };

  const requestTag = async () => {
    if (!tagRequest.category_id || !tagRequest.label.trim()) {
      setMessage(tDash("knowledgeBase.tagRequest.required"));
      return;
    }
    try {
      await api.createTagSuggestion({
        category_id: Number(tagRequest.category_id),
        label: tagRequest.label.trim(),
        note: tagRequest.note.trim() || undefined,
      });
      setTagRequest({ category_id: "", label: "", note: "" });
      setMessage(tDash("knowledgeBase.tagRequest.submitted"));
    } catch (e: any) {
      setError(e.message || tDash("knowledgeBase.tagRequest.failed"));
    }
  };

  const filteredCollections = useMemo(
    () => collections.filter((c) => !filters.areaId || c.area_id === filters.areaId),
    [collections, filters.areaId]
  );

  return (
    <div className="pageStack">
      <div className="hero">
        <div className="heroCopy">
          <div className="eyebrow">{tDash("pageTitles.knowledgeBase")}</div>
          <div className="h1">{tDash("knowledgeBase.hero.title")}</div>
          <div className="muted">
            {tDash("knowledgeBase.hero.subtitle")}
          </div>
          <div className="heroActions">
            <button className="btn btnPrimary" onClick={resetForm}>
              {tDash("knowledgeBase.actions.newItem")}
            </button>
            <button className="btn btnSecondary" onClick={() => setFilters({ ...filters, status: "APPROVED" })}>
              {tDash("knowledgeBase.actions.showApproved", { count: approvedCount })}
            </button>
          </div>
        </div>
        <div className="heroMeta">
          <StatCard label={tDash("knowledgeBase.stats.approvedItems")} value={approvedCount} />
          <StatCard label={tDash("knowledgeBase.stats.totalItems")} value={items.length} />
          <StatCard label={tDash("knowledgeBase.stats.activeFilters")} value={filterTagIds.length} />
          <StatCard label={tDash("knowledgeBase.stats.languages")} value={filters.language || tDash("knowledgeBase.stats.all")} />
        </div>
      </div>

      {error && (
        <div className="card errorBanner">
          <div>{error}</div>
          <div className="modalActions">
            <button className="btn btnSecondary" onClick={reloadAll} type="button">
              {tDash("knowledgeBase.actions.retry")}
            </button>
            {unauthorized && (
              <button
                className="btn btnPrimary"
                onClick={() => {
                  clearToken();
                  window.location.reload();
                }}
                type="button"
              >
                {tAuth("signIn")}
              </button>
            )}
          </div>
        </div>
      )}

      {metaLoading && <div className="muted">{tDash("knowledgeBase.loadingMeta")}</div>}

      <div className="filterPanel">
        <div>
          <div className="eyebrow">{tDash("knowledgeBase.filters.areas")}</div>
          <div className="chipGroup">
            <button
              className={`chip ${filters.areaId ? "" : "active"}`}
              onClick={() => setFilters({ ...filters, areaId: null, collectionId: null })}
              data-category="area"
              type="button"
              aria-pressed={!filters.areaId}
            >
              {tDash("knowledgeBase.filters.allAreas")}
            </button>
            {areas.map((area) => (
              <button
                key={area.id}
                className={`chip ${filters.areaId === area.id ? "active" : ""}`}
                onClick={() => setFilters({ ...filters, areaId: area.id, collectionId: null })}
                data-category="area"
                type="button"
                aria-pressed={filters.areaId === area.id}
              >
                {area.name}
              </button>
            ))}
          </div>
        </div>

        <div className="filterRow">
          <input
            className="input"
            placeholder={tDash("knowledgeBase.filters.searchPlaceholder")}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
          <select
            className="select"
            value={filters.collectionId ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, collectionId: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">{tDash("knowledgeBase.filters.allCollections")}</option>
            {filteredCollections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">{tDash("knowledgeBase.filters.anyStatus")}</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder={tDash("knowledgeBase.filters.languagePlaceholder")}
            value={filters.language}
            onChange={(e) => setFilters({ ...filters, language: e.target.value })}
          />
          <input
            className="input"
            type="date"
            value={filters.updatedSince}
            onChange={(e) => setFilters({ ...filters, updatedSince: e.target.value })}
          />
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
                  onClick={() => toggleFilterTag(tag.id)}
                  type="button"
                  aria-pressed={filterTagIds.includes(tag.id)}
                >
                  {tag.label}
                </button>
              ))}
              {!tagsByCategory[cat.key]?.length && <span className="muted">{tDash("knowledgeBase.filters.noTagsYet")}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="kbLayout">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tDash("knowledgeBase.library.eyebrow")}</div>
              <div className="h3">{tDash("knowledgeBase.library.title")}</div>
            </div>
            <div className="muted">{loading ? tCommon("loading.loading") : tDash("knowledgeBase.library.itemsCount", { count: items.length })}</div>
          </div>

          {!loading && !items.length && (
            <div className="emptyState">
              <div className="emptyTitle">{tDash("knowledgeBase.library.empty.title")}</div>
              <div className="emptyText">{tDash("knowledgeBase.library.empty.text")}</div>
            </div>
          )}

          <div className="inboxList">
            {items.map((item) => (
              <div
                key={item.id}
                className={`contentCard cardHover ${selectedId === item.id ? "docRowActive" : ""}`}
                onClick={() => selectItem(item)}
              >
                <div className="contentCardHeader">
                  <div className="h3">{item.title}</div>
                  {item.status === "APPROVED" ? (
                    <span className="pill success">{tDash("caseStudies.status.approved")}</span>
                  ) : (
                    <span className="pill subtle">{item.status}</span>
                  )}
                </div>
                <div className="contentMeta">
                  {tDash("knowledgeBase.library.updatedOn", { language: item.language, date: new Date(item.updated_at).toLocaleDateString() })}
                </div>
                <div className="muted clamp">{item.summary || item.body.slice(0, 160)}</div>
                <div className="tagRow">
                  {item.tags.slice(0, 4).map((tag) => (
                    <span key={tag.id} className="pill">
                      {tag.label}
                    </span>
                  ))}
                  {item.tags.length > 4 && <span className="pill subtle">+{item.tags.length - 4}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{selectedId ? tDash("knowledgeBase.detail.edit") : tDash("knowledgeBase.detail.create")}</div>
              <div className="h3">{tDash("knowledgeBase.detail.title")}</div>
              <div className="muted">{tDash("knowledgeBase.detail.subtitle")}</div>
            </div>
            {selectedId && (
              <button className="btn btnDangerGhost" onClick={archiveItem} disabled={saving}>
                {tDash("knowledgeBase.actions.archive")}
              </button>
            )}
          </div>

          {message && <div className="muted">{message}</div>}

          <div className="formGrid">
            <div>
              <label className="fieldLabel">{tCommon("labels.area")}</label>
              <select
                className="select"
                value={form.area_id ?? ""}
                onChange={(e) =>
                  setForm({ ...form, area_id: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">{tCommon("placeholders.selectArea")}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fieldLabel">{tDash("knowledgeBase.form.collection")}</label>
              <select
                className="select"
                value={form.collection_id ?? ""}
                onChange={(e) =>
                  setForm({ ...form, collection_id: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">{tDash("knowledgeBase.form.noCollection")}</option>
                {collections
                  .filter((c) => !form.area_id || c.area_id === form.area_id)
                  .map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="fieldLabel">{tCommon("labels.status")}</label>
              <select
                className="select"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ContentStatus })}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fieldLabel">{tCommon("labels.language")}</label>
              <input
                className="input"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              />
            </div>
          </div>

          <div className="spacer-sm" />

          <label className="fieldLabel">{tCommon("labels.title")}</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

          <div className="spacer-sm" />

          <label className="fieldLabel">{tDash("knowledgeBase.form.summary")}</label>
          <textarea
            className="input"
            rows={3}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />

          <div className="spacer-sm" />

          <label className="fieldLabel">{tDash("knowledgeBase.form.body")}</label>
          <textarea
            className="input"
            rows={8}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />

          <div className="spacer-sm" />

          <label className="fieldLabel">{tDash("knowledgeBase.form.metricsOptional")}</label>
          <textarea
            className="input"
            rows={3}
            value={form.metrics}
            onChange={(e) => setForm({ ...form, metrics: e.target.value })}
          />

          <div className="spacer-sm" />

          <label className="fieldLabel">{tDash("knowledgeBase.form.owner")}</label>
          <input
            className="input"
            value={form.owner_name}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            placeholder={tDash("knowledgeBase.form.optional")}
          />

          <div className="spacer-sm" />

          <div className="inlinePanel">
            <div className="eyebrow">{tDash("knowledgeBase.tags.taxonomy")}</div>
            <div className="formGrid">
              {primaryCategories.map((cat) => {
                if (cat.key === "funnel_stage") {
                  const selected = formTagIds.find((id) => tagCategoryById[id] === "funnel_stage") || "";
                  return (
                    <div key={cat.id}>
                      <label className="fieldLabel">{cat.name}</label>
                      <select
                        className="select"
                        value={selected}
                        onChange={(e) => setFunnelStage(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">{tDash("knowledgeBase.tags.noFunnelStage")}</option>
                        {(tagsByCategory[cat.key] || []).map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return (
                  <div key={cat.id}>
                    <label className="fieldLabel">{cat.name}</label>
                    <div className="tagRow">
                      {(tagsByCategory[cat.key] || []).map((tag) => (
                        <label key={tag.id} className="checkRow">
                          <input
                            type="checkbox"
                            checked={formTagIds.includes(tag.id)}
                            onChange={() => toggleFormTag(tag.id, cat.key)}
                          />
                          <span>{tag.label}</span>
                        </label>
                      ))}
                      {!tagsByCategory[cat.key]?.length && <span className="muted">{tDash("knowledgeBase.filters.noTagsYet")}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {!!secondaryCategories.length && (
              <>
                <div className="spacer-sm" />
                <div className="eyebrow">{tDash("knowledgeBase.tags.additionalOptional")}</div>
                <div className="checkGrid">
                  {secondaryCategories.map((cat) => (
                    <div key={cat.id} className="card" style={{ boxShadow: "none" }}>
                      <div className="h3">{cat.name}</div>
                      <div className="tagRow">
                        {(tagsByCategory[cat.key] || []).map((tag) => (
                          <label key={tag.id} className="checkRow">
                            <input
                              type="checkbox"
                              checked={formTagIds.includes(tag.id)}
                              onChange={() => toggleFormTag(tag.id, cat.key)}
                            />
                            <span>{tag.label}</span>
                          </label>
                        ))}
                        {!tagsByCategory[cat.key]?.length && <span className="muted">{tDash("knowledgeBase.filters.noTagsYet")}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="muted">{tDash("knowledgeBase.tags.help")}</div>
          </div>

          <div className="spacer-sm" />

          <div className="inlinePanel">
            <div className="eyebrow">{tDash("knowledgeBase.tagRequest.eyebrow")}</div>
            <div className="formGrid">
              <div>
                <label className="fieldLabel">{tDash("tagsAdmin.form.category")}</label>
                <select
                  className="select"
                  value={tagRequest.category_id}
                  onChange={(e) => setTagRequest({ ...tagRequest, category_id: e.target.value })}
                >
                  <option value="">{tDash("tagsAdmin.form.selectCategory")}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fieldLabel">{tDash("tagsAdmin.form.label")}</label>
                <input
                  className="input"
                  value={tagRequest.label}
                  onChange={(e) => setTagRequest({ ...tagRequest, label: e.target.value })}
                  placeholder={tDash("knowledgeBase.tagRequest.labelPlaceholder")}
                />
              </div>
              <div>
                <label className="fieldLabel">{tDash("knowledgeBase.tagRequest.noteOptional")}</label>
                <input
                  className="input"
                  value={tagRequest.note}
                  onChange={(e) => setTagRequest({ ...tagRequest, note: e.target.value })}
                  placeholder={tDash("knowledgeBase.tagRequest.notePlaceholder")}
                />
              </div>
              <div style={{ alignSelf: "end" }}>
                <button className="btn btnSecondary" onClick={requestTag}>
                  {tDash("knowledgeBase.tagRequest.submit")}
                </button>
              </div>
            </div>
          </div>

          <div className="modalActions">
            <button className="btn btnPrimary" onClick={saveItem} disabled={saving}>
              {saving ? tCommon("actions.saving") : tCommon("actions.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="statCard">
      <div className="muted">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}
