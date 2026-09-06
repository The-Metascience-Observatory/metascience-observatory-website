/** Counts for the exported snapshot, not the mutable upstream working directory. */
export interface ScreeningRecord {
  doi: string;
  is_excluded: string;
  exclusion_reason: string;
}
export interface ExtractionRecord {
  paper_id?: string;
  is_rct?: boolean | null;
  study_design?: { design_type?: string | null } | null;
}
export interface RetrievalFailures {
  as_of: string;
  dois: string[];
}
export function computeScreeningCounts(
  screening: ScreeningRecord[],
  extractions: ExtractionRecord[],
  failures: RetrievalFailures,
) {
  // Match the dashboard's current DOI and exclusion predicates exactly.
  const baseDoi = (r: ExtractionRecord) => String(r.paper_id ?? "").split("#")[0];
  const excludedDois = new Set(screening.filter(r => r.is_excluded.trim().toLowerCase() === "yes").map(r => r.doi.trim()));
  const screenedDois = new Set(screening.map(r => r.doi.trim()));
  const extractionDois = new Set(extractions.map(baseDoi));
  const excluded = screening.filter(r => excludedDois.has(r.doi.trim()));
  const retained = screening.filter(r => !excludedDois.has(r.doi.trim()));
  const explicitNo = retained.filter(r => r.is_excluded.trim().toLowerCase() === "no").length;
  const reasons: Record<string, number> = {};
  for (const r of excluded) {
    const reason = r.exclusion_reason.trim() || "Unspecified";
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  const excludedExtractions = extractions.filter(r => excludedDois.has(baseDoi(r)));
  const afterScreening = extractions.filter(r => !excludedDois.has(baseDoi(r)));
  const invalid = afterScreening.filter(r => !r.study_design || /not applicable|bioinformatic|not a clinical trial/i.test(String(r.study_design.design_type ?? "")));
  const displayed = afterScreening.filter(r => r.study_design && !/not applicable|bioinformatic|not a clinical trial/i.test(String(r.study_design.design_type ?? "")));
  const historical = new Set(failures.dois.map(d => d.trim().toLowerCase()));
  const exportedNormalized = new Set([...extractionDois].map(d => d.trim().toLowerCase()));
  const historicalNowExported = [...historical].filter(d => exportedNormalized.has(d)).length;
  const randomized = displayed.filter(r => r.is_rct === true).length;
  return {
    screened: screening.length,
    excluded: excluded.length,
    reasons,
    retained: retained.length,
    explicitNo,
    unresolved: retained.length - explicitNo,
    retainedWithExtraction: retained.filter(r => extractionDois.has(r.doi.trim())).length,
    retainedWithoutExtraction: retained.filter(r => !extractionDois.has(r.doi.trim())).length,
    exported: extractions.length,
    exportedExcluded: excludedExtractions.length,
    exportedInvalid: invalid.length,
    exportedUnscreened: extractions.filter(r => !screenedDois.has(baseDoi(r))).length,
    dashboardRecords: displayed.length,
    dashboardReports: new Set(displayed.map(baseDoi)).size,
    randomized,
    other: displayed.length - randomized,
    retrievalDate: failures.as_of,
    historicalFailures: historical.size,
    historicalNowExported,
    historicalWithoutExtraction: historical.size - historicalNowExported,
  };
}
export type ScreeningCounts = ReturnType<typeof computeScreeningCounts>;
