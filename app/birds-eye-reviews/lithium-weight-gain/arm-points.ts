import fs from "fs";
import path from "path";
import { DESIGN_OVERRIDES, EXCLUDED_DOIS, CHART_EXCLUDED_DOIS, SIGN_FLIPPED_CHANGE_DOIS } from "./utils";

/** One lithium arm's observed weight change, normalized to a rate.
 *
 *  Built from arm-level extraction data (within_group_change entries and
 *  change-from-baseline arm_results), NOT from between-group effects — many
 *  single-arm cohorts report how much weight their lithium patients gained
 *  without any comparison group, and that observation is exactly what a
 *  "kg per week" axis can use.
 */
export interface ArmRatePoint {
  doi: string;
  /** "Smith et al." — filled by the page from citation metadata. */
  label: string;
  /** kg change per week of treatment. */
  kgPerWeek: number;
  /** Total kg change over the whole observation window. */
  totalKg: number;
  weeks: number;
  /** Elemental lithium, mg/day, for this arm (salt-converted if needed). */
  doseMg: number | null;
  /** Achieved serum lithium for this arm, mmol/L. */
  serum: number | null;
  design: string;
  /** True for randomized / interventional designs. */
  isTrial: boolean;
  /** Analyzed N for this arm (nearest arm_result), or null. */
  n: number | null;
  /** derived.exposure_stratum — strata are never pooled: drinking-water
   *  studies run in the OPPOSITE direction from therapeutic dosing, and
   *  anorexia trials give lithium in order to induce weight gain. */
  stratum: string;
}

const WEIGHT_RE = /weight|bmi|body mass|adipos|waist|body composition/i;

/** Fraction of a lithium salt's mass that is elemental lithium (PubChem). */
const SALT_FRACTION: Record<string, number> = {
  carbonate: 0.1879,
  citrate: 0.0992,
  orotate: 0.0428,
  sulfate: 0.1263,
  gluconate: 0.0343,
};

// Only kilogram metrics share the y-axis. BMI changes exist in the data but
// are too sparse to plot (12 arms, 6 with a dose) and cannot sit on a kg scale.
const KG_METRICS = new Set(["change_kg", "absolute_kg"]);

// Compared case-insensitively with "-" folded to "_": the data's raw values
// are "RCT" (uppercase) and "quasi-experimental" (hyphenated).
const TRIAL_DESIGNS = new Set(["rct", "crossover", "non_randomized_trial", "quasi_experimental"]);
const isTrialDesign = (d: string) =>
  TRIAL_DESIGNS.has(d.toLowerCase().replace(/-/g, "_"));

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const asList = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

function isWeightOutcome(o: Rec): boolean {
  return WEIGHT_RE.test(`${o.name ?? ""} ${o.symptom_domain ?? ""} ${o.category ?? ""} ${o.weight_metric ?? ""}`);
}

function armElementalDose(arm: Rec, derived: Rec): number | null {
  const direct = num(arm.dose_elemental_mg_per_day_mean);
  if (direct != null) return direct;
  const saltMg = num(arm.dose_salt_mg_per_day_mean);
  const frac = SALT_FRACTION[String(arm.lithium_salt ?? "")];
  if (saltMg != null && frac) return saltMg * frac;
  return num(derived.mean_elemental_mg_per_day);
}

/** One lithium arm's weight-gain INCIDENCE — the proportion of patients who
 *  gained weight, from binary/threshold outcomes and AE-style counts. */
export interface IncidencePoint {
  doi: string;
  label: string;
  /** % of the arm's patients with weight gain. */
  pct: number;
  n: number | null;
  /** True when the outcome uses a formal ≥7%/≥5% body-weight threshold;
   *  false for "any weight gain" / AE-report definitions. */
  thresholdDefined: boolean;
  outcomeName: string;
  doseMg: number | null;
  serum: number | null;
  weeks: number | null;
  stratum: string;
}

const GAIN_RE = /gain|increas|≥\s*7|≥\s*5|7\s*%|5\s*%/i;
// Bidirectional or loss outcomes are not "weight gain incidence".
const NOT_GAIN_RE = /increases and decreases|weight loss|decrease|underweight|overweight or obese status|bmi\s*>|broca/i;
const CONTINUOUS_METRICS = new Set([
  "change_kg", "absolute_kg", "bmi_kg_m2", "bmi_change", "percent_change", "waist_cm",
]);

export function loadIncidencePoints(dataDir: string): IncidencePoint[] {
  const fp = path.join(process.cwd(), dataDir, "trial_extractions.jsonl");
  if (!fs.existsSync(fp)) return [];
  const out: IncidencePoint[] = [];

  for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let r: Rec;
    try { r = JSON.parse(s) as Rec; } catch { continue; }
    if (r._status && r._status !== "ok") continue;

    const doi = String(r.paper_id ?? "");
    if (EXCLUDED_DOIS.has(doi.split("#")[0]) || CHART_EXCLUDED_DOIS.has(doi.split("#")[0])) continue;
    const outcomes = asList(r.outcomes).filter(isWeightOutcome);
    if (outcomes.length === 0) continue;

    const sd = asRec(r.study_design);
    const derived = asRec(r.derived);
    const followUp = asRec(r.follow_up);
    const fallbackWeeks =
      num(followUp.treatment_duration_weeks) ?? num(followUp.total_duration_weeks);

    const arms = new Map<unknown, Rec>();
    const lithiumArmIds = new Set<unknown>();
    for (const a of asList(sd.arms)) {
      arms.set(a.arm_id, a);
      if (
        a.intervention_category === "lithium" ||
        /lithium/i.test(String(a.intervention_name ?? ""))
      ) {
        lithiumArmIds.add(a.arm_id);
      }
    }

    for (const o of outcomes) {
      const metric = String(o.weight_metric ?? "");
      if (CONTINUOUS_METRICS.has(metric)) continue;
      const name = String(o.name ?? "");
      const isThreshold =
        metric === "proportion_gaining_7pct" || metric === "proportion_gaining_5pct";
      if (!isThreshold && (!GAIN_RE.test(name) || NOT_GAIN_RE.test(name))) continue;

      const weeksOfTp = new Map<unknown, number | null>();
      for (const t of asList(o.timepoints)) {
        weeksOfTp.set(
          t.timepoint_id,
          num(t.weeks_from_randomization) ?? num(t.weeks_from_enrollment),
        );
      }

      const seen = new Set<unknown>();
      for (const ar of asList(o.arm_results)) {
        const armId = ar.arm_id;
        if (!lithiumArmIds.has(armId) || seen.has(armId)) continue;
        const events = num(ar.events);
        const total = num(ar.total);
        const pct =
          num(ar.percent) ?? (events != null && total ? (100 * events) / total : null);
        if (pct == null || pct < 0 || pct > 100) continue;
        seen.add(armId);
        const arm = asRec(arms.get(armId));
        out.push({
          doi,
          label: "",
          pct,
          n: total ?? num(ar.n_analyzed),
          thresholdDefined: isThreshold || /≥\s*7|7\s*%/.test(name),
          outcomeName: name,
          doseMg: armElementalDose(arm, derived),
          serum: num(arm.serum_lithium_mmol_L_mean) ?? num(derived.mean_serum_li_mmol_L),
          weeks: weeksOfTp.get(ar.timepoint_id) ?? fallbackWeeks,
          stratum: String(derived.exposure_stratum ?? ""),
        });
      }
    }
  }
  return out;
}

export function loadArmRatePoints(dataDir: string): ArmRatePoint[] {
  const fp = path.join(process.cwd(), dataDir, "trial_extractions.jsonl");
  if (!fs.existsSync(fp)) return [];
  const out: ArmRatePoint[] = [];

  for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let r: Rec;
    try { r = JSON.parse(s) as Rec; } catch { continue; }
    if (r._status && r._status !== "ok") continue;

    const outcomes = asList(r.outcomes).filter(isWeightOutcome);
    if (outcomes.length === 0) continue;

    const sd = asRec(r.study_design);
    const derived = asRec(r.derived);
    const followUp = asRec(r.follow_up);
    const doi = String(r.paper_id ?? "");
    if (EXCLUDED_DOIS.has(doi.split("#")[0]) || CHART_EXCLUDED_DOIS.has(doi.split("#")[0])) continue;
    const design = DESIGN_OVERRIDES[doi.split("#")[0]] ?? String(sd.design_type ?? "");

    const arms = new Map<unknown, Rec>();
    const lithiumArmIds = new Set<unknown>();
    for (const a of asList(sd.arms)) {
      arms.set(a.arm_id, a);
      if (
        a.intervention_category === "lithium" ||
        /lithium/i.test(String(a.intervention_name ?? ""))
      ) {
        lithiumArmIds.add(a.arm_id);
      }
    }

    // Study-level duration, used when the outcome's timepoint carries no weeks.
    const fallbackWeeks =
      num(followUp.treatment_duration_weeks) ?? num(followUp.total_duration_weeks);

    // One point per (arm, metric): a study measuring at several timepoints
    // contributes its first (usually final/primary) measurement only.
    const seen = new Set<string>();

    for (const o of outcomes) {
      const metric = String(o.weight_metric ?? "");
      if (!KG_METRICS.has(metric)) continue;

      const weeksOfTp = new Map<unknown, number | null>();
      for (const t of asList(o.timepoints)) {
        weeksOfTp.set(
          t.timepoint_id,
          num(t.weeks_from_randomization) ?? num(t.weeks_from_enrollment),
        );
      }

      const armResults = asList(o.arm_results);
      const armN = (armId: unknown, tpId: unknown): number | null => {
        const same = armResults.filter((ar) => ar.arm_id === armId);
        const atTp = same.find((ar) => ar.timepoint_id === tpId && num(ar.n_analyzed) != null);
        return (
          num(atTp?.n_analyzed) ??
          num(same.find((ar) => num(ar.n_analyzed) != null)?.n_analyzed)
        );
      };

      const add = (armId: unknown, changeKg: number | null, tpId: unknown) => {
        if (changeKg == null || !lithiumArmIds.has(armId)) return;
        // Hand-verified sign correction (see SIGN_FLIPPED_CHANGE_DOIS).
        if (SIGN_FLIPPED_CHANGE_DOIS.has(doi.split("#")[0])) changeKg = -changeKg;
        const weeks = weeksOfTp.get(tpId) ?? fallbackWeeks;
        if (weeks == null || weeks <= 0) return;
        const key = `${armId}|${metric}`;
        if (seen.has(key)) return;
        seen.add(key);
        const arm = asRec(arms.get(armId));
        out.push({
          doi,
          label: "",
          kgPerWeek: changeKg / weeks,
          totalKg: changeKg,
          weeks,
          doseMg: armElementalDose(arm, derived),
          serum: num(arm.serum_lithium_mmol_L_mean) ?? num(derived.mean_serum_li_mmol_L),
          design,
          isTrial: isTrialDesign(design),
          n: armN(armId, tpId),
          stratum: String(derived.exposure_stratum ?? ""),
        });
      };

      // Preferred source first: an explicit within-group change...
      for (const wg of asList(o.within_group_change)) {
        add(wg.arm_id, num(wg.change_mean), wg.timepoint_to);
      }
      // ...then arm results that ARE changes from baseline.
      for (const ar of asList(o.arm_results)) {
        if (ar.result_type !== "change_from_baseline") continue;
        add(ar.arm_id, num(ar.mean), ar.timepoint_id);
      }
    }
  }
  return out;
}
