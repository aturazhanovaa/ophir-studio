import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import Drawer from "./Drawer";
import AreaBadge from "./AreaBadge";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
export default function DocumentDetailsDrawer({ open, docId, areas, canManage, onClose, onUpdated, onDeleted, onAreaSync, intent = "view", }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [title, setTitle] = useState("");
    const [tags, setTags] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [downloadingVersion, setDownloadingVersion] = useState(null);
    const area = useMemo(() => {
        if (!doc)
            return null;
        return areas.find((a) => a.id === doc.area_id) ?? null;
    }, [areas, doc]);
    useEffect(() => {
        if (!open) {
            setDoc(null);
            setError(null);
            setMessage(null);
            setUploadFile(null);
            setConfirmDelete(false);
            return;
        }
        const loadDoc = async () => {
            if (!docId)
                return;
            setLoading(true);
            setError(null);
            try {
                const detail = (await api.getDocument(docId));
                setDoc(detail);
                setTitle(detail.title);
                setTags(detail.tags?.join(", ") || "");
                if (detail.area_id && onAreaSync)
                    onAreaSync(detail.area_id);
            }
            catch (e) {
                setError(e.message || tDash("documentDetails.errors.unableToLoad"));
                setDoc(null);
            }
            finally {
                setLoading(false);
            }
        };
        loadDoc();
    }, [docId, open, onAreaSync]);
    const manageAllowed = canManage(doc?.area_id);
    const handleUpdate = async () => {
        if (!doc)
            return;
        setSaving(true);
        setMessage(null);
        try {
            const tagList = tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            await api.updateDocument(doc.id, { title: title || doc.title, tags: tagList });
            setMessage(tDash("documentDetails.messages.saved"));
            await reloadDoc();
            onUpdated();
        }
        catch (e) {
            setError(e.message || tDash("documentDetails.errors.failedToSave"));
        }
        finally {
            setSaving(false);
        }
    };
    const reloadDoc = async () => {
        if (!docId)
            return;
        try {
            const detail = (await api.getDocument(docId));
            setDoc(detail);
            setTitle(detail.title);
            setTags(detail.tags?.join(", ") || "");
        }
        catch (e) {
            setError(e.message || tDash("documentDetails.errors.unableToLoad"));
        }
    };
    const handleUploadVersion = async (e) => {
        e.preventDefault();
        if (!doc || !uploadFile) {
            setMessage(tDash("documentDetails.errors.chooseFile"));
            return;
        }
        setUploading(true);
        setMessage(null);
        setError(null);
        try {
            await api.uploadVersion(doc.id, uploadFile);
            setUploadFile(null);
            setMessage(tDash("documentDetails.messages.versionUploaded"));
            await reloadDoc();
            onUpdated();
        }
        catch (e) {
            setError(e.message || tDash("documents.errors.uploadFailed"));
        }
        finally {
            setUploading(false);
        }
    };
    const handleDelete = async () => {
        if (!doc)
            return;
        if (!confirmDelete) {
            setConfirmDelete(true);
            setMessage(tDash("documentDetails.messages.confirmDelete"));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await api.deleteDocument(doc.id);
            onDeleted();
            onClose();
        }
        catch (e) {
            setError(e.message || tDash("documentDetails.errors.deleteFailed"));
        }
        finally {
            setSaving(false);
        }
    };
    const handleDownload = async (version) => {
        if (!doc)
            return;
        const target = version ?? doc.latest_version;
        setDownloadingVersion(target);
        setError(null);
        try {
            const { blob, filename } = await api.downloadDocument(doc.id, version);
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        }
        catch (e) {
            setError(e.message || tDash("documentDetails.errors.downloadFailed"));
        }
        finally {
            setDownloadingVersion(null);
        }
    };
    const latestUploaded = doc?.versions[0]?.created_at || doc?.created_at;
    return (_jsxs(Drawer, { open: open, onClose: onClose, title: tDash("documents.drawer.title"), width: 520, children: [loading && (_jsxs("div", { className: "stack", children: [_jsx("div", { className: "skeletonLine", style: { width: "60%" } }), _jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine short" })] })), !loading && !doc && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("documentDetails.empty.notFoundTitle") }), _jsx("div", { className: "emptyText", children: tDash("documents.drawer.notFoundText") })] })), !loading && doc && (_jsxs("div", { className: "drawerContent", children: [_jsxs("div", { className: "stack", children: [_jsx("div", { className: "eyebrow", children: tDash("documentDetails.eyebrow") }), _jsx("div", { className: "h2", children: doc.title }), _jsxs("div", { className: "muted", children: ["v", doc.latest_version, " \u00B7 ", doc.mime_type || tDash("documentDetails.fileFallback")] })] }), _jsxs("div", { className: "metaGrid", children: [_jsxs("div", { children: [_jsx("div", { className: "muted", children: tCommon("labels.area") }), _jsx("div", { children: area ? _jsx(AreaBadge, { name: area.name, color: area.color, size: "sm" }) : "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "muted", children: tDash("documents.drawer.fileName") }), _jsx("div", { children: doc.original_name })] }), _jsxs("div", { children: [_jsx("div", { className: "muted", children: tCommon("labels.created") }), _jsx("div", { children: new Date(doc.created_at).toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { className: "muted", children: tCommon("labels.updated") }), _jsx("div", { children: latestUploaded ? new Date(latestUploaded).toLocaleString() : "—" })] })] }), _jsx("div", { className: "tagRow", children: doc.tags && doc.tags.length ? (doc.tags.map((t) => _jsx("span", { className: "pill", children: t }, t))) : (_jsx("span", { className: "muted", children: tCommon("empty.noTags") })) }), _jsxs("div", { className: "row", style: { justifyContent: "space-between", marginTop: 8 }, children: [_jsxs("div", { className: "row", style: { gap: 6, flexWrap: "wrap" }, children: [_jsx("button", { className: "btn", onClick: () => handleDownload(), children: downloadingVersion === doc.latest_version ? tCommon("actions.downloading") : tCommon("actions.download") }), _jsx("button", { className: "btn", onClick: () => onUpdated(), children: tDash("documents.drawer.refreshList") })] }), manageAllowed && (_jsx("button", { className: "btn btnDangerGhost", onClick: handleDelete, disabled: saving, children: saving && confirmDelete ? tDash("documentDetails.actions.deleting") : tCommon("actions.delete") }))] }), manageAllowed && (_jsxs("div", { className: "drawerSection", id: "rename", children: [_jsxs("div", { className: "sectionHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "h3", children: tDash("documents.drawer.metadata.title") }), _jsx("div", { className: "muted", children: tDash("documents.drawer.metadata.subtitle") })] }), intent === "rename" && _jsx("span", { className: "pill subtle", children: tDash("documents.drawer.fromRowMenu") })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.title") }), _jsx("input", { className: "input", value: title, onChange: (e) => setTitle(e.target.value) })] }), _jsxs("div", { className: "formGroup", children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.tagsCommaSeparated") }), _jsx("input", { className: "input", value: tags, onChange: (e) => setTags(e.target.value) })] }), _jsx("button", { className: "btn btnPrimary", onClick: handleUpdate, disabled: saving, children: saving ? tCommon("actions.saving") : tCommon("actions.saveChanges") })] })), manageAllowed && (_jsxs("div", { className: "drawerSection", id: "versions", children: [_jsxs("div", { className: "sectionHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "h3", children: tDash("documentDetails.versioning.title") }), _jsx("div", { className: "muted", children: tDash("documents.drawer.versioning.subtitle") })] }), intent === "version" && _jsx("span", { className: "pill subtle", children: tDash("documents.drawer.fromRowMenu") })] }), _jsxs("form", { className: "row", onSubmit: handleUploadVersion, style: { alignItems: "flex-end", gap: 8 }, children: [_jsxs("div", { className: "formGroup", style: { flex: 1 }, children: [_jsx("label", { className: "fieldLabel", children: tCommon("labels.file") }), _jsx("input", { className: "input", type: "file", onChange: (e) => setUploadFile(e.target.files?.[0] ?? null) })] }), _jsx("button", { className: "btn btnPrimary", type: "submit", disabled: uploading, children: uploading ? tCommon("actions.uploading") : tDash("documentDetails.versioning.uploadVersion") })] })] })), _jsxs("div", { className: "drawerSection", children: [_jsx("div", { className: "sectionHeader", children: _jsxs("div", { children: [_jsx("div", { className: "h3", children: tDash("documentDetails.versions.eyebrow") }), _jsx("div", { className: "muted", children: tDash("documents.drawer.versions.subtitle") })] }) }), _jsxs("div", { className: "table tight", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "80px 1fr 1fr auto" }, children: [_jsx("div", { children: tCommon("labels.version") }), _jsx("div", { children: tDash("documentDetails.versions.uploaded") }), _jsx("div", { children: tCommon("labels.file") }), _jsx("div", {})] }), _jsxs("div", { className: "tableBody", children: [doc.versions.map((v) => (_jsxs("div", { className: "tableRow", style: { gridTemplateColumns: "80px 1fr 1fr auto" }, children: [_jsxs("div", { children: ["v", v.version] }), _jsx("div", { children: new Date(v.created_at).toLocaleString() }), _jsx("div", { className: "muted", children: v.original_name }), _jsx("div", { style: { textAlign: "right" }, children: _jsx("button", { className: "btn btnGhost", onClick: () => handleDownload(v.version), disabled: downloadingVersion === v.version, children: downloadingVersion === v.version ? tCommon("actions.downloading") : tCommon("actions.download") }) })] }, v.id))), doc.versions.length === 0 && _jsx("div", { className: "muted", children: tDash("documentDetails.versions.none") })] })] })] }), message && _jsx("div", { className: "muted", style: { marginTop: 8 }, children: message }), error && _jsx("div", { className: "formError", children: error })] }))] }));
}
