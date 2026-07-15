// Shared types for the "Replication rate by author h-index" page.

export interface HIndexMeta {
  generated: string;
  source: string;
  note: string;
  csv: string;
  /** Date of the SciSciNet/OpenAlex snapshot the h-indexes were read from. */
  dbSnapshot: string;
}

/** One original paper's author h-index statistics, precomputed server-side.
 *  All four are null when the paper couldn't support the statistic; a paper
 *  with no match at all has every field null and na = 0. */
export interface PaperHIndex {
  /** Mean h-index across the authors with a known h-index. */
  mean: number | null;
  /** Highest h-index on the byline. */
  max: number | null;
  /** First-author h-index. */
  first: number | null;
  /** Last-author h-index (= first for single-author papers). */
  last: number | null;
  /** Number of authors with a known h-index (0 = unmatched paper). */
  na: number;
}

/** One effect-level replication row, pre-classified server-side.
 *  o = 4 outcome codes (stored, significance, orig_in_rep_ci, rep_in_orig_ci),
 *  each one of s=success, f=failure, r=reversal, i=inconclusive/excluded. */
export interface EffectRow {
  p: number; // paper index into PaperHIndex[]
  o: string; // 4-char outcome code string
  t: number; // replication type index into the replicationTypes list; -1 if blank
}

export interface CoverageStats {
  totalRows: number;
  rowsWithDoi: number;
  rowsMatched: number;
}
