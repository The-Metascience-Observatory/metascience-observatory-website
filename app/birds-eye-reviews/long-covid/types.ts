export interface SummaryStats {
  totalTrials: number;
  totalParticipants: number;
  nCountries: number;
  nInterventionCategories: number;
  nInstruments: number;
}

export interface InterventionBar {
  category: string;
  count: number;
  interventions: { name: string; count: number }[];
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
}

export interface LcDefinitionBin {
  label: string;
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
  n_randomized: number | null;
  min_weeks: number | null;
  year: number | null;
  n_instruments: number;
  primary_p_value: number | null;
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
  intervention_name: string;
  all_intervention_names: string[];
  intervention_category: string;
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
  n_positive: number;
  n_negative_ns: number;
  n_unknown: number;
  year: number | null;
  min_weeks: number | null;
  summary: string;
  promise_score: number | null;
}

export interface DashboardProps {
  summaryStats: SummaryStats;
  byIntervention: InterventionBar[];
  bySymptom: SymptomBar[];
  heatmapData: HeatmapCell[];
  topCountries: CountryBar[];
  allCountries: CountryBar[];
  byYear: YearBar[];
  blindingBySignificance: BlindingSignificanceBar[];
  lcDefinitionHist: LcDefinitionBin[];
  lcDefPct12Plus: number;
  tableRows: TrialTableRow[];
  trialMetas: TrialMeta[];
}

