import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function parseHex(color) {
    const hex = (color || "").trim();
    const match = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    if (!match)
        return { r: 75, g: 85, b: 99 }; // neutral slate fallback
    const intVal = parseInt(match[1], 16);
    return {
        r: (intVal >> 16) & 255,
        g: (intVal >> 8) & 255,
        b: intVal & 255,
    };
}
export default function AreaBadge({ name, color, size = "md" }) {
    const { r, g, b } = parseHex(color);
    const bg = `rgba(${r}, ${g}, ${b}, 0.12)`;
    const border = `rgba(${r}, ${g}, ${b}, 0.28)`;
    const text = `rgb(${r}, ${g}, ${b})`;
    return (_jsxs("span", { className: `areaBadge areaBadge-${size}`, style: { backgroundColor: bg, borderColor: border, color: text }, children: [_jsx("span", { className: "areaDot", style: { backgroundColor: text } }), _jsx("span", { className: "areaName", children: name })] }));
}
