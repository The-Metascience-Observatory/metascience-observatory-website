"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { generateCitationHtml, transformCitationHtmlToExplorer, citationSearchText } from "@/lib/citations";
import { jStat } from "jstat";
import INITIATIVE_TAG_NAMES from "@/data/initiative_tag_names.json";
import TOPIC_ONTOLOGY from "@/data/metascience_observatory_topic_ontology.json";

type AnyRecord = Record<string, unknown>;

const ES_TYPE_COLORS: Record<string, string> = {
  "d": "#3b82f6",
  "r": "#10b981",
  "Glass' delta": "#8b5cf6",
  "w": "#ec4899",
  "Cliff's delta": "#14b8a6",
  "OR": "#f59e0b",
  "Other": "#9ca3af",
};
const NAMED_ES_TYPES = new Set(Object.keys(ES_TYPE_COLORS).filter(k => k !== "Other"));
// ES types with incompatible scales (e.g. percentage-point differences) excluded from raw scatterplot
const EXCLUDED_ES_TYPES = new Set(["IRD"]);

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
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
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

/**
 * Compute two-tailed p-value from correlation coefficient r and sample size N.
 * Uses t-test: t = r * sqrt((N-2)/(1-r^2)), df = N-2
 * This matches the FReD R package's p_from_r() function.
 * Uses jStat for the t-distribution CDF (replaces buggy hand-rolled incompleteBeta).
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
function computeSignificanceOutcome(
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

type ColumnKey =
  | "index"
  | "original_citation_html"
  | "replication_citation_html"
  | "description"
  | "discipline"
  | "subdiscipline"
  | "result"
  | "original_n"
  | "replication_n"
  | "original_es"
  | "replication_es"
  | "original_es_r"
  | "replication_es_r"
  | "original_es_type"
  | "replication_es_type"
  | "original_es_95_CI"
  | "replication_es_95_CI"
  | "original_p_value"
  | "replication_p_value"
  | "original_p_value_type"
  | "replication_p_value_type"
  | "original_p_value_tails"
  | "replication_p_value_tails"
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
  | "validated_person"
  | "replication_initiative_tag"
  | "openalex_field"
  | "openalex_subfield"
  | "source";

const ALL_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "index", label: "#" },
  { key: "original_citation_html", label: "Original publication" },
  { key: "replication_citation_html", label: "Replication publication" },
  { key: "description", label: "Description of the original effect" },
  { key: "discipline", label: "Discipline" },
  { key: "subdiscipline", label: "Subdiscipline" },
  { key: "result", label: "Result" },
  { key: "original_n", label: "N (orig)" },
  { key: "replication_n", label: "N (rep)" },
  { key: "original_es", label: "ES (orig)" },
  { key: "replication_es", label: "ES (rep)" },
  { key: "original_es_r", label: "ES_r (orig)" },
  { key: "replication_es_r", label: "ES_r (rep)" },
  { key: "original_es_type", label: "ES type (orig)" },
  { key: "replication_es_type", label: "ES type (rep)" },
  { key: "original_es_95_CI", label: "ES 95% CI (orig)" },
  { key: "replication_es_95_CI", label: "ES 95% CI (rep)" },
  { key: "original_p_value", label: "p-value (orig)" },
  { key: "replication_p_value", label: "p-value (rep)" },
  { key: "original_p_value_type", label: "p-value type (orig)" },
  { key: "replication_p_value_type", label: "p-value type (rep)" },
  { key: "original_p_value_tails", label: "p-value tails (orig)" },
  { key: "replication_p_value_tails", label: "p-value tails (rep)" },
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
  { key: "replication_initiative_tag", label: "Replication Initiative" },
  { key: "openalex_field", label: "OpenAlex Field" },
  { key: "openalex_subfield", label: "OpenAlex Subfield" },
  { key: "source", label: "Source" },
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "index",
  "original_citation_html",
  "replication_citation_html",
  "description",
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
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ReplicationsDatabaseContent />
    </Suspense>
  );
}

function ReplicationsDatabaseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [field, setField] = useState<string>("");
  const [discipline, setDiscipline] = useState<string>("");
  const [subdiscipline, setSubdiscipline] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [initiative, setInitiative] = useState<string>(searchParams.get("initiative") || "");
  const [search, setSearch] = useState<string>("");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(DEFAULT_COLUMNS)
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [outcomeMethod, setOutcomeMethod] = useState<"significance" | "orig_in_rep_ci" | "rep_in_orig_ci">("rep_in_orig_ci");
  const [yearAnalysisLevel, setYearAnalysisLevel] = useState<"effect" | "paper">("paper");
  const [paperThreshold, setPaperThreshold] = useState<number>(0.75);

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

  // Sync initiative filter to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (initiative) {
      params.set("initiative", initiative);
    } else {
      params.delete("initiative");
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [initiative, searchParams, router]);

  // Build ontology lookup maps
  const ontologyMaps = useMemo(() => {
    const disciplineToField = new Map<string, string>();
    const fieldToDisciplines = new Map<string, string[]>();
    const disciplineToSubs = new Map<string, string[]>();

    const ont = TOPIC_ONTOLOGY as Record<string, Record<string, string[]>>;
    for (const [fieldName, disciplines] of Object.entries(ont)) {
      const discNames: string[] = [];
      for (const [discName, subs] of Object.entries(disciplines)) {
        disciplineToField.set(discName, fieldName);
        disciplineToSubs.set(discName, subs);
        discNames.push(discName);
      }
      fieldToDisciplines.set(fieldName, discNames);
    }
    return { disciplineToField, fieldToDisciplines, disciplineToSubs };
  }, []);

  // Field options: count rows per field, only show fields with data
  const fieldOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const disc = String(r.discipline ?? "").trim();
      const f = ontologyMaps.disciplineToField.get(disc);
      if (f) counts.set(f, (counts.get(f) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { value: "", label: "All fields" },
      ...entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` })),
    ];
  }, [data, ontologyMaps]);

  // Discipline options: constrained by selected field, count from data
  const disciplineOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const allowedDiscs = field
      ? new Set(ontologyMaps.fieldToDisciplines.get(field) || [])
      : null;
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const disc = String(r.discipline ?? "").trim();
      if (!disc) continue;
      if (allowedDiscs && !allowedDiscs.has(disc)) continue;
      counts.set(disc, (counts.get(disc) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { value: "", label: "All disciplines" },
      ...entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` })),
    ];
  }, [data, field, ontologyMaps]);

  // Subdiscipline options: constrained by selected discipline (or field), count from data
  const subdisciplineOptions: Option[] = useMemo(() => {
    if (!data) return [];
    // Determine allowed subdisciplines from ontology
    let allowedSubs: Set<string> | null = null;
    if (discipline) {
      allowedSubs = new Set(ontologyMaps.disciplineToSubs.get(discipline) || []);
    } else if (field) {
      const discs = ontologyMaps.fieldToDisciplines.get(field) || [];
      const subs = new Set<string>();
      for (const d of discs) {
        for (const s of ontologyMaps.disciplineToSubs.get(d) || []) subs.add(s);
      }
      allowedSubs = subs;
    }
    // Also filter rows by field/discipline to get accurate counts
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const rowDisc = String(r.discipline ?? "").trim();
      if (field) {
        const rowField = ontologyMaps.disciplineToField.get(rowDisc);
        if (rowField !== field) continue;
      }
      if (discipline && rowDisc !== discipline) continue;
      const raw = String(r.subdiscipline ?? "").trim();
      if (!raw) continue;
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (allowedSubs && !allowedSubs.has(part)) continue;
        counts.set(part, (counts.get(part) || 0) + 1);
      }
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { value: "", label: "All subdisciplines" },
      ...entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` })),
    ];
  }, [data, field, discipline, ontologyMaps]);

  const resultOptions: Option[] = useMemo(() => {
    if (!data) return [];
    return ["", ...uniqueValues(data.rows, "result")].map((v) => ({ value: v, label: v || "All results" }));
  }, [data]);

  const initiativeOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const tag = String(r.replication_initiative_tag ?? "").trim();
      if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    const entries = Array.from(counts.entries());
    const tagNames: Record<string, string> = INITIATIVE_TAG_NAMES;
    entries.sort((a, b) => {
      const nameA = tagNames[a[0]] || a[0];
      const nameB = tagNames[b[0]] || b[0];
      return nameA.localeCompare(nameB);
    });
    return [
      { value: "", label: "All initiatives" },
      ...entries.map(([tag, count]) => ({
        value: tag,
        label: `${tagNames[tag] || tag} (${count})`,
      })),
    ];
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [] as AnyRecord[];
    return data.rows.filter((r) => {
      if (field) {
        const rowDisc = String(r.discipline ?? "").trim();
        const rowField = ontologyMaps.disciplineToField.get(rowDisc);
        if (rowField !== field) return false;
      }
      if (discipline && !String(r.discipline ?? "").split(",").map((s) => s.trim()).includes(discipline)) return false;
      if (subdiscipline && !String(r.subdiscipline ?? "").split(",").map((s) => s.trim()).includes(subdiscipline)) return false;
      if (result && String(r.result ?? "") !== result) return false;
      if (initiative && String(r.replication_initiative_tag ?? "").trim() !== initiative) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${r.description ?? ""} ${r.tags ?? ""} ${citationSearchText(r.original_authors as string, r.original_journal as string, r.original_year as string)} ${citationSearchText(r.replication_authors as string, r.replication_journal as string, r.replication_year as string)}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [data, field, discipline, subdiscipline, result, initiative, search, ontologyMaps]);

  // Compute outcomes once and share between stats and scatterplot
  // Includes rows with es_r (plottable on scatterplot) AND rows with only raw ES (stats only)
  // oAdj/rAdj are NaN for rows without es_r — scatterplot filters these out
  const computedOutcomes = useMemo(() => {
    const results: Array<{
      row: AnyRecord;
      outcome: "success" | "failure" | "reversal" | "inconclusive";
      // Scatterplot coordinates: NaN when es_r not available (raw-ES-only rows)
      oAdj: number;
      rAdj: number;
      desc: string;
    }> = [];

    for (const r of filteredRows) {
      const eO = toNumber(r.original_es_r);
      const eR = toNumber(r.replication_es_r);
      const hasESR = eO != null && eR != null && eO !== 0 && eR !== 0;

      // Also check if row has raw ES data (for CI/significance fallback)
      const eO_raw = toNumber(r.original_es);
      const eR_raw = toNumber(r.replication_es);
      const hasRawES = eO_raw != null && eR_raw != null;

      // Skip rows with neither es_r nor raw ES
      if (!hasESR && !hasRawES) continue;

      const outcome = getOutcomeForRow(r, outcomeMethod);

      // Skip rows that produce inconclusive AND have no es_r (nothing useful to contribute)
      if (outcome === "inconclusive" && !hasESR) continue;

      // Scatterplot coordinates: only when es_r available
      const oAdj = hasESR ? Math.abs(eO!) : NaN;
      const rAdj = hasESR ? (eO! >= 0 ? eR! : -eR!) : NaN;

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

  const rawESPoints = useMemo(() => {
    const results: Array<{ origES: number; repES: number; esType: string; desc: string }> = [];
    for (const r of filteredRows) {
      const oRaw = toNumber(r.original_es);
      const rRaw = toNumber(r.replication_es);
      if (oRaw == null || rRaw == null) continue;
      const rawType = String(r.original_es_type ?? "").trim();
      if (EXCLUDED_ES_TYPES.has(rawType)) continue;
      const esType = NAMED_ES_TYPES.has(rawType) ? rawType : "Other";
      results.push({ origES: oRaw, repES: rRaw, esType, desc: String(r.description || r.tags || "") });
    }
    return results;
  }, [filteredRows]);

  // Stat for outcome mix - uses precomputed outcomes
  // For significance method: sample sizes needed (to compute p from r)
  // For CI methods: pre-computed CIs don't need sample sizes, so skip the gate
  const outcomeStat = useMemo(() => {
    let n = 0;
    let success = 0;
    let failure = 0;
    let reversal = 0;
    let inconclusive = 0;

    for (const { row, outcome } of computedOutcomes) {
      // For significance method, require sample sizes (needed to compute p from r)
      if (outcomeMethod === "significance") {
        const nO = toNumber(row.original_n ?? row.n_original);
        const nR = toNumber(row.replication_n ?? row.n_replication);
        if (nO == null || nR == null || nO <= 0 || nR <= 0) continue;
      }

      n++;

      if (outcome === "success") success++;
      else if (outcome === "failure") failure++;
      else if (outcome === "reversal") reversal++;
      else inconclusive++;
    }

    const pct = (v: number) => (n > 0 ? Math.round((v / n) * 1000) / 10 : 0);
    return { n, success, failure, reversal, inconclusive, pctSuccess: pct(success), pctFailure: pct(failure), pctReversal: pct(reversal), pctInconclusive: pct(inconclusive) };
  }, [computedOutcomes, outcomeMethod]);

  // Stat for result column-based display
  const resultStat = useMemo(() => {
    let n = 0;
    let success = 0;
    let failure = 0;
    let reversal = 0;
    let inconclusive = 0;

    for (const r of filteredRows) {
      const result = String(r.result ?? "").trim();
      // Skip rows with no result — they should not count in outcome mix
      if (!result) continue;
      n++;
      if (result === "success") {
        success++;
      } else if (result === "failure") {
        failure++;
      } else if (result === "reversal") {
        reversal++;
      } else {
        inconclusive++;
      }
    }
    const pct = (v: number) => (n > 0 ? Math.round((v / n) * 1000) / 10 : 0);
    return { n, success, failure, reversal, inconclusive, pctSuccess: pct(success), pctFailure: pct(failure), pctReversal: pct(reversal), pctInconclusive: pct(inconclusive) };
  }, [filteredRows]);

  const yearBins = useMemo(() => {
    const entries: Array<{ year: number; result: string }> = [];
    for (const r of filteredRows) {
      const yearRaw = toNumber(r.original_year);
      if (yearRaw == null || yearRaw < 1900 || yearRaw > 2030) continue;
      const year = Math.floor(yearRaw);
      const res = String(r.result ?? "").trim();
      if (!res) continue;
      entries.push({ year, result: res });
    }
    if (entries.length === 0) return [];

    const minYear = Math.min(...entries.map(e => e.year));
    const maxYear = Math.max(...entries.map(e => e.year));
    const binStart = Math.floor(minYear / 5) * 5;
    const binEnd = Math.floor(maxYear / 5) * 5;

    const bins: Array<{
      label: string;
      total: number;
      success: number;
      failure: number;
      inconclusive: number;
      rate: number;
    }> = [];

    for (let start = binStart; start <= binEnd; start += 5) {
      const end = start + 4;
      const inBin = entries.filter(e => e.year >= start && e.year <= end);
      const total = inBin.length;
      const success = inBin.filter(e => e.result === "success").length;
      const failure = inBin.filter(e => e.result === "failure").length;
      const inconclusive = total - success - failure;
      const rate = total >= 20 ? Math.round((success / total) * 1000) / 10 : -1;
      bins.push({
        label: `${start}-${String(end).slice(2)}`,
        total,
        success,
        failure,
        inconclusive,
        rate,
      });
    }
    // Trim leading and trailing bins that lack sufficient data
    const firstValid = bins.findIndex(b => b.rate >= 0);
    const lastValid = bins.length - 1 - [...bins].reverse().findIndex(b => b.rate >= 0);
    if (firstValid < 0) return [];
    return bins.slice(firstValid, lastValid + 1);
  }, [filteredRows]);

  // Paper-level year bins: group by original_url, success if >= threshold of effects succeeded
  const yearBinsPaper = useMemo(() => {
    const paperMap = new Map<string, { year: number; results: string[] }>();
    for (const r of filteredRows) {
      const url = String(r.original_url ?? "").trim();
      if (!url) continue;
      const yearRaw = toNumber(r.original_year);
      if (yearRaw == null || yearRaw < 1900 || yearRaw > 2030) continue;
      const year = Math.floor(yearRaw);
      const res = String(r.result ?? "").trim();
      if (!res) continue;
      if (!paperMap.has(url)) {
        paperMap.set(url, { year, results: [] });
      }
      paperMap.get(url)!.results.push(res);
    }

    const entries: Array<{ year: number; result: string }> = [];
    for (const [, paper] of paperMap) {
      const successes = paper.results.filter(r => r === "success").length;
      const paperResult = successes / paper.results.length >= paperThreshold ? "success" : "failure";
      entries.push({ year: paper.year, result: paperResult });
    }
    if (entries.length === 0) return [];

    const minYear = Math.min(...entries.map(e => e.year));
    const maxYear = Math.max(...entries.map(e => e.year));
    const binStart = Math.floor(minYear / 5) * 5;
    const binEnd = Math.floor(maxYear / 5) * 5;

    const bins: YearBin[] = [];
    for (let start = binStart; start <= binEnd; start += 5) {
      const end = start + 4;
      const inBin = entries.filter(e => e.year >= start && e.year <= end);
      const total = inBin.length;
      const success = inBin.filter(e => e.result === "success").length;
      const failure = inBin.filter(e => e.result === "failure").length;
      const inconclusive = total - success - failure;
      const rate = total >= 10 ? Math.round((success / total) * 1000) / 10 : -1;
      bins.push({ label: `${start}-${String(end).slice(2)}`, total, success, failure, inconclusive, rate });
    }
    const firstValid = bins.findIndex(b => b.rate >= 0);
    const lastValid = bins.length - 1 - [...bins].reverse().findIndex(b => b.rate >= 0);
    if (firstValid < 0) return [];
    return bins.slice(firstValid, lastValid + 1);
  }, [filteredRows, paperThreshold]);

  // Count unique papers for the subtitle
  const uniquePaperCount = useMemo(() => {
    const urls = new Set<string>();
    for (const r of filteredRows) {
      const url = String(r.original_url ?? "").trim();
      const res = String(r.result ?? "").trim();
      const yearRaw = toNumber(r.original_year);
      if (url && res && yearRaw != null && yearRaw >= 1900 && yearRaw <= 2030) {
        urls.add(url);
      }
    }
    return urls.size;
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
        <div className="grid gap-3 md:grid-cols-6 items-end">
          <div className="md:col-span-1">
            <label htmlFor="field" className="block text-sm font-medium opacity-80 mb-1">Field</label>
            <select
              id="field"
              value={field}
              onChange={(e) => {
                setField(e.target.value);
                setDiscipline("");
                setSubdiscipline("");
              }}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {fieldOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="discipline" className="block text-sm font-medium opacity-80 mb-1">Discipline</label>
            <select
              id="discipline"
              value={discipline}
              onChange={(e) => {
                const val = e.target.value;
                setDiscipline(val);
                setSubdiscipline("");
                if (val) {
                  const parentField = ontologyMaps.disciplineToField.get(val);
                  if (parentField) setField(parentField);
                }
              }}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {disciplineOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="subdiscipline" className="block text-sm font-medium opacity-80 mb-1">Subdiscipline</label>
            <select
              id="subdiscipline"
              value={subdiscipline}
              onChange={(e) => {
                const val = e.target.value;
                setSubdiscipline(val);
                if (val) {
                  // Find parent discipline and field from ontology
                  for (const [discName, subs] of ontologyMaps.disciplineToSubs.entries()) {
                    if (subs.includes(val)) {
                      setDiscipline(discName);
                      const parentField = ontologyMaps.disciplineToField.get(discName);
                      if (parentField) setField(parentField);
                      break;
                    }
                  }
                }
              }}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {subdisciplineOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="initiative" className="block text-sm font-medium opacity-80 mb-1">
              Replication Initiative <Link href="/replication-initiatives" className="text-xs opacity-60 hover:opacity-80 underline">(more info)</Link>
            </label>
            <select
              id="initiative"
              value={initiative}
              onChange={(e) => setInitiative(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {initiativeOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium opacity-80 mb-1">Search description, tags, or references</label>
            <div className="flex items-center gap-3">
              <Input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, tags, or references"
                className="h-10 flex-1"
              />
              <div className="flex flex-col items-end shrink-0">
                <a href="/replications-database/by-discipline" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                  Detailed breakdown by discipline
                </a>
                <a href="/replications-database/by-journal" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                  Detailed breakdown by journal
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90%] grid md:grid-cols-3 gap-4 mt-6">
        <div className="border rounded p-4">
          <div className="text-xs font-medium mb-2">Outcome mix -- human or AI judgement <span className="font-bold">({resultStat.n} effect replications)</span></div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-20 text-xs">Success</div>
              <div className="flex-1"><MiniBar value={resultStat.pctSuccess} max={100} color="#10b981" /></div>
              <div className="w-20 text-right text-xs">{resultStat.success} ({resultStat.pctSuccess}%)</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 text-xs">Inconclusive</div>
              <div className="flex-1"><MiniBar value={resultStat.pctInconclusive} max={100} color="#9ca3af" /></div>
              <div className="w-20 text-right text-xs">{resultStat.inconclusive} ({resultStat.pctInconclusive}%)</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 text-xs">Failure</div>
              <div className="flex-1"><MiniBar value={resultStat.pctFailure} max={100} color="#f87171" /></div>
              <div className="w-20 text-right text-xs">{resultStat.failure} ({resultStat.pctFailure}%)</div>
            </div>
            {resultStat.reversal > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-20 text-xs">Reversal</div>
              <div className="flex-1"><MiniBar value={resultStat.pctReversal} max={100} color="#b91c1c" /></div>
              <div className="w-20 text-right text-xs">{resultStat.reversal} ({resultStat.pctReversal}%)</div>
            </div>
            )}
          </div>
          <div className="border-t mt-3 pt-3">
            <div className="text-xs font-medium mb-2">Outcome mix - computed from stats when available <span className="font-bold">({outcomeStat.n} effect replications)</span></div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-20 text-xs">Success</div>
                <div className="flex-1"><MiniBar value={outcomeStat.pctSuccess} max={100} color="#10b981" /></div>
                <div className="w-20 text-right text-xs">{outcomeStat.success} ({outcomeStat.pctSuccess}%)</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 text-xs">Failure</div>
                <div className="flex-1"><MiniBar value={outcomeStat.pctFailure} max={100} color="#f87171" /></div>
                <div className="w-20 text-right text-xs">{outcomeStat.failure} ({outcomeStat.pctFailure}%)</div>
              </div>
              {outcomeMethod === "significance" && (
                <div className="flex items-center gap-2">
                  <div className="w-20 text-xs">Reversal</div>
                  <div className="flex-1"><MiniBar value={outcomeStat.pctReversal} max={100} color="#b91c1c" /></div>
                  <div className="w-20 text-right text-xs">{outcomeStat.reversal} ({outcomeStat.pctReversal}%)</div>
                </div>
              )}
            </div>
            <div className="mt-2">
              <label className="block text-xs font-medium opacity-80 mb-1">
                Method{" "}
                <a
                  href="/docs/replication-outcome-classification"
                  className="text-[10px] opacity-60 hover:opacity-80 underline"
                >
                  more info
                </a>
              </label>
              <select
                value={outcomeMethod}
                onChange={(e) => setOutcomeMethod(e.target.value as "significance" | "orig_in_rep_ci" | "rep_in_orig_ci")}
                className="w-full h-6 text-[9px] rounded-md border border-border bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="significance">Statistically significant effect in the same direction?</option>
                <option value="orig_in_rep_ci">Original effect size in replication 95% confidence interval?</option>
                <option value="rep_in_orig_ci">Replication effect size in original 95% confidence interval?</option>
              </select>
            </div>
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="text-xs font-medium mb-2">Replication Effect Size vs Original Effect Size - Converted to Standard Scale <span className="font-bold">({computedOutcomes.filter(p => p.outcome !== "inconclusive" && Number.isFinite(p.oAdj)).length} effect replications)</span></div>
          <div className="mt-2">
            <InlineScatter points={computedOutcomes.filter(p => p.outcome !== "inconclusive" && Number.isFinite(p.oAdj) && Number.isFinite(p.rAdj))} showReversal={outcomeMethod === "significance"} />
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="text-xs font-medium">
              Replication Success Rate by Year of Original Publication{" "}
              <span className="font-bold">
                ({yearAnalysisLevel === "effect"
                  ? `${yearBins.filter(b => b.rate >= 0).reduce((s, b) => s + b.total, 0)} effect replications from ${uniquePaperCount} original papers`
                  : `${yearBinsPaper.filter(b => b.rate >= 0).reduce((s, b) => s + b.total, 0)} original papers`})
              </span>
            </div>
            <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
              <div className="flex items-center gap-1">
                <label className="text-[10px] opacity-60 cursor-help" title="A paper is considered successfully replicated if X% of effect replications for effects reported in that paper were successful. The threshold X can be shifted with the dropdown below.">Level of analysis:</label>
                <select
                  value={yearAnalysisLevel}
                  onChange={(e) => setYearAnalysisLevel(e.target.value as "effect" | "paper")}
                  className="text-[10px] border rounded px-1 py-0.5 bg-background"
                >
                  <option value="effect">Effect</option>
                  <option value="paper">Paper</option>
                </select>
              </div>
              {yearAnalysisLevel === "paper" && (
                <div className="flex items-center gap-1">
                  <label className="text-[10px] opacity-60">Threshold for success:</label>
                  <select
                    value={paperThreshold}
                    onChange={(e) => setPaperThreshold(Number(e.target.value))}
                    className="text-[10px] border rounded px-1 py-0.5 bg-background"
                  >
                    <option value={0.5}>50%</option>
                    <option value={0.75}>75%</option>
                    <option value={0.9}>90%</option>
                    <option value={1}>100%</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2">
            <InlineYearBars
              bins={yearAnalysisLevel === "effect" ? yearBins : yearBinsPaper}
              threshold={yearAnalysisLevel === "effect" ? 20 : 10}
              binSize={5}
            />
          </div>
        </div>
        {/* Raw effect sizes scatterplot - hidden for now
        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Raw Effect Sizes ({rawESPoints.length} replications)</div>
          <div className="mt-2">
            <RawESScatter points={rawESPoints} />
          </div>
        </div>
        */}
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
                {visibleColumns.has("subdiscipline") && <th className="text-left p-2">Subdiscipline</th>}
                {visibleColumns.has("result") && <th className="text-left p-2">Result</th>}
                {visibleColumns.has("original_n") && <th className="text-right p-2">N (orig)</th>}
                {visibleColumns.has("replication_n") && <th className="text-right p-2">N (rep)</th>}
                {visibleColumns.has("original_es") && <th className="text-right p-2">ES (orig)</th>}
                {visibleColumns.has("replication_es") && <th className="text-right p-2">ES (rep)</th>}
                {visibleColumns.has("original_es_r") && <th className="text-right p-2"><a href="/docs/effect-size-normalization" className="underline hover:opacity-80">ES_r(orig)</a></th>}
                {visibleColumns.has("replication_es_r") && <th className="text-right p-2"><a href="/docs/effect-size-normalization" className="underline hover:opacity-80">ES_r(rep)</a></th>}
                {visibleColumns.has("original_es_type") && <th className="text-right p-2">ES type (orig)</th>}
                {visibleColumns.has("replication_es_type") && <th className="text-right p-2">ES type (rep)</th>}
                {visibleColumns.has("original_es_95_CI") && <th className="text-right p-2">ES 95% CI (orig)</th>}
                {visibleColumns.has("replication_es_95_CI") && <th className="text-right p-2">ES 95% CI (rep)</th>}
                {visibleColumns.has("original_p_value") && <th className="text-right p-2">p-value (orig)</th>}
                {visibleColumns.has("replication_p_value") && <th className="text-right p-2">p-value (rep)</th>}
                {visibleColumns.has("original_p_value_type") && <th className="text-left p-2">p-value type (orig)</th>}
                {visibleColumns.has("replication_p_value_type") && <th className="text-left p-2">p-value type (rep)</th>}
                {visibleColumns.has("original_p_value_tails") && <th className="text-left p-2">p-value tails (orig)</th>}
                {visibleColumns.has("replication_p_value_tails") && <th className="text-left p-2">p-value tails (rep)</th>}
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
                {visibleColumns.has("replication_initiative_tag") && <th className="text-left p-2">Replication Initiative</th>}
                {visibleColumns.has("openalex_field") && <th className="text-left p-2">OpenAlex Field</th>}
                {visibleColumns.has("openalex_subfield") && <th className="text-left p-2">OpenAlex Subfield</th>}
                {visibleColumns.has("source") && <th className="text-left p-2">Source</th>}
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
                const citationO = transformCitationHtmlToExplorer(generateCitationHtml(r.original_authors as string, r.original_journal as string, r.original_year as string, r.original_url as string));
                const citationR = transformCitationHtmlToExplorer(generateCitationHtml(r.replication_authors as string, r.replication_journal as string, r.replication_year as string, r.replication_url as string));
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
                    {visibleColumns.has("subdiscipline") && (
                      <td className="align-top p-2">{String(r.subdiscipline || "")}</td>
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
                    {visibleColumns.has("original_es_95_CI") && (
                      <td className="align-top p-2 text-right">{String(r.original_es_95_CI || "")}</td>
                    )}
                    {visibleColumns.has("replication_es_95_CI") && (
                      <td className="align-top p-2 text-right">{String(r.replication_es_95_CI || "")}</td>
                    )}
                    {visibleColumns.has("original_p_value") && (
                      <td className="align-top p-2 text-right">{String(r.original_p_value || "")}</td>
                    )}
                    {visibleColumns.has("replication_p_value") && (
                      <td className="align-top p-2 text-right">{String(r.replication_p_value || "")}</td>
                    )}
                    {visibleColumns.has("original_p_value_type") && (
                      <td className="align-top p-2">{String(r.original_p_value_type || "")}</td>
                    )}
                    {visibleColumns.has("replication_p_value_type") && (
                      <td className="align-top p-2">{String(r.replication_p_value_type || "")}</td>
                    )}
                    {visibleColumns.has("original_p_value_tails") && (
                      <td className="align-top p-2">{String(r.original_p_value_tails || "")}</td>
                    )}
                    {visibleColumns.has("replication_p_value_tails") && (
                      <td className="align-top p-2">{String(r.replication_p_value_tails || "")}</td>
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
                    {visibleColumns.has("replication_initiative_tag") && (
                      <td className="align-top p-2">{(INITIATIVE_TAG_NAMES as Record<string, string>)[String(r.replication_initiative_tag || "")] || String(r.replication_initiative_tag || "")}</td>
                    )}
                    {visibleColumns.has("openalex_field") && (
                      <td className="align-top p-2">{String(r.openalex_field || "")}</td>
                    )}
                    {visibleColumns.has("openalex_subfield") && (
                      <td className="align-top p-2">{String(r.openalex_subfield || "")}</td>
                    )}
                    {visibleColumns.has("source") && (
                      <td className="align-top p-2">{String(r.source || "")}</td>
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
        <p className="opacity-80 text-xs">
          Some data shown here is derived from the <a className="underline" href="https://forrt.org/apps/fred_explorer.html" target="_blank" rel="noreferrer">FReD replication dataset</a>. If you use that data, please cite <a className="underline" href="https://openpsychologydata.metajnl.com/articles/10.5334/jopd.101" target="_blank" rel="noreferrer">Röseler et al., <em>Journal of Open Psychology Data</em>, 12: 8, pp. 1–23 (2024)</a> and their <a className="underline" href="https://osf.io/preprints/metaarxiv/me2ub_v1" target="_blank" rel="noreferrer">more recent preprint</a>. For more info on the original FReD dataset, see this OSF repository: <a className="underline" href="https://osf.io/9r62x" target="_blank" rel="noreferrer">https://osf.io/9r62x</a>. That data is © 2024 The Author(s) and licensed under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International (CC‑BY 4.0)</a>. You must credit the original authors and source if you use that data. Data that comes from FReD is tagged in the "Validated Person" column as "FoRRT FReD team", "forrt.org team: LK", "FReD_API_team", or similarly. 
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

function InlineScatter({ points, showReversal = true }: { points: ScatterPoint[]; showReversal?: boolean }) {
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
          <text x={innerW / 2} y={innerH + 40} textAnchor="middle" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 10 }}>Original Effect Size (Pearson's r equivalent)</text>
          {/* Y-axis label */}
          <text x={-innerH / 2} y={-38} textAnchor="middle" transform="rotate(-90)" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 10 }}>Replication Effect Size (Pearson's r equivalent)</text>
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
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded" style={{ background: "#10b981" }} />
          <span>Success</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded" style={{ background: "#f87171" }} />
          <span>Failure</span>
        </div>
        {showReversal && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded" style={{ background: "#b91c1c" }} />
            <span>Reversal</span>
          </div>
        )}
      </div>
    </div>
  );
}

type YearBin = {
  label: string;
  total: number;
  success: number;
  failure: number;
  inconclusive: number;
  rate: number;
};

function InlineYearBars({ bins, threshold, binSize }: { bins: YearBin[]; threshold: number; binSize: number }) {
  const width = 600;
  const height = 240;
  const margin = { top: 10, right: 10, bottom: 45, left: 45 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (bins.length === 0) {
    return <div className="text-sm opacity-50">Not enough data -- need at least {threshold} papers in a {binSize} year time interval</div>;
  }

  const barGap = 4;
  const barWidth = Math.max(12, Math.min(50, (innerW - barGap * (bins.length - 1)) / bins.length));
  const totalBarsWidth = bins.length * barWidth + (bins.length - 1) * barGap;
  const offsetX = (innerW - totalBarsWidth) / 2;

  const yScale = (v: number) => innerH - (v / 100) * innerH;
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="max-w-full h-auto">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <rect x={0} y={0} width={innerW} height={innerH} fill="#f3f4f6" />
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#d1d5db" strokeWidth={0.5} />
              <line x1={-6} x2={0} y1={yScale(t)} y2={yScale(t)} stroke="#111827" strokeWidth={1} />
              <text x={-10} y={yScale(t)} dy="0.32em" textAnchor="end" className="text-xs fill-current" style={{ opacity: 0.7 }}>{t}%</text>
            </g>
          ))}
          {bins.map((bin, i) => {
            const bx = offsetX + i * (barWidth + barGap);
            const insufficientData = bin.rate < 0;
            const barH = insufficientData ? 0 : (bin.rate / 100) * innerH;
            const by = innerH - barH;
            return (
              <g key={bin.label}>
                <title>{insufficientData ? `${bin.label}: insufficient data (${bin.total} replications)` : `${bin.label}: ${bin.rate}% success (${bin.success}/${bin.total})`}</title>
                {insufficientData ? (
                  <text x={bx + barWidth / 2} y={innerH - 24} textAnchor="middle" className="fill-current" style={{ fontSize: 7, opacity: 0.4 }}>
                    <tspan x={bx + barWidth / 2} dy="0">not</tspan>
                    <tspan x={bx + barWidth / 2} dy="9">enough</tspan>
                    <tspan x={bx + barWidth / 2} dy="9">data</tspan>
                  </text>
                ) : (
                  <>
                    <rect x={bx} y={by} width={barWidth} height={Math.max(barH, 2)} fill="#10b981" fillOpacity={0.85} rx={1} />
                    <text x={bx + barWidth / 2} y={by - 4} textAnchor="middle" className="fill-current" style={{ fontSize: 9, opacity: 0.7 }}>{bin.total}</text>
                  </>
                )}
                <text x={bx + barWidth / 2} y={innerH + 12} textAnchor="end" transform={`rotate(-45, ${bx + barWidth / 2}, ${innerH + 12})`} className="fill-current" style={{ fontSize: 9, opacity: 0.7 }}>{bin.label}</text>
              </g>
            );
          })}
          <text x={-innerH / 2} y={-38} textAnchor="middle" transform="rotate(-90)" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 10 }}>Replication Success Rate (%)</text>
          <text x={innerW / 2} y={innerH + 44} textAnchor="middle" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 10 }}>Year of Original Publication (5-year bins)</text>
        </g>
      </svg>
    </div>
  );
}

type RawScatterPoint = {
  origES: number;
  repES: number;
  esType: string;
  desc: string;
};

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function niceStep(range: number): number {
  const rough = range / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough))));
  const normalized = rough / pow;
  if (normalized <= 1) return pow;
  if (normalized <= 2) return 2 * pow;
  if (normalized <= 5) return 5 * pow;
  return 10 * pow;
}

function RawESScatter({ points }: { points: RawScatterPoint[] }) {
  const width = 600;
  const height = 240;
  const margin = { top: 10, right: 10, bottom: 45, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (points.length === 0) {
    return <div className="text-sm opacity-50">No data with raw effect sizes</div>;
  }

  // Dynamic axis range using percentile clamping
  const allX = points.map(p => p.origES);
  const allY = points.map(p => p.repES);

  let xMin: number, xMax: number, yMin: number, yMax: number;
  if (points.length <= 2) {
    const allVals = [...allX, ...allY];
    const lo = Math.min(...allVals) - 1;
    const hi = Math.max(...allVals) + 1;
    xMin = lo; xMax = hi; yMin = lo; yMax = hi;
  } else {
    const p2x = percentile(allX, 2.5);
    const p97x = percentile(allX, 97.5);
    const p2y = percentile(allY, 2.5);
    const p97y = percentile(allY, 97.5);
    const padX = Math.max((p97x - p2x) * 0.05, 0.1);
    const padY = Math.max((p97y - p2y) * 0.05, 0.1);
    xMin = p2x - padX;
    xMax = p97x + padX;
    yMin = p2y - padY;
    yMax = p97y + padY;
  }

  const clampX = (v: number) => Math.max(xMin, Math.min(xMax, v));
  const clampY = (v: number) => Math.max(yMin, Math.min(yMax, v));
  const isClamped = (p: RawScatterPoint) =>
    p.origES < xMin || p.origES > xMax || p.repES < yMin || p.repES > yMax;

  const x = (v: number) => {
    if (xMax === xMin) return innerW / 2;
    return ((v - xMin) / (xMax - xMin)) * innerW;
  };
  const y = (v: number) => {
    if (yMax === yMin) return innerH / 2;
    return innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  };

  // Generate nice tick marks
  const stepX = niceStep(xMax - xMin);
  const stepY = niceStep(yMax - yMin);
  const xTicks: number[] = [];
  const yTicks: number[] = [];
  for (let t = Math.ceil(xMin / stepX) * stepX; t <= xMax; t += stepX) xTicks.push(Math.round(t * 1000) / 1000);
  for (let t = Math.ceil(yMin / stepY) * stepY; t <= yMax; t += stepY) yTicks.push(Math.round(t * 1000) / 1000);

  // Legend: only show types present, sorted by count descending
  const typeCounts = new Map<string, number>();
  for (const p of points) typeCounts.set(p.esType, (typeCounts.get(p.esType) || 0) + 1);
  const presentTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);

  // Diagonal line range (y=x)
  const diagMin = Math.max(xMin, yMin);
  const diagMax = Math.min(xMax, yMax);

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
          {/* Diagonal y=x line */}
          {diagMin < diagMax && (
            <line x1={x(diagMin)} y1={y(diagMin)} x2={x(diagMax)} y2={y(diagMax)} stroke="#6b7280" strokeDasharray="4 4" />
          )}
          {/* y=0 line if in range */}
          {yMin <= 0 && yMax >= 0 && (
            <line x1={0} y1={y(0)} x2={innerW} y2={y(0)} stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />
          )}
          {/* x=0 line if in range */}
          {xMin <= 0 && xMax >= 0 && (
            <line x1={x(0)} y1={0} x2={x(0)} y2={innerH} stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />
          )}
          <text x={innerW / 2} y={innerH + 40} textAnchor="middle" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 10 }}>Original Effect Size (raw)</text>
          <text x={-innerH / 2} y={-42} textAnchor="middle" transform="rotate(-90)" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 10 }}>Replication Effect Size (raw)</text>
          {points.map((p, i) => {
            const cx = x(clampX(p.origES));
            const cy = y(clampY(p.repES));
            const fill = ES_TYPE_COLORS[p.esType] || ES_TYPE_COLORS["Other"];
            const clamped = isClamped(p);
            return (
              <g key={i} transform={`translate(${cx},${cy})`}>
                <title>{`${p.desc}\n${p.esType}: orig=${p.origES}, rep=${p.repES}`}</title>
                {clamped ? (
                  <polygon points="0,-4 3.5,3 -3.5,3" fill={fill} fillOpacity={0.6} />
                ) : (
                  <circle r={3} fill={fill} fillOpacity={0.85} />
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {presentTypes.map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ background: ES_TYPE_COLORS[type] || ES_TYPE_COLORS["Other"] }} />
            <span>{type} ({typeCounts.get(type)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

