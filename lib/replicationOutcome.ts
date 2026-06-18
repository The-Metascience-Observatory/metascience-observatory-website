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

export function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
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
 * Assess replication outcome: Original ES in Replication CI
 * Checks whether the original effect size falls within the replication's confidence interval.
 *
 * Strategy:
 * 1. First try: Use raw original ES with pre-computed replication CI (matches original paper methodology)
 * 2. Fallback: Use normalized r with computed CI via Fisher z-transformation
 */
export function computeOriginalInReplicationCI(
  origESRaw: number | null,
  origESR: number | null,
  repESR: number | null,
  repN: number | null,
  repCIStr: string | null | undefined
): "success" | "failure" | "inconclusive" {
  // Strategy 1: Use raw original ES with pre-computed replication CI
  const precomputedRepCI = parseCIString(repCIStr);
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
 */
export function computeReplicationInOriginalCI(
  repESRaw: number | null,
  repESR: number | null,
  origESR: number | null,
  origN: number | null,
  origCIStr: string | null | undefined
): "success" | "failure" | "inconclusive" {
  // Strategy 1: Use raw replication ES with pre-computed original CI
  const precomputedOrigCI = parseCIString(origCIStr);
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
  const eO_r = toNumber(row.original_es_r);
  const eR_r = toNumber(row.replication_es_r);
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

  // For CI-based methods: pass both raw and r values; functions will use appropriate strategy
  if (outcomeMethod === "orig_in_rep_ci") {
    return computeOriginalInReplicationCI(eO_raw, eO_r, eR_r, nR, repCIStr);
  } else {
    // rep_in_orig_ci
    return computeReplicationInOriginalCI(eR_raw, eR_r, eO_r, nO, origCIStr);
  }
}
