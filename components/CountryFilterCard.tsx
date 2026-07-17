"use client";

/**
 * Shared "Filter by country" card for birds-eye-review dashboards.
 *
 * STANDARD DASHBOARD FEATURE — always the LAST filter card before the charts
 * (hence the hardcoded mb-8; the other filter cards use mb-4).
 *
 * A checkbox per country (empty selection set = no filter, displayed as all
 * checked) plus an optional world map, revealed by the underlined "(show map)"
 * toggle in the header. Clicking countries on the map syncs the checkboxes.
 *
 * The dashboard keeps ownership of the selection Set — pass the state value and
 * its setter. Selection semantics:
 *   - Checkbox from the all-checked state: unchecking one country means
 *     "exclude just this one" = include all OTHERS (seeded from allCountryNames).
 *   - Map click from the all-checked state: narrow to JUST that country.
 *   - Re-completing the full set collapses back to the empty set (no filter).
 */

import { useMemo, useState } from "react";
import { CountryMap, type CountryCount } from "@/components/CountryMap";

export type { CountryCount };

/** Distinct-trial count per (canonical) country, for the checkbox list + map. */
export function countriesOf(rows: { countries: string[] }[]): CountryCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const c of new Set(r.countries)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

export function CountryFilterCard({
  allCountries,
  allCountryNames,
  selectedCountries,
  onSelectionChange,
  filteredCount,
  totalCount,
}: {
  /** Per-country trial counts from the base filtered by every OTHER filter,
   *  so all countries stay visible while one is selected. */
  allCountries: CountryCount[];
  /** Full country universe from ALL trials — the seed for "exclude one" and
   *  the reference for collapsing a completed set back to "no filter". */
  allCountryNames: string[];
  /** Empty set = no filter (all pass), displayed as all boxes checked. */
  selectedCountries: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  /** filteredTrials.length — for the "(X of Y trials selected)" line. */
  filteredCount: number;
  /** countryChartBase.length — the Y in "(X of Y trials selected)". */
  totalCount: number;
}) {
  const [showMap, setShowMap] = useState(false);

  const active = selectedCountries.size > 0;

  // Actual selection only — never the "displayed as checked" list, or an empty
  // set would highlight every polygon and destroy the choropleth.
  const selectedList = useMemo(
    () => [...selectedCountries].sort((a, b) => a.localeCompare(b)),
    [selectedCountries]
  );

  const toggleCheckbox = (c: string) => {
    if (selectedCountries.size === 0) {
      // All-checked display: unchecking one = include all OTHERS.
      onSelectionChange(new Set(allCountryNames.filter((cc) => cc !== c)));
      return;
    }
    const next = new Set(selectedCountries);
    if (next.has(c)) {
      next.delete(c);
    } else {
      next.add(c);
      if (allCountryNames.length > 0 && allCountryNames.every((n) => next.has(n))) {
        onSelectionChange(new Set());
        return;
      }
    }
    onSelectionChange(next);
  };

  const toggleMapCountry = (c: string) => {
    if (selectedCountries.size === 0) {
      // No filter yet: a map click narrows to just this country.
      onSelectionChange(new Set([c]));
      return;
    }
    const next = new Set(selectedCountries);
    if (next.has(c)) {
      next.delete(c);
    } else {
      next.add(c);
      if (allCountryNames.length > 0 && allCountryNames.every((n) => next.has(n))) {
        onSelectionChange(new Set());
        return;
      }
    }
    onSelectionChange(next);
  };

  return (
    <div
      className={`mb-8 border border-border rounded-lg p-3 ${
        active ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium text-foreground">
          Filter by country{" "}
          <button
            onClick={() => setShowMap((v) => !v)}
            className="font-normal underline text-foreground/70 hover:text-foreground"
          >
            ({showMap ? "hide map" : "show map"})
          </button>
        </span>
        <span className="text-xs text-foreground/50">
          ({filteredCount} of {totalCount} trials selected)
        </span>
        <button
          onClick={() => onSelectionChange(new Set())}
          className="text-xs text-blue-600 hover:text-blue-700 ml-auto"
        >
          Select all
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-h-40 overflow-y-auto pr-1">
        {allCountries.map(({ country, count }) => {
          const checked = !active || selectedCountries.has(country);
          return (
            <label
              key={country}
              className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${checked ? "" : "bg-foreground/[0.08]"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleCheckbox(country)}
                className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
              />
              <span className={checked ? "text-foreground" : "text-foreground/50"}>
                {country}
              </span>
              <span className="text-xs text-foreground/40">({count})</span>
            </label>
          );
        })}
      </div>
      {showMap && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-foreground/50 mb-2">
            Click a country to filter the dashboard — the checkboxes above update to match.
            Click a highlighted country to deselect it.
          </p>
          <CountryMap
            allCountries={allCountries}
            selectedCountries={selectedList}
            onCountryClick={toggleMapCountry}
          />
        </div>
      )}
    </div>
  );
}
