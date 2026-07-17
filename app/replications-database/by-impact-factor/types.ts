// Shared types for the "Replication rate by journal impact factor" page.
// Metric arrays are always, in this fixed order:
//   [impact_factor_2yr, impact_factor_5yr, citescore,
//    openalex_2yr_mean_citedness, scimago_sjr]
// The first three are self-computed ("OpenAlex-derived"); index 3 is OpenAlex's
// own published 2-year mean citedness (a current snapshot, same on every year
// entry); index 4 is the SCImago SJR for that publication year.
// One value per metric in _meta.metrics (currently 6): if2, if5, citescore,
// openalex_2yr_mean_citedness, scimago_sjr, scimago_cites_per_citable_doc_3yr.
export type MetricTriple = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

export interface IFMeta {
  generated: string;
  source: string;
  note: string;
  csv: string;
  snapshotYear: number;
  metrics: string[];
}

export interface JournalIF {
  name: string;
  /** Recent-snapshot metrics (snapshotYear), or null if unavailable. */
  recent: MetricTriple | null;
  /** Publication-year metrics, keyed by year string. */
  byYear: Record<string, MetricTriple>;
}

/** One effect-level replication row, pre-classified server-side.
 *  o = 4 outcome codes (stored, significance, orig_in_rep_ci, rep_in_orig_ci),
 *  each one of s=success, f=failure, r=reversal, i=inconclusive/excluded. */
export interface PaperRow {
  p: number; // paper id (index of original_url)
  j: number; // journal index into JournalIF[]; -1 if the journal has no IF data
  y: number | null; // original publication year
  o: string; // 4-char outcome code string
  t: number; // replication type index into the replicationTypes list; -1 if blank
}
