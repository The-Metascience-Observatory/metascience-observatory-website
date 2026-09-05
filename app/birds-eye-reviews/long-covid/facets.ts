/** Single source of truth for the dashboard's click-to-filter facets.
 *
 * The "chart count ≠ table rows" bug class happens whenever a chart counts
 * "trials for X" one way and the table filter matches X another way (per-arm vs
 * per-trial, first-value vs all-values, string-split vs structured). To make that
 * impossible, EVERY facet is defined here ONCE: `FACET_VALUES[key]` returns a
 * trial's distinct values for that facet, and BOTH the chart aggregation
 * (`countDistinctTrials`) and the table filter (`trialHasFacet`) go through it.
 *
 * A chart segment's number therefore always equals the rows shown when it's
 * clicked. Adding a new facet means adding one entry here — not a separate count
 * path and filter path that can drift.
 */

export type FacetKey =
  | "intervention"
  | "interventionCategory"
  | "symptomDomain"
  | "outcomeDomain"
  | "country"
  | "designType"
  | "blinding";

/** The per-trial facet inputs, normalized to multi-valued lists. Built once per
 *  trial by `buildFacetInput` and stored on both TrialMeta and TrialTableRow so
 *  count and filter read the identical data. */
export interface FacetInput {
  interventionNames: string[];
  interventionCategories: string[];
  symptomDomains: string[]; // ALL distinct primary symptom domains (not just first)
  outcomeDomains: string[]; // ALL distinct symptom domains across every outcome (primary or secondary)
  countries: string[];
  designType: string;
  blinding: string;
}

const uniq = (xs: (string | null | undefined)[]): string[] =>
  [...new Set(xs.filter((x): x is string => !!x))];

export function buildFacetInput(src: {
  interventions: { name: string; category: string }[];
  symptomDomains: string[];
  outcomeDomains: string[];
  countries: string[];
  designType: string;
  blinding: string;
}): FacetInput {
  return {
    interventionNames: uniq(src.interventions.map((i) => i.name)),
    interventionCategories: uniq(src.interventions.map((i) => i.category)),
    symptomDomains: uniq(src.symptomDomains),
    outcomeDomains: uniq(src.outcomeDomains),
    countries: uniq(src.countries),
    designType: src.designType || "unknown",
    blinding: src.blinding || "unknown",
  };
}

/** The ONE definition of a trial's values for each facet. */
export const FACET_VALUES: Record<FacetKey, (f: FacetInput) => string[]> = {
  intervention: (f) => f.interventionNames,
  interventionCategory: (f) => f.interventionCategories,
  symptomDomain: (f) => f.symptomDomains,
  outcomeDomain: (f) => f.outcomeDomains,
  country: (f) => f.countries,
  designType: (f) => [f.designType],
  blinding: (f) => [f.blinding],
};

/** Distinct-trial count per facet value (chart side). */
export function countDistinctTrials<T extends { facets: FacetInput }>(
  trials: T[],
  key: FacetKey,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of trials) {
    for (const v of new Set(FACET_VALUES[key](t.facets))) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return counts;
}

/** Does this trial belong to (facet = value)? (filter side — same source as count). */
export function trialHasFacet(facets: FacetInput, key: FacetKey, value: string): boolean {
  return FACET_VALUES[key](facets).includes(value);
}
