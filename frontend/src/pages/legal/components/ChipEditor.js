import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
function normalizeKey(value) {
    return value.trim().replace(/\s+/g, "_");
}
export default function ChipEditor({ label, value, onChange, placeholder, suggestions, removeAriaLabel, addPrefix, }) {
    const [input, setInput] = useState("");
    const normalized = useMemo(() => value.map(normalizeKey).filter(Boolean), [value]);
    const setNormalized = (next) => {
        const uniq = [];
        const seen = new Set();
        next.map(normalizeKey).filter(Boolean).forEach((k) => {
            if (seen.has(k))
                return;
            seen.add(k);
            uniq.push(k);
        });
        onChange(uniq);
    };
    const add = (raw) => {
        const key = normalizeKey(raw);
        if (!key)
            return;
        setNormalized([...normalized, key]);
        setInput("");
    };
    const remove = (key) => {
        setNormalized(normalized.filter((k) => k !== key));
    };
    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
            if (!input.trim())
                return;
            e.preventDefault();
            add(input);
        }
        else if (e.key === "Backspace" && !input && normalized.length) {
            remove(normalized[normalized.length - 1]);
        }
    };
    const availableSuggestions = useMemo(() => {
        const s = (suggestions || []).map(normalizeKey).filter(Boolean);
        const seen = new Set(normalized);
        return s.filter((k) => !seen.has(k)).slice(0, 20);
    }, [suggestions, normalized]);
    return (_jsxs("div", { className: "formGroup", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { className: "fieldLabel", children: label }), _jsx("div", { className: "row", style: { gap: 8, flexWrap: "wrap", marginBottom: 8 }, children: normalized.map((k) => (_jsxs("span", { className: "pill subtle", style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [k, _jsx("button", { className: "btn btnGhost", onClick: () => remove(k), type: "button", "aria-label": removeAriaLabel ? removeAriaLabel(k) : k, children: "\u00D7" })] }, k))) }), _jsx("input", { className: "input", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: placeholder }), availableSuggestions.length > 0 && (_jsx("div", { className: "row", style: { gap: 8, flexWrap: "wrap", marginTop: 10 }, children: availableSuggestions.map((s) => (_jsxs("button", { className: "pill subtle", onClick: () => add(s), type: "button", children: [addPrefix ?? "+", " ", s] }, s))) }))] }));
}
