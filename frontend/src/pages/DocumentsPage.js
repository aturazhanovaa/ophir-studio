import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import DocumentList from "../components/DocumentList";
import DocumentDetailsDrawer from "../components/DocumentDetailsDrawer";
import AreaBadge from "../components/AreaBadge";
import { useTranslation } from "react-i18next";
export default function DocumentsPage({ areaId, canManage, areas, onSelectArea, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ search: "", tags: [], sort: "latest" });
    const [uploaderOpen, setUploaderOpen] = useState(false);
    const [uploadTitle, setUploadTitle] = useState("");
    const [uploadTags, setUploadTags] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [formMessage, setFormMessage] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailIntent, setDetailIntent] = useState("view");
    const activeArea = useMemo(() => areas.find((a) => a.id === areaId) ?? null, [areas, areaId]);
    const canManageCurrent = canManage(areaId);
    const sortDocs = (items, sort) => {
        const sorted = [...items];
        if (sort === "oldest") {
            sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
        else if (sort === "usage") {
            sorted.sort((a, b) => b.latest_version - a.latest_version || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        else {
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
            }));
            setDocs(sortDocs(res, filters.sort));
        }
        catch (e) {
            setError(e.message || tDash("documents.errors.failedToLoad"));
            setDocs([]);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadDocs();
    }, [areaId, filters.search, filters.tags.join(","), filters.sort]);
    const handleUpload = async (e) => {
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
        }
        catch (e) {
            setError(e.message || tDash("documents.errors.uploadFailed"));
        }
        finally {
            setUploading(false);
        }
    };
    const openDetail = (id, intent = "view") => {
        setSelectedId(id);
        setDetailIntent(intent);
        setDetailOpen(true);
    };
    const onRowAction = (doc, action) => {
        if (action === "open") {
            openDetail(doc.id, "view");
            return;
        }
        openDetail(doc.id, action === "rename" ? "rename" : action === "version" ? "version" : "view");
    };
    if (!areaId) {
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("documents.empty.pickAreaTitle") }), _jsx("div", { className: "emptyText", children: tDash("documents.empty.pickAreaText") })] }) }));
    }
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "card toolbarCard", children: [_jsxs("div", { className: "toolbarLeft", children: [_jsx("div", { className: "eyebrow", children: tDash("documents.toolbar.eyebrow") }), _jsxs("div", { className: "row", style: { alignItems: "center", gap: 8 }, children: [_jsx("div", { className: "h2", style: { marginBottom: 2 }, children: activeArea?.name || tCommon("labels.area") }), activeArea && _jsx(AreaBadge, { name: activeArea.name, color: activeArea.color, size: "sm" })] }), _jsx("div", { className: "muted", children: tDash("documents.toolbar.subtitle") })] }), _jsx("div", { className: "row", style: { gap: 10 }, children: canManageCurrent && (_jsx("button", { className: "btn btnPrimary", onClick: () => setUploaderOpen((v) => !v), children: uploaderOpen ? tDash("documents.toolbar.closeUpload") : tCommon("actions.upload") })) })] }), uploaderOpen && canManageCurrent && (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("documents.upload.eyebrow") }), _jsx("div", { className: "h2", children: tDash("documents.upload.title") })] }) }), _jsxs("form", { className: "grid twoCols uploadGrid", onSubmit: handleUpload, children: [_jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.title") }), _jsx("input", { className: "input", value: uploadTitle, onChange: (e) => setUploadTitle(e.target.value), placeholder: tCommon("placeholders.documentTitle") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.tagsCommaSeparated") }), _jsx("input", { className: "input", value: uploadTags, onChange: (e) => setUploadTags(e.target.value), placeholder: tCommon("placeholders.tagsExample") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.file") }), _jsx("input", { className: "input", type: "file", onChange: (e) => setUploadFile(e.target.files?.[0] ?? null) })] }), _jsxs("div", { className: "formGroup uploadActions", children: [_jsx("button", { className: "btn btnPrimary", type: "submit", disabled: uploading, children: uploading ? tCommon("actions.uploading") : tCommon("actions.upload") }), formMessage && _jsx("span", { className: "muted", children: formMessage })] })] })] })), error && _jsx("div", { className: "errorBanner", children: error }), _jsx(DocumentList, { docs: docs, loading: loading, activeId: selectedId, onOpen: (id) => openDetail(id), filters: filters, onFiltersChange: setFilters, onAction: onRowAction, canManage: canManageCurrent, activeArea: activeArea }), _jsx(DocumentDetailsDrawer, { open: detailOpen, docId: selectedId, areas: areas, canManage: canManage, onClose: () => setDetailOpen(false), onUpdated: loadDocs, onDeleted: loadDocs, onAreaSync: onSelectArea, intent: detailIntent })] }));
}
