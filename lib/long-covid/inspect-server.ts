import fs from "fs";
import path from "path";
import type { InspectSnapshot } from "./inspect";

/** Load once per page render. Missing coverage remains explicitly unassessed. */
export function loadInspectSnapshot(): InspectSnapshot | undefined {
  const filename = path.join(process.cwd(), "data/birds_eye_reviews/long_covid/inspect_sr.json");
  if (!fs.existsSync(filename)) return undefined;
  const data = JSON.parse(fs.readFileSync(filename, "utf8")) as InspectSnapshot;
  if (data.version !== 1 || !data.papers || !data.assessedAt) throw new Error("Unsupported INSPECT-SR snapshot");
  for (const [id, report] of Object.entries(data.papers)) {
    if (report.paperId !== id || typeof report.disposition !== "string" || !Array.isArray(report.analysisSets)
      || typeof report.humanReviewed !== "boolean" || typeof report.retractionFlag !== "boolean") {
      throw new Error("Invalid INSPECT-SR report: " + id);
    }
  }
  return data;
}
