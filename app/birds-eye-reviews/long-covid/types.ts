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

export interface ForestRow {
  paper_id: string;
  intervention_name: string;
  intervention_category: string;
  symptom_domain: string;
  instrument: string;
  effect_measure: string;
  effect_value: number;
  ci_95_low: number;
  ci_95_high: number;
  rob_overall: string;
  n_randomized: number;
  blinding: string;
  higher_is_better: boolean | null;
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

export interface TrialTableRow {
  paper_id: string;
  doi_url: string;
  design_type: string;
  intervention_name: string;
  intervention_category: string;
  blinding: string;
  n_randomized: number | null;
  primary_symptom_domain: string;
  primary_outcome_name: string;
  primary_effect_value: number | null;
  primary_ci_low: number | null;
  primary_ci_high: number | null;
  primary_p_value: number | null;
  primary_higher_is_better: boolean | null;
  countries: string[];
  rob_overall: string;
  follow_up_weeks: number | null;
  long_covid_definition: string;
  outcomes_summary: string[];
  n_outcomes: number;
  n_positive: number;
  n_negative_ns: number;
  n_unknown: number;
}

export interface DashboardProps {
  summaryStats: SummaryStats;
  byIntervention: InterventionBar[];
  bySymptom: SymptomBar[];
  heatmapData: HeatmapCell[];
  topCountries: CountryBar[];
  byYear: YearBar[];
  forestData: ForestRow[];
  blindingBySignificance: BlindingSignificanceBar[];
  lcDefinitionHist: LcDefinitionBin[];
  lcDefPct12Plus: number;
  tableRows: TrialTableRow[];
}
