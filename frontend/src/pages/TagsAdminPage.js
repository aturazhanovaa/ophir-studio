import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
export default function TagsAdminPage() {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [form, setForm] = useState({ category_id: "", key: "", label: "" });
    const [editingId, setEditingId] = useState(null);
    const [editingLabel, setEditingLabel] = useState("");
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
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
    const loadData = async () => {
        try {
            const [cats, tagRes] = await Promise.all([api.listTagCategories(), api.listTags()]);
            setCategories(cats);
            setTags(tagRes);
        }
        catch (e) {
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
        }
        catch (e) {
            setError(e.message || tDash("tagsAdmin.errors.failedToCreateTag"));
        }
    };
    const toggleDeprecated = async (tag) => {
        try {
            await api.updateTag(tag.id, { deprecated: !tag.deprecated });
            await loadData();
        }
        catch (e) {
            setError(e.message || tDash("tagsAdmin.errors.failedToUpdateTag"));
        }
    };
    const saveRename = async (tag) => {
        if (!editingLabel.trim())
            return;
        try {
            await api.updateTag(tag.id, { label: editingLabel.trim() });
            setEditingId(null);
            setEditingLabel("");
            await loadData();
        }
        catch (e) {
            setError(e.message || tDash("tagsAdmin.errors.failedToRenameTag"));
        }
    };
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("tagsAdmin.eyebrow") }), _jsx("div", { className: "h2", children: tDash("tagsAdmin.title") }), _jsx("div", { className: "muted", children: tDash("tagsAdmin.subtitle") })] }) }), error && _jsx("div", { className: "errorBanner", children: error }), message && _jsx("div", { className: "muted", children: message }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tDash("tagsAdmin.form.category") }), _jsxs("select", { className: "select", value: form.category_id, onChange: (e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : "" }), children: [_jsx("option", { value: "", children: tDash("tagsAdmin.form.selectCategory") }), categories.map((cat) => (_jsx("option", { value: cat.id, children: cat.name }, cat.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tDash("tagsAdmin.form.key") }), _jsx("input", { className: "input", value: form.key, onChange: (e) => setForm({ ...form, key: e.target.value }), placeholder: "hospitality" })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tDash("tagsAdmin.form.label") }), _jsx("input", { className: "input", value: form.label, onChange: (e) => setForm({ ...form, label: e.target.value }), placeholder: "Hospitality" })] }), _jsx("div", { style: { alignSelf: "end" }, children: _jsx("button", { className: "btn btnPrimary", onClick: createTag, children: tDash("tagsAdmin.form.createTag") }) })] })] }), categories.map((cat) => (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: cat.key }), _jsx("div", { className: "h3", children: cat.name }), _jsx("div", { className: "muted", children: cat.description })] }) }), _jsxs("div", { className: "inboxList", children: [(tagsByCategory[cat.key] || []).map((tag) => (_jsxs("div", { className: "inboxRow", children: [_jsxs("div", { className: "inboxMain", children: [_jsxs("div", { className: "docTitle", children: [tag.label, " ", tag.deprecated && _jsx("span", { className: "pill warning", children: tDash("tagsAdmin.deprecated") })] }), _jsx("div", { className: "muted small", children: tDash("tagsAdmin.key", { key: tag.key }) })] }), _jsx("div", { className: "row", children: editingId === tag.id ? (_jsxs(_Fragment, { children: [_jsx("input", { className: "input", value: editingLabel, onChange: (e) => setEditingLabel(e.target.value), style: { width: 180 } }), _jsx("button", { className: "btn btnPrimary", onClick: () => saveRename(tag), children: tCommon("actions.save") }), _jsx("button", { className: "btn btnGhost", onClick: () => {
                                                        setEditingId(null);
                                                        setEditingLabel("");
                                                    }, children: tCommon("actions.cancel") })] })) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn", onClick: () => {
                                                        setEditingId(tag.id);
                                                        setEditingLabel(tag.label);
                                                    }, children: tDash("tagsAdmin.actions.rename") }), _jsx("button", { className: "btn btnDangerGhost", onClick: () => toggleDeprecated(tag), children: tag.deprecated ? tDash("tagsAdmin.actions.restore") : tDash("tagsAdmin.actions.deprecate") })] })) })] }, tag.id))), !tagsByCategory[cat.key]?.length && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("tagsAdmin.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("tagsAdmin.empty.text") })] }))] })] }, cat.id)))] }));
}
