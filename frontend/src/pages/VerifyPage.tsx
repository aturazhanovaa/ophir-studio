import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, api, ContentItem, KnowledgeBaseArea, Tag, TagCategory } from "../api/client";
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
  const [areas, setAreas] = useState<KnowledgeBaseArea[]>([]);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterTest, setFilterTest] = useState<{ status: string; message: string }>({
    status: "idle",
    message: "",
  });
  const [retrievalTest, setRetrievalTest] = useState<{ status: string; message: string; warnings?: string[] }>({
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
        setAreas(areaRes as KnowledgeBaseArea[]);
        setCategories(categoryRes as TagCategory[]);
        setTags(tagRes as Tag[]);
        setLoadError(null);
      } catch (err: any) {
        setLoadError(err.message || tDash("verify.errors.failedToLoadData"));
      } finally {
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

  const retailTag = useMemo(
    () => tags.find((tag) => tag.category?.key === "sector" && tag.key === "retail"),
    [tags]
  );
  const lossTag = useMemo(
    () => tags.find((tag) => tag.category?.key === "use_case" && tag.key === "loss-prevention"),
    [tags]
  );

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
      })) as ContentItem[];
      const pass =
        results.length > 0 &&
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
    } catch (err: any) {
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
      const hasLowWarning = (result.warnings || []).some((w: string) => w.includes("LOW CONFIDENCE"));
      const pass = hasSources && !hasLowWarning && result.confidence_label !== "LOW";
      setRetrievalTest({
        status: pass ? "pass" : "fail",
        message: pass
          ? tDash("verify.retrievalTest.pass", { count: result.sources.length, confidence: result.confidence_label })
          : tDash("verify.retrievalTest.fail"),
        warnings: result.warnings || [],
      });
    } catch (err: any) {
      setRetrievalTest({ status: "fail", message: err.message || tDash("verify.retrievalTest.failed"), warnings: [] });
    }
  };

  return (
    <div className="pageStack">
      {loadError && (
        <div className="card errorBanner">
          <div>{loadError}</div>
          <div className="muted small">{tDash("verify.backendExpectedAt", { url: API_BASE })}</div>
        </div>
      )}
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="eyebrow">{tDash("verify.hero.eyebrow")}</div>
            <div className="h3">{tDash("verify.hero.title")}</div>
          </div>
          {loading ? <span className="pill subtle">{tDash("verify.status.loading")}</span> : <span className="pill success">{tDash("verify.status.ready")}</span>}
        </div>
        <div className="muted">
          {tDash("verify.hero.subtitle")}
        </div>
      </div>

      <div className="grid twoCols">
        <div className="card">
          <div className="cardHeader">
            <div className="h3">{tDash("verify.areasCheck.title")}</div>
            <span className={`pill ${areaStatus.ok ? "success" : "warning"}`}>
              {areaStatus.ok ? tDash("verify.result.pass") : tDash("verify.result.fail")}
            </span>
          </div>
          <div className="tagRow">
            {REQUIRED_AREAS.map((name) => (
              <span key={name} className={`pill ${areas.some((a) => a.name === name) ? "success" : "warning"}`}>
                {name}
              </span>
            ))}
          </div>
          {!areaStatus.ok && <div className="muted small">{tDash("verify.missing", { items: areaStatus.missing.join(", ") })}</div>}
        </div>

        <div className="card">
          <div className="cardHeader">
            <div className="h3">{tDash("verify.tagCategoriesCheck.title")}</div>
            <span className={`pill ${categoryStatus.ok ? "success" : "warning"}`}>
              {categoryStatus.ok ? tDash("verify.result.pass") : tDash("verify.result.fail")}
            </span>
          </div>
          <div className="tagRow">
            {REQUIRED_TAG_KEYS.map((key) => (
              <span key={key} className={`pill ${categories.some((c) => c.key === key) ? "success" : "warning"}`}>
                {key}
              </span>
            ))}
          </div>
          {!categoryStatus.ok && <div className="muted small">{tDash("verify.missing", { items: categoryStatus.missing.join(", ") })}</div>}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div className="h3">{tDash("verify.behaviorTests.title")}</div>
        </div>
        <div className="grid twoCols">
          <div className="card" style={{ boxShadow: "none" }}>
            <div className="h3">{tDash("verify.filterBehavior.title")}</div>
            <div className="muted small">sector=Retail AND use_case=Loss prevention</div>
            <div className="actionRow">
              <button className="btn btnSecondary" onClick={runFilterTest} type="button">
                {tDash("verify.filterBehavior.run")}
              </button>
              {filterTest.status !== "idle" && (
                <span className={`pill ${filterTest.status === "pass" ? "success" : filterTest.status === "running" ? "info" : "warning"}`}>
                  {filterTest.status.toUpperCase()}
                </span>
              )}
            </div>
            {filterTest.message && <div className="muted small">{filterTest.message}</div>}
          </div>

          <div className="card" style={{ boxShadow: "none" }}>
            <div className="h3">{tDash("verify.retrievalPriority.title")}</div>
            <div className="muted small">{tDash("verify.retrievalPriority.subtitle")}</div>
            <div className="actionRow">
              <button className="btn btnSecondary" onClick={runRetrievalTest} type="button">
                {tDash("verify.retrievalPriority.run")}
              </button>
              {retrievalTest.status !== "idle" && (
                <span className={`pill ${retrievalTest.status === "pass" ? "success" : retrievalTest.status === "running" ? "info" : "warning"}`}>
                  {retrievalTest.status.toUpperCase()}
                </span>
              )}
            </div>
            {retrievalTest.message && <div className="muted small">{retrievalTest.message}</div>}
            {retrievalTest.warnings && retrievalTest.warnings.length > 0 && (
              <div className="tagRow" style={{ marginTop: 8 }}>
                {retrievalTest.warnings.map((w) => (
                  <span key={w} className="pill warning">
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div className="h3">{tDash("verify.apiCurl.title")}</div>
        </div>
        <pre className="answerText">{`# Areas
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/kb/areas

# Tag categories
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/tags/categories

# Tagged content items
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8000/kb/content?status=APPROVED&tag_ids=${retailTag?.id || "RETAIL_ID"},${lossTag?.id || "LOSS_ID"}"`}</pre>
      </div>
    </div>
  );
}
