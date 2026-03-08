import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { ScreeningTable } from "./ScreeningTable";
import { ScreeningFunnelChart } from "./ScreeningFunnelChart";

export const metadata = {
  title: "Trial Screening | Long Covid | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Screening table of 11,500+ articles evaluated for inclusion in the Long Covid clinical trials review.",
};

interface ScreeningRow {
  doi: string;
  source_folder: string;
  is_long_covid: string;
  studies_treatment: string;
  trial_type: string;
  is_excluded: string;
  exclusion_reason: string;
  topics: string[];
  summary: string;
  title: string;
  authors: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  year: string;
}

function loadData(): ScreeningRow[] {
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/trial_screening.csv"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const header = parseCSVLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line).map((v) => v.trim());
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = vals[i] ?? ""));
    return {
      doi: row.doi ?? "",
      source_folder: row.source_folder ?? "",
      is_long_covid: row.is_long_covid ?? "",
      studies_treatment: row.studies_treatment ?? "",
      trial_type: row.trial_type ?? "",
      is_excluded: row.is_excluded ?? "",
      exclusion_reason: row.exclusion_reason ?? "",
      topics: (row.topics ?? "").split("|").map((t) => t.trim()).filter(Boolean).slice(0, 5),
      summary: (row.summary ?? "").slice(0, 400),
      title: (row.paper_title ?? "").slice(0, 250),
      authors: (row.paper_authors ?? "").slice(0, 200),
      journal: (row.paper_journal ?? "").slice(0, 100),
      volume: row.paper_volume ?? "",
      issue: row.paper_issue ?? "",
      pages: row.paper_pages ?? "",
      year: row.paper_year ?? "",
    };
  });
}

/** Simple CSV line parser that handles quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function computeFunnel(rows: ScreeningRow[]) {
  const total = rows.length;
  const longCovid = rows.filter((r) => r.is_long_covid === "yes");
  const lcTreatment = longCovid.filter((r) => r.studies_treatment === "yes");
  const lcTreatmentIncluded = lcTreatment.filter((r) => r.is_excluded === "no");
  const lcTreatmentIncludedRCT = lcTreatmentIncluded.filter((r) => r.trial_type === "rct");

  return [
    { label: "Articles screened", count: total, color: "#6366f1" },
    { label: "About Long Covid", count: longCovid.length, color: "#8b5cf6" },
    { label: "Study a treatment", count: lcTreatment.length, color: "#3b82f6" },
    { label: "Passed screening", count: lcTreatmentIncluded.length, color: "#14b8a6" },
    { label: "Randomized controlled trials", count: lcTreatmentIncludedRCT.length, color: "#22c55e" },
  ];
}

export default function ScreeningPage() {
  const allRows = loadData();
  const initialRows = allRows.slice(0, 100);
  const funnelData = computeFunnel(allRows);

  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto px-4 pt-24 pb-16 min-h-screen">
        <div className="mb-2">
          <Link
            href="/birds-eye-reviews/long-covid"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            &larr; Back to Long Covid Dashboard
          </Link>
        </div>

        <h1 className="font-clarendon font-bold text-3xl mb-2">
          Trial Screening
        </h1>
        <p className="text-foreground/70 text-lg mb-6">
          {allRows.length.toLocaleString()} articles on Long Covid were found for the Long Covid Bird&apos;s Eye Review.
        </p>

        <ScreeningFunnelChart data={funnelData} />

        <ScreeningTable initialRows={initialRows} totalCount={allRows.length} />
      </main>
      <Footer />
    </>
  );
}
