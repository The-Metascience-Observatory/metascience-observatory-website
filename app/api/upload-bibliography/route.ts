import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { csvParse } from "d3-dsv";
import { clientKey, createRateLimiter, readLimitedBody, RequestError } from "@/lib/request-guards";

const rateLimit = createRateLimiter();
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, unknown>;

// Extract DOIs from .bib file
function extractDoisFromBib(content: string): string[] {
  const dois: string[] = [];
  // Match DOI fields in BibTeX format: doi = {10.xxxx/xxxxx} or doi = "10.xxxx/xxxxx" or doi = 10.xxxx/xxxxx
  const doiRegex = /doi\s*=\s*[{"']?(10\.\d+\/[^\s"{}]+)[}"']?/gi;
  let match;
  while ((match = doiRegex.exec(content)) !== null) {
    const doi = match[1].trim().replace(/[{}"]/g, "");
    if (doi) dois.push(doi);
  }
  return dois;
}

// Extract DOIs from .xml file (BibTeX XML or similar)
function extractDoisFromXml(content: string): string[] {
  const dois: string[] = [];
  // Match DOI in XML: <doi>10.xxxx/xxxxx</doi> or doi="10.xxxx/xxxxx"
  const doiRegex = /(?:<doi[^>]*>|doi\s*=\s*["'])(10\.\d+\/[^\s"<>']+)(?:<\/doi>|["'])/gi;
  let match;
  while ((match = doiRegex.exec(content)) !== null) {
    dois.push(match[1].trim());
  }
  return dois;
}

// Extract DOIs from .ris file
function extractDoisFromRis(content: string): string[] {
  const dois: string[] = [];
  // RIS format: DO  - 10.xxxx/xxxxx or DO  - http://doi.org/10.xxxx/xxxxx
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("DO  -") || line.startsWith("DO\t-")) {
      let doi = line.substring(5).trim();
      // Remove http://doi.org/ prefix if present
      doi = doi.replace(/^https?:\/\/doi\.org\//i, "");
      if (doi.startsWith("10.")) {
        dois.push(doi);
      }
    }
  }
  return dois;
}

// Normalize DOI for comparison (remove https://doi.org/ prefix, lowercase)
function normalizeDoi(doi: string): string {
  return doi
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .toLowerCase()
    .trim();
}

// Extract DOIs from database URL column
function extractDoiFromUrl(url: string): string | null {
  if (!url) return null;
  // Try to extract DOI from URL (handles both http://doi.org/10.xxx and https://doi.org/10.xxx)
  const urlMatch = url.match(/https?:\/\/doi\.org\/(10\.\d+\/[^\s"<>'&]+)/i);
  if (urlMatch) {
    return normalizeDoi(urlMatch[1]);
  }
  // Try to extract DOI pattern directly (in case it's not a full URL)
  const doiMatch = url.match(/(10\.\d+\/[^\s"<>'&]+)/i);
  if (doiMatch) {
    return normalizeDoi(doiMatch[1]);
  }
  return null;
}

async function getLatestFilename(): Promise<string> {
  const versionHistoryPath = path.join(process.cwd(), "data", "version_history.txt");
  const versionHistoryText = await fs.readFile(versionHistoryPath, "utf8");
  const lines = versionHistoryText.split("\n").map(line => line.split("#")[0].trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1];
  return lastLine.trim();
}

async function loadDatabase(): Promise<AnyRecord[]> {
  const filename = await getLatestFilename();
  const dataPath = path.join(process.cwd(), "data", filename);
  const csvText = await fs.readFile(dataPath, "utf8");
  const rows = csvParse(csvText);
  return rows as AnyRecord[];
}

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(clientKey(request));
    if (limited) return limited;
    // Allow a small multipart envelope, but cap the entire body before parsing.
    const bounded = await readLimitedBody(request, MAX_FILE_BYTES + 64 * 1024);
    const formData = await bounded.formData().catch(() => {
      throw new RequestError("Invalid file upload.", 400);
    });
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new RequestError("File is too large. Maximum size is 2 MB.", 413);
    }

    const fileExtension = path.extname(file.name).toLowerCase();
    if (![".bib", ".xml", ".ris"].includes(fileExtension)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a .bib, .xml, or .ris file." },
        { status: 400 }
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const content = Buffer.from(arrayBuffer).toString("utf8");

    // Extract DOIs based on file type
    let dois: string[] = [];
    if (fileExtension === ".bib") {
      dois = extractDoisFromBib(content);
    } else if (fileExtension === ".xml") {
      dois = extractDoisFromXml(content);
    } else if (fileExtension === ".ris") {
      dois = extractDoisFromRis(content);
    }

    if (dois.length === 0) {
      return NextResponse.json({
        message: "No DOIs found in the uploaded file.",
        matches: [],
        totalDois: 0,
        matchedDois: 0,
      });
    }

    // Normalize DOIs for comparison
    const normalizedDois = dois.map(normalizeDoi);
    const uniqueDois = new Set(normalizedDois);

    // Load database
    const database = await loadDatabase();

    // Find matches
    const matches: Array<{
      doi: string;
      originalUrl: string;
      description: string;
      result: string;
      originalEs: number | null;
      replicationEs: number | null;
      originalEsType: string;
      replicationEsType: string;
      originalN: number | null;
      replicationN: number | null;
    }> = [];

    for (const row of database) {
      const originalUrl = String(row.original_url || "");
      const dbDoi = extractDoiFromUrl(originalUrl);
      
      if (dbDoi && uniqueDois.has(dbDoi)) {
        const originalEs = row.original_es_r != null ? Number(row.original_es_r) : null;
        const replicationEs = row.replication_es_r != null ? Number(row.replication_es_r) : null;
        
        matches.push({
          doi: dbDoi,
          originalUrl: originalUrl,
          description: String(row.description || ""),
          result: String(row.result || ""),
          originalEs: Number.isFinite(originalEs) ? originalEs : null,
          replicationEs: Number.isFinite(replicationEs) ? replicationEs : null,
          originalEsType: String(row.original_es_type || ""),
          replicationEsType: String(row.replication_es_type || ""),
          originalN: row.original_n != null ? Number(row.original_n) : null,
          replicationN: row.replication_n != null ? Number(row.replication_n) : null,
        });
      }
    }

    // Remove duplicates (same DOI might appear multiple times)
    const uniqueMatches = matches.filter((match, index, self) =>
      index === self.findIndex(m => m.doi === match.doi)
    );

    return NextResponse.json({
      message: `Found ${uniqueMatches.length} matching DOI${uniqueMatches.length !== 1 ? "s" : ""} in the database.`,
      matches: uniqueMatches,
      totalDois: uniqueDois.size,
      matchedDois: uniqueMatches.length,
    });
  } catch (err) {
    if (err instanceof RequestError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Error processing bibliography:", err);
    return NextResponse.json({ error: "Unable to process bibliography." }, { status: 500 });
  }
}

