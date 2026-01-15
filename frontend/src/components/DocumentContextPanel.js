import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../api/client";
import AreaBadge from "./AreaBadge";
import { useTranslation } from "react-i18next";
export default function DocumentContextPanel({ doc, loading, canManage, areaKey, areaId, areaColor, onUploadVersion, onRename, onDelete, onBack, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [downloadErr, setDownloadErr] = useState(null);
    const [downloadingVersion, setDownloadingVersion] = useState(null);
    const handleDownload = async (version) => {
        if (!doc)
            return;
        setDownloadErr(null);
        const v = version ?? doc.latest_version;
        setDownloadingVersion(v);
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
        return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "skeletonLine", style: { width: "50%" } }), _jsx("div", { className: "spacer-sm" }), _jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine short" })] }));
    }
    if (!doc) {
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("documents.detailPanel.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("documents.contextPanel.empty.text") })] }) }));
    }
    const latestUploaded = doc.versions[0]?.created_at || doc.created_at;
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("documentDetails.eyebrow") }), _jsx("div", { className: "h2", children: doc.title }), _jsxs("div", { className: "muted", children: ["v", doc.latest_version, " \u00B7 ", doc.mime_type || tDash("documentDetails.fileFallback")] })] }), _jsx("div", { className: "row", children: _jsx("button", { className: "btn", onClick: onBack, children: tCommon("actions.back") }) })] }), _jsx("div", { className: "tagRow", children: doc.tags && doc.tags.length ? (doc.tags.map((t) => _jsx("span", { className: "pill", children: t }, t))) : (_jsx("span", { className: "muted", children: tCommon("empty.noTags") })) }), _jsx("div", { className: "cardSubsection", children: _jsxs("div", { className: "grid twoCols", children: [_jsxs("div", { children: [_jsx("div", { className: "muted", children: tCommon("labels.area") }), areaKey ? _jsx(AreaBadge, { name: areaKey, color: areaColor, size: "sm" }) : _jsx("div", { children: "\u2014" })] }), _jsxs("div", { children: [_jsx("div", { className: "muted", children: tCommon("labels.file") }), _jsx("div", { children: doc.original_name })] }), _jsxs("div", { children: [_jsx("div", { className: "muted", children: tCommon("labels.created") }), _jsx("div", { children: new Date(doc.created_at).toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { className: "muted", children: tCommon("labels.updated") }), _jsx("div", { children: latestUploaded ? new Date(latestUploaded).toLocaleString() : "—" })] })] }) }), _jsxs("div", { className: "cardSubsection row", style: { gap: 10, flexWrap: "wrap" }, children: [_jsx("button", { className: "btn", onClick: () => handleDownload(), children: downloadingVersion === doc.latest_version ? tCommon("actions.downloading") : tCommon("actions.download") }), canManage && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn", onClick: onRename, children: tDash("documents.actions.rename") }), _jsx("button", { className: "btn", onClick: onUploadVersion, children: tDash("documentDetails.versioning.uploadVersion") }), _jsx("button", { className: "btn btnDangerGhost", onClick: onDelete, children: tCommon("actions.delete") })] }))] }), downloadErr && _jsx("div", { className: "formError", children: downloadErr }), _jsx("div", { className: "divider" }), _jsx("div", { className: "h3", children: tDash("documentDetails.versions.eyebrow") }), _jsxs("div", { className: "table", children: [_jsxs("div", { className: "tableHead", children: [_jsx("div", { children: tCommon("labels.version") }), _jsx("div", { children: tDash("documentDetails.versions.uploaded") }), _jsx("div", { children: tCommon("labels.file") }), _jsx("div", {})] }), _jsxs("div", { className: "tableBody", children: [doc.versions.map((v) => (_jsxs("div", { className: "tableRow", children: [_jsxs("div", { children: ["v", v.version] }), _jsx("div", { children: new Date(v.created_at).toLocaleString() }), _jsx("div", { className: "muted", children: v.original_name }), _jsx("div", { style: { textAlign: "right" }, children: _jsx("button", { className: "btn btnGhost", onClick: () => handleDownload(v.version), disabled: downloadingVersion === v.version, children: downloadingVersion === v.version ? tCommon("actions.downloading") : tCommon("actions.download") }) })] }, v.id))), doc.versions.length === 0 && (_jsx("div", { className: "emptyState", children: _jsx("div", { className: "emptyText", children: tDash("documentDetails.versions.none") }) })), downloadErr && _jsx("div", { className: "formError", children: downloadErr })] })] })] }));
}
