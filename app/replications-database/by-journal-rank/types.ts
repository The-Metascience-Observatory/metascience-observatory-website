// Shared types for the "Replication rate by journal rank" page.
// Metric arrays are always, in this fixed order:
//   [sjr_percentile, sjr_quartile, sjr_rank, h_index]
// - sjr_percentile: 0–100, 100 = top-ranked journal that year (per publication year)
// - sjr_quartile:   1–4 integer, 1 = Q1 (best category quartile) (per year)
// - sjr_rank:       raw SCImago overall rank, 1 = best that year (per year; not
//                   comparable across years — use percentile for that)
// - h_index:        journal h-index — a per-journal snapshot, same on every entry
export type MetricQuad = [
  number | null,
  number | null,
  number | null,
  number | null,
];

export interface RankMeta {
  generated: string;
  source: string;
  note: string;
  attribution: string;
  csv: string;
  snapshotYear: number | null;
  metrics: string[];
}

export interface JournalRank {
  name: string;
  /** Recent-snapshot metrics (latest available year), or null if unavailable. */
  recent: MetricQuad | null;
  /** Publication-year metrics, keyed by year string. */
  byYear: Record<string, MetricQuad>;
}

/** One effect-level replication row, pre-classified server-side.
 *  o = 4 outcome codes (stored, significance, orig_in_rep_ci, rep_in_orig_ci),
 *  each one of s=success, f=failure, r=reversal, i=inconclusive/excluded. */
export interface PaperRow {
  p: number; // paper id (index of original_url)
  j: number; // journal index into JournalRank[]; -1 if the journal has no rank data
  y: number | null; // original publication year
  o: string; // 4-char outcome code string
  t: number; // replication type index into the replicationTypes list; -1 if blank
}
