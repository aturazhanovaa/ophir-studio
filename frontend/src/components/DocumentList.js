import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import AreaBadge from "./AreaBadge";
import { useTranslation } from "react-i18next";
export default function DocumentList({ docs, loading, activeId, onOpen, filters, onFiltersChange, onAction, canManage, activeArea, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const [tagInput, setTagInput] = useState(filters.tags.join(", "));
    const [search, setSearch] = useState(filters.search);
    const [openMenu, setOpenMenu] = useState(null);
    useEffect(() => {
        setSearch(filters.search);
        setTagInput(filters.tags.join(", "));
    }, [filters.search, filters.tags.join(",")]);
    useEffect(() => {
        const t = setTimeout(() => {
            onFiltersChange({ ...filters, search });
        }, 350);
        return () => clearTimeout(t);
    }, [search]);
    useEffect(() => {
        const handler = () => setOpenMenu(null);
        window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, []);
    const renderMenu = (doc) => (_jsxs("div", { className: "menu", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { className: "menuItem", onClick: () => onAction?.(doc, "rename"), children: tDash("documents.actions.rename") }), _jsx("button", { className: "menuItem", onClick: () => onAction?.(doc, "version"), children: tDash("documents.actions.newVersion") }), _jsx("button", { className: "menuItem danger", onClick: () => onAction?.(doc, "delete"), children: tCommon("actions.delete") })] }));
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("documents.toolbar.eyebrow") }), _jsxs("div", { className: "row", style: { alignItems: "center", gap: 8 }, children: [_jsx("div", { className: "h2", children: tDash("documents.list.allFilesForArea") }), activeArea && _jsx(AreaBadge, { name: activeArea.name, color: activeArea.color, size: "sm" })] })] }) }), _jsxs("div", { className: "filterBar", children: [_jsx("input", { className: "input", placeholder: tDash("documents.list.searchByTitle"), value: search, onChange: (e) => setSearch(e.target.value) }), _jsx("input", { className: "input", placeholder: tDash("documents.list.filterByTag"), value: tagInput, onChange: (e) => {
                            setTagInput(e.target.value);
                            onFiltersChange({
                                ...filters,
                                tags: e.target.value
                                    .split(",")
                                    .map((t) => t.trim())
                                    .filter(Boolean),
                            });
                        } }), _jsxs("select", { className: "input select", value: filters.sort, onChange: (e) => onFiltersChange({ ...filters, sort: e.target.value }), children: [_jsx("option", { value: "latest", children: tDash("documents.list.sort.latest") }), _jsx("option", { value: "oldest", children: tDash("documents.list.sort.oldest") }), _jsx("option", { value: "usage", children: tDash("documents.list.sort.mostUsed") })] })] }), _jsxs("div", { className: "table docsTable", children: [_jsxs("div", { className: "tableHead", style: { gridTemplateColumns: "1.6fr 1.4fr 0.8fr 0.7fr 80px" }, children: [_jsx("div", { children: tCommon("labels.title") }), _jsx("div", { children: tDash("documents.list.columns.tags") }), _jsx("div", { children: tCommon("labels.updated") }), _jsx("div", { children: tDash("documents.list.columns.versions") }), _jsx("div", { style: { textAlign: "right" }, children: tDash("documents.list.columns.actions") })] }), _jsxs("div", { className: "tableBody", children: [loading &&
                                [1, 2, 3].map((i) => (_jsxs("div", { className: "tableRow skeletonRow", style: { gridTemplateColumns: "1.6fr 1.4fr 0.8fr 0.7fr 80px" }, children: [_jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine" }), _jsx("div", { className: "skeletonLine short" }), _jsx("div", { className: "skeletonLine short" }), _jsx("div", {})] }, i))), !loading && docs.length === 0 && (_jsxs("div", { className: "emptyState", children: [_jsx("div", { className: "emptyTitle", children: tDash("documents.list.empty.title") }), _jsx("div", { className: "emptyText", children: tDash("documents.list.empty.text") })] })), !loading &&
                                docs.map((d) => {
                                    const active = activeId === d.id;
                                    const lastUpdated = d.created_at ? new Date(d.created_at).toLocaleDateString() : "—";
                                    return (_jsxs("div", { className: `tableRow docRow ${active ? "docRowActive" : ""}`, style: { gridTemplateColumns: "1.6fr 1.4fr 0.8fr 0.7fr 80px" }, onClick: () => onOpen(d.id), children: [_jsxs("div", { className: "docTitle", children: [_jsx("div", { style: { fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }, children: d.title }), d.deleted_at && _jsx("span", { className: "pill warning", children: tDash("documents.list.deleted") }), _jsx("div", { className: "muted small", children: d.original_name })] }), _jsx("div", { className: "tagRow clamp", children: d.tags && d.tags.length ? (d.tags.map((t) => (_jsx("span", { className: "pill subtle", children: t }, t)))) : (_jsx("span", { className: "muted", children: tCommon("empty.noTags") })) }), _jsx("div", { className: "muted", children: lastUpdated }), _jsxs("div", { children: ["v", d.latest_version] }), _jsx("div", { style: { textAlign: "right", position: "relative" }, onClick: (e) => e.stopPropagation(), children: canManage ? (_jsxs("div", { className: "menuWrapper", children: [_jsx("button", { className: "btn iconButton", onClick: (e) => {
                                                                e.stopPropagation();
                                                                setOpenMenu(openMenu === d.id ? null : d.id);
                                                            }, children: "\u22EE" }), openMenu === d.id && renderMenu(d)] })) : (_jsx("button", { className: "btn btnGhost", onClick: () => onAction?.(d, "open"), children: tCommon("actions.open") })) })] }, d.id));
                                })] })] })] }));
}
