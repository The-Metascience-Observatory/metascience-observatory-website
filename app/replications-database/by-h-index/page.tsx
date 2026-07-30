import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { outcomeCodesForRow } from "@/lib/replicationOutcome";
import { HIndexDashboard } from "./HIndexDashboard";
import type { CoverageStats, EffectRow, HIndexMeta, PaperHIndex } from "./types";

export const metadata = {
  title: "Replication Rate by Author h-index | The Metascience Observatory",
  description:
    "Are papers by eminent researchers more replicable? Replication rate of original papers by the h-index of their authors (mean, max, first and last author), using SciSciNet/OpenAlex author metrics.",
};

type AnyRecord = Record<string, unknown>;

interface RawHIndexFile {
  _meta: HIndexMeta;
  papers: Record<string, { a: number[]; f: number | null; l: number | null }>;
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

// Canonicalize a CSV original_url to the h-index file's DOI key form:
// https://doi.org/<lowercased doi>. Mirrors normalize_doi_url() in
// scripts/build_author_h_index.py.
function normalizeDoiUrl(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(/doi\.org\/(.+)$/);
  if (!m) return null;
  const doi = m[1].replace(/^\/+|\/+$/g, "");
  if (!doi.startsWith("10.")) return null;
  return `https://doi.org/${doi}`;
}

const UNMATCHED: PaperHIndex = { mean: null, max: null, first: null, last: null, na: 0 };

function toPaperHIndex(rec: { a: number[]; f: number | null; l: number | null }): PaperHIndex {
  const a = rec.a;
  if (a.length === 0) return UNMATCHED;
  return {
    mean: a.reduce((x, y) => x + y, 0) / a.length,
    max: Math.max(...a),
    first: rec.f,
    last: rec.l,
    na: a.length,
  };
}

export default function ByHIndexPage() {
  // ---- Load per-paper author h-index lookup (committed, built offline) ---
  const hPath = path.join(process.cwd(), "data", "original_paper_h_index.json");
  const hFile = JSON.parse(fs.readFileSync(hPath, "utf8")) as RawHIndexFile;

  // ---- Load and classify the replications CSV --------------------------
  const csvName = latestCsvFilename();
  const csvPath = path.join(process.cwd(), "data", csvName);
  const rows = csvParse(fs.readFileSync(csvPath, "utf8")) as unknown as AnyRecord[];

  const paperIndex = new Map<string, number>();
  const papers: PaperHIndex[] = [];
  const effectRows: EffectRow[] = [];
  const typeIndex = new Map<string, number>();
  const replicationTypes: string[] = [];
  let rowsWithDoi = 0;
  let rowsMatched = 0;

  for (const row of rows) {
    const rtype = String(row.replication_type ?? "").trim();
    let t = -1;
    if (rtype) {
      if (!typeIndex.has(rtype)) {
        typeIndex.set(rtype, replicationTypes.length);
        replicationTypes.push(rtype);
      }
      t = typeIndex.get(rtype) as number;
    }

    const url = String(row.original_url ?? "").trim();
    const doi = normalizeDoiUrl(url);
    if (doi) rowsWithDoi++;
    // Group effect-level rows into papers by DOI; fall back to the raw URL or
    // a per-row id when the DOI is missing so the row still counts as one paper.
    const paperKey = doi ?? (url || `__row_${effectRows.length}`);
    let paperId = paperIndex.get(paperKey);
    if (paperId === undefined) {
      paperId = papers.length;
      paperIndex.set(paperKey, paperId);
      const rec = doi ? hFile.papers[doi] : undefined;
      papers.push(rec ? toPaperHIndex(rec) : UNMATCHED);
    }
    if (doi && papers[paperId].na > 0) rowsMatched++;

    const outcomes = outcomeCodesForRow(row);

    effectRows.push({ p: paperId, o: outcomes, t });
  }

  const coverage: CoverageStats = {
    totalRows: effectRows.length,
    rowsWithDoi,
    rowsMatched,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ReplicationsNavbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <HIndexDashboard
          papers={papers}
          rows={effectRows}
          replicationTypes={replicationTypes}
          meta={hFile._meta}
          csvName={csvName}
          coverage={coverage}
        />
      </main>
      <Footer />
    </div>
  );
}
