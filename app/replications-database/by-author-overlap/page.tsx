import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { getOutcomeForRow, type OutcomeMethod } from "@/lib/replicationOutcome";
import { AuthorOverlapDashboard } from "./AuthorOverlapDashboard";
import type { CoverageStats, EffectRow, OverlapMeta, PairOverlap } from "./types";

export const metadata = {
  title: "Replication Rate by Author Overlap | The Metascience Observatory",
  description:
    "Do replications involving the original authors succeed more often? Replication rate by the number of authors shared between the original study and its replication, using disambiguated SciSciNet/OpenAlex author identities.",
};

// The three statistical outcome methods, in the fixed order used by the
// compact per-row outcome string below (index 1..3). Index 0 is the stored
// `result` column. Kept in sync with app/replications-database/page.tsx.
const STAT_METHODS: OutcomeMethod[] = ["significance", "orig_in_rep_ci", "rep_in_orig_ci"];

type AnyRecord = Record<string, unknown>;

interface RawPairRecord {
  o: number;
  no: number;
  nr: number;
  f: number;
  l: number;
  fs: number;
  ls: number;
  im: number;
  nm: number;
  t: number;
}

interface RawOverlapFile {
  _meta: OverlapMeta;
  pairs: Record<string, RawPairRecord>;
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

// Compact per-outcome code: success | failure | reversal | inconclusive/excluded.
function code(outcome: string): string {
  if (outcome === "success") return "s";
  if (outcome === "failure") return "f";
  if (outcome === "reversal") return "r";
  return "i";
}

// The stored `result` column, mapped to the same code alphabet. Reversal is
// treated as a determinate non-replication; inconclusive / blank / anything
// else is excluded from denominators.
function storedCode(result: string): string {
  const r = result.toLowerCase();
  if (r.includes("success")) return "s";
  if (r.includes("failure")) return "f";
  if (r.includes("reversal")) return "r";
  return "i";
}

// Canonicalize a CSV URL to the overlap file's DOI key form:
// https://doi.org/<lowercased doi>. Mirrors normalize_doi_url() in
// scripts/build_author_overlap.py.
function normalizeDoiUrl(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(/doi\.org\/(.+)$/);
  if (!m) return null;
  const doi = m[1].replace(/^\/+|\/+$/g, "");
  if (!doi.startsWith("10.")) return null;
  return `https://doi.org/${doi}`;
}

function toPairOverlap(rec: RawPairRecord): PairOverlap {
  return {
    o: rec.o,
    no: rec.no,
    nr: rec.nr,
    fl: !!(rec.f || rec.l),
    flStrict: !!(rec.fs || rec.ls),
    im: rec.im,
    t: rec.t,
  };
}

export default function ByAuthorOverlapPage() {
  // ---- Load per-pair author overlap lookup (committed, built offline) ----
  const overlapPath = path.join(process.cwd(), "data", "author_overlap.json");
  const overlapFile = JSON.parse(fs.readFileSync(overlapPath, "utf8")) as RawOverlapFile;

  // ---- Load and classify the replications CSV ---------------------------
  const csvName = latestCsvFilename();
  const csvPath = path.join(process.cwd(), "data", csvName);
  const rows = csvParse(fs.readFileSync(csvPath, "utf8")) as unknown as AnyRecord[];

  const pairIndex = new Map<string, number>();
  const pairs: (PairOverlap | null)[] = [];
  const clusterIndex = new Map<string, number>();
  let clusterCount = 0;
  const effectRows: EffectRow[] = [];
  const typeIndex = new Map<string, number>();
  const replicationTypes: string[] = [];
  const disciplineIndex = new Map<string, number>();
  const disciplines: string[] = [];
  let rowsWithBothDois = 0;
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

    const disc = String(row.discipline ?? "").trim();
    let d = -1;
    if (disc) {
      if (!disciplineIndex.has(disc)) {
        disciplineIndex.set(disc, disciplines.length);
        disciplines.push(disc);
      }
      d = disciplineIndex.get(disc) as number;
    }

    const origUrl = String(row.original_url ?? "").trim();
    const origDoi = normalizeDoiUrl(origUrl);
    const repDoi = normalizeDoiUrl(String(row.replication_url ?? "").trim());

    // Pair index: -1 when either DOI is missing (row excluded client-side).
    let p = -1;
    if (origDoi && repDoi) {
      rowsWithBothDois++;
      const pairKey = `${origDoi}|${repDoi}`;
      let pairId = pairIndex.get(pairKey);
      if (pairId === undefined) {
        pairId = pairs.length;
        pairIndex.set(pairKey, pairId);
        const rec = overlapFile.pairs[pairKey];
        pairs.push(rec ? toPairOverlap(rec) : null);
      }
      p = pairId;
      if (pairs[p]) rowsMatched++;
    }

    // Bootstrap cluster = original paper: fall back to the raw URL or a
    // per-row id when the DOI is missing so the row still forms one cluster.
    const clusterKey = origDoi ?? (origUrl || `__row_${effectRows.length}`);
    let c = clusterIndex.get(clusterKey);
    if (c === undefined) {
      c = clusterCount++;
      clusterIndex.set(clusterKey, c);
    }

    const outcomes =
      storedCode(String(row.result ?? "")) +
      STAT_METHODS.map((m) => code(getOutcomeForRow(row, m))).join("");

    effectRows.push({ p, c, o: outcomes, t, d });
  }

  const coverage: CoverageStats = {
    totalRows: effectRows.length,
    rowsWithBothDois,
    rowsMatched,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ReplicationsNavbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <AuthorOverlapDashboard
          pairs={pairs}
          rows={effectRows}
          replicationTypes={replicationTypes}
          disciplines={disciplines}
          meta={overlapFile._meta}
          csvName={csvName}
          coverage={coverage}
        />
      </main>
      <Footer />
    </div>
  );
}
