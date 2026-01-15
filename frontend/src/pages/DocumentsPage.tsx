import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import DocumentList, { Doc } from "../components/DocumentList";
import { Area } from "../components/Sidebar";
import DocumentDetailsDrawer from "../components/DocumentDetailsDrawer";
import AreaBadge from "../components/AreaBadge";
import { useTranslation } from "react-i18next";

type Filters = {
  search: string;
  tags: string[];
  sort: "latest" | "oldest" | "usage";
};

export default function DocumentsPage({
  areaId,
  canManage,
  areas,
  onSelectArea,
}: {
  areaId: number | null;
  canManage: (areaId?: number | null) => boolean;
  areas: Area[];
  onSelectArea: (id: number | null) => void;
}) {
  const { t: tDash } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({ search: "", tags: [], sort: "latest" });
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailIntent, setDetailIntent] = useState<"view" | "rename" | "version">("view");

  const activeArea = useMemo(() => areas.find((a) => a.id === areaId) ?? null, [areas, areaId]);
  const canManageCurrent = canManage(areaId);

  const sortDocs = (items: Doc[], sort: Filters["sort"]) => {
    const sorted = [...items];
    if (sort === "oldest") {
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sort === "usage") {
      sorted.sort((a, b) => b.latest_version - a.latest_version || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  };

  const loadDocs = async () => {
    if (!areaId) {
      setDocs([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = (await api.listDocuments({
        areaId,
        q: filters.search,
        tags: filters.tags,
        sort: "latest",
      })) as Doc[];
      setDocs(sortDocs(res, filters.sort));
    } catch (e: any) {
      setError(e.message || tDash("documents.errors.failedToLoad"));
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [areaId, filters.search, filters.tags.join(","), filters.sort]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaId) {
      setFormMessage(tDash("documents.errors.selectAreaFirst"));
      return;
    }
    if (!uploadTitle || !uploadFile) {
      setFormMessage(tDash("documents.errors.titleAndFileRequired"));
      return;
    }
    setFormMessage(null);
    setError(null);
    setUploading(true);
    try {
      const tags = uploadTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api.uploadDocument(areaId, uploadTitle, uploadFile, tags);
      setUploadTitle("");
      setUploadTags("");
      setUploadFile(null);
      await loadDocs();
      setFormMessage(tDash("documents.messages.uploaded"));
      setUploaderOpen(false);
    } catch (e: any) {
      setError(e.message || tDash("documents.errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const openDetail = (id: number, intent: "view" | "rename" | "version" = "view") => {
    setSelectedId(id);
    setDetailIntent(intent);
    setDetailOpen(true);
  };

  const onRowAction = (doc: Doc, action: "open" | "rename" | "version" | "delete") => {
    if (action === "open") {
      openDetail(doc.id, "view");
      return;
    }
    openDetail(doc.id, action === "rename" ? "rename" : action === "version" ? "version" : "view");
  };

  if (!areaId) {
    return (
      <div className="card">
        <div className="emptyState">
          <div className="emptyTitle">{tDash("documents.empty.pickAreaTitle")}</div>
          <div className="emptyText">{tDash("documents.empty.pickAreaText")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageStack">
      <div className="card toolbarCard">
        <div className="toolbarLeft">
          <div className="eyebrow">{tDash("documents.toolbar.eyebrow")}</div>
          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <div className="h2" style={{ marginBottom: 2 }}>{activeArea?.name || tCommon("labels.area")}</div>
            {activeArea && <AreaBadge name={activeArea.name} color={activeArea.color} size="sm" />}
          </div>
          <div className="muted">{tDash("documents.toolbar.subtitle")}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {canManageCurrent && (
            <button className="btn btnPrimary" onClick={() => setUploaderOpen((v) => !v)}>
              {uploaderOpen ? tDash("documents.toolbar.closeUpload") : tCommon("actions.upload")}
            </button>
          )}
        </div>
      </div>

      {uploaderOpen && canManageCurrent && (
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="eyebrow">{tDash("documents.upload.eyebrow")}</div>
              <div className="h2">{tDash("documents.upload.title")}</div>
            </div>
          </div>
          <form className="grid twoCols uploadGrid" onSubmit={handleUpload}>
            <div className="formGroup">
              <label className="fieldLabel">{tCommon("labels.title")}</label>
              <input
                className="input"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder={tCommon("placeholders.documentTitle")}
              />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">{tCommon("labels.tagsCommaSeparated")}</label>
              <input
                className="input"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder={tCommon("placeholders.tagsExample")}
              />
            </div>
            <div className="formGroup">
              <label className="fieldLabel">{tCommon("labels.file")}</label>
              <input className="input" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="formGroup uploadActions">
              <button className="btn btnPrimary" type="submit" disabled={uploading}>
                {uploading ? tCommon("actions.uploading") : tCommon("actions.upload")}
              </button>
              {formMessage && <span className="muted">{formMessage}</span>}
            </div>
          </form>
        </div>
      )}

      {error && <div className="errorBanner">{error}</div>}

      <DocumentList
        docs={docs}
        loading={loading}
        activeId={selectedId}
        onOpen={(id) => openDetail(id)}
        filters={filters}
        onFiltersChange={setFilters}
        onAction={onRowAction}
        canManage={canManageCurrent}
        activeArea={activeArea}
      />

      <DocumentDetailsDrawer
        open={detailOpen}
        docId={selectedId}
        areas={areas}
        canManage={canManage}
        onClose={() => setDetailOpen(false)}
        onUpdated={loadDocs}
        onDeleted={loadDocs}
        onAreaSync={onSelectArea}
        intent={detailIntent}
      />
    </div>
  );
}
