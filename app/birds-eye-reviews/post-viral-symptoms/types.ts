/** Shapes of `data/birds_eye_reviews/post_viral_symptoms/page.json`.
 *
 *  Written by the pipeline repo's
 *  `projects/post_viral_symptoms/_tools/publish_bundle.py` from the
 *  prevalence bundle (`docs/prevalence-bundle.md` there). Field names are
 *  shortened for transport; the comments give the bundle field.
 *
 *  Units: prevalence in percent (0-100); risk differences in percentage
 *  points; ratios as plain ratios (1 = no difference).
 */

export interface TimeBin {
  id: string;
  low_days: number;
  high_days: number | null;
  label: string;
  nominal_months: number;
}

export interface PageMeta {
  bundle_schema: string;
  extraction_schema?: string;
  generated_at?: string;
  origin: "gold" | "pipeline";
  bundle_dir?: string;
  counts: {
    n_papers: number;
    n_papers_usable: number;
    n_cohorts: number;
    n_estimates: number;
    n_estimates_usable: number;
    n_contrasts: number;
    n_contrasts_usable: number;
    n_derived_pairs: number;
  };
  exclusions: Record<string, number>;
  methods: {
    model?: string;
    tau2_method?: string;
    ci_method?: string;
    level?: number;
    min_k?: number;
    time_tolerance?: number;
    pool_all_domains?: boolean;
    headline_families?: string[];
  };
  time_bins: TimeBin[];
  days_per_month?: number;
}

export interface Paper {
  key?: string;
  author?: string;
  year?: number | string;
  journal?: string;
  title?: string;
  doi?: string;
  cohort?: string;
  design?: string;
  data_source?: string;
  countries?: string[];
  n?: number;
  rob?: string;
  usable: boolean;
  excluded?: string;
  figure_only?: boolean;
  n_estimates?: number;
  n_contrasts?: number;
}

export interface Pooled {
  v: number;
  lo: number;
  hi: number;
  pil?: number;
  pih?: number;
  p?: number;
  i2?: number;
  tau2?: number;
  tau?: number;
}

/** One study inside an excess / head-to-head pool (or its not-poolable list). */
export interface PoolStudy {
  p: string; // paper_id
  r: string; // row_id (contrast id, or "E1 vs E2" for a derived pair)
  c?: string; // cohort_id
  src?: string; // reported_adjusted | reported_crude | derived_pair
  rm?: string; // reported_measure
  v: number;
  lo?: number;
  hi?: number;
  n?: number;
  ne?: number;
  nc?: number;
  ep?: number; // exposed percent (derived pairs)
  cp?: number; // comparator percent (derived pairs)
  er?: string; // exposed row
  cr?: string; // comparator row
  td?: number; // time_days
  bin?: string;
  o?: string; // outcome_label
  q?: string; // symptom_qualifier
  rob?: string;
  base?: string; // baseline_handling
  lab?: boolean;
  rec?: boolean; // records-based
  vs?: string; // verification_status
  w?: number; // weight percent
  reason?: string; // not-poolable reason
}

export interface Pool {
  id: string;
  fam: string;
  exp: string;
  sev: string;
  bin: string;
  est: string;
  meas: string;
  unit: "percentage_points" | "ratio" | "percent";
  hl?: boolean;
  k: number;
  nt?: number;
  pooled?: Pooled;
  single?: number;
  single_row?: string;
  studies?: PoolStudy[];
  np?: PoolStudy[];
  n_np?: number;
  ps?: string[];
  nd?: number;
  note?: string;
  comp?: string; // comparator_class (excess) / comparator_kind (head-to-head)
  role?: "exposed" | "comparator"; // trajectories
}

export interface SensitivityAnalysis {
  k: number;
  nt?: number;
  v?: number;
  lo?: number;
  hi?: number;
  pil?: number;
  pih?: number;
  i2?: number;
  single?: number;
}

export interface LeaveOneOut {
  omitted?: string;
  k?: number;
  v?: number;
  lo?: number;
  hi?: number;
  i2?: number;
}

export interface Sensitivity {
  exclude_high_risk_of_bias?: SensitivityAnalysis;
  new_onset_or_worsened_only?: SensitivityAnalysis;
  laboratory_confirmed_only?: SensitivityAnalysis;
  exclude_records_based_outcomes?: SensitivityAnalysis;
  leave_one_out?: LeaveOneOut[];
}

export interface SeriesPoint {
  r: string; // row_id
  g?: string; // group label
  o?: string; // outcome label
  tm: number; // time_months
  bin?: string;
  pct: number;
  lo?: number;
  hi?: number;
  cs?: "reported" | "wilson";
  num?: number;
  den?: number;
}

export interface Series {
  id: string;
  cohort: string;
  role: "exposed" | "comparator";
  exp: string;
  exposure?: string;
  sev: string;
  era?: string;
  vax?: string;
  fam: string;
  sym?: string;
  est: string;
  defc?: string;
  base?: string;
  groups?: string[];
  pts: SeriesPoint[];
}

export interface PageData {
  schema: string;
  meta: PageMeta;
  papers: Record<string, Paper>;
  cohorts: Record<string, string>;
  pools: {
    excess: Pool[];
    head_to_head: Pool[];
    trajectories: Pool[];
    sensitivity: Record<string, Sensitivity>;
  };
  series: Series[];
}

export interface LastUpdated {
  generated_at?: string;
  published_at?: string;
  origin?: string;
}

/** Citation fields the client components need, keyed by paper_id. */
export interface PaperLite {
  label: string; // "Smith 2021"
  journal?: string;
  title?: string;
  doi?: string;
  data_source?: string;
  n?: number;
  rob?: string;
  figure_only?: boolean;
}

/** One CSV row, as served by the evidence route. Every value is a string
 *  (empty = null), exactly as in estimates.csv / contrasts.csv. */
export type EvidenceRow = Record<string, string> & { _kind: "estimate" | "contrast" };
