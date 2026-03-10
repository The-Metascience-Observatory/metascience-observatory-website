import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { ArticleTypeBar } from "./ScreeningFunnelChart";
import { ScreeningClientWrapper } from "./ScreeningClientWrapper";

export const metadata = {
  title: "Trial Screening | Long Covid | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Screening table of 16,800+ articles evaluated for inclusion in the Long Covid clinical trials review.",
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

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");

function loadData(): ScreeningRow[] {
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/trial_screening.csv"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  const records = parseCSV(raw);
  const header = records[0].map((h) => h.trim());

  return records.slice(1).map((vals) => {
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (vals[i] ?? "").trim()));
    return {
      doi: row.doi ?? "",
      source_folder: row.source_folder ?? "",
      is_long_covid: row.is_long_covid ?? "",
      studies_treatment: row.studies_treatment ?? "",
      trial_type: row.trial_type ?? "",
      is_excluded: row.is_excluded ?? "",
      exclusion_reason: row.exclusion_reason ?? "",
      topics: (row.topics ?? "").split("|").map((t) => t.trim()).filter(Boolean).slice(0, 5),
      summary: stripTags((row.summary ?? "")).slice(0, 400),
      title: stripTags((row.paper_title ?? "")).slice(0, 250),
      authors: stripTags((row.paper_authors ?? "")).slice(0, 200),
      journal: stripTags((row.paper_journal ?? "")).slice(0, 100),
      volume: row.paper_volume ?? "",
      issue: row.paper_issue ?? "",
      pages: row.paper_pages ?? "",
      year: row.paper_year ?? "",
    };
  });
}

/** Full CSV parser that handles quoted fields with commas and newlines */
function parseCSV(text: string): string[][] {
  const records: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) && !inQuotes) {
      if (ch === "\r") i++; // skip \n in \r\n
      row.push(current);
      current = "";
      if (row.some((v) => v.trim())) records.push(row);
      row = [];
    } else {
      current += ch;
    }
  }
  // Last row
  row.push(current);
  if (row.some((v) => v.trim())) records.push(row);

  return records;
}

function computeArticleTypeBars(rows: ScreeningRow[]): { bars: ArticleTypeBar[]; totalTreatment: number } {
  const folderCounts = new Map<string, { total: number; treatment: number }>();
  for (const r of rows) {
    const folder = r.source_folder || "Unknown";
    const entry = folderCounts.get(folder) ?? { total: 0, treatment: 0 };
    entry.total++;
    if (r.studies_treatment === "yes") entry.treatment++;
    folderCounts.set(folder, entry);
  }

  const totalArticles = rows.length;
  const totalTreatment = rows.filter((r) => r.studies_treatment === "yes").length;

  const bars: ArticleTypeBar[] = [...folderCounts.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([label, { total, treatment }]) => ({
      label,
      total,
      treatment,
      pct: ((total / totalArticles) * 100).toFixed(1),
      totalLabel: treatment > 0
        ? `${total.toLocaleString()}  (${((total / totalArticles) * 100).toFixed(1)}%) \u2014 ${treatment.toLocaleString()} treatment`
        : `${total.toLocaleString()}  (${((total / totalArticles) * 100).toFixed(1)}%)`,
    }));

  return { bars, totalTreatment };
}

export default function ScreeningPage() {
  const allRows = loadData();
  const initialRows = allRows.slice(0, 100);
  const { bars, totalTreatment } = computeArticleTypeBars(allRows);

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
          {" "}
          <a
            href="/api/screening/download"
            download="trial_screening.csv"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Download CSV
          </a>
        </p>

        <ScreeningClientWrapper
          bars={bars}
          totalArticles={allRows.length}
          totalTreatment={totalTreatment}
          initialRows={initialRows}
          sourceFolders={bars.map((b) => b.label)}
        />
      </main>
      <Footer />
    </>
  );
}
