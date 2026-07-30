"use client";

import { useMemo, useState } from "react";
import { CountryFilterCard, countriesOf } from "@/components/CountryFilterCard";
import { ResultsTable, TrialRow } from "./ResultsTable";
import { DoseResponseScatter } from "./DoseResponseScatter";
import { formatLabel } from "./utils";

/** Count rows by a string key, blanks bucketed under `emptyKey`. */
function countBy(rows: TrialRow[], key: (r: TrialRow) => string, emptyKey = "unknown") {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) || emptyKey;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Risk-of-bias vocabularies differ by design: RCTs are assessed with RoB 2
 *  (low / some concerns / high) and observational studies with ROBINS-I
 *  (low / moderate / serious / critical). Both land in one column, so the order
 *  below interleaves them worst-last and the card carries a note — otherwise a
 *  reader sees "serious/critical" dominating and concludes the literature is
 *  uniformly terrible, when it is mostly just observational. */
const ROB_ORDER = [
  "low", "some_concerns", "moderate", "high", "serious", "critical", "no_information",
];
function robRank(v: string): number {
  const i = ROB_ORDER.indexOf(v);
  return i === -1 ? ROB_ORDER.length : i;
}

export function ResultsClientWrapper({ trials }: { trials: TrialRow[] }) {
  // Empty set == no filter (all shown). Seeding from the data would make
  // "clear all" and "nothing selected" indistinguishable.
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(new Set());
  const [selectedRobs, setSelectedRobs] = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());

  const designFilter = (t: TrialRow) =>
    selectedDesigns.size === 0 || selectedDesigns.has(t.design || "unknown");
  const robFilter = (t: TrialRow) =>
    selectedRobs.size === 0 || selectedRobs.has(t.rob || "unknown");
  const countryFilter = (t: TrialRow) =>
    selectedCountries.size === 0 || t.countries.some((c) => selectedCountries.has(c));

  // Cross-filtering: each panel's counts come from the base filtered by the
  // OTHER panels, so every number on screen stays consistent with every other.
  const exceptDesign = useMemo(
    () => trials.filter((t) => robFilter(t) && countryFilter(t)),
    [trials, selectedRobs, selectedCountries],
  );
  const exceptRob = useMemo(
    () => trials.filter((t) => designFilter(t) && countryFilter(t)),
    [trials, selectedDesigns, selectedCountries],
  );
  const exceptCountry = useMemo(
    () => trials.filter((t) => designFilter(t) && robFilter(t)),
    [trials, selectedDesigns, selectedRobs],
  );
  const filtered = useMemo(
    () => trials.filter((t) => designFilter(t) && robFilter(t) && countryFilter(t)),
    [trials, selectedDesigns, selectedRobs, selectedCountries],
  );

  const designCounts = useMemo(() => countBy(exceptDesign, (r) => r.design), [exceptDesign]);
  const robCounts = useMemo(() => countBy(exceptRob, (r) => r.rob), [exceptRob]);
  const allDesigns = useMemo(
    () => Object.keys(countBy(trials, (r) => r.design)).sort((a, b) =>
      (countBy(trials, (r) => r.design)[b] ?? 0) - (countBy(trials, (r) => r.design)[a] ?? 0)),
    [trials],
  );
  const allRobs = useMemo(
    () => Object.keys(countBy(trials, (r) => r.rob)).sort((a, b) => robRank(a) - robRank(b)),
    [trials],
  );

  const toggle = (set: Set<string>, k: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setter(next);
  };

  const cardBg = (active: boolean) =>
    `mb-4 border border-border rounded-lg p-3 ${
      active ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"
    }`;

  const withDose = filtered.filter((t) => t.serumMmolL != null && t.effVal != null).length;

  return (
    <div>
      {/* Study design */}
      <div className={cardBg(selectedDesigns.size > 0)}>
        <div className="mb-2 flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Filter by study design</span>
          <span className="text-xs text-foreground/50">
            ({filtered.length} of {exceptDesign.length} studies selected)
          </span>
          {selectedDesigns.size > 0 && (
            <button
              onClick={() => setSelectedDesigns(new Set())}
              className="ml-auto text-xs text-blue-600 hover:text-blue-700"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {allDesigns.map((d) => {
            const checked = selectedDesigns.size === 0 || selectedDesigns.has(d);
            return (
              <label
                key={d}
                className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${
                  checked ? "" : "bg-foreground/[0.08]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(selectedDesigns, d, setSelectedDesigns)}
                  className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
                />
                <span className={checked ? "text-foreground" : "text-foreground/50"}>
                  {formatLabel(d)}
                </span>
                <span className="text-xs text-foreground/40">({designCounts[d] ?? 0})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Risk of bias */}
      <div className={cardBg(selectedRobs.size > 0)}>
        <div className="mb-2 flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Filter by risk of bias</span>
          <span className="text-xs text-foreground/50">
            ({filtered.length} of {exceptRob.length} studies selected)
          </span>
          {selectedRobs.size > 0 && (
            <button
              onClick={() => setSelectedRobs(new Set())}
              className="ml-auto text-xs text-blue-600 hover:text-blue-700"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {allRobs.map((v) => {
            const checked = selectedRobs.size === 0 || selectedRobs.has(v);
            return (
              <label
                key={v}
                className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${
                  checked ? "" : "bg-foreground/[0.08]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(selectedRobs, v, setSelectedRobs)}
                  className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
                />
                <span className={checked ? "text-foreground" : "text-foreground/50"}>
                  {formatLabel(v)}
                </span>
                <span className="text-xs text-foreground/40">({robCounts[v] ?? 0})</span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-foreground/45">
          Two instruments share this column: randomized trials are rated with RoB 2
          (<em>low / some concerns / high</em>) and observational studies with
          ROBINS-I (<em>low / moderate / serious / critical</em>). &ldquo;Serious&rdquo;
          and &ldquo;critical&rdquo; are ordinary ratings for uncontrolled designs, not
          a sign that a study is unusually flawed.
        </p>
      </div>

      {/* Country — always last, per house convention */}
      <CountryFilterCard
        allCountries={countriesOf(exceptCountry)}
        allCountryNames={[...new Set(trials.flatMap((t) => t.countries))]}
        selectedCountries={selectedCountries}
        onSelectionChange={setSelectedCountries}
        filteredCount={filtered.length}
        totalCount={exceptCountry.length}
      />

      <DoseResponseScatter rows={filtered} />

      {withDose < 3 && (
        <p className="mb-4 text-xs text-foreground/45">
          Too few studies in the current selection report both an achieved serum
          level and a weight result to plot a dose–response.
        </p>
      )}

      <ResultsTable rows={filtered} />
    </div>
  );
}
