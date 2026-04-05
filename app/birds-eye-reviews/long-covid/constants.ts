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

  // By intervention
  const interventionMap = new Map<string, Map<string, number>>();
  for (const m of metas) {
    for (const a of m.interventionArms) {
      if (!interventionMap.has(a.category)) interventionMap.set(a.category, new Map());
      const nameMap = interventionMap.get(a.category)!;
      nameMap.set(a.name, (nameMap.get(a.name) ?? 0) + 1);
    }
  }
  const byIntervention: InterventionBar[] = [...interventionMap.entries()]
    .map(([category, nameMap]) => ({
      category,
      count: [...nameMap.values()].reduce((a, b) => a + b, 0),
      interventions: [...nameMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.count - a.count);

  // By symptom
  const symptomMap = new Map<string, number>();
  for (const m of metas) {
    for (const d of m.primarySymptomDomains) symptomMap.set(d, (symptomMap.get(d) ?? 0) + 1);
  }
  const bySymptom: SymptomBar[] = [...symptomMap.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  // Heatmap
  const heatMap = new Map<string, { count: number; low: number; some_concerns: number; high: number }>();
  for (const m of metas) {
    const cats = new Set(m.interventionArms.map((a) => a.category));
    for (const cat of cats) {
      for (const dom of m.primarySymptomDomains) {
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

  // Countries
  const countryMap = new Map<string, number>();
  for (const m of metas) {
    for (const c of m.countries) countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
  }
  const allCountries: CountryBar[] = [...countryMap.entries()]
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

  // Blinding × significance
  const blindSigMap = new Map<string, { significant: number; not_significant: number }>();
  for (const m of metas) {
    if (m.primary_p_value != null) {
      const entry = blindSigMap.get(m.blinding) ?? { significant: 0, not_significant: 0 };
      if (m.primary_p_value < 0.05) entry.significant++;
      else entry.not_significant++;
      blindSigMap.set(m.blinding, entry);
    }
  }
  const blindingBySignificance: BlindingSignificanceBar[] = BLINDING_ORDER
    .filter((b) => blindSigMap.has(b))
    .map((blinding) => ({ blinding, ...blindSigMap.get(blinding)! }));

  // By design type
  const designTypeMap = new Map<string, number>();
  for (const m of metas) {
    designTypeMap.set(m.design_type, (designTypeMap.get(m.design_type) ?? 0) + 1);
  }
  const byDesignType: DesignTypeBar[] = [...designTypeMap.entries()]
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
