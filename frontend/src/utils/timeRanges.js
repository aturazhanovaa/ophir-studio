export const DEFAULT_TIME_RANGE = "last_30_days";
function pad2(n) {
    return String(n).padStart(2, "0");
}
export function toIsoWithOffset(dt) {
    const y = dt.getFullYear();
    const m = pad2(dt.getMonth() + 1);
    const d = pad2(dt.getDate());
    const hh = pad2(dt.getHours());
    const mm = pad2(dt.getMinutes());
    const ss = pad2(dt.getSeconds());
    const offsetMin = -dt.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMin);
    const oh = pad2(Math.floor(abs / 60));
    const om = pad2(abs % 60);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}${sign}${oh}:${om}`;
}
function startOfDay(dt) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
}
function endOfDay(dt) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
}
function formatShortDate(dt) {
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function quarterIndex(monthZeroBased) {
    return Math.floor(monthZeroBased / 3);
}
function quarterStart(year, qIndex) {
    return new Date(year, qIndex * 3, 1, 0, 0, 0, 0);
}
function quarterEnd(year, qIndex) {
    return new Date(year, qIndex * 3 + 3, 0, 23, 59, 59, 999);
}
function lastQuarterRange(now) {
    const q = quarterIndex(now.getMonth());
    const year = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevQ = q === 0 ? 3 : q - 1;
    return { start: quarterStart(year, prevQ), end: quarterEnd(year, prevQ) };
}
function thisQuarterToDateRange(now) {
    const q = quarterIndex(now.getMonth());
    return { start: quarterStart(now.getFullYear(), q), end: endOfDay(now) };
}
function lastNDaysRange(now, days) {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
    const end = endOfDay(now);
    return { start, end };
}
function last12MonthsRange(now) {
    const start = startOfDay(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
    const end = endOfDay(now);
    return { start, end };
}
export function computeTimeRange(key, now = new Date()) {
    let label = "Last 30 days";
    let start;
    let end;
    if (key === "last_7_days") {
        label = "Last 7 days";
        ({ start, end } = lastNDaysRange(now, 7));
    }
    else if (key === "last_30_days") {
        label = "Last 30 days";
        ({ start, end } = lastNDaysRange(now, 30));
    }
    else if (key === "last_90_days") {
        label = "Last 90 days";
        ({ start, end } = lastNDaysRange(now, 90));
    }
    else if (key === "last_quarter") {
        label = "Last quarter";
        ({ start, end } = lastQuarterRange(now));
    }
    else if (key === "this_quarter_to_date") {
        label = "This quarter to date";
        ({ start, end } = thisQuarterToDateRange(now));
    }
    else {
        label = "Last 12 months";
        ({ start, end } = last12MonthsRange(now));
    }
    const display = `${formatShortDate(start)} – ${formatShortDate(end)}`;
    return {
        key,
        label,
        start,
        end,
        startIso: toIsoWithOffset(start),
        endIso: toIsoWithOffset(end),
        display,
    };
}
export function isTimeRangeKey(value) {
    if (!value)
        return false;
    return (value === "last_7_days" ||
        value === "last_30_days" ||
        value === "last_90_days" ||
        value === "last_quarter" ||
        value === "this_quarter_to_date" ||
        value === "last_12_months");
}
