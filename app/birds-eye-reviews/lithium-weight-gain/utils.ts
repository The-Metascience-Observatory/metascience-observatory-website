/** Shared formatting utilities for the restless legs syndrome dashboard. */

export function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  return a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function formatLabel(s: string): string {
  return s.replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bRct\b/g, "RCT");
}

/** Round tick positions for an axis: multiples of a 1/2/5×10ⁿ step covering
 *  [lo, hi]. Because ticks are multiples of the step, 0 is always one of them
 *  whenever the range crosses zero — which keeps the zero gridline labeled. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [0];
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1e6; v += step) {
    // Snap floating-point drift so 0 is exactly 0 and labels stay clean.
    out.push(Math.abs(v) < step / 1e6 ? 0 : Number(v.toFixed(10)));
  }
  return out;
}

/** Label an axis tick without fake precision: "0", "0.5", "150". */
export function tickLabel(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  return a >= 10 ? v.toFixed(0) : a >= 1 ? String(Number(v.toFixed(1))) : String(Number(v.toFixed(2)));
}

/** Hand-classified corrections for the few studies the extraction left as
 *  design "other". Keyed by DOI so they survive a data republish; if a
 *  re-extraction later assigns a real design, the override simply agrees or
 *  can be dropped.
 *
 *  - 10.1002/da.22479 — 6-month open-label EXTENSION following two
 *    non-randomized continuation groups (lurasidone+lithium vs monotherapy):
 *    a prospective cohort, not an RCT (randomization was in the parent trial).
 *  - 10.2147/ppa.s56790 — single-arm open-label switch-to-ziprasidone trial,
 *    outcomes compared pre/post within the same patients: before/after.
 *  - 10.3233/jad-170744 — county-level trace-lithium drinking-water analysis:
 *    ecological.
 */
export const DESIGN_OVERRIDES: Record<string, string> = {
  "10.1002/da.22479": "prospective_cohort",
  "10.2147/ppa.s56790": "before_after",
  "10.3233/jad-170744": "ecological",
};

/** Hand-classified interventions for studies whose arms never name lithium
 *  directly. Each was re-read from its extraction record: all four are
 *  antipsychotic studies with lithium as (part of) the background regimen —
 *  i.e. lithium + another drug.
 *
 *  - 10.1111/j.1600-0447.2007.01059.x — oral atypical vs LAI risperidone,
 *    every patient on a mood stabilizer (lithium among them).
 *  - 10.1016/j.jad.2010.11.037 — EMBLEM: olanzapine combination arm, 20.3%
 *    combined with lithium.
 *  - 10.1080/10401230490453103 — adjunctive risperidone vs olanzapine ADDED
 *    to lithium/valproate/carbamazepine.
 *  - 10.1186/s40345-017-0075-7 — lurasidone continuation, ~75% on adjunctive
 *    lithium or valproate.
 */
export const INTERVENTION_OVERRIDES: Record<string, string[]> = {
  "10.1111/j.1600-0447.2007.01059.x": ["lithium_combo"],
  "10.1016/j.jad.2010.11.037": ["lithium_combo"],
  "10.1080/10401230490453103": ["lithium_combo"],
  "10.1186/s40345-017-0075-7": ["lithium_combo"],
};

/** Rows removed from the dashboard entirely. 10.1210/jcem.81.4.8636369 is a
 *  metformin crossover in hypertensives — lithium appears only as a renal
 *  clearance tracer, so its (null) BMI result says nothing about lithium and
 *  weight. Independently confirmed spurious by the XML re-extraction pass. */
export const EXCLUDED_DOIS = new Set(["10.1210/jcem.81.4.8636369"]);
