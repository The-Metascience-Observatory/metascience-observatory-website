import { jStat } from "jstat";
import { pValueFromR } from "@/lib/replicationOutcome";

/**
 * z-curve (Bartoš & Schimmack, 2020) — selection-model estimator of the
 * Expected Replication Rate (ERR) and Expected Discovery Rate (EDR).
 *
 * The published literature is selected for significance (winner's curse), so the
 * observed effect of any single study is upward-biased. z-curve does NOT power
 * off those inflated effects. Instead it fits a mixture of (folded) normals to
 * the distribution of *significant* z-scores, modelling the selection at the
 * significance threshold, and integrates over the implied population of true
 * power. That model-based mean power is the correction.
 *
 * Fixed-component EM (means 0..6, SD 1); only mixture weights are estimated.
 */

const SQRT_2PI = Math.sqrt(2 * Math.PI);

// Standard normal pdf / cdf.
function phi(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}
function Phi(x: number): number {
  return jStat.normal.cdf(x, 0, 1);
}

/**
 * Convert a correlation r and sample size n to an absolute z-score via the
 * two-tailed p-value of the test (z = Φ⁻¹(1 − p/2)). Returns null when the
 * inputs cannot yield a finite z. Large/degenerate z's are clamped to maxZ.
 */
export function absZFromR(r: number | null, n: number | null, maxZ = 6): number | null {
  if (r == null || n == null) return null;
  const p = pValueFromR(r, n);
  if (p == null) return null;
  // p === 0 (perfect correlation) ⇒ z at the clamp.
  if (p <= 0) return maxZ;
  if (p >= 1) return 0;
  const z = jStat.normal.inv(1 - p / 2, 0, 1);
  if (!Number.isFinite(z)) return maxZ;
  return Math.min(Math.abs(z), maxZ);
}

export type ZCurveOptions = {
  zCrit?: number;
  means?: number[];
  maxZ?: number;
  maxIter?: number;
  tol?: number;
  bootstrap?: number;
};

export type ZCurveResult = {
  err: number;
  edr: number;
  errCI: [number, number];
  edrCI: [number, number];
  soricFDR: number;
  weights: number[];
  means: number[];
  powers: number[];
  nSignificant: number;
  /** Significant z-values actually used in the fit (clamped to maxZ). */
  zValues: number[];
  /** Fitted mixture density of the *selected* (significant) z's, evaluated at z. */
  density: (z: number) => number;
};

// Probability a study at noncentrality μ produces |Z| ≥ zCrit (its power).
function componentPower(mu: number, zCrit: number): number {
  return (1 - Phi(zCrit - mu)) + Phi(-zCrit - mu);
}

// Selected (truncated to z ≥ zCrit) folded-normal density for one component.
function componentDensity(z: number, mu: number, power: number): number {
  if (power <= 0) return 0;
  return (phi(z - mu) + phi(z + mu)) / power;
}

// One EM fit over the mixture weights for a fixed set of significant z's.
function emWeights(
  zs: number[],
  means: number[],
  powers: number[],
  maxIter: number,
  tol: number
): number[] {
  const K = means.length;
  let w = new Array(K).fill(1 / K);
  // Precompute per-point, per-component selected densities (they don't change).
  const dens: number[][] = zs.map((z) => means.map((mu, k) => componentDensity(z, mu, powers[k])));

  for (let iter = 0; iter < maxIter; iter++) {
    const next = new Array(K).fill(0);
    for (let i = 0; i < zs.length; i++) {
      const di = dens[i];
      let denom = 0;
      for (let k = 0; k < K; k++) denom += w[k] * di[k];
      if (denom <= 0) continue;
      for (let k = 0; k < K; k++) next[k] += (w[k] * di[k]) / denom;
    }
    const n = zs.length || 1;
    let delta = 0;
    for (let k = 0; k < K; k++) {
      next[k] /= n;
      delta += Math.abs(next[k] - w[k]);
    }
    w = next;
    if (delta < tol) break;
  }
  return w;
}

function errFromWeights(w: number[], powers: number[]): number {
  let err = 0;
  for (let k = 0; k < w.length; k++) err += w[k] * powers[k];
  return err;
}

function edrFromWeights(w: number[], powers: number[]): number {
  let s = 0;
  for (let k = 0; k < w.length; k++) s += powers[k] > 0 ? w[k] / powers[k] : 0;
  return s > 0 ? 1 / s : 0;
}

/** Soric (1989) upper bound on the false discovery rate given EDR. */
export function soricFDR(edr: number, alpha = 0.05): number {
  if (edr <= 0) return 1;
  const bound = (alpha / (1 - alpha)) * ((1 - edr) / edr);
  return Math.max(0, Math.min(1, bound));
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Fit z-curve to a set of z-scores. Non-significant z's (|z| < zCrit) are
 * dropped (the selection threshold); remaining z's are clamped to maxZ.
 */
export function fitZCurve(zValues: number[], opts: ZCurveOptions = {}): ZCurveResult {
  const zCrit = opts.zCrit ?? 1.96;
  const means = opts.means ?? [0, 1, 2, 3, 4, 5, 6];
  const maxZ = opts.maxZ ?? 6;
  const maxIter = opts.maxIter ?? 300;
  const tol = opts.tol ?? 1e-7;
  const B = opts.bootstrap ?? 500;

  const powers = means.map((mu) => componentPower(mu, zCrit));
  const zs = zValues
    .filter((z) => Number.isFinite(z) && z >= zCrit)
    .map((z) => Math.min(z, maxZ));

  const w = emWeights(zs, means, powers, maxIter, tol);
  const err = errFromWeights(w, powers);
  const edr = edrFromWeights(w, powers);

  // Bootstrap CIs (resample z's with replacement, refit). Deterministic LCG so
  // results are stable across renders without relying on Math.random.
  const errBoot: number[] = [];
  const edrBoot: number[] = [];
  if (B > 0 && zs.length > 1) {
    let seed = 0x9e3779b9 ^ zs.length;
    const rand = () => {
      // xorshift32
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 1_000_000) / 1_000_000;
    };
    const n = zs.length;
    for (let b = 0; b < B; b++) {
      const sample = new Array(n);
      for (let i = 0; i < n; i++) sample[i] = zs[Math.floor(rand() * n)];
      const wb = emWeights(sample, means, powers, maxIter, tol);
      errBoot.push(errFromWeights(wb, powers));
      edrBoot.push(edrFromWeights(wb, powers));
    }
    errBoot.sort((a, b) => a - b);
    edrBoot.sort((a, b) => a - b);
  }

  const errCI: [number, number] = errBoot.length
    ? [percentile(errBoot, 0.025), percentile(errBoot, 0.975)]
    : [err, err];
  const edrCI: [number, number] = edrBoot.length
    ? [percentile(edrBoot, 0.025), percentile(edrBoot, 0.975)]
    : [edr, edr];

  const density = (z: number) => {
    if (z < zCrit) return 0;
    let d = 0;
    for (let k = 0; k < means.length; k++) d += w[k] * componentDensity(z, means[k], powers[k]);
    return d;
  };

  // Two-sided alpha implied by the significance threshold (0.05 at zCrit=1.96).
  const alpha = 2 * (1 - Phi(zCrit));

  return {
    err,
    edr,
    errCI,
    edrCI,
    soricFDR: soricFDR(edr, alpha),
    weights: w,
    means,
    powers,
    nSignificant: zs.length,
    zValues: zs,
    density,
  };
}
