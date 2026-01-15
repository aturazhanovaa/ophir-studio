import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
export default function UploadModal({ areaId, onClose, onUploaded, }) {
    const { t: tCommon } = useTranslation("common");
    const { t: tDash } = useTranslation("dashboard");
    const [title, setTitle] = useState("");
    const [tags, setTags] = useState("");
    const [file, setFile] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const onSubmit = async () => {
        setErr(null);
        if (!title.trim())
            return setErr(tCommon("validation.required.title"));
        if (!file)
            return setErr(tCommon("validation.required.file"));
        setBusy(true);
        try {
            const tagList = tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            await api.uploadDocument(areaId, title.trim(), file, tagList);
            onUploaded();
            onClose();
        }
        catch (e) {
            setErr(e.message);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx("div", { className: "modalOverlay", children: _jsxs("div", { className: "card modalCard", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "h2", children: tDash("documents.uploadModal.title") }), _jsx("div", { className: "muted", children: tDash("documents.uploadModal.subtitle") })] }), _jsx("button", { className: "btn btnGhost", onClick: onClose, children: tCommon("actions.close") })] }), _jsx("label", { className: "fieldLabel", children: tCommon("labels.title") }), _jsx("input", { className: "input", value: title, onChange: (e) => setTitle(e.target.value), placeholder: tDash("documents.uploadModal.titlePlaceholder") }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tDash("documents.uploadModal.tags") }), _jsx("input", { className: "input", value: tags, onChange: (e) => setTags(e.target.value), placeholder: tDash("documents.uploadModal.tagsPlaceholder") }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tCommon("labels.file") }), _jsx("input", { className: "input", type: "file", onChange: (e) => setFile(e.target.files?.[0] ?? null) }), err && _jsx("div", { className: "formError", children: err }), _jsxs("div", { className: "modalActions", children: [_jsx("button", { className: "btn", onClick: onClose, children: tCommon("actions.cancel") }), _jsx("button", { className: "btn btnPrimary", disabled: busy, onClick: onSubmit, children: busy ? tCommon("actions.uploading") : tCommon("actions.upload") })] })] }) }));
}
