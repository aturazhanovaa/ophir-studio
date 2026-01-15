import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import AreaBadge from "./AreaBadge";
import { computeTimeRange, DEFAULT_TIME_RANGE, isTimeRangeKey } from "../utils/timeRanges";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
const ACCURACY_ORDER = ["HIGH", "MEDIUM", "LOW"];
const TONE_ORDER = ["TECHNICAL", "EXECUTIVE", "COLLOQUIAL"];
const ACCURACY_COLORS = {
    HIGH: "#b91c1c",
    MEDIUM: "#2563eb",
    LOW: "#f59e0b",
};
const TONE_COLORS = {
    TECHNICAL: "#0f172a",
    EXECUTIVE: "#0ea5e9",
    COLLOQUIAL: "#f97316",
};
export default function AnalyticsPanel({ areaId, areas }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [searchParams, setSearchParams] = useSearchParams();
    const initialKey = (() => {
        const fromUrl = searchParams.get("range");
        if (isTimeRangeKey(fromUrl))
            return fromUrl;
        const fromStorage = localStorage.getItem("skh_analytics_range");
        if (isTimeRangeKey(fromStorage))
            return fromStorage;
        return DEFAULT_TIME_RANGE;
    })();
    const [rangeKey, setRangeKey] = useState(initialKey);
    const [overview, setOverview] = useState(null);
    const [topDocs, setTopDocs] = useState([]);
    const [topQuestions, setTopQuestions] = useState([]);
    const [unanswered, setUnanswered] = useState([]);
    const [questionSummary, setQuestionSummary] = useState(null);
    const [questionTrends, setQuestionTrends] = useState({
        by_accuracy: [],
        by_tone: [],
    });
    const [accuracyFilter, setAccuracyFilter] = useState("");
    const [toneFilter, setToneFilter] = useState("");
    const [questionErr, setQuestionErr] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);
    const areaMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
    const accuracyLabel = (lvl) => {
        if (lvl === "HIGH")
            return tDash("analytics.accuracy.high");
        if (lvl === "MEDIUM")
            return tDash("analytics.accuracy.medium");
        return tDash("analytics.accuracy.low");
    };
    const toneLabel = (tone) => {
        if (tone === "TECHNICAL")
            return tDash("analytics.tone.technical");
        if (tone === "EXECUTIVE")
            return tDash("analytics.tone.executive");
        return tDash("analytics.tone.colloquial");
    };
    const accuracyBreakdown = useMemo(() => ACCURACY_ORDER.map((lvl) => ({
        key: lvl,
        label: accuracyLabel(lvl),
        count: (questionSummary?.by_accuracy ?? []).find((a) => a.accuracy_level === lvl)?.count ??
            0,
    })), [questionSummary, tDash]);
    const toneBreakdown = useMemo(() => TONE_ORDER.map((tone) => ({
        key: tone,
        label: toneLabel(tone),
        count: (questionSummary?.by_tone ?? []).find((t) => t.answer_tone === tone)?.count ?? 0,
    })), [questionSummary, tDash]);
    const accuracyTrend = useMemo(() => {
        const dayMap = new Map();
        (questionTrends?.by_accuracy ?? []).forEach((row) => {
            const { date, accuracy_level, count } = row;
            if (!dayMap.has(date)) {
                const init = ACCURACY_ORDER.reduce((acc, lvl) => ({ ...acc, [lvl]: 0 }), {});
                dayMap.set(date, init);
            }
            const day = dayMap.get(date);
            day[accuracy_level] = count;
            dayMap.set(date, day);
        });
        return Array.from(dayMap.entries())
            .map(([date, counts]) => {
            const total = ACCURACY_ORDER.reduce((sum, lvl) => sum + (counts[lvl] ?? 0), 0);
            return { date, total, ...counts };
        })
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [questionTrends]);
    const topAccuracy = useMemo(() => accuracyBreakdown.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), accuracyBreakdown[0]), [accuracyBreakdown]);
    const topTone = useMemo(() => toneBreakdown.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), toneBreakdown[0]), [toneBreakdown]);
    const questionsTotal = questionSummary?.total_questions ?? 0;
    const activeArea = areaId ? areaMap.get(areaId) : null;
    const computedRange = useMemo(() => computeTimeRange(rangeKey), [rangeKey]);
    const renderArea = (id) => {
        if (!id)
            return "—";
        const area = areaMap.get(id);
        if (!area)
            return `Area ${id}`;
        return _jsx(AreaBadge, { name: area.name, color: area.color, size: "sm" });
    };
    const loadData = async (key, area) => {
        setLoading(true);
        setErr(null);
        setTopDocs([]);
        setTopQuestions([]);
        setUnanswered([]);
        setQuestionErr(null);
        setQuestionSummary(null);
        setQuestionTrends({ by_accuracy: [], by_tone: [] });
        try {
            const rng = computeTimeRange(key);
            const [o, d, q, u] = await Promise.all([
                api.analyticsOverview({ range: key, start_date: rng.startIso, end_date: rng.endIso }),
                api.analyticsTopDocuments({ range: key, start_date: rng.startIso, end_date: rng.endIso, area_id: area }),
                api.analyticsTopQuestions({
                    range: key,
                    start_date: rng.startIso,
                    end_date: rng.endIso,
                    accuracy_level: accuracyFilter || undefined,
                    answer_tone: toneFilter || undefined,
                }),
                api.analyticsUnanswered({
                    range: key,
                    start_date: rng.startIso,
                    end_date: rng.endIso,
                    accuracy_level: accuracyFilter || undefined,
                    answer_tone: toneFilter || undefined,
                }),
            ]);
            setOverview(o);
            setTopDocs(d);
            setTopQuestions(q);
            setUnanswered(u);
            if (area) {
                try {
                    const [qs, qt] = await Promise.all([
                        api.analyticsQuestionsSummary({ area_id: area, range: key, start_date: rng.startIso, end_date: rng.endIso }),
                        api.analyticsQuestionsTrends({ area_id: area, range: key, start_date: rng.startIso, end_date: rng.endIso }),
                    ]);
                    setQuestionSummary(qs);
                    setQuestionTrends(qt);
                }
                catch (qe) {
                    setQuestionErr(qe.message || tDash("analytics.errors.failedToLoadQuestions"));
                }
            }
        }
        catch (e) {
            setErr(e.message || tDash("analytics.errors.failedToLoadAnalytics"));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadData(rangeKey, areaId);
    }, [rangeKey, areaId, accuracyFilter, toneFilter]);
    useEffect(() => {
        localStorage.setItem("skh_analytics_range", rangeKey);
        if (searchParams.get("range") !== rangeKey) {
            const next = new URLSearchParams(searchParams);
            next.set("range", rangeKey);
            setSearchParams(next, { replace: true });
        }
    }, [rangeKey, searchParams, setSearchParams]);
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("analytics.eyebrow") }), _jsx("div", { className: "h2", children: tDash("analytics.title") })] }), _jsxs("div", { className: "row", style: { flexWrap: "wrap", gap: 8 }, children: [activeArea && _jsx(AreaBadge, { name: activeArea.name, color: activeArea.color, size: "sm" }), _jsxs("div", { className: "stack", style: { gap: 4 }, children: [_jsxs("select", { className: "input select", value: rangeKey, onChange: (e) => setRangeKey(e.target.value), children: [_jsx("option", { value: "last_7_days", children: tDash("analytics.ranges.last7Days") }), _jsx("option", { value: "last_30_days", children: tDash("analytics.ranges.last30Days") }), _jsx("option", { value: "last_90_days", children: tDash("analytics.ranges.last90Days") }), _jsx("option", { value: "last_quarter", children: tDash("analytics.ranges.lastQuarter") }), _jsx("option", { value: "this_quarter_to_date", children: tDash("analytics.ranges.thisQuarterToDate") }), _jsx("option", { value: "last_12_months", children: tDash("analytics.ranges.last12Months") })] }), _jsx("div", { className: "muted small", style: { marginLeft: 2 }, children: computedRange.display })] }), _jsxs("select", { className: "input select", value: accuracyFilter, onChange: (e) => setAccuracyFilter(e.target.value), children: [_jsx("option", { value: "", children: tDash("analytics.filters.allAccuracyLevels") }), ACCURACY_ORDER.map((lvl) => (_jsx("option", { value: lvl, children: accuracyLabel(lvl) }, lvl)))] }), _jsxs("select", { className: "input select", value: toneFilter, onChange: (e) => setToneFilter(e.target.value), children: [_jsx("option", { value: "", children: tDash("analytics.filters.allTones") }), TONE_ORDER.map((tone) => (_jsx("option", { value: tone, children: toneLabel(tone) }, tone)))] })] })] }), err && _jsx("div", { className: "errorBanner", children: err }), _jsxs("div", { className: "cardBody grid", children: [_jsx(StatCard, { label: tDash("analytics.stats.totalQuestions"), value: overview?.total_questions ?? "—", loading: loading }), _jsx(StatCard, { label: tDash("analytics.stats.unanswered"), value: overview?.unanswered_questions ?? "—", loading: loading }), _jsx(StatCard, { label: tDash("analytics.stats.topDocument"), value: overview?.top_document?.title ?? "—", loading: loading }), _jsx(StatCard, { label: tDash("analytics.stats.activeUsers"), value: overview?.active_users ?? "—", loading: loading })] }), _jsxs("div", { className: "grid twoCols", children: [_jsx(Table, { title: tDash("analytics.tables.topDocuments.title"), loading: loading, rows: topDocs, headers: [tCommon("labels.title"), tCommon("labels.area"), tDash("analytics.tables.topDocuments.views")], render: (r) => [r.title, renderArea(r.area_id), r.count] }), _jsx(Table, { title: tDash("analytics.tables.topQuestions.title"), loading: loading, rows: topQuestions, headers: [
                            tDash("analytics.tables.topQuestions.query"),
                            tCommon("labels.area"),
                            tDash("analytics.tables.topQuestions.tone"),
                            tDash("analytics.tables.topQuestions.accuracy"),
                            tDash("analytics.tables.topQuestions.count"),
                        ], render: (r) => [
                            r.query,
                            renderArea(r.area_id),
                            _jsx(Badge, { label: toneLabel(r.answer_tone), color: TONE_COLORS[r.answer_tone], subtle: true }),
                            _jsx(Badge, { label: accuracyLabel(r.accuracy_level), color: ACCURACY_COLORS[r.accuracy_level] }),
                            r.count,
                        ] })] }), _jsxs("div", { className: "cardSubsection", children: [_jsxs("div", { className: "sectionHeader", style: { marginBottom: 8 }, children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("analytics.questions.eyebrow") }), _jsx("div", { className: "h3", children: tDash("analytics.questions.title") })] }), !areaId && _jsx("div", { className: "muted", children: tDash("analytics.questions.selectArea") })] }), questionErr && _jsx("div", { className: "errorBanner", children: questionErr }), !areaId ? (_jsx("div", { className: "muted", children: tDash("analytics.questions.chooseArea") })) : questionErr ? (_jsx("div", { className: "muted", children: tDash("analytics.questions.unavailable") })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "cardBody grid twoCols", children: [_jsx(StatCard, { label: tDash("analytics.questions.questionsInRange"), value: questionsTotal || "0", loading: loading }), _jsx(StatCard, { label: tDash("analytics.questions.topAccuracyLevel"), value: questionsTotal ? topAccuracy.label : "—", loading: loading })] }), _jsxs("div", { className: "grid twoCols", children: [_jsx(BreakdownCard, { title: tDash("analytics.questions.accuracyBreakdown"), items: accuracyBreakdown, total: questionsTotal, palette: ACCURACY_COLORS, loading: loading }), _jsx(BreakdownCard, { title: tDash("analytics.questions.toneBreakdown"), items: toneBreakdown, total: questionsTotal, palette: TONE_COLORS, loading: loading })] }), _jsx(AccuracyTrendChart, { data: accuracyTrend, loading: loading })] }))] }), _jsx("div", { className: "cardSubsection", children: _jsx(Table, { title: tDash("analytics.tables.unanswered.title"), loading: loading, rows: unanswered, headers: [
                        tDash("analytics.tables.topQuestions.query"),
                        tCommon("labels.area"),
                        tDash("analytics.tables.topQuestions.tone"),
                        tDash("analytics.tables.topQuestions.accuracy"),
                        tDash("analytics.tables.unanswered.when"),
                    ], render: (r) => [
                        r.query,
                        renderArea(r.area_id),
                        _jsx(Badge, { label: toneLabel(r.answer_tone), color: TONE_COLORS[r.answer_tone], subtle: true }),
                        _jsx(Badge, { label: accuracyLabel(r.accuracy_level), color: ACCURACY_COLORS[r.accuracy_level] }),
                        new Date(r.asked_at).toLocaleString(),
                    ] }) })] }));
}
function StatCard({ label, value, loading }) {
    return (_jsxs("div", { className: "statCard", children: [_jsx("div", { className: "muted", children: label }), loading ? _jsx("div", { className: "skeletonLine short" }) : _jsx("div", { className: "statValue", children: value })] }));
}
function BreakdownCard({ title, items, total, palette, loading, }) {
    const { t: tDash } = useTranslation("dashboard");
    return (_jsxs("div", { className: "tableBlock", children: [_jsx("div", { className: "tableTitle", children: title }), loading ? (_jsxs("div", { className: "stack", children: [_jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine short" })] })) : (_jsxs("div", { className: "breakdownList", children: [items.map((item) => {
                        const pct = total ? Math.round((item.count / total) * 100) : 0;
                        const fillPct = total ? Math.max(6, (item.count / total) * 100) : item.count > 0 ? 100 : 0;
                        return (_jsxs("div", { className: "breakdownRow", children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { className: "row", style: { gap: 8, alignItems: "center" }, children: [_jsx("span", { className: "legendDot", style: { background: palette[item.key] || "#0f172a" } }), _jsx("span", { children: item.label })] }), _jsxs("div", { className: "muted", children: [item.count, " ", total ? `(${pct}%)` : ""] })] }), _jsx("div", { className: "barTrack", children: _jsx("div", { className: "barFill", style: {
                                            width: `${Math.min(100, fillPct)}%`,
                                            background: palette[item.key] || "#0f172a",
                                        } }) })] }, item.key));
                    }), total === 0 && _jsx("div", { className: "muted", children: tDash("analytics.empty.noDataForRange") })] }))] }));
}
function AccuracyTrendChart({ data, loading }) {
    const { t: tDash } = useTranslation("dashboard");
    const maxTotal = data.length ? Math.max(...data.map((d) => d.total), 1) : 1;
    return (_jsxs("div", { className: "trendSection", children: [_jsx("div", { className: "tableTitle", children: tDash("analytics.trend.title") }), loading ? (_jsx("div", { className: "trendChart", children: [0, 1, 2, 3, 4, 5].map((i) => (_jsxs("div", { className: "trendColumn", children: [_jsx("div", { className: "trendStack", children: _jsx("div", { className: "skeletonLine", style: { height: "100%" } }) }), _jsx("div", { className: "trendLabel", children: "\u00A0" })] }, i))) })) : data.length === 0 ? (_jsx("div", { className: "muted", children: tDash("analytics.empty.noQuestionsForRange") })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "trendChart", children: data.map((d) => (_jsxs("div", { className: "trendColumn", title: `${d.date}: ${d.total} questions`, children: [_jsx("div", { className: "trendStack", children: ACCURACY_ORDER.map((lvl) => (_jsx("div", { className: "trendSegment", style: {
                                            height: `${(d[lvl] / maxTotal) * 100}%`,
                                            background: ACCURACY_COLORS[lvl],
                                        } }, lvl))) }), _jsx("div", { className: "trendLabel", children: d.date.slice(5) })] }, d.date))) }), _jsx("div", { className: "legendRow", children: ACCURACY_ORDER.map((lvl) => (_jsxs("div", { className: "legendItem", children: [_jsx("span", { className: "legendDot", style: { background: ACCURACY_COLORS[lvl] } }), _jsx("span", { children: tDash(`analytics.accuracy.${lvl.toLowerCase()}`) })] }, lvl))) })] }))] }));
}
function Badge({ label, color, subtle }) {
    return (_jsx("span", { className: `pill ${subtle ? "subtle" : ""}`, style: {
            background: `${color}14`,
            color,
            borderColor: `${color}33`,
        }, children: label }));
}
function Table({ title, headers, rows, render, loading, }) {
    const { t: tDash } = useTranslation("dashboard");
    return (_jsxs("div", { className: "tableBlock", children: [_jsx("div", { className: "tableTitle", children: title }), _jsxs("div", { className: "table", children: [_jsx("div", { className: "tableHead", style: { gridTemplateColumns: `repeat(${headers.length}, 1fr)` }, children: headers.map((h) => (_jsx("div", { children: h }, h))) }), _jsxs("div", { className: "tableBody", children: [loading && (_jsx(_Fragment, { children: [1, 2, 3].map((i) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: `repeat(${headers.length}, 1fr)` }, children: [_jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine short" }), _jsx("div", { className: "skeletonLine short" })] }, i))) })), !loading &&
                                rows.map((r, idx) => (_jsx("div", { className: "tableRow", style: { gridTemplateColumns: `repeat(${headers.length}, 1fr)` }, children: render(r).map((cell, i) => (_jsx("div", { children: cell }, i))) }, idx))), !loading && rows.length === 0 && _jsx("div", { className: "muted", children: tDash("analytics.empty.noData") })] })] })] }));
}
