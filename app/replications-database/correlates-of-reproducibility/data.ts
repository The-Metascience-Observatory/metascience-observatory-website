import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { classifyReportedResult } from "@/lib/replicationOutcome";

/**
 * Server-only assembly of the correlates dataset: one row per replicated
 * effect with the fractional outcome and every predictor joined on.
 *
 * Shared by page.tsx and scripts/check_logit_lib.ts so the page and the
 * verification script cannot drift apart; the joins are mirrored independently
 * in Python by scripts/check_logit.py.
 */

type AnyRecord = Record<string, unknown>;

export interface AssembledRow {
  /** Cluster id: normalized original DOI, else the raw URL, else a per-row id. */
  cluster: string;
  /** Fractional outcome: 1 success, 0 failure/reversal, 0.5 inconclusive. */
  y: number;
  year: number | null;
  /** OpenAlex 2-yr mean citedness, recent snapshot; null when missing or ≤ 0. */
  impactFactor: number | null;
  /** SCImago SJR percentile (higher = better). */
  sjrPct: number | null;
  /**
   * OpenAlex citations of the original paper in its first two calendar years
   * (by[0] + by[1]; 0 is valid). Age-windowed rather than total, so old and
   * recent papers are compared on the same footing.
   */
  citations: number | null;
  hFirst: number | null;
  hLast: number | null;
  hMean: number | null;
  hMax: number | null;
  /** Shared authors between original and replication bylines. */
  overlap: number | null;
  /** Original p-value, only when reported exactly (type "="). */
  exactP: number | null;
}

export interface DatasetMeta {
  csvName: string;
  totalRows: number;
  /** Rows with a recorded result (the dataset the page describes). */
  usableRows: number;
  droppedBlankResult: number;
  /** Result-recorded rows whose journal IF was exactly 0 (log undefined). */
  droppedIfZero: number;
  papers: number;
  /** Non-null count per predictor among usable rows. */
  coverage: {
    year: number;
    impactFactor: number;
    sjrPct: number;
    citations: number;
    hFirst: number;
    hLast: number;
    hMean: number;
    hMax: number;
    overlap: number;
    exactP: number;
  };
}

function latestCsvFilename(): string {
  const versionHistoryPath = path.join(process.cwd(), "data", "version_history.txt");
  const text = fs.readFileSync(versionHistoryPath, "utf8");
  const lines = text
    .trim()
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"));
  return lines[lines.length - 1].split("#")[0].trim();
}

// Canonicalize a DOI URL to the predictor files' key form:
// https://doi.org/<lowercased doi>. Mirrors normalize_doi_url() in the
// scripts/build_*.py builders.
function normalizeDoiUrl(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(/doi\.org\/(.+)$/);
  if (!m) return null;
  const doi = m[1].replace(/^\/+|\/+$/g, "");
  if (!doi.startsWith("10.")) return null;
  return `https://doi.org/${doi}`;
}

function parseYear(value: unknown): number | null {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  return y >= 1500 && y <= 2100 ? y : null;
}

// Metric tuples in journal_impact_factors.json are length 6:
// [if2, if5, citescore, openalex_2yr_mean_citedness, scimago_sjr,
//  scimago_cites_per_citable_doc_3yr]. Index 3 is the site's default metric.
type Metric6 = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];
// journal_rank_metrics.json quads: [sjr_percentile, sjr_quartile, sjr_rank, h_index].
type Metric4 = [number | null, number | null, number | null, number | null];

interface JournalEntry<M> {
  recent: M | null;
}

// Journal names are matched case-insensitively with collapsed whitespace; the
// source data contains case variants of the same journal that must be merged,
// keeping the first non-null `recent` (a variant with recent: null can
// otherwise shadow real data). Same logic as by-impact-factor/page.tsx.
function indexJournals<M>(raw: Record<string, { recent: M | null }>): Map<string, JournalEntry<M>> {
  const normJournal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const out = new Map<string, JournalEntry<M>>();
  for (const [name, entry] of Object.entries(raw)) {
    const key = normJournal(name);
    const existing = out.get(key);
    if (!existing) {
      out.set(key, { recent: entry.recent });
    } else if (!existing.recent) {
      existing.recent = entry.recent;
    }
  }
  return out;
}

export function buildDataset(): { rows: AssembledRow[]; meta: DatasetMeta } {
  const dataDir = path.join(process.cwd(), "data");
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));

  const ifFile = read("journal_impact_factors.json") as {
    journals: Record<string, { recent: Metric6 | null }>;
  };
  const rankFile = read("journal_rank_metrics.json") as {
    journals: Record<string, { recent: Metric4 | null }>;
  };
  const citFile = read("original_paper_citations.json") as {
    papers: Record<string, { n: number; by: number[] }>;
  };
  const hFile = read("original_paper_h_index.json") as {
    papers: Record<string, { a: number[]; f: number | null; l: number | null }>;
  };
  const overlapFile = read("author_overlap.json") as {
    pairs: Record<string, { o: number }>;
  };

  const ifIndex = indexJournals(ifFile.journals);
  const rankIndex = indexJournals(rankFile.journals);
  const normJournal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  const csvName = latestCsvFilename();
  const csvRows = csvParse(
    fs.readFileSync(path.join(dataDir, csvName), "utf8"),
  ) as unknown as AnyRecord[];

  const rows: AssembledRow[] = [];
  let droppedBlankResult = 0;
  let droppedIfZero = 0;
  const clusters = new Set<string>();
  const coverage = {
    year: 0,
    impactFactor: 0,
    sjrPct: 0,
    citations: 0,
    hFirst: 0,
    hLast: 0,
    hMean: 0,
    hMax: 0,
    overlap: 0,
    exactP: 0,
  };

  for (const row of csvRows) {
    // A blank result is "unrecorded", not "inconclusive" — it must be dropped
    // here, because classifyReportedResult maps anything unrecognized
    // (including "") to "inconclusive", which would silently become y = 0.5.
    const resultRaw = String(row.result ?? "").trim();
    if (!resultRaw) {
      droppedBlankResult++;
      continue;
    }
    const outcome = classifyReportedResult(resultRaw);
    const y = outcome === "success" ? 1 : outcome === "failure" || outcome === "reversal" ? 0 : 0.5;

    const url = String(row.original_url ?? "").trim();
    const origDoi = normalizeDoiUrl(url);
    const cluster = origDoi ?? (url || `__row_${rows.length}`);
    clusters.add(cluster);

    const year = parseYear(row.original_year);

    const journalKey = normJournal(String(row.original_journal ?? ""));
    const ifRecent = journalKey ? (ifIndex.get(journalKey)?.recent ?? null) : null;
    let impactFactor: number | null = ifRecent ? ifRecent[3] : null;
    if (impactFactor !== null && impactFactor <= 0) {
      droppedIfZero++;
      impactFactor = null;
    }
    const rankRecent = journalKey ? (rankIndex.get(journalKey)?.recent ?? null) : null;
    const sjrPct = rankRecent ? rankRecent[0] : null;

    // First two complete calendar years only (same convention as the
    // by-citation-count page's age-windowed metric).
    const citRec = origDoi ? citFile.papers[origDoi] : undefined;
    const citations =
      citRec && Array.isArray(citRec.by) && citRec.by.length >= 2
        ? citRec.by[0] + citRec.by[1]
        : null;

    const hRec = origDoi ? hFile.papers[origDoi] : undefined;
    const hAll = hRec && hRec.a.length > 0 ? hRec.a : null;
    const hMean = hAll ? hAll.reduce((a, b) => a + b, 0) / hAll.length : null;
    const hMax = hAll ? Math.max(...hAll) : null;
    const hFirst = hRec?.f ?? null;
    const hLast = hRec?.l ?? null;

    const repDoi = normalizeDoiUrl(String(row.replication_url ?? ""));
    const overlapRec =
      origDoi && repDoi ? overlapFile.pairs[`${origDoi}|${repDoi}`] : undefined;
    const overlap = overlapRec ? overlapRec.o : null;

    const pType = String(row.original_p_value_type ?? "").trim();
    const pRaw = Number(String(row.original_p_value ?? "").trim());
    const exactP = pType === "=" && Number.isFinite(pRaw) && pRaw > 0 && pRaw <= 1 ? pRaw : null;

    if (year !== null) coverage.year++;
    if (impactFactor !== null) coverage.impactFactor++;
    if (sjrPct !== null) coverage.sjrPct++;
    if (citations !== null) coverage.citations++;
    if (hFirst !== null) coverage.hFirst++;
    if (hLast !== null) coverage.hLast++;
    if (hMean !== null) coverage.hMean++;
    if (hMax !== null) coverage.hMax++;
    if (overlap !== null) coverage.overlap++;
    if (exactP !== null) coverage.exactP++;

    rows.push({
      cluster,
      y,
      year,
      impactFactor,
      sjrPct,
      citations,
      hFirst,
      hLast,
      hMean,
      hMax,
      overlap,
      exactP,
    });
  }

  return {
    rows,
    meta: {
      csvName,
      totalRows: csvRows.length,
      usableRows: rows.length,
      droppedBlankResult,
      droppedIfZero,
      papers: clusters.size,
      coverage,
    },
  };
}
