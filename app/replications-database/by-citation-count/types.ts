// Shared types for the "Replication rate by citation count" page.

export interface CitationsMeta {
  generated: string;
  source: string;
  note: string;
  csv: string;
  /** Last complete calendar year included in trajectories (current partial year excluded). */
  lastCompleteYear: number;
}

/** One original paper, joined to its OpenAlex citation record by DOI. */
export interface PaperCitations {
  /** Publication year (OpenAlex, falling back to the CSV); null if unknown. */
  y: number | null;
  /** Total citations (OpenAlex cited_by_count); -1 if the DOI was not matched. */
  n: number;
  /** by[t] = citations received t calendar years after publication, through
   *  lastCompleteYear. Null when the paper has no publication year. */
  by: number[] | null;
}

/** One effect-level replication row, pre-classified server-side.
 *  o = 4 outcome codes (stored, significance, orig_in_rep_ci, rep_in_orig_ci),
 *  each one of s=success, f=failure, r=reversal, i=inconclusive/excluded. */
export interface EffectRow {
  p: number; // paper index into PaperCitations[]
  o: string; // 4-char outcome code string
  t: number; // replication type index into the replicationTypes list; -1 if blank
}

export interface CoverageStats {
  totalRows: number;
  rowsWithDoi: number;
  rowsMatched: number;
}
