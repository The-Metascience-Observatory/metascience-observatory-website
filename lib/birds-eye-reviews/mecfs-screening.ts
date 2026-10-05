import { matchesPublication, metadataCounts, parseMedline, parsePublication } from "@/lib/long-covid/publications";
import { publicationFor } from "@/lib/long-covid/publications-server";
import type { PublicationMetadata } from "@/lib/long-covid/publications";
import fs from "fs";
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


import {reviewDataPath,reviewVersion} from "./data";
let cachedRows: ScreeningRow[] | null = null;
let cachedVersion = "";

export function loadRows(): ScreeningRow[] {
  const version=reviewVersion("me-cfs");
  if (cachedRows && cachedVersion===version) return cachedRows;
  cachedVersion=version;
  const filePath = reviewDataPath("me-cfs", "trial_screening.csv");
  const raw = fs.readFileSync(filePath, "utf-8");
  const records = parseCSV(raw);
  const header = records[0].map((h) => h.trim());

  cachedRows = records.slice(1).map((vals) => {
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (vals[i] ?? "").trim()));
    return {
      doi: row.doi ?? "",
      publicationMetadata: publicationFor(row.doi ?? "", reviewDataPath("me-cfs", "publication_metadata.json")),
      source_folder: row.source_folder ?? "",
      is_long_covid: row.is_relevant ?? "",
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

