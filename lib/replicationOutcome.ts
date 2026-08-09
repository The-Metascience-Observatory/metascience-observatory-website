import { jStat } from "jstat";

/**
 * Shared replication-outcome classification utilities.
 *
 * Extracted from app/replications-database/page.tsx so the same statistical
 * definitions of replication "success / failure" can be reused on other pages
 * (e.g. the by-p-value breakdown) without the definitions drifting apart.
 */

export type AnyRecord = Record<string, unknown>;

export type OutcomeMethod = "significance" | "orig_in_rep_ci" | "rep_in_orig_ci";

/** The four outcomes every definition on the site resolves to. */
export type ReplicationOutcome = "success" | "failure" | "reversal" | "inconclusive";

/**
 * Every definition offered anywhere on the site: the database's stored `result`
 * column ("reported") plus the three statistical criteria.
 */
export type SuccessDef = "reported" | OutcomeMethod;

/**
 * The frozen site-wide success-rate definition. Every page that displays a rate
 * must use this rule and show this string (via <SuccessRateNote />) so a reader
 * comparing two pages can see they are comparing like with like.
 *
 * Reversal counts as a failure: a statistically significant effect in the
 * *opposite* direction is a determinate non-replication, not an absence of
 * information. Inconclusive and unrecorded outcomes are excluded from the
 * denominator rather than counted as failures, because "we could not tell" is
 * not the same finding as "it did not replicate".
 */
export const SUCCESS_RATE_DEFINITION =
  "success / (success + failure + reversal); inconclusive and unrecorded outcomes excluded";

/** Human-readable labels for the definition selector, shared by every page. */
export const SUCCESS_DEF_OPTIONS: { value: SuccessDef; label: string }[] = [
  { value: "reported", label: "Reported result (as recorded in the database)" },
  { value: "significance", label: "Statistically significant effect in the same direction?" },
  { value: "orig_in_rep_ci", label: "Original effect size in replication 95% confidence interval?" },
  { value: "rep_in_orig_ci", label: "Replication effect size in original 95% confidence interval?" },
];

/**
 * Classify the database's stored `result` column.
 *
 * Exact match on a trimmed, lowercased value — deliberately NOT a substring
 * `includes` test. The old per-page copies used `includes("success")` ordered
 * before `includes("failure")`, which would classify a future value such as
 * "partial success" or "failure (reversal)" by whichever token happened to be
 * tested first rather than by its meaning.
 */
export function classifyReportedResult(result: unknown): ReplicationOutcome {
  switch (String(result ?? "").trim().toLowerCase()) {
    case "success":
      return "success";
    case "failure":
      return "failure";
    case "reversal":
      return "reversal";
    default:
      // Includes blank and any unrecognised value.
      return "inconclusive";
  }
}

/**
 * Single entry point for every definition on the site. Use this instead of
 * branching on `def === "reported"` at each call site — that branching is what
 * let the stored-result rule drift apart across pages.
 */
export function classifyRowByDef(row: AnyRecord, def: SuccessDef): ReplicationOutcome {
  return def === "reported"
    ? classifyReportedResult(row.result)
    : getOutcomeForRow(row, def);
}

/**
 * Collapse an outcome to the frozen binary, or null when the row falls outside
 * the denominator. Reversal is a failure under *every* definition — applying
 * this uniformly is what removes the by-p-value discontinuity where switching
 * the criterion dropdown silently moved reversals in and out of the denominator.
 */
export function toBinary(outcome: ReplicationOutcome): "success" | "failure" | null {
  if (outcome === "success") return "success";
  if (outcome === "failure" || outcome === "reversal") return "failure";
  return null;
}

/** Compact per-outcome code, for pages that precompute a code string per row. */
export function outcomeCode(outcome: ReplicationOutcome): "s" | "f" | "r" | "i" {
  if (outcome === "success") return "s";
  if (outcome === "failure") return "f";
  if (outcome === "reversal") return "r";
  return "i";
}

/**
 * The four definitions in the fixed order used by the compact per-row code
 * string and by the criterion dropdowns. Index 0 is the stored `result` column.
 */
export const SUCCESS_DEFS: SuccessDef[] = [
  "reported",
  "significance",
  "orig_in_rep_ci",
  "rep_in_orig_ci",
];

/**
 * Encode a row as a 4-character code string, one character per definition in
 * SUCCESS_DEFS order, so a server component can ship one compact field per row
 * instead of recomputing every statistic in the browser. Index into the string
 * with the dashboard's selected criterion.
 */
export function outcomeCodesForRow(row: AnyRecord): string {
  return SUCCESS_DEFS.map((def) => outcomeCode(classifyRowByDef(row, def))).join("");
}

/**
 * The canonical rate over rows already encoded as code strings by
 * `outcomeCodesForRow`, selecting the definition by its index in SUCCESS_DEFS.
 * Lets the pre-encoded dashboards report the same rate as everywhere else
 * without shipping the raw effect sizes to the browser.
 */
export function rateFromCodes(codes: Iterable<string>, criterion: number): SuccessRate {
  let success = 0;
  let failure = 0;
  for (const code of codes) {
    const c = code[criterion];
    if (c === "s") success++;
    else if (c === "f" || c === "r") failure++;
  }
  const n = success + failure;
  return { success, failure, n, pct: n > 0 ? (success / n) * 100 : null };
}

export type SuccessRate = {
  success: number;
  failure: number;
  /** Denominator: success + failure + reversal. */
  n: number;
  /** Percentage, or null when nothing was classifiable. */
  pct: number | null;
};

/**
 * The canonical rate over a set of rows, returning the denominator alongside the
 * percentage so callers can disclose it. Effect-level (one row = one replication
 * of one effect) — paper-level roll-ups build on `toBinary` directly.
 */
export function successRate(rows: AnyRecord[], def: SuccessDef = "reported"): SuccessRate {
  let success = 0;
  let failure = 0;
  for (const row of rows) {
    const binary = toBinary(classifyRowByDef(row, def));
    if (binary === "success") success++;
    else if (binary === "failure") failure++;
  }
  const n = success + failure;
  return { success, failure, n, pct: n > 0 ? (success / n) * 100 : null };
}

export function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a value expected to be a Pearson r. Values with |r| > 1 are invalid
 * (typically raw coefficients or bad conversions leaked into the _es_r columns)
 * and are treated as missing rather than allowed to distort r-based stats.
 */
export function toValidR(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && Math.abs(n) <= 1 ? n : null;
}

/**
 * Compute two-tailed p-value from correlation coefficient r and sample size N.
 * Uses t-test: t = r * sqrt((N-2)/(1-r^2)), df = N-2
 * This matches the FReD R package's p_from_r() function.
 * Uses jStat for the t-distribution CDF (replaces buggy hand-rolled incompleteBeta).
 */
export function pValueFromR(r: number, n: number): number | null {
  if (!Number.isFinite(r) || !Number.isFinite(n) || n <= 2) {
    return null;
  }
  if (Math.abs(r) >= 0.9999) {
    return 0; // Perfect correlation
  }
  const denom = 1 - r * r;
  if (denom <= 0.0001) {
    return 0;
  }
  const t = r * Math.sqrt((n - 2) / denom);
  const df = n - 2;
  // Two-tailed p-value from t-distribution
  const p = 2 * jStat.studentt.cdf(-Math.abs(t), df);
  return p;
}

/**
 * Assess replication outcome using significance criterion.
 * This is based on the FReD R package's assess_rep_significance() function with criterion="significance_r",
 * with an additional "reversal" outcome for significant effects in the opposite direction.
 *
 * Key behaviors:
 * 1. Uses CSV p-values (original_p_value, replication_p_value) when available, falling back to computing from r and n
 * 2. If original was not significant: success if replication also not significant, failure if replication is significant
 * 3. If original was significant: checks replication significance AND direction consistency
 * 4. Returns "reversal" for significant replications in the opposite direction
 * 5. Returns "failure" for non-significant replications
 */
export function computeSignificanceOutcome(
  origES: number,
  repES: number,
  origN: number,
  repN: number,
  origESType: string,
  repESType: string,
  pOrigCSV?: number | null,
  pRepCSV?: number | null
): "success" | "failure" | "reversal" | "inconclusive" {
  // Validate inputs
  if (!Number.isFinite(origES) || !Number.isFinite(repES) || !Number.isFinite(origN) || !Number.isFinite(repN)) {
    return "inconclusive";
  }
  if (origN <= 2 || repN <= 2) {
    return "inconclusive";
  }

  // Use CSV p-value if available, otherwise compute from r
  const pOrig = (pOrigCSV != null && Number.isFinite(pOrigCSV)) ? pOrigCSV : pValueFromR(origES, origN);
  if (pOrig === null) {
    return "inconclusive";
  }

  // If original was not significant, classify based on replication agreement
  if (pOrig >= 0.05) {
    const pRep = (pRepCSV != null && Number.isFinite(pRepCSV)) ? pRepCSV : pValueFromR(repES, repN);
    if (pRep === null) return "inconclusive";
    // Both non-significant = agreement (success); replication significant = disagreement (failure)
    return pRep >= 0.05 ? "success" : "failure";
  }

  // Step 2: Original was significant — compute p-value for replication
  const pRep = (pRepCSV != null && Number.isFinite(pRepCSV)) ? pRepCSV : pValueFromR(repES, repN);
  if (pRep === null) {
    return "inconclusive";
  }

  // Step 3: Check significance and direction
  const sameDirection = Math.sign(origES) === Math.sign(repES);
  const repIsSignificant = pRep < 0.05;

  if (repIsSignificant && sameDirection) {
    return "success"; // "replication effect is significant" in same direction
  } else if (repIsSignificant && !sameDirection) {
    return "reversal"; // significant effect in opposite direction
  } else {
    return "failure"; // "replication effect is not significant"
  }
}

/**
 * Was the original effect statistically significant (p < 0.05)?
 *
 * Mirrors the p-value preference of the significance criterion: the stored
 * original_p_value wins when present; otherwise p is computed from the
 * normalized r and original N. Returns null when neither source can settle it.
 */
export function isOriginalSignificant(row: AnyRecord): boolean | null {
  const pCSV = toNumber(row.original_p_value);
  if (pCSV != null && Number.isFinite(pCSV)) return pCSV < 0.05;
  const eO_r = toValidR(row.original_es_r);
  const nO = toNumber(row.original_n ?? row.n_original);
  if (eO_r != null && nO != null) {
    const p = pValueFromR(eO_r, nO);
    if (p != null) return p < 0.05;
  }
  return null;
}

/**
 * Compute 95% confidence interval for correlation coefficient using Fisher z-transformation.
 * This matches the FReD R package's compute_ci_r() function.
 *
 * @param r - correlation coefficient
 * @param n - sample size
 * @returns {lower, upper} CI bounds, or null if invalid inputs
 */
export function computeCIForCorrelation(r: number, n: number): { lower: number; upper: number } | null {
  // Require n > 3 for valid Fisher z transformation
  if (!Number.isFinite(r) || !Number.isFinite(n) || n <= 3) {
    return null;
  }

  // Handle edge cases where r is too close to ±1
  if (Math.abs(r) >= 0.9999) {
    return null;
  }

  // Fisher r-to-z transformation: z = 0.5 * ln((1 + r) / (1 - r))
  const z = 0.5 * Math.log((1 + r) / (1 - r));

  // Standard error of z: SE_z = 1 / sqrt(n - 3)
  const seZ = 1 / Math.sqrt(n - 3);

  // Z critical value for 95% CI
  const zCrit = 1.96;

  // Confidence interval in z-space
  const zLower = z - zCrit * seZ;
  const zUpper = z + zCrit * seZ;

  // Inverse Fisher z-to-r transformation: r = (exp(2z) - 1) / (exp(2z) + 1)
  const rLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
  const rUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);

  // Validate results
  if (!Number.isFinite(rLower) || !Number.isFinite(rUpper)) {
    return null;
  }

  return { lower: rLower, upper: rUpper };
}

/**
 * Parse a CI string from the spreadsheet (e.g., "[0.12, 0.45]" or "0.12, 0.45")
 * Returns {lower, upper} or null if cannot be parsed.
 */
export function parseCIString(ciStr: string | null | undefined): { lower: number; upper: number } | null {
  if (!ciStr || typeof ciStr !== "string") return null;

  // Remove brackets and whitespace
  const cleaned = ciStr.replace(/[\[\]()]/g, "").trim();
  if (!cleaned) return null;

  // Split by comma or semicolon
  const parts = cleaned.split(/[,;]/).map(s => s.trim());
  if (parts.length !== 2) return null;

  const lower = parseFloat(parts[0]);
  const upper = parseFloat(parts[1]);

  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;

  // Ensure lower <= upper
  return lower <= upper ? { lower, upper } : { lower: upper, upper: lower };
}

/**
 * Effect-size metric families, mirroring the `families` block of
 * `data_ingestor/codebook_rules.json`. Duplicated as a literal because that file is
 * Python-side only (read by `data_ingestor/validation_rules.py`) and is not bundled
 * for the browser — if a family gains members there, add them here too.
 */
const ES_TYPE_FAMILIES: Record<string, string[]> = {
  correlation: ["r", "pearson r", "pearsons r", "pearson's r", "correlation", "phi 2x2",
    "partial correlation", "partial r", "semipartial correlation", "point biserial", "rank bis",
    "spearman's r", "spearmans r", "spearman's rho", "rho", "kendall's tau", "tauu", "wilcoxon r",
    "icc", "kappa", "cliff's delta", "cliffs delta"],
  standardised_mean_diff: ["d", "cohen's d", "cohens d", "smd", "g", "hedges g", "hedges' g",
    "glass' delta", "glass's delta", "glass delta"],
  paired_smd: ["dz", "d z", "cohen's dz", "cohens dz", "d sample (dep)"],
  ratio: ["or", "odds ratio", "rr", "risk ratio", "relative risk", "relative risk ratio", "rrr",
    "hr", "hazard ratio", "irr", "incidence rate ratio", "bayes factor"],
  log_ratio: ["log rom", "log odds ratio", "log rr", "log hr", "ird", "incidence rate difference"],
  variance_share: ["eta2", "etasq", "eta squared", "partial eta2", "partial etasq",
    "partial eta squared", "etasq (partial)", "omega2", "omegasq", "omega squared", "r2",
    "r squared", "heritability (a2)"],
  nonneg_unbounded: ["f", "cohen's f", "f2", "cohen's f2", "chi2", "chi squared", "w", "cohen's w",
    "kendall's w", "f test", "f statistic"],
  cramers_v: ["cramer's v", "cramers v", "v"],
  probability_of_superiority: ["auc", "roc area", "a", "common language effect size", "cles"],
  uninterpretable_without_units: ["beta", "beta (std)", "beta (unstd)", "b", "b (unstd)",
    "b unstd", "beta (mmol/l per allele)", "unstandardized coefficient", "ser method", "other"],
};

/** Reverse index: normalized es-type label -> family name. */
const ES_TYPE_TO_FAMILY: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [family, members] of Object.entries(ES_TYPE_FAMILIES)) {
    for (const member of members) out[member] = family;
  }
  return out;
})();

/**
 * Normalize an es-type label for family lookup: lowercase, straight apostrophes, and
 * hyphen/underscore/whitespace runs collapsed to single spaces. Collapsing hyphens
 * matters — the master stores `omega-squared` where the codebook lists `omega squared`.
 */
export function normalizeESType(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-_\s]+/g, " ")
    .trim();
}

/** The metric family for an es-type label, or null if it is not in the codebook. */
export function esTypeFamily(raw: unknown): string | null {
  const key = normalizeESType(raw);
  return key ? (ES_TYPE_TO_FAMILY[key] ?? null) : null;
}

/**
 * Are two effect-size metrics on the same scale, so that a raw effect size in one
 * can meaningfully be compared against a confidence interval reported in the other?
 *
 * This gates Strategy 1 of the CI-based outcome definitions, which compare one
 * study's raw `_es` against the *other* study's stored `_es_95_CI`. That only means
 * something when both sides share a scale: a between-groups Cohen's d checked against
 * a within-subject dz interval, or a d against an odds-ratio interval, yields a
 * success/failure verdict with no interpretation at all.
 *
 * Deliberately permissive, because the cost of a false mismatch (silently rerouting
 * hundreds of correctly-matched rows) is far higher than the cost of a missed one:
 * - a blank label is not evidence of mismatch — most rows record no es-type;
 * - two identical labels are comparable whether or not the codebook knows them, so
 *   types absent from it (e.g. `f²`) keep working;
 * - if either label is unrecognized we decline to judge and treat them as comparable,
 *   preserving existing behavior rather than guessing.
 */
export function metricsComparable(a: unknown, b: unknown): boolean {
  const na = normalizeESType(a);
  const nb = normalizeESType(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  const famA = esTypeFamily(na);
  const famB = esTypeFamily(nb);
  if (famA === null || famB === null) return true;
  return famA === famB;
}

/**
 * Assess replication outcome: Original ES in Replication CI
 * Checks whether the original effect size falls within the replication's confidence interval.
 *
 * Strategy:
 * 1. First try: Use raw original ES with pre-computed replication CI (matches original paper methodology)
 * 2. Fallback: Use normalized r with computed CI via Fisher z-transformation
 *
 * Strategy 1 is only valid when the two studies report the same effect-size metric,
 * since it compares the original's raw ES against a CI expressed in the replication's
 * metric. Callers must pass `skipPrecomputedCI = true` when the metrics differ (see
 * `metricsComparable`), which routes the row to Strategy 2 — that path compares r
 * against r and so is metric-safe by construction.
 */
export function computeOriginalInReplicationCI(
  origESRaw: number | null,
  origESR: number | null,
  repESR: number | null,
  repN: number | null,
  repCIStr: string | null | undefined,
  skipPrecomputedCI = false
): "success" | "failure" | "inconclusive" {
  // Strategy 1: Use raw original ES with pre-computed replication CI
  const precomputedRepCI = skipPrecomputedCI ? null : parseCIString(repCIStr);
  if (precomputedRepCI !== null && origESRaw != null && Number.isFinite(origESRaw)) {
    if (origESRaw >= precomputedRepCI.lower && origESRaw <= precomputedRepCI.upper) {
      return "success";
    } else {
      return "failure";
    }
  }

  // Strategy 2: Fall back to normalized r with computed CI
  if (origESR != null && Number.isFinite(origESR) && repESR != null && repN != null) {
    const computedRepCI = computeCIForCorrelation(repESR, repN);
    if (computedRepCI !== null) {
      if (origESR >= computedRepCI.lower && origESR <= computedRepCI.upper) {
        return "success";
      } else {
        return "failure";
      }
    }
  }

  return "inconclusive";
}

/**
 * Assess replication outcome: Replication ES in Original CI
 * Checks whether the replication effect size falls within the original's confidence interval.
 *
 * Strategy:
 * 1. First try: Use raw replication ES with pre-computed original CI (matches original paper methodology)
 * 2. Fallback: Use normalized r with computed CI via Fisher z-transformation
 *
 * As with `computeOriginalInReplicationCI`, Strategy 1 assumes both studies share an
 * effect-size metric. Callers pass `skipPrecomputedCI = true` when they do not.
 */
export function computeReplicationInOriginalCI(
  repESRaw: number | null,
  repESR: number | null,
  origESR: number | null,
  origN: number | null,
  origCIStr: string | null | undefined,
  skipPrecomputedCI = false
): "success" | "failure" | "inconclusive" {
  // Strategy 1: Use raw replication ES with pre-computed original CI
  const precomputedOrigCI = skipPrecomputedCI ? null : parseCIString(origCIStr);
  if (precomputedOrigCI !== null && repESRaw != null && Number.isFinite(repESRaw)) {
    if (repESRaw >= precomputedOrigCI.lower && repESRaw <= precomputedOrigCI.upper) {
      return "success";
    } else {
      return "failure";
    }
  }

  // Strategy 2: Fall back to normalized r with computed CI
  if (repESR != null && Number.isFinite(repESR) && origESR != null && origN != null) {
    const computedOrigCI = computeCIForCorrelation(origESR, origN);
    if (computedOrigCI !== null) {
      if (repESR >= computedOrigCI.lower && repESR <= computedOrigCI.upper) {
        return "success";
      } else {
        return "failure";
      }
    }
  }

  return "inconclusive";
}

/**
 * Shared utility to compute outcome for a row.
 * This eliminates duplicate outcome computation between outcomeStat and InlineScatter.
 *
 * For CI-based methods: First tries raw ES with pre-computed CI (matches original papers),
 * then falls back to normalized r with computed CI via Fisher z-transformation.
 *
 * For significance-based methods: Uses normalized Pearson r values.
 */
export function getOutcomeForRow(
  row: AnyRecord,
  outcomeMethod: OutcomeMethod
): "success" | "failure" | "reversal" | "inconclusive" {
  // Normalized Pearson r values (for significance methods and CI fallback)
  const eO_r = toValidR(row.original_es_r);
  const eR_r = toValidR(row.replication_es_r);
  const nO = toNumber(row.original_n ?? row.n_original);
  const nR = toNumber(row.replication_n ?? row.n_replication);

  // Raw effect sizes (for CI-based methods primary strategy)
  const eO_raw = toNumber(row.original_es);
  const eR_raw = toNumber(row.replication_es);

  const esOType = String(row.original_es_type ?? "");
  const esRType = String(row.replication_es_type ?? "");
  const origCIStr = row.original_es_95_CI as string | null | undefined;
  const repCIStr = row.replication_es_95_CI as string | null | undefined;

  // For significance-based methods: prefer normalized r values, fall back to p-values + raw ES direction
  if (outcomeMethod === "significance") {
    if (eO_r != null && eR_r != null && nO != null && nR != null && nO > 0 && nR > 0) {
      const pOrigCSV = toNumber(row.original_p_value);
      const pRepCSV = toNumber(row.replication_p_value);
      return computeSignificanceOutcome(eO_r, eR_r, nO, nR, esOType, esRType, pOrigCSV, pRepCSV);
    }
    // Fallback: use p-values directly + raw ES for direction
    const pOrig = toNumber(row.original_p_value);
    const pRep = toNumber(row.replication_p_value);
    if (pOrig != null && pRep != null && eO_raw != null && eR_raw != null) {
      const sameDirection = Math.sign(eO_raw) === Math.sign(eR_raw);
      if (pOrig >= 0.05) {
        return pRep >= 0.05 ? "success" : "failure";
      }
      if (pRep < 0.05 && sameDirection) return "success";
      if (pRep < 0.05 && !sameDirection) return "reversal";
      return "failure";
    }
    return "inconclusive";
  }

  // For CI-based methods: pass both raw and r values; functions will use appropriate strategy.
  // Strategy 1 compares one study's raw ES against the other study's stored CI, which is
  // only meaningful on a shared metric — when the metrics differ, skip it and let the
  // r-vs-r Fisher-z fallback answer instead.
  const skipPrecomputedCI = !metricsComparable(esOType, esRType);
  if (outcomeMethod === "orig_in_rep_ci") {
    return computeOriginalInReplicationCI(eO_raw, eO_r, eR_r, nR, repCIStr, skipPrecomputedCI);
  } else {
    // rep_in_orig_ci
    return computeReplicationInOriginalCI(eR_raw, eR_r, eO_r, nO, origCIStr, skipPrecomputedCI);
  }
}
