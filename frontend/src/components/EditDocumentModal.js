import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
export default function EditDocumentModal({ doc, onClose, onSave, }) {
    const { t: tCommon } = useTranslation("common");
    const { t: tDash } = useTranslation("dashboard");
    const [title, setTitle] = useState(doc.title);
    const [tags, setTags] = useState(doc.tags.join(", "));
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        setTitle(doc.title);
        setTags(doc.tags.join(", "));
    }, [doc]);
    const onSubmit = async () => {
        setErr(null);
        if (!title.trim())
            return setErr(tCommon("validation.required.title"));
        setBusy(true);
        try {
            const tagList = tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            await onSave({ title: title.trim(), tags: tagList });
            onClose();
        }
        catch (e) {
            setErr(e.message || tDash("documentDetails.errors.failedToSave"));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx("div", { className: "modalOverlay", children: _jsxs("div", { className: "card modalCard", children: [_jsxs("div", { className: "cardHeader", children: [_jsxs("div", { children: [_jsx("div", { className: "h2", children: tDash("documents.editModal.title") }), _jsx("div", { className: "muted", children: doc.original_name })] }), _jsx("button", { className: "btn btnGhost", onClick: onClose, children: tCommon("actions.close") })] }), _jsx("label", { className: "fieldLabel", children: tCommon("labels.title") }), _jsx("input", { className: "input", value: title, onChange: (e) => setTitle(e.target.value) }), _jsx("div", { className: "spacer-sm" }), _jsx("label", { className: "fieldLabel", children: tDash("documents.editModal.tags") }), _jsx("input", { className: "input", value: tags, onChange: (e) => setTags(e.target.value) }), err && _jsx("div", { className: "formError", children: err }), _jsxs("div", { className: "modalActions", children: [_jsx("button", { className: "btn", onClick: onClose, children: tCommon("actions.cancel") }), _jsx("button", { className: "btn btnPrimary", disabled: busy, onClick: onSubmit, children: busy ? tCommon("actions.saving") : tCommon("actions.save") })] })] }) }));
}
