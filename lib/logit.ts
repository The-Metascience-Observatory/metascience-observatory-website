import { jStat } from "jstat";

/**
 * Multi-covariate fractional logistic regression (Papke & Wooldridge 1996
 * quasi-MLE) with cluster-robust standard errors and average marginal effects.
 *
 * This is the JS analogue of Stata's
 *
 *     fracreg logit y x1 x2 ..., vce(cluster g)
 *     margins, dydx(*)
 *
 * The outcome may be any value in [0, 1] — here 0 / 0.5 / 1 — and the Bernoulli
 * quasi-likelihood remains a valid estimating equation as long as the sandwich
 * (never the model-based) covariance is reported. With the canonical logit link
 * the observed and expected information coincide even for fractional y, so the
 * bread is simply (XᵀWX)⁻¹ at the converged fit and the per-row score is
 * (yᵢ − μᵢ)xᵢ; there is no probit-style observed-vs-expected subtlety
 * (contrast lib/probit.ts).
 *
 * Cross-checked against a Python oracle: scripts/check_logit.py.
 */

export interface LogitTerm {
  name: string;
  /** Log-odds coefficient per unit of the covariate as supplied. */
  beta: number;
  /** Cluster-robust inference. */
  se: number;
  z: number;
  p: number;
  /** Average marginal effect: mean over the sample of βⱼ·μᵢ(1−μᵢ), probability per unit. */
  ame: number;
  /** Delta-method SE of the AME on the cluster-robust covariance. */
  ameSe: number;
}

export interface LogitFit {
  /** Coefficients, index 0 = intercept, then one per column of X. */
  beta: number[];
  /** Cluster-robust covariance of beta, (k+1)×(k+1). */
  vcov: number[][];
  /** Per-covariate summaries (intercept excluded). */
  terms: LogitTerm[];
  nObs: number;
  nClusters: number;
  iterations: number;
}

const MIN_OBS = 50;
const MAX_ITER = 100;
const TOL = 1e-10;

/**
 * Cholesky factorization A = LLᵀ of a symmetric matrix, in place on a copy.
 * Returns null when a pivot is not safely positive — which for the IRLS normal
 * equations is exactly the collinearity / degeneracy signal.
 */
function cholFactor(A: number[][]): number[][] | null {
  const p = A.length;
  let maxDiag = 0;
  for (let i = 0; i < p; i++) maxDiag = Math.max(maxDiag, Math.abs(A[i][i]));
  const tol = 1e-12 * Math.max(maxDiag, 1);
  const L: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > tol)) return null;
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

/** Solve LLᵀx = b by forward then back substitution. */
function cholSolve(L: number[][], b: number[]): number[] {
  const p = L.length;
  const x = b.slice();
  for (let i = 0; i < p; i++) {
    let s = x[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * x[k];
    x[i] = s / L[i][i];
  }
  for (let i = p - 1; i >= 0; i--) {
    let s = x[i];
    for (let k = i + 1; k < p; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/** A⁻¹ from its Cholesky factor, column by column. */
function cholInverse(L: number[][]): number[][] {
  const p = L.length;
  const inv: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let j = 0; j < p; j++) {
    const e = new Array<number>(p).fill(0);
    e[j] = 1;
    const col = cholSolve(L, e);
    for (let i = 0; i < p; i++) inv[i][j] = col[i];
  }
  return inv;
}

function quasiLogLik(y: number[], mu: Float64Array): number {
  let ll = 0;
  for (let i = 0; i < y.length; i++) {
    ll += y[i] * Math.log(mu[i]) + (1 - y[i]) * Math.log(1 - mu[i]);
  }
  return ll;
}

/**
 * Fit E[y | x] = logistic(β₀ + βᵀx) by Fisher-scoring IRLS with step-halving,
 * clustered on `cluster` (parallel array of group ids).
 *
 * `X` is n×k WITHOUT an intercept column (the lib prepends one). `y` values
 * must lie in [0, 1]. Standardize covariates before calling if standardized
 * coefficients are wanted — the lib fits whatever X it is given.
 *
 * Returns null rather than a suspect fit on small samples, degenerate columns,
 * (quasi-)separation, or non-convergence. Callers should render a fallback.
 */
export function fitFractionalLogit(
  X: number[][],
  y: number[],
  cluster: (number | string)[],
  names: string[],
): LogitFit | null {
  const n = X.length;
  if (n < MIN_OBS || y.length !== n || cluster.length !== n) return null;
  const k = X[0]?.length ?? 0;
  if (k === 0 || names.length !== k) return null;
  const p = k + 1;

  let sy = 0;
  for (let i = 0; i < n; i++) {
    if (X[i].length !== k) return null;
    if (!Number.isFinite(y[i]) || y[i] < 0 || y[i] > 1) return null;
    for (let j = 0; j < k; j++) if (!Number.isFinite(X[i][j])) return null;
    sy += y[i];
  }
  const ybar = sy / n;
  if (ybar <= 0 || ybar >= 1) return null; // no outcome variation

  // Every covariate must vary.
  for (let j = 0; j < k; j++) {
    const v0 = X[0][j];
    let varies = false;
    for (let i = 1; i < n; i++) {
      if (X[i][j] !== v0) {
        varies = true;
        break;
      }
    }
    if (!varies) return null;
  }

  // Design row with intercept.
  const xd = (i: number, j: number): number => (j === 0 ? 1 : X[i][j - 1]);

  // Start from the intercept-only fit.
  const clamp = (v: number) => Math.min(1 - 1e-6, Math.max(1e-6, v));
  let beta = new Array<number>(p).fill(0);
  beta[0] = Math.log(clamp(ybar) / (1 - clamp(ybar)));

  const eta = new Float64Array(n);
  const mu = new Float64Array(n);
  const setMu = (b: number[]) => {
    for (let i = 0; i < n; i++) {
      let e = b[0];
      for (let j = 1; j < p; j++) e += b[j] * xd(i, j);
      eta[i] = e;
      mu[i] = Math.min(1 - 1e-10, Math.max(1e-10, 1 / (1 + Math.exp(-e))));
    }
  };

  setMu(beta);
  let ll = quasiLogLik(y, mu);
  let iterations = 0;
  let converged = false;
  let Lfinal: number[][] | null = null;

  for (let it = 0; it < MAX_ITER; it++) {
    iterations = it + 1;
    // Normal equations A·Δ-target = b for the working response z = η + (y−μ)/w,
    // with w = μ(1−μ): A = XᵀWX, rhs = XᵀWz.
    const A: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const rhs = new Array<number>(p).fill(0);
    for (let i = 0; i < n; i++) {
      const w = mu[i] * (1 - mu[i]);
      const z = eta[i] + (y[i] - mu[i]) / w;
      for (let a = 0; a < p; a++) {
        const xa = xd(i, a);
        rhs[a] += w * xa * z;
        for (let b = a; b < p; b++) A[a][b] += w * xa * xd(i, b);
      }
    }
    for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) A[a][b] = A[b][a];

    const L = cholFactor(A);
    if (!L) return null;
    const next = cholSolve(L, rhs);
    if (next.some((v) => !Number.isFinite(v))) return null;

    // Step-halving: the IRLS target should not lower the quasi-loglik; if it
    // does, back off toward the current β (cheap insurance, rarely triggered).
    let candidate = next;
    let accepted = false;
    for (let h = 0; h < 10; h++) {
      setMu(candidate);
      const llNew = quasiLogLik(y, mu);
      if (llNew >= ll - 1e-12) {
        ll = llNew;
        accepted = true;
        break;
      }
      candidate = candidate.map((v, j) => (v + beta[j]) / 2);
    }
    if (!accepted) return null;

    let step = 0;
    for (let j = 0; j < p; j++) step = Math.max(step, Math.abs(candidate[j] - beta[j]));
    beta = candidate;
    Lfinal = L;
    if (step < TOL) {
      converged = true;
      break;
    }
  }
  if (!converged || !Lfinal) return null;

  // Refresh μ at the final β and screen for (quasi-)separation.
  setMu(beta);
  let maxAbsEta = 0;
  for (let i = 0; i < n; i++) maxAbsEta = Math.max(maxAbsEta, Math.abs(eta[i]));
  if (maxAbsEta > 30 || beta.some((b) => Math.abs(b) > 30)) return null;

  // Bread: (XᵀWX)⁻¹ at the final fit. Recompute A at the converged β (Lfinal is
  // from the last step's pre-update weights; the difference is within TOL but
  // recomputing keeps the algebra exactly the textbook sandwich).
  const A: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < n; i++) {
    const w = mu[i] * (1 - mu[i]);
    for (let a = 0; a < p; a++) {
      const xa = xd(i, a);
      for (let b = a; b < p; b++) A[a][b] += w * xa * xd(i, b);
    }
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) A[a][b] = A[b][a];
  const L = cholFactor(A);
  if (!L) return null;
  const bread = cholInverse(L);

  // Meat: outer products of per-cluster score sums, score sᵢ = (yᵢ − μᵢ)xᵢ.
  const scoreSums = new Map<number | string, number[]>();
  for (let i = 0; i < n; i++) {
    const resid = y[i] - mu[i];
    let s = scoreSums.get(cluster[i]);
    if (!s) {
      s = new Array<number>(p).fill(0);
      scoreSums.set(cluster[i], s);
    }
    for (let j = 0; j < p; j++) s[j] += resid * xd(i, j);
  }
  const nClusters = scoreSums.size;
  if (nClusters < 2) return null;
  const meat: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (const s of scoreSums.values()) {
    for (let a = 0; a < p; a++) for (let b = a; b < p; b++) meat[a][b] += s[a] * s[b];
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) meat[a][b] = meat[b][a];

  // V = c · A⁻¹ B A⁻¹ with Stata's ML small-sample factor G / (G − 1).
  const correction = nClusters / (nClusters - 1);
  const BM: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      let s = 0;
      for (let c = 0; c < p; c++) s += meat[a][c] * bread[c][b];
      BM[a][b] = s;
    }
  }
  const vcov: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      let s = 0;
      for (let c = 0; c < p; c++) s += bread[a][c] * BM[c][b];
      vcov[a][b] = correction * s;
    }
  }
  for (let j = 0; j < p; j++) {
    if (!Number.isFinite(vcov[j][j]) || vcov[j][j] <= 0) return null;
  }

  // AMEⱼ = βⱼ · mean(μ(1−μ)); delta-method SE on the cluster-robust vcov.
  // ∂AMEⱼ/∂βₘ = mean over i of [ 1{m=j}·wᵢ + βⱼ·wᵢ(1−2μᵢ)·x_{im} ].
  const w = new Float64Array(n);
  let meanW = 0;
  for (let i = 0; i < n; i++) {
    w[i] = mu[i] * (1 - mu[i]);
    meanW += w[i];
  }
  meanW /= n;

  const terms: LogitTerm[] = [];
  for (let j = 1; j < p; j++) {
    const b = beta[j];
    const se = Math.sqrt(vcov[j][j]);
    const z = b / se;
    const pval = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    const grad = new Array<number>(p).fill(0);
    for (let i = 0; i < n; i++) {
      const dw = w[i] * (1 - 2 * mu[i]); // ∂wᵢ/∂ηᵢ
      for (let m = 0; m < p; m++) grad[m] += b * dw * xd(i, m);
      grad[j] += w[i];
    }
    for (let m = 0; m < p; m++) grad[m] /= n;
    let varAme = 0;
    for (let a = 0; a < p; a++) for (let c = 0; c < p; c++) varAme += grad[a] * vcov[a][c] * grad[c];
    terms.push({
      name: names[j - 1],
      beta: b,
      se,
      z,
      p: pval,
      ame: b * meanW,
      ameSe: Math.sqrt(Math.max(0, varAme)),
    });
  }

  return { beta, vcov, terms, nObs: n, nClusters, iterations };
}

/**
 * z-score a column (population SD, divisor n) and return the transform so
 * callers can gloss "per +1 SD" in natural units. Shared by the page and the
 * verification scripts so all three agree on the convention.
 */
export function standardize(xs: number[]): { zs: number[]; mean: number; sd: number } {
  const n = xs.length;
  let mean = 0;
  for (const v of xs) mean += v;
  mean /= n;
  let ss = 0;
  for (const v of xs) ss += (v - mean) * (v - mean);
  const sd = Math.sqrt(ss / n);
  return { zs: xs.map((v) => (sd > 0 ? (v - mean) / sd : 0)), mean, sd };
}
