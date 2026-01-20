import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export default function UserMultiSelect({ label, users, value, onChange, disabled, placeholder, emptyText, noMatchesText, }) {
    const [query, setQuery] = useState("");
    const selected = useMemo(() => new Set(value), [value]);
    const filtered = useMemo(() => {
        if (!query.trim())
            return users;
        const term = query.trim().toLowerCase();
        return users.filter((u) => u.email.toLowerCase().includes(term) ||
            (u.full_name || "").toLowerCase().includes(term) ||
            (u.role || "").toLowerCase().includes(term));
    }, [users, query]);
    const toggle = (id) => {
        if (disabled)
            return;
        const next = new Set(selected);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        onChange(Array.from(next));
    };
    const selectedLabels = useMemo(() => {
        const map = new Map(users.map((u) => [u.id, u]));
        return value
            .map((id) => map.get(id))
            .filter(Boolean)
            .map((u) => u.full_name || u.email);
    }, [users, value]);
    return (_jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: label }), selectedLabels.length > 0 && (_jsx("div", { className: "row", style: { gap: 8, flexWrap: "wrap", marginBottom: 8 }, children: selectedLabels.map((name) => (_jsx("span", { className: "pill subtle", children: name }, name))) })), _jsx("input", { className: "input", value: query, onChange: (e) => setQuery(e.target.value), disabled: disabled, placeholder: placeholder }), _jsxs("div", { className: "checkGrid", style: { marginTop: 10 }, children: [filtered.map((u) => (_jsxs("label", { className: "checkRow", children: [_jsx("input", { type: "checkbox", checked: selected.has(u.id), disabled: disabled, onChange: () => toggle(u.id) }), _jsx("span", { children: u.full_name || u.email }), _jsx("span", { className: "muted", children: u.role })] }, u.id))), !filtered.length && (_jsx("div", { className: "muted", children: users.length ? noMatchesText : emptyText }))] })] }));
}
