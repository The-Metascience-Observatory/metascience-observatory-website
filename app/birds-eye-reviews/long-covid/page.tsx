import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { LongCovidDashboard } from "./LongCovidDashboard";
import type {
  TrialTableRow,
  TrialMeta,
  HoverTrial,
} from "./types";
import {
  extractYearFromDOI,
  CONTROL_KEYWORDS,
  aggregateFromMetas,
} from "./constants";
import { buildFacetInput, countDistinctTrials, type FacetKey } from "./facets";
import { parseCSV } from "./screening/csv-utils";

/** The real verdict labels emitted by classify_trial_verdicts.py (anything else —
 *  blank, parse_error — falls back to the structured proxy / "unknown"). */
const VERDICT_KEYS = new Set([
  "favors_treatment", "favors_control", "no_difference", "mixed", "inconclusive",
]);

interface Verdict { verdict: string; rationale: string; confidence: string }

/** paper_id -> LLM direction-of-effect verdict from trial_verdicts.csv (primary
 *  outcome + significance guardrail; see classify_trial_verdicts.py). Empty map
 *  if the file is absent, so the dashboard still builds on the structured proxy. */
function loadVerdicts(): Map<string, Verdict> {
  const map = new Map<string, Verdict>();
  const fp = path.join(process.cwd(), "data/birds_eye_reviews/long_covid/trial_verdicts.csv");
  if (!fs.existsSync(fp)) return map;
  const records = parseCSV(fs.readFileSync(fp, "utf-8"));
  if (records.length === 0) return map;
  const h = records[0].map((x) => x.trim());
  const idx = (name: string) => h.indexOf(name);
  const pi = idx("paper_id");
  if (pi === -1) return map;
  for (const row of records.slice(1)) {
    const id = (row[pi] ?? "").trim();
    if (!id || map.has(id)) continue;
    map.set(id, {
      verdict: (row[idx("verdict")] ?? "").trim(),
      rationale: (row[idx("rationale")] ?? "").trim(),
      confidence: (row[idx("confidence")] ?? "").trim(),
    });
  }
  return map;
}

export const metadata = {
  title: "Long Covid Clinical Trials | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Interactive dashboard of clinical trials on Long Covid interventions — evidence landscape, effect sizes, metascience analysis, and trial-level detail.",
};


/** Direction-aware verdict proxy for long-covid trials (no separate verdict
 *  classifier run). Derived from per-outcome significance + direction counts:
 *  a significant result favouring control is distinct from a true null, so harm
 *  surfaces as "favors_control" rather than being hidden in "no_difference". */
function categoryVerdict(r: { n_positive: number; n_favors_control: number; n_null: number; n_unknown: number }): string {
  if (r.n_positive > 0 && r.n_favors_control > 0) return "mixed";
  if (r.n_positive > 0) return "favors_treatment";
  if (r.n_favors_control > 0) return "favors_control";
  if (r.n_null > 0) return "no_difference";       // true null (not significant)
  if (r.n_unknown > 0) return "inconclusive";     // no usable data / direction unknown
  return "unknown";
}

/** Zeroed verdict-count bucket keyed by VERDICT_SEGMENTS keys (one place to edit). */
function emptyVerdicts(): Record<string, number> {
  return { favors_treatment: 0, favors_control: 0, no_difference: 0, mixed: 0, inconclusive: 0, unknown: 0 };
}

/** Coerce p_value to a number or null (some records store it as a string like "<0.05") */
function numericOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[<>]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** True for "intervention" arms that are not actually a treatment — observational
 *  cohorts / natural-history groups that the extractor recorded as a pseudo-arm
 *  (e.g. brain-imaging or biomarker studies of Long COVID vs healthy controls).
 *  These are screening false-positives; we keep them out of the intervention
 *  views (chart, tail list, dropdown, table filter) so "no intervention" never
 *  appears as a treatment. They still show in the trial table + other charts. */
function isNonInterventionArm(canonical: string, rawName: string): boolean {
  const c = canonical.toLowerCase();
  if (c === "observational control (no intervention)") return true;
  const raw = rawName.toLowerCase();
  return /\bno (specific )?intervention\b|natural history observation|observational (group|cohort)|cohort followed after/i.test(raw);
}

/** A trial's intervention set, derived ONCE from the structured arms. This single
 *  list drives both the "Trials by Intervention" chart count and the table's
 *  intervention filter, so the two can never disagree. We read the structured
 *  arms (not the comma-joined `interventions` string, whose names can contain
 *  commas) and dedupe by name. The name is the pipeline's `intervention_canonical`
 *  (12_canonicalize_interventions.py) so naming variants collapse to one bar/
 *  filter value; falls back to the raw `intervention_name` if unmapped. Arms that
 *  are observational/no-treatment are dropped (see isNonInterventionArm). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trialInterventions(rec: any): { name: string; category: string }[] {
  const arms = (rec.study_design?.arms ?? []).filter((a: any) => a.type === "intervention");
  const seen = new Set<string>();
  const out: { name: string; category: string }[] = [];
  for (const a of arms) {
    const rawName = (a.intervention_name ?? "").trim();
    const name = (a.intervention_canonical ?? rawName ?? "").trim();
    if (!name || seen.has(name)) continue;
    if (isNonInterventionArm(name, rawName)) continue;
    seen.add(name);
    out.push({ name, category: normInterventionCategory(a.intervention_category, name) });
  }
  return out;
}

/** A trial's distinct primary symptom domains (ALL of them, not just the first).
 *  Used for both the symptom chart count and the symptom table filter. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function primaryDomainsOf(rec: any): string[] {
  const out = new Set<string>();
  for (const o of rec.outcomes ?? []) {
    if (o.is_primary && o.symptom_domain) out.add(o.symptom_domain);
  }
  return [...out];
}

/** Canonicalize a free-text design_type so spelling variants collapse to one
 *  "Trial type" bar / facet value (e.g. "cross-sectional" and "cross_sectional"). */
function normDesignType(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (!s) return "unknown";
  const ALIASES: Record<string, string> = {
    "cross_sectional": "cross_sectional",
    "case_control": "case_control",
    "pre_post": "before_after",
  };
  return ALIASES[s] ?? s;
}

/** Sparse intervention categories that don't warrant their own "Trials by
 *  Intervention" group — folded into "other". */
const CATEGORY_TO_OTHER = new Set([
  "ozone_therapy", "cell_therapy", "dietary", "osteopathic",
]);

/** Specific canonical intervention names whose category should be overridden
 *  (the extractor placed them inconsistently). Keyed by lowercased name. */
const INTERVENTION_CATEGORY_OVERRIDE: Record<string, string> = {
  "nintedanib": "drug/supplement",
};

/** Canonicalize an intervention's category for the dashboard's grouping/filtering:
 *  apply per-intervention overrides first, then fold sparse categories into "other". */
function normInterventionCategory(rawCategory: unknown, interventionName?: string): string {
  const override = interventionName ? INTERVENTION_CATEGORY_OVERRIDE[interventionName.trim().toLowerCase()] : undefined;
  const c = (override ?? String(rawCategory ?? "").trim()) || "unknown";
  return CATEGORY_TO_OTHER.has(c) ? "other" : c;
}

/** Records self-described as non-clinical-trial (e.g. a bioinformatics study) are
 *  extraction noise and excluded from the dashboard. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isClinicalTrialRecord(r: any): boolean {
  const dt = String(r?.study_design?.design_type ?? "");
  return !/not applicable|bioinformatic|not a clinical trial/i.test(dt);
}

/** DOIs marked is_excluded='yes' at the screening/eligibility stage (reviews,
 *  protocols, secondary analyses, preclinical/animal vaccine studies, modelling
 *  papers, …). Some of these were still extracted into trial_extractions.jsonl,
 *  so the dashboard must drop them to stay consistent with the PRISMA funnel —
 *  a record excluded at eligibility must not reappear as a displayed trial. */
function loadScreeningExcludedDois(): Set<string> {
  const excluded = new Set<string>();
  const fp = path.join(process.cwd(), "data/birds_eye_reviews/long_covid/trial_screening.csv");
  if (!fs.existsSync(fp)) return excluded;
  const records = parseCSV(fs.readFileSync(fp, "utf-8"));
  if (records.length === 0) return excluded;
  const h = records[0].map((x) => x.trim());
  const di = h.indexOf("doi");
  const xi = h.indexOf("is_excluded");
  if (di === -1 || xi === -1) return excluded;
  for (const row of records.slice(1)) {
    const doi = (row[di] ?? "").trim();
    if (doi && (row[xi] ?? "").trim().toLowerCase() === "yes") excluded.add(doi);
  }
  return excluded;
}

/** Base DOI for an extraction record (arm-split records use "<doi>#<arm>"); the
 *  screening CSV is keyed by the base DOI. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function baseDoiOf(r: any): string {
  return String(r?.paper_id ?? "").split("#")[0];
}

function processData() {
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/trial_extractions.jsonl"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  const screeningExcluded = loadScreeningExcludedDois();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = raw
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    // Skip failed/empty extractions (no study_design → no arms/design/countries),
    // records self-described as non-clinical-trial (extraction noise), and any
    // paper excluded at the screening/eligibility stage (is_excluded='yes') so the
    // dashboard's displayed set matches the PRISMA funnel.
    .filter((r) => r && r.study_design && isClinicalTrialRecord(r) && !screeningExcluded.has(baseDoiOf(r)));

  // ── Load DOI metadata for author/journal citations ────────────────
  const doiMetaPath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/doi_metadata.json"
  );
  let doiMetadata: Record<string, { first_author: string; author_count: number; journal: string; year: number | null }> = {};
  try {
    doiMetadata = JSON.parse(fs.readFileSync(doiMetaPath, "utf-8"));
  } catch {
    // metadata file not available — citations will fall back to DOI
  }

  // Per-trial LLM verdicts (preferred over the structured proxy when present).
  const verdicts = loadVerdicts();

  // ── 1. Summary stats (uses raw records for accurate instrument count) ─
  const allCountries = new Set<string>();
  const allCategories = new Set<string>();
  const allInstruments = new Set<string>();
  let totalParticipants = 0;

  for (const r of records) {
    if (!r.study_design) continue;
    for (const c of r.study_design.countries ?? []) allCountries.add(c);
    for (const arm of r.study_design.arms ?? []) {
      if (arm.type === "intervention") allCategories.add(normInterventionCategory(arm.intervention_category, arm.intervention_canonical ?? arm.intervention_name));
    }
    for (const o of r.outcomes ?? []) {
      if (o.measurement_instrument) allInstruments.add(o.measurement_instrument);
    }
    if (r.sample_sizes?.n_randomized_total) totalParticipants += r.sample_sizes.n_randomized_total;
  }

  const summaryStats = {
    totalTrials: records.length,
    totalParticipants,
    nCountries: allCountries.size,
    nInterventionCategories: allCategories.size,
    nInstruments: allInstruments.size,
  };

  // ── 2. Trial table rows ───────────────────────────────────────
  const tableRows: TrialTableRow[] = records.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const interventionArms = r.study_design.arms.filter((a: any) => a.type === "intervention");
    const interventionName = interventionArms[0]?.intervention_name ?? "unknown";
    const interventionCategory = normInterventionCategory(
      interventionArms[0]?.intervention_category,
      interventionArms[0]?.intervention_canonical ?? interventionArms[0]?.intervention_name
    );
    // Canonical facet inputs (same helpers the chart aggregation uses).
    const ivs = trialInterventions(r);
    const primaryDomains = primaryDomainsOf(r);
    const facets = buildFacetInput({
      interventions: ivs,
      symptomDomains: primaryDomains,
      countries: r.study_design.countries ?? [],
      designType: normDesignType(r.study_design.design_type),
      blinding: r.study_design.blinding ?? "unknown",
    });

    let primarySymptomDomain = "";
    let primaryOutcomeName = "";
    let primaryEffectMeasure = "";
    let primaryEffectValue: number | null = null;
    let primaryCiLow: number | null = null;
    let primaryCiHigh: number | null = null;
    let primaryPValue: number | null = null;
    let primaryHigherIsBetter: boolean | null = null;
    const outcomesSummary: { name: string; symptom_domain: string; effect_value: number | null; p_value: number | null; higher_is_better: boolean | null; effect_measure: string }[] = [];
    let nPositive = 0;       // significant, favours treatment
    let nFavorsControl = 0;  // significant, favours control (harm)
    let nNull = 0;           // not significant (true null)
    let nUnknown = 0;        // no usable effect/p, or significant but direction unknown

    for (const o of r.outcomes ?? []) {
      const oBge = o.between_group_effects?.[0];
      outcomesSummary.push({
        name: o.name ?? "Unnamed",
        symptom_domain: o.symptom_domain ?? "",
        effect_value: numericOrNull(oBge?.effect_value),
        p_value: numericOrNull(oBge?.p_value),
        higher_is_better: o.higher_is_better ?? null,
        effect_measure: oBge?.effect_measure ?? "",
      });
      if (o.is_primary && !primaryOutcomeName) {
        primarySymptomDomain = o.symptom_domain ?? "";
        primaryOutcomeName = o.name ?? "";
        primaryHigherIsBetter = o.higher_is_better ?? null;
        const bge = o.between_group_effects?.[0];
        if (bge) {
          primaryEffectMeasure = bge.effect_measure ?? "";
          primaryEffectValue = numericOrNull(bge.effect_value);
          primaryCiLow = numericOrNull(bge.ci_95_low);
          primaryCiHigh = numericOrNull(bge.ci_95_high);
          primaryPValue = numericOrNull(bge.p_value);
        }
      }
      // Classify outcome significance + direction. A significant effect in the
      // wrong direction is harm (favours control), distinct from a true null;
      // a significant effect with unknown polarity can't be assigned a direction,
      // so it falls to "unknown" rather than being assumed positive.
      const bge = o.between_group_effects?.[0];
      const bgePVal = numericOrNull(bge?.p_value);
      const bgeEVal = numericOrNull(bge?.effect_value);
      if (!bge || bgePVal == null || bgeEVal == null) {
        nUnknown++;
      } else if (bgePVal < 0.05) {
        const hib = o.higher_is_better;
        if (hib === true) (bgeEVal > 0 ? nPositive++ : nFavorsControl++);
        else if (hib === false) (bgeEVal < 0 ? nPositive++ : nFavorsControl++);
        else nUnknown++; // significant but direction unknown — not assessable
      } else {
        nNull++; // p >= 0.05 — true null result
      }
    }

    const nOutcomes = (r.outcomes ?? []).length;

    // Prefer the LLM verdict; fall back to the structured proxy when absent or
    // not a recognized verdict (blank / parse_error / no-outcome trials).
    const v = verdicts.get(String(r.paper_id));
    const verdict = v && VERDICT_KEYS.has(v.verdict)
      ? v.verdict
      : categoryVerdict({ n_positive: nPositive, n_favors_control: nFavorsControl, n_null: nNull, n_unknown: nUnknown });

    return {
      paper_id: r.paper_id,
      verdict,
      verdict_rationale: v?.rationale ?? "",
      is_rct: r.is_rct ?? false,
      doi_url: `https://doi.org/${r.paper_id}`,
      first_author: doiMetadata[r.paper_id]?.first_author ?? "",
      journal: doiMetadata[r.paper_id]?.journal ?? "",
      design_type: normDesignType(r.study_design.design_type),
      intervention_name: r.interventions ?? interventionName,
      interventions: ivs,
      intervention_category: interventionCategory,
      primary_symptom_domains: primaryDomains,
      facets,
      blinding: r.study_design.blinding ?? "unknown",
      n_randomized: r.sample_sizes?.n_randomized_total ?? null,
      primary_symptom_domain: primarySymptomDomain,
      primary_outcome_name: primaryOutcomeName,
      primary_effect_measure: primaryEffectMeasure,
      primary_effect_value: primaryEffectValue,
      primary_ci_low: primaryCiLow,
      primary_ci_high: primaryCiHigh,
      primary_p_value: primaryPValue,
      primary_higher_is_better: primaryHigherIsBetter,
      countries: r.study_design.countries ?? [],
      rob_overall: r.risk_of_bias?.overall_judgment ?? "unknown",
      follow_up_weeks: r.follow_up?.total_duration_weeks ?? null,
      arm_samples: (() => {
        const arms = r.study_design?.arms ?? [];
        const perArm = r.sample_sizes?.per_arm ?? [];
        return arms.map((a: { arm_id: number; label: string; is_control?: boolean | null }) => {
          const pa = perArm.find((p: { arm_id: number }) => p.arm_id === a.arm_id);
          const labelLower = (a.label ?? "").toLowerCase();
          const isControl = a.is_control === true || CONTROL_KEYWORDS.some((kw) => labelLower.includes(kw));
          return { label: a.label ?? `Arm ${a.arm_id}`, n_randomized: pa?.n_randomized ?? null, is_control: isControl };
        });
      })(),
      long_covid_definition: r.participants?.long_covid_definition ?? "",
      outcomes_summary: outcomesSummary,
      n_outcomes: nOutcomes,
      n_positive: nPositive,
      n_favors_control: nFavorsControl,
      n_null: nNull,
      n_unknown: nUnknown,
      year: r.year ?? extractYearFromDOI(r.paper_id),
      min_weeks: r.participants?.min_time_since_infection_weeks ?? null,
      summary: r.summary ?? "",
      promise_score: r.trial_rating?.promise_score ?? null,
      title: r.title ?? "",
      authors: r.authors ?? "",
      volume: r.volume ?? "",
      issue: r.issue ?? "",
      pages: r.pages ?? "",
    };
  });

  // ── 3. Per-(canonical)-intervention verdict breakdown, for the "Trials by
  //        Intervention" chart (top, >5 trials) and the "fewer trials" tail. A
  //        trial contributes its verdict to EACH of its distinct canonical names
  //        (so counts match the table's intervention filter, which is multi-valued).
  const byNameVerdicts: Record<string, Record<string, number>> = {};
  const trialsByName: Record<string, HoverTrial[]> = {};
  const nameCategory: Record<string, Record<string, number>> = {}; // name -> cat -> count
  for (const r of tableRows) {
    const verdict = r.verdict; // LLM verdict (proxy fallback) attached above
    const label = r.first_author ? `${r.first_author} et al.` : "";
    for (const iv of r.interventions) {
      const name = iv.name || "unspecified";
      const row = (byNameVerdicts[name] ??= emptyVerdicts());
      row[verdict] += 1;
      (trialsByName[name] ??= []).push({
        doi: r.paper_id, label, title: r.title, year: r.year, journal: r.journal,
        n: r.n_randomized, design: r.design_type, phase: null, verdict,
        note: r.verdict_rationale || undefined,
      });
      const cc = (nameCategory[name] ??= {});
      cc[iv.category || "unknown"] = (cc[iv.category || "unknown"] ?? 0) + 1;
    }
  }
  // Collapse nameCategory to the dominant category per canonical intervention.
  const interventionCategoryOf: Record<string, string> = {};
  for (const [name, cats] of Object.entries(nameCategory)) {
    interventionCategoryOf[name] = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
  }

  // ── 4. Trial metadata (lightweight per-record for client-side RCT filtering) ─
  const trialMetas: TrialMeta[] = records.map((r) => {
    // Same canonical intervention list the table filter uses (structured arms,
    // deduped by name) so chart counts and filtered rows always agree.
    const interventionArms = trialInterventions(r);
    const primarySymptomDomains = primaryDomainsOf(r);
    let primaryPValue: number | null = null;
    for (const o of r.outcomes ?? []) {
      if (o.is_primary && !primaryPValue) {
        primaryPValue = numericOrNull(o.between_group_effects?.[0]?.p_value);
      }
    }
    const instruments = new Set<string>();
    for (const o of r.outcomes ?? []) {
      if (o.measurement_instrument) instruments.add(o.measurement_instrument);
    }
    return {
      paper_id: r.paper_id,
      is_rct: r.is_rct ?? false,
      countries: r.study_design.countries ?? [],
      interventionArms,
      primarySymptomDomains,
      rob_overall: r.risk_of_bias?.overall_judgment ?? "unknown",
      blinding: r.study_design.blinding ?? "unknown",
      design_type: normDesignType(r.study_design.design_type),
      n_randomized: r.sample_sizes?.n_randomized_total ?? null,
      min_weeks: r.participants?.min_time_since_infection_weeks ?? null,
      year: r.year ?? extractYearFromDOI(r.paper_id),
      n_instruments: instruments.size,
      primary_p_value: primaryPValue,
      facets: buildFacetInput({
        interventions: interventionArms,
        symptomDomains: primarySymptomDomains,
        countries: r.study_design.countries ?? [],
        designType: normDesignType(r.study_design.design_type),
        blinding: r.study_design.blinding ?? "unknown",
      }),
    };
  });

  // ── 5. Aggregate charts from trialMetas ──────────────────────────
  const aggregated = aggregateFromMetas(trialMetas);

  // Dev invariant: a chart's per-value count (over metas) must equal the table's
  // count (over rows) for the same facet — i.e. clicking a segment shows exactly
  // its number of rows. Both go through facets.ts, so this only fires if the
  // meta/row facet builders ever drift. Stripped from production builds.
  if (process.env.NODE_ENV !== "production") {
    const FACET_KEYS: FacetKey[] = [
      "intervention", "interventionCategory", "symptomDomain", "country", "designType", "blinding",
    ];
    for (const key of FACET_KEYS) {
      const chart = countDistinctTrials(trialMetas, key);
      const table = countDistinctTrials(tableRows, key);
      for (const [val, n] of chart) {
        if ((table.get(val) ?? 0) !== n) {
          console.warn(`[facet-invariant] ${key}="${val}": chart ${n} ≠ table ${table.get(val) ?? 0}`);
        }
      }
    }
  }

  // "Last updated" stamp written by 13_export_dashboard.py (optional — older
  // bundles won't have it, so fall back to an empty string).
  let lastUpdated = "";
  try {
    const meta = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "data/birds_eye_reviews/long_covid/last_updated.json"),
        "utf-8"
      )
    );
    lastUpdated = meta.last_updated_display ?? meta.last_updated ?? "";
  } catch {
    // no stamp file — leave blank
  }

  return {
    // Use server-accurate summary stats (instrument count uses Set dedup)
    summaryStats,
    lastUpdated,
    byIntervention: aggregated.byIntervention,
    bySymptom: aggregated.bySymptom,
    heatmapData: aggregated.heatmapData,
    allCountries: aggregated.allCountries,
    byYear: aggregated.byYear,
    blindingBySignificance: aggregated.blindingBySignificance,
    byDesignType: aggregated.byDesignType,
    lcDefinitionHist: aggregated.lcDefinitionHist,
    lcDefPct12Plus: aggregated.lcDefPct12Plus,
    tableRows,
    trialMetas,
    byNameVerdicts,
    trialsByName,
    interventionCategoryOf,
  };
}

export default function LongCovidReviewPage() {
  let data;
  try {
    data = processData();
  } catch (err) {
    console.error("Failed to load Long Covid data:", err);
    return (
      <div className="min-h-screen">
        <BirdsEyeNavbar subtitle="Long Covid" />
        <main className="pt-20 pb-16">
          <div className="container mx-auto px-4 py-12 max-w-7xl text-center">
            <h1 className="text-2xl font-bold mb-4">Data Unavailable</h1>
            <p className="text-muted-foreground">
              The Long Covid trial data could not be loaded. Please try again later.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <BirdsEyeNavbar subtitle="Long Covid" />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-2 py-8 max-w-7xl">
          <Link
            href="/birds-eye-reviews"
            className="text-sm text-foreground/60 hover:text-foreground transition-colors mb-6 inline-block"
          >
            &larr; Bird&apos;s Eye Reviews
          </Link>
          <LongCovidDashboard {...data} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
