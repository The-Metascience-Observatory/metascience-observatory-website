import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { outcomeCodesForRow } from "@/lib/replicationOutcome";
import { CitationCountDashboard } from "./CitationCountDashboard";
import type { CitationsMeta, CoverageStats, EffectRow, PaperCitations } from "./types";

export const metadata = {
  title: "Replication Rate by Citation Count | The Metascience Observatory",
  description:
    "Are highly cited papers more replicable? Citation trajectories of original papers that passed vs. failed replication, reproducing Fig. 1 of Yang, Youyou & Uzzi (PNAS 2020) at ~10x the sample size.",
};

type AnyRecord = Record<string, unknown>;

interface RawCitationsFile {
  _meta: CitationsMeta;
  papers: Record<string, { y: number | null; n: number; by: number[] | null }>;
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

function parseYear(value: unknown): number | null {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  return y >= 1500 && y <= 2100 ? y : null;
}

// Canonicalize a CSV original_url to the citation file's DOI key form:
// https://doi.org/<lowercased doi>. Mirrors normalize_doi_url() in
// scripts/build_original_paper_citations.py.
function normalizeDoiUrl(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(/doi\.org\/(.+)$/);
  if (!m) return null;
  const doi = m[1].replace(/^\/+|\/+$/g, "");
  if (!doi.startsWith("10.")) return null;
  return `https://doi.org/${doi}`;
}

export default function ByCitationCountPage() {
  // ---- Load per-paper citation lookup (committed, built offline) --------
  const citPath = path.join(process.cwd(), "data", "original_paper_citations.json");
  const citFile = JSON.parse(fs.readFileSync(citPath, "utf8")) as RawCitationsFile;

  // ---- Load and classify the replications CSV --------------------------
  const csvName = latestCsvFilename();
  const csvPath = path.join(process.cwd(), "data", csvName);
  const rows = csvParse(fs.readFileSync(csvPath, "utf8")) as unknown as AnyRecord[];

  const paperIndex = new Map<string, number>();
  const papers: PaperCitations[] = [];
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
      const cit = doi ? citFile.papers[doi] : undefined;
      papers.push(
        cit
          ? { y: cit.y ?? parseYear(row.original_year), n: cit.n, by: cit.by }
          : { y: parseYear(row.original_year), n: -1, by: null },
      );
    }
    if (doi && papers[paperId].n >= 0) rowsMatched++;

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
        <CitationCountDashboard
          papers={papers}
          rows={effectRows}
          replicationTypes={replicationTypes}
          meta={citFile._meta}
          csvName={csvName}
          coverage={coverage}
        />
      </main>
      <Footer />
    </div>
  );
}
