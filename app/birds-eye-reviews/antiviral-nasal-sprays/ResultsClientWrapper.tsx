"use client";

import { useState, useMemo } from "react";
import { BreakdownChart, Segment } from "./screening/BreakdownChart";
import { ForestPlot, ForestGroup, DOMAIN_LABELS } from "./ForestPlot";
import { ResultsTable, TrialRow } from "./ResultsTable";
import { YearChart } from "./YearChart";

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

export function ResultsClientWrapper({
  trials,
  forestGroups,
  minTrials,
}: {
  trials: TrialRow[];
  forestGroups: ForestGroup[];
  minTrials: number;
}) {
  // Top-level ingredient filter (dropdown + "Trials by Ingredient" bar click). This
  // is the OUTERMOST filter — every panel, chart, forest plot, and the table react.
  const [ingredient, setIngredient] = useState<string | undefined>(undefined);
  // Secondary, table-only filter set by clicking the outcome-domain chart.
  const [domain, setDomain] = useState<string | undefined>(undefined);

  const ingredientKey = (t: TrialRow) => t.ingredient || "unspecified";
  const ingredientFilter = (t: TrialRow) => !ingredient || ingredientKey(t) === ingredient;

  // Delivery-method multi-select filter (spray vs drops vs ...), checkbox panel, all
  // checked by default. Ordered spray, drops, irrigation, other.
  const allDeliveryList = useMemo(
    () => Object.keys(countBy(trials, deliveryKey)).sort(
      (a, b) => DELIVERY_ORDER.indexOf(a) - DELIVERY_ORDER.indexOf(b)
    ),
    [trials]
  );
  const [selectedDeliveries, setSelectedDeliveries] = useState<Set<string>>(
    () => new Set(trials.map(deliveryKey))
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

  // Top-level trial-outcome-focus filter: a checkbox per outcome type, all checked
  // by default. Each trial falls in exactly one bucket (by its primary outcome domain).
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    () => new Set(OUTCOME_TYPES.map((t) => t.key))
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
  const allDesignList = useMemo(
    () => Object.entries(countBy(trials, designKey)).sort((a, b) => b[1] - a[1]).map(([d]) => d),
    [trials]
  );
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(
    () => new Set(trials.map(designKey))
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

  // Ingredient is the outermost filter; the panels / charts / forest plots / table all
  // derive from this ingredient-narrowed base.
  const afterIngredient = useMemo(() => trials.filter(ingredientFilter), [trials, ingredient]);

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
    `mb-4 border border-border rounded-lg p-4 ${active ? "bg-foreground/[0.07]" : "bg-foreground/[0.02]"}`;
  const deliveryActive = selectedDeliveries.size !== allDeliveryList.length;
  const typesActive = selectedTypes.size !== OUTCOME_TYPES.length;
  const designsActive = selectedDesigns.size !== allDesignList.length;

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
    () => trials.filter((t) => deliveryFilter(t) && typeFilter(t) && designFilter(t)),
    [trials, selectedDeliveries, selectedTypes, selectedDesigns]
  );
  const ingredientVerdictChart = useMemo(
    () => verdictBreakdown(ingredientChartBase, (r) => r.ingredient),
    [ingredientChartBase]
  );

  // Trials by primary outcome domain, also split by result direction.
  const domainVerdictChart = useMemo(
    () => verdictBreakdown(filteredTrials, (r) => r.primaryDomain, "other"),
    [filteredTrials]
  );

  // Forest plots: groups with >=2 trials, pooled first, optionally filtered by ingredient.
  // (Meta-analyses are aggregate over all trials and not narrowed by the trial-type filter.)
  const shownGroups = useMemo(() => {
    let g = forestGroups.filter((x) => x.n_trials >= 2);
    if (ingredient) g = g.filter((x) => x.ingredient === ingredient);
    return g.sort((a, b) => Number(Boolean(b.pooled)) - Number(Boolean(a.pooled)) || b.n_trials - a.n_trials);
  }, [forestGroups, ingredient]);
  const pooledCount = forestGroups.filter((g) => g.pooled).length;

  // Trials-by-year histogram, driven by the filtered set so it reacts to filters.
  const filteredYears = useMemo(
    () => filteredTrials.map((t) => parseInt(t.year, 10)).filter((y) => !Number.isNaN(y)),
    [filteredTrials]
  );

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

      {/* Breakdown charts */}
      {Object.keys(ingredientVerdictChart).length > 0 && (
        <BreakdownChart title="Trials by Ingredient" breakdown={ingredientVerdictChart}
          segments={VERDICT_SEGMENTS} selectedKey={ingredient}
          onBarClick={(k) => setIngredient((cur) => (cur === k ? undefined : k))}
          clickHint="Each bar is split by result direction — click a bar to filter the whole dashboard to that ingredient (click again to clear)." />
      )}
      {!typesActive && Object.keys(domainVerdictChart).length > 0 && (
        <BreakdownChart title="Trials by Primary Outcome Domain" breakdown={domainVerdictChart}
          segments={VERDICT_SEGMENTS} labels={DOMAIN_LABELS} onBarClick={(k) => setDomain(k)}
          clickHint="Each bar is split by result direction — click a bar to filter the table below." />
      )}

      {/* Trials by year (reacts to the filters above) */}
      <YearChart years={filteredYears} />

      {/* Meta-analysis forest plots */}
      <section className="mb-10 mt-8">
        <h2 className="text-lg font-semibold mb-1">Meta-analyses</h2>
        <p className="text-sm text-foreground/60 mb-4">
          One forest plot per ingredient × outcome × effect measure with ≥2 trials. A pooled
          random-effects diamond (DerSimonian–Laird) is shown when {minTrials}+ trials report the
          same comparable estimate.{ingredient && ` Filtered to “${fmtIngredient(ingredient)}”.`}
        </p>
        {shownGroups.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/60">
            No ingredient yet has ≥2 trials reporting a comparable outcome and effect measure
            {ingredient ? ` for “${fmtIngredient(ingredient)}”` : ""}. As more trials are extracted, forest plots
            will appear here. ({pooledCount} pooled so far.)
          </div>
        ) : (
          shownGroups.map((g, i) => <ForestPlot key={`${g.ingredient}-${g.outcome_domain}-${g.effect_measure}-${i}`} group={g} />)
        )}
      </section>

      <ResultsTable
        rows={filteredTrials}
        externalDomain={domain}
      />
    </>
  );
}
