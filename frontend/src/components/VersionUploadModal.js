import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
export default function VersionUploadModal({ docId, title, onClose, onUploaded, }) {
    const { t: tCommon } = useTranslation("common");
    const { t: tDash } = useTranslation("dashboard");
    const [file, setFile] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const onSubmit = async () => {
        setErr(null);
        if (!file)
            return setErr(tCommon("validation.required.file"));
        setBusy(true);
        try {
            await api.uploadVersion(docId, file);
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
    return (_jsx("div", { className: "modalOverlay", children: _jsxs("div", { className: "card modalCard", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "h2", children: tDash("documentDetails.versioning.title") }), _jsx("div", { className: "muted", children: title })] }), _jsx("button", { className: "btn btnGhost", onClick: onClose, children: tCommon("actions.close") })] }), _jsx("label", { className: "fieldLabel", children: tCommon("labels.file") }), _jsx("input", { className: "input", type: "file", onChange: (e) => setFile(e.target.files?.[0] ?? null) }), err && _jsx("div", { className: "formError", children: err }), _jsxs("div", { className: "modalActions", children: [_jsx("button", { className: "btn", onClick: onClose, children: tCommon("actions.cancel") }), _jsx("button", { className: "btn btnPrimary", disabled: busy, onClick: onSubmit, children: busy ? tCommon("actions.uploading") : tCommon("actions.upload") })] })] }) }));
}
