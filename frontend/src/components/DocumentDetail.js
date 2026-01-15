import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
export default function DocumentDetailPanel({ doc, loading, canManage, onUploadVersion, onRename, onDelete, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [downloadErr, setDownloadErr] = useState(null);
    const [downloadingVersion, setDownloadingVersion] = useState(null);
    const handleDownload = async (version) => {
        if (!doc)
            return;
        setDownloadErr(null);
        setDownloadingVersion(version);
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
            setDownloadErr(e?.message || tDash("documentDetails.errors.downloadFailed"));
        }
        finally {
            setDownloadingVersion(null);
        }
    };
    if (loading) {
        return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsx("div", { className: "skeletonLine", style: { width: 200 } }) }), _jsxs("div", { className: "cardBody", children: [_jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine short" }), _jsx("div", { className: "skeletonLine" })] })] }));
    }
    if (!doc) {
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("documents.detailPanel.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("documents.detailPanel.empty.text") })] }) }));
    }
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("documents.detailPanel.eyebrow") }), _jsx("div", { className: "h2", children: doc.title }), _jsxs("div", { className: "muted", children: ["v", doc.latest_version, " \u00B7 ", doc.original_name, " \u00B7 ", doc.mime_type || tDash("documentDetails.fileFallback")] })] }), canManage && (_jsxs("div", { className: "row", children: [_jsx("button", { className: "btn", onClick: onRename, children: tCommon("actions.edit") }), _jsx("button", { className: "btn", onClick: onUploadVersion, children: tDash("documentDetails.versioning.uploadVersion") }), _jsx("button", { className: "btn btnDangerGhost", onClick: onDelete, children: tCommon("actions.delete") })] }))] }), _jsx("div", { className: "tagRow", children: doc.tags && doc.tags.length ? (doc.tags.map((t) => _jsx("span", { className: "pill", children: t }, t))) : (_jsx("span", { className: "muted", children: tCommon("empty.noTags") })) }), _jsx("div", { className: "divider" }), _jsx("div", { className: "h3", children: tDash("documentDetails.versions.eyebrow") }), _jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", children: [_jsx("div", { children: tCommon("labels.version") }), _jsx("div", { children: tDash("documentDetails.versions.uploaded") }), _jsx("div", { children: tCommon("labels.file") }), _jsx("div", {})] }), _jsxs("div", { className: "tableBody", children: [doc.versions.map((v) => (_jsxs("div", { className: "tableRow", children: [_jsxs("div", { children: ["v", v.version] }), _jsx("div", { children: new Date(v.created_at).toLocaleString() }), _jsx("div", { className: "muted", children: v.original_name }), _jsx("div", { style: { textAlign: "right" }, children: _jsx("button", { className: "btn btnGhost", onClick: () => handleDownload(v.version), disabled: downloadingVersion === v.version, children: downloadingVersion === v.version ? tCommon("actions.downloading") : tCommon("actions.download") }) })] }, v.id))), doc.versions.length === 0 && (_jsx("div", { className: "emptyState", children: _jsx("div", { className: "emptyText", children: tDash("documentDetails.versions.none") }) })), downloadErr && _jsx("div", { className: "formError", children: downloadErr })] })] })] }));
}
