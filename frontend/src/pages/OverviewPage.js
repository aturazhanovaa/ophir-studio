import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
export default function OverviewPage({ areas, accessMap, isSuperAdmin, onOpenAccess, onOpenDocuments, onOpenAsk, loading, }) {
    const { t: tDash } = useTranslation("dashboard");
    const { t: tCommon } = useTranslation("common");
    const accessCount = useMemo(() => Object.keys(accessMap).length, [accessMap]);
    return (_jsxs("div", { className: "pageStack", children: [_jsxs("div", { className: "grid twoCols", children: [_jsx(StatCard, { label: tDash("overview.areasAvailable"), value: loading ? tCommon("loading.loading") : String(areas.length), helper: !loading && areas.length === 0 ? tDash("overview.noAreasCreated") : undefined }), _jsx(StatCard, { label: tDash("overview.areasYouCanAccess"), value: loading ? tCommon("loading.loading") : String(accessCount), helper: !loading && accessCount === 0 ? tDash("overview.requestAccessToBegin") : undefined })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "cardHeader", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: tDash("overview.quickActions") }), _jsx("div", { className: "h3", children: tDash("overview.jumpToWorkflows") })] }) }), _jsxs("div", { className: "grid twoCols", children: [_jsx(ActionCard, { title: tDash("overview.documentsTitle"), description: tDash("overview.documentsDesc"), onClick: onOpenDocuments }), _jsx(ActionCard, { title: tDash("overview.askAiTitle"), description: tDash("overview.askAiDesc"), onClick: onOpenAsk }), !isSuperAdmin && (_jsx(ActionCard, { title: tDash("overview.accessCenterTitle"), description: tDash("overview.accessCenterDesc"), onClick: onOpenAccess }))] })] })] }));
}
function StatCard({ label, value, helper }) {
    return (_jsxs("div", { className: "statCard", children: [_jsx("div", { className: "muted", children: label }), _jsx("div", { className: "statValue", children: value }), helper && _jsx("div", { className: "muted small", children: helper })] }));
}
function ActionCard({ title, description, onClick }) {
    const { t: tCommon } = useTranslation("common");
    return (_jsxs("button", { className: "card quickAction cardHover", onClick: onClick, type: "button", children: [_jsx("div", { className: "h3", children: title }), _jsx("div", { className: "muted", children: description }), _jsx("div", { className: "actionRow", children: _jsx("span", { className: "pill subtle", children: tCommon("actions.open") }) })] }));
}
