import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
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
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [objective, setObjective] = useState(OBJECTIVES[0]);
    const [context, setContext] = useState("");
    const [filters, setFilters] = useState({});
    const [language, setLanguage] = useState("en");
    const [result, setResult] = useState(null);
    const [runId, setRunId] = useState(null);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
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
    const visibleCategories = useMemo(() => {
        return categories.filter((cat) => {
            if (CORE_CATEGORY_KEYS.includes(cat.key))
                return true;
            return (tagsByCategory[cat.key] || []).length > 0;
        });
    }, [categories, tagsByCategory]);
    const loadTags = async () => {
        try {
            const [cats, tagRes] = await Promise.all([api.listTagCategories(), api.listTags({ includeDeprecated: false })]);
            setCategories(cats);
            setTags(tagRes);
        }
        catch (e) {
            setError(e.message || tDash("playground.errors.failedToLoadTags"));
        }
    };
    useEffect(() => {
        loadTags();
    }, []);
    const toggleFilterTag = (categoryKey, tagId) => {
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
        }
        catch (e) {
            setError(e.message || tDash("playground.errors.failedToRun"));
        }
        finally {
            setLoading(false);
        }
    };
    const submitFeedback = async (rating) => {
        if (!runId)
            return;
        try {
            await api.submitPlaygroundFeedback(runId, { rating, comment: comment.trim() || undefined });
            setComment("");
        }
        catch (e) {
            setError(e.message || tDash("playground.errors.failedToSubmitFeedback"));
        }
    };
    const objectiveLabel = (key) => {
        if (key === "outreach email")
            return tDash("playground.objectives.outreachEmail");
        if (key === "professional network message")
            return tDash("playground.objectives.professionalNetworkMessage");
        if (key === "discovery call opener")
            return tDash("playground.objectives.discoveryCallOpener");
        if (key === "proposal section")
            return tDash("playground.objectives.proposalSection");
        if (key === "FAQ answer")
            return tDash("playground.objectives.faqAnswer");
        return key;
    };
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "hero", children: [_jsxs("div", { className: "heroCopy", children: [_jsx("div", { className: "eyebrow", children: tDash("playground.hero.eyebrow") }), _jsx("div", { className: "h1", children: tDash("playground.hero.title") }), _jsx("div", { className: "muted", children: tDash("playground.hero.subtitle") })] }), _jsxs("div", { className: "heroMeta", children: [_jsxs("div", { className: "metricCard", children: [_jsx("div", { className: "metricLabel", children: tDash("playground.metrics.confidenceMode") }), _jsx("div", { className: "metricValue", children: result?.confidence_label || tDash("playground.metrics.na") })] }), _jsxs("div", { className: "metricCard", children: [_jsx("div", { className: "metricLabel", children: tDash("playground.metrics.sourcesUsed") }), _jsx("div", { className: "metricValue", children: result?.sources?.length || 0 })] })] })] }), error && _jsx("div", { className: "errorBanner", children: error }), _jsxs("div", { className: "playgroundLayout", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("playground.inputs.eyebrow") }), _jsx("div", { className: "h3", children: tDash("playground.inputs.title") })] }) }), _jsxs("div", { className: "formGrid", children: [_jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.objective") }), _jsx("select", { className: "select", value: objective, onChange: (e) => setObjective(e.target.value), children: OBJECTIVES.map((opt) => (_jsx("option", { value: opt, children: objectiveLabel(opt) }, opt))) })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.language") }), _jsx("input", { className: "input", value: language, onChange: (e) => setLanguage(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.context") }), _jsx("textarea", { className: "input", rows: 3, value: context, onChange: (e) => setContext(e.target.value), placeholder: tCommon("placeholders.addBackground") })] })] }), missingCoreFilters && (_jsx("div", { className: "pill warning", style: { marginTop: 10 }, children: tDash("playground.warnings.missingCoreFilters") })), requiresCoreFilters && missingCoreFilters && (_jsx("div", { className: "muted small", style: { marginTop: 6 }, children: tDash("playground.warnings.requiresCoreFilters") })), _jsxs("div", { className: "inlinePanel", children: [_jsx("div", { className: "eyebrow", children: tDash("playground.filters.eyebrow") }), _jsx("div", { className: "checkGrid", children: visibleCategories.map((cat) => (_jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsx("div", { className: "h3", children: cat.name }), _jsxs("div", { className: "tagRow", children: [(tagsByCategory[cat.key] || []).map((tag) => (_jsxs("label", { className: "checkRow", children: [_jsx("input", { type: "checkbox", checked: (filters[cat.key] || []).includes(tag.id), onChange: () => toggleFilterTag(cat.key, tag.id) }), _jsx("span", { children: tag.label })] }, tag.id))), !tagsByCategory[cat.key]?.length && _jsx("span", { className: "muted", children: tDash("playground.filters.noTagsYet") })] })] }, cat.id))) })] }), _jsx("div", { className: "modalActions", children: _jsx("button", { className: "btn btnPrimary", onClick: runDraft, disabled: loading || (requiresCoreFilters && missingCoreFilters), children: loading ? tDash("playground.actions.drafting") : tDash("playground.actions.generateDraft") }) })] }), _jsxs("div", { className: "card playgroundOutput", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("playground.output.eyebrow") }), _jsx("div", { className: "h3", children: tDash("playground.output.title") })] }), result && (_jsx("span", { className: `pill ${result.confidence_label === "LOW" ? "warning" : "success"}`, children: result.confidence_label }))] }), _jsx("div", { className: "answerBlock", children: _jsx("pre", { className: "answerText", children: result?.draft || tDash("playground.output.empty") }) }), result && result.sources?.length === 0 && (_jsxs("div", { className: "inlinePanel", children: [_jsx("div", { className: "eyebrow", children: tDash("playground.output.noSources.title") }), _jsx("div", { className: "muted small", children: tDash("playground.output.noSources.text") })] })), result && result.sources?.length > 0 && result.sources.every((s) => s.status !== "APPROVED") && (_jsxs("div", { className: "inlinePanel", children: [_jsx("div", { className: "eyebrow", children: tDash("playground.output.onlyDraftSources.title") }), _jsx("div", { className: "muted small", children: tDash("playground.output.onlyDraftSources.text") })] })), result?.warnings?.length > 0 && (_jsxs("div", { className: "inlinePanel", children: [_jsx("div", { className: "eyebrow", children: tDash("playground.output.coverageCheck") }), _jsx("div", { className: "tagRow", children: result.warnings.map((w, idx) => (_jsx("span", { className: "pill warning", children: w }, `${w}-${idx}`))) })] })), _jsxs("div", { className: "inlinePanel", children: [_jsx("div", { className: "eyebrow", children: tDash("playground.sourcesUsed.eyebrow") }), _jsxs("div", { className: "sourceList", children: [result?.sources?.map((source) => (_jsxs("div", { className: "sourceRow", children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsx("div", { className: "h3", children: source.title }), _jsx("span", { className: "pill", children: source.status })] }), _jsx("div", { className: "muted small", children: tDash("playground.sourcesUsed.score", { sourceType: source.source_type, score: Number(source.score || 0).toFixed(2) }) })] }, `${source.source_type}-${source.source_id}`))), !result?.sources?.length && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("playground.sourcesUsed.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("playground.sourcesUsed.empty.text") })] }))] })] }), _jsxs("div", { className: "inlinePanel", children: [_jsx("div", { className: "eyebrow", children: tDash("playground.feedback.eyebrow") }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn", onClick: () => submitFeedback("USEFUL"), disabled: !runId, children: tDash("playground.feedback.useful") }), _jsx("button", { className: "btn btnDangerGhost", onClick: () => submitFeedback("NOT_USEFUL"), disabled: !runId, children: tDash("playground.feedback.notUseful") })] }), _jsx("textarea", { className: "input", rows: 2, value: comment, onChange: (e) => setComment(e.target.value), placeholder: tDash("playground.feedback.optionalComment") })] })] })] })] }));
}
