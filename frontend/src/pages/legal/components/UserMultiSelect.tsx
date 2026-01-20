import React, { useMemo, useState } from "react";

export type UserRef = { id: number; email: string; full_name: string; role: string };

export default function UserMultiSelect({
  label,
  users,
  value,
  onChange,
  disabled,
  placeholder,
  emptyText,
  noMatchesText,
}: {
  label: string;
  users: UserRef[];
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  noMatchesText?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const term = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        (u.full_name || "").toLowerCase().includes(term) ||
        (u.role || "").toLowerCase().includes(term)
    );
  }, [users, query]);

  const toggle = (id: number) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const selectedLabels = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u]));
    return value
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((u) => u!.full_name || u!.email);
  }, [users, value]);

  return (
    <div className="formGroup" style={{ gridColumn: "1 / -1" }}>
      <label className="fieldLabel">{label}</label>
      {selectedLabels.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {selectedLabels.map((name) => (
            <span key={name} className="pill subtle">
              {name}
            </span>
          ))}
        </div>
      )}

      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />

      <div className="checkGrid" style={{ marginTop: 10 }}>
        {filtered.map((u) => (
          <label key={u.id} className="checkRow">
            <input type="checkbox" checked={selected.has(u.id)} disabled={disabled} onChange={() => toggle(u.id)} />
            <span>{u.full_name || u.email}</span>
            <span className="muted">{u.role}</span>
          </label>
        ))}
        {!filtered.length && (
          <div className="muted">{users.length ? noMatchesText : emptyText}</div>
        )}
      </div>
    </div>
  );
}
