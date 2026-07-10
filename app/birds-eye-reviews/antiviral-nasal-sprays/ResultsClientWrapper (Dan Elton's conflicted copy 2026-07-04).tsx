"use client";

import { useState, useMemo } from "react";
import { Segment, HoverTrial } from "./screening/BreakdownChart";
import { TrialRectList } from "@/components/TrialRectList";
import { ResultsTable, TrialRow } from "./ResultsTable";
import { YearChart } from "./YearChart";
/** Distinct-trial count per (canonical) country, for the country filter card. */
function countriesOf(rows: TrialRow[]): { country: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const c of new Set(r.countries)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

const DESIGN_LABELS: Record<string, string> = {
  RCT: "RCT",
  "cluster-randomized": "Cluster-randomized",
  crossover: "Crossover",
  factorial: "Factorial",
  "quasi-experimental": "Quasi-experimental",
  "non-randomized": "Non-randomized",
  observational: "Observational",
  unknown: "Unspecified",
};
const formatDesign = (s: string) =>
  DESIGN_LABELS[s] ??
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bRct\b/g, "RCT");

const designKey = (r: TrialRow) => r.design || "unknown";

// Delivery device (spray vs drops vs ...), derived in page.tsx from the
// intervention arm's extracted `route`. Drives the top-level delivery filter.
const DELIVERY_LABELS: Record<string, string> = {
  spray: "Nasal spray",
  drops: "Nasal drops",
  irrigation: "Nasal irrigation",
  swab: "Nasal swab / application",
  other: "Other / unspecified",
};
const DELIVERY_ORDER = ["spray", "drops", "irrigation", "swab", "other"];
const deliveryKey = (t: TrialRow) => t.deliveryMethod || "other";

/** Pretty ingredient label (matches BreakdownChart's prettyLabel). */
const fmtIngredient = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Trial outcome type: buckets the trial's PRIMARY outcome domain into the
// high-level question the trial was asking. Drives the top-level filter panel.
const OUTCOME_TYPES: { key: string; label: string; domains: string[] }[] = [
  { key: "infection_prevention", label: "Infection prevention", domains: ["infection_prevention", "transmission_reduction"] },
  { key: "treatment", label: "Treatment (viral load, symptoms, hospitalization)", domains: ["viral_load", "symptom_severity", "symptom_duration", "hospitalization", "quality_of_life"] },
  { key: "safety", label: "Safety / adverse events", domains: ["safety_adverse_events"] },
  { key: "other", label: "Other", domains: ["other"] },
];
const DOMAIN_TO_TYPE: Record<string, string> = Object.fromEntries(
  OUTCOME_TYPES.flatMap((t) => t.domains.map((d) => [d, t.key]))
);
const outcomeType = (t: TrialRow) => DOMAIN_TO_TYPE[t.primaryDomain] ?? "other";

// Result-direction segments for the stacked verdict charts. One segment per
// distinct verdict so the chart matches the table badges one-to-one (no_difference,
// mixed and inconclusive are NOT merged). Colours mirror the table's VERDICT_STYLE.
// Trials with no verdict at all (protocols / no extracted result) fall into "unknown".
const VERDICT_SEGMENTS: Segment[] = [
  { key: "favors_treatment", label: "Favors treatment", color: "#16a34a" },
  { key: "favors_control", label: "Favors control", color: "#dc2626" },
  { key: "mixed", label: "Mixed", color: "#fdba74" },
  { key: "no_difference", label: "No difference (null)", color: "#94a3b8" },
  { key: "inconclusive", label: "Inconclusive / not assessable", color: "#cbd5e1" },
  { key: "unknown", label: "Result unknown", color: "#e2e8f0" },
];
const VERDICT_KEYS = new Set([
  "favors_treatment", "favors_control", "no_difference", "mixed", "inconclusive",
]);
// Each known verdict maps to its own segment; blank / parse_error / anything else
// (no result extracted) buckets as "unknown".
function verdictBucket(v: string): string {
  return VERDICT_KEYS.has(v) ? v : "unknown";
}

function countBy(rows: TrialRow[], key: (r: TrialRow) => string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

/** {key: {favors_treatment, favors_control, inconclusive}} for the stacked
 *  verdict bars. A blank key buckets under `emptyKey` so the bars still sum to
 *  the full trial count. */
function verdictBreakdown(
  rows: TrialRow[],
  key: (r: TrialRow) => string,
  emptyKey = "unspecified",
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const k = key(r) || emptyKey;
    const row = (out[k] ??= {
      favors_treatment: 0, favors_control: 0, no_difference: 0, mixed: 0, inconclusive: 0, unknown: 0,
    });
    row[verdictBucket(r.verdict || "")] += 1;
  }
  return out;
}

/** Per-key hover-trial lists for the BreakdownChart tooltip, built from the SAME
 *  rows that feed verdictBreakdown so each bar's tiles and its hover entries align
 *  (and react to the active filters together). Push order matches the segment
 *  order the chart tiles by, so per-tile indexing lands on the right study. */
function hoverTrialsByKey(
  rows: TrialRow[],
  key: (r: TrialRow) => string,
  emptyKey = "unspecified",
): Record<string, HoverTrial[]> {
  const out: Record<string, HoverTrial[]> = {};
  for (const r of rows) {
    const k = key(r) || emptyKey;
    (out[k] ??= []).push({
      doi: r.doi.split("#")[0],
      label: r.hoverLabel,
      title: r.title,
      year: r.year,
      journal: r.journal,
      n: r.n,
      design: r.design,
      phase: null,
      verdict: r.verdict || undefined,
    });
  }
  return out;
}

/** Ingredients with MORE than this many trials span all columns (so their long row
 *  of result rectangles lays out flat) — matches the long-covid dashboard. */
const INGREDIENT_WIDE_MIN_TRIALS = 12;

/** "Trials by Ingredient" rendered in the long-covid rectangle-list style: every
 *  ingredient is a row with one rectangle per trial (coloured by result), a shared
 *  hover tooltip, and click-to-filter. Replaces the stacked bar chart while reading
 *  the SAME verdict-breakdown + hover data, so counts and filtering are unchanged. */
function IngredientRectList({
  breakdown, hoverTrials, segments, selectedKey, onItemClick,
}: {
  breakdown: Record<string, Record<string, number>>;
  hoverTrials: Record<string, HoverTrial[]>;
  segments: Segment[];
  selectedKey?: string;
  onItemClick?: (key: string) => void;
}) {
  const items = useMemo(
    () =>
      Object.entries(breakdown)
        .map(([key, counts]) => {
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          return {
            key,
            label: fmtIngredient(key),
            counts,
            total,
            wide: total > INGREDIENT_WIDE_MIN_TRIALS,
            selected: selectedKey != null && selectedKey !== "" && key === selectedKey,
          };
        })
        .filter((it) => it.total > 0)
        // Most-studied (wide) ingredients first, then by trial count, then by name.
        .sort((a, b) => Number(b.wide) - Number(a.wide) || b.total - a.total || a.label.localeCompare(b.label)),
    [breakdown, selectedKey]
  );

  const total = items.reduce((s, it) => s + it.total, 0);
  if (items.length === 0) return null;

  return (
    <div className="border border-border rounded-lg bg-white p-3 sm:p-4 mb-6">
      <h2 className="text-lg font-semibold mb-1">Trials by Ingredient (n = {total.toLocaleString()})</h2>
      <p className="text-sm text-foreground/60 mb-2">
        Each rectangle is one trial coloured by result — hover for study details, click an ingredient
        to filter the whole dashboard (click again to clear).
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        {segments.map((seg) => (
          <span key={seg.key} className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </span>
        ))}
      </div>
      <TrialRectList items={items} segments={segments} hoverTrials={hoverTrials} onItemClick={onItemClick} />
    </div>
  );
}

export function ResultsClientWrapper({
  trials,
}: {
  trials: TrialRow[];
}) {
  // Top-level ingredient filter (dropdown + "Trials by Ingredient" bar click). This
  // is the OUTERMOST filter — every panel, chart, forest plot, and the table react.
  const [ingredient, setIngredient] = useState<string | undefined>(undefined);

  const ingredientKey = (t: TrialRow) => t.ingredient || "unspecified";
  const ingredientFilter = (t: TrialRow) => !ingredient || ingredientKey(t) === ingredient;

  // Country multi-select filter (toggled by clicking countries on the "Trials by
  // country" map or removing bubbles). Empty set = no country filter (all pass);
  // otherwise a trial passes if it lists ANY selected country.
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const countryFilter = (t: TrialRow) =>
    selectedCountries.size === 0 || t.countries.some((c) => selectedCountries.has(c));
  const allCountryNames = useMemo(
    () => [...new Set(trials.flatMap((t) => t.countries))].sort((a, b) => a.localeCompare(b)),
    [trials]
  );
  const clearAllCountries = () => setSelectedCountries(new Set());

  // Checkbox-card toggle for countries. Empty selectedCountries = no filter (all pass),
  // which is displayed as "all checked". Unchecking a country when the set is empty
  // means "exclude just this one" = add all others to the include set.
  const toggleCountryCard = (c: string) =>
    setSelectedCountries((prev) => {
      if (prev.size === 0) {
        return new Set(allCountryNames.filter((cc) => cc !== c));
      }
      const next = new Set(prev);
      if (next.has(c)) {
        next.delete(c);
      } else {
        next.add(c);
        if (allCountryNames.length > 0 && allCountryNames.every((n) => next.has(n))) {
          return new Set();
        }
      }
      return next;
    });

  // Delivery-method multi-select filter (spray vs drops vs ...), checkbox panel.
  // Default: nasal spray only.
  const allDeliveryList = useMemo(
    () => Object.keys(countBy(trials, deliveryKey)).sort(
      (a, b) => DELIVERY_ORDER.indexOf(a) - DELIVERY_ORDER.indexOf(b)
    ),
    [trials]
  );
  const [selectedDeliveries, setSelectedDeliveries] = useState<Set<string>>(
    () => new Set(["spray"])
  );
  const deliveryFilter = (t: TrialRow) => selectedDeliveries.has(deliveryKey(t));
  const toggleDelivery = (k: string) =>
    setSelectedDeliveries((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  const selectAllDeliveries = () => setSelectedDeliveries(new Set(allDeliveryList));
  const clearAllDeliveries = () => setSelectedDeliveries(new Set());

  // Top-level trial-outcome-focus filter: a checkbox per outcome type.
  // Default: infection prevention only.
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    () => new Set(["infection_prevention"])
  );
  const typeFilter = (t: TrialRow) => selectedTypes.has(outcomeType(t));
  const toggleType = (k: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const selectAllTypes = () => setSelectedTypes(new Set(OUTCOME_TYPES.map((t) => t.key)));
  const clearAllTypes = () => setSelectedTypes(new Set());

  // Trial-type (study design) multi-select filter — mirrors the long-covid dashboard.
  // Default: RCT and human-challenge only.
  const allDesignList = useMemo(
    () => Object.entries(countBy(trials, designKey)).sort((a, b) => b[1] - a[1]).map(([d]) => d),
    [trials]
  );
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(
    () => new Set(["RCT", "human-challenge"].filter((k) => trials.some((t) => designKey(t) === k)))
  );
  const designFilter = (t: TrialRow) => selectedDesigns.has(designKey(t));
  const toggleDesign = (d: string) =>
    setSelectedDesigns((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  const selectAllDesigns = () => setSelectedDesigns(new Set(allDesignList));
  const clearAllDesigns = () => setSelectedDesigns(new Set());

  // Ingredient + country are the outermost filters; the panels / charts / forest
  // plots / table all derive from this narrowed base.
  const afterIngredient = useMemo(
    () => trials.filter((t) => ingredientFilter(t) && countryFilter(t)),
    [trials, ingredient, selectedCountries]
  );
  // Ingredient-narrowed but NOT country-narrowed — the base for the country map,
  // so every country stays visible even while one is selected as a filter.
  const afterIngredientNoCountry = useMemo(
    () => trials.filter(ingredientFilter),
    [trials, ingredient]
  );

  // Cross-filtering between the three checkbox panels (delivery, outcome focus, trial
  // type): each panel's denominator + counts come from the base filtered by the OTHER
  // two panels, so every panel's numbers stay in sync.
  const exceptDelivery = useMemo(
    () => afterIngredient.filter((t) => typeFilter(t) && designFilter(t)),
    [afterIngredient, selectedTypes, selectedDesigns]
  );
  const exceptType = useMemo(
    () => afterIngredient.filter((t) => deliveryFilter(t) && designFilter(t)),
    [afterIngredient, selectedDeliveries, selectedDesigns]
  );
  const exceptDesign = useMemo(
    () => afterIngredient.filter((t) => deliveryFilter(t) && typeFilter(t)),
    [afterIngredient, selectedDeliveries, selectedTypes]
  );
  const filteredTrials = useMemo(
    () => afterIngredient.filter((t) => deliveryFilter(t) && typeFilter(t) && designFilter(t)),
    [afterIngredient, selectedDeliveries, selectedTypes, selectedDesigns]
  );

  // Ingredient dropdown options — over ALL trials (independent of the current selection,
  // so you can always switch); sorted alphabetically with total counts.
  const ingredientOptions = useMemo(() => {
    const counts = countBy(trials, ingredientKey);
    // Sort by trial count (desc), then alphabetically as a tiebreak.
    return Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
      .map((k) => ({ key: k, count: counts[k] }));
  }, [trials]);

  // Each panel's per-option counts come from the base filtered by the OTHER two panels.
  const deliveryCountMap = useMemo(() => countBy(exceptDelivery, deliveryKey), [exceptDelivery]);
  const typeCountMap = useMemo(() => countBy(exceptType, outcomeType), [exceptType]);
  const designCountMap = useMemo(() => countBy(exceptDesign, designKey), [exceptDesign]);

  // A checkbox card is "active" (some box unchecked) when its selection isn't the
  // full set — darken its background to signal the filter is narrowing results.
  const cardBg = (active: boolean) =>
    `mb-4 border border-border rounded-lg p-3 ${active ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"}`;
  const deliveryActive = selectedDeliveries.size !== allDeliveryList.length;
  const typesActive = selectedTypes.size !== OUTCOME_TYPES.length;
  const designsActive = selectedDesigns.size !== allDesignList.length;
  const countriesActive = selectedCountries.size > 0;

  // Breakdowns recomputed from the trial-type-filtered set so the charts react.
  // Trials with no canonical ingredient are bucketed as "unspecified" so the
  // ingredient bars sum to the full trial count (rather than silently dropping).
  // Trials by ingredient, each bar split by result direction (favors treatment /
  // control / inconclusive). Trials with no canonical ingredient bucket as
  // "unspecified" so the bars still sum to the full trial count. (BreakdownChart
  // sorts the bars by total internally.)
  //
  // This chart reacts to the other panels but NOT to the ingredient selection, so
  // every ingredient bar stays visible — a click highlights the bar (and filters
  // the rest of the page) rather than isolating it.
  const ingredientChartBase = useMemo(
    () => trials.filter((t) => countryFilter(t) && deliveryFilter(t) && typeFilter(t) && designFilter(t)),
    [trials, selectedCountries, selectedDeliveries, selectedTypes, selectedDesigns]
  );
  const ingredientVerdictChart = useMemo(
    () => verdictBreakdown(ingredientChartBase, (r) => r.ingredient),
    [ingredientChartBase]
  );
  // Hover lists built from the SAME filtered base as the bars, so the tooltip
  // never shows a study that the active filters have removed from the chart.
  const ingredientHoverTrials = useMemo(
    () => hoverTrialsByKey(ingredientChartBase, (r) => r.ingredient),
    [ingredientChartBase]
  );

  // Trials-by-year histogram, driven by the filtered set so it reacts to filters.
  const filteredYears = useMemo(
    () => filteredTrials.map((t) => parseInt(t.year, 10)).filter((y) => !Number.isNaN(y)),
    [filteredTrials]
  );

  // "Trials by country" map. Like the ingredient chart, it reacts to the other
  // filters but NOT to the country selection, so every country stays visible —
  // a click filters the dashboard (click the same country again to clear).
  const countryChartBase = useMemo(
    () => afterIngredientNoCountry.filter((t) => deliveryFilter(t) && typeFilter(t) && designFilter(t)),
    [afterIngredientNoCountry, selectedDeliveries, selectedTypes, selectedDesigns]
  );
  const allCountries = useMemo(() => countriesOf(countryChartBase), [countryChartBase]);
  return (
    <>
      {/* Delivery-method filter (spray vs drops, checkboxes) — narrows everything below. */}
      <div className={cardBg(deliveryActive)}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-foreground">Filter by delivery method</span>
          <span className="text-xs text-foreground/50">
            ({filteredTrials.length} of {exceptDelivery.length} trials selected)
          </span>
          <button onClick={selectAllDeliveries} className="text-xs text-blue-600 hover:text-blue-700 ml-auto">Select all</button>
          <button onClick={clearAllDeliveries} className="text-xs text-blue-600 hover:text-blue-700">Clear all</button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {allDeliveryList.map((k) => {
            const checked = selectedDeliveries.has(k);
            return (
              <label key={k}
                className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${checked ? "" : "bg-foreground/[0.08]"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDelivery(k)}
                  className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
                />
                <span className={checked ? "text-foreground" : "text-foreground/50"}>
                  {DELIVERY_LABELS[k] ?? k}
                </span>
                <span className="text-xs text-foreground/40">({deliveryCountMap[k] ?? 0})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Trial-outcome-focus filter (checkboxes, one per outcome type) */}
      <div className={cardBg(typesActive)}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-foreground">Filter by trial outcome focus</span>
          <span className="text-xs text-foreground/50">
            ({filteredTrials.length} of {exceptType.length} trials selected)
          </span>
          <button onClick={selectAllTypes} className="text-xs text-blue-600 hover:text-blue-700 ml-auto">Select all</button>
          <button onClick={clearAllTypes} className="text-xs text-blue-600 hover:text-blue-700">Clear all</button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {OUTCOME_TYPES.map((t) => {
            const checked = selectedTypes.has(t.key);
            return (
              <label key={t.key}
                className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${checked ? "" : "bg-foreground/[0.08]"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleType(t.key)}
                  className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
                />
                <span className={checked ? "text-foreground" : "text-foreground/50"}>
                  {t.label}
                </span>
                <span className="text-xs text-foreground/40">({typeCountMap[t.key] ?? 0})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Trial-type filter (long-covid style) */}
      <div className={cardBg(designsActive)}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-foreground">Filter by trial type</span>
          <span className="text-xs text-foreground/50">
            ({filteredTrials.length} of {exceptDesign.length} trials selected)
          </span>
          <button onClick={selectAllDesigns} className="text-xs text-blue-600 hover:text-blue-700 ml-auto">Select all</button>
          <button onClick={clearAllDesigns} className="text-xs text-blue-600 hover:text-blue-700">Clear all</button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {allDesignList.map((d) => {
            const checked = selectedDesigns.has(d);
            return (
              <label key={d}
                className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${checked ? "" : "bg-foreground/[0.08]"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDesign(d)}
                  className="rounded border-foreground/30 text-blue-600 focus:ring-blue-500"
                />
                <span className={checked ? "text-foreground" : "text-foreground/50"}>
                  {formatDesign(d)}
                </span>
                <span className="text-xs text-foreground/40">({designCountMap[d] ?? 0})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Country filter — checkbox card showing all countries with trial counts. */}
      <div className={cardBg(countriesActive)}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-foreground">Filter by country</span>
          <span className="text-xs text-foreground/50">
            ({filteredTrials.length} of {countryChartBase.length} trials selected)
          </span>
          <button onClick={clearAllCountries} className="text-xs text-blue-600 hover:text-blue-700 ml-auto">Select all</button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-h-40 overflow-y-auto pr-1">
          {allCountries.map(({ country, count }) => {
            const checked = !countriesActive || selectedCountries.has(country);
            return (
              <label key={country}
                className={`inline-flex items-center gap-1.5 cursor-pointer text-sm rounded px-1.5 py-0.5 ${checked ? "" : "bg-foreground/[0.08]"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCountryCard(country)}
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
      </div>

      {/* Ingredient filter — the outermost filter; narrows everything below. */}
      <div className={`mb-8 border border-border rounded-lg p-4 ${ingredient ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-foreground">Filter by ingredient</span>
          <select
            value={ingredient ?? "all"}
            onChange={(e) => setIngredient(e.target.value === "all" ? undefined : e.target.value)}
            className={`border border-border rounded px-3 py-1.5 text-sm max-w-[22rem] ${ingredient ? "bg-foreground/[0.08]" : "bg-background"}`}
          >
            <option value="all">All ingredients</option>
            {ingredientOptions.map((o) => (
              <option key={o.key} value={o.key}>{fmtIngredient(o.key)} ({o.count})</option>
            ))}
          </select>
          <span className="text-xs text-foreground/50">
            ({filteredTrials.length} of {trials.length} trials)
          </span>
          {ingredient && (
            <button onClick={() => setIngredient(undefined)} className="text-xs text-blue-600 hover:text-blue-700 ml-auto">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Trials by Ingredient — long-covid rectangle-list style (one rectangle per
          trial, coloured by result; hover for details, click to filter). */}
      {Object.keys(ingredientVerdictChart).length > 0 && (
        <IngredientRectList
          breakdown={ingredientVerdictChart}
          hoverTrials={ingredientHoverTrials}
          segments={VERDICT_SEGMENTS}
          selectedKey={ingredient}
          onItemClick={(k) => setIngredient((cur) => (cur === k ? undefined : k))}
        />
      )}

      {/* Trials by year (reacts to the filters above) */}
      <YearChart years={filteredYears} />

      <ResultsTable
        rows={filteredTrials}
      />
    </>
  );
}
