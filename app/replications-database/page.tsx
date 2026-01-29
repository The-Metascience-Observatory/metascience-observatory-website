"use client";

import { useEffect, useMemo, useState } from "react";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";

type AnyRecord = Record<string, unknown>;

type FredResponse = {
  columns: string[];
  rows: AnyRecord[];
  lastUpdated?: string;
};

type Option = { value: string; label: string };

function uniqueValues(rows: AnyRecord[], key: string): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    const v = String(r[key] ?? "");
    if (v) s.add(v);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

// Helper to check if a value is present (not null, undefined, empty string, or NaN)
function isPresent(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "string" && val.trim() === "") return false;
  const n = toNumber(val);
  return n != null;
}

function formatSig4(value: unknown): string {
  const n = toNumber(value);
  if (n == null) return "";
  const s = Number(n).toPrecision(4);
  if (!/e/i.test(s)) {
    return s.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, ".0").replace(/\.$/u, "");
  }
  return s;
}

function MiniBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const widthPct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 bg-black/10 dark:bg-white/10 rounded">
      <div 
        className={`h-2 rounded ${color ? "" : "bg-black/60 dark:bg-white/60"}`}
        style={{ 
          width: `${widthPct}%`,
          ...(color ? { backgroundColor: color } : {})
        }} 
      />
    </div>
  );
}

// Compute p-value from t-statistic using proper t-distribution approximation
function pValueFromT(t: number, df: number): number {
  const absT = Math.abs(t);
  if (absT === 0) return 1;
  if (!Number.isFinite(absT) || !Number.isFinite(df) || df <= 0) return 1;

  // Use regularized incomplete beta function for t-distribution CDF
  // For t-distribution: P(T > t) = 0.5 * I_x(df/2, 0.5) where x = df/(df + t^2)
  const x = df / (df + absT * absT);
  const a = df / 2;
  const b = 0.5;

  // Compute regularized incomplete beta function I_x(a, b) using continued fraction
  // This gives accurate p-values for all df values
  const betaIncomplete = incompleteBeta(x, a, b);

  // Two-tailed p-value
  return betaIncomplete;
}

// Regularized incomplete beta function I_x(a, b) using continued fraction expansion
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry relation if needed for better convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }

  // Compute beta function B(a,b) using log-gamma for numerical stability
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);

  // Front factor: x^a * (1-x)^b / (a * B(a,b))
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) / a;

  // Continued fraction using Lentz's algorithm
  const maxIter = 200;
  const eps = 1e-14;

  let f = 1;
  let c = 1;
  let d = 0;

  for (let m = 0; m <= maxIter; m++) {
    let numerator: number;
    if (m === 0) {
      numerator = 1;
    } else if (m % 2 === 0) {
      const k = m / 2;
      numerator = (k * (b - k) * x) / ((a + 2 * k - 1) * (a + 2 * k));
    } else {
      const k = (m - 1) / 2;
      numerator = -((a + k) * (a + b + k) * x) / ((a + 2 * k) * (a + 2 * k + 1));
    }

    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;

    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;

    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < eps) break;
  }

  return front * f;
}

// Log-gamma function using Lanczos approximation
function lnGamma(z: number): number {
  if (z <= 0) return Infinity;

  const g = 7;
  const coefficients = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  if (z < 0.5) {
    // Reflection formula: gamma(z) * gamma(1-z) = pi / sin(pi*z)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }

  z -= 1;
  let x = coefficients[0];
  for (let i = 1; i < g + 2; i++) {
    x += coefficients[i] / (z + i);
  }

  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Compute p-value from correlation coefficient r and sample size N.
 * Uses t-test: t = r * sqrt((N-2)/(1-r^2)), df = N-2
 * This matches the FReD R package's p_from_r() function.
 */
function pValueFromR(r: number, n: number): number | null {
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
  return pValueFromT(t, df);
}

/**
 * Assess replication outcome using significance criterion.
 * This is based on the FReD R package's assess_rep_significance() function with criterion="significance_r",
 * with an additional "reversal" outcome for significant effects in the opposite direction.
 *
 * Key behaviors:
 * 1. First checks if ORIGINAL study was significant - if not, returns "inconclusive" (criterion is meaningless)
 * 2. Then checks replication significance AND direction consistency
 * 3. Returns "reversal" for significant replications in the opposite direction
 * 4. Returns "failure" for non-significant replications
 */
function computeSignificanceOutcome(
  origES: number,
  repES: number,
  origN: number,
  repN: number,
  origESType: string,
  repESType: string
): "success" | "failure" | "reversal" | "inconclusive" {
  // Validate inputs
  if (!Number.isFinite(origES) || !Number.isFinite(repES) || !Number.isFinite(origN) || !Number.isFinite(repN)) {
    return "inconclusive";
  }
  if (origN <= 2 || repN <= 2) {
    return "inconclusive";
  }

  // Step 1: Check if ORIGINAL study was significant
  // This matches R package's behavior: if original wasn't significant, criterion is meaningless
  const pOrig = pValueFromR(origES, origN);
  if (pOrig === null || pOrig >= 0.05) {
    return "inconclusive"; // "OS not significant" in R package terminology
  }

  // Step 2: Compute p-value for replication
  const pRep = pValueFromR(repES, repN);
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

// Compute outcome using "Replication Confidence Interval Consistency" method
/**
 * Compute 95% confidence interval for correlation coefficient using Fisher z-transformation.
 * This matches the FReD R package's compute_ci_r() function.
 *
 * @param r - correlation coefficient
 * @param n - sample size
 * @returns {lower, upper} CI bounds, or null if invalid inputs
 */
function computeCIForCorrelation(r: number, n: number): { lower: number; upper: number } | null {
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
function parseCIString(ciStr: string | null | undefined): { lower: number; upper: number } | null {
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
function computeOriginalInReplicationCI(
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
function computeReplicationInOriginalCI(
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
function getOutcomeForRow(
  row: AnyRecord,
  outcomeMethod: "significance" | "orig_in_rep_ci" | "rep_in_orig_ci"
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

  // For significance-based methods, require normalized r values
  if (outcomeMethod === "significance") {
    if (eO_r == null || eR_r == null || nO == null || nR == null || nO <= 0 || nR <= 0) {
      return "inconclusive";
    }
    return computeSignificanceOutcome(eO_r, eR_r, nO, nR, esOType, esRType);
  }

  // For CI-based methods: pass both raw and r values; functions will use appropriate strategy
  if (outcomeMethod === "orig_in_rep_ci") {
    return computeOriginalInReplicationCI(eO_raw, eO_r, eR_r, nR, repCIStr);
  } else {
    // rep_in_orig_ci
    return computeReplicationInOriginalCI(eR_raw, eR_r, eO_r, nO, origCIStr);
  }
}

function transformCitationHtmlToExplorer(html: string): string {
  if (!html) return html;
  // Replace doi.org links with explorer links
  // Match href="https://doi.org/..." and replace with explorer URL
  return html.replace(
    /href=["']https?:\/\/doi\.org\/([^"']+)["']/g,
    (_, doi) => `href="http://explore.metascienceobservatory.org/doi/${doi}" target="_blank" rel="noopener noreferrer"`
  );
}

type ColumnKey =
  | "index"
  | "original_citation_html"
  | "replication_citation_html"
  | "description"
  | "discipline"
  | "result"
  | "original_n"
  | "replication_n"
  | "original_es"
  | "replication_es"
  | "original_es_r"
  | "replication_es_r"
  | "original_es_type"
  | "replication_es_type"
  | "original_authors"
  | "replication_authors"
  | "original_title"
  | "replication_title"
  | "original_journal"
  | "replication_journal"
  | "original_volume"
  | "replication_volume"
  | "original_issue"
  | "replication_issue"
  | "original_pages"
  | "replication_pages"
  | "original_year"
  | "replication_year"
  | "original_url"
  | "replication_url"
  | "tags"
  | "validated"
  | "validated_person";

const ALL_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "index", label: "#" },
  { key: "original_citation_html", label: "Original publication" },
  { key: "replication_citation_html", label: "Replication publication" },
  { key: "description", label: "Description of the original effect" },
  { key: "discipline", label: "Discipline" },
  { key: "result", label: "Result" },
  { key: "original_n", label: "N (orig)" },
  { key: "replication_n", label: "N (rep)" },
  { key: "original_es", label: "ES (orig)" },
  { key: "replication_es", label: "ES (rep)" },
  { key: "original_es_r", label: "ES_r(orig)" },
  { key: "replication_es_r", label: "ES_r(rep)" },
  { key: "original_es_type", label: "ES type (orig)" },
  { key: "replication_es_type", label: "ES type (rep)" },
  { key: "original_authors", label: "Original authors" },
  { key: "replication_authors", label: "Replication authors" },
  { key: "original_title", label: "Original title" },
  { key: "replication_title", label: "Replication title" },
  { key: "original_journal", label: "Original journal" },
  { key: "replication_journal", label: "Replication journal" },
  { key: "original_volume", label: "Original volume" },
  { key: "replication_volume", label: "Replication volume" },
  { key: "original_issue", label: "Original issue" },
  { key: "replication_issue", label: "Replication issue" },
  { key: "original_pages", label: "Original pages" },
  { key: "replication_pages", label: "Replication pages" },
  { key: "original_year", label: "Original year" },
  { key: "replication_year", label: "Replication year" },
  { key: "original_url", label: "Original URL" },
  { key: "replication_url", label: "Replication URL" },
  { key: "tags", label: "Tags" },
  { key: "validated", label: "Human Validated" },
  { key: "validated_person", label: "Validated Person" },
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "index",
  "original_citation_html",
  "replication_citation_html",
  "description",
  "discipline",
  "result",
  "original_n",
  "replication_n",
  "original_es",
  "replication_es",
  "original_es_r",
  "replication_es_r",
  "validated",
];

export default function ReplicationsDatabasePage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [discipline, setDiscipline] = useState<string>("");
  const [openAlexField, setOpenAlexField] = useState<string>("");
    const [result, setResult] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(DEFAULT_COLUMNS)
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [outcomeMethod, setOutcomeMethod] = useState<"significance" | "orig_in_rep_ci" | "rep_in_orig_ci">("significance");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/fred", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FredResponse;
        setData(json);
        setLastUpdated(json.lastUpdated || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const disciplineOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const key = String(r.discipline ?? "");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).filter(([k]) => k !== "");
    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    const sortedValues = entries.map(([k]) => k);
    const values = ["", ...sortedValues];
    return values.map((v) => {
      if (v === "") return { value: v, label: "All disciplines" };
      const c = counts.get(v) || 0;
      return { value: v, label: `${v} (${c})` };
    });
  }, [data]);

  const openAlexFieldOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const key = String(r.openalex_field ?? "");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).filter(([k]) => k !== "");
    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    const sortedValues = entries.map(([k]) => k);
    const values = ["", ...sortedValues];
    return values.map((v) => {
      if (v === "") return { value: v, label: "All fields" };
      const c = counts.get(v) || 0;
      return { value: v, label: `${v} (${c})` };
    });
  }, [data]);

  const resultOptions: Option[] = useMemo(() => {
    if (!data) return [];
    return ["", ...uniqueValues(data.rows, "result")].map((v) => ({ value: v, label: v || "All results" }));
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [] as AnyRecord[];
    return data.rows.filter((r) => {
      if (discipline && String(r.discipline ?? "") !== discipline) return false;
      if (openAlexField && String(r.openalex_field ?? "") !== openAlexField) return false;
      if (result && String(r.result ?? "") !== result) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${r.description ?? ""} ${r.tags ?? ""} ${r.original_citation_html ?? ""} ${r.replication_citation_html ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [data, discipline, openAlexField, result, search]);

  // Compute outcomes once and share between stats and scatterplot
  // This eliminates duplicate computation (Issue #5)
  // IMPORTANT: Only include rows where BOTH original_es_r AND replication_es_r are present
  // Do NOT fall back to es_original/es_replication - those are raw effect sizes in various units
  const computedOutcomes = useMemo(() => {
    const results: Array<{
      row: AnyRecord;
      outcome: "success" | "failure" | "reversal" | "inconclusive";
      // Scatterplot coordinates: original direction is always "positive"
      // Original ES is normalized to absolute value
      // Replication ES is flipped to maintain the relationship
      oAdj: number;
      rAdj: number;
      desc: string;
    }> = [];

    for (const r of filteredRows) {
      // Only use the normalized Pearson r columns - do NOT fall back to raw effect sizes
      // If original_es_r or replication_es_r is missing/empty, skip this row
      if (!isPresent(r.original_es_r) || !isPresent(r.replication_es_r)) continue;

      const eO = toNumber(r.original_es_r);
      const eR = toNumber(r.replication_es_r);

      // Double-check after conversion (handles edge cases)
      // Also skip rows where either effect size is exactly 0 (meaningless for replication assessment)
      if (eO == null || eR == null || eO === 0 || eR === 0) continue;

      const outcome = getOutcomeForRow(r, outcomeMethod);

      // Coordinate transformation for scatterplot:
      // The original effect direction is ALWAYS considered "positive"
      // So we take absolute value of original and flip replication accordingly
      // This preserves the relationship: if replication is in same direction as original,
      // it will appear above y=0; if opposite direction, below y=0
      const oAdj = Math.abs(eO);
      const rAdj = eO >= 0 ? eR : -eR;

      results.push({
        row: r,
        outcome,
        oAdj,
        rAdj,
        desc: String(r.description || r.tags || "")
      });
    }

    return results;
  }, [filteredRows, outcomeMethod]);

  // Stat for outcome mix - uses precomputed outcomes
  // Note: computedOutcomes already filters to only rows with BOTH original_es_r AND replication_es_r present
  const outcomeStat = useMemo(() => {
    let n = 0;
    let success = 0;
    let failure = 0;
    let reversal = 0;
    let inconclusive = 0;

    for (const { row, outcome } of computedOutcomes) {
      const nO = toNumber(row.original_n ?? row.n_original);
      const nR = toNumber(row.replication_n ?? row.n_replication);

      // Only include if sample sizes are available
      if (nO == null || nR == null || nO <= 0 || nR <= 0) {
        continue;
      }

      n++;

      if (outcome === "success") success++;
      else if (outcome === "failure") failure++;
      else if (outcome === "reversal") reversal++;
      else inconclusive++;
    }

    const pct = (v: number) => (n > 0 ? Math.round((v / n) * 1000) / 10 : 0);
    return { n, success, failure, reversal, inconclusive, pctSuccess: pct(success), pctFailure: pct(failure), pctReversal: pct(reversal), pctInconclusive: pct(inconclusive) };
  }, [computedOutcomes]);

  // Stat for result column-based display
  const resultStat = useMemo(() => {
    const n = filteredRows.length;
    let success = 0;
    let failure = 0;
    let inconclusive = 0;
    
    for (const r of filteredRows) {
      const result = String(r.result ?? "").trim();
      // Check exact matches (case-sensitive based on data)
      if (result === "success") {
        success++;
      } else if (result === "failure") {
        failure++;
      } else if (result === "inconclusive" || result === "") {
        // Empty result counts as inconclusive
        inconclusive++;
      } else {
        // Any other non-empty value counts as inconclusive
        inconclusive++;
      }
    }
    const pct = (v: number) => (n > 0 ? Math.round((v / n) * 1000) / 10 : 0);
    return { n, success, failure, inconclusive, pctSuccess: pct(success), pctFailure: pct(failure), pctInconclusive: pct(inconclusive) };
  }, [filteredRows]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <ReplicationsNavbar />
        <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10">
          <div className="mx-auto max-w-[90%]">
            <p className="opacity-70">Loading data…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <ReplicationsNavbar />
        <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10">
          <div className="mx-auto max-w-[90%]">
            <p className="text-red-600 dark:text-red-400">Failed to load: {error || "No data"}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ReplicationsNavbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10">


      {/* Controls */}
      <section className="mx-auto max-w-[90%] mt-6">
        <div className="grid gap-3 md:grid-cols-5 items-end">
          <div className="md:col-span-1">
            <label htmlFor="discipline" className="block text-sm font-medium opacity-80 mb-1">Discipline</label>
            <select
              id="discipline"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {disciplineOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="openAlexField" className="block text-sm font-medium opacity-80 mb-1">OpenAlex Field (experimental - has errors)</label>
            <select
              id="openAlexField"
              value={openAlexField}
              onChange={(e) => setOpenAlexField(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {openAlexFieldOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label htmlFor="search" className="block text-sm font-medium opacity-80 mb-1">Search description, tags, or references</label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, tags, or references"
              className="h-10"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90%] grid md:grid-cols-3 gap-4 mt-6">
        <div className="border rounded p-4">
          <div className="text-sm font-medium mb-3">Outcome mix -- human or AI judgement <span className="font-bold">({resultStat.n} Effect replications)</span></div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Success</div>
              <div className="flex-1"><MiniBar value={resultStat.pctSuccess} max={100} color="#10b981" /></div>
              <div className="w-24 text-right text-sm">{resultStat.success} ({resultStat.pctSuccess}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Inconclusive</div>
              <div className="flex-1"><MiniBar value={resultStat.pctInconclusive} max={100} color="#9ca3af" /></div>
              <div className="w-24 text-right text-sm">{resultStat.inconclusive} ({resultStat.pctInconclusive}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Failure</div>
              <div className="flex-1"><MiniBar value={resultStat.pctFailure} max={100} color="#f87171" /></div>
              <div className="w-24 text-right text-sm">{resultStat.failure} ({resultStat.pctFailure}%)</div>
            </div>
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm font-medium mb-3">Outcome mix - computed from stat when available <span className="font-bold">({outcomeStat.n} Effect replications)</span></div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Success</div>
              <div className="flex-1"><MiniBar value={outcomeStat.pctSuccess} max={100} color="#10b981" /></div>
              <div className="w-24 text-right text-sm">{outcomeStat.success} ({outcomeStat.pctSuccess}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Inconclusive</div>
              <div className="flex-1"><MiniBar value={outcomeStat.pctInconclusive} max={100} color="#9ca3af" /></div>
              <div className="w-24 text-right text-sm">{outcomeStat.inconclusive} ({outcomeStat.pctInconclusive}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Failure</div>
              <div className="flex-1"><MiniBar value={outcomeStat.pctFailure} max={100} color="#f87171" /></div>
              <div className="w-24 text-right text-sm">{outcomeStat.failure} ({outcomeStat.pctFailure}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Reversal</div>
              <div className="flex-1"><MiniBar value={outcomeStat.pctReversal} max={100} color="#b91c1c" /></div>
              <div className="w-24 text-right text-sm">{outcomeStat.reversal} ({outcomeStat.pctReversal}%)</div>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium opacity-80 mb-1">
              Method{" "}
              <a
                href="/docs/replication-outcome-classification"
                className="text-xs opacity-60 hover:opacity-80 underline"
              >
                more info
              </a>
            </label>
            <select
              value={outcomeMethod}
              onChange={(e) => setOutcomeMethod(e.target.value as "significance" | "orig_in_rep_ci" | "rep_in_orig_ci")}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="significance">Statistically significant effect in the same direction?</option>
              <option value="orig_in_rep_ci">Original effect size in replication 95% confidence interval?</option>
              <option value="rep_in_orig_ci">Replication effect size in original 95% confidence interval?</option>
            </select>
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Replication Effect Size vs Original Effect Size ({computedOutcomes.length} replications)</div>
          <div className="mt-2">
            <InlineScatter points={computedOutcomes} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90%] border rounded mt-6">
        <div className="p-2 border-b flex items-center justify-between">
          <h3 className="font-medium">Data Table</h3>
          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="px-3 py-1 text-sm border rounded hover:bg-black/5 dark:hover:bg-white/5"
            >
              Columns ({visibleColumns.size})
            </button>
            {showColumnSelector && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowColumnSelector(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-background border rounded shadow-lg z-20 p-3 max-h-96 overflow-y-auto">
                  <div className="mb-2 text-xs font-semibold opacity-70">Select columns to display</div>
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 p-1 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={(e) => {
                          const newSet = new Set(visibleColumns);
                          if (e.target.checked) {
                            newSet.add(col.key);
                          } else {
                            newSet.delete(col.key);
                          }
                          setVisibleColumns(newSet);
                        }}
                        className="cursor-pointer"
                      />
                      <span className="text-sm">{col.label}</span>
                    </label>
                  ))}
                  <div className="mt-2 pt-2 border-t flex gap-2">
                    <button
                      onClick={() => setVisibleColumns(new Set(DEFAULT_COLUMNS))}
                      className="text-xs px-2 py-1 border rounded hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setVisibleColumns(new Set(ALL_COLUMNS.map(c => c.key)))}
                      className="text-xs px-2 py-1 border rounded hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Select All
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto h-[calc(100vh-400px)] max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-background dark:bg-background">
                {visibleColumns.has("index") && <th className="text-right p-2">#</th>}
                {visibleColumns.has("original_citation_html") && <th className="text-left p-2">Original publication</th>}
                {visibleColumns.has("replication_citation_html") && <th className="text-left p-2">Replication publication</th>}
                {visibleColumns.has("description") && <th className="text-left p-2">Description of the original effect</th>}
                {visibleColumns.has("discipline") && <th className="text-left p-2">Discipline</th>}
                {visibleColumns.has("result") && <th className="text-left p-2">Result</th>}
                {visibleColumns.has("original_n") && <th className="text-right p-2">N (orig)</th>}
                {visibleColumns.has("replication_n") && <th className="text-right p-2">N (rep)</th>}
                {visibleColumns.has("original_es") && <th className="text-right p-2">ES (orig)</th>}
                {visibleColumns.has("replication_es") && <th className="text-right p-2">ES (rep)</th>}
                {visibleColumns.has("original_es_r") && <th className="text-right p-2"><a href="/docs/effect-size-normalization" className="underline hover:opacity-80">ES_r(orig)</a></th>}
                {visibleColumns.has("replication_es_r") && <th className="text-right p-2"><a href="/docs/effect-size-normalization" className="underline hover:opacity-80">ES_r(rep)</a></th>}
                {visibleColumns.has("original_es_type") && <th className="text-right p-2">ES type (orig)</th>}
                {visibleColumns.has("replication_es_type") && <th className="text-right p-2">ES type (rep)</th>}
                {visibleColumns.has("original_authors") && <th className="text-left p-2">Original authors</th>}
                {visibleColumns.has("replication_authors") && <th className="text-left p-2">Replication authors</th>}
                {visibleColumns.has("original_title") && <th className="text-left p-2">Original title</th>}
                {visibleColumns.has("replication_title") && <th className="text-left p-2">Replication title</th>}
                {visibleColumns.has("original_journal") && <th className="text-left p-2">Original journal</th>}
                {visibleColumns.has("replication_journal") && <th className="text-left p-2">Replication journal</th>}
                {visibleColumns.has("original_volume") && <th className="text-right p-2">Original volume</th>}
                {visibleColumns.has("replication_volume") && <th className="text-right p-2">Replication volume</th>}
                {visibleColumns.has("original_issue") && <th className="text-left p-2">Original issue</th>}
                {visibleColumns.has("replication_issue") && <th className="text-left p-2">Replication issue</th>}
                {visibleColumns.has("original_pages") && <th className="text-left p-2">Original pages</th>}
                {visibleColumns.has("replication_pages") && <th className="text-left p-2">Replication pages</th>}
                {visibleColumns.has("original_year") && <th className="text-right p-2">Original year</th>}
                {visibleColumns.has("replication_year") && <th className="text-right p-2">Replication year</th>}
                {visibleColumns.has("original_url") && <th className="text-left p-2">Original URL</th>}
                {visibleColumns.has("replication_url") && <th className="text-left p-2">Replication URL</th>}
                {visibleColumns.has("tags") && <th className="text-left p-2">Tags</th>}
                {visibleColumns.has("validated") && <th className="text-left p-2">Human Validated</th>}
                {visibleColumns.has("validated_person") && <th className="text-left p-2">Validated Person</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 2000).map((r, i) => {
                // Check if original data exists (not just empty strings)
                const origNVal = r.original_n ?? r.n_original;
                const repNVal = r.replication_n ?? r.n_replication;
                const origESVal = r.original_es_r ?? r.es_original;
                const repESVal = r.replication_es_r ?? r.es_replication;
                
                // Only convert to number if value exists and is not empty
                // Don't convert "0" strings if they represent missing data (empty in CSV = missing)
                const nO = origNVal != null && String(origNVal).trim() !== "" ? toNumber(origNVal) : null;
                const nR = repNVal != null && String(repNVal).trim() !== "" ? toNumber(repNVal) : null;
                const eO = origESVal != null && String(origESVal).trim() !== "" ? toNumber(origESVal) : null;
                const eR = repESVal != null && String(repESVal).trim() !== "" ? toNumber(repESVal) : null;
                
                const esOType = String(r.original_es_type ?? "");
                const esRType = String(r.replication_es_type ?? "");
                const citationO = transformCitationHtmlToExplorer(String(r.original_citation_html || ""));
                const citationR = transformCitationHtmlToExplorer(String(r.replication_citation_html || ""));
                return (
                  <tr key={i} className="border-b hover:bg-black/5 dark:hover:bg-white/5">
                    {visibleColumns.has("index") && (
                    <td className="align-top p-2 text-right">{i + 1}</td>
                    )}
                    {visibleColumns.has("original_citation_html") && (
                    <td className="align-top p-2" style={{ width: 240 }}>
                        {citationO ? (
                          <span dangerouslySetInnerHTML={{ __html: citationO }} />
                        ) : (
                          <span className="opacity-80">—</span>
                      )}
                    </td>
                    )}
                    {visibleColumns.has("replication_citation_html") && (
                    <td className="align-top p-2" style={{ width: 240 }}>
                        {citationR ? (
                          <span dangerouslySetInnerHTML={{ __html: citationR }} />
                        ) : (
                          <span className="opacity-80">—</span>
                      )}
                    </td>
                    )}
                    {visibleColumns.has("description") && (
                    <td className="align-top p-2">
                      <div className="font-medium">{String(r.description || r.tags || "—")}</div>
                    </td>
                    )}
                    {visibleColumns.has("discipline") && (
                    <td className="align-top p-2">{String(r.discipline || "")}</td>
                    )}
                    {visibleColumns.has("result") && (
                    <td className="align-top p-2">{String(r.result || "")}</td>
                    )}
                    {visibleColumns.has("original_n") && (
                      <td className="align-top p-2 text-right">{nO != null && nO !== 0 ? nO : ""}</td>
                    )}
                    {visibleColumns.has("replication_n") && (
                      <td className="align-top p-2 text-right">{nR != null && nR !== 0 ? nR : ""}</td>
                    )}
                    {visibleColumns.has("original_es") && (() => {
                      const rawVal = r.original_es;
                      const rawES = rawVal != null && String(rawVal).trim() !== "" ? toNumber(rawVal) : null;
                      return <td className="align-top p-2 text-right">{rawES != null ? `${formatSig4(rawES)}${esOType ? ` (${esOType})` : ""}` : ""}</td>;
                    })()}
                    {visibleColumns.has("replication_es") && (() => {
                      const rawVal = r.replication_es;
                      const rawES = rawVal != null && String(rawVal).trim() !== "" ? toNumber(rawVal) : null;
                      return <td className="align-top p-2 text-right">{rawES != null ? `${formatSig4(rawES)}${esRType ? ` (${esRType})` : ""}` : ""}</td>;
                    })()}
                    {visibleColumns.has("original_es_r") && (
                      <td className="align-top p-2 text-right">{eO != null && eO !== 0 ? formatSig4(eO) : ""}</td>
                    )}
                    {visibleColumns.has("replication_es_r") && (
                      <td className="align-top p-2 text-right">{eR != null && eR !== 0 ? formatSig4(eR) : ""}</td>
                    )}
                    {visibleColumns.has("original_es_type") && (
                      <td className="align-top p-2 text-right">{esOType || ""}</td>
                    )}
                    {visibleColumns.has("replication_es_type") && (
                      <td className="align-top p-2 text-right">{esRType || ""}</td>
                    )}
                    {visibleColumns.has("original_authors") && (
                      <td className="align-top p-2">{String(r.original_authors || "")}</td>
                    )}
                    {visibleColumns.has("replication_authors") && (
                      <td className="align-top p-2">{String(r.replication_authors || "")}</td>
                    )}
                    {visibleColumns.has("original_title") && (
                      <td className="align-top p-2">{String(r.original_title || "")}</td>
                    )}
                    {visibleColumns.has("replication_title") && (
                      <td className="align-top p-2">{String(r.replication_title || "")}</td>
                    )}
                    {visibleColumns.has("original_journal") && (
                      <td className="align-top p-2">{String(r.original_journal || "")}</td>
                    )}
                    {visibleColumns.has("replication_journal") && (
                      <td className="align-top p-2">{String(r.replication_journal || "")}</td>
                    )}
                    {visibleColumns.has("original_volume") && (
                      <td className="align-top p-2 text-right">{String(r.original_volume || "")}</td>
                    )}
                    {visibleColumns.has("replication_volume") && (
                      <td className="align-top p-2 text-right">{String(r.replication_volume || "")}</td>
                    )}
                    {visibleColumns.has("original_issue") && (
                      <td className="align-top p-2">{String(r.original_issue || "")}</td>
                    )}
                    {visibleColumns.has("replication_issue") && (
                      <td className="align-top p-2">{String(r.replication_issue || "")}</td>
                    )}
                    {visibleColumns.has("original_pages") && (
                      <td className="align-top p-2">{String(r.original_pages || "")}</td>
                    )}
                    {visibleColumns.has("replication_pages") && (
                      <td className="align-top p-2">{String(r.replication_pages || "")}</td>
                    )}
                    {visibleColumns.has("original_year") && (
                      <td className="align-top p-2 text-right">{String(r.original_year || "")}</td>
                    )}
                    {visibleColumns.has("replication_year") && (
                      <td className="align-top p-2 text-right">{String(r.replication_year || "")}</td>
                    )}
                    {visibleColumns.has("original_url") && (
                      <td className="align-top p-2">{String(r.original_url || "")}</td>
                    )}
                    {visibleColumns.has("replication_url") && (
                      <td className="align-top p-2">{String(r.replication_url || "")}</td>
                    )}
                    {visibleColumns.has("tags") && (
                      <td className="align-top p-2">{String(r.tags || "")}</td>
                    )}
                    {visibleColumns.has("validated") && (
                      <td className="align-top p-2">{String(r.validated || "")}</td>
                    )}
                    {visibleColumns.has("validated_person") && (
                      <td className="align-top p-2">{String(r.validated_person || "")}</td>
                    )}
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.size} className="p-6 text-center opacity-70">No rows</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-2 flex justify-between items-center">
          <div className="text-xs opacity-60">Showing {Math.min(filteredRows.length, 2000)} of {filteredRows.length} rows.</div>
          {lastUpdated && (
            <div className="text-xs opacity-60">Last updated {lastUpdated}</div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[90%] mt-6 space-y-3">
        <p className="opacity-80">
          Data shown here are derived from the <a className="underline" href="https://forrt.org/apps/fred_explorer.html" target="_blank" rel="noreferrer">FReD replication dataset</a> as described in <a className="underline" href="https://openpsychologydata.metajnl.com/articles/10.5334/jopd.101" target="_blank" rel="noreferrer">Röseler et al., <em>Journal of Open Psychology Data</em>, 12: 8, pp. 1–23</a>.  Repository link: <a className="underline" href="https://osf.io/9r62x" target="_blank" rel="noreferrer">https://osf.io/9r62x</a> .
        </p>
        <p className="opacity-80">
          Data is © 2024 The Author(s) and licensed under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International (CC‑BY 4.0)</a>. You must credit the original authors and source if you use these data.
        </p>
      </section>
      </main>
      <Footer />
    </div>
  );
}

/**
 * InlineScatter component - displays scatterplot of original vs replication effect sizes
 *
 * Uses precomputed points from computedOutcomes to avoid duplicate computation.
 * The coordinate system is normalized so that:
 * - Original effect direction is ALWAYS considered "positive" (X-axis shows |original ES|)
 * - Replication ES is adjusted so same-direction effects are positive, opposite-direction are negative
 * - This means points above y=0 replicated in same direction, below y=0 replicated in opposite direction
 */
type ScatterPoint = {
  oAdj: number;
  rAdj: number;
  desc: string;
  outcome: "success" | "failure" | "reversal" | "inconclusive";
};

function InlineScatter({ points }: { points: ScatterPoint[] }) {
  const width = 600;
  const height = 240;
  const margin = { top: 10, right: 10, bottom: 45, left: 45 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Axis ranges - original ES is always positive (0 to 1), replication can be -1 to 1
  const xMin: number = 0;
  const xMax: number = 1;
  const yMin: number = -1;
  const yMax: number = 1;

  const x = (v: number) => {
    if (xMax === xMin) return innerW / 2;
    return ((v - xMin) / (xMax - xMin)) * innerW;
  };
  const y = (v: number) => {
    if (yMax === yMin) return innerH / 2;
    return innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  };

  const allTicks: number[] = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
  const xTicks = allTicks.filter((t) => t >= xMin && t <= xMax);
  const yTicks = allTicks.filter((t) => t >= yMin && t <= yMax);

  function color(res: "success" | "failure" | "reversal" | "inconclusive"): string {
    if (res === "success") return "#10b981"; // Green for success
    if (res === "failure") return "#f87171"; // Light red for failure
    if (res === "reversal") return "#b91c1c"; // Dark red for reversal
    return "#9ca3af"; // Gray for inconclusive or other
  }

  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="max-w-full h-auto">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <rect x={0} y={0} width={innerW} height={innerH} fill="#f3f4f6" />
          {xTicks.map((t) => (
            <g key={`x-${t}`} transform={`translate(${x(t)},${innerH})`}>
              <line y1={0} y2={6} stroke="#111827" strokeWidth={1} />
              <text y={20} textAnchor="middle" className="text-xs fill-current" style={{ opacity: 0.7 }}>{t}</text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={`y-${t}`} transform={`translate(0,${y(t)})`}>
              <line x1={-6} x2={0} stroke="#111827" strokeWidth={1} />
              <text x={-10} dy="0.32em" textAnchor="end" className="text-xs fill-current" style={{ opacity: 0.7 }}>{t}</text>
            </g>
          ))}
          {/* Diagonal line representing perfect replication */}
          {(() => {
            const tMin = Math.max(xMin, yMin);
            const tMax = Math.min(xMax, yMax);
            return (
              <line x1={x(tMin)} y1={y(tMin)} x2={x(tMax)} y2={y(tMax)} stroke="#6b7280" strokeDasharray="4 4" />
            );
          })()}
          {/* Horizontal line at y=0 showing direction boundary */}
          <line x1={0} y1={y(0)} x2={innerW} y2={y(0)} stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />
          {/* X-axis label */}
          <text x={innerW / 2} y={innerH + 40} textAnchor="middle" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 10 }}>Original Effect Size (r)</text>
          {/* Y-axis label */}
          <text x={-innerH / 2} y={-38} textAnchor="middle" transform="rotate(-90)" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 10 }}>Replication Effect Size (r)</text>
          {points.map((p, i) => {
            const fill = color(p.outcome);
            return (
              <g key={i} transform={`translate(${x(p.oAdj)},${y(p.rAdj)})`}>
                <title>{p.desc}</title>
                <circle r={3} fill={fill} fillOpacity={0.85} />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#10b981" }} />
          <span>Success</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#9ca3af" }} />
          <span>Inconclusive</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#f87171" }} />
          <span>Failure</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#b91c1c" }} />
          <span>Reversal</span>
        </div>
      </div>
    </div>
  );
}


