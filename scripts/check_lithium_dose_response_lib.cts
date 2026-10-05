/**
 * Cross-check the lithium-weight-gain dose-response section (shipped TS in
 * app/birds-eye-reviews/lithium-weight-gain/dose-response/) against the
 * independent Python oracle, scripts/check_lithium_dose_response.py.
 *
 *     python3 scripts/check_lithium_dose_response.py --out /tmp/oracle.json   # ~4 min; needs statsmodels
 *     npx tsx scripts/check_lithium_dose_response_lib.cts /tmp/oracle.json
 *
 * Exits non-zero on any mismatch beyond 1e-6 (relative for large values) for
 * the patient-weighted fits, or ~1e-3 for the random-effects fits (two
 * different integrators).
 */

import fs from "fs";
import { loadDoseResponse } from "../app/birds-eye-reviews/lithium-weight-gain/dose-response/load";
import { fitEffect, summarizeEffects } from "../app/birds-eye-reviews/lithium-weight-gain/dose-response/summarize";

const oracle = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
const data = loadDoseResponse("data/birds_eye_reviews/lithium_weight_gain");
let fails = 0;
const TOL = 1e-6;
function check(label: string, a: number | null | undefined, b: number | null | undefined, tol = TOL) {
  const ok =
    (a == null && b == null) ||
    (a != null && b != null && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)));
  if (!ok) {
    fails++;
    console.log(`FAIL ${label}: ts=${a} oracle=${b}`);
  }
}

// Unfiltered — the page shows the same thing when the table filters pass every paper.
for (const e of summarizeEffects(data.points)) {
  const o = oracle.effects[e.key];
  check(`${e.key} lithium arms`, e.lithium.length, o.lithiumArms);
  check(`${e.key} lithium papers`, e.lithiumPapers, o.lithiumPapers);
  check(`${e.key} placebo arms`, e.placeboArms, o.placeboArms);
  e.lithiumCrude?.forEach((v, i) => check(`${e.key} lithiumCrude[${i}]`, v, o.lithiumCrude?.[i]));
  e.placebo?.forEach((v, i) => check(`${e.key} placebo[${i}]`, v, o.placebo?.[i]));
  for (const w of ["random", "pooled"] as const) for (const link of ["logit", "probit"] as const)
  for (const [axis, logX] of [["dose", true], ["serum", false]] as const) {
    const name = `${w} ${link} ${axis}`;
    const fit = fitEffect(e, w, link, axis);
    const of = o.fits[w][link][axis];
    // The random-effects oracle integrates on a dense grid where the TS uses
    // adaptive Gauss-Hermite quadrature, and both take numerical Hessians of a
    // flat likelihood, so they agree to ~1e-3, not 1e-6.
    const tol = w === "random" ? { beta: 2e-3, p: 5e-3, band: 2e-2 } : { beta: TOL, p: TOL, band: TOL };
    check(`${e.key} ${name} gated`, fit.gated ? 1 : 0, of.gated ? 1 : 0);
    check(`${e.key} ${name} arms`, fit.arms, of.arms);
    if (fit.gated || of.gated) continue;
    check(`${e.key} ${name} b0`, fit.beta![0], of.beta[0], tol.beta);
    check(`${e.key} ${name} b1`, fit.beta![1], of.beta[1], tol.beta);
    check(`${e.key} ${name} p1`, fit.p1!, of.p1, tol.p);
    // The oracle predicts at 5 evenly spaced points; the TS band has 41, so
    // every 10th TS point lands on an oracle point.
    of.pred.forEach((pt: { x: number; p: number; lo: number; hi: number }, i: number) => {
      const b = fit.band![i * 10];
      check(`${e.key} ${name} x[${i}]`, logX ? Math.log10(b.x) : b.x, pt.x);
      check(`${e.key} ${name} p[${i}]`, b.p, pt.p, tol.band);
      check(`${e.key} ${name} lo[${i}]`, b.lo, pt.lo, tol.band);
      check(`${e.key} ${name} hi[${i}]`, b.hi, pt.hi, tol.band);
    });
  }
}
const w = data.water, ow = oracle.water;
check("water p5", w?.p5, ow.p5);
check("water p50", w?.p50, ow.p50);
check("water p95", w?.p95, ow.p95);
check("water counties", w?.counties, ow.counties);

console.log(fails === 0 ? "PASS — TS matches oracle" : `${fails} mismatches`);
process.exit(fails === 0 ? 0 : 1);
