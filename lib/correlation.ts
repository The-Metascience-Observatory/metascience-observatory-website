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
