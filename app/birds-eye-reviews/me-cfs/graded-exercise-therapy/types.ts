/** Shared types + formatting helpers for the Graded Exercise Therapy (GET)
 *  meta-analysis sub-page. These mirror the shape of
 *  data/birds_eye_reviews/me_cfs/get_meta_analysis.json and get_prisma.json.
 *  Every field the page renders comes from those files. */

export interface GetTrial {
  paper_id: string;
  first_author: string;
  year: number;
  effect: number;
  ci_low: number | null;
  ci_high: number | null;
  p_value?: string | number | null;
  n_total: number | null;
  outcome_name: string | null;
  weight: number | null;
  /** harms group only: "events/n" strings for the GET / control arms. */
  get?: string;
  control?: string;
}

export interface GetPooled {
  effect: number;
  ci_low: number;
  ci_high: number;
  i2: number;
  tau2?: number;
  model: string;
  ci_method?: string;
  pred_low?: number;
  pred_high?: number;
}

export interface GetDowngrade {
  domain: string;
  reason: string;
}

export interface GetCertainty {
  grade: string;
  start: string;
  downgrades: GetDowngrade[];
}

export interface GetSubgroupCell {
  k: number;
  effect: number;
  ci_low: number;
  ci_high: number;
  i2: number;
}

export interface GetSubgroups {
  oxford?: GetSubgroupCell;
  non_oxford?: GetSubgroupCell;
  adult?: GetSubgroupCell;
  pediatric?: GetSubgroupCell;
}

export interface GetLeaveOne {
  omitted: string;
  effect: number;
  ci_low: number;
  ci_high: number;
}

export interface GetSensitivity {
  fixed_or_dl_normal?: { effect: number; ci_low: number; ci_high: number };
  leave_one_out?: GetLeaveOne[];
  exclude_powell?: { k: number; effect: number; ci_low: number; ci_high: number; i2: number };
}

export interface GetGroup {
  ingredient: string;
  outcome_domain: "fatigue" | "physical_function" | "harms" | string;
  effect_measure: "smd" | "risk_ratio" | string;
  scale: string;
  n_trials: number;
  reference_higher_is_better: boolean;
  trials: GetTrial[];
  pooled: GetPooled | null;
  certainty?: GetCertainty;
  subgroups?: GetSubgroups;
  sensitivity?: GetSensitivity;
}

export interface GetMetaAnalysis {
  min_trials?: number;
  topic?: string;
  generated_note?: string;
  groups: GetGroup[];
}

export interface GetPrisma {
  records_identified: number;
  records_screened: number;
  records_excluded: number;
  exclusion_reasons: Record<string, number>;
  reports_included_papers: number;
  studies_included_trials: number;
  trials_in_quantitative_synthesis: { fatigue: number; physical_function: number; harms: number };
  trials_excluded_from_primary_pool: { trial: string; reason: string }[];
  included_trials: {
    trial: string;
    year: number;
    pmid?: string;
    n_randomized: number;
    criteria: string;
    age: string;
  }[];
  sources?: string[];
}

/** Compact number format: 2 dp under 10, 1 dp under 100, 0 dp above. Mirrors
 *  the RLS dashboard's fmt() so the forest plots read the same. */
export function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  return a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(1) : n.toFixed(2);
}

/** SMD to two decimals, always signed for readability of direction. */
export function fmtSmd(n: number | null | undefined, signed = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n.toFixed(2);
  return signed && n > 0 ? `+${s}` : s;
}

export const DOMAIN_LABEL: Record<string, string> = {
  fatigue: "Fatigue",
  physical_function: "Physical function",
  harms: "Harms",
};

export function prettyDomain(d: string): string {
  return DOMAIN_LABEL[d] ?? d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** GRADE certainty -> badge label + tailwind tone classes (theme-aware). */
export const GRADE_STYLE: Record<string, { label: string; cls: string }> = {
  high: { label: "High certainty", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  moderate: { label: "Moderate certainty", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" },
  low: { label: "Low certainty", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  very_low: { label: "Very-low certainty", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300" },
};

export function gradeBadge(grade: string | undefined): { label: string; cls: string } {
  return (grade && GRADE_STYLE[grade]) || { label: grade ?? "—", cls: "bg-foreground/10 text-foreground/70" };
}

/** Build the outbound link for a trial paper_id (DOI or PMID). */
export function trialHref(paperId: string | undefined): string | null {
  if (!paperId) return null;
  if (paperId.startsWith("10.")) return `https://doi.org/${paperId}`;
  if (/^\d+$/.test(paperId)) return `https://pubmed.ncbi.nlm.nih.gov/${paperId}/`;
  return null;
}
