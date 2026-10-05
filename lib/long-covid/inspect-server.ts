import fs from "fs";
import { longCovidDataPath } from "./data-path";
import type { InspectSnapshot } from "./inspect";

/** Load once per page render. Missing coverage remains explicitly unassessed. */
export function loadInspectSnapshot(filename = longCovidDataPath("inspect_sr.json")): InspectSnapshot | undefined {
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
