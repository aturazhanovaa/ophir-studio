import { useEffect, useMemo, useState } from "react";
const DEFAULT_PREFS = { accuracy: "MEDIUM", tone: "EXECUTIVE" };
export function useAskPreferences(userId) {
    const storageKey = useMemo(() => `skh_copilot_pref_${userId ?? "anon"}`, [userId]);
    const [prefs, setPrefs] = useState(DEFAULT_PREFS);
    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                const normalizeAccuracy = (val) => {
                    if (typeof val !== "string")
                        return DEFAULT_PREFS.accuracy;
                    const key = val.toLowerCase();
                    if (key === "high" || key === "strict")
                        return "HIGH";
                    if (key === "medium" || key === "balanced")
                        return "MEDIUM";
                    if (key === "low" || key === "creative")
                        return "LOW";
                    return DEFAULT_PREFS.accuracy;
                };
                const normalizeTone = (val) => {
                    if (typeof val !== "string")
                        return DEFAULT_PREFS.tone;
                    const key = val.toLowerCase();
                    if (key === "c_executive" || key === "executive")
                        return "EXECUTIVE";
                    if (key === "colloquial")
                        return "COLLOQUIAL";
                    if (key === "technical")
                        return "TECHNICAL";
                    return DEFAULT_PREFS.tone;
                };
                setPrefs({
                    accuracy: normalizeAccuracy(parsed.accuracy),
                    tone: normalizeTone(parsed.tone),
                });
            }
            else {
                setPrefs(DEFAULT_PREFS);
            }
        }
        catch {
            setPrefs(DEFAULT_PREFS);
        }
    }, [storageKey]);
    const update = (updates) => {
        setPrefs((prev) => {
            const next = { ...prev, ...updates };
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
            }
            catch {
                // ignore storage errors
            }
            return next;
        });
    };
    return {
        accuracy: prefs.accuracy,
        tone: prefs.tone,
        setAccuracy: (accuracy) => update({ accuracy }),
        setTone: (tone) => update({ tone }),
    };
}
