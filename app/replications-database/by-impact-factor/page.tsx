import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { getOutcomeForRow, type OutcomeMethod } from "@/lib/replicationOutcome";
import { ImpactFactorDashboard } from "./ImpactFactorDashboard";
import type { IFMeta, JournalIF, PaperRow } from "./types";

export const metadata = {
  title: "Replication Rate by Journal Impact Factor | The Metascience Observatory",
  description:
    "Do papers published in higher-impact-factor journals replicate more or less often? Interactive analysis joining the replications database to OpenAlex-derived journal impact factors.",
};

// The three statistical outcome methods, in the fixed order used by the
// compact per-row outcome string below (index 1..3). Index 0 is the stored
// `result` column. Kept in sync with app/replications-database/page.tsx.
const STAT_METHODS: OutcomeMethod[] = ["significance", "orig_in_rep_ci", "rep_in_orig_ci"];

type AnyRecord = Record<string, unknown>;

// Metric arrays are length 5: [if2, if5, citescore, openalex_2yr, scimago_sjr].
type Metric5 = [number | null, number | null, number | null, number | null, number | null];
interface RawIFEntry {
  sid: string;
  recentYear: number | null;
  recent: Metric5 | null;
  byYear: Record<string, Metric5>;
}
interface RawIFFile {
  _meta: IFMeta;
  journals: Record<string, RawIFEntry>;
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
// treated as a determinate non-replication (unlike the by-journal table, which
// drops it); inconclusive / blank / anything else is excluded from denominators.
function storedCode(result: string): string {
  const r = result.toLowerCase();
  if (r.includes("success")) return "s";
  if (r.includes("failure")) return "f";
  if (r.includes("reversal")) return "r";
  return "i";
}

function parseYear(value: unknown): number | null {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  return y >= 1500 && y <= 2100 ? y : null;
}

export default function ByImpactFactorPage() {
  // ---- Load impact-factor lookup (committed, built offline) -------------
  const ifPath = path.join(process.cwd(), "data", "journal_impact_factors.json");
  const ifFile = JSON.parse(fs.readFileSync(ifPath, "utf8")) as RawIFFile;

  // Journal names are matched case-insensitively (with collapsed whitespace):
  // the source data contains case variants of the same journal (e.g.
  // "Nature Genetics" vs "Nature genetics") that must not split into two rows.
  const normJournal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  // Index the journals that have IF data, merging case variants into one entry;
  // -1 for journals without. When variants collide we union their per-year
  // coverage, keep the first non-null `recent`, and display the best-cased name.
  const journals: JournalIF[] = [];
  const journalIndex = new Map<string, number>();
  const upperCount = (s: string) => (s.match(/[A-Z]/g) ?? []).length;
  for (const [name, entry] of Object.entries(ifFile.journals)) {
    const key = normJournal(name);
    const existingIdx = journalIndex.get(key);
    if (existingIdx === undefined) {
      journalIndex.set(key, journals.length);
      journals.push({ name, recent: entry.recent, byYear: { ...entry.byYear } });
    } else {
      const j = journals[existingIdx];
      j.byYear = { ...entry.byYear, ...j.byYear }; // keep existing on year clash
      if (!j.recent) j.recent = entry.recent;
      // Prefer the more richly-cased display name (Title Case over lowercase).
      if (upperCount(name) > upperCount(j.name)) j.name = name;
    }
  }

  // ---- Load and classify the replications CSV --------------------------
  const csvName = latestCsvFilename();
  const csvPath = path.join(process.cwd(), "data", csvName);
  const rows = csvParse(fs.readFileSync(csvPath, "utf8")) as unknown as AnyRecord[];

  const paperIndex = new Map<string, number>();
  const paperRows: PaperRow[] = [];
  const typeIndex = new Map<string, number>();
  const replicationTypes: string[] = [];

  for (const row of rows) {
    const journal = String(row.original_journal ?? "").trim();
    if (!journal) continue;

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
    // Group effect-level rows into papers by original_url; fall back to a
    // per-row id when the DOI is missing so the row still counts as one paper.
    const paperKey = url || `__row_${paperRows.length}`;
    let paperId = paperIndex.get(paperKey);
    if (paperId === undefined) {
      paperId = paperIndex.size;
      paperIndex.set(paperKey, paperId);
    }

    const outcomes =
      storedCode(String(row.result ?? "")) +
      STAT_METHODS.map((m) => code(getOutcomeForRow(row, m))).join("");

    paperRows.push({
      p: paperId,
      j: journalIndex.get(normJournal(journal)) ?? -1,
      y: parseYear(row.original_year),
      o: outcomes,
      t,
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ReplicationsNavbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <ImpactFactorDashboard
          journals={journals}
          rows={paperRows}
          replicationTypes={replicationTypes}
          meta={ifFile._meta}
          csvName={csvName}
        />
      </main>
      <Footer />
    </div>
  );
}
