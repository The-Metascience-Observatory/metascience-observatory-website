/** Outcome-domain / effect-measure display-label helpers for the ME/CFS results
 *  table. (The RLS review also ships a forest-plot SVG component here that feeds
 *  its meta-analysis / network-meta-analysis sub-pages; ME/CFS does not generate
 *  those, so only the shared label helpers are kept.) */

const MEASURE_LABEL: Record<string, string> = {
  risk_ratio: "Risk ratio",
  odds_ratio: "Odds ratio",
  hazard_ratio: "Hazard ratio",
  rate_ratio: "Rate ratio",
  incidence_rate_ratio: "Incidence rate ratio",
  adjusted_odds_ratio: "Adjusted odds ratio",
  adjusted_risk_ratio: "Adjusted risk ratio",
  adjusted_hazard_ratio: "Adjusted hazard ratio",
  adjusted_rate_ratio: "Adjusted rate ratio",
  mean_difference: "Mean difference",
  adjusted_mean_difference: "Adjusted mean difference",
  smd: "Std. mean difference",
  standardized_mean_difference: "Std. mean difference",
  risk_difference: "Risk difference",
  rate_difference: "Rate difference",
};

/** Outcome-domain key -> display label, shared with ResultsClientWrapper so the
 *  labels stay in one place. */
export const DOMAIN_LABELS: Record<string, string> = {
  fatigue: "Fatigue severity",
  post_exertional_malaise: "Post-exertional malaise",
  pain: "Pain",
  sleep_quality: "Sleep quality",
  cognitive_function: "Cognitive function",
  physical_function: "Physical function",
  quality_of_life: "Quality of life",
  mood_anxiety: "Mood / anxiety",
  autonomic_function: "Autonomic function",
  safety_adverse_events: "Safety / adverse events",
  other: "Other",
};

export function prettyMeasure(m: string): string {
  return MEASURE_LABEL[m] ?? m.replace(/_/g, " ");
}
export function prettyDomain(d: string): string {
  return DOMAIN_LABELS[d] ?? d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
