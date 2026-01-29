import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { csvParse } from "d3-dsv";

export const runtime = "nodejs";

type AnyRecord = Record<string, unknown>;

let cachedData: { rows: AnyRecord[]; columns: string[]; lastUpdated?: string } | null = null;

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeEffectSigns(row: AnyRecord): void {
  const eO = toNumber(row.original_es_r);
  const eR = toNumber(row.replication_es_r);
  if (eO == null || eR == null) return;
  if (eO < 0) {
    row.original_es_r = -eO;
    row.replication_es_r = -eR;
    row.es_original = -eO;
    row.es_replication = -eR;
  } else {
    row.original_es_r = eO;
    row.replication_es_r = eR;
    row.es_original = eO;
    row.es_replication = eR;
  }
}

async function loadCsv(filePath: string): Promise<{ rows: AnyRecord[]; columns: string[] }> {
  const csvText = await fs.readFile(filePath, "utf8");
  const rows = csvParse(csvText);
  const columns = rows.columns ?? [];
  const normalized = rows.map((row: AnyRecord) => {
    const obj: AnyRecord = {};
    for (const key of columns) {
      obj[key] = row[key as keyof typeof row] ?? null;
    }
    // Map new column names to old ones for compatibility
    obj.es_original = obj.original_es_r ?? null;
    obj.es_replication = obj.replication_es_r ?? null;
    obj.n_original = obj.original_n ?? null;
    obj.n_replication = obj.replication_n ?? null;
    // Keep original citation HTML columns
    return obj;
  });
  const filtered = normalized.filter((r: AnyRecord) => {
    const eO = Number(String(r.original_es_r ?? "").trim());
    const eR = Number(String(r.replication_es_r ?? "").trim());
    return Number.isFinite(eO) && Number.isFinite(eR);
  });
  for (const r of filtered) normalizeEffectSigns(r);
  return { rows: filtered, columns };
}

async function getLatestFilename(): Promise<string> {
  const versionHistoryPath = path.join(process.cwd(), "data", "version_history.txt");
  const versionHistoryText = await fs.readFile(versionHistoryPath, "utf8");
  const lines = versionHistoryText.trim().split("\n").filter(line => line.trim() && !line.trim().startsWith('#'));
  const lastLine = lines[lines.length - 1];
  // Strip any inline comments
  const filename = lastLine.split('#')[0].trim();
  return filename;
}

function extractDateFromFilename(filename: string): string | null {
  // Filename format: replications_database_YYYY_MM_DD_HHMMSS.csv
  // Extract date part: YYYY_MM_DD
  const match = filename.match(/replications_database_(\d{4})_(\d{2})_(\d{2})_\d+\.csv/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
}

export async function GET() {
  try {
    if (!cachedData) {
      const filename = await getLatestFilename();
      const dataPath = path.join(process.cwd(), "data", filename);
      const csvData = await loadCsv(dataPath);
      const lastUpdated = extractDateFromFilename(filename);
      cachedData = { ...csvData, lastUpdated: lastUpdated || undefined };
    }

    return NextResponse.json({
      columns: cachedData.columns,
      rows: cachedData.rows,
      lastUpdated: cachedData.lastUpdated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


