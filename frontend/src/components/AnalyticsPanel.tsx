import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AccuracyLevel, AnswerTone, Area } from "../api/client";
import AreaBadge from "./AreaBadge";
import { computeTimeRange, DEFAULT_TIME_RANGE, isTimeRangeKey, TimeRangeKey } from "../utils/timeRanges";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

type AccuracyTrendPoint = { date: string; total: number } & Record<AccuracyLevel, number>;
const ACCURACY_ORDER: AccuracyLevel[] = ["HIGH", "MEDIUM", "LOW"];
const TONE_ORDER: AnswerTone[] = ["TECHNICAL", "EXECUTIVE", "COLLOQUIAL"];
const ACCURACY_COLORS: Record<AccuracyLevel, string> = {
  HIGH: "#b91c1c",
  MEDIUM: "#2563eb",
  LOW: "#f59e0b",
};
const TONE_COLORS: Record<AnswerTone, string> = {
  TECHNICAL: "#0f172a",
  EXECUTIVE: "#0ea5e9",
  COLLOQUIAL: "#f97316",
};

export default function AnalyticsPanel({ areaId, areas }: { areaId: number | null; areas: Area[] }) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKey = (() => {
    const fromUrl = searchParams.get("range");
    if (isTimeRangeKey(fromUrl)) return fromUrl;
    const fromStorage = localStorage.getItem("skh_analytics_range");
    if (isTimeRangeKey(fromStorage)) return fromStorage;
    return DEFAULT_TIME_RANGE;
  })();
  const [rangeKey, setRangeKey] = useState<TimeRangeKey>(initialKey);
  const [overview, setOverview] = useState<any>(null);
  const [topDocs, setTopDocs] = useState<any[]>([]);
  const [topQuestions, setTopQuestions] = useState<any[]>([]);
  const [unanswered, setUnanswered] = useState<any[]>([]);
  const [questionSummary, setQuestionSummary] = useState<any | null>(null);
  const [questionTrends, setQuestionTrends] = useState<{ by_accuracy: any[]; by_tone: any[] }>({
    by_accuracy: [],
    by_tone: [],
  });
  const [accuracyFilter, setAccuracyFilter] = useState<AccuracyLevel | "">("");
  const [toneFilter, setToneFilter] = useState<AnswerTone | "">("");
  const [questionErr, setQuestionErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const areaMap = useMemo(() => new Map<number, Area>(areas.map((a) => [a.id, a])), [areas]);

  const accuracyLabel = (lvl: AccuracyLevel) => {
    if (lvl === "HIGH") return tDash("analytics.accuracy.high");
    if (lvl === "MEDIUM") return tDash("analytics.accuracy.medium");
    return tDash("analytics.accuracy.low");
  };
  const toneLabel = (tone: AnswerTone) => {
    if (tone === "TECHNICAL") return tDash("analytics.tone.technical");
    if (tone === "EXECUTIVE") return tDash("analytics.tone.executive");
    return tDash("analytics.tone.colloquial");
  };

  const accuracyBreakdown = useMemo(
    () =>
      ACCURACY_ORDER.map((lvl) => ({
        key: lvl,
        label: accuracyLabel(lvl),
        count:
          (questionSummary?.by_accuracy ?? []).find((a: any) => a.accuracy_level === lvl)?.count ??
          0,
      })),
    [questionSummary, tDash]
  );

  const toneBreakdown = useMemo(
    () =>
      TONE_ORDER.map((tone) => ({
        key: tone,
        label: toneLabel(tone),
        count:
          (questionSummary?.by_tone ?? []).find((t: any) => t.answer_tone === tone)?.count ?? 0,
      })),
    [questionSummary, tDash]
  );

  const accuracyTrend: AccuracyTrendPoint[] = useMemo(() => {
    const dayMap = new Map<string, Record<AccuracyLevel, number>>();
    (questionTrends?.by_accuracy ?? []).forEach((row: any) => {
      const { date, accuracy_level, count } = row;
      if (!dayMap.has(date)) {
        const init = ACCURACY_ORDER.reduce(
          (acc, lvl) => ({ ...acc, [lvl]: 0 }),
          {} as Record<AccuracyLevel, number>
        );
        dayMap.set(date, init);
      }
      const day = dayMap.get(date)!;
      day[accuracy_level as AccuracyLevel] = count;
      dayMap.set(date, day);
    });

    return Array.from(dayMap.entries())
      .map(([date, counts]) => {
        const total = ACCURACY_ORDER.reduce((sum, lvl) => sum + (counts[lvl] ?? 0), 0);
        return { date, total, ...counts } as AccuracyTrendPoint;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [questionTrends]);

  const topAccuracy = useMemo(
    () => accuracyBreakdown.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), accuracyBreakdown[0]),
    [accuracyBreakdown]
  );
  const topTone = useMemo(
    () => toneBreakdown.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), toneBreakdown[0]),
    [toneBreakdown]
  );
  const questionsTotal = questionSummary?.total_questions ?? 0;
  const activeArea = areaId ? areaMap.get(areaId) : null;
  const computedRange = useMemo(() => computeTimeRange(rangeKey), [rangeKey]);
  const renderArea = (id?: number | null) => {
    if (!id) return "—";
    const area = areaMap.get(id);
    if (!area) return `Area ${id}`;
    return <AreaBadge name={area.name} color={area.color} size="sm" />;
  };

  const loadData = async (key: TimeRangeKey, area: number | null) => {
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
      setTopDocs(d as any[]);
      setTopQuestions(q as any[]);
      setUnanswered(u as any[]);

      if (area) {
        try {
          const [qs, qt] = await Promise.all([
            api.analyticsQuestionsSummary({ area_id: area, range: key, start_date: rng.startIso, end_date: rng.endIso }),
            api.analyticsQuestionsTrends({ area_id: area, range: key, start_date: rng.startIso, end_date: rng.endIso }),
          ]);
          setQuestionSummary(qs);
          setQuestionTrends(qt);
        } catch (qe: any) {
          setQuestionErr(qe.message || tDash("analytics.errors.failedToLoadQuestions"));
        }
      }
    } catch (e: any) {
      setErr(e.message || tDash("analytics.errors.failedToLoadAnalytics"));
    } finally {
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

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("analytics.eyebrow")}</div>
          <div className="h2">{tDash("analytics.title")}</div>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {activeArea && <AreaBadge name={activeArea.name} color={activeArea.color} size="sm" />}
          <div className="stack" style={{ gap: 4 }}>
            <select className="input select" value={rangeKey} onChange={(e) => setRangeKey(e.target.value as TimeRangeKey)}>
              <option value="last_7_days">{tDash("analytics.ranges.last7Days")}</option>
              <option value="last_30_days">{tDash("analytics.ranges.last30Days")}</option>
              <option value="last_90_days">{tDash("analytics.ranges.last90Days")}</option>
              <option value="last_quarter">{tDash("analytics.ranges.lastQuarter")}</option>
              <option value="this_quarter_to_date">{tDash("analytics.ranges.thisQuarterToDate")}</option>
              <option value="last_12_months">{tDash("analytics.ranges.last12Months")}</option>
          </select>
            <div className="muted small" style={{ marginLeft: 2 }}>
              {computedRange.display}
            </div>
          </div>
          <select
            className="input select"
            value={accuracyFilter}
            onChange={(e) => setAccuracyFilter(e.target.value as AccuracyLevel | "")}
          >
            <option value="">{tDash("analytics.filters.allAccuracyLevels")}</option>
            {ACCURACY_ORDER.map((lvl) => (
              <option key={lvl} value={lvl}>{accuracyLabel(lvl)}</option>
            ))}
          </select>
          <select
            className="input select"
            value={toneFilter}
            onChange={(e) => setToneFilter(e.target.value as AnswerTone | "")}
          >
            <option value="">{tDash("analytics.filters.allTones")}</option>
            {TONE_ORDER.map((tone) => (
              <option key={tone} value={tone}>{toneLabel(tone)}</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="errorBanner">{err}</div>}

      <div className="cardBody grid">
        <StatCard label={tDash("analytics.stats.totalQuestions")} value={overview?.total_questions ?? "—"} loading={loading} />
        <StatCard label={tDash("analytics.stats.unanswered")} value={overview?.unanswered_questions ?? "—"} loading={loading} />
        <StatCard label={tDash("analytics.stats.topDocument")} value={overview?.top_document?.title ?? "—"} loading={loading} />
        <StatCard label={tDash("analytics.stats.activeUsers")} value={overview?.active_users ?? "—"} loading={loading} />
      </div>

      <div className="grid twoCols">
        <Table
          title={tDash("analytics.tables.topDocuments.title")}
          loading={loading}
          rows={topDocs}
          headers={[tCommon("labels.title"), tCommon("labels.area"), tDash("analytics.tables.topDocuments.views")]}
          render={(r) => [r.title, renderArea(r.area_id), r.count]}
        />
        <Table
          title={tDash("analytics.tables.topQuestions.title")}
          loading={loading}
          rows={topQuestions}
          headers={[
            tDash("analytics.tables.topQuestions.query"),
            tCommon("labels.area"),
            tDash("analytics.tables.topQuestions.tone"),
            tDash("analytics.tables.topQuestions.accuracy"),
            tDash("analytics.tables.topQuestions.count"),
          ]}
          render={(r) => [
            r.query,
            renderArea(r.area_id),
            <Badge label={toneLabel(r.answer_tone as AnswerTone)} color={TONE_COLORS[r.answer_tone as AnswerTone]} subtle />,
            <Badge label={accuracyLabel(r.accuracy_level as AccuracyLevel)} color={ACCURACY_COLORS[r.accuracy_level as AccuracyLevel]} />,
            r.count,
          ]}
        />
      </div>

      <div className="cardSubsection">
        <div className="sectionHeader" style={{ marginBottom: 8 }}>
          <div>
            <div className="eyebrow">{tDash("analytics.questions.eyebrow")}</div>
            <div className="h3">{tDash("analytics.questions.title")}</div>
          </div>
          {!areaId && <div className="muted">{tDash("analytics.questions.selectArea")}</div>}
        </div>
        {questionErr && <div className="errorBanner">{questionErr}</div>}
        {!areaId ? (
          <div className="muted">{tDash("analytics.questions.chooseArea")}</div>
        ) : questionErr ? (
          <div className="muted">{tDash("analytics.questions.unavailable")}</div>
        ) : (
          <>
            <div className="cardBody grid twoCols">
              <StatCard label={tDash("analytics.questions.questionsInRange")} value={questionsTotal || "0"} loading={loading} />
              <StatCard
                label={tDash("analytics.questions.topAccuracyLevel")}
                value={questionsTotal ? topAccuracy.label : "—"}
                loading={loading}
              />
            </div>
            <div className="grid twoCols">
              <BreakdownCard
                title={tDash("analytics.questions.accuracyBreakdown")}
                items={accuracyBreakdown}
                total={questionsTotal}
                palette={ACCURACY_COLORS}
                loading={loading}
              />
              <BreakdownCard
                title={tDash("analytics.questions.toneBreakdown")}
                items={toneBreakdown}
                total={questionsTotal}
                palette={TONE_COLORS}
                loading={loading}
              />
            </div>
            <AccuracyTrendChart data={accuracyTrend} loading={loading} />
          </>
        )}
      </div>

      <div className="cardSubsection">
        <Table
          title={tDash("analytics.tables.unanswered.title")}
          loading={loading}
          rows={unanswered}
          headers={[
            tDash("analytics.tables.topQuestions.query"),
            tCommon("labels.area"),
            tDash("analytics.tables.topQuestions.tone"),
            tDash("analytics.tables.topQuestions.accuracy"),
            tDash("analytics.tables.unanswered.when"),
          ]}
          render={(r) => [
            r.query,
            renderArea(r.area_id),
            <Badge label={toneLabel(r.answer_tone as AnswerTone)} color={TONE_COLORS[r.answer_tone as AnswerTone]} subtle />,
            <Badge label={accuracyLabel(r.accuracy_level as AccuracyLevel)} color={ACCURACY_COLORS[r.accuracy_level as AccuracyLevel]} />,
            new Date(r.asked_at).toLocaleString(),
          ]}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: React.ReactNode; loading: boolean }) {
  return (
    <div className="statCard">
      <div className="muted">{label}</div>
      {loading ? <div className="skeletonLine short" /> : <div className="statValue">{value}</div>}
    </div>
  );
}

function BreakdownCard({
  title,
  items,
  total,
  palette,
  loading,
}: {
  title: string;
  items: { key: string; label: string; count: number }[];
  total: number;
  palette: Record<string, string>;
  loading: boolean;
}) {
  const { t: tDash } = useTranslation("dashboard");
  return (
    <div className="tableBlock">
      <div className="tableTitle">{title}</div>
      {loading ? (
        <div className="stack">
          <div className="skeletonLine" />
          <div className="skeletonLine short" />
        </div>
      ) : (
        <div className="breakdownList">
          {items.map((item) => {
            const pct = total ? Math.round((item.count / total) * 100) : 0;
            const fillPct = total ? Math.max(6, (item.count / total) * 100) : item.count > 0 ? 100 : 0;
            return (
              <div key={item.key} className="breakdownRow">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <span className="legendDot" style={{ background: palette[item.key] || "#0f172a" }} />
                    <span>{item.label}</span>
                  </div>
                  <div className="muted">
                    {item.count} {total ? `(${pct}%)` : ""}
                  </div>
                </div>
                <div className="barTrack">
                  <div
                    className="barFill"
                    style={{
                      width: `${Math.min(100, fillPct)}%`,
                      background: palette[item.key] || "#0f172a",
                    }}
                  />
                </div>
              </div>
            );
          })}
          {total === 0 && <div className="muted">{tDash("analytics.empty.noDataForRange")}</div>}
        </div>
      )}
    </div>
  );
}

function AccuracyTrendChart({ data, loading }: { data: AccuracyTrendPoint[]; loading: boolean }) {
  const { t: tDash } = useTranslation("dashboard");
  const maxTotal = data.length ? Math.max(...data.map((d) => d.total), 1) : 1;

  return (
    <div className="trendSection">
      <div className="tableTitle">{tDash("analytics.trend.title")}</div>
      {loading ? (
        <div className="trendChart">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="trendColumn">
              <div className="trendStack">
                <div className="skeletonLine" style={{ height: "100%" }} />
              </div>
              <div className="trendLabel">&nbsp;</div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="muted">{tDash("analytics.empty.noQuestionsForRange")}</div>
      ) : (
        <>
          <div className="trendChart">
            {data.map((d) => (
              <div key={d.date} className="trendColumn" title={`${d.date}: ${d.total} questions`}>
                <div className="trendStack">
                  {ACCURACY_ORDER.map((lvl) => (
                    <div
                      key={lvl}
                      className="trendSegment"
                      style={{
                        height: `${(d[lvl] / maxTotal) * 100}%`,
                        background: ACCURACY_COLORS[lvl],
                      }}
                    />
                  ))}
                </div>
                <div className="trendLabel">{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
          <div className="legendRow">
            {ACCURACY_ORDER.map((lvl) => (
              <div key={lvl} className="legendItem">
                <span className="legendDot" style={{ background: ACCURACY_COLORS[lvl] }} />
                <span>{tDash(`analytics.accuracy.${lvl.toLowerCase()}`)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Badge({ label, color, subtle }: { label: string; color: string; subtle?: boolean }) {
  return (
    <span
      className={`pill ${subtle ? "subtle" : ""}`}
      style={{
        background: `${color}14`,
        color,
        borderColor: `${color}33`,
      }}
    >
      {label}
    </span>
  );
}

function Table({
  title,
  headers,
  rows,
  render,
  loading,
}: {
  title: string;
  headers: string[];
  rows: any[];
  render: (row: any) => React.ReactNode[];
  loading: boolean;
}) {
  const { t: tDash } = useTranslation("dashboard");
  return (
    <div className="tableBlock">
      <div className="tableTitle">{title}</div>
      <div className="table">
        <div className="tableHead" style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
          {headers.map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
        <div className="tableBody">
          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="tableRow" style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
                  <div className="skeletonLine" />
                  <div className="skeletonLine short" />
                  <div className="skeletonLine short" />
                </div>
              ))}
            </>
          )}
          {!loading &&
            rows.map((r, idx) => (
              <div key={idx} className="tableRow" style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
                {render(r).map((cell, i) => (
                  <div key={i}>{cell}</div>
                ))}
              </div>
            ))}
          {!loading && rows.length === 0 && <div className="muted">{tDash("analytics.empty.noData")}</div>}
        </div>
      </div>
    </div>
  );
}
