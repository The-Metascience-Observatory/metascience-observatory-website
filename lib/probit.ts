import { jStat } from "jstat";

/**
 * Binary probit regression with one covariate, fit by maximum likelihood, with
 * cluster-robust standard errors and delta-method confidence bands on the
 * predicted probability.
 *
 * This is the JS analogue of Stata's
 *
 *     probit y x, vce(cluster g)
 *     margins, at(x = (...)) ; marginsplot
 *
 * Replication data are clustered: one original paper can be replicated several
 * times, and those attempts are not independent. The sandwich covariance below
 * clusters on the paper so the reported SEs and the band widen accordingly,
 * matching the paper-cluster bootstrap used for the binned rates elsewhere.
 */

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const Z_975 = 1.959963984540054;

// Standard normal pdf, and a cdf clamped away from 0/1 so that μ(1−μ) in the
// IRLS weights can never underflow to zero for extreme linear predictors.
function phi(z: number): number {
  return Math.exp(-0.5 * z * z) / SQRT_2PI;
}
function Phi(z: number): number {
  return Math.min(1 - 1e-12, Math.max(1e-12, jStat.normal.cdf(z, 0, 1)));
}

export interface ProbitFit {
  /** [intercept, slope] on the covariate as supplied. */
  beta: [number, number];
  /** Cluster-robust covariance of beta, [[V00, V01], [V01, V11]]. */
  vcov: [[number, number], [number, number]];
  /** Cluster-robust inference on the slope. */
  se1: number;
  z1: number;
  p1: number;
  /** Average marginal effect: mean over the sample of φ(η)·β₁, in probability per unit of x. */
  ame: number;
  nObs: number;
  nClusters: number;
  iterations: number;
}

/** One point of a marginsplot-style predicted-probability curve. */
export interface ProbitBandPoint {
  p: number;
  lo: number;
  hi: number;
}

const MIN_OBS = 30;
const MAX_ITER = 50;
const TOL = 1e-8;

/**
 * Fit P(y = 1 | x) = Φ(β₀ + β₁x) by Fisher-scoring IRLS, with a covariance
 * clustered on `cluster` (parallel array of group ids; ids need not be dense).
 *
 * Returns null rather than a suspect fit when the sample is too small, has no
 * outcome or covariate variation, shows signs of (quasi-)separation, or the
 * iteration fails to converge. Callers should render a fallback in that case.
 */
export function fitProbit(x: number[], y: boolean[], cluster: number[]): ProbitFit | null {
  const n = x.length;
  if (n < MIN_OBS || y.length !== n || cluster.length !== n) return null;

  let nSuccess = 0;
  let sx = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(x[i])) return null;
    if (y[i]) nSuccess++;
    sx += x[i];
  }
  // No outcome variation ⇒ perfect separation on the intercept alone.
  if (nSuccess === 0 || nSuccess === n) return null;
  const mx = sx / n;
  let ssx = 0;
  for (let i = 0; i < n; i++) ssx += (x[i] - mx) * (x[i] - mx);
  if (ssx <= 0) return null; // constant covariate

  // Start from the intercept-only MLE: Φ(β₀) = ȳ, β₁ = 0.
  let b0 = jStat.normal.inv(nSuccess / n, 0, 1);
  let b1 = 0;
  if (!Number.isFinite(b0)) return null;

  const eta = new Float64Array(n);
  const mu = new Float64Array(n);
  const dens = new Float64Array(n);
  let iterations = 0;
  let converged = false;

  for (let it = 0; it < MAX_ITER; it++) {
    iterations = it + 1;
    // Weighted normal equations for the working response, accumulated as five
    // scalars so the 2x2 system can be solved in closed form.
    let Sw = 0, Swx = 0, Swxx = 0, Swz = 0, Swxz = 0;
    for (let i = 0; i < n; i++) {
      const e = b0 + b1 * x[i];
      eta[i] = e;
      const m = Phi(e);
      mu[i] = m;
      const f = Math.max(phi(e), 1e-10);
      dens[i] = f;
      const w = (f * f) / (m * (1 - m));
      const z = e + ((y[i] ? 1 : 0) - m) / f;
      Sw += w;
      Swx += w * x[i];
      Swxx += w * x[i] * x[i];
      Swz += w * z;
      Swxz += w * x[i] * z;
    }
    const det = Sw * Swxx - Swx * Swx;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
    const nb0 = (Swxx * Swz - Swx * Swxz) / det;
    const nb1 = (Sw * Swxz - Swx * Swz) / det;
    if (!Number.isFinite(nb0) || !Number.isFinite(nb1)) return null;
    const step = Math.max(Math.abs(nb0 - b0), Math.abs(nb1 - b1));
    b0 = nb0;
    b1 = nb1;
    if (step < TOL) {
      converged = true;
      break;
    }
  }
  if (!converged) return null;

  // Refresh η, μ, φ(η) at the final β and screen for (quasi-)separation, where
  // the likelihood is flat and the reported SEs would be meaningless.
  let maxAbsEta = 0;
  let sumDens = 0;
  for (let i = 0; i < n; i++) {
    const e = b0 + b1 * x[i];
    eta[i] = e;
    maxAbsEta = Math.max(maxAbsEta, Math.abs(e));
    mu[i] = Phi(e);
    const f = Math.max(phi(e), 1e-10);
    dens[i] = f;
    sumDens += f;
  }
  if (Math.abs(b1) > 30 || maxAbsEta > 35) return null;

  // Meat: sum of outer products of the per-cluster score sums.
  // Row score sᵢ = λᵢ·(1, xᵢ) with λᵢ = (yᵢ − μᵢ)·φ(ηᵢ) / (μᵢ(1 − μᵢ)).
  // Bread: the *observed* information A = Σ λᵢ(λᵢ + ηᵢ)·xᵢxᵢᵀ (the negative
  // Hessian of the log-likelihood). Stata and statsmodels both build the
  // sandwich on the observed rather than the expected information, so using it
  // here reproduces their SEs; Fisher scoring above is only the solver.
  const g0 = new Map<number, number>();
  const g1 = new Map<number, number>();
  let Sw = 0, Swx = 0, Swxx = 0;
  for (let i = 0; i < n; i++) {
    const lam = (((y[i] ? 1 : 0) - mu[i]) * dens[i]) / (mu[i] * (1 - mu[i]));
    const c = cluster[i];
    g0.set(c, (g0.get(c) ?? 0) + lam);
    g1.set(c, (g1.get(c) ?? 0) + lam * x[i]);
    const h = lam * (lam + eta[i]);
    Sw += h;
    Swx += h * x[i];
    Swxx += h * x[i] * x[i];
  }

  const detA = Sw * Swxx - Swx * Swx;
  if (!Number.isFinite(detA) || Math.abs(detA) < 1e-12) return null;
  const Ai00 = Swxx / detA;
  const Ai01 = -Swx / detA;
  const Ai11 = Sw / detA;
  const nClusters = g0.size;
  if (nClusters < 2) return null;
  let B00 = 0, B01 = 0, B11 = 0;
  for (const [c, s0] of g0) {
    const s1 = g1.get(c) as number;
    B00 += s0 * s0;
    B01 += s0 * s1;
    B11 += s1 * s1;
  }
  // Stata's small-sample factor for ML with vce(cluster): G / (G − 1).
  const correction = nClusters / (nClusters - 1);

  // V = c · A⁻¹ B A⁻¹ (A⁻¹ and B are symmetric 2x2).
  const M00 = Ai00 * B00 + Ai01 * B01;
  const M01 = Ai00 * B01 + Ai01 * B11;
  const M10 = Ai01 * B00 + Ai11 * B01;
  const M11 = Ai01 * B01 + Ai11 * B11;
  const V00 = correction * (M00 * Ai00 + M01 * Ai01);
  const V01 = correction * (M00 * Ai01 + M01 * Ai11);
  const V11 = correction * (M10 * Ai01 + M11 * Ai11);
  if (!Number.isFinite(V00) || !Number.isFinite(V01) || !Number.isFinite(V11)) return null;
  if (V11 <= 0 || V00 <= 0) return null;

  const se1 = Math.sqrt(V11);
  const z1 = b1 / se1;
  const p1 = 2 * (1 - jStat.normal.cdf(Math.abs(z1), 0, 1));

  return {
    beta: [b0, b1],
    vcov: [
      [V00, V01],
      [V01, V11],
    ],
    se1,
    z1,
    p1,
    ame: b1 * (sumDens / n),
    nObs: n,
    nClusters,
    iterations,
  };
}

/**
 * Predicted probability with a 95% confidence band at each covariate value.
 *
 * Var(η) = V₀₀ + 2x·V₀₁ + x²·V₁₁, and the interval is built on η then pushed
 * through Φ — as Stata's `margins` does — so the band can never leave [0, 1].
 */
export function probitBand(fit: ProbitFit, xs: number[]): ProbitBandPoint[] {
  const [b0, b1] = fit.beta;
  const [[V00, V01], [, V11]] = fit.vcov;
  return xs.map((x) => {
    const eta = b0 + b1 * x;
    const varEta = Math.max(0, V00 + 2 * x * V01 + x * x * V11);
    const se = Math.sqrt(varEta);
    return {
      p: Phi(eta),
      lo: Phi(eta - Z_975 * se),
      hi: Phi(eta + Z_975 * se),
    };
  });
}
