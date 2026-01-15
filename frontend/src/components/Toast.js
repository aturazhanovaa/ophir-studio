import { jsx as _jsx } from "react/jsx-runtime";
export default function Toast({ toast }) {
    if (!toast)
        return null;
    return _jsx("div", { className: `toast ${toast.tone ?? "info"}`, children: toast.message });
}
