"use client";

import React, { useEffect, useState } from "react";

export type Option = { value: string; label: string };

/**
 * Checkbox multi-select dropdown shared by the replications-database pages.
 * An empty `selected` set means "all options" — the first checkbox row resets
 * to that state.
 */
export function MultiSelectDropdown({
  id,
  label,
  options,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  options: Option[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allSelected = selected.size === 0;
  const buttonLabel = allSelected
    ? label
    : selected.size === 1
    ? Array.from(selected)[0]
    : `${selected.size} types selected`;

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  function selectAll() { onChange(new Set()); }

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          "w-full h-10 rounded-md border bg-background px-3 text-sm text-left",
          "flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary",
          // Outline in the foreground colour while a subset is selected, matching
          // the active-filter treatment on the surrounding dropdowns.
          allSelected ? "border-border" : "border-foreground",
        ].join(" ")}
      >
        <span className={allSelected ? "opacity-60" : ""}>{buttonLabel}</span>
        <svg className="w-4 h-4 opacity-50 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-56 rounded-md border border-border bg-background shadow-lg max-h-72 overflow-y-auto">
          <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted cursor-pointer border-b border-border">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={selectAll}
              className="shrink-0"
            />
            <span className="font-medium">All types</span>
          </label>
          {options.filter(o => o.value).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
                className="shrink-0"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
