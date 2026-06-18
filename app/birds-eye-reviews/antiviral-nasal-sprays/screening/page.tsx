import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { ScreeningClientWrapper } from "./ScreeningClientWrapper";
import { PrismaDiagram, PrismaCounts } from "./PrismaDiagram";
import { ScreeningRow } from "./ScreeningTable";
import { parseCSV, stripTags, normalizeTitle } from "./csv-utils";

export const metadata = {
  title: "Trial Screening | Antiviral Nasal Sprays | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Screening table of articles evaluated for inclusion in the Antiviral Nasal Sprays clinical trials review.",
};

const DATA_DIR = "data/birds_eye_reviews/antiviral_nasal_sprays";

/** Generic DOI -> column map from a 2+-column CSV. */
function loadDoiMap(file: string, valueCol: string): Map<string, string> {
  const map = new Map<string, string>();
  const filePath = path.join(process.cwd(), DATA_DIR, file);
  if (!fs.existsSync(filePath)) return map;
  const records = parseCSV(fs.readFileSync(filePath, "utf-8"));
  if (records.length === 0) return map;
  const header = records[0].map((h) => h.trim());
  const doiIdx = header.indexOf("doi");
  const valIdx = header.indexOf(valueCol);
  if (doiIdx === -1 || valIdx === -1) return map;
  for (const vals of records.slice(1)) {
    const doi = (vals[doiIdx] ?? "").trim();
    const v = (vals[valIdx] ?? "").trim();
    if (doi && v && !map.has(doi)) map.set(doi, v);
  }
  return map;
}

function loadPrisma(): PrismaCounts | null {
  const filePath = path.join(process.cwd(), DATA_DIR, "prisma.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as PrismaCounts;
}

/** raw agent name -> canonical compound (only entries where they differ). */
function loadAgentCanonicalMap(): Map<string, string> {
  const filePath = path.join(process.cwd(), DATA_DIR, "agent_canonical_map.json");
  if (!fs.existsSync(filePath)) return new Map();
  const obj = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, string>;
  return new Map(Object.entries(obj));
}

function loadData(): ScreeningRow[] {
  const sprayTypes = loadDoiMap("spray_types.csv", "spray_type");
  const agents = loadDoiMap("spray_types.csv", "agent");
  const canonMap = loadAgentCanonicalMap();
  const studyDesigns = loadDoiMap("study_designs.csv", "study_design");
  const organisms = loadDoiMap("indications.csv", "organism");
  const indications = loadDoiMap("indications.csv", "indication");
  const filePath = path.join(process.cwd(), DATA_DIR, "trial_screening.csv");
  const records = parseCSV(fs.readFileSync(filePath, "utf-8"));
  const header = records[0].map((h) => h.trim());

  return records.slice(1).map((vals) => {
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (vals[i] ?? "").trim()));
    const doi = row.doi ?? "";
    const agent = agents.get(doi) ?? "";
    const named = agent && agent !== "unspecified";
    return {
      doi,
      spray_type: sprayTypes.get(doi) ?? "other",
      agent: named ? agent : "",
      // canonical compound the bar chart groups by (mirrors regen_antiviral_screening_data.py)
      agent_canonical: named ? canonMap.get(agent) ?? agent.toLowerCase() : "",
      // map missing/empty design to "unclear" so rows align with the study-design chart bar
      study_design: studyDesigns.get(doi) || "unclear",
      // organism + indication (prevention/treatment); "unclassified" mirrors the
      // chart bucket for treatment papers with no indications.csv row
      organism: organisms.get(doi) || "unclassified",
      indication: indications.get(doi) || "unclassified",
      // abstract_only marks rows screened on abstract alone (no full text)
      source_folder: row.source_folder ?? "",
      is_relevant: row.is_relevant ?? "",
      studies_treatment: row.studies_treatment ?? "",
      trial_type: row.trial_type ?? "",
      is_excluded: row.is_excluded ?? "",
      exclusion_reason: row.exclusion_reason ?? "",
      topics: (row.topics ?? "").split("|").map((t) => t.trim()).filter(Boolean).slice(0, 5),
      summary: stripTags(row.summary ?? "").slice(0, 400),
      title: normalizeTitle(stripTags(row.paper_title ?? "")).slice(0, 250),
      authors: stripTags(row.paper_authors ?? "").slice(0, 200),
      journal: stripTags(row.paper_journal ?? "").slice(0, 100),
      volume: row.paper_volume ?? "",
      issue: row.paper_issue ?? "",
      pages: row.paper_pages ?? "",
      year: row.paper_year ?? "",
      url: row.paper_url ?? "",
    };
  });
}

/** Distinct spray-type values, ordered by frequency — drives the table's
 *  Spray Type filter dropdown. */
function sprayTypeList(rows: ScreeningRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.spray_type || "other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export default function ScreeningPage() {
  // Only the treatment studies are displayed on this page (matches the screening
  // flow diagram's "treatment studies included" terminal); non-treatment rows
  // are excluded upstream.
  const allRows = loadData().filter((r) => r.studies_treatment === "yes");
  const prisma = loadPrisma();
  const sprayTypes = sprayTypeList(allRows);

  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto px-4 pt-24 pb-16 min-h-screen">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/birds-eye-reviews"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            &larr; Back to Bird&apos;s Eye Reviews
          </Link>
        </div>

        <h1 className="font-clarendon font-bold text-3xl mb-2">
          Antiviral Nasal Spray Trial Screening
        </h1>
        <Link
          href="/birds-eye-reviews/antiviral-nasal-sprays"
          className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          &larr; Back to clinical trial results &amp; meta-analysis
        </Link>

        {prisma && <PrismaDiagram counts={prisma} />}

        <ScreeningClientWrapper
          rows={allRows}
          sprayTypes={sprayTypes}
          studyType={
            prisma
              ? {
                  breakdown: prisma.study_design_breakdown,
                  groups: prisma.study_design_groups,
                }
              : undefined
          }
          drug={
            prisma
              ? {
                  agents: prisma.agent_breakdown,
                  singletons: prisma.agent_singletons,
                  namedTotal: prisma.agent_named_total,
                  distinct: prisma.agent_distinct,
                }
              : undefined
          }
          organismBreakdown={prisma?.organism_breakdown}
          indicationBreakdown={prisma?.indication_breakdown}
        />
      </main>
      <Footer />
    </>
  );
}
