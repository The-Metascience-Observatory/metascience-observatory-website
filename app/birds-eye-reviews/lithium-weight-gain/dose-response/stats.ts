import { jStat } from "jstat";
import { fitProbit, probitBand } from "@/lib/probit";
import { fitFractionalLogit } from "@/lib/logit";
import { GlmmLink, GlmmRow, fitGlmm } from "./glmm";
import { MIN_ARMS, MIN_PAPERS } from "./effects";

/** One arm's count of patients reporting one side effect. */
export interface AePoint {
  doi: string;
  /** "Smith et al. (2010)" — filled by the page from citation metadata. */
  label: string;
  armId: string;
  role: "lithium" | "placebo";
  effect: string;
  events: number;
  n: number;
  /** Elemental lithium, mg/day (lithium arms only). */
  doseMg: number | null;
  /** Achieved serum lithium, mmol/L (lithium arms only). */
  serum: number | null;
}

export type Rate = [p: number, lo: number, hi: number];

const Z = 1.959963984540054;

/** Wilson score interval for k events in n. */
export function wilson(k: number, n: number): Rate | null {
  if (n <= 0) return null;
  const p = k / n;
  const den = 1 + (Z * Z) / n;
  const c = (p + (Z * Z) / (2 * n)) / den;
  const h = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / den;
  return [p, c - h, c + h];
}

export interface CurveFit {
  gated: boolean;
  arms: number;
  papers: number;
  beta?: [number, number];
  p1?: number;
  /** Between-study SD of the intercept, on the link scale. */
  tau?: number;
  /** True when the arm/paper minimums were met but the model did not converge. */
  failed?: boolean;
  /** Fitted curve over the observed x range only, x in DATA units (mg/day or mmol/L). */
  band?: { x: number; p: number; lo: number; hi: number }[];
}

export type Link = GlmmLink;
/** "random": random-intercept GLMM, one intercept per paper (glmm.ts).
 *  "pooled": every patient weighted equally, cluster-robust SEs on the paper. */
export type Weighting = "random" | "pooled";

const logistic = (e: number) => 1 / (1 + Math.exp(-e));
const normCdf = (e: number) => jStat.normal.cdf(e, 0, 1);

/** Probability of "patient reported the effect" as an S-curve in x, from a
 *  random-effects (random-intercept binomial) model with one intercept per
 *  paper — see glmm.ts. Each study keeps its own baseline rate, so the curve
 *  is the dose trend for a typical study rather than one dominated by the
 *  largest study's own way of recording side effects.
 *
 *  - logit: 1/(1+e^−(a+b·x)) — on log dose, the Hill equation pharmacology
 *    uses for EC50 curves.
 *  - probit: Φ(a + b·x) — the tolerance-distribution form, where each patient
 *    has their own threshold dose and thresholds are log-normal across patients.
 *
 *  The two shapes are nearly identical; logistic has slightly fatter tails.
 *  Dose is fitted on log10. */
export function fitCurve(
  points: AePoint[],
  xKey: "doseMg" | "serum",
  logX: boolean,
  link: Link = "logit",
  weighting: Weighting = "random",
): CurveFit {
  const use = points.filter((p) => p[xKey] != null);
  const papers = [...new Set(use.map((p) => p.doi.split("#")[0]))].sort();
  const base = { arms: use.length, papers: papers.length };
  if (use.length < MIN_ARMS || papers.length < MIN_PAPERS) return { gated: true, ...base };
  if (weighting === "pooled") return fitPooled(use, papers, xKey, logX, link);

  const t = (v: number) => (logX ? Math.log10(v) : v);
  const pid = new Map(papers.map((b, i) => [b, i]));
  const xs = use.map((p) => t(p[xKey] as number));
  // Fit on centered x (uncentered log10 dose ≈ 2 makes intercept and slope
  // nearly collinear), then map back: β₀ = β₀′ − β₁c, V = J V′ Jᵀ with
  // J = [[1, −c], [0, 1]].
  const c = xs.reduce((s, v) => s + v, 0) / xs.length;
  const rows: GlmmRow[] = use.map((p, i) => ({
    x: xs[i] - c,
    events: p.events,
    n: p.n,
    cluster: pid.get(p.doi.split("#")[0]) as number,
  }));
  const pooled = Math.min(0.99, Math.max(0.01,
    use.reduce((s, p) => s + p.events, 0) / use.reduce((s, p) => s + p.n, 0)));
  const start0 = link === "logit" ? Math.log(pooled / (1 - pooled)) : jStat.normal.inv(pooled, 0, 1);
  // Multi-start: with few, heterogeneous studies the marginal likelihood can
  // have local maxima (seen on headache vs dose, logit), so start from a flat,
  // rising and falling slope and keep the best converged fit.
  let fit: ReturnType<typeof fitGlmm> = null;
  for (const slope of [0, 3, -3]) {
    const f = fitGlmm(rows, link, [start0, slope]);
    if (f && (!fit || f.logLik > fit.logLik)) fit = f;
  }
  if (!fit) return { gated: true, failed: true, ...base };

  const b1 = fit.beta[1];
  const b0 = fit.beta[0] - b1 * c;
  const [[W00, W01], [, W11]] = fit.vcov;
  const V11 = W11;
  const V01 = W01 - c * W11;
  const V00 = W00 - 2 * c * W01 + c * c * W11;
  const inv = link === "logit" ? logistic : normCdf;
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const grid = Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40);
  // Interval on the linear predictor, then through the inverse link — as
  // Stata's `margins` does — so the band stays inside [0, 1].
  const band = grid.map((xv) => {
    const eta = b0 + b1 * xv;
    const se = Math.sqrt(Math.max(0, V00 + 2 * xv * V01 + xv * xv * V11));
    return { x: logX ? 10 ** xv : xv, p: inv(eta), lo: inv(eta - Z * se), hi: inv(eta + Z * se) };
  });
  return { gated: false, ...base, beta: [b0, b1], p1: fit.p1, tau: fit.tau, band };
}

/** The patient-weighted alternative: arm counts expanded to one Bernoulli row
 *  per patient, so every patient counts equally and a study's influence grows
 *  with its size; SEs are cluster-robust on the paper (lib/probit.ts,
 *  lib/logit.ts). Right when studies measure the same thing; here one large
 *  study can pull the curve to its own level. */
function fitPooled(
  use: AePoint[],
  papers: string[],
  xKey: "doseMg" | "serum",
  logX: boolean,
  link: Link,
): CurveFit {
  const base = { arms: use.length, papers: papers.length };
  const t = (v: number) => (logX ? Math.log10(v) : v);
  const pid = new Map(papers.map((b, i) => [b, i]));
  const x: number[] = [];
  const y: boolean[] = [];
  const g: number[] = [];
  for (const p of use) {
    const xv = t(p[xKey] as number);
    const c = pid.get(p.doi.split("#")[0]) as number;
    for (let i = 0; i < p.n; i++) {
      x.push(xv);
      y.push(i < p.events);
      g.push(c);
    }
  }
  const xs = use.map((p) => t(p[xKey] as number));
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const grid = Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40);

  if (link === "probit") {
    const fit = fitProbit(x, y, g);
    if (!fit) return { gated: true, failed: true, ...base };
    const band = probitBand(fit, grid).map((b, i) => ({ x: logX ? 10 ** grid[i] : grid[i], ...b }));
    return { gated: false, ...base, beta: fit.beta, p1: fit.p1, band };
  }

  // Centered x for lib/logit (see fitCurve), mapped back to raw x.
  const c = x.reduce((s, v) => s + v, 0) / x.length;
  const fit = fitFractionalLogit(x.map((v) => [v - c]), y.map((b) => (b ? 1 : 0)), g, ["x"]);
  if (!fit) return { gated: true, failed: true, ...base };
  const b1 = fit.beta[1];
  const b0 = fit.beta[0] - b1 * c;
  const [[W00, W01], [, W11]] = fit.vcov;
  const V11 = W11;
  const V01 = W01 - c * W11;
  const V00 = W00 - 2 * c * W01 + c * c * W11;
  const band = grid.map((xv) => {
    const eta = b0 + b1 * xv;
    const se = Math.sqrt(Math.max(0, V00 + 2 * xv * V01 + xv * xv * V11));
    return { x: logX ? 10 ** xv : xv, p: logistic(eta), lo: logistic(eta - Z * se), hi: logistic(eta + Z * se) };
  });
  return { gated: false, ...base, beta: [b0, b1], p1: fit.terms[0].p, band };
}
