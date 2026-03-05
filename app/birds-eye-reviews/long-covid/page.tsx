import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { LongCovidDashboard } from "./LongCovidDashboard";
import type {
  SummaryStats,
  InterventionBar,
  SymptomBar,
  HeatmapCell,
  CountryBar,
  YearBar,
  ForestRow,
  BlindingSignificanceBar,
  LcDefinitionBin,
  TrialTableRow,
} from "./types";

export const metadata = {
  title: "Long Covid Clinical Trials | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Interactive dashboard of 339 clinical trials on Long Covid interventions — evidence landscape, effect sizes, metascience analysis, and trial-level detail.",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function processData() {
  const filePath = path.join(
    process.cwd(),
    "data/birds_eye_reviews/long_covid_trial_extractions.jsonl"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  const records: any[] = raw
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

  // ── 1. Summary stats ─────────────────────────────────────────────
  const allCountries = new Set<string>();
  const allCategories = new Set<string>();
  const allInstruments = new Set<string>();
  let totalParticipants = 0;

  for (const r of records) {
    for (const c of r.study_design.countries ?? []) allCountries.add(c);
    for (const arm of r.study_design.arms) {
      if (arm.type === "intervention") allCategories.add(arm.intervention_category);
    }
    for (const o of r.outcomes ?? []) {
      if (o.measurement_instrument) allInstruments.add(o.measurement_instrument);
    }
    if (r.sample_sizes?.n_randomized_total) totalParticipants += r.sample_sizes.n_randomized_total;
  }

  const summaryStats: SummaryStats = {
    totalTrials: records.length,
    totalParticipants,
    nCountries: allCountries.size,
    nInterventionCategories: allCategories.size,
    nInstruments: allInstruments.size,
  };

  // ── 2. By intervention (stacked by individual intervention names) ─
  const interventionMap = new Map<string, Map<string, number>>();
  for (const r of records) {
    for (const arm of r.study_design.arms) {
      if (arm.type !== "intervention") continue;
      const cat = arm.intervention_category;
      const name = arm.intervention_name;
      if (!interventionMap.has(cat)) interventionMap.set(cat, new Map());
      const nameMap = interventionMap.get(cat)!;
      nameMap.set(name, (nameMap.get(name) ?? 0) + 1);
    }
  }
  const byIntervention: InterventionBar[] = [...interventionMap.entries()]
    .map(([category, nameMap]) => ({
      category,
      count: [...nameMap.values()].reduce((a, b) => a + b, 0),
      interventions: [...nameMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);

  // ── 3. By symptom domain (primary outcomes) ──────────────────────
  const symptomMap = new Map<string, number>();
  for (const r of records) {
    const domains = new Set<string>();
    for (const o of r.outcomes ?? []) {
      if (o.is_primary && o.symptom_domain) domains.add(o.symptom_domain);
    }
    for (const d of domains) symptomMap.set(d, (symptomMap.get(d) ?? 0) + 1);
  }
  const bySymptom: SymptomBar[] = [...symptomMap.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  // ── 4. Heatmap (intervention × symptom) ──────────────────────────
  const heatKey = (i: string, s: string) => `${i}|||${s}`;
  const heatMap = new Map<string, { count: number; low: number; some_concerns: number; high: number }>();
  for (const r of records) {
    const rob = r.risk_of_bias?.overall_judgment ?? "unknown";
    const cats = new Set<string>();
    for (const arm of r.study_design.arms) {
      if (arm.type === "intervention") cats.add(arm.intervention_category);
    }
    const domains = new Set<string>();
    for (const o of r.outcomes ?? []) {
      if (o.is_primary && o.symptom_domain) domains.add(o.symptom_domain);
    }
    for (const cat of cats) {
      for (const dom of domains) {
        const k = heatKey(cat, dom);
        const entry = heatMap.get(k) ?? { count: 0, low: 0, some_concerns: 0, high: 0 };
        entry.count++;
        if (rob === "low") entry.low++;
        else if (rob === "some_concerns") entry.some_concerns++;
        else if (rob === "high") entry.high++;
        heatMap.set(k, entry);
      }
    }
  }
  const heatmapData: HeatmapCell[] = [...heatMap.entries()].map(([k, d]) => {
    const [intervention, symptom] = k.split("|||");
    return { intervention, symptom, ...d };
  });

  // ── 5. Top countries ─────────────────────────────────────────────
  const countryMap = new Map<string, number>();
  for (const r of records) {
    for (const c of r.study_design.countries ?? []) {
      countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
    }
  }
  const sortedCountries = [...countryMap.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
  const top15 = sortedCountries.slice(0, 15);
  const otherCount = sortedCountries.slice(15).reduce((s, c) => s + c.count, 0);
  const topCountries: CountryBar[] = otherCount > 0
    ? [...top15, { country: "Other", count: otherCount }]
    : top15;

  // ── 6. By year ───────────────────────────────────────────────────
  const yearMap = new Map<number, number>();
  for (const r of records) {
    const m = r.paper_id.match(/20[12]\d/);
    if (m) {
      const y = parseInt(m[0]);
      yearMap.set(y, (yearMap.get(y) ?? 0) + 1);
    }
  }
  const byYear: YearBar[] = [...yearMap.entries()]
    .filter(([y]) => y >= 2020)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  // ── 7. Forest data (primary outcomes with between-group effects) ─
  const forestData: ForestRow[] = [];
  for (const r of records) {
    const rob = r.risk_of_bias?.overall_judgment ?? "unknown";
    const interventionArms = r.study_design.arms.filter((a: any) => a.type === "intervention");
    const interventionName = interventionArms[0]?.intervention_name ?? "unknown";
    const interventionCategory = interventionArms[0]?.intervention_category ?? "unknown";

    for (const o of r.outcomes ?? []) {
      if (!o.is_primary) continue;
      for (const bge of o.between_group_effects ?? []) {
        if (bge.effect_value != null && bge.ci_95_low != null && bge.ci_95_high != null) {
          forestData.push({
            paper_id: r.paper_id,
            intervention_name: interventionName,
            intervention_category: interventionCategory,
            symptom_domain: o.symptom_domain ?? "unknown",
            instrument: o.measurement_instrument ?? "unknown",
            effect_measure: bge.effect_measure ?? "unknown",
            effect_value: bge.effect_value,
            ci_95_low: bge.ci_95_low,
            ci_95_high: bge.ci_95_high,
            rob_overall: rob,
            n_randomized: r.sample_sizes?.n_randomized_total ?? 0,
            blinding: r.study_design.blinding ?? "unknown",
            higher_is_better: o.higher_is_better ?? null,
          });
          break; // take first valid effect per outcome
        }
      }
      break; // only primary outcome
    }
  }

  // ── 8. Blinding × significance ────────────────────────────────
  const blindSigMap = new Map<string, { significant: number; not_significant: number }>();
  for (const r of records) {
    const blind = r.study_design.blinding ?? "unknown";
    for (const o of r.outcomes ?? []) {
      if (!o.is_primary) continue;
      const bge = o.between_group_effects?.[0];
      if (bge?.p_value != null) {
        const entry = blindSigMap.get(blind) ?? { significant: 0, not_significant: 0 };
        if (bge.p_value < 0.05) entry.significant++;
        else entry.not_significant++;
        blindSigMap.set(blind, entry);
      }
      break;
    }
  }
  const blindingBySignificance: BlindingSignificanceBar[] = [
    "double-blind",
    "single-blind",
    "open-label",
  ]
    .filter((b) => blindSigMap.has(b))
    .map((blinding) => ({ blinding, ...blindSigMap.get(blinding)! }));

  // ── 9. LC definition histogram ────────────────────────────────
  const weeksBins = [0, 4, 8, 12, 16, 24, 52, Infinity];
  const binLabels = ["0–4", "4–8", "8–12", "12–16", "16–24", "24–52", "52+"];
  const binCounts = new Array(binLabels.length).fill(0);
  let lcDefTotal = 0;
  let lcDef12Plus = 0;
  for (const r of records) {
    const minW = r.participants?.min_time_since_infection_weeks;
    if (minW != null) {
      lcDefTotal++;
      if (minW >= 12) lcDef12Plus++;
      for (let i = 0; i < weeksBins.length - 1; i++) {
        if (minW >= weeksBins[i] && minW < weeksBins[i + 1]) {
          binCounts[i]++;
          break;
        }
      }
    }
  }
  const lcDefinitionHist: LcDefinitionBin[] = binLabels.map((label, i) => ({
    label,
    count: binCounts[i],
  }));
  const lcDefPct12Plus = lcDefTotal > 0 ? Math.round((lcDef12Plus / lcDefTotal) * 100) : 0;

  // ── 10. Trial table rows ───────────────────────────────────────
  const tableRows: TrialTableRow[] = records.map((r) => {
    const interventionArms = r.study_design.arms.filter((a: any) => a.type === "intervention");
    const interventionName = interventionArms[0]?.intervention_name ?? "unknown";
    const interventionCategory = interventionArms[0]?.intervention_category ?? "unknown";

    let primarySymptomDomain = "";
    let primaryOutcomeName = "";
    let primaryEffectValue: number | null = null;
    let primaryCiLow: number | null = null;
    let primaryCiHigh: number | null = null;
    let primaryPValue: number | null = null;
    let primaryHigherIsBetter: boolean | null = null;
    const outcomesSummary: string[] = [];
    let nPositive = 0;
    let nNegativeNs = 0;
    let nUnknown = 0;

    for (const o of r.outcomes ?? []) {
      outcomesSummary.push(o.name);
      if (o.is_primary && !primaryOutcomeName) {
        primarySymptomDomain = o.symptom_domain ?? "";
        primaryOutcomeName = o.name ?? "";
        primaryHigherIsBetter = o.higher_is_better ?? null;
        const bge = o.between_group_effects?.[0];
        if (bge) {
          primaryEffectValue = bge.effect_value ?? null;
          primaryCiLow = bge.ci_95_low ?? null;
          primaryCiHigh = bge.ci_95_high ?? null;
          primaryPValue = bge.p_value ?? null;
        }
      }
      // Classify outcome significance
      const bge = o.between_group_effects?.[0];
      if (!bge || bge.p_value == null || bge.effect_value == null) {
        nUnknown++;
      } else if (bge.p_value < 0.05) {
        // Significant — check direction
        const hib = o.higher_is_better;
        if (hib === true && bge.effect_value > 0) nPositive++;
        else if (hib === false && bge.effect_value < 0) nPositive++;
        else if (hib == null) nPositive++; // assume significant = positive if direction unknown
        else nNegativeNs++;
      } else {
        nNegativeNs++;
      }
    }

    const nOutcomes = (r.outcomes ?? []).length;

    return {
      paper_id: r.paper_id,
      doi_url: `https://doi.org/${r.paper_id}`,
      design_type: r.study_design.design_type,
      intervention_name: interventionName,
      intervention_category: interventionCategory,
      blinding: r.study_design.blinding ?? "unknown",
      n_randomized: r.sample_sizes?.n_randomized_total ?? null,
      primary_symptom_domain: primarySymptomDomain,
      primary_outcome_name: primaryOutcomeName,
      primary_effect_value: primaryEffectValue,
      primary_ci_low: primaryCiLow,
      primary_ci_high: primaryCiHigh,
      primary_p_value: primaryPValue,
      primary_higher_is_better: primaryHigherIsBetter,
      countries: r.study_design.countries ?? [],
      rob_overall: r.risk_of_bias?.overall_judgment ?? "unknown",
      follow_up_weeks: r.follow_up?.total_duration_weeks ?? null,
      long_covid_definition: r.participants?.long_covid_definition ?? "",
      outcomes_summary: outcomesSummary,
      n_outcomes: nOutcomes,
      n_positive: nPositive,
      n_negative_ns: nNegativeNs,
      n_unknown: nUnknown,
    };
  });

  return {
    summaryStats,
    byIntervention,
    bySymptom,
    heatmapData,
    topCountries,
    byYear,
    forestData,
    blindingBySignificance,
    lcDefinitionHist,
    lcDefPct12Plus,
    tableRows,
  };
}

export default function LongCovidReviewPage() {
  const data = processData();

  return (
    <div className="min-h-screen">
      <BirdsEyeNavbar />
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
