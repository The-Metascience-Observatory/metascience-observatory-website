import type {
  InterventionBar,
  SymptomBar,
  HeatmapCell,
  CountryBar,
  YearBar,
  BlindingSignificanceBar,
  DesignTypeBar,
  LcDefinitionBin,
  SummaryStats,
  TrialMeta,
} from "./types";
import { countDistinctTrials } from "./facets";

// ── Shared constants ─────────────────────────────────────────────────

export const LC_WEEKS_BINS = [0, 4, 8, 12, 16, 20, 24, 36, 52, Infinity];
export const LC_BIN_LABELS = ["0–4", "4–8", "8–12", "12–16", "16–20", "20–24", "24–36", "36–52", "52+"];

/** Labels for bins that meet the WHO ≥12 weeks definition */
export const LC_WHO_BIN_LABELS = ["12–16", "16–20", "20–24", "24–36", "36–52", "52+"];

export const BLINDING_ORDER = ["double-blind", "single-blind", "open-label"];

/** Keywords identifying control arms */
export const CONTROL_KEYWORDS = [
  "placebo", "control", "usual care", "standard care",
  "waitlist", "wait-list", "sham", "no treatment", "no intervention",
];

// ── Shared helpers ───────────────────────────────────────────────────

export function extractYearFromDOI(doi: string): number | null {
  const m = doi.match(/20[12]\d/);
  return m ? parseInt(m[0]) : null;
}

export function getPromiseScoreColors(score: number): { bg: string; text: string } {
  if (score >= 0.6) return { bg: "#22c55e20", text: "#16a34a" };
  if (score >= 0.3) return { bg: "#f59e0b20", text: "#d97706" };
  return { bg: "#94a3b820", text: "#64748b" };
}

// ── Shared aggregation ───────────────────────────────────────────────

export interface AggregatedData {
  summaryStats: SummaryStats;
  byIntervention: InterventionBar[];
  bySymptom: SymptomBar[];
  heatmapData: HeatmapCell[];
  allCountries: CountryBar[];
  byYear: YearBar[];
  blindingBySignificance: BlindingSignificanceBar[];
  byDesignType: DesignTypeBar[];
  lcDefinitionHist: LcDefinitionBin[];
  lcDefPct12Plus: number;
}

export function aggregateFromMetas(metas: TrialMeta[]): AggregatedData {
  // Summary stats
  const allCountriesSet = new Set<string>();
  const allCategories = new Set<string>();
  let totalParticipants = 0;
  let nInstruments = 0;
  for (const m of metas) {
    for (const c of m.countries) allCountriesSet.add(c);
    for (const a of m.interventionArms) allCategories.add(a.category);
    if (m.n_randomized) totalParticipants += m.n_randomized;
    nInstruments += m.n_instruments;
  }
  const summaryStats: SummaryStats = {
    totalTrials: metas.length,
    totalParticipants,
    nCountries: allCountriesSet.size,
    nInterventionCategories: allCategories.size,
    nInstruments,
  };

  // By intervention — counts via the shared facet counter (one distinct trial per
  // intervention name), so the bar number equals the table-filter row count. The
  // displayed category is taken from the first trial reporting the name (display
  // only — counting and filtering go through facets, never the category).
  const ivCounts = countDistinctTrials(metas, "intervention");
  const ivCat = new Map<string, string>();
  for (const m of metas) {
    for (const a of m.interventionArms) if (!ivCat.has(a.name)) ivCat.set(a.name, a.category);
  }
  const byIntervention: InterventionBar[] = [...ivCounts.entries()]
    .map(([name, count]) => ({ name, count, category: ivCat.get(name) ?? "unknown" }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // By symptom — distinct trials per primary domain (a trial with N primary
  // domains is counted in each; the table filter matches the same list).
  const bySymptom: SymptomBar[] = [...countDistinctTrials(metas, "symptomDomain").entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  // Heatmap (category × primary-domain). Cell count = trials whose facet category
  // list includes the category AND whose primary-domain list includes the domain;
  // the cell-click filter matches the same two lists (see LongCovidDashboard).
  const heatMap = new Map<string, { count: number; low: number; some_concerns: number; high: number }>();
  for (const m of metas) {
    const cats = new Set(m.facets.interventionCategories);
    for (const cat of cats) {
      for (const dom of m.facets.symptomDomains) {
        const k = `${cat}|||${dom}`;
        const entry = heatMap.get(k) ?? { count: 0, low: 0, some_concerns: 0, high: 0 };
        entry.count++;
        if (m.rob_overall === "low") entry.low++;
        else if (m.rob_overall === "some_concerns") entry.some_concerns++;
        else if (m.rob_overall === "high") entry.high++;
        heatMap.set(k, entry);
      }
    }
  }
  const heatmapData: HeatmapCell[] = [...heatMap.entries()].map(([k, d]) => {
    const [intervention, symptom] = k.split("|||");
    return { intervention, symptom, ...d };
  });

  // Countries — distinct trials per country (matches countries.includes filter)
  const allCountries: CountryBar[] = [...countDistinctTrials(metas, "country").entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  // By year
  const yearMap = new Map<number, number>();
  for (const m of metas) {
    const yr = typeof m.year === "string" ? parseInt(m.year, 10) : m.year;
    if (yr && yr >= 2020) yearMap.set(yr, (yearMap.get(yr) ?? 0) + 1);
  }
  const byYear: YearBar[] = [...yearMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  // Blinding × significance — every trial is represented: trials with no primary
  // p-value fall in `unknown`, so a bar's total (sig+nonsig+unknown) equals the
  // trials with that blinding, which equals the table-filter result on click.
  const blindSigMap = new Map<string, { significant: number; not_significant: number; unknown: number }>();
  for (const m of metas) {
    const entry = blindSigMap.get(m.blinding) ?? { significant: 0, not_significant: 0, unknown: 0 };
    if (m.primary_p_value == null) entry.unknown++;
    else if (m.primary_p_value < 0.05) entry.significant++;
    else entry.not_significant++;
    blindSigMap.set(m.blinding, entry);
  }
  const blindingBySignificance: BlindingSignificanceBar[] = BLINDING_ORDER
    .filter((b) => blindSigMap.has(b))
    .map((blinding) => ({ blinding, ...blindSigMap.get(blinding)! }));

  // By design type — distinct trials per design (single-valued; matches filter)
  const byDesignType: DesignTypeBar[] = [...countDistinctTrials(metas, "designType").entries()]
    .map(([design_type, count]) => ({ design_type, count }))
    .sort((a, b) => b.count - a.count);

  // LC definition histogram
  const binCounts = new Array(LC_BIN_LABELS.length).fill(0);
  let lcDefTotal = 0;
  let lcDef12Plus = 0;
  for (const m of metas) {
    if (m.min_weeks != null) {
      lcDefTotal++;
      if (m.min_weeks >= 12) lcDef12Plus++;
      for (let i = 0; i < LC_WEEKS_BINS.length - 1; i++) {
        if (m.min_weeks >= LC_WEEKS_BINS[i] && m.min_weeks < LC_WEEKS_BINS[i + 1]) {
          binCounts[i]++;
          break;
        }
      }
    }
  }
  const lcDefinitionHist: LcDefinitionBin[] = LC_BIN_LABELS.map((label, i) => ({
    label,
    count: binCounts[i],
  }));
  const lcDefPct12Plus = lcDefTotal > 0 ? Math.round((lcDef12Plus / lcDefTotal) * 100) : 0;

  return { summaryStats, byIntervention, bySymptom, heatmapData, allCountries, byYear, blindingBySignificance, byDesignType, lcDefinitionHist, lcDefPct12Plus };
}
