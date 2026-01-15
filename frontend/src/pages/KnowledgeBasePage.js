import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, clearToken, } from "../api/client";
import { useTranslation } from "react-i18next";
const STATUS_OPTIONS = ["DRAFT", "APPROVED", "ARCHIVED"];
const emptyForm = {
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
    const [areas, setAreas] = useState([]);
    const [collections, setCollections] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [items, setItems] = useState([]);
    const [metaLoading, setMetaLoading] = useState(true);
    const [filters, setFilters] = useState({
        q: "",
        areaId: null,
        collectionId: null,
        status: "",
        language: "",
        updatedSince: "",
    });
    const [filterTagIds, setFilterTagIds] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [formTagIds, setFormTagIds] = useState([]);
    const [tagRequest, setTagRequest] = useState({ category_id: "", label: "", note: "" });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [unauthorized, setUnauthorized] = useState(false);
    const [message, setMessage] = useState(null);
    const areaParam = searchParams.get("area");
    const tagsByCategory = useMemo(() => {
        const map = {};
        tags.forEach((tag) => {
            const key = tag.category?.key || "other";
            if (!map[key])
                map[key] = [];
            map[key].push(tag);
        });
        Object.values(map).forEach((group) => group.sort((a, b) => a.label.localeCompare(b.label)));
        return map;
    }, [tags]);
    const tagCategoryById = useMemo(() => {
        const map = {};
        tags.forEach((tag) => {
            if (tag.category?.key)
                map[tag.id] = tag.category.key;
        });
        return map;
    }, [tags]);
    const primaryKeys = ["sector", "use_case", "audience", "funnel_stage", "geography"];
    const primaryCategories = useMemo(() => categories.filter((cat) => primaryKeys.includes(cat.key)), [categories]);
    const secondaryCategories = useMemo(() => categories.filter((cat) => !primaryKeys.includes(cat.key) && (tagsByCategory[cat.key] || []).length > 0), [categories, tagsByCategory]);
    const approvedCount = useMemo(() => items.filter((item) => item.status === "APPROVED").length, [items]);
    const handleError = (e, fallback) => {
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
            setAreas(areaRes);
            setCollections(collectionRes);
            setCategories(categoryRes);
            setTags(tagRes);
            setUnauthorized(false);
        }
        catch (e) {
            handleError(e, tDash("knowledgeBase.errors.failedToLoadMeta"));
        }
        finally {
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
            setItems(res);
        }
        catch (e) {
            handleError(e, tDash("knowledgeBase.errors.failedToLoadItems"));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadMeta();
    }, []);
    useEffect(() => {
        if (!areas.length)
            return;
        if (!areaParam)
            return;
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
    const selectItem = (item) => {
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
            }
            else {
                await api.createContentItem(payload);
                setMessage(tDash("knowledgeBase.messages.created"));
            }
            await loadItems();
        }
        catch (e) {
            setError(e.message || tDash("knowledgeBase.errors.failedToSave"));
        }
        finally {
            setSaving(false);
        }
    };
    const archiveItem = async () => {
        if (!selectedId)
            return;
        setSaving(true);
        try {
            await api.archiveContentItem(selectedId);
            setMessage("Content archived.");
            resetForm();
            await loadItems();
        }
        catch (e) {
            setError(e.message || "Failed to archive content.");
        }
        finally {
            setSaving(false);
        }
    };
    const toggleFilterTag = (tagId) => {
        if (filterTagIds.includes(tagId)) {
            setFilterTagIds(filterTagIds.filter((id) => id !== tagId));
        }
        else {
            setFilterTagIds([...filterTagIds, tagId]);
        }
    };
    const toggleFormTag = (tagId, categoryKey) => {
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
    const setFunnelStage = (tagId) => {
        setFormTagIds((prev) => {
            const next = prev.filter((id) => tagCategoryById[id] !== "funnel_stage");
            if (tagId)
                next.push(tagId);
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
        }
        catch (e) {
            setError(e.message || tDash("knowledgeBase.tagRequest.failed"));
        }
    };
    const filteredCollections = useMemo(() => collections.filter((c) => !filters.areaId || c.area_id === filters.areaId), [collections, filters.areaId]);
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "hero", children: [_jsxs("div", { className: "heroCopy", children: [_jsx("div", { className: "eyebrow", children: tDash("pageTitles.knowledgeBase") }), _jsx("div", { className: "h1", children: tDash("knowledgeBase.hero.title") }), _jsx("div", { className: "muted", children: tDash("knowledgeBase.hero.subtitle") }), _jsxs("div", { className: "heroActions", children: [_jsx("button", { className: "btn btnPrimary", onClick: resetForm, children: tDash("knowledgeBase.actions.newItem") }), _jsx("button", { className: "btn btnSecondary", onClick: () => setFilters({ ...filters, status: "APPROVED" }), children: tDash("knowledgeBase.actions.showApproved", { count: approvedCount }) })] })] }), _jsxs("div", { className: "heroMeta", children: [_jsx(StatCard, { label: tDash("knowledgeBase.stats.approvedItems"), value: approvedCount }), _jsx(StatCard, { label: tDash("knowledgeBase.stats.totalItems"), value: items.length }), _jsx(StatCard, { label: tDash("knowledgeBase.stats.activeFilters"), value: filterTagIds.length }), _jsx(StatCard, { label: tDash("knowledgeBase.stats.languages"), value: filters.language || tDash("knowledgeBase.stats.all") })] })] }), error && (_jsxs("div", { className: "card errorBanner", children: [_jsx("div", { children: error }), _jsxs("div", { className: "modalActions", children: [_jsx("button", { className: "btn btnSecondary", onClick: reloadAll, type: "button", children: tDash("knowledgeBase.actions.retry") }), unauthorized && (_jsx("button", { className: "btn btnPrimary", onClick: () => {
                                    clearToken();
                                    window.location.reload();
                                }, type: "button", children: tAuth("signIn") }))] })] })), metaLoading && _jsx("div", { className: "muted", children: tDash("knowledgeBase.loadingMeta") }), _jsxs("div", { className: "filterPanel", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("knowledgeBase.filters.areas") }), _jsxs("div", { className: "chipGroup", children: [_jsx("button", { className: `chip ${filters.areaId ? "" : "active"}`, onClick: () => setFilters({ ...filters, areaId: null, collectionId: null }), "data-category": "area", type: "button", "aria-pressed": !filters.areaId, children: tDash("knowledgeBase.filters.allAreas") }), areas.map((area) => (_jsx("button", { className: `chip ${filters.areaId === area.id ? "active" : ""}`, onClick: () => setFilters({ ...filters, areaId: area.id, collectionId: null }), "data-category": "area", type: "button", "aria-pressed": filters.areaId === area.id, children: area.name }, area.id)))] })] }), _jsxs("div", { className: "filterRow", children: [_jsx("input", { className: "input", placeholder: tDash("knowledgeBase.filters.searchPlaceholder"), value: filters.q, onChange: (e) => setFilters({ ...filters, q: e.target.value }) }), _jsxs("select", { className: "select", value: filters.collectionId ?? "", onChange: (e) => setFilters({ ...filters, collectionId: e.target.value ? Number(e.target.value) : null }), children: [_jsx("option", { value: "", children: tDash("knowledgeBase.filters.allCollections") }), filteredCollections.map((collection) => (_jsx("option", { value: collection.id, children: collection.name }, collection.id)))] }), _jsxs("select", { className: "select", value: filters.status, onChange: (e) => setFilters({ ...filters, status: e.target.value }), children: [_jsx("option", { value: "", children: tDash("knowledgeBase.filters.anyStatus") }), STATUS_OPTIONS.map((opt) => (_jsx("option", { value: opt, children: opt }, opt)))] }), _jsx("input", { className: "input", placeholder: tDash("knowledgeBase.filters.languagePlaceholder"), value: filters.language, onChange: (e) => setFilters({ ...filters, language: e.target.value }) }), _jsx("input", { className: "input", type: "date", value: filters.updatedSince, onChange: (e) => setFilters({ ...filters, updatedSince: e.target.value }) })] }), primaryCategories.map((cat) => (_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: cat.name }), _jsxs("div", { className: "chipGroup", children: [(tagsByCategory[cat.key] || []).map((tag) => (_jsx("button", { className: `chip ${filterTagIds.includes(tag.id) ? "active" : ""}`, "data-category": cat.key, onClick: () => toggleFilterTag(tag.id), type: "button", "aria-pressed": filterTagIds.includes(tag.id), children: tag.label }, tag.id))), !tagsByCategory[cat.key]?.length && _jsx("span", { className: "muted", children: tDash("knowledgeBase.filters.noTagsYet") })] })] }, cat.id)))] }), _jsxs("div", { className: "kbLayout", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("knowledgeBase.library.eyebrow") }), _jsx("div", { className: "h3", children: tDash("knowledgeBase.library.title") })] }), _jsx("div", { className: "muted", children: loading ? tCommon("loading.loading") : tDash("knowledgeBase.library.itemsCount", { count: items.length }) })] }), !loading && !items.length && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("knowledgeBase.library.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("knowledgeBase.library.empty.text") })] })), _jsx("div", { className: "inboxList", children: items.map((item) => (_jsxs("div", { className: `contentCard cardHover ${selectedId === item.id ? "docRowActive" : ""}`, onClick: () => selectItem(item), children: [_jsxs("div", { className: "contentCardHeader", children: [_jsx("div", { className: "h3", children: item.title }), item.status === "APPROVED" ? (_jsx("span", { className: "pill success", children: tDash("caseStudies.status.approved") })) : (_jsx("span", { className: "pill subtle", children: item.status }))] }), _jsx("div", { className: "contentMeta", children: tDash("knowledgeBase.library.updatedOn", { language: item.language, date: new Date(item.updated_at).toLocaleDateString() }) }), _jsx("div", { className: "muted clamp", children: item.summary || item.body.slice(0, 160) }), _jsxs("div", { className: "tagRow", children: [item.tags.slice(0, 4).map((tag) => (_jsx("span", { className: "pill", children: tag.label }, tag.id))), item.tags.length > 4 && _jsxs("span", { className: "pill subtle", children: ["+", item.tags.length - 4] })] })] }, item.id))) })] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: selectedId ? tDash("knowledgeBase.detail.edit") : tDash("knowledgeBase.detail.create") }), _jsx("div", { className: "h3", children: tDash("knowledgeBase.detail.title") }), _jsx("div", { className: "muted", children: tDash("knowledgeBase.detail.subtitle") })] }), selectedId && (_jsx("button", { className: "btn btnDangerGhost", onClick: archiveItem, disabled: saving, children: tDash("knowledgeBase.actions.archive") }))] }), message && _jsx("div", { className: "muted", children: message }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.area") }), _jsxs("select", { className: "select", value: form.area_id ?? "", onChange: (e) => setForm({ ...form, area_id: e.target.value ? Number(e.target.value) : null }), children: [_jsx("option", { value: "", children: tCommon("placeholders.selectArea") }), areas.map((area) => (_jsx("option", { value: area.id, children: area.name }, area.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tDash("knowledgeBase.form.collection") }), _jsxs("select", { className: "select", value: form.collection_id ?? "", onChange: (e) => setForm({ ...form, collection_id: e.target.value ? Number(e.target.value) : null }), children: [_jsx("option", { value: "", children: tDash("knowledgeBase.form.noCollection") }), collections
                                                        .filter((c) => !form.area_id || c.area_id === form.area_id)
                                                        .map((collection) => (_jsx("option", { value: collection.id, children: collection.name }, collection.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.status") }), _jsx("select", { className: "select", value: form.status, onChange: (e) => setForm({ ...form, status: e.target.value }), children: STATUS_OPTIONS.map((opt) => (_jsx("option", { value: opt, children: opt }, opt))) })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.language") }), _jsx("input", { className: "input", value: form.language, onChange: (e) => setForm({ ...form, language: e.target.value }) })] })] }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tCommon("labels.title") }), _jsx("input", { className: "input", value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }) }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tDash("knowledgeBase.form.summary") }), _jsx("textarea", { className: "input", rows: 3, value: form.summary, onChange: (e) => setForm({ ...form, summary: e.target.value }) }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tDash("knowledgeBase.form.body") }), _jsx("textarea", { className: "input", rows: 8, value: form.body, onChange: (e) => setForm({ ...form, body: e.target.value }) }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tDash("knowledgeBase.form.metricsOptional") }), _jsx("textarea", { className: "input", rows: 3, value: form.metrics, onChange: (e) => setForm({ ...form, metrics: e.target.value }) }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tDash("knowledgeBase.form.owner") }), _jsx("input", { className: "input", value: form.owner_name, onChange: (e) => setForm({ ...form, owner_name: e.target.value }), placeholder: tDash("knowledgeBase.form.optional") }), _jsx("div", { className: "spacer-sm" }), _jsxs("div", { className: "inlinePanel", children: [_jsx("div", { className: "eyebrow", children: tDash("knowledgeBase.tags.taxonomy") }), _jsx("div", { className: "formGrid", children: primaryCategories.map((cat) => {
                                            if (cat.key === "funnel_stage") {
                                                const selected = formTagIds.find((id) => tagCategoryById[id] === "funnel_stage") || "";
                                                return (_jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: cat.name }), _jsxs("select", { className: "select", value: selected, onChange: (e) => setFunnelStage(e.target.value ? Number(e.target.value) : null), children: [_jsx("option", { value: "", children: tDash("knowledgeBase.tags.noFunnelStage") }), (tagsByCategory[cat.key] || []).map((tag) => (_jsx("option", { value: tag.id, children: tag.label }, tag.id)))] })] }, cat.id));
                                            }
                                            return (_jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: cat.name }), _jsxs("div", { className: "tagRow", children: [(tagsByCategory[cat.key] || []).map((tag) => (_jsxs("label", { className: "checkRow", children: [_jsx("input", { type: "checkbox", checked: formTagIds.includes(tag.id), onChange: () => toggleFormTag(tag.id, cat.key) }), _jsx("span", { children: tag.label })] }, tag.id))), !tagsByCategory[cat.key]?.length && _jsx("span", { className: "muted", children: tDash("knowledgeBase.filters.noTagsYet") })] })] }, cat.id));
                                        }) }), !!secondaryCategories.length && (_jsxs(_Fragment, { children: [_jsx("div", { className: "spacer-sm" }), _jsx("div", { className: "eyebrow", children: tDash("knowledgeBase.tags.additionalOptional") }), _jsx("div", { className: "checkGrid", children: secondaryCategories.map((cat) => (_jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsx("div", { className: "h3", children: cat.name }), _jsxs("div", { className: "tagRow", children: [(tagsByCategory[cat.key] || []).map((tag) => (_jsxs("label", { className: "checkRow", children: [_jsx("input", { type: "checkbox", checked: formTagIds.includes(tag.id), onChange: () => toggleFormTag(tag.id, cat.key) }), _jsx("span", { children: tag.label })] }, tag.id))), !tagsByCategory[cat.key]?.length && _jsx("span", { className: "muted", children: tDash("knowledgeBase.filters.noTagsYet") })] })] }, cat.id))) })] })), _jsx("div", { className: "muted", children: tDash("knowledgeBase.tags.help") })] }), _jsx("div", { className: "spacer-sm" }), _jsxs("div", { className: "inlinePanel", children: [_jsx("div", { className: "eyebrow", children: tDash("knowledgeBase.tagRequest.eyebrow") }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tDash("tagsAdmin.form.category") }), _jsxs("select", { className: "select", value: tagRequest.category_id, onChange: (e) => setTagRequest({ ...tagRequest, category_id: e.target.value }), children: [_jsx("option", { value: "", children: tDash("tagsAdmin.form.selectCategory") }), categories.map((cat) => (_jsx("option", { value: cat.id, children: cat.name }, cat.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tDash("tagsAdmin.form.label") }), _jsx("input", { className: "input", value: tagRequest.label, onChange: (e) => setTagRequest({ ...tagRequest, label: e.target.value }), placeholder: tDash("knowledgeBase.tagRequest.labelPlaceholder") })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tDash("knowledgeBase.tagRequest.noteOptional") }), _jsx("input", { className: "input", value: tagRequest.note, onChange: (e) => setTagRequest({ ...tagRequest, note: e.target.value }), placeholder: tDash("knowledgeBase.tagRequest.notePlaceholder") })] }), _jsx("div", { style: { alignSelf: "end" }, children: _jsx("button", { className: "btn btnSecondary", onClick: requestTag, children: tDash("knowledgeBase.tagRequest.submit") }) })] })] }), _jsx("div", { className: "modalActions", children: _jsx("button", { className: "btn btnPrimary", onClick: saveItem, disabled: saving, children: saving ? tCommon("actions.saving") : tCommon("actions.save") }) })] })] })] }));
}
function StatCard({ label, value }) {
    return (_jsxs("div", { className: "statCard", children: [_jsx("div", { className: "muted", children: label }), _jsx("div", { className: "statValue", children: value })] }));
}
