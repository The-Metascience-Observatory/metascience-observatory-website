import { jStat } from "jstat";
import { pValueFromR } from "@/lib/replicationOutcome";

/**
 * z-curve 2.0 (Bartoš & Schimmack, 2022, Meta-Psychology) — selection-model
 * estimator of the Expected Replication Rate (ERR) and Expected Discovery
 * Rate (EDR).
 *
 * The published literature is selected for significance (winner's curse), so the
 * observed effect of any single study is upward-biased. z-curve does NOT power
 * off those inflated effects. Instead it fits a mixture of (folded) normals to
 * the distribution of *significant* z-scores, modelling the selection at the
 * significance threshold, and integrates over the implied population of true
 * power. That model-based mean power is the correction.
 *
 * Protocol details follow the paper:
 * - Fixed-component EM (means 0..6, SD 1); only mixture weights are estimated.
 * - ERR uses SAME-DIRECTION power ε₁ = 1 − Φ(zCrit − μ) (Eq. 4/8): a replication
 *   only counts if it is significant in the original's direction. EDR uses the
 *   two-sided power ε₂ (Eq. 3/8).
 * - z's above maxZ (= 6) are censored, not fitted: they are assigned power 1 and
 *   folded into ERR/EDR by their share of the significant set.
 * - CIs are "robust": percentile bootstrap widened by ±3 pts (ERR) / ±5 pts
 *   (EDR), the paper's coverage-correcting default (also the zcurve R default).
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
 * inputs cannot yield a z at all, and Infinity when p underflows (perfect or
 * near-perfect correlation) — fitZCurve censors such extremes at power 1
 * rather than fitting them, so no clamping happens here.
 */
export function absZFromR(r: number | null, n: number | null): number | null {
  if (r == null || n == null) return null;
  const p = pValueFromR(r, n);
  if (p == null) return null;
  if (p <= 0) return Infinity;
  if (p >= 1) return 0;
  const z = jStat.normal.inv(1 - p / 2, 0, 1);
  if (!Number.isFinite(z)) return Infinity;
  return Math.abs(z);
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
  /** All significant z's used: fitted (zValues) plus censored extremes. */
  nSignificant: number;
  /** Count of z's above maxZ, censored at power 1 rather than fitted. */
  nExtreme: number;
  /** Significant z-values in the fitted range [zCrit, maxZ]. */
  zValues: number[];
  /** Fitted mixture density of the *selected* (significant) z's, evaluated at z. */
  density: (z: number) => number;
  /**
   * The same fitted mixture WITHOUT the selection truncation — the expected
   * distribution of all z's if there were no selection for significance. On the
   * same scale as `density` (they coincide for z ≥ zCrit); below zCrit it shows
   * the expected mass of non-significant results missing from the record.
   */
  densityUnselected: (z: number) => number;
};

// ε₂ (Eq. 3): probability a study at noncentrality μ produces |Z| ≥ zCrit in
// either direction — its two-sided power. Governs selection and the EDR.
function componentPower(mu: number, zCrit: number): number {
  return (1 - Phi(zCrit - mu)) + Phi(-zCrit - mu);
}

// ε₁ (Eq. 4): probability of significance in the SAME direction as the
// original. This is the power that defines replication success, so it is what
// the ERR averages; it omits ε₂'s wrong-sign tail Φ(−zCrit − μ).
function componentPowerOneSided(mu: number, zCrit: number): number {
  return 1 - Phi(zCrit - mu);
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

// ERR (Eq. 8 in selected-weight form): mean same-direction power ε₁ over the
// significant studies, with the censored extremes (z > maxZ) contributing
// power 1 at their share extFrac of the significant set.
function errFromWeights(w: number[], powers1: number[], extFrac: number): number {
  let err = 0;
  for (let k = 0; k < w.length; k++) err += w[k] * powers1[k];
  return (1 - extFrac) * err + extFrac;
}

// EDR (Eq. 8): the fitted weights are weights among *selected* studies, so the
// population weights are recovered by dividing by ε₂ — hence the harmonic
// form. Extremes have ε₂ ≈ 1 and enter the sum as extFrac / 1.
function edrFromWeights(w: number[], powers: number[], extFrac: number): number {
  let s = 0;
  for (let k = 0; k < w.length; k++) s += powers[k] > 0 ? w[k] / powers[k] : 0;
  const denom = (1 - extFrac) * s + extFrac;
  return denom > 0 ? 1 / denom : 0;
}

/** One study for the N-adjusted ERR: its significant original |z| and the
 * replication-to-original sample-size ratio (null ⇒ assume an exact re-run). */
export type NAdjustedStudy = { z: number; nRatio: number | null };

export type NAdjustedResult = {
  /** Mean predicted same-direction success probability at the replications' actual N. */
  err: number;
  errCI: [number, number];
  /** Studies entering the average (significant originals). */
  n: number;
  /** How many of them had a usable sample-size ratio (the rest use ratio 1). */
  nWithRatio: number;
};

// Predicted same-direction significance probability for one study: posterior
// over the mixture components given its z (the EM responsibilities), with each
// component's noncentrality rescaled by sqrt(nRatio) — μ = δ√N, so a
// replication at a different N shifts μ by exactly that factor. Extremes
// (z > maxZ) skip the mixture: selection is negligible out there, so the
// observed z is used as μ̂ directly.
function predictedPower(
  z: number,
  s: number, // sqrt(nRatio)
  w: number[],
  means: number[],
  powers: number[],
  zCrit: number,
  maxZ: number
): number {
  if (z > maxZ) {
    return Number.isFinite(z) ? componentPowerOneSided(z * s, zCrit) : 1;
  }
  let denom = 0;
  let acc = 0;
  for (let k = 0; k < means.length; k++) {
    const resp = w[k] * componentDensity(z, means[k], powers[k]);
    denom += resp;
    acc += resp * componentPowerOneSided(means[k] * s, zCrit);
  }
  return denom > 0 ? acc / denom : 0;
}

/**
 * ERR at the replications' ACTUAL sample sizes. The plain ERR is the success
 * rate of exact same-N re-runs — the only thing identifiable from the z's
 * alone. Given each study's replication/original N ratio we can do better:
 * infer the posterior over true noncentralities from the fitted mixture,
 * rescale by sqrt(nRatio), and average the implied same-direction power.
 * Still assumes the replication probes the SAME true effect — a shortfall of
 * the observed rate below this number is effect decline, not low power.
 *
 * Refits the mixture internally so the bootstrap can jointly resample
 * (z, ratio) pairs; CI uses the same robust ±3 pt pad as the ERR.
 */
export function errAtReplicationN(
  studies: NAdjustedStudy[],
  opts: ZCurveOptions = {}
): NAdjustedResult {
  const zCrit = opts.zCrit ?? 1.96;
  const means = opts.means ?? [0, 1, 2, 3, 4, 5, 6];
  const maxZ = opts.maxZ ?? 6;
  const maxIter = opts.maxIter ?? 300;
  const tol = opts.tol ?? 1e-7;
  const B = opts.bootstrap ?? 500;

  const powers = means.map((mu) => componentPower(mu, zCrit));
  const sig = studies.filter((st) => !Number.isNaN(st.z) && st.z >= zCrit);
  const nWithRatio = sig.filter((st) => st.nRatio != null && st.nRatio > 0).length;

  const meanPredicted = (sample: NAdjustedStudy[]): number => {
    const zs = sample.filter((st) => st.z <= maxZ).map((st) => st.z);
    const w = emWeights(zs, means, powers, maxIter, tol);
    let acc = 0;
    for (const st of sample) {
      const s = st.nRatio != null && st.nRatio > 0 ? Math.sqrt(st.nRatio) : 1;
      acc += predictedPower(st.z, s, w, means, powers, zCrit, maxZ);
    }
    return sample.length > 0 ? acc / sample.length : 0;
  };

  const err = meanPredicted(sig);

  const boot: number[] = [];
  if (B > 0 && sig.length > 1) {
    let seed = 0x2545f491 ^ sig.length;
    const rand = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 1_000_000) / 1_000_000;
    };
    const n = sig.length;
    for (let b = 0; b < B; b++) {
      const sample: NAdjustedStudy[] = new Array(n);
      for (let i = 0; i < n; i++) sample[i] = sig[Math.floor(rand() * n)];
      boot.push(meanPredicted(sample));
    }
    boot.sort((a, b) => a - b);
  }

  const PAD = 0.03;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const errCI: [number, number] = boot.length
    ? [clamp01(percentile(boot, 0.025) - PAD), clamp01(percentile(boot, 0.975) + PAD)]
    : [err, err];

  return { err, errCI, n: sig.length, nWithRatio };
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
 * dropped (the selection threshold). z's above maxZ (including Infinity from
 * underflowed p's) are censored per the paper — assigned power 1 and combined
 * with the mixture by their share of the significant set — instead of being
 * fitted, since every component already has power ≈ 1 out there and a clamp
 * would put a spurious point-mass at maxZ.
 */
export function fitZCurve(zValues: number[], opts: ZCurveOptions = {}): ZCurveResult {
  const zCrit = opts.zCrit ?? 1.96;
  const means = opts.means ?? [0, 1, 2, 3, 4, 5, 6];
  const maxZ = opts.maxZ ?? 6;
  const maxIter = opts.maxIter ?? 300;
  const tol = opts.tol ?? 1e-7;
  const B = opts.bootstrap ?? 500;

  const powers = means.map((mu) => componentPower(mu, zCrit));
  const powers1 = means.map((mu) => componentPowerOneSided(mu, zCrit));
  const zsAll = zValues.filter((z) => !Number.isNaN(z) && z >= zCrit);
  const zs = zsAll.filter((z) => z <= maxZ);
  const nExtreme = zsAll.length - zs.length;
  const nSig = zsAll.length;
  const extFrac = nSig > 0 ? nExtreme / nSig : 0;

  const w = emWeights(zs, means, powers, maxIter, tol);
  const err = errFromWeights(w, powers1, extFrac);
  const edr = edrFromWeights(w, powers, extFrac);

  // Bootstrap CIs (resample the full significant set with replacement — so the
  // extreme share varies across draws too — and refit). Deterministic xorshift
  // so results are stable across renders without relying on Math.random.
  const errBoot: number[] = [];
  const edrBoot: number[] = [];
  if (B > 0 && nSig > 1) {
    let seed = 0x9e3779b9 ^ nSig;
    const rand = () => {
      // xorshift32
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 1_000_000) / 1_000_000;
    };
    for (let b = 0; b < B; b++) {
      const sample: number[] = [];
      let ext = 0;
      for (let i = 0; i < nSig; i++) {
        const z = zsAll[Math.floor(rand() * nSig)];
        if (z > maxZ) ext++;
        else sample.push(z);
      }
      const wb = emWeights(sample, means, powers, maxIter, tol);
      const ef = ext / nSig;
      errBoot.push(errFromWeights(wb, powers1, ef));
      edrBoot.push(edrFromWeights(wb, powers, ef));
    }
    errBoot.sort((a, b) => a - b);
    edrBoot.sort((a, b) => a - b);
  }

  // Robust CIs (paper's default): widen the percentile bootstrap interval by a
  // fixed 3 pts (ERR) / 5 pts (EDR) on each side to fix undercoverage.
  const ERR_CI_PAD = 0.03;
  const EDR_CI_PAD = 0.05;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const errCI: [number, number] = errBoot.length
    ? [clamp01(percentile(errBoot, 0.025) - ERR_CI_PAD), clamp01(percentile(errBoot, 0.975) + ERR_CI_PAD)]
    : [err, err];
  const edrCI: [number, number] = edrBoot.length
    ? [clamp01(percentile(edrBoot, 0.025) - EDR_CI_PAD), clamp01(percentile(edrBoot, 0.975) + EDR_CI_PAD)]
    : [edr, edr];

  const densityUnselected = (z: number) => {
    let d = 0;
    for (let k = 0; k < means.length; k++) d += w[k] * componentDensity(z, means[k], powers[k]);
    return d;
  };

  const density = (z: number) => (z < zCrit ? 0 : densityUnselected(z));

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
    nSignificant: nSig,
    nExtreme,
    zValues: zs,
    density,
    densityUnselected,
  };
}
