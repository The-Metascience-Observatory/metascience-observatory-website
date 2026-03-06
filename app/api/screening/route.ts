import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

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

let cachedRows: ScreeningRow[] | null = null;

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

function loadRows(): ScreeningRow[] {
  if (cachedRows) return cachedRows;
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/trial_screening.csv"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const header = parseCSVLine(lines[0]);

  cachedRows = lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
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
  return cachedRows;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "100", 10);
  const search = searchParams.get("search") ?? "";
  const source = searchParams.get("source") ?? "all";
  const longCovid = searchParams.get("longCovid") ?? "all";
  const treatment = searchParams.get("treatment") ?? "all";
  const trialType = searchParams.get("trialType") ?? "all";
  const excluded = searchParams.get("excluded") ?? "all";

  let rows = loadRows();

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.doi.toLowerCase().includes(s) ||
        r.summary.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        r.topics.some((t) => t.toLowerCase().includes(s))
    );
  }
  if (source !== "all") rows = rows.filter((r) => r.source_folder === source);
  if (longCovid !== "all") rows = rows.filter((r) => r.is_long_covid === longCovid);
  if (treatment !== "all") rows = rows.filter((r) => r.studies_treatment === treatment);
  if (trialType !== "all") rows = rows.filter((r) => r.trial_type === trialType);
  if (excluded !== "all") rows = rows.filter((r) => r.is_excluded === excluded);

  return NextResponse.json({
    total: rows.length,
    rows: rows.slice(offset, offset + limit),
  });
}
