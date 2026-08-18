import fs from "fs";
import path from "path";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { parseCSV, stripTags, normalizeTitle } from "./csv-utils";
import { ResultsClientWrapper } from "./ResultsClientWrapper";
import { TrialRow } from "./ResultsTable";
import { loadArmRatePoints } from "./arm-points";
import { DESIGN_OVERRIDES, INTERVENTION_OVERRIDES, EXCLUDED_DOIS } from "./utils";

export const metadata = {
  title: "Lithium & Weight Gain | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "What clinical studies report about weight gain under lithium treatment, and how it relates to dose and achieved serum level.",
};

const DATA_DIR = "data/birds_eye_reviews/lithium_weight_gain";
const dataPath = (f: string) => path.join(process.cwd(), DATA_DIR, f);

/** First-author surname from a "First Last; ..." or "Last, F; ..." author list. */
function firstAuthorSurname(authors: string): string {
  if (!authors) return "";
  const first = authors.split(/[;]| and /)[0].trim();
  if (first.includes(",")) return first.slice(0, first.indexOf(",")).trim();
  const toks = first.split(/\s+/).filter(Boolean);
  if (toks.length === 0) return "";
  const lastTok = toks[toks.length - 1];
  if (toks.length >= 2 && /^[A-Z]{1,3}\.?$/.test(lastTok)) return toks[0];
  return lastTok;
}

/** "Smith et al." label for hover tooltips. */
function hoverLabel(authors: string): string {
  const s = firstAuthorSurname(authors);
  return s ? `${s} et al.` : "";
}

interface Citation {
  title: string;
  authors: string;
  journal: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  url: string;
}

/** doi -> citation metadata from trial_screening.csv.
 *
 *  Built by `lithium_weight_gain_ad_hoc_review/make_screening_csv.py`, which
 *  renames the columns of the pipeline's `search_enriched.csv` into the
 *  `paper_*` names this loader expects. The dashboard bundle itself carries no
 *  bibliographic data, so without that file every reference renders blank.
 */
function loadCitations(): Map<string, Citation> {
  const map = new Map<string, Citation>();
  const fp = dataPath("trial_screening.csv");
  if (!fs.existsSync(fp)) return map;
  const records = parseCSV(fs.readFileSync(fp, "utf-8"));
  if (records.length < 2) return map;
  const h = records[0].map((x) => x.trim());
  const idx = (name: string) => h.indexOf(name);
  for (const row of records.slice(1)) {
    const doi = (row[idx("doi")] ?? "").trim();
    if (!doi) continue;
    map.set(doi, {
      title: normalizeTitle(stripTags(row[idx("paper_title")] ?? "")).slice(0, 250),
      authors: stripTags(row[idx("paper_authors")] ?? "").slice(0, 200),
      journal: (row[idx("paper_journal")] ?? "").trim(),
      year: (row[idx("paper_year")] ?? "").trim(),
      volume: (row[idx("paper_volume")] ?? "").trim(),
      issue: (row[idx("paper_issue")] ?? "").trim(),
      pages: (row[idx("paper_pages")] ?? "").trim(),
      url: (row[idx("paper_url")] ?? "").trim(),
    });
  }
  return map;
}

// Effect measures the table can render. Ratio measures are shown as-is; the
// forest handles the log scaling.
const RATIO = new Set([
  "odds_ratio", "risk_ratio", "hazard_ratio", "rate_ratio", "incidence_rate_ratio",
  "adjusted_odds_ratio", "adjusted_risk_ratio", "adjusted_hazard_ratio",
]);
const DIFF = new Set([
  "mean_difference", "adjusted_mean_difference", "risk_difference",
  "standardized_mean_difference", "smd",
]);

/** Is this outcome about body weight / BMI / adiposity?
 *
 *  The extraction stores the domain under `symptom_domain` / `category` and the
 *  human-readable name under `name`; this review's outcome vocabulary is not
 *  normalised, so match on the text rather than an enum.
 */
const WEIGHT_RE = /weight|bmi|body mass|adipos|waist|body composition/i;
function isWeightOutcome(o: Record<string, unknown>): boolean {
  const hay = `${o.name ?? ""} ${o.symptom_domain ?? ""} ${o.category ?? ""} ${o.weight_metric ?? ""}`;
  return WEIGHT_RE.test(hay);
}

/** How the study expressed weight change. These are NOT interchangeable: the
 *  kg-vs-"proportion gaining >=7%" split is the central disagreement in this
 *  literature (McKnight 2012 pooled the dichotomous form and found a doubling of
 *  risk; Gomes-da-Costa 2022 pooled continuous kg and found nothing). The table
 *  therefore always shows each study's own metric rather than converting. */
const METRIC_LABEL: Record<string, string> = {
  change_kg: "kg change",
  absolute_kg: "kg",
  bmi_kg_m2: "BMI",
  bmi_change: "BMI change",
  percent_change: "% change",
  proportion_gaining_7pct: "% gaining ≥7%",
  proportion_gaining_5pct: "% gaining ≥5%",
  waist_cm: "waist (cm)",
};

/** Intervention buckets for the filter, tagged per study from its arms.
 *
 *  "Lithium carbonate" lumps every plain-lithium arm whose salt is carbonate
 *  OR unstated — the review-wide convention already reads an unstated salt in
 *  a bipolar population as carbonate (that is what the table's "~" marker
 *  means). Combination arms (lithium given WITH another psychotropic) are a
 *  separate bucket because their weight signal cannot be attributed to
 *  lithium alone.
 */
const OTHER_SALTS = new Set(["sulfate", "citrate", "acetate", "aspartate", "orotate", "gluconate"]);

function interventionTags(sd: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  const arms = Array.isArray(sd.arms) ? (sd.arms as Record<string, unknown>[]) : [];
  for (const a of arms) {
    const cat = String(a.intervention_category ?? "");
    const name = String(a.intervention_name ?? "");
    const mentionsLi = /lithium/i.test(name);
    if (cat === "lithium") {
      const salt = String(a.lithium_salt ?? "");
      tags.add(OTHER_SALTS.has(salt) ? "lithium_other_salt" : "lithium_carbonate");
    } else if (cat === "combination" && mentionsLi) {
      tags.add("lithium_combo");
    } else if (mentionsLi && cat !== "placebo") {
      // Lithium hiding in an "other"/misc arm — count it as plain lithium.
      tags.add("lithium_carbonate");
    }
  }
  if (tags.size === 0) tags.add("unclear");
  return [...tags];
}

interface PaperFacet {
  setting: string;
  setting_text: string;
  diagnosis: string;
  diagnosis_text: string;
}

/** DOI-keyed setting / psychiatric-diagnosis sidecar, exported from the
 *  MERGED canonical extractions in the pipeline workspace by
 *  `lithium_weight_gain_ad_hoc_review/export_dashboard_facets.py`. Kept as a
 *  separate file so the main published bundle stays untouched until an
 *  explicit publish decision. */
function loadFacets(): Record<string, PaperFacet> {
  const fp = dataPath("paper_facets.json");
  try {
    if (!fs.existsSync(fp)) return {};
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as Record<string, PaperFacet>;
  } catch {
    return {};
  }
}

function loadTrials(cites: Map<string, Citation>): TrialRow[] {
  const facets = loadFacets();
  const fp = dataPath("trial_extractions.jsonl");
  if (!fs.existsSync(fp)) return [];
  const out: TrialRow[] = [];
  for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let r: Record<string, unknown>;
    try { r = JSON.parse(s); } catch { continue; }
    if (r._status && r._status !== "ok") continue;

    const outcomes = Array.isArray(r.outcomes) ? (r.outcomes as Record<string, unknown>[]) : [];
    const weightOutcomes = outcomes.filter(isWeightOutcome);
    // This dashboard answers one question, so a study with no weight/BMI
    // outcome has nothing to say here and is dropped entirely.
    if (weightOutcomes.length === 0) continue;

    const doi = String(r.paper_id ?? "");
    const baseDoi = doi.split("#")[0];
    if (EXCLUDED_DOIS.has(baseDoi)) continue;
    const sd = (r.study_design ?? {}) as Record<string, unknown>;
    const ss = (r.sample_sizes ?? {}) as Record<string, unknown>;
    const rob = (r.risk_of_bias ?? {}) as Record<string, unknown>;
    const derived = (r.derived ?? {}) as Record<string, unknown>;
    const followUp = (r.follow_up ?? {}) as Record<string, unknown>;

    // Prefer a weight outcome that actually carries a usable between-group
    // effect; fall back to the first weight outcome so the row still appears
    // (its result column simply reads "—", which is honest).
    let chosen = weightOutcomes[0];
    let eff: Record<string, unknown> | undefined;
    for (const o of weightOutcomes) {
      const effs = Array.isArray(o.between_group_effects)
        ? (o.between_group_effects as Record<string, unknown>[])
        : [];
      const e = effs.find(
        (x) =>
          (RATIO.has(String(x.effect_measure)) || DIFF.has(String(x.effect_measure))) &&
          x.effect_value != null,
      );
      if (e) { chosen = o; eff = e; break; }
    }

    const c = cites.get(baseDoi);
    const n = (ss.n_randomized_total as number) ?? (ss.n_enrolled_total as number) ?? null;

    // Duration: treatment length is the exposure that matters for weight; fall
    // back to total study length when the split isn't reported.
    const durationWeeks =
      (followUp.treatment_duration_weeks as number) ??
      (followUp.total_duration_weeks as number) ??
      null;

    const countries = Array.isArray(sd.countries)
      ? [...new Set((sd.countries as unknown[]).filter(
          (x): x is string => typeof x === "string" && x.trim() !== ""))]
      : [];
    const facet = facets[baseDoi];

    out.push({
      doi,
      // A row with no country would silently fail every country selection, so
      // the gap is a filterable value instead of a permanent exclusion.
      countries: countries.length > 0 ? countries : ["Unknown"],
      setting: facet?.setting || "other",
      settingText: facet?.setting_text ?? "",
      diagnosis: facet?.diagnosis || "other",
      diagnosisText: facet?.diagnosis_text ?? "",
      hoverLabel: hoverLabel(c?.authors ?? ""),
      design:
        DESIGN_OVERRIDES[baseDoi] ?? String(sd.design_type ?? (r.is_rct ? "rct" : "")),
      interventions: INTERVENTION_OVERRIDES[baseDoi] ?? interventionTags(sd),
      n,
      rob: String(rob.overall_judgment ?? ""),

      // --- dose ---------------------------------------------------------
      elementalMgPerDay: (derived.mean_elemental_mg_per_day as number) ?? null,
      serumMmolL: (derived.mean_serum_li_mmol_L as number) ?? null,
      serumBand: String(derived.serum_li_band ?? ""),
      // True when the elemental dose rests on the bipolar-population carbonate
      // assumption rather than a stated salt — surfaced so an imputed dose is
      // never mistaken for a reported one.
      saltAssumed: Boolean(derived.lithium_salt_assumed),
      isPoolable: Boolean(derived.is_poolable),
      exposureStratum: String(derived.exposure_stratum ?? ""),

      // --- duration -----------------------------------------------------
      durationWeeks,

      // --- weight result ------------------------------------------------
      weightMetric: String(chosen?.weight_metric ?? ""),
      weightMetricLabel: METRIC_LABEL[String(chosen?.weight_metric ?? "")] ?? "",
      outcomeName: String(chosen?.name ?? ""),
      effMeasure: String(eff?.effect_measure ?? ""),
      effVal: (eff?.effect_value as number) ?? null,
      ciLo: (eff?.ci_95_low as number) ?? null,
      ciHi: (eff?.ci_95_high as number) ?? null,
      pVal: (eff?.p_value as number) ?? null,
      // An SE recovered from a reported p-value rather than read off the paper.
      seFromP: String(eff?.se_source ?? "") === "from_p_value",

      summary: String(r.summary ?? "").slice(0, 400),
      title: c?.title ?? "",
      authors: c?.authors ?? "",
      journal: c?.journal ?? "",
      year: c?.year ?? "",
      volume: c?.volume ?? "",
      issue: c?.issue ?? "",
      pages: c?.pages ?? "",
      url: c?.url ?? "",
    });
  }
  return out;
}

export default function ResultsPage() {
  const cites = loadCitations();
  const trials = loadTrials(cites);
  // Arm-level kg-change points for the dose-normalized charts; hover labels
  // come from the same citation join the table uses.
  const armPoints = loadArmRatePoints(DATA_DIR).map((p) => {
    const c = cites.get(p.doi.split("#")[0]);
    const who = hoverLabel(c?.authors ?? "");
    return { ...p, label: who ? `${who}${c?.year ? ` (${c.year})` : ""}` : "" };
  });

  return (
    <>
      <BirdsEyeNavbar />
      {/* Full-width rather than the shared `container` (capped at 1040px in
          tailwind.config): this page's table carries ten columns and was being
          squeezed into a narrow strip on a wide monitor. Scoped to this page —
          changing the theme's container would reflow the whole site. The side
          padding grows to ≈1–2 in on desktop so the content never touches the
          screen edges. */}
      <main className="w-full px-4 sm:px-8 lg:px-24 2xl:px-40 pt-24 pb-16 min-h-screen">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/birds-eye-reviews" className="text-sm text-blue-600 hover:text-blue-700">
            &larr; Back to Bird&apos;s Eye Reviews
          </Link>
        </div>

        <h1 className="font-clarendon font-bold text-3xl mb-2">
          Lithium &amp; Weight Gain
        </h1>
        <p className="mb-4 max-w-3xl text-sm text-foreground/70">
          Every study in this review that reports body weight, BMI, or a
          weight-related adverse event in people taking lithium — related where
          possible to elemental dose and achieved serum level.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/birds-eye-reviews/lithium-weight-gain/screening"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            View screening process &rarr;
          </Link>
          {/* The findings-report page still exists at /report but is
              deliberately not linked from here. */}
        </div>

        <ResultsClientWrapper trials={trials} armPoints={armPoints} />
      </main>
      <Footer />
    </>
  );
}
