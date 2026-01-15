import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
const SORT_OPTIONS = [
    { value: "relevant", labelKey: "relevant" },
    { value: "recent", labelKey: "recent" },
    { value: "roi", labelKey: "roi" },
];
export default function CaseStudiesPage() {
    const { t: tDash } = useTranslation("dashboard");
    const [areas, setAreas] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [items, setItems] = useState([]);
    const [filterTagIds, setFilterTagIds] = useState([]);
    const [filters, setFilters] = useState({
        status: "APPROVED",
        language: "",
        sort: "relevant",
    });
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
    const loadMeta = async () => {
        try {
            const [areaRes, categoryRes, tagRes] = await Promise.all([
                api.listKbAreas(),
                api.listTagCategories(),
                api.listTags({ includeDeprecated: false }),
            ]);
            setAreas(areaRes);
            setCategories(categoryRes);
            setTags(tagRes);
        }
        catch (e) {
            setError(e.message || tDash("caseStudies.errors.failedToLoadMetadata"));
        }
    };
    const loadItems = async () => {
        try {
            const caseArea = areas.find((a) => a.key === "case-studies");
            if (!caseArea)
                return;
            const res = await api.listContentItems({
                areaId: caseArea.id,
                status: filters.status || undefined,
                language: filters.language || undefined,
                tagIds: filterTagIds,
            });
            setItems(res);
        }
        catch (e) {
            setError(e.message || tDash("caseStudies.errors.failedToLoadItems"));
        }
    };
    useEffect(() => {
        loadMeta();
    }, []);
    useEffect(() => {
        if (!areas.length)
            return;
        loadItems();
    }, [areas, filters, filterTagIds.join(",")]);
    const primaryKeys = ["sector", "use_case", "audience", "funnel_stage", "geography"];
    const primaryCategories = useMemo(() => categories.filter((cat) => primaryKeys.includes(cat.key)), [categories]);
    const toggleTag = (tagId) => {
        setFilterTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
    };
    const roiScore = (item) => {
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
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "hero", children: [_jsxs("div", { className: "heroCopy", children: [_jsx("div", { className: "eyebrow", children: tDash("caseStudies.hero.eyebrow") }), _jsx("div", { className: "h1", children: tDash("caseStudies.hero.title") }), _jsx("div", { className: "muted", children: tDash("caseStudies.hero.subtitle") })] }), _jsxs("div", { className: "heroMeta", children: [_jsxs("div", { className: "metricCard", children: [_jsx("div", { className: "metricLabel", children: tDash("caseStudies.metrics.approvedCaseStudies") }), _jsx("div", { className: "metricValue", children: items.filter((i) => i.status === "APPROVED").length })] }), _jsxs("div", { className: "metricCard", children: [_jsx("div", { className: "metricLabel", children: tDash("caseStudies.metrics.activeFilters") }), _jsx("div", { className: "metricValue", children: filterTagIds.length })] })] })] }), error && _jsx("div", { className: "errorBanner", children: error }), _jsxs("div", { className: "filterPanel", children: [_jsxs("div", { className: "filterRow", children: [_jsxs("select", { className: "select", value: filters.status, onChange: (e) => setFilters({ ...filters, status: e.target.value }), children: [_jsx("option", { value: "", children: tDash("caseStudies.filters.anyStatus") }), _jsx("option", { value: "APPROVED", children: tDash("caseStudies.status.approved") }), _jsx("option", { value: "DRAFT", children: tDash("caseStudies.status.draft") }), _jsx("option", { value: "ARCHIVED", children: tDash("caseStudies.status.archived") })] }), _jsx("input", { className: "input", placeholder: tDash("caseStudies.filters.languagePlaceholder"), value: filters.language, onChange: (e) => setFilters({ ...filters, language: e.target.value }) }), _jsx("select", { className: "select", value: filters.sort, onChange: (e) => setFilters({ ...filters, sort: e.target.value }), children: SORT_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, children: tDash(`caseStudies.sort.${opt.labelKey}`) }, opt.value))) })] }), primaryCategories.map((cat) => (_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: cat.name }), _jsx("div", { className: "chipGroup", children: (tagsByCategory[cat.key] || []).map((tag) => (_jsx("button", { className: `chip ${filterTagIds.includes(tag.id) ? "active" : ""}`, "data-category": cat.key, onClick: () => toggleTag(tag.id), type: "button", "aria-pressed": filterTagIds.includes(tag.id), children: tag.label }, tag.id))) })] }, cat.id)))] }), _jsx("div", { className: "caseGrid", children: sortedItems.length ? (sortedItems.map((item) => {
                    const challenge = item.summary || item.body.split(".")[0] || tDash("caseStudies.fallback.challengePending");
                    const solution = item.body || tDash("caseStudies.fallback.solutionPending");
                    return (_jsxs("div", { className: "caseCard cardHover", children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [item.status === "APPROVED" ? (_jsx("span", { className: "pill success", children: tDash("caseStudies.status.approved") })) : (_jsx("span", { className: "pill subtle", children: item.status })), _jsx("span", { className: "muted small", children: new Date(item.updated_at).toLocaleDateString() })] }), _jsx("div", { className: "h3", children: item.title }), _jsx("div", { className: "tagRow", children: item.tags.slice(0, 4).map((tag) => (_jsx("span", { className: "pill", children: tag.label }, tag.id))) }), _jsxs("div", { children: [_jsx("div", { className: "muted small", children: tDash("caseStudies.card.challenge") }), _jsx("div", { className: "clamp", children: challenge })] }), _jsxs("div", { children: [_jsx("div", { className: "muted small", children: tDash("caseStudies.card.solution") }), _jsx("div", { className: "clamp", children: solution.slice(0, 140) })] }), _jsxs("div", { className: "caseOutcome", children: [_jsx("div", { className: "metricLabel", children: tDash("caseStudies.card.outcome") }), _jsx("div", { className: "metricValue", children: item.metrics || tDash("caseStudies.fallback.metricsInReview") })] })] }, item.id));
                })) : (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("caseStudies.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("caseStudies.empty.text") })] })) })] }));
}
