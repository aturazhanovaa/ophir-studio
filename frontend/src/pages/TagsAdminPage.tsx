import React, { useEffect, useMemo, useState } from "react";
import { api, Tag, TagCategory } from "../api/client";
import { useTranslation } from "react-i18next";

type TagForm = {
  category_id: number | "";
  key: string;
  label: string;
};

export default function TagsAdminPage() {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<TagForm>({ category_id: "", key: "", label: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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

  const loadData = async () => {
    try {
      const [cats, tagRes] = await Promise.all([api.listTagCategories(), api.listTags()]);
      setCategories(cats as TagCategory[]);
      setTags(tagRes as Tag[]);
    } catch (e: any) {
      setError(e.message || tDash("tagsAdmin.errors.failedToLoadTags"));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createTag = async () => {
    if (!form.category_id || !form.key.trim() || !form.label.trim()) {
      setMessage(tDash("tagsAdmin.messages.required"));
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await api.createTag({
        category_id: Number(form.category_id),
        key: form.key.trim(),
        label: form.label.trim(),
      });
      setForm({ category_id: "", key: "", label: "" });
      setMessage(tDash("tagsAdmin.messages.created"));
      await loadData();
    } catch (e: any) {
      setError(e.message || tDash("tagsAdmin.errors.failedToCreateTag"));
    }
  };

  const toggleDeprecated = async (tag: Tag) => {
    try {
      await api.updateTag(tag.id, { deprecated: !tag.deprecated });
      await loadData();
    } catch (e: any) {
      setError(e.message || tDash("tagsAdmin.errors.failedToUpdateTag"));
    }
  };

  const saveRename = async (tag: Tag) => {
    if (!editingLabel.trim()) return;
    try {
      await api.updateTag(tag.id, { label: editingLabel.trim() });
      setEditingId(null);
      setEditingLabel("");
      await loadData();
    } catch (e: any) {
      setError(e.message || tDash("tagsAdmin.errors.failedToRenameTag"));
    }
  };

  return (
    <div className="pageStack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tDash("tagsAdmin.eyebrow")}</div>
            <div className="h2">{tDash("tagsAdmin.title")}</div>
            <div className="muted">{tDash("tagsAdmin.subtitle")}</div>
          </div>
        </div>

        {error && <div className="errorBanner">{error}</div>}
        {message && <div className="muted">{message}</div>}

        <div className="formGrid">
          <div>
            <label className="fieldLabel">{tDash("tagsAdmin.form.category")}</label>
            <select
              className="select"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : "" })}
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
            <label className="fieldLabel">{tDash("tagsAdmin.form.key")}</label>
            <input
              className="input"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="hospitality"
            />
          </div>
          <div>
            <label className="fieldLabel">{tDash("tagsAdmin.form.label")}</label>
            <input
              className="input"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Hospitality"
            />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button className="btn btnPrimary" onClick={createTag}>
              {tDash("tagsAdmin.form.createTag")}
            </button>
          </div>
        </div>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{cat.key}</div>
              <div className="h3">{cat.name}</div>
              <div className="muted">{cat.description}</div>
            </div>
          </div>
          <div className="inboxList">
            {(tagsByCategory[cat.key] || []).map((tag) => (
              <div key={tag.id} className="inboxRow">
                <div className="inboxMain">
                  <div className="docTitle">
                    {tag.label} {tag.deprecated && <span className="pill warning">{tDash("tagsAdmin.deprecated")}</span>}
                  </div>
                  <div className="muted small">{tDash("tagsAdmin.key", { key: tag.key })}</div>
                </div>
                <div className="row">
                  {editingId === tag.id ? (
                    <>
                      <input
                        className="input"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        style={{ width: 180 }}
                      />
                      <button className="btn btnPrimary" onClick={() => saveRename(tag)}>
                        {tCommon("actions.save")}
                      </button>
                      <button
                        className="btn btnGhost"
                        onClick={() => {
                          setEditingId(null);
                          setEditingLabel("");
                        }}
                      >
                        {tCommon("actions.cancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn"
                        onClick={() => {
                          setEditingId(tag.id);
                          setEditingLabel(tag.label);
                        }}
                      >
                        {tDash("tagsAdmin.actions.rename")}
                      </button>
                      <button className="btn btnDangerGhost" onClick={() => toggleDeprecated(tag)}>
                        {tag.deprecated ? tDash("tagsAdmin.actions.restore") : tDash("tagsAdmin.actions.deprecate")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!tagsByCategory[cat.key]?.length && (
              <div className="emptyState">
                <div className="emptyTitle">{tDash("tagsAdmin.empty.title")}</div>
                <div className="emptyText">{tDash("tagsAdmin.empty.text")}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
