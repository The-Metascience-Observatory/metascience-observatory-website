/** Server-only data loading for the post-viral symptoms page and its routes.
 *
 *  The release lives in `data/birds_eye_reviews/post_viral_symptoms/`
 *  (written by the pipeline's `publish_bundle.py`): `page.json` (slim, no
 *  quotes), `estimates.csv` / `contrasts.csv` (every extracted row with its
 *  verbatim quote) and `last_updated.json`. */
import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import type { EvidenceRow, LastUpdated, PageData } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data/birds_eye_reviews/post_viral_symptoms");
export const dataPath = (name: string) => path.join(DATA_DIR, name);

export function loadPageData(): PageData {
  return JSON.parse(fs.readFileSync(dataPath("page.json"), "utf-8")) as PageData;
}

export function loadLastUpdated(): LastUpdated {
  try {
    return JSON.parse(fs.readFileSync(dataPath("last_updated.json"), "utf-8")) as LastUpdated;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------- evidence CSVs

interface EvidenceCache {
  mtime: number;
  rows: EvidenceRow[];
  byId: Map<string, EvidenceRow>;
  /** Papers that report at least one comparison-group estimate or a contrast. */
  papersWithControl: Set<string>;
}
let cache: EvidenceCache | null = null;

/** Both CSVs, parsed once per file version and kept in module scope. */
export function loadEvidence(): EvidenceCache {
  const files = ["estimates.csv", "contrasts.csv"].map(dataPath);
  const mtime = files.reduce((m, f) => m + fs.statSync(f).mtimeMs, 0);
  if (cache && cache.mtime === mtime) return cache;
  const rows: EvidenceRow[] = [];
  for (const [file, kind] of [[files[0], "estimate"], [files[1], "contrast"]] as const) {
    for (const r of csvParse(fs.readFileSync(file, "utf-8"))) {
      rows.push({ ...(r as Record<string, string>), _kind: kind } as EvidenceRow);
    }
  }
  const byId = new Map(rows.map((r) => [r.row_id, r]));
  const papersWithControl = new Set(
    rows.filter((r) => r._kind === "contrast" || r.role === "comparator").map((r) => r.paper_id),
  );
  cache = { mtime, rows, byId, papersWithControl };
  return cache;
}

/** Rows for a list of row ids. A derived pair's id ("<paper>#E1 vs E2") is
 *  expanded to its two estimate rows. */
export function evidenceRows(ids: string[]): EvidenceRow[] {
  const { byId } = loadEvidence();
  const out: EvidenceRow[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const hash = id.indexOf("#");
    const paper = hash >= 0 ? id.slice(0, hash) : "";
    const parts = hash >= 0 && id.includes(" vs ") ? id.slice(hash + 1).split(" vs ").map((p) => `${paper}#${p.trim()}`) : [id];
    for (const p of parts) {
      const row = byId.get(p);
      if (row && !seen.has(p)) {
        seen.add(p);
        out.push(row);
      }
    }
  }
  return out;
}
