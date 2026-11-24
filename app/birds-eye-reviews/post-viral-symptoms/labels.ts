/** Vocabulary labels, colours and number formatting for the post-viral
 *  symptoms page. Plain module (no "use client") so server and client
 *  components share one set of words. Vocabularies follow
 *  `docs/prevalence-bundle.md` in the pipeline repo; an unknown code falls
 *  back to a humanised version of itself rather than disappearing. */

export const humanize = (s: string | undefined | null): string =>
  s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—";

const lookup = (table: Record<string, string>) => (code: string | undefined | null) =>
  (code && table[code]) || humanize(code);

export const HEADLINE_FAMILIES = [
  "fatigue",
  "any_symptom",
  "not_recovered_or_syndrome",
  "mecfs",
  "cognitive",
  "pem",
] as const;

export const familyLabel = lookup({
  fatigue: "Fatigue",
  any_symptom: "Any persistent symptom",
  not_recovered_or_syndrome: "Not recovered / named post-infection syndrome",
  mecfs: "Meets an ME/CFS case definition",
  cognitive: "Cognitive symptoms",
  pem: "Post-exertional malaise",
  dyspnea: "Breathlessness",
  smell_or_taste: "Smell or taste loss",
  mental_health: "Mental health",
});

export const exposureLabel = lookup({
  covid: "COVID-19",
  influenza: "Influenza",
  ebv: "Mononucleosis / EBV",
  other_viral: "Other viral infection",
  non_viral: "Non-viral infection",
  mixed_infections: "Mixed infections",
  unspecified_acute_illness: "Acute illness, test-negative",
  non_infectious_illness: "Non-infectious illness (hospital controls)",
  none: "Uninfected comparison group",
});

/** Categorical colours for infections, assigned in a fixed order (never by
 *  rank) so a filter never repaints a surviving line. Slots 1-8 of the
 *  validated reference palette; uninfected groups are neutral grey. */
export const EXPOSURE_ORDER = [
  "covid",
  "influenza",
  "ebv",
  "other_viral",
  "non_viral",
  "mixed_infections",
  "unspecified_acute_illness",
  "non_infectious_illness",
  "none",
];
export const EXPOSURE_COLOR: Record<string, string> = {
  covid: "#2a78d6",
  influenza: "#eb6834",
  ebv: "#1baf7a",
  other_viral: "#eda100",
  non_viral: "#e87ba4",
  mixed_infections: "#008300",
  unspecified_acute_illness: "#6250d6",
  non_infectious_illness: "#e34948",
  none: "#77756f",
};
export const exposureColor = (e: string) => EXPOSURE_COLOR[e] ?? "#77756f";

export const severityLabel = lookup({
  non_hospitalised: "Community (not hospitalised)",
  hospitalised: "Hospitalised (incl. ICU)",
  asymptomatic: "Asymptomatic infection",
  all_severities: "Mixed / unstated severity",
  not_applicable: "Comparison group",
});

export const comparatorClassLabel = lookup({
  uninfected: "vs uninfected / test-negative people",
  other_infection: "vs people with a different acute illness",
  hospitalised_other_cause: "vs people hospitalised for another cause",
  pre_infection_self: "vs the same people before infection",
  other: "vs other comparison group",
});

export const comparatorKindLabel = lookup({
  influenza: "vs influenza",
  other_acute_respiratory: "vs other acute respiratory infection",
  sepsis_or_critical_illness: "vs sepsis / critical illness / other-cause hospitalisation",
  ebv: "vs mononucleosis / EBV",
  other_viral: "vs other viral infection",
  non_viral: "vs non-viral infection",
  mixed_infections: "vs mixed infections",
});

export const ESTIMAND_ORDER = ["prevalence", "cumulative_incidence", "duration_at_least", "time_to_event", "incidence_rate"];
export const estimandLabel = lookup({
  prevalence: "Point prevalence (has it at time t)",
  cumulative_incidence: "Cumulative incidence (new diagnosis recorded by time t)",
  duration_at_least: "Symptoms lasting at least t (duration, not status at t)",
  time_to_event: "Time to event (hazard ratio)",
  incidence_rate: "Incidence rate",
});
export const estimandShort = lookup({
  prevalence: "point prevalence",
  cumulative_incidence: "cumulative incidence",
  duration_at_least: "lasting ≥ t",
  time_to_event: "time to event",
  incidence_rate: "incidence rate",
});

export const measureLabel = lookup({
  risk_difference: "Risk difference (percentage points)",
  risk_ratio: "Risk / prevalence ratio",
  odds_ratio: "Odds ratio",
  hazard_ratio: "Hazard ratio",
  incidence_rate_ratio: "Incidence rate ratio",
  proportion: "Proportion",
});
export const MEASURE_ORDER = ["risk_difference", "risk_ratio", "odds_ratio", "hazard_ratio", "incidence_rate_ratio"];

export const definitionLabel = lookup({
  single_symptom_report: "Single symptom, self-report",
  symptom_scale_threshold: "Symptom scale above a cut-off",
  clinician_diagnosis_or_code: "Clinician diagnosis or record code",
  any_symptom_count: "Count of any symptoms",
  composite_case_definition: "Composite case definition",
  functional_status: "Functional status",
  self_rated_recovery: "Self-rated recovery",
  objective_test: "Objective test",
  other: "Other",
});

export const baselineLabel = lookup({
  counted_regardless: "Counted regardless of pre-infection symptoms",
  new_onset_only: "New-onset only",
  new_or_worsened: "New or worsened",
  attributed_to_exposure_by_participant: "Attributed to the infection by the participant",
  not_stated: "Not stated",
});

export const dataSourceLabel = lookup({
  questionnaire: "Questionnaire",
  dedicated_study_visits: "Study visits",
  health_records_or_claims: "Health records / claims codes",
  mixed: "Mixed sources",
  app_based: "Symptom app",
  interview: "Interview",
  registry: "Registry",
});

export const sourceLabel = lookup({
  reported_adjusted: "paper's adjusted contrast",
  reported_crude: "paper's crude contrast",
  derived_pair: "computed from the two groups' percentages",
  estimate: "group estimate",
});

export const verificationLabel = lookup({
  hand_checked: "Hand-checked",
  confirmed: "Confirmed by stronger model",
  corrected: "Corrected by stronger model",
  uncertain: "Flagged uncertain",
  removed: "Removed by verification",
  unverified: "Not verified",
});

export const robLabel = lookup({ low: "Low", some_concerns: "Some concerns", high: "High", unclear: "Unclear" });

// ---------------------------------------------------------------- numbers

/** A number with sensible precision: 12.3, 4.56, 0.123. */
export function fmt(n: number | null | undefined, digits?: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (digits != null) return n.toFixed(digits);
  const a = Math.abs(n);
  return a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(1) : a >= 1 ? n.toFixed(1) : n.toFixed(2);
}

export const fmtInt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US");

/** Unit suffix for a pool value. */
export function unitSuffix(unit: string): string {
  return unit === "percentage_points" ? " pp" : unit === "percent" ? "%" : "";
}

export function fmtValue(v: number | null | undefined, unit: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (unit === "ratio") return v.toFixed(2);
  const s = fmt(v);
  return unit === "percentage_points" && v > 0 ? `+${s} pp` : `${s}${unitSuffix(unit)}`;
}

export function fmtCI(lo: number | null | undefined, hi: number | null | undefined, unit: string): string {
  if (lo == null || hi == null) return "no CI";
  if (unit === "ratio") return `${lo.toFixed(2)} to ${hi.toFixed(2)}`;
  return `${fmt(lo)} to ${fmt(hi)}`;
}

export function doiHref(doi: string | undefined | null): string | null {
  if (!doi) return null;
  const d = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return d.startsWith("10.") ? `https://doi.org/${d}` : null;
}

/** "Smith 2021" from a paper record, else the paper's short key. */
export function paperLabel(p: { author?: string; year?: number | string; key?: string } | undefined, fallback = ""): string {
  if (!p) return fallback;
  // The bundle's first_author is already a surname ("Al-Aly", "Kikkenborg Berg").
  const surname = (p.author ?? "").split(/[,;]/)[0].trim();
  if (surname) return `${surname}${p.year ? ` ${p.year}` : ""}`;
  return p.key ?? fallback;
}

/** Month value for an x-axis from days. */
export const DAYS_PER_MONTH = 30.4375;

/** Verbatim quote text for display. Quotes can carry table markup copied
 *  from the paper's HTML tables: render cells as " | " and rows as line
 *  breaks, drop every other tag. Text only; never injected as HTML. */
export function quoteText(q: string | undefined | null): string {
  if (!q) return "";
  return q
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]*\|[ \t]*\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
