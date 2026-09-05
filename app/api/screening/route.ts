import { matchesPublication, metadataCounts, parseMedline, parsePublication } from "@/lib/long-covid/publications";
import { publicationFor } from "@/lib/long-covid/publications-server";
import type { PublicationMetadata } from "@/lib/long-covid/publications";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { parseCSV, stripTags } from "@/app/birds-eye-reviews/long-covid/screening/csv-utils";

interface ScreeningRow {
  publicationMetadata?: PublicationMetadata;
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

function loadRows(): ScreeningRow[] {
  if (cachedRows) return cachedRows;
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/trial_screening.csv"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  const records = parseCSV(raw);
  const header = records[0].map((h) => h.trim());

  cachedRows = records.slice(1).map((vals) => {
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (vals[i] ?? "").trim()));
    return {
      doi: row.doi ?? "",
      publicationMetadata: publicationFor(row.doi ?? ""),
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
  return cachedRows;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "100", 10);
  const search = searchParams.get("search") ?? "";
  const source = searchParams.get("source") ?? "all";
  const treatment = searchParams.get("treatment") ?? "all";
  const trialType = searchParams.get("trialType") ?? "all";

  let rows = loadRows().map(r=>({...r, publicationMetadata:publicationFor(r.doi)}));

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.doi.toLowerCase().includes(s) ||
        r.summary.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        r.authors.toLowerCase().includes(s) ||
        r.journal.toLowerCase().includes(s) ||
        r.topics.some((t) => t.toLowerCase().includes(s))
    );
  }
  if (source !== "all") rows = rows.filter((r) => r.source_folder === source);
  if (treatment !== "all") rows = rows.filter((r) => r.studies_treatment === treatment);
  if (trialType !== "all") rows = rows.filter((r) => r.trial_type === trialType);

  const medline=parseMedline(searchParams.get('medline'));
  const publication=parsePublication(searchParams.get('publication'));
  const counts=metadataCounts(rows,medline,publication);
  rows=rows.filter(r=>matchesPublication(r.publicationMetadata,medline,publication));
  return NextResponse.json({
    counts,
    total: rows.length,
    rows: rows.slice(offset, offset + limit),
  });
}
