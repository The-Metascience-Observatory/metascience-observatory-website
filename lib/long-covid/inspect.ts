/** Saved review decisions shared by the loader, filters and report details. */
export interface InspectAssessment {
  paperId: string;
  disposition: string;
  humanReviewed: boolean;
  eligibility: string;
  eligibilityReason: string;
  judgment: string;
  judgmentReason: string;
  scope: string | null;
  scopeReason: string;
  selectionReason: string | null;
  duplicateOf: string | null;
  humanReason: string;
  retractionFlag: boolean;
  retractionConfirmed: boolean;
  machineReviewers: number;
  disagreementCount: number;
  withheldFindingCount: number;
  analysisSets: string[];
}

export interface InspectSnapshot {
  version: 1;
  assessedAt: string;
  model: string;
  guidanceVersion: string;
  decisionsSha256: string;
  papers: Record<string, InspectAssessment>;
}

export const inspectOptions = [
  ["all", "All reports"],
  ["synthesis", "Provisional treatment synthesis only"],
  ["rct_primary", "RCT primary set: no / some concerns"],
  ["rct_sensitivity", "RCT sensitivity set: no concerns only"],
  ["held", "Held pending resolution / unassessed"],
  ["excluded", "Excluded / outside treatment scope"],
] as const;
export type InspectFilter = typeof inspectOptions[number][0];
export const parseInspectFilter = (value: string | null): InspectFilter =>
  inspectOptions.some(([key]) => key === value) ? value as InspectFilter : "all";

const INCLUDED = new Set(["synthesis", "provisional_synthesis"]);
const EXCLUDED = new Set([
  "excluded", "excluded_retracted", "excluded_serious_concerns",
  "provisional_scope_exclusion", "duplicate_report",
]);

export function matchesInspect(meta: InspectAssessment | undefined, filter: InspectFilter): boolean {
  if (filter === "all") return true;
  if (filter === "held") return !meta || (!INCLUDED.has(meta.disposition) && !EXCLUDED.has(meta.disposition));
  if (!meta) return false;
  if (filter === "excluded") return EXCLUDED.has(meta.disposition);
  // Reuse the manuscript's sets, never derive a dashboard quality score.
  if (!INCLUDED.has(meta.disposition) || meta.retractionFlag) return false;
  const key = filter === "synthesis" ? "all_provisional_reports"
    : filter === "rct_primary" ? "rct_primary_no_or_some_concerns"
      : "rct_sensitivity_no_concerns";
  return meta.analysisSets.includes(key);
}

export function inspectCounts<T extends { inspectAssessment?: InspectAssessment }>(rows: T[]) {
  return Object.fromEntries(inspectOptions.map(([key]) => [key, rows.filter(r => matchesInspect(r.inspectAssessment, key)).length])) as Record<InspectFilter, number>;
}

const DISPOSITION_LABELS: Record<string, string> = {
  provisional_synthesis: "Provisional synthesis",
  synthesis: "Included after human review",
  excluded: "Excluded by screening",
  excluded_retracted: "Excluded: confirmed retraction",
  excluded_serious_concerns: "Excluded: serious concerns (human reviewed)",
  provisional_scope_exclusion: "Outside treatment scope — provisional",
  duplicate_report: "Duplicate report",
  scope_awaiting_resolution: "Treatment scope awaiting resolution",
  eligibility_disagreement: "Eligibility disagreement",
  serious_concerns_awaiting_resolution: "Serious-concern flag — awaiting review",
  retraction_awaiting_notice_verification: "Retraction flag — notice unverified",
  awaiting_classification: "Eligibility not established",
};

export function inspectLabel(meta?: InspectAssessment): string {
  if (!meta) return "Not assessed for this review";
  if (meta.disposition === "provisional_scope_exclusion" && meta.humanReviewed) return "Outside treatment scope (human reviewed)";
  return DISPOSITION_LABELS[meta.disposition] ?? "Disposition awaiting review";
}

export const inspectDescriptions: Record<InspectFilter, string> = {
  all: "All reports remain available, including excluded and unresolved reports.",
  synthesis: "Uses the review’s provisional treatment set. Omits retracted, excluded, out-of-scope and held reports; some included reports still have unresolved assessment differences. Nonrandomized reports may be included.",
  rct_primary: "Uses the review’s RCT primary set: no or some concerns, with no unresolved differences between assessments. This remains provisional until human review.",
  rct_sensitivity: "Uses the review’s RCT sensitivity set: no concerns and no unresolved differences. An empty set means no reports met these requirements, not that treatment is ineffective.",
  held: "Reports held out of synthesis for unresolved scope, eligibility, serious-concern flags, unverified notices or missing assessments. These are not final exclusions.",
  excluded: "Shows existing screening exclusions, confirmed retractions, duplicate reports and provisional exclusions from treatment scope. Read each report’s reason before drawing conclusions.",
};
