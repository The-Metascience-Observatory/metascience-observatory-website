import { jStat } from "jstat";

/**
 * Random-intercept binomial regression (a binomial GLMM), fitted by maximum
 * likelihood with adaptive Gauss–Hermite quadrature:
 *
 *     events_ij ~ Binomial(n_ij, g⁻¹(β₀ + β₁·x_ij + u_j)),   u_j ~ N(0, τ²)
 *
 * with j = paper and g the logit or probit link. This is the random-effects
 * model for proportions (lme4's `glmer(cbind(e, n − e) ~ x + (1 | paper))`,
 * metafor's `rma.glmm`): each study gets its own baseline rate, so a single
 * large study can no longer drag the curve to its own level, and the exact
 * binomial likelihood handles 0-event arms without continuity corrections.
 *
 * The returned curve is the conditional ("typical study", u = 0) curve.
 * Standard errors come from the inverse observed information (numerical
 * Hessian of the marginal log-likelihood over β₀, β₁, log τ).
 *
 * Cross-checked against an independent dense-grid / scipy implementation in
 * scripts/check_lithium_dose_response.py.
 */

export type GlmmLink = "logit" | "probit";

export interface GlmmRow {
  x: number;
  events: number;
  n: number;
  cluster: number;
}

export interface GlmmFit {
  beta: [number, number];
  /** Covariance of (β₀, β₁) from the inverse observed information. */
  vcov: [[number, number], [number, number]];
  tau: number;
  se1: number;
  p1: number;
  logLik: number;
}

const N_NODES = 20;
const LOG_TAU_MIN = Math.log(1e-3);

// --- Gauss–Hermite nodes (physicists' weight e^{−x²}), Numerical Recipes gauher.
function gaussHermite(n: number): { x: number[]; w: number[] } {
  const x = new Array<number>(n).fill(0);
  const w = new Array<number>(n).fill(0);
  const PIM4 = Math.pow(Math.PI, -0.25);
  const m = Math.floor((n + 1) / 2);
  let z = 0;
  for (let i = 0; i < m; i++) {
    if (i === 0) z = Math.sqrt(2 * n + 1) - 1.85575 * Math.pow(2 * n + 1, -0.16667);
    else if (i === 1) z -= (1.14 * Math.pow(n, 0.426)) / z;
    else if (i === 2) z = 1.86 * z - 0.86 * x[0];
    else if (i === 3) z = 1.91 * z - 0.91 * x[1];
    else z = 2 * z - x[i - 2];
    let pp = 0;
    for (let it = 0; it < 100; it++) {
      let p1 = PIM4;
      let p2 = 0;
      for (let j = 0; j < n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = z * Math.sqrt(2 / (j + 1)) * p2 - Math.sqrt(j / (j + 1)) * p3;
      }
      pp = Math.sqrt(2 * n) * p2;
      const z1 = z;
      z = z1 - p1 / pp;
      if (Math.abs(z - z1) <= 1e-15) break;
    }
    x[i] = z;
    x[n - 1 - i] = -z;
    w[i] = 2 / (pp * pp);
    w[n - 1 - i] = w[i];
  }
  return { x, w };
}
const GH = gaussHermite(N_NODES);

// --- per-observation log-likelihood and its first two η-derivatives.
const SQRT_2PI = Math.sqrt(2 * Math.PI);
function logPhiCdf(z: number): number {
  return Math.log(Math.max(jStat.normal.cdf(z, 0, 1), 1e-300));
}

/** [ℓ, dℓ/dη, d²ℓ/dη²] for y events of n at linear predictor η. */
function obsLik(eta: number, y: number, n: number, link: GlmmLink): [number, number, number] {
  if (link === "logit") {
    // log p = −log(1+e^−η), log(1−p) = −log(1+e^η), computed stably.
    const lp = -(eta > 0 ? Math.log1p(Math.exp(-eta)) : -eta + Math.log1p(Math.exp(eta)));
    const lq = -(eta > 0 ? eta + Math.log1p(Math.exp(-eta)) : Math.log1p(Math.exp(eta)));
    const p = Math.exp(lp);
    return [y * lp + (n - y) * lq, y - n * p, -n * p * (1 - p)];
  }
  const dens = Math.exp(-0.5 * eta * eta) / SQRT_2PI;
  const lp = logPhiCdf(eta);
  const lq = logPhiCdf(-eta);
  const rp = dens / Math.exp(lp); // φ/Φ(η)
  const rq = dens / Math.exp(lq); // φ/Φ(−η)
  const d1 = y * rp - (n - y) * rq;
  const d2 = y * (-eta * rp - rp * rp) + (n - y) * (eta * rq - rq * rq);
  return [y * lp + (n - y) * lq, d1, d2];
}

interface Cluster {
  rows: GlmmRow[];
}

/** log ∫ Π_i f(y_i | u) φ(u; 0, τ²) du for one cluster, by adaptive GH. */
function clusterLogLik(c: Cluster, b0: number, b1: number, tau: number, link: GlmmLink): number {
  const h = (u: number): [number, number, number] => {
    let l = -0.5 * (u / tau) ** 2 - Math.log(tau * SQRT_2PI);
    let d1 = -u / (tau * tau);
    let d2 = -1 / (tau * tau);
    for (const r of c.rows) {
      const [a, b, cc] = obsLik(b0 + b1 * r.x + u, r.events, r.n, link);
      l += a;
      d1 += b;
      d2 += cc;
    }
    return [l, d1, d2];
  };
  // Mode of the integrand by safeguarded Newton (h is concave in u).
  let u = 0;
  for (let it = 0; it < 100; it++) {
    const [, d1, d2] = h(u);
    let step = -d1 / d2;
    if (!Number.isFinite(step)) break;
    step = Math.max(-5, Math.min(5, step));
    u += step;
    if (Math.abs(step) < 1e-12) break;
  }
  const [, , d2] = h(u);
  const sigma = 1 / Math.sqrt(-d2);
  const terms = GH.x.map((xk, k) => Math.log(GH.w[k]) + xk * xk + h(u + Math.SQRT2 * sigma * xk)[0]);
  const mx = Math.max(...terms);
  return Math.log(Math.SQRT2 * sigma) + mx + Math.log(terms.reduce((s, t) => s + Math.exp(t - mx), 0));
}

function marginalLogLik(cl: Cluster[], th: number[], link: GlmmLink): number {
  const tau = Math.exp(th[2]);
  let s = 0;
  for (const c of cl) s += clusterLogLik(c, th[0], th[1], tau, link);
  return s;
}

/** Central-difference gradient and Hessian of f at th. */
function derivs(f: (t: number[]) => number, th: number[], hstep = 1e-4) {
  const k = th.length;
  const f0 = f(th);
  const g = new Array<number>(k).fill(0);
  const H: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const at = (d: [number, number][]) => {
    const t = th.slice();
    for (const [i, v] of d) t[i] += v;
    return f(t);
  };
  for (let i = 0; i < k; i++) {
    const fp = at([[i, hstep]]);
    const fm = at([[i, -hstep]]);
    g[i] = (fp - fm) / (2 * hstep);
    H[i][i] = (fp - 2 * f0 + fm) / (hstep * hstep);
    for (let j = 0; j < i; j++) {
      const v =
        (at([[i, hstep], [j, hstep]]) - at([[i, hstep], [j, -hstep]]) -
         at([[i, -hstep], [j, hstep]]) + at([[i, -hstep], [j, -hstep]])) / (4 * hstep * hstep);
      H[i][j] = v;
      H[j][i] = v;
    }
  }
  return { f0, g, H };
}

/** Solve A·x = b for small dense A (Gaussian elimination, partial pivoting). */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

function invert3(H: number[][]): number[][] | null {
  const cols = [0, 1, 2].map((j) => solve(H, [0, 1, 2].map((i) => (i === j ? 1 : 0))));
  if (cols.some((c) => c == null)) return null;
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (cols[j] as number[])[i]));
}

/**
 * Fit the random-intercept model. `start` is (β₀, β₁) from a fixed-effect fit.
 * Returns null on non-convergence, a non-negative-definite information matrix,
 * or τ collapsing to the boundary (no between-study variance to model — the
 * caller should then treat the curve as unfittable rather than silently
 * switching models).
 */
export function fitGlmm(rows: GlmmRow[], link: GlmmLink, start: [number, number]): GlmmFit | null {
  const byC = new Map<number, GlmmRow[]>();
  for (const r of rows) {
    const a = byC.get(r.cluster) ?? [];
    a.push(r);
    byC.set(r.cluster, a);
  }
  const cl: Cluster[] = [...byC.values()].map((rs) => ({ rows: rs }));
  if (cl.length < 3) return null;
  const f = (t: number[]) => marginalLogLik(cl, t, link);

  let th = [start[0], start[1], Math.log(0.5)];
  let cur = f(th);
  let converged = false;
  for (let it = 0; it < 200; it++) {
    const { g, H } = derivs(f, th);
    // Newton step on the log-likelihood; gradient ascent when the Hessian is
    // not negative definite (far from the optimum).
    let step = solve(H.map((r) => r.map((v) => -v)), g);
    const decrement = step ? g.reduce((s, gi, i) => s + gi * (step as number[])[i], 0) : -1;
    // Converged when the Newton decrement — the log-likelihood gain a full
    // Newton step would still promise — is below 1e-6, far under anything
    // that could move an estimate meaningfully. Scale-free, and robust to the
    // ~1e-4 numerical-gradient noise a 100%-event arm (38/38) produces, where
    // a "parameters stopped moving" test never fires.
    if (decrement >= 0 && decrement / 2 < 1e-6) {
      converged = true;
      break;
    }
    if (!step || decrement <= 0) step = g.map((v) => v * 0.1);
    let t = 1;
    let accepted = false;
    for (let h = 0; h < 30; h++) {
      const cand = th.map((v, i) => v + t * (step as number[])[i]);
      cand[2] = Math.max(cand[2], LOG_TAU_MIN);
      const val = f(cand);
      if (Number.isFinite(val) && val >= cur - 1e-12) {
        th = cand;
        cur = val;
        accepted = true;
        break;
      }
      t /= 2;
    }
    if (!accepted) break;
  }
  if (!converged || th[2] <= LOG_TAU_MIN + 1e-6) return null;

  const { f0, H } = derivs(f, th);
  const V = invert3(H.map((r) => r.map((v) => -v)));
  if (!V || !(V[0][0] > 0) || !(V[1][1] > 0)) return null;
  const se1 = Math.sqrt(V[1][1]);
  const z = th[1] / se1;
  return {
    beta: [th[0], th[1]],
    vcov: [
      [V[0][0], V[0][1]],
      [V[0][1], V[1][1]],
    ],
    tau: Math.exp(th[2]),
    se1,
    p1: 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1)),
    logLik: f0,
  };
}
