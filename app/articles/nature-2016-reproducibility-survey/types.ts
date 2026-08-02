// Typed props computed server-side in page.tsx from the raw survey TSV.
// One interface per chart series, then SurveyDashboardProps collecting them all
// (same organization as app/birds-eye-reviews/long-covid/types.ts).

/** One slice of a part-to-whole question (crisis opinion, lab procedures). */
export interface OpinionSlice {
  key: string;
  label: string;
  count: number;
  pct: number; // 0–100, one decimal
}

/** One row of the "publishing replication attempts" grouped bar chart. */
export interface PublishingBar {
  key: "successful" | "unsuccessful";
  label: string;
  publishedCount: number;
  publishedPct: number;
  failedToPublishCount: number;
  failedToPublishPct: number;
}

/**
 * Union stats across the two "published a replication" checkboxes — the
 * headline calculation this page adds on top of the article's own figures.
 */
export interface PublishedAnyStats {
  anyCount: number;
  anyPct: number;
  successfulCount: number;
  successfulPct: number;
  failedCount: number;
  failedPct: number;
  bothCount: number;
  bothPct: number;
}

/** One discipline row of the "have you failed to reproduce?" chart. */
export interface DisciplineFailureBar {
  discipline: string;
  n: number;
  someoneElsePct: number;
  ownPct: number;
}

/** One bucket of the "% of your field that is reproducible" distribution. */
export interface ReproducibleBucket {
  bucket: string; // "0%" … "100%"
  count: number;
  pct: number; // share of the panel's own respondents
}

/** One small-multiple panel: the distribution within a single discipline. */
export interface DisciplineReproducibleDist {
  discipline: string;
  n: number;
  median: number; // median estimated % reproducible
  buckets: ReproducibleBucket[];
}

/** One factor row of a stacked Likert-style chart (contributes / improves). */
export interface LikertBar {
  label: string;
  strongPct: number; // "always/very often contributes" or "very likely"
  softPct: number; // "sometimes contributes" or "likely"
}

export interface SummaryStats {
  totalRespondents: number;
  significantCrisisPct: number;
  anyCrisisPct: number; // significant + slight
  failedSomeoneElsePct: number;
  publishedAnyPct: number;
  publishedAnyCount: number;
}

export interface SurveyDashboardProps {
  summary: SummaryStats;
  crisis: OpinionSlice[];
  procedures: OpinionSlice[];
  publishing: PublishingBar[];
  publishedAny: PublishedAnyStats;
  failedByDiscipline: DisciplineFailureBar[];
  reproducibleByDiscipline: DisciplineReproducibleDist[];
  contributingFactors: LikertBar[];
  improvementFactors: LikertBar[];
}
