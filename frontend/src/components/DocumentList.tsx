import React, { useEffect, useState } from "react";
import { DocumentSummary } from "../api/client";
import { Area } from "./Sidebar";
import AreaBadge from "./AreaBadge";
import { useTranslation } from "react-i18next";

export type Doc = DocumentSummary;

type Filters = {
  search: string;
  tags: string[];
  sort: "latest" | "oldest" | "usage";
};

type DocAction = "open" | "rename" | "version" | "delete";

export default function DocumentList({
  docs,
  loading,
  activeId,
  onOpen,
  filters,
  onFiltersChange,
  onAction,
  canManage,
  activeArea,
}: {
  docs: Doc[];
  loading: boolean;
  activeId: number | null;
  onOpen: (id: number) => void;
  filters: Filters;
  onFiltersChange: (next: Filters) => void;
  onAction?: (doc: Doc, action: DocAction) => void;
  canManage: boolean;
  activeArea?: Area | null;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [tagInput, setTagInput] = useState(filters.tags.join(", "));
  const [search, setSearch] = useState(filters.search);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  useEffect(() => {
    setSearch(filters.search);
    setTagInput(filters.tags.join(", "));
  }, [filters.search, filters.tags.join(",")]);

  useEffect(() => {
    const t = setTimeout(() => {
      onFiltersChange({ ...filters, search });
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handler = () => setOpenMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const renderMenu = (doc: Doc) => (
    <div className="menu" onClick={(e) => e.stopPropagation()}>
      <button className="menuItem" onClick={() => onAction?.(doc, "rename")}>{tDash("documents.actions.rename")}</button>
      <button className="menuItem" onClick={() => onAction?.(doc, "version")}>{tDash("documents.actions.newVersion")}</button>
      <button className="menuItem danger" onClick={() => onAction?.(doc, "delete")}>{tCommon("actions.delete")}</button>
    </div>
  );

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">{tDash("documents.toolbar.eyebrow")}</div>
          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <div className="h2">{tDash("documents.list.allFilesForArea")}</div>
            {activeArea && <AreaBadge name={activeArea.name} color={activeArea.color} size="sm" />}
          </div>
        </div>
      </div>

      <div className="filterBar">
        <input
          className="input"
          placeholder={tDash("documents.list.searchByTitle")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          className="input"
          placeholder={tDash("documents.list.filterByTag")}
          value={tagInput}
          onChange={(e) => {
            setTagInput(e.target.value);
            onFiltersChange({
              ...filters,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            });
          }}
        />
        <select
          className="input select"
          value={filters.sort}
          onChange={(e) => onFiltersChange({ ...filters, sort: e.target.value as Filters["sort"] })}
        >
          <option value="latest">{tDash("documents.list.sort.latest")}</option>
          <option value="oldest">{tDash("documents.list.sort.oldest")}</option>
          <option value="usage">{tDash("documents.list.sort.mostUsed")}</option>
        </select>
      </div>

      <div className="table docsTable">
        <div className="tableHead" style={{ gridTemplateColumns: "1.6fr 1.4fr 0.8fr 0.7fr 80px" }}>
          <div>{tCommon("labels.title")}</div>
          <div>{tDash("documents.list.columns.tags")}</div>
          <div>{tCommon("labels.updated")}</div>
          <div>{tDash("documents.list.columns.versions")}</div>
          <div style={{ textAlign: "right" }}>{tDash("documents.list.columns.actions")}</div>
        </div>
        <div className="tableBody">
          {loading &&
            [1, 2, 3].map((i) => (
              <div key={i} className="tableRow skeletonRow" style={{ gridTemplateColumns: "1.6fr 1.4fr 0.8fr 0.7fr 80px" }}>
                <div className="skeletonLine" />
                <div className="skeletonLine" />
                <div className="skeletonLine short" />
                <div className="skeletonLine short" />
                <div />
              </div>
            ))}

          {!loading && docs.length === 0 && (
            <div className="emptyState">
              <div className="emptyTitle">{tDash("documents.list.empty.title")}</div>
              <div className="emptyText">{tDash("documents.list.empty.text")}</div>
            </div>
          )}

          {!loading &&
            docs.map((d) => {
              const active = activeId === d.id;
              const lastUpdated = d.created_at ? new Date(d.created_at).toLocaleDateString() : "—";
              return (
                <div
                  key={d.id}
                  className={`tableRow docRow ${active ? "docRowActive" : ""}`}
                  style={{ gridTemplateColumns: "1.6fr 1.4fr 0.8fr 0.7fr 80px" }}
                  onClick={() => onOpen(d.id)}
                >
                  <div className="docTitle">
                    <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{d.title}</div>
                    {d.deleted_at && <span className="pill warning">{tDash("documents.list.deleted")}</span>}
                    <div className="muted small">{d.original_name}</div>
                  </div>
                  <div className="tagRow clamp">
                    {d.tags && d.tags.length ? (
                      d.tags.map((t) => (
                        <span key={t} className="pill subtle">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="muted">{tCommon("empty.noTags")}</span>
                    )}
                  </div>
                  <div className="muted">{lastUpdated}</div>
                  <div>v{d.latest_version}</div>
                  <div style={{ textAlign: "right", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                    {canManage ? (
                      <div className="menuWrapper">
                        <button
                          className="btn iconButton"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(openMenu === d.id ? null : d.id);
                          }}
                        >
                          ⋮
                        </button>
                        {openMenu === d.id && renderMenu(d)}
                      </div>
                    ) : (
                      <button className="btn btnGhost" onClick={() => onAction?.(d, "open")}>
                        {tCommon("actions.open")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
