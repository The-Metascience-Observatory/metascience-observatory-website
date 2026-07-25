// Shared types for the "Replication rate by author overlap" page.

export interface OverlapMeta {
  generated: string;
  source: string;
  note: string;
  csv: string;
  /** Date of the SciSciNet/OpenAlex snapshot used for author lookups. */
  dbSnapshot: string;
}

/** Author overlap between one original paper and one replication paper,
 *  precomputed offline by scripts/build_author_overlap.py. */
export interface PairOverlap {
  /** Shared authors (OpenAlex-ID matches + normalized-name matches), counted
   *  on the original's byline. */
  o: number;
  /** Original byline size. */
  no: number;
  /** Replication byline size. */
  nr: number;
  /** The original's first or last author is among the shared authors. */
  fl: boolean;
  /** Same, counting only ID-verified matches (strict mode). */
  flStrict: boolean;
  /** Shared authors verified by OpenAlex author ID alone (strict mode). */
  im: number;
  /** Source tier: 0 = both papers resolved in SciSciNet/OpenAlex,
   *  1 = OpenAlex API fallback involved, 2 = CSV name-column fallback. */
  t: number;
}

/** One effect-level replication row, pre-classified server-side.
 *  o = 4 outcome codes (stored, significance, orig_in_rep_ci, rep_in_orig_ci),
 *  each one of s=success, f=failure, r=reversal, i=inconclusive/excluded. */
export interface EffectRow {
  /** Index into the pairs array; -1 when the row lacks either DOI. */
  p: number;
  /** Bootstrap cluster = original-paper index (replications of one original
   *  are resampled together). */
  c: number;
  o: string; // 4-char outcome code string
  t: number; // replication type index; -1 if blank
  d: number; // discipline index; -1 if blank
}

export interface CoverageStats {
  totalRows: number;
  rowsWithBothDois: number;
  rowsMatched: number;
}
