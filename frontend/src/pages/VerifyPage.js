import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { API_BASE, api } from "../api/client";
import { useTranslation } from "react-i18next";
const REQUIRED_AREAS = [
    "Industries / Verticals",
    "Services / Solutions",
    "Outreach & Sales Enablement",
    "Case Studies & Proof",
];
const REQUIRED_TAG_KEYS = ["sector", "use_case", "audience", "funnel_stage", "geography"];
export default function VerifyPage() {
    const { t: tDash } = useTranslation("dashboard");
    const [areas, setAreas] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [filterTest, setFilterTest] = useState({
        status: "idle",
        message: "",
    });
    const [retrievalTest, setRetrievalTest] = useState({
        status: "idle",
        message: "",
        warnings: [],
    });
    useEffect(() => {
        const load = async () => {
            try {
                const [areaRes, categoryRes, tagRes] = await Promise.all([
                    api.listKbAreas(),
                    api.listTagCategories(),
                    api.listTags({ includeDeprecated: false }),
                ]);
                setAreas(areaRes);
                setCategories(categoryRes);
                setTags(tagRes);
                setLoadError(null);
            }
            catch (err) {
                setLoadError(err.message || tDash("verify.errors.failedToLoadData"));
            }
            finally {
                setLoading(false);
            }
        };
        load();
    }, []);
    const areaStatus = useMemo(() => {
        const names = new Set(areas.map((a) => a.name));
        const missing = REQUIRED_AREAS.filter((name) => !names.has(name));
        return { ok: missing.length === 0, missing };
    }, [areas]);
    const categoryStatus = useMemo(() => {
        const keys = new Set(categories.map((c) => c.key));
        const missing = REQUIRED_TAG_KEYS.filter((key) => !keys.has(key));
        return { ok: missing.length === 0, missing };
    }, [categories]);
    const retailTag = useMemo(() => tags.find((tag) => tag.category?.key === "sector" && tag.key === "retail"), [tags]);
    const lossTag = useMemo(() => tags.find((tag) => tag.category?.key === "use_case" && tag.key === "loss-prevention"), [tags]);
    const runFilterTest = async () => {
        if (!retailTag || !lossTag) {
            setFilterTest({
                status: "fail",
                message: tDash("verify.filterTest.missingTags"),
            });
            return;
        }
        setFilterTest({ status: "running", message: tDash("verify.filterTest.running") });
        try {
            const results = (await api.listContentItems({
                status: "APPROVED",
                tagIds: [retailTag.id, lossTag.id],
            }));
            const pass = results.length > 0 &&
                results.every((item) => {
                    const ids = new Set(item.tags.map((t) => t.id));
                    return ids.has(retailTag.id) && ids.has(lossTag.id);
                });
            setFilterTest({
                status: pass ? "pass" : "fail",
                message: pass
                    ? tDash("verify.filterTest.pass", { count: results.length })
                    : tDash("verify.filterTest.fail"),
            });
        }
        catch (err) {
            setFilterTest({ status: "fail", message: err.message || tDash("verify.filterTest.failed") });
        }
    };
    const runRetrievalTest = async () => {
        if (!retailTag || !lossTag) {
            setRetrievalTest({
                status: "fail",
                message: tDash("verify.retrievalTest.missingTags"),
                warnings: [],
            });
            return;
        }
        setRetrievalTest({ status: "running", message: tDash("verify.retrievalTest.running"), warnings: [] });
        try {
            const result = await api.runPlayground({
                objective: "outreach email",
                context: "verification run",
                filters: {
                    sector: [retailTag.id],
                    use_case: [lossTag.id],
                    language: "en",
                },
            });
            const hasSources = result.sources && result.sources.length > 0;
            const hasLowWarning = (result.warnings || []).some((w) => w.includes("LOW CONFIDENCE"));
            const pass = hasSources && !hasLowWarning && result.confidence_label !== "LOW";
            setRetrievalTest({
                status: pass ? "pass" : "fail",
                message: pass
                    ? tDash("verify.retrievalTest.pass", { count: result.sources.length, confidence: result.confidence_label })
                    : tDash("verify.retrievalTest.fail"),
                warnings: result.warnings || [],
            });
        }
        catch (err) {
            setRetrievalTest({ status: "fail", message: err.message || tDash("verify.retrievalTest.failed"), warnings: [] });
        }
    };
    return (_jsxs("div", { className: "pageStack", children: [loadError && (_jsxs("div", { className: "card errorBanner", children: [_jsx("div", { children: loadError }), _jsx("div", { className: "muted small", children: tDash("verify.backendExpectedAt", { url: API_BASE }) })] })), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("verify.hero.eyebrow") }), _jsx("div", { className: "h3", children: tDash("verify.hero.title") })] }), loading ? _jsx("span", { className: "pill subtle", children: tDash("verify.status.loading") }) : _jsx("span", { className: "pill success", children: tDash("verify.status.ready") })] }), _jsx("div", { className: "muted", children: tDash("verify.hero.subtitle") })] }), _jsxs("div", { className: "grid twoCols", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsx("div", { className: "h3", children: tDash("verify.areasCheck.title") }), _jsx("span", { className: `pill ${areaStatus.ok ? "success" : "warning"}`, children: areaStatus.ok ? tDash("verify.result.pass") : tDash("verify.result.fail") })] }), _jsx("div", { className: "tagRow", children: REQUIRED_AREAS.map((name) => (_jsx("span", { className: `pill ${areas.some((a) => a.name === name) ? "success" : "warning"}`, children: name }, name))) }), !areaStatus.ok && _jsx("div", { className: "muted small", children: tDash("verify.missing", { items: areaStatus.missing.join(", ") }) })] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsx("div", { className: "h3", children: tDash("verify.tagCategoriesCheck.title") }), _jsx("span", { className: `pill ${categoryStatus.ok ? "success" : "warning"}`, children: categoryStatus.ok ? tDash("verify.result.pass") : tDash("verify.result.fail") })] }), _jsx("div", { className: "tagRow", children: REQUIRED_TAG_KEYS.map((key) => (_jsx("span", { className: `pill ${categories.some((c) => c.key === key) ? "success" : "warning"}`, children: key }, key))) }), !categoryStatus.ok && _jsx("div", { className: "muted small", children: tDash("verify.missing", { items: categoryStatus.missing.join(", ") }) })] })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsx("div", { className: "h3", children: tDash("verify.behaviorTests.title") }) }), _jsxs("div", { className: "grid twoCols", children: [_jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsx("div", { className: "h3", children: tDash("verify.filterBehavior.title") }), _jsx("div", { className: "muted small", children: "sector=Retail AND use_case=Loss prevention" }), _jsxs("div", { className: "actionRow", children: [_jsx("button", { className: "btn btnSecondary", onClick: runFilterTest, type: "button", children: tDash("verify.filterBehavior.run") }), filterTest.status !== "idle" && (_jsx("span", { className: `pill ${filterTest.status === "pass" ? "success" : filterTest.status === "running" ? "info" : "warning"}`, children: filterTest.status.toUpperCase() }))] }), filterTest.message && _jsx("div", { className: "muted small", children: filterTest.message })] }), _jsxs("div", { className: "card", style: { boxShadow: "none" }, children: [_jsx("div", { className: "h3", children: tDash("verify.retrievalPriority.title") }), _jsx("div", { className: "muted small", children: tDash("verify.retrievalPriority.subtitle") }), _jsxs("div", { className: "actionRow", children: [_jsx("button", { className: "btn btnSecondary", onClick: runRetrievalTest, type: "button", children: tDash("verify.retrievalPriority.run") }), retrievalTest.status !== "idle" && (_jsx("span", { className: `pill ${retrievalTest.status === "pass" ? "success" : retrievalTest.status === "running" ? "info" : "warning"}`, children: retrievalTest.status.toUpperCase() }))] }), retrievalTest.message && _jsx("div", { className: "muted small", children: retrievalTest.message }), retrievalTest.warnings && retrievalTest.warnings.length > 0 && (_jsx("div", { className: "tagRow", style: { marginTop: 8 }, children: retrievalTest.warnings.map((w) => (_jsx("span", { className: "pill warning", children: w }, w))) }))] })] })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsx("div", { className: "h3", children: tDash("verify.apiCurl.title") }) }), _jsx("pre", { className: "answerText", children: `# Areas
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/kb/areas

# Tag categories
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/tags/categories

# Tagged content items
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8000/kb/content?status=APPROVED&tag_ids=${retailTag?.id || "RETAIL_ID"},${lossTag?.id || "LOSS_ID"}"` })] })] }));
}
