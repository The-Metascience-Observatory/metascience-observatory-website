import fs from "fs";
import path from "path";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { parseCSV, stripTags, normalizeTitle } from "../screening/csv-utils";
import { ForestGroup } from "../ForestPlot";
import { MetaAnalysisClientWrapper } from "./MetaAnalysisClientWrapper";

export const metadata = {
  title: "Meta-Analysis | Restless Legs Syndrome | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Random-effects meta-analyses (forest plots) of the human clinical trials of restless legs syndrome treatments.",
};

const DATA_DIR = "data/birds_eye_reviews/restless_legs_syndrome";
const dataPath = (f: string) => path.join(process.cwd(), DATA_DIR, f);

interface Citation {
  title: string;
  authors: string;
  journal: string;
  year: string;
}

/** First-author surname from a "First Last; ..." or "Last, F; ..." author list. */
function firstAuthorSurname(authors: string): string {
  if (!authors) return "";
  const first = authors.split(/[;]| and /)[0].trim();
  if (first.includes(",")) return first.slice(0, first.indexOf(",")).trim();
  const toks = first.split(/\s+/).filter(Boolean);
  if (toks.length === 0) return "";
  // "Surname IN" (PubMed) -> Surname; "First Last" -> Last
  const lastTok = toks[toks.length - 1];
  if (toks.length >= 2 && /^[A-Z]{1,3}\.?$/.test(lastTok)) return toks[0];
  return lastTok;
}

/** doi -> citation metadata from trial_screening.csv (reused screening feed). */
function loadCitations(): Map<string, Citation> {
  const map = new Map<string, Citation>();
  const fp = dataPath("trial_screening.csv");
  if (!fs.existsSync(fp)) return map;
  const records = parseCSV(fs.readFileSync(fp, "utf-8"));
  if (records.length === 0) return map;
  const h = records[0].map((x) => x.trim());
  const idx = (name: string) => h.indexOf(name);
  const di = idx("doi");
  for (const row of records.slice(1)) {
    const doi = (row[di] ?? "").trim();
    if (!doi || map.has(doi)) continue;
    map.set(doi, {
      title: normalizeTitle(stripTags(row[idx("paper_title")] ?? "")).slice(0, 250),
      authors: stripTags(row[idx("paper_authors")] ?? "").slice(0, 200),
      journal: stripTags(row[idx("paper_journal")] ?? "").slice(0, 120),
      year: (row[idx("paper_year")] ?? "").trim(),
    });
  }
  return map;
}

function labelFor(doi: string, cite: Citation | undefined, fallbackYear: number | null): string {
  const surname = cite ? firstAuthorSurname(cite.authors) : "";
  const year = cite?.year || (fallbackYear != null ? String(fallbackYear) : "");
  if (surname && year) return `${surname} ${year}`;
  if (surname) return surname;
  return doi;
}

/** meta_analysis.json -> ForestGroup[], trials enriched with author-year labels. */
function loadForestGroups(cites: Map<string, Citation>): { groups: ForestGroup[]; minTrials: number } {
  const fp = dataPath("meta_analysis.json");
  if (!fs.existsSync(fp)) return { groups: [], minTrials: 3 };
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8")) as {
      min_trials: number;
      groups: ForestGroup[];
    };
    const groups = (raw.groups ?? []).map((g) => ({
      ...g,
      trials: g.trials.map((t) => {
        // Arm-split points carry "<doi>#<arm>"; resolve to base DOI for the
        // citation label and the outbound link.
        const base = (t.paper_id ?? "").split("#")[0];
        return {
          ...t,
          doi: base,
          label: labelFor(t.paper_id, cites.get(base), t.year ?? null),
        };
      }),
    }));
    return { groups, minTrials: raw.min_trials ?? 3 };
  } catch (e) {
    console.error("Failed to load meta_analysis.json:", e);
    return { groups: [], minTrials: 3 };
  }
}

export default function MetaAnalysisPage() {
  const hasFile = fs.existsSync(dataPath("meta_analysis.json"));
  const cites = loadCitations();
  const { groups } = loadForestGroups(cites);

  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto px-4 pt-24 pb-16 min-h-screen">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/birds-eye-reviews" className="text-sm text-blue-600 hover:text-blue-700">
            &larr; Back to Bird&apos;s Eye Reviews
          </Link>
          <Link
            href="/birds-eye-reviews/restless-legs-syndrome"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            &larr; Back to clinical trial results
          </Link>
        </div>

        <h1 className="font-clarendon font-bold text-3xl mb-2">
          Restless Legs Syndrome — Meta-Analysis
        </h1>

        {hasFile ? (
          <MetaAnalysisClientWrapper groups={groups} />
        ) : (
          <p className="text-sm text-foreground/60 mt-4">
            No meta-analysis has been generated for this review.
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}
