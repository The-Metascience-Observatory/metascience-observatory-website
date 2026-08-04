import { jStat } from "jstat";

/**
 * Correlation helpers shared by the replications-database pages.
 *
 * Kept out of the page components so the arithmetic can be checked against an
 * independent oracle (see scripts/check_probit.py for the same pattern) rather
 * than only by eye on a chart.
 */

export type CorrEstimate = {
  /** The correlation coefficient. */
  r: number;
  /** Pairs the estimate rests on. */
  n: number;
  /** Fisher-z 95% confidence interval. */
  ciLow: number;
  ciHigh: number;
  /** Two-sided p-value for H0: rho = 0. */
  p: number;
};

/**
 * Pearson product-moment correlation.
 *
 * When one input is a 0/1 indicator this is exactly the point-biserial
 * correlation — no separate function is needed.
 */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

/** Fractional ranks, ties averaged (the "midrank" convention Spearman assumes). */
export function rank(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++;
    // Ranks are 1-based; every tied member takes the mean of the block.
    const mid = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) out[order[k].i] = mid;
    i = j + 1;
  }
  return out;
}

/**
 * Spearman rank correlation, computed as Pearson on midranks so that ties are
 * handled correctly (the 6*sum(d^2) shortcut is wrong whenever ties exist, and
 * a 0/1 outcome column is nothing but ties).
 */
export function spearman(xs: number[], ys: number[]): number {
  return pearson(rank(xs), rank(ys));
}

/**
 * Fisher z-transform 95% CI and two-sided p-value for a correlation.
 *
 * The normal approximation is used for both; with the sample sizes on these
 * pages (hundreds of pairs) it is indistinguishable from the exact t-test, and
 * it applies unchanged to Spearman's rho.
 */
export function inference(r: number, n: number): CorrEstimate {
  if (!Number.isFinite(r) || n < 4) {
    return { r, n, ciLow: NaN, ciHigh: NaN, p: NaN };
  }
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const lo = Math.tanh(z - 1.96 * se);
  const hi = Math.tanh(z + 1.96 * se);
  // Two-sided p from the t-distribution on n-2 df (exact for Pearson).
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
  const p = 2 * (1 - jStat.studentt.cdf(t, n - 2));
  return { r, n, ciLow: lo, ciHigh: hi, p };
}

/** Convenience: correlate and attach the CI/p in one call. */
export function correlate(
  xs: number[],
  ys: number[],
  method: "pearson" | "spearman" = "pearson",
): CorrEstimate {
  const r = method === "spearman" ? spearman(xs, ys) : pearson(xs, ys);
  return inference(r, Math.min(xs.length, ys.length));
}

// Seeded PRNG — the same convention the dashboard bootstraps use, so the
// intervals are deterministic at build time.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cluster-bootstrap 95% percentile CI for a correlation: resample clusters
 * (papers) with replacement and recompute the coefficient each draw.
 *
 * `inference()`'s Fisher-z interval assumes independent pairs; replication
 * rows cluster by original paper (multi-lab projects contribute up to eight
 * rows per paper, and most predictors are constant within paper), so the
 * independence CI would be anticonservative. Resampling whole papers
 * propagates that clustering — the same reasoning as bootstrapBinCIs in the
 * by-* dashboards.
 */
export function clusterBootstrapCorrCI(
  xs: number[],
  ys: number[],
  clusters: (number | string)[],
  method: "pearson" | "spearman" = "pearson",
  opts?: { iters?: number; seed?: number },
): { lo: number; hi: number; nClusters: number } {
  const n = Math.min(xs.length, ys.length, clusters.length);
  const byCluster = new Map<number | string, number[]>();
  for (let i = 0; i < n; i++) {
    const arr = byCluster.get(clusters[i]);
    if (arr) arr.push(i);
    else byCluster.set(clusters[i], [i]);
  }
  const groups = Array.from(byCluster.values());
  const nClusters = groups.length;
  if (nClusters < 2) return { lo: NaN, hi: NaN, nClusters };

  const iters = opts?.iters ?? 1000;
  const rand = mulberry32((opts?.seed ?? 0x9e3779b9) ^ n);
  const corr = method === "spearman" ? spearman : pearson;
  const draws: number[] = [];
  const bx: number[] = [];
  const by: number[] = [];
  for (let b = 0; b < iters; b++) {
    bx.length = 0;
    by.length = 0;
    for (let g = 0; g < nClusters; g++) {
      const pick = groups[(rand() * nClusters) | 0];
      for (const i of pick) {
        bx.push(xs[i]);
        by.push(ys[i]);
      }
    }
    const r = corr(bx, by);
    if (Number.isFinite(r)) draws.push(r);
  }
  if (draws.length === 0) return { lo: NaN, hi: NaN, nClusters };
  draws.sort((a, b) => a - b);
  return {
    lo: draws[Math.floor(0.025 * (draws.length - 1))],
    hi: draws[Math.ceil(0.975 * (draws.length - 1))],
    nClusters,
  };
}
