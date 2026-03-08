"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  CartesianGrid,
} from "recharts";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import type { DashboardProps, InterventionBar, TrialTableRow, TrialMeta, SummaryStats, SymptomBar, HeatmapCell, CountryBar, YearBar, BlindingSignificanceBar, LcDefinitionBin } from "./types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COUNTRY_NAME_MAPPING: Record<string, string> = {
  "United States": "United States of America",
  "Czech Republic": "Czechia",
};

// Reverse: map geo name → data name (for click filtering)
const REVERSE_COUNTRY_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAME_MAPPING).map(([data, geo]) => [geo, data])
);

// ── Color constants ──────────────────────────────────────────────────
const ROB_COLORS = {
  low: "#22c55e",
  some_concerns: "#f59e0b",
  high: "#ef4444",
};

const CATEGORY_COLORS: Record<string, string> = {
  rehabilitation: "#3b82f6",
  supplement: "#8b5cf6",
  exercise: "#14b8a6",
  other: "#6b7280",
  neurostimulation: "#f97316",
  respiratory_therapy: "#06b6d4",
  psychological: "#ec4899",
  device: "#84cc16",
  immunomodulator: "#ef4444",
  oxygen_therapy: "#0ea5e9",
  "anti-inflammatory": "#f43f5e",
  probiotic: "#a855f7",
  antiviral: "#10b981",
  cell_therapy: "#eab308",
};

const ROB_LABELS: Record<string, string> = {
  low: "Low",
  some_concerns: "Some concerns",
  high: "High",
};

const formatCategory = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ── Re-aggregation helper ────────────────────────────────────────────
function recomputeFromMetas(metas: TrialMeta[]) {
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
        .sort((a, b) => b.count - a.count),
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
    if (m.year && m.year >= 2020) yearMap.set(m.year, (yearMap.get(m.year) ?? 0) + 1);
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
  const blindingBySignificance: BlindingSignificanceBar[] = [
    "double-blind", "single-blind", "open-label",
  ]
    .filter((b) => blindSigMap.has(b))
    .map((blinding) => ({ blinding, ...blindSigMap.get(blinding)! }));

  // LC definition histogram
  const weeksBins = [0, 4, 8, 12, 16, 20, 24, 36, 52, Infinity];
  const binLabels = ["0–4", "4–8", "8–12", "12–16", "16–20", "20–24", "24–36", "36–52", "52+"];
  const binCounts = new Array(binLabels.length).fill(0);
  let lcDefTotal = 0;
  let lcDef12Plus = 0;
  for (const m of metas) {
    if (m.min_weeks != null) {
      lcDefTotal++;
      if (m.min_weeks >= 12) lcDef12Plus++;
      for (let i = 0; i < weeksBins.length - 1; i++) {
        if (m.min_weeks >= weeksBins[i] && m.min_weeks < weeksBins[i + 1]) {
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

  return { summaryStats, byIntervention, bySymptom, heatmapData, allCountries, byYear, blindingBySignificance, lcDefinitionHist, lcDefPct12Plus };
}

// ── Main Dashboard ───────────────────────────────────────────────────
export function LongCovidDashboard(props: DashboardProps) {
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [landscapeCategory, setLandscapeCategory] = useState<string | null>(null);
  const [landscapeSymptom, setLandscapeSymptom] = useState<string | null>(null);
  const [interventionCategoryFilter, setInterventionCategoryFilter] = useState<string | null>(null);
  const [interventionNameFilter, setInterventionNameFilter] = useState<string | null>(null);
  const [lcDefFilter, setLcDefFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const clearAllFilters = () => {
    setYearFilter(null);
    setLandscapeCategory(null);
    setLandscapeSymptom(null);
    setInterventionCategoryFilter(null);
    setInterventionNameFilter(null);
    setLcDefFilter(null);
    setCountryFilter(null);
  };

  const scrollToTable = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleYearClick = (year: number) => {
    clearAllFilters();
    setYearFilter(year);
    scrollToTable();
  };

  const handleCellClick = (category: string, symptom: string) => {
    clearAllFilters();
    setLandscapeCategory(category);
    setLandscapeSymptom(symptom);
    scrollToTable();
  };

  const handleInterventionClick = (interventionName: string) => {
    clearAllFilters();
    setInterventionNameFilter(interventionName);
    scrollToTable();
  };

  const handleCategoryClick = (category: string) => {
    clearAllFilters();
    setInterventionCategoryFilter(category);
    scrollToTable();
  };

  const handleLcDefClick = (binLabel: string) => {
    clearAllFilters();
    setLcDefFilter(binLabel);
    scrollToTable();
  };

  const handleCountryClick = (country: string) => {
    clearAllFilters();
    setCountryFilter(country);
    scrollToTable();
  };

  const [rctOnly, setRctOnly] = useState(true);

  // Recompute aggregated data when RCT filter is toggled
  const filteredMetas = useMemo(
    () => (rctOnly ? props.trialMetas.filter((m) => m.is_rct) : props.trialMetas),
    [rctOnly, props.trialMetas]
  );
  const recomputed = useMemo(() => recomputeFromMetas(filteredMetas), [filteredMetas]);

  const effectiveProps: DashboardProps = useMemo(() => {
    if (!rctOnly) return props;
    return {
      ...props,
      summaryStats: recomputed.summaryStats,
      byIntervention: recomputed.byIntervention,
      bySymptom: recomputed.bySymptom,
      heatmapData: recomputed.heatmapData,
      allCountries: recomputed.allCountries,
      topCountries: recomputed.allCountries,
      byYear: recomputed.byYear,
      blindingBySignificance: recomputed.blindingBySignificance,
      lcDefinitionHist: recomputed.lcDefinitionHist,
      lcDefPct12Plus: recomputed.lcDefPct12Plus,
      tableRows: props.tableRows.filter((r) => r.is_rct),
    };
  }, [rctOnly, props, recomputed]);

  const rctCount = useMemo(
    () => props.trialMetas.filter((m) => m.is_rct).length,
    [props.trialMetas]
  );

  return (
    <div>
      {/* Hero */}
      <h1 className="font-clarendon font-bold text-3xl mb-2">Long Covid Clinical Trials</h1>
      <p className="text-foreground/70 text-lg mb-2">
        A bird&apos;s eye view of {effectiveProps.summaryStats.totalTrials} clinical trials testing
        interventions for Long Covid.
      </p>
      <Link
        href="/birds-eye-reviews/long-covid/screening"
        className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
      >
        View full breakdown of Long COVID articles &rarr;
      </Link>

      {/* RCT Filter Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setRctOnly((v) => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${rctOnly
            ? "bg-blue-600 text-white border-blue-600 shadow-md"
            : "bg-background text-foreground/70 border-border hover:border-foreground/30 hover:text-foreground"
            }`}
        >
          <span
            className={`inline-flex items-center justify-center w-4 h-4 rounded border transition-colors ${rctOnly ? "bg-white border-white" : "border-foreground/30"
              }`}
          >
            {rctOnly && (
              <svg viewBox="0 0 12 12" className="w-3 h-3 text-blue-600">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          Filter to RCTs only
          <span className={`text-xs ${rctOnly ? "text-blue-200" : "text-foreground/40"}`}>
            ({rctCount} of {props.summaryStats.totalTrials})
          </span>
        </button>
      </div>

      <OverviewTab {...effectiveProps} onYearClick={handleYearClick} onCellClick={handleCellClick} onInterventionClick={handleInterventionClick} onCategoryClick={handleCategoryClick} onLcDefClick={handleLcDefClick} onCountryClick={handleCountryClick} />
      {/* Trial table — always visible at the bottom */}
      <div className="mt-12 border-t border-border pt-8" ref={tableRef}>
        <h2 className="font-clarendon font-bold text-2xl mb-4">All Trials</h2>
        <TrialTableTab
          tableRows={effectiveProps.tableRows}
          yearFilter={yearFilter}
          onYearClear={() => setYearFilter(null)}
          interventionCategoryFilter={interventionCategoryFilter}
          onInterventionCategoryClear={() => setInterventionCategoryFilter(null)}
          interventionNameFilter={interventionNameFilter}
          onInterventionNameClear={() => setInterventionNameFilter(null)}
          lcDefFilter={lcDefFilter}
          onLcDefClear={() => setLcDefFilter(null)}
          countryFilter={countryFilter}
          onCountryClear={() => setCountryFilter(null)}
          landscapeCategory={landscapeCategory}
          landscapeSymptom={landscapeSymptom}
          onLandscapeCategoryClear={() => setLandscapeCategory(null)}
          onLandscapeSymptomClear={() => setLandscapeSymptom(null)}
        />
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────
function OverviewTab(props: DashboardProps & { onYearClick?: (year: number) => void; onCellClick?: (category: string, symptom: string) => void; onInterventionClick?: (interventionName: string) => void; onCategoryClick?: (category: string) => void; onLcDefClick?: (binLabel: string) => void; onCountryClick?: (country: string) => void }) {
  return (
    <div className="space-y-10">
      {/* Timeline + Country map side by side */}
      <div className="grid md:grid-cols-2 gap-8">
        <ChartSection title="Trials by publication year">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={props.byYear} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar
                dataKey="count"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
                style={{ cursor: "pointer" }}
                onClick={(data) => {
                  if (data && data.year && props.onYearClick) {
                    props.onYearClick(data.year);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Trials by country">
          <CountryMap topCountries={props.allCountries} onCountryClick={props.onCountryClick} />
        </ChartSection>
      </div>

      {/* LC definition variability */}
      <ChartSection
        title="Long Covid definition variability"
        subtitle={`Only ${props.lcDefPct12Plus}% of trials require symptoms persisting ≥12 weeks (WHO standard)`}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={props.lcDefinitionHist}
            margin={{ left: 25, right: 20, top: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="label"
              label={{ value: "Min weeks since infection", position: "bottom", offset: 0, fontSize: 12 }}
            />
            <YAxis label={{ value: "Trials", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip cursor={{ fill: 'transparent' }} />
            <Bar
              dataKey="count"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              style={{ cursor: "pointer" }}
              onClick={(data) => {
                if (data && data.label && props.onLcDefClick) {
                  props.onLcDefClick(data.label);
                }
              }}
            >
              {props.lcDefinitionHist.map((entry, i) => {
                const meetsWho = ["12–16", "16–20", "20–24", "24–36", "36–52", "52+"].includes(entry.label);
                return (
                  <Cell
                    key={i}
                    fill={meetsWho ? "#22c55e" : "#ef4444"}
                    opacity={0.8}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="text-xs text-foreground/50 mt-2">
          <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: "#22c55e" }} />
          Meets WHO definition (≥12 weeks)
          <span className="inline-block w-3 h-3 rounded-sm mr-1 ml-3" style={{ backgroundColor: "#ef4444" }} />
          Below WHO threshold
        </div>
      </ChartSection>

      {/* Trials by intervention category */}
      <ChartSection title="Trials by intervention category" subtitle="Each segment is one intervention — hover for name, click to filter table">
        <InterventionStackedBar data={props.byIntervention} onInterventionClick={props.onInterventionClick} onCategoryClick={props.onCategoryClick} />
      </ChartSection>

      {/* Trials by symptom domain */}
      <ChartSection title="Trials by primary symptom domain">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={props.bySymptom}
            layout="vertical"
            margin={{ left: 120, right: 20, top: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" />
            <YAxis type="category" dataKey="domain" tickFormatter={formatCategory} width={115} fontSize={12} />
            <Tooltip labelFormatter={formatCategory} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Heatmap */}
      <ChartSection
        title="Trial landscape"
        subtitle="Intervention category × symptom domain (cell = number of trials)"
      >
        <Heatmap data={props.heatmapData} onCellClick={props.onCellClick} />
      </ChartSection>

      {/* Blinding × Significance */}
      <ChartSection
        title="Blinding type vs. statistical significance"
        subtitle="Open-label trials tend to report more positive results"
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={props.blindingBySignificance}
            margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="blinding" tickFormatter={formatCategory} />
            <YAxis />
            <Tooltip
              labelFormatter={formatCategory}
              formatter={(val: number, name: string) => {
                const label = name === "significant" ? "Significant (p < 0.05)" : "Not significant";
                return [val, label];
              }}
            />
            <Legend
              formatter={(v) =>
                v === "significant" ? "Significant (p < 0.05)" : "Not significant"
              }
            />
            <Bar dataKey="significant" fill="#ef4444" />
            <Bar dataKey="not_significant" fill="#94a3b8" />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>
    </div>
  );
}

// ── Heatmap ──────────────────────────────────────────────────────────
function Heatmap({ data, onCellClick }: { data: DashboardProps["heatmapData"]; onCellClick?: (category: string, symptom: string) => void }) {
  const interventions = useMemo(
    () => [...new Set(data.map((d) => d.intervention))].sort(),
    [data]
  );
  const symptoms = useMemo(
    () => [...new Set(data.map((d) => d.symptom))].sort(),
    [data]
  );
  const lookup = useMemo(() => {
    const m = new Map<string, (typeof data)[0]>();
    for (const d of data) m.set(`${d.intervention}|||${d.symptom}`, d);
    return m;
  }, [data]);
  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left font-medium text-foreground/60 min-w-[120px]" />
            {symptoms.map((s) => (
              <th
                key={s}
                className="p-2 text-center font-medium text-foreground/60 min-w-[70px]"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                {formatCategory(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {interventions.map((intv) => (
            <tr key={intv}>
              <td className="p-2 font-medium text-foreground/80 whitespace-nowrap">
                {formatCategory(intv)}
              </td>
              {symptoms.map((sym) => {
                const cell = lookup.get(`${intv}|||${sym}`);
                const count = cell?.count ?? 0;
                const opacity = count > 0 ? 0.15 + (count / maxCount) * 0.85 : 0;
                const highPct =
                  cell && cell.count > 0
                    ? Math.round((cell.high / cell.count) * 100)
                    : 0;
                return (
                  <td
                    key={sym}
                    className={`p-2 text-center border border-border/30${count > 0 && onCellClick ? " cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-inset" : ""}`}
                    style={{
                      backgroundColor: count > 0 ? `rgba(59, 130, 246, ${opacity})` : undefined,
                    }}
                    title={
                      count > 0
                        ? `${count} trials, ${highPct}% high RoB — click to filter table`
                        : "No trials"
                    }
                    onClick={() => {
                      if (count > 0 && onCellClick) onCellClick(intv, sym);
                    }}
                  >
                    {count > 0 ? (
                      <span className={count > 0 ? "font-semibold text-foreground" : ""}>
                        {count}
                      </span>
                    ) : (
                      <span className="text-foreground/20">&ndash;</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── TRIAL TABLE TAB ──────────────────────────────────────────────────
function TrialTableTab({
  tableRows,
  yearFilter,
  onYearClear,
  interventionCategoryFilter,
  onInterventionCategoryClear,
  interventionNameFilter,
  onInterventionNameClear,
  lcDefFilter,
  onLcDefClear,
  countryFilter,
  onCountryClear,
  landscapeCategory,
  landscapeSymptom,
  onLandscapeCategoryClear,
  onLandscapeSymptomClear,
}: {
  tableRows: TrialTableRow[];
  yearFilter: number | null;
  onYearClear: () => void;
  interventionCategoryFilter: string | null;
  onInterventionCategoryClear: () => void;
  interventionNameFilter: string | null;
  onInterventionNameClear: () => void;
  lcDefFilter: string | null;
  onLcDefClear: () => void;
  countryFilter: string | null;
  onCountryClear: () => void;
  landscapeCategory: string | null;
  landscapeSymptom: string | null;
  onLandscapeCategoryClear: () => void;
  onLandscapeSymptomClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [symptomFilter, setSymptomFilter] = useState("all");
  const [robFilter, setRobFilter] = useState("all");
  const [sortField, setSortField] = useState<"n_randomized" | "paper_id" | "intervention_name" | "pct_positive" | "outcome" | "promise_score">(
    "promise_score"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCount, setShowCount] = useState(Infinity);

  const categories = useMemo(
    () => [...new Set(tableRows.map((r) => r.intervention_category))].sort(),
    [tableRows]
  );
  const symptoms = useMemo(
    () => [...new Set(tableRows.map((r) => r.primary_symptom_domain).filter(Boolean))].sort(),
    [tableRows]
  );

  const filtered = useMemo(() => {
    let rows = tableRows;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.intervention_name.toLowerCase().includes(s) ||
          r.paper_id.toLowerCase().includes(s) ||
          r.countries.some((c) => c.toLowerCase().includes(s))
      );
    }
    if (categoryFilter !== "all") rows = rows.filter((r) => r.intervention_category === categoryFilter);
    if (symptomFilter !== "all") rows = rows.filter((r) => r.primary_symptom_domain === symptomFilter);
    if (robFilter !== "all") rows = rows.filter((r) => r.rob_overall === robFilter);
    if (yearFilter !== null) rows = rows.filter((r) => r.year === yearFilter);
    if (interventionCategoryFilter !== null) rows = rows.filter((r) => r.intervention_category === interventionCategoryFilter);
    if (interventionNameFilter !== null) rows = rows.filter((r) => r.all_intervention_names.includes(interventionNameFilter));
    if (lcDefFilter !== null) {
      const lcBins: [string, number, number][] = [
        ["0–4", 0, 4], ["4–8", 4, 8], ["8–12", 8, 12], ["12–16", 12, 16],
        ["16–20", 16, 20], ["20–24", 20, 24], ["24–36", 24, 36], ["36–52", 36, 52], ["52+", 52, Infinity],
      ];
      const bin = lcBins.find(([l]) => l === lcDefFilter);
      if (bin) rows = rows.filter((r) => r.min_weeks != null && r.min_weeks >= bin[1] && r.min_weeks < bin[2]);
    }
    if (countryFilter !== null) rows = rows.filter((r) => r.countries.includes(countryFilter));
    if (landscapeCategory !== null) rows = rows.filter((r) => r.intervention_category === landscapeCategory);
    if (landscapeSymptom !== null) rows = rows.filter((r) => r.primary_symptom_domain === landscapeSymptom);
    const outcomeRank = (r: typeof rows[0]): number => {
      const { primary_effect_value: ev, primary_p_value: p, primary_higher_is_better: hib } = r;
      if (ev == null && p == null) return -1;
      const sig = p != null ? p < 0.05 : null;
      let favors: boolean | null = null;
      if (ev != null && hib != null) favors = hib ? ev > 0 : ev < 0;
      if (sig === true && favors === true) return 3;   // Favors intervention
      if (sig === true && favors == null) return 2;    // Significant, direction unknown
      if (sig === false || sig === null) return 1;     // No sig. diff.
      if (sig === true && favors === false) return 0;  // Favors control
      return -1;
    };
    rows = [...rows].sort((a, b) => {
      if (sortField === "pct_positive") {
        const va = a.n_outcomes > 0 ? a.n_positive / a.n_outcomes : -1;
        const vb = b.n_outcomes > 0 ? b.n_positive / b.n_outcomes : -1;
        return sortDir === "asc" ? va - vb : vb - va;
      }
      if (sortField === "outcome") {
        const va = outcomeRank(a);
        const vb = outcomeRank(b);
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      if (typeof va === "string" && typeof vb === "string")
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return rows;
  }, [tableRows, search, categoryFilter, symptomFilter, robFilter, yearFilter, interventionCategoryFilter, interventionNameFilter, lcDefFilter, countryFilter, landscapeCategory, landscapeSymptom, sortField, sortDir]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const visible = filtered.slice(0, showCount);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-foreground/50 block mb-1">Search</label>
          <input
            type="text"
            placeholder="Intervention, DOI, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background w-56"
          />
        </div>
        <FilterSelect
          label="Category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: c, label: formatCategory(c) }))]}
        />
        <FilterSelect
          label="Symptom"
          value={symptomFilter}
          onChange={setSymptomFilter}
          options={[{ value: "all", label: "All" }, ...symptoms.map((s) => ({ value: s, label: formatCategory(s) }))]}
        />
        <FilterSelect
          label="Risk of bias"
          value={robFilter}
          onChange={setRobFilter}
          options={[
            { value: "all", label: "All" },
            { value: "low", label: "Low" },
            { value: "some_concerns", label: "Some concerns" },
            { value: "high", label: "High" },
          ]}
        />
        {yearFilter !== null && (
          <div className="flex flex-col justify-end">
            <span className="text-xs text-foreground/50 block mb-1">Year</span>
            <button
              onClick={onYearClear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm hover:bg-blue-100 transition-colors"
            >
              {yearFilter}
              <span className="text-blue-400 font-bold">&times;</span>
            </button>
          </div>
        )}
        {lcDefFilter !== null && (
          <div className="flex flex-col justify-end">
            <span className="text-xs text-foreground/50 block mb-1">LC definition (weeks)</span>
            <button
              onClick={onLcDefClear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm hover:bg-blue-100 transition-colors"
            >
              {lcDefFilter}
              <span className="text-blue-400 font-bold">&times;</span>
            </button>
          </div>
        )}
        {countryFilter !== null && (
          <div className="flex flex-col justify-end">
            <span className="text-xs text-foreground/50 block mb-1">Country</span>
            <button
              onClick={onCountryClear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm hover:bg-blue-100 transition-colors"
            >
              {countryFilter}
              <span className="text-blue-400 font-bold">&times;</span>
            </button>
          </div>
        )}
        {interventionCategoryFilter !== null && (
          <div className="flex flex-col justify-end">
            <span className="text-xs text-foreground/50 block mb-1">Intervention category</span>
            <button
              onClick={onInterventionCategoryClear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm hover:bg-blue-100 transition-colors"
            >
              {formatCategory(interventionCategoryFilter)}
              <span className="text-blue-400 font-bold">&times;</span>
            </button>
          </div>
        )}
        {interventionNameFilter !== null && (
          <div className="flex flex-col justify-end">
            <span className="text-xs text-foreground/50 block mb-1">Intervention</span>
            <button
              onClick={onInterventionNameClear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm hover:bg-blue-100 transition-colors"
            >
              {formatCategory(interventionNameFilter)}
              <span className="text-blue-400 font-bold">&times;</span>
            </button>
          </div>
        )}
        {landscapeCategory !== null && (
          <div className="flex flex-col justify-end">
            <span className="text-xs text-foreground/50 block mb-1">Intervention (landscape)</span>
            <button
              onClick={onLandscapeCategoryClear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm hover:bg-blue-100 transition-colors"
            >
              {formatCategory(landscapeCategory)}
              <span className="text-blue-400 font-bold">&times;</span>
            </button>
          </div>
        )}
        {landscapeSymptom !== null && (
          <div className="flex flex-col justify-end">
            <span className="text-xs text-foreground/50 block mb-1">Symptom (landscape)</span>
            <button
              onClick={onLandscapeSymptomClear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm hover:bg-blue-100 transition-colors"
            >
              {formatCategory(landscapeSymptom)}
              <span className="text-blue-400 font-bold">&times;</span>
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-foreground/50">{filtered.length} trials match</p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 w-8" />
              <th
                className="p-2 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("paper_id")}
              >
                Reference {sortField === "paper_id" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th
                className="p-2 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("intervention_name")}
              >
                Intervention {sortField === "intervention_name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th
                className="p-2 cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort("n_randomized")}
              >
                N {sortField === "n_randomized" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th
                className="p-2 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("outcome")}
              >
                Primary Outcome {sortField === "outcome" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="p-2 text-right"># Out</th>
              <th className="p-2 text-right" title="Significant in positive direction">+ Sig</th>
              <th className="p-2 text-right" title="Negative or non-significant">− / NS</th>
              <th className="p-2 text-right" title="Unknown significance">Unk</th>
              <th
                className="p-2 cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort("promise_score")}
                title="AI-generated promise score (0–1) based on effect strength, study quality, and source credibility"
              >
                Promise Score {sortField === "promise_score" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="p-2" title="Risk of Bias — assessed using the Cochrane RoB 2 tool, which evaluates potential biases in randomization, deviations from interventions, missing data, outcome measurement, and selective reporting">Risk of Bias</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isExpanded = expanded.has(row.paper_id);
              return (
                <TrialRow
                  key={row.paper_id}
                  row={row}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(row.paper_id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {showCount < filtered.length && (
        <button
          onClick={() => setShowCount((c) => c + 25)}
          className="text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Show more ({filtered.length - showCount} remaining)
        </button>
      )}
    </div>
  );
}

function TrialRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: TrialTableRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-foreground/5 cursor-pointer"
        onClick={onToggle}
      >
        <td className="p-2">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="p-2">
          <a
            href={row.doi_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {row.first_author ? (
              <span>
                {row.first_author} et al.
                {(row.journal || row.year) && ", "}
                {row.journal && <em>{row.journal}</em>}
                {row.journal && row.year ? ", " : ""}
                {row.year && row.year}
              </span>
            ) : (
              <span>{row.paper_id}</span>
            )}
            {" "}<ExternalLink size={10} className="inline align-baseline ml-0.5" />
          </a>
        </td>
        <td className="p-2 max-w-[180px]" title={row.intervention_name}>
          <span className="text-xs leading-tight line-clamp-3">{row.intervention_name}</span>
        </td>
        <td className="p-2 text-right tabular-nums">{row.n_randomized ?? "—"}</td>
        <td className="p-2">
          <div className="flex flex-col gap-0.5 items-start">
            <span className="text-xs text-foreground leading-tight">{row.primary_outcome_name || "—"}</span>
            <OutcomeBadge row={row} />
          </div>
        </td>
        <td className="p-2 text-right tabular-nums text-xs">{row.n_outcomes}</td>
        <td className="p-2 text-right tabular-nums text-xs text-green-600">{row.n_positive || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs">{row.n_negative_ns || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs">{row.n_unknown || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs">
          {row.promise_score != null ? (
            <span
              className="inline-block px-2 py-0.5 rounded font-medium"
              style={{
                backgroundColor: row.promise_score >= 0.6 ? "#22c55e20" : row.promise_score >= 0.3 ? "#f59e0b20" : "#94a3b820",
                color: row.promise_score >= 0.6 ? "#16a34a" : row.promise_score >= 0.3 ? "#d97706" : "#64748b",
              }}
            >
              {row.promise_score.toFixed(1)}
            </span>
          ) : "—"}
        </td>
        <td className="p-2">
          <RobBadge rob={row.rob_overall} />
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border/50">
          <td colSpan={11} className="p-4 bg-foreground/[0.02]">
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="md:col-span-2">
                <DetailLabel>Long Covid definition</DetailLabel>
                <p className="text-foreground/70">{row.long_covid_definition || "Not specified"}</p>
              </div>
              {row.summary && (
                <div className="md:col-span-2">
                  <DetailLabel>AI Summary (Sonnet 4.6)</DetailLabel>
                  <p className="text-foreground leading-relaxed">{row.summary}</p>
                </div>
              )}
              <div>
                <DetailLabel>Primary outcome</DetailLabel>
                <p>{row.primary_outcome_name || "Not specified"}</p>
                {row.primary_effect_value != null && (
                  <p className="mt-1">
                    {row.primary_effect_measure
                      ? row.primary_effect_measure === "smd" ? "SMD"
                      : formatCategory(row.primary_effect_measure)
                      : "Effect"}: <strong>{row.primary_effect_value.toFixed(2)}</strong>
                    {row.primary_ci_low != null && row.primary_ci_high != null && (
                      <> [95% CI: {row.primary_ci_low.toFixed(2)}, {row.primary_ci_high.toFixed(2)}]</>
                    )}
                    {row.primary_p_value != null && (
                      <>, p = {row.primary_p_value < 0.001 ? "<0.001" : row.primary_p_value.toFixed(3)}</>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-6 flex-wrap">
                <div>
                  <DetailLabel>Blinding</DetailLabel>
                  <p>{formatCategory(row.blinding)}</p>
                </div>
                <div>
                  <DetailLabel>Follow-up</DetailLabel>
                  <p>{row.follow_up_weeks != null ? `${row.follow_up_weeks} weeks` : "Not reported"}</p>
                </div>
                {(() => {
                  const treatment = row.arm_samples.filter((a) => !a.is_control);
                  const control = row.arm_samples.filter((a) => a.is_control);
                  return (
                    <>
                      {treatment.length > 0 && (
                        <div className="flex gap-4">
                          {treatment.map((a, i) => (
                            <div key={i}>
                              <DetailLabel>N {treatment.length > 1 ? a.label : "Treatment"}</DetailLabel>
                              <p>{a.n_randomized ?? "—"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {control.length > 0 && (
                        <div>
                          <DetailLabel>N Control</DetailLabel>
                          <p>{control.map((a) => a.n_randomized ?? "—").join(" + ")}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              {row.outcomes_summary.length > 1 && (
                <div className="md:col-span-2">
                  <DetailLabel>All outcomes ({row.outcomes_summary.length})</DetailLabel>
                  <div className="space-y-1 mt-1">
                    {row.outcomes_summary.slice(0, 12).map((o, i) => {
                      const pStr = o.p_value != null ? (o.p_value < 0.001 ? "p<.001" : `p=${o.p_value.toFixed(2)}`) : null;
                      let direction = "";
                      if (o.effect_value != null && o.higher_is_better != null) {
                        const favors = o.higher_is_better ? o.effect_value > 0 : o.effect_value < 0;
                        direction = favors ? "↑" : "↓";
                      }
                      const sig = o.p_value != null ? o.p_value < 0.05 : null;
                      const color = sig === true && direction === "↑" ? "#16a34a" : sig === true && direction === "↓" ? "#dc2626" : sig === true ? "#d97706" : "#64748b";
                      return (
                        <div key={i} className="flex items-baseline gap-2">
                          <span className="text-foreground">{o.name}</span>
                          {o.symptom_domain && <span className="text-foreground/40">({formatCategory(o.symptom_domain)})</span>}
                          {(pStr || o.effect_value != null) && (
                            <span style={{ color }} className="whitespace-nowrap font-medium">
                              {direction}
                              {o.effect_value != null && (
                                <>{" "}{o.effect_measure ? (o.effect_measure === "smd" ? "SMD" : formatCategory(o.effect_measure)) + " " : ""}{o.effect_value.toFixed(2)}</>
                              )}
                              {pStr ? ` ${pStr}` : ""}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {row.outcomes_summary.length > 12 && (
                      <p className="text-foreground/40">+{row.outcomes_summary.length - 12} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Intervention stacked bar (custom) ────────────────────────────────
const INTERVENTION_PALETTE = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#3b82f6", "#60a5fa",
  "#93c5fd", "#2dd4bf", "#34d399", "#4ade80", "#a3e635", "#facc15",
  "#fbbf24", "#f59e0b", "#fb923c", "#f87171", "#e879f9", "#c084fc",
  "#7dd3fc", "#5eead4", "#86efac", "#d9f99d", "#fde68a", "#fed7aa",
  "#fca5a5", "#f0abfc", "#a5b4fc", "#67e8f9", "#6ee7b7", "#bef264",
];

function hashColor(_name: string, index: number): string {
  return INTERVENTION_PALETTE[index % INTERVENTION_PALETTE.length];
}

// ── Country Map ─────────────────────────────────────────────────────
function CountryMap({ topCountries, onCountryClick }: { topCountries: DashboardProps["topCountries"]; onCountryClick?: (country: string) => void }) {
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  // Build name → count lookup from ALL countries (topCountries includes "Other" bucket, but we need per-country)
  // topCountries already has individual country names (except the "Other" aggregate)
  const countByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of topCountries) {
      if (c.country === "Other") continue;
      const mapName = COUNTRY_NAME_MAPPING[c.country] ?? c.country;
      m.set(mapName, c.count);
    }
    return m;
  }, [topCountries]);

  const maxCount = useMemo(() => Math.max(...countByName.values(), 1), [countByName]);

  const getColor = (count: number) => {
    if (count === 0) return "#e2e8f0";
    const t = Math.pow(count / maxCount, 0.5); // sqrt scale for better spread
    const r = Math.round(219 - t * (219 - 30));
    const g = Math.round(234 - t * (234 - 64));
    const b = Math.round(254 - t * (254 - 175));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="relative">
      <ComposableMap
        projectionConfig={{ scale: 140, center: [10, 10] }}
        width={700}
        height={380}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) => (
              <>
                {geographies.map((geo) => {
                  const name = geo.properties.name;
                  const count = countByName.get(name) ?? 0;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getColor(count)}
                      stroke="#fff"
                      strokeWidth={0.5}
                      onMouseEnter={(e) => {
                        if (count > 0) {
                          const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                          setTooltip({
                            name: geo.properties.name,
                            count,
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => {
                        if (count > 0 && onCountryClick) {
                          const dataName = REVERSE_COUNTRY_MAPPING[name] ?? name;
                          onCountryClick(dataName);
                        }
                      }}
                      style={{
                        default: { outline: "none", cursor: count > 0 ? "pointer" : "default" },
                        hover: { outline: "none", fill: count > 0 ? "#2563eb" : "#e2e8f0", cursor: count > 0 ? "pointer" : "default" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })}
                {geographies.map((geo) => {
                  const name = geo.properties.name;
                  const count = countByName.get(name) ?? 0;
                  if (count === 0) return null;
                  const centroid = geoCentroid(geo);
                  return (
                    <Marker key={geo.rsmKey + "-label"} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        y={2}
                        style={{
                          fontFamily: "system-ui, sans-serif",
                          fill: "#fff",
                          fontSize: "8px",
                          fontWeight: "bold",
                          pointerEvents: "none",
                          stroke: "rgba(0,0,0,0.5)",
                          strokeWidth: "1.5px",
                          paintOrder: "stroke",
                        }}
                      >
                        {count}
                      </text>
                    </Marker>
                  );
                })}
              </>
            )}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {tooltip && (
        <div
          className="absolute bg-background border border-border rounded px-2 py-1 text-xs shadow-lg pointer-events-none z-10"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -120%)" }}
        >
          <div className="font-semibold">{tooltip.name}</div>
          <div className="text-foreground/60">{tooltip.count} trial{tooltip.count !== 1 ? "s" : ""}</div>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-foreground/50 mt-1">
        <span>0</span>
        <div className="h-2 w-32 rounded" style={{ background: `linear-gradient(to right, #e2e8f0, #1e40af)` }} />
        <span>{maxCount}</span>
        <span className="ml-1">trials</span>
      </div>
    </div>
  );
}

function InterventionStackedBar({ data, onInterventionClick, onCategoryClick }: { data: InterventionBar[]; onInterventionClick?: (interventionName: string) => void; onCategoryClick?: (category: string) => void }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; count: number; category: string } | null>(null);
  const maxCount = data.length ? Math.max(...data.map((d) => d.count)) : 0;
  const barHeight = 24;
  const labelWidth = 130;
  const chartWidth = 600;
  const rightPad = 40;

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${labelWidth + chartWidth + rightPad} ${data.length * (barHeight + 6) + 10}`}>
        {data.map((cat, rowIdx) => {
          const y = rowIdx * (barHeight + 6) + 4;
          let xOffset = labelWidth;
          return (
            <g key={cat.category}>
              <text
                x={labelWidth - 8}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={12}
                fill="currentColor"
                opacity={0.8}
                className="cursor-pointer hover:underline"
                onClick={() => onCategoryClick?.(cat.category)}
              >
                {formatCategory(cat.category)}
              </text>
              {cat.interventions.map((intv, i) => {
                const segWidth = (intv.count / maxCount) * chartWidth;
                const x = xOffset;
                xOffset += segWidth;
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={Math.max(segWidth, 1)}
                    height={barHeight}
                    fill={hashColor(intv.name, i)}
                    opacity={0.8}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const parent = e.currentTarget.closest(".relative")!.getBoundingClientRect();
                      setTooltip({
                        x: rect.left - parent.left + rect.width / 2,
                        y: rect.top - parent.top - 8,
                        name: intv.name,
                        count: intv.count,
                        category: formatCategory(cat.category),
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => onInterventionClick?.(intv.name)}
                    className="cursor-pointer"
                  />
                );
              })}
              <text
                x={xOffset + 4}
                y={y + barHeight / 2}
                dominantBaseline="central"
                fontSize={11}
                fill="currentColor"
                opacity={0.5}
              >
                {cat.count}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="absolute bg-background border border-border rounded px-2 py-1 text-xs shadow-lg pointer-events-none z-10"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-semibold">{tooltip.name}</div>
          <div className="text-foreground/60">{tooltip.category} — {tooltip.count} trial{tooltip.count !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ────────────────────────────────────────────────
function ChartSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-semibold text-lg text-foreground">{title}</h3>
      {subtitle && <p className="text-sm text-foreground/50 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-foreground/50 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border rounded px-3 py-1.5 text-sm bg-background"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function OutcomeBadge({ row }: { row: TrialTableRow }) {
  const { primary_effect_value: ev, primary_p_value: p, primary_higher_is_better: hib } = row;

  // Can't determine anything
  if (ev == null && p == null) {
    return <span className="text-xs text-foreground/30">—</span>;
  }

  // Determine direction if possible
  let favorsIntervention: boolean | null = null;
  if (ev != null && hib != null) {
    favorsIntervention = hib ? ev > 0 : ev < 0;
  }

  const sig = p != null ? p < 0.05 : null;
  const pStr = p != null ? (p < 0.001 ? "<.001" : `=${p.toFixed(2)}`) : "";

  if (sig === true && favorsIntervention === true) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#22c55e20", color: "#16a34a" }}>
        Favors intervention{pStr && <span className="opacity-70"> (p{pStr})</span>}
      </span>
    );
  }
  if (sig === true && favorsIntervention === false) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#ef444420", color: "#dc2626" }}>
        Favors control{pStr && <span className="opacity-70"> (p{pStr})</span>}
      </span>
    );
  }
  if (sig === true && favorsIntervention == null) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#f59e0b20", color: "#d97706" }}>
        Significant{pStr && <span className="opacity-70"> (p{pStr})</span>}
      </span>
    );
  }
  // Not significant
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#94a3b840", color: "#64748b" }}>
      No sig. diff.{pStr && <span className="opacity-70"> (p{pStr})</span>}
    </span>
  );
}

function RobBadge({ rob }: { rob: string }) {
  const color = ROB_COLORS[rob as keyof typeof ROB_COLORS] ?? "#888";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: color + "20", color }}
    >
      {ROB_LABELS[rob] ?? rob}
    </span>
  );
}

function DetailLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5 ${className}`}>
      {children}
    </div>
  );
}
