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

function processData() {
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid/long_covid_trial_extractions.jsonl"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = raw
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      all_intervention_names: interventionArms.map((a: any) => a.intervention_name as string),
      intervention_category: interventionCategory,
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
    const rawArms = r.study_design.arms
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) => a.type === "intervention");
    // Use the consolidated `interventions` field, splitting comma-separated lists
    const rawLabel = r.interventions;
    const defaultCategory = rawArms[0]?.intervention_category ?? "unknown";
    let interventionArms: { category: string; name: string }[];
    if (rawLabel && rawLabel !== "Unknown") {
      const names = rawLabel.split(",").map((s: string) => s.trim()).filter(Boolean);
      interventionArms = names.map((name: string) => {
        // Try to match to an arm by name similarity for category
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchedArm = rawArms.find((a: any) =>
          a.intervention_name?.toLowerCase().includes(name.toLowerCase().split(" ")[0])
        );
        return { category: matchedArm?.intervention_category ?? defaultCategory, name };
      });
    } else {
      interventionArms = rawArms.length > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? rawArms.map((a: any) => ({ category: a.intervention_category ?? "unknown", name: a.intervention_name ?? "unknown" }))
        : [{ category: "unknown", name: "unknown" }];
    }
    const primarySymptomDomains: string[] = [];
    let primaryPValue: number | null = null;
    for (const o of r.outcomes ?? []) {
      if (o.is_primary && o.symptom_domain) primarySymptomDomains.push(o.symptom_domain);
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
      primarySymptomDomains: [...new Set(primarySymptomDomains)],
      rob_overall: r.risk_of_bias?.overall_judgment ?? "unknown",
      blinding: r.study_design.blinding ?? "unknown",
      design_type: r.study_design.design_type ?? "unknown",
      n_randomized: r.sample_sizes?.n_randomized_total ?? null,
      min_weeks: r.participants?.min_time_since_infection_weeks ?? null,
      year: r.year ?? extractYearFromDOI(r.paper_id),
      n_instruments: instruments.size,
      primary_p_value: primaryPValue,
    };
  });

  // ── 4. Aggregate charts from trialMetas ──────────────────────────
  const aggregated = aggregateFromMetas(trialMetas);

  return {
    // Use server-accurate summary stats (instrument count uses Set dedup)
    summaryStats,
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
