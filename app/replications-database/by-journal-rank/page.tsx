import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { outcomeCodesForRow } from "@/lib/replicationOutcome";
import { RankDashboard } from "./RankDashboard";
import type { RankMeta, JournalRank, PaperRow } from "./types";

export const metadata = {
  title: "Replication Rate by Journal Rank | The Metascience Observatory",
  description:
    "Do papers published in higher-ranked (more prestigious) journals replicate more or less often? Interactive analysis joining the replications database to SCImago SJR journal rankings, percentiles, and quartiles.",
};

type AnyRecord = Record<string, unknown>;

// Metric arrays are length 4: [sjr_percentile, sjr_quartile, sjr_rank, h_index].
type Metric4 = [number | null, number | null, number | null, number | null];
interface RawRankEntry {
  sid: string;
  recentYear: number | null;
  recent: Metric4 | null;
  byYear: Record<string, Metric4>;
}
interface RawRankFile {
  _meta: RankMeta;
  journals: Record<string, RawRankEntry>;
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

export default function ByJournalRankPage() {
  // ---- Load journal-rank lookup (committed, built offline) --------------
  const rankPath = path.join(process.cwd(), "data", "journal_rank_metrics.json");
  const rankFile = JSON.parse(fs.readFileSync(rankPath, "utf8")) as RawRankFile;

  // Journal names are matched case-insensitively (with collapsed whitespace):
  // the source data contains case variants of the same journal (e.g.
  // "Nature Genetics" vs "Nature genetics") that must not split into two rows.
  const normJournal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  // Index the journals that have rank data, merging case variants into one entry;
  // -1 for journals without. When variants collide we union their per-year
  // coverage, keep the first non-null `recent`, and display the best-cased name.
  const journals: JournalRank[] = [];
  const journalIndex = new Map<string, number>();
  const upperCount = (s: string) => (s.match(/[A-Z]/g) ?? []).length;
  for (const [name, entry] of Object.entries(rankFile.journals)) {
    const key = normJournal(name);
    const existingIdx = journalIndex.get(key);
    if (existingIdx === undefined) {
      journalIndex.set(key, journals.length);
      journals.push({ name, recent: entry.recent, byYear: { ...entry.byYear } });
    } else {
      const j = journals[existingIdx];
      j.byYear = { ...entry.byYear, ...j.byYear }; // keep existing on year clash
      if (!j.recent) j.recent = entry.recent;
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

    const outcomes = outcomeCodesForRow(row);

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
        <RankDashboard
          journals={journals}
          rows={paperRows}
          replicationTypes={replicationTypes}
          meta={rankFile._meta}
          csvName={csvName}
        />
      </main>
      <Footer />
    </div>
  );
}
