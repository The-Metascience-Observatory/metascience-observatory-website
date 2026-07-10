import type { FacetInput } from "./facets";
import type { HoverTrial } from "@/components/BreakdownChart";
export type { HoverTrial };

export interface SummaryStats {
  totalTrials: number;
  totalParticipants: number;
  nCountries: number;
  nInterventionCategories: number;
  nInstruments: number;
}

export interface InterventionBar {
  name: string;
  count: number;
  category: string;
}

export interface SymptomBar {
  domain: string;
  count: number;
}

export interface HeatmapCell {
  intervention: string;
  symptom: string;
  count: number;
  low: number;
  some_concerns: number;
  high: number;
}

export interface CountryBar {
  country: string;
  count: number;
}

export interface YearBar {
  year: number;
  count: number;
}

export interface BlindingSignificanceBar {
  blinding: string;
  significant: number;
  not_significant: number;
  unknown: number; // no primary p-value — so every trial with this blinding is represented
}

export interface LcDefinitionBin {
  label: string;
  count: number;
}

export interface DesignTypeBar {
  design_type: string;
  count: number;
}

/** Lightweight per-record metadata for client-side re-aggregation when RCT filter is toggled */
export interface TrialMeta {
  paper_id: string;
  is_rct: boolean;
  countries: string[];
  interventionArms: { category: string; name: string }[];
  primarySymptomDomains: string[];
  rob_overall: string;
  blinding: string;
  design_type: string;
  n_randomized: number | null;
  min_weeks: number | null;
  year: number | null;
  n_instruments: number;
  primary_p_value: number | null;
  facets: FacetInput; // shared count/filter source (see facets.ts)
}

export interface ArmSample {
  label: string;
  n_randomized: number | null;
  is_control: boolean;
}

export interface OutcomeSummaryItem {
  name: string;
  symptom_domain: string;
  effect_value: number | null;
  p_value: number | null;
  higher_is_better: boolean | null;
  effect_measure: string;
}

export interface TrialTableRow {
  paper_id: string;
  is_rct: boolean;
  doi_url: string;
  first_author: string;
  journal: string;
  design_type: string;
  intervention_name: string; // joined display string (r.interventions)
  interventions: { name: string; category: string }[]; // structured, for count+filter
  intervention_category: string;
  primary_symptom_domains: string[]; // ALL distinct primary domains (for count+filter)
  facets: FacetInput; // shared count/filter source (see facets.ts)
  blinding: string;
  n_randomized: number | null;
  primary_symptom_domain: string;
  primary_outcome_name: string;
  primary_effect_measure: string;
  primary_effect_value: number | null;
  primary_ci_low: number | null;
  primary_ci_high: number | null;
  primary_p_value: number | null;
  primary_higher_is_better: boolean | null;
  countries: string[];
  rob_overall: string;
  follow_up_weeks: number | null;
  arm_samples: ArmSample[];
  long_covid_definition: string;
  outcomes_summary: OutcomeSummaryItem[];
  n_outcomes: number;
  n_positive: number;       // significant outcomes favouring treatment
  n_favors_control: number; // significant outcomes favouring control (harm)
  n_null: number;           // non-significant outcomes (true null)
  n_unknown: number;        // no usable effect/p, or significant w/ unknown direction
  verdict: string;          // LLM trial verdict (proxy fallback) — a VERDICT_SEGMENTS key
  verdict_rationale: string; // one-line LLM rationale for the verdict (may be empty)
  year: number | null;
  min_weeks: number | null;
  summary: string;
  promise_score: number | null;
  title: string;
  authors: string;
  volume: string;
  issue: string;
  pages: string;
}

export interface DashboardProps {
  summaryStats: SummaryStats;
  lastUpdated?: string;
  byIntervention: InterventionBar[];
  bySymptom: SymptomBar[];
  heatmapData: HeatmapCell[];
  allCountries: CountryBar[];
  byYear: YearBar[];
  blindingBySignificance: BlindingSignificanceBar[];
  byDesignType: DesignTypeBar[];
  lcDefinitionHist: LcDefinitionBin[];
  lcDefPct12Plus: number;
  tableRows: TrialTableRow[];
  trialMetas: TrialMeta[];
  /** Verdict breakdown keyed by canonical intervention name, for the "Trials by Intervention" chart + tail. */
  byNameVerdicts: Record<string, Record<string, number>>;
  /** Per-intervention trial lists for the hover tooltip on the intervention chart/tail. */
  trialsByName: Record<string, HoverTrial[]>;
  /** Dominant intervention category for each canonical intervention name (for grouping the tail). */
  interventionCategoryOf: Record<string, string>;
}

