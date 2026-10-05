import fs from "fs";
import path from "path";
import { SALT_FRACTION, armElementalDose } from "../arm-points";
import { EXCLUDED_DOIS, CHART_EXCLUDED_DOIS } from "../utils";
import { effectOf } from "./effects";
import type { AePoint } from "./stats";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const asList = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

/** Per-arm side-effect counts for lithium-monotherapy and placebo arms.
 *
 *  - Therapeutic stratum only: drinking-water, supplement and anorexia studies
 *    are never mixed with therapeutic dosing (same rule as the charts above).
 *  - Denominator = the arm's randomized N; an arm without one is skipped
 *    rather than given a guessed denominator, as is any count above it.
 *  - One count per (arm, effect): when several events map to one effect
 *    ("nausea", "vomiting") the LARGEST is kept, so patients are never
 *    double-counted.
 *  - "Combination" arms (lithium plus another psychotropic) are left out: their
 *    side effects cannot be attributed to lithium.
 *
 *  Mirrored by scripts/check_lithium_dose_response.py.
 */
export function loadAePoints(dataDir: string): AePoint[] {
  const fp = path.join(process.cwd(), dataDir, "trial_extractions.jsonl");
  if (!fs.existsSync(fp)) return [];
  const out: AePoint[] = [];

  for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let r: Rec;
    try { r = JSON.parse(s) as Rec; } catch { continue; }
    if (r._status && r._status !== "ok") continue;

    const doi = String(r.paper_id ?? "");
    const base = doi.split("#")[0];
    if (EXCLUDED_DOIS.has(base) || CHART_EXCLUDED_DOIS.has(base)) continue;
    const derived = asRec(r.derived);
    if (derived.exposure_stratum !== "therapeutic") continue;

    const arms = new Map<unknown, Rec>();
    for (const a of asList(asRec(r.study_design).arms)) arms.set(a.arm_id, a);
    const ns = new Map<unknown, number>();
    for (const p of asList(asRec(r.sample_sizes).per_arm)) {
      const n = num(p.n_randomized);
      if (n != null && n > 0) ns.set(p.arm_id, n);
    }

    for (const pa of asList(asRec(r.adverse_events).per_arm)) {
      const arm = asRec(arms.get(pa.arm_id));
      const cat = arm.intervention_category;
      const role = cat === "lithium" ? "lithium" : cat === "placebo" ? "placebo" : null;
      const N = ns.get(pa.arm_id);
      if (!role || !N) continue;

      const best = new Map<string, number>();
      for (const e of asList(pa.notable_aes)) {
        const k = effectOf(String(e.event ?? ""));
        const n = num(e.n);
        if (k == null || n == null || n < 0 || n > N) continue;
        best.set(k, Math.max(best.get(k) ?? -1, n));
      }

      for (const [effect, events] of best) {
        let doseMg: number | null = null;
        let serum: number | null = null;
        if (role === "lithium") {
          doseMg = armElementalDose(arm, derived);
          serum = num(arm.serum_lithium_mmol_L_mean) ?? num(derived.mean_serum_li_mmol_L);
        }
        out.push({
          doi,
          label: "",
          armId: String(pa.arm_id),
          role,
          effect,
          events: Math.trunc(events),
          n: Math.trunc(N),
          doseMg: doseMg != null && doseMg > 0 ? doseMg : null,
          serum: serum != null && serum > 0 ? serum : null,
        });
      }
    }
  }
  return out;
}

/** Empirical dose-to-serum ratio: elemental mg/day per mmol/L of achieved
 *  serum lithium, across therapeutic lithium arms that state their salt (no
 *  carbonate assumption) and report both an arm-level dose and an arm-level
 *  serum level. At steady state serum ≈ dose ÷ clearance, so the median ratio
 *  is a population-typical conversion; individuals vary 2–3× with kidney
 *  function, age and salt intake. Mirrored by the Python oracle. */
export function loadDoseSerumRatio(
  dataDir: string,
): { mgPerMmol: number; q1: number; q3: number; arms: number } | null {
  const fp = path.join(process.cwd(), dataDir, "trial_extractions.jsonl");
  if (!fs.existsSync(fp)) return null;
  const ratios: number[] = [];
  for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let r: Rec;
    try { r = JSON.parse(s) as Rec; } catch { continue; }
    if (r._status && r._status !== "ok") continue;
    const base = String(r.paper_id ?? "").split("#")[0];
    if (EXCLUDED_DOIS.has(base) || CHART_EXCLUDED_DOIS.has(base)) continue;
    if (asRec(r.derived).exposure_stratum !== "therapeutic") continue;
    for (const a of asList(asRec(r.study_design).arms)) {
      if (a.intervention_category !== "lithium") continue;
      const serum = num(a.serum_lithium_mmol_L_mean);
      let dose = num(a.dose_elemental_mg_per_day_mean);
      const salt = num(a.dose_salt_mg_per_day_mean);
      const frac = SALT_FRACTION[String(a.lithium_salt ?? "")];
      if (dose == null && salt != null && frac) dose = salt * frac;
      // Plausibility bounds drop extraction slips (e.g. a dose in the wrong unit).
      if (serum != null && dose != null && serum > 0.1 && serum < 2 && dose > 10) ratios.push(dose / serum);
    }
  }
  if (ratios.length < 10) return null;
  ratios.sort((x, y) => x - y);
  // Quantiles by linear interpolation (Python statistics' "inclusive" method).
  const q = (f: number) => {
    const h = (ratios.length - 1) * f;
    const lo = Math.floor(h);
    return ratios[lo] + (h - lo) * ((ratios[Math.min(lo + 1, ratios.length - 1)]) - ratios[lo]);
  };
  return { mgPerMmol: q(0.5), q1: q(0.25), q3: q(0.75), arms: ratios.length };
}
