import { clusterBootstrapCorrCI, pearson, spearman } from "@/lib/correlation";
import { fitFractionalLogit, standardize, type LogitFit } from "@/lib/logit";
import type { AssembledRow } from "./data";

/**
 * All statistics shown on the correlates-of-reproducibility page, computed at
 * build time from the assembled rows. Shared with scripts/check_logit_lib.ts;
 * independently re-derived in Python by scripts/check_logit.py.
 */

export type PredictorKey =
  | "exactP"
  | "year"
  | "impactFactor"
  | "sjrPct"
  | "citations"
  | "hFirst"
  | "hLast"
  | "hMean"
  | "hMax"
  | "overlap";

interface PredictorSpec {
  key: PredictorKey;
  label: string;
  /** Transform applied before the Pearson correlation (Spearman uses raw x). */
  transform: (v: number) => number;
  transformLabel: string;
  /** Source by-* page for the table's row link. */
  href: string;
}

const log10 = Math.log10;

/**
 * Exact p-values run down to 5e-324 (double underflow — the by-p-value page
 * documents the same problem), so raw log₁₀(p) has −323 outliers that dominate
 * any linear fit. Floor log₁₀(p) at −10 for the Pearson correlation and the
 * model; Spearman is rank-based and uses the raw values.
 */
export const LOG10P_FLOOR = -10;
const log10pWinsorized = (v: number) => Math.max(LOG10P_FLOOR, log10(v));

export const PREDICTORS: PredictorSpec[] = [
  {
    key: "exactP",
    label: "Original p-value",
    transform: log10pWinsorized,
    transformLabel: "log₁₀ p (floored at −10)",
    href: "/replications-database/by-p-value",
  },
  {
    key: "year",
    label: "Original publication year",
    transform: (v) => v,
    transformLabel: "raw",
    href: "/replications-database/by-year",
  },
  {
    key: "impactFactor",
    label: "Journal impact factor",
    transform: (v) => log10(v),
    transformLabel: "log₁₀ IF",
    href: "/replications-database/by-impact-factor",
  },
  {
    key: "sjrPct",
    label: "Journal rank (SJR percentile)",
    transform: (v) => v,
    transformLabel: "raw",
    href: "/replications-database/by-journal-rank",
  },
  {
    key: "citations",
    label: "Citation count (first 2 years)",
    transform: (v) => log10(1 + v),
    transformLabel: "log₁₀(1+c)",
    href: "/replications-database/by-citation-count",
  },
  {
    key: "hFirst",
    label: "First-author h-index",
    transform: (v) => log10(1 + v),
    transformLabel: "log₁₀(1+h)",
    href: "/replications-database/by-h-index",
  },
  {
    key: "hLast",
    label: "Last-author h-index",
    transform: (v) => log10(1 + v),
    transformLabel: "log₁₀(1+h)",
    href: "/replications-database/by-h-index",
  },
  {
    key: "hMean",
    label: "Mean author h-index",
    transform: (v) => log10(1 + v),
    transformLabel: "log₁₀(1+h)",
    href: "/replications-database/by-h-index",
  },
  {
    key: "hMax",
    label: "Max author h-index",
    transform: (v) => log10(1 + v),
    transformLabel: "log₁₀(1+h)",
    href: "/replications-database/by-h-index",
  },
  {
    key: "overlap",
    label: "Author overlap (shared authors)",
    transform: (v) => v,
    transformLabel: "raw",
    href: "/replications-database/by-author-overlap",
  },
];

export interface CorrTableRow {
  key: PredictorKey;
  label: string;
  transformLabel: string;
  href: string;
  n: number;
  nClusters: number;
  pearsonR: number;
  pearsonLo: number;
  pearsonHi: number;
  spearmanR: number;
  spearmanLo: number;
  spearmanHi: number;
}

export function buildCorrelationTable(rows: AssembledRow[]): CorrTableRow[] {
  return PREDICTORS.map((spec) => {
    const xsRaw: number[] = [];
    const xsT: number[] = [];
    const ys: number[] = [];
    const clusters: string[] = [];
    for (const row of rows) {
      const v = row[spec.key];
      if (v === null) continue;
      xsRaw.push(v);
      xsT.push(spec.transform(v));
      ys.push(row.y);
      clusters.push(row.cluster);
    }
    const pr = pearson(xsT, ys);
    const sr = spearman(xsRaw, ys);
    const pCI = clusterBootstrapCorrCI(xsT, ys, clusters, "pearson");
    const sCI = clusterBootstrapCorrCI(xsRaw, ys, clusters, "spearman");
    return {
      key: spec.key,
      label: spec.label,
      transformLabel: spec.transformLabel,
      href: spec.href,
      n: ys.length,
      nClusters: pCI.nClusters,
      pearsonR: pr,
      pearsonLo: pCI.lo,
      pearsonHi: pCI.hi,
      spearmanR: sr,
      spearmanLo: sCI.lo,
      spearmanHi: sCI.hi,
    };
  });
}

/** Model covariates in display order; hMean represents the collinear h-index family. */
export const MODEL_COVARIATES: { key: PredictorKey; name: string }[] = [
  { key: "year", name: "Publication year" },
  { key: "impactFactor", name: "log₁₀ impact factor" },
  { key: "sjrPct", name: "SJR percentile" },
  { key: "citations", name: "log₁₀(1+cit. first 2 yrs)" },
  { key: "hMean", name: "log₁₀(1+mean author h)" },
  { key: "overlap", name: "Shared authors" },
];

const MODEL_TRANSFORM: Partial<Record<PredictorKey, (v: number) => number>> = {
  impactFactor: (v) => log10(v),
  citations: (v) => log10(1 + v),
  hMean: (v) => log10(1 + v),
  exactP: log10pWinsorized,
};

export interface ModelScale {
  name: string;
  key: PredictorKey;
  mean: number;
  sd: number;
}

export interface ModelResult {
  fit: LogitFit | null;
  scales: ModelScale[];
  nObs: number;
  nClusters: number;
}

/**
 * Complete-case fractional logit. Covariates are transformed then z-scored on
 * the model's own estimation sample, so β and AME read "per +1 SD of this
 * sample" — the SD glossary on the page translates that back to natural units.
 */
export function fitModel(rows: AssembledRow[], withP: boolean): ModelResult {
  const covs = withP
    ? [...MODEL_COVARIATES, { key: "exactP" as PredictorKey, name: "log₁₀ p-value" }]
    : MODEL_COVARIATES;

  const complete = rows.filter((r) => covs.every((c) => r[c.key] !== null));
  const y = complete.map((r) => r.y);
  const clusters = complete.map((r) => r.cluster);

  const columns = covs.map((c) => {
    const t = MODEL_TRANSFORM[c.key] ?? ((v: number) => v);
    return standardize(complete.map((r) => t(r[c.key] as number)));
  });
  const scales: ModelScale[] = covs.map((c, j) => ({
    name: c.name,
    key: c.key,
    mean: columns[j].mean,
    sd: columns[j].sd,
  }));

  const X = complete.map((_, i) => columns.map((col) => col.zs[i]));
  const fit = fitFractionalLogit(
    X,
    y,
    clusters,
    covs.map((c) => c.name),
  );

  return { fit, scales, nObs: complete.length, nClusters: new Set(clusters).size };
}
