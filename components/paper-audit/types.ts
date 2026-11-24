/** Shapes shared by the server loader and the client views of a paper audit.
 *
 *  The data comes from two pipeline files in a review's bundle:
 *  `paper_audit.json` (scripts/paper_audit.py) and `trial_map.json`
 *  (scripts/build_trial_map.py). Both are optional; a page renders what exists. */

export type IssueFamily = "numeric" | "design" | "spin" | "integrity";
export type IssueStatus = "confirmed" | "judgement_call" | "disputed";

export interface AuditIssue {
  id: string;
  family: IssueFamily;
  subtype: string;
  kind: "clear" | "debatable";
  severity: number;
  direction: "overstates" | "understates" | "neutral";
  title: string;
  explanation: string;
  status: IssueStatus;
  /** What stands behind the issue. Shown as the status label; never collapsed to "error". */
  checkedBy: { script: boolean; secondReader: string };
  quotes: { text: string; location: string }[];
  script?: { tool: string; verdict: string; explanation: string };
  secondReaderNote?: string;
}

export interface AuditTrial {
  /** Join key: lower-case DOI without any `#arm` suffix. */
  id: string;
  /** The feed's own id, for the article panel. */
  paperId: string;
  url: string;
  title: string;
  authors: string;
  journal: string;
  year: number | null;
  n: number | null;
  design: string;
  randomized: boolean;
  treatments: string[];
  verdict: string;
  // map
  cluster?: string;
  domain?: string;
  x?: number;
  y?: number;
  // audit
  stage: "verified" | "screened" | null;
  rigor: number | null;
  rigorParts?: Record<string, number>;
  bestRank?: number;
  maxSeverity: number;
  overall?: string;
  retracted: boolean;
  checklist?: Record<string, string | number | null>;
  issues: AuditIssue[];
}

export interface MapDomain { id: string; label: string; description: string; x: number; y: number; r: number }
export interface MapCluster extends MapDomain { domain: string; n: number }

export interface SeverityLevel { n: number; slug: string; label: string; summary: string; color: string }

export interface AuditPageData {
  reviewLabel: string;
  releaseVersion: string;
  generatedAt: string | null;
  models: Record<string, string>;
  funnel: Record<string, number>;
  control: { papers: number; confirmed_issues_per_paper: number | null; flagged_papers: number; flagged_confirmed_issues_per_paper: number | null } | null;
  tallies: Record<string, Record<string, { issues: number; papers: number; major_papers: number }>>;
  ladder: SeverityLevel[];
  map: { width: number; height: number; domains: MapDomain[]; clusters: MapCluster[] } | null;
  trials: AuditTrial[];
}

export const FAMILY_LABEL: Record<IssueFamily, string> = {
  numeric: "Reporting errors",
  design: "Design and analysis limits",
  spin: "Conclusions that outrun the results",
  integrity: "Registration and transparency",
};

export const FAMILY_BLURB: Record<IssueFamily, string> = {
  numeric: "Numbers in the paper that disagree with each other: abstract against tables, counts against percentages, totals that do not add up.",
  design: "Features of the design or analysis that limit what the study can show, such as no control group or a conclusion drawn from completers only.",
  spin: "Abstracts or conclusions that claim more than the reported results support.",
  integrity: "Late or missing registration, a primary outcome that differs from the registered one, and published notices.",
};

const SUBTYPE_LABEL: Record<string, string> = {
  abstract_results_mismatch: "Abstract disagrees with the results",
  text_table_mismatch: "Text disagrees with a table",
  sample_size_mismatch: "Sample size differs within the paper",
  flow_arithmetic: "Participant flow does not add up",
  subgroup_sum_mismatch: "Subgroups do not sum to the total",
  impossible_percentage: "Percentage does not match its count",
  arithmetic_mismatch: "Printed calculation does not reproduce",
  significance_mismatch: "Significance claim contradicts the p-value",
  direction_mismatch: "Stated direction contradicts the numbers",
  estimate_ci_p_inconsistent: "Estimate, interval and p-value disagree",
  impossible_value: "Value outside its possible range",
  timeline_impossibility: "Dates that cannot all be true",
  duplicated_values: "Unexpectedly identical values",
  other_numeric: "Other internal inconsistency",
  no_concurrent_control: "No concurrent control group",
  inadequate_control: "Control group cannot support the claim",
  randomization_inadequate: "Allocation not adequately randomized",
  unblinded_subjective_outcome: "Unblinded with a subjective primary outcome",
  underpowered: "Too small for the conclusion drawn",
  high_attrition: "High or uneven loss to follow-up",
  per_protocol_only: "Conclusion rests on completers only",
  within_group_inference: "Benefit inferred from within-group change",
  multiplicity_uncorrected: "Many outcomes tested, none corrected",
  inappropriate_analysis: "Statistical method does not fit the data",
  unvalidated_outcome: "Primary outcome not validated",
  confounding_unaddressed: "Confounding not addressed",
  short_follow_up: "Follow-up too short for the claim",
  null_primary_presented_positive: "Null primary outcome presented as positive",
  conclusion_exceeds_results: "Conclusion goes beyond the results",
  causal_claim_from_observational: "Causal claim from an uncontrolled design",
  selective_emphasis: "Secondary results headlined over the primary",
  outcome_switching: "Primary outcome differs from registration",
  unregistered_or_retrospective: "Registered late or not at all",
  undisclosed_funder_role: "Funder role or interests unclear",
  timeline_or_ethics_problem: "Ethics approval or consent not reported",
};

export const subtypeLabel = (slug: string): string =>
  SUBTYPE_LABEL[slug] ?? slug.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** The honest status label for an issue: says what checked it. */
export function statusLabel(issue: AuditIssue): string {
  if (issue.status === "judgement_call") return "Judgement call: reasonable reviewers could disagree";
  if (issue.status === "disputed") return "Disputed: a second AI reader did not agree";
  const parts = ["Confirmed by the AI verifier"];
  if (issue.checkedBy.script) parts.push("recomputed by script");
  if (issue.checkedBy.secondReader === "stands") parts.push("upheld by a second AI reader");
  else if (issue.checkedBy.secondReader === "stands_in_part") parts.push("upheld in part by a second AI reader");
  else if (issue.checkedBy.secondReader === "cannot_tell") parts.push("second AI reader could not settle it");
  return parts.join("; ") + ". Not checked by a person.";
}

export const fmtDesign = (s: string) =>
  (s || "unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bRct\b/g, "RCT");
