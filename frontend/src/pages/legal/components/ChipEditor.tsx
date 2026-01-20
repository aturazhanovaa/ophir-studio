import React, { useMemo, useState } from "react";

function normalizeKey(value: string) {
  return value.trim().replace(/\s+/g, "_");
}

export default function ChipEditor({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
  removeAriaLabel,
  addPrefix,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  removeAriaLabel?: (key: string) => string;
  addPrefix?: string;
}) {
  const [input, setInput] = useState("");

  const normalized = useMemo(() => value.map(normalizeKey).filter(Boolean), [value]);
  const setNormalized = (next: string[]) => {
    const uniq: string[] = [];
    const seen = new Set<string>();
    next.map(normalizeKey).filter(Boolean).forEach((k) => {
      if (seen.has(k)) return;
      seen.add(k);
      uniq.push(k);
    });
    onChange(uniq);
  };

  const add = (raw: string) => {
    const key = normalizeKey(raw);
    if (!key) return;
    setNormalized([...normalized, key]);
    setInput("");
  };

  const remove = (key: string) => {
    setNormalized(normalized.filter((k) => k !== key));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (!input.trim()) return;
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && !input && normalized.length) {
      remove(normalized[normalized.length - 1]);
    }
  };

  const availableSuggestions = useMemo(() => {
    const s = (suggestions || []).map(normalizeKey).filter(Boolean);
    const seen = new Set(normalized);
    return s.filter((k) => !seen.has(k)).slice(0, 20);
  }, [suggestions, normalized]);

  return (
    <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
      <label className="fieldLabel">{label}</label>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {normalized.map((k) => (
          <span key={k} className="pill subtle" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {k}
            <button
              className="btn btnGhost"
              onClick={() => remove(k)}
              type="button"
              aria-label={removeAriaLabel ? removeAriaLabel(k) : k}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {availableSuggestions.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {availableSuggestions.map((s) => (
            <button key={s} className="pill subtle" onClick={() => add(s)} type="button">
              {addPrefix ?? "+"} {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
