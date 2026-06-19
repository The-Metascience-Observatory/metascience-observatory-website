import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { LongCovidDashboard } from "./LongCovidDashboard";
import type {
  TrialTableRow,
  TrialMeta,
} from "./types";
import {
  extractYearFromDOI,
  CONTROL_KEYWORDS,
  aggregateFromMetas,
} from "./constants";
import { buildFacetInput, countDistinctTrials, type FacetKey } from "./facets";

export const metadata = {
  title: "Long Covid Clinical Trials | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Interactive dashboard of clinical trials on Long Covid interventions — evidence landscape, effect sizes, metascience analysis, and trial-level detail.",
};


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

/** A trial's intervention set, derived ONCE from the structured arms. This single
 *  list drives both the "Trials by Intervention" chart count and the table's
 *  intervention filter, so the two can never disagree. We read the structured
 *  arms (not the comma-joined `interventions` string, whose names can contain
 *  commas) and dedupe by name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trialInterventions(rec: any): { name: string; category: string }[] {
  const arms = (rec.study_design?.arms ?? []).filter((a: any) => a.type === "intervention");
  const seen = new Set<string>();
  const out: { name: string; category: string }[] = [];
  for (const a of arms) {
    const name = (a.intervention_name ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, category: a.intervention_category ?? "unknown" });
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

function processData() {
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/trial_extractions.jsonl"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = raw
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    // Skip failed/empty extractions: a record without study_design has no arms,
    // design_type, or countries to display and would crash the maps below.
    .filter((r) => r && r.study_design);

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

  // ── 1. Summary stats (uses raw records for accurate instrument count) ─
  const allCountries = new Set<string>();
  const allCategories = new Set<string>();
  const allInstruments = new Set<string>();
  let totalParticipants = 0;

  for (const r of records) {
    if (!r.study_design) continue;
    for (const c of r.study_design.countries ?? []) allCountries.add(c);
    for (const arm of r.study_design.arms ?? []) {
      if (arm.type === "intervention") allCategories.add(arm.intervention_category);
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
    const interventionCategory = interventionArms[0]?.intervention_category ?? "unknown";
    // Canonical facet inputs (same helpers the chart aggregation uses).
    const ivs = trialInterventions(r);
    const primaryDomains = primaryDomainsOf(r);
    const facets = buildFacetInput({
      interventions: ivs,
      symptomDomains: primaryDomains,
      countries: r.study_design.countries ?? [],
      designType: r.study_design.design_type ?? "unknown",
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
    let nPositive = 0;
    let nNegativeNs = 0;
    let nUnknown = 0;

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
      // Classify outcome significance
      const bge = o.between_group_effects?.[0];
      const bgePVal = numericOrNull(bge?.p_value);
      const bgeEVal = numericOrNull(bge?.effect_value);
      if (!bge || bgePVal == null || bgeEVal == null) {
        nUnknown++;
      } else if (bgePVal < 0.05) {
        // Significant — check direction
        const hib = o.higher_is_better;
        if (hib === true && bgeEVal > 0) nPositive++;
        else if (hib === false && bgeEVal < 0) nPositive++;
        else if (hib == null) nPositive++; // assume significant = positive if direction unknown
        else nNegativeNs++;
      } else {
        nNegativeNs++;
      }
    }

    const nOutcomes = (r.outcomes ?? []).length;

    return {
      paper_id: r.paper_id,
      is_rct: r.is_rct ?? false,
      doi_url: `https://doi.org/${r.paper_id}`,
      first_author: doiMetadata[r.paper_id]?.first_author ?? "",
      journal: doiMetadata[r.paper_id]?.journal ?? "",
      design_type: r.study_design.design_type,
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
      n_negative_ns: nNegativeNs,
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

  // ── 3. Trial metadata (lightweight per-record for client-side RCT filtering) ─
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
      design_type: r.study_design.design_type ?? "unknown",
      n_randomized: r.sample_sizes?.n_randomized_total ?? null,
      min_weeks: r.participants?.min_time_since_infection_weeks ?? null,
      year: r.year ?? extractYearFromDOI(r.paper_id),
      n_instruments: instruments.size,
      primary_p_value: primaryPValue,
      facets: buildFacetInput({
        interventions: interventionArms,
        symptomDomains: primarySymptomDomains,
        countries: r.study_design.countries ?? [],
        designType: r.study_design.design_type ?? "unknown",
        blinding: r.study_design.blinding ?? "unknown",
      }),
    };
  });

  // ── 4. Aggregate charts from trialMetas ──────────────────────────
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
        <div className="container mx-auto px-4 py-8 max-w-7xl">
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
