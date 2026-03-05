"use client";

import { useState, useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  ReferenceLine,
  Cell,
  CartesianGrid,
  ZAxis,
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
import type { DashboardProps, ForestRow, InterventionBar, TrialTableRow, TrialMeta, SummaryStats, SymptomBar, HeatmapCell, CountryBar, YearBar, BlindingSignificanceBar, LcDefinitionBin } from "./types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COUNTRY_NAME_MAPPING: Record<string, string> = {
  "United States": "United States of America",
  "Czech Republic": "Czechia",
};

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
  const weeksBins = [0, 4, 8, 12, 16, 24, 52, Infinity];
  const binLabels = ["0–4", "4–8", "8–12", "12–16", "16–24", "24–52", "52+"];
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
  const [activeTab, setActiveTab] = useState<"overview" | "effects">(
    "overview"
  );
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleYearClick = (year: number) => {
    setYearFilter(year);
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };
  const [rctOnly, setRctOnly] = useState(false);

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
      forestData: props.forestData.filter((d) => d.is_rct),
      tableRows: props.tableRows.filter((r) => r.is_rct),
    };
  }, [rctOnly, props, recomputed]);

  const rctCount = useMemo(
    () => props.trialMetas.filter((m) => m.is_rct).length,
    [props.trialMetas]
  );

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "effects" as const, label: "Effect Sizes" },
  ];

  return (
    <div>
      {/* Hero */}
      <h1 className="font-clarendon font-bold text-3xl mb-2">Long Covid Clinical Trials</h1>
      <p className="text-foreground/70 text-lg mb-4">
        A bird&apos;s eye view of {effectiveProps.summaryStats.totalTrials} clinical trials testing
        interventions for Long Covid.
      </p>

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

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-foreground/50 hover:text-foreground/70"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab {...effectiveProps} onYearClick={handleYearClick} />
      )}
      {activeTab === "effects" && <EffectSizesTab forestData={effectiveProps.forestData} />}
      {/* Trial table — always visible at the bottom */}
      <div className="mt-12 border-t border-border pt-8" ref={tableRef}>
        <h2 className="font-clarendon font-bold text-2xl mb-4">All Trials</h2>
        <TrialTableTab
          tableRows={effectiveProps.tableRows}
          yearFilter={yearFilter}
          onYearClear={() => setYearFilter(null)}
        />
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────
function OverviewTab(props: DashboardProps & { onYearClick?: (year: number) => void }) {
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
          <CountryMap topCountries={props.allCountries} />
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
            margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="label"
              label={{ value: "Min weeks since infection", position: "bottom", offset: 0, fontSize: 12 }}
            />
            <YAxis label={{ value: "Trials", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]}>
              {props.lcDefinitionHist.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.label === "12–16" || entry.label === "16–24" || entry.label === "24–52" || entry.label === "52+" ? "#22c55e" : "#ef4444"}
                  opacity={0.8}
                />
              ))}
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
      <ChartSection title="Trials by intervention category" subtitle="Each segment is one intervention — hover for name">
        <InterventionStackedBar data={props.byIntervention} />
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
        title="Evidence landscape"
        subtitle="Intervention category × symptom domain (cell = number of trials)"
      >
        <Heatmap data={props.heatmapData} />
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
function Heatmap({ data }: { data: DashboardProps["heatmapData"] }) {
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
                    className="p-2 text-center border border-border/30"
                    style={{
                      backgroundColor: count > 0 ? `rgba(59, 130, 246, ${opacity})` : undefined,
                    }}
                    title={
                      count > 0
                        ? `${count} trials, ${highPct}% high RoB`
                        : "No trials"
                    }
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

// ── EFFECT SIZES TAB ─────────────────────────────────────────────────
function EffectSizesTab({ forestData }: { forestData: ForestRow[] }) {
  const [symptomFilter, setSymptomFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [measureFilter, setMeasureFilter] = useState<string>("all");

  const symptomDomains = useMemo(
    () => [...new Set(forestData.map((d) => d.symptom_domain))].sort(),
    [forestData]
  );
  const categories = useMemo(
    () => [...new Set(forestData.map((d) => d.intervention_category))].sort(),
    [forestData]
  );
  const measures = useMemo(
    () => [...new Set(forestData.map((d) => d.effect_measure))].sort(),
    [forestData]
  );

  const filtered = useMemo(() => {
    let d = forestData;
    if (symptomFilter !== "all") d = d.filter((r) => r.symptom_domain === symptomFilter);
    if (categoryFilter !== "all") d = d.filter((r) => r.intervention_category === categoryFilter);
    if (measureFilter !== "all") d = d.filter((r) => r.effect_measure === measureFilter);
    d = d.filter((r) => r.effect_value >= -10 && r.effect_value <= 55);
    return d.slice(0, 80); // cap for readability
  }, [forestData, symptomFilter, categoryFilter, measureFilter]);

  // Pooled estimate (inverse-variance weighted)
  const pooled = useMemo(() => {
    if (filtered.length < 2) return null;
    // Only pool if all same measure
    const uniqueMeasures = new Set(filtered.map((d) => d.effect_measure));
    if (uniqueMeasures.size > 1) return null;

    let sumW = 0;
    let sumWx = 0;
    for (const d of filtered) {
      const se = (d.ci_95_high - d.ci_95_low) / (2 * 1.96);
      if (se <= 0) continue;
      const w = 1 / (se * se);
      sumW += w;
      sumWx += w * d.effect_value;
    }
    if (sumW === 0) return null;
    const mean = sumWx / sumW;
    const seMean = Math.sqrt(1 / sumW);
    return {
      mean,
      ci_low: mean - 1.96 * seMean,
      ci_high: mean + 1.96 * seMean,
    };
  }, [filtered]);

  // Prepare data for horizontal forest plot
  const chartData = useMemo(
    () =>
      filtered.map((d, i) => ({
        index: i,
        label: d.intervention_name.slice(0, 30),
        effect: d.effect_value,
        ciLow: d.ci_95_low,
        ciHigh: d.ci_95_high,
        category: d.intervention_category,
        rob: d.rob_overall,
        n: d.n_randomized,
        paper_id: d.paper_id,
      })),
    [filtered]
  );

  const chartHeight = Math.max(400, chartData.length * 28 + 60);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="Symptom"
          value={symptomFilter}
          onChange={setSymptomFilter}
          options={[{ value: "all", label: "All domains" }, ...symptomDomains.map((d) => ({ value: d, label: formatCategory(d) }))]}
        />
        <FilterSelect
          label="Intervention"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: formatCategory(c) }))]}
        />
        <FilterSelect
          label="Effect measure"
          value={measureFilter}
          onChange={setMeasureFilter}
          options={[{ value: "all", label: "All measures" }, ...measures.map((m) => ({ value: m, label: m.replace(/_/g, " ") }))]}
        />
      </div>

      <p className="text-sm text-foreground/50">
        Showing {filtered.length} trial effects
        {filtered.length === 80 ? " (capped at 80 for readability)" : ""}.
        Each point is one trial&apos;s primary outcome; horizontal bars are 95% CIs.
      </p>

      {filtered.length === 0 ? (
        <p className="text-foreground/60 py-12 text-center">No trials match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ScatterChart margin={{ left: 180, right: 40, top: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                type="number"
                dataKey="effect"
                name="Effect"
                domain={[-10, 55]}
                allowDataOverflow
                label={{ value: "Effect size", position: "bottom", offset: 10, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="index"
                name="Trial"
                reversed
                tick={({ x, y, payload }: any) => {
                  const d = chartData[payload.value];
                  if (!d) return <g />;
                  return (
                    <g>
                      <text x={x - 5} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="currentColor">
                        {d.label}
                      </text>
                    </g>
                  );
                }}
                domain={[-0.5, chartData.length - 0.5]}
                interval={0}
                width={175}
              />
              <ZAxis range={[40, 40]} />
              <ReferenceLine x={0} stroke="#888" strokeDasharray="3 3" />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-background border border-border rounded p-2 text-xs shadow-lg">
                      <div className="font-semibold">{d.label}</div>
                      <div>Effect: {d.effect.toFixed(2)} [{d.ciLow.toFixed(2)}, {d.ciHigh.toFixed(2)}]</div>
                      <div>N = {d.n} | RoB: {ROB_LABELS[d.rob] ?? d.rob}</div>
                      <div className="text-foreground/50">{d.paper_id}</div>
                    </div>
                  );
                }}
              />
              {/* CI bars as custom shapes */}
              <Scatter
                data={chartData}
                shape={(shapeProps: any) => {
                  const { cx, cy, payload } = shapeProps;
                  if (!payload || cx == null || cy == null) return <g />;
                  // Calculate CI endpoints in pixels
                  const xScale = shapeProps.xAxis?.scale;
                  if (!xScale) return <circle cx={cx} cy={cy} r={4} fill={CATEGORY_COLORS[payload.category] ?? "#888"} />;
                  const x1 = xScale(payload.ciLow);
                  const x2 = xScale(payload.ciHigh);
                  const color = CATEGORY_COLORS[payload.category] ?? "#888";
                  return (
                    <g>
                      <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={color} strokeWidth={2} opacity={0.6} />
                      <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1} />
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pooled estimate */}
      {pooled && (
        <div className="border border-border rounded-lg p-4 bg-foreground/5">
          <div className="text-sm font-medium mb-1">
            Pooled estimate (inverse-variance weighted, fixed-effect)
          </div>
          <div className="text-lg font-bold">
            {pooled.mean.toFixed(3)}{" "}
            <span className="text-sm font-normal text-foreground/60">
              95% CI [{pooled.ci_low.toFixed(3)}, {pooled.ci_high.toFixed(3)}]
            </span>
          </div>
          <p className="text-xs text-foreground/50 mt-1">
            Caution: trials use different outcome instruments and scales. This pooled estimate is
            only meaningful when comparing trials using the same measurement instrument.
          </p>
        </div>
      )}

      <div className="text-xs text-foreground/40 border-t border-border pt-3">
        Note: Different trials use different outcome instruments even within the same symptom domain.
        Raw effect sizes are shown — they are not directly comparable across instruments.
      </div>
    </div>
  );
}

// ── TRIAL TABLE TAB ──────────────────────────────────────────────────
function TrialTableTab({
  tableRows,
  yearFilter,
  onYearClear,
}: {
  tableRows: TrialTableRow[];
  yearFilter: number | null;
  onYearClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [symptomFilter, setSymptomFilter] = useState("all");
  const [robFilter, setRobFilter] = useState("all");
  const [sortField, setSortField] = useState<"n_randomized" | "paper_id" | "intervention_name" | "pct_positive" | "outcome">(
    "n_randomized"
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
  }, [tableRows, search, categoryFilter, symptomFilter, robFilter, yearFilter, sortField, sortDir]);

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
          label="Intervention"
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
      </div>

      <p className="text-sm text-foreground/50">{filtered.length} trials match</p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 w-8" />
              <th
                className="p-2 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("paper_id")}
              >
                Paper {sortField === "paper_id" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th
                className="p-2 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("intervention_name")}
              >
                Intervention {sortField === "intervention_name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="p-2">Category</th>
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
                Outcome {sortField === "outcome" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="p-2 text-right"># Out</th>
              <th className="p-2 text-right" title="Significant in positive direction">+ Sig</th>
              <th className="p-2 text-right" title="Negative or non-significant">− / NS</th>
              <th className="p-2 text-right" title="Unknown significance">Unk</th>
              <th
                className="p-2 cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort("pct_positive")}
                title="% positive significant outcomes"
              >
                % Pos {sortField === "pct_positive" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <th className="p-2">RoB</th>
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
        <td className="p-2 text-foreground/40">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="p-2">
          <a
            href={row.doi_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {row.paper_id.length > 30 ? row.paper_id.slice(0, 30) + "…" : row.paper_id}
            <ExternalLink size={10} />
          </a>
        </td>
        <td className="p-2 max-w-[200px] truncate" title={row.intervention_name}>
          {row.intervention_name}
        </td>
        <td className="p-2">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: (CATEGORY_COLORS[row.intervention_category] ?? "#888") + "20",
              color: CATEGORY_COLORS[row.intervention_category] ?? "#888",
            }}
          >
            {formatCategory(row.intervention_category)}
          </span>
        </td>
        <td className="p-2 text-right tabular-nums">{row.n_randomized ?? "—"}</td>
        <td className="p-2">
          <OutcomeBadge row={row} />
        </td>
        <td className="p-2 text-right tabular-nums text-xs">{row.n_outcomes}</td>
        <td className="p-2 text-right tabular-nums text-xs text-green-600">{row.n_positive || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs text-foreground/60">{row.n_negative_ns || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs text-foreground/40">{row.n_unknown || "—"}</td>
        <td className="p-2 text-right tabular-nums text-xs">
          {row.n_outcomes > 0 ? `${Math.round((row.n_positive / row.n_outcomes) * 100)}%` : "—"}
        </td>
        <td className="p-2">
          <RobBadge rob={row.rob_overall} />
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border/50">
          <td colSpan={12} className="p-4 bg-foreground/[0.02]">
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <DetailLabel>Primary outcome</DetailLabel>
                <p>{row.primary_outcome_name || "Not specified"}</p>
                {row.primary_effect_value != null && (
                  <p className="mt-1">
                    Effect: <strong>{row.primary_effect_value.toFixed(2)}</strong>
                    {row.primary_ci_low != null && row.primary_ci_high != null && (
                      <> [95% CI: {row.primary_ci_low.toFixed(2)}, {row.primary_ci_high.toFixed(2)}]</>
                    )}
                    {row.primary_p_value != null && (
                      <>, p = {row.primary_p_value < 0.001 ? "<0.001" : row.primary_p_value.toFixed(3)}</>
                    )}
                  </p>
                )}
              </div>
              <div>
                <DetailLabel>Blinding</DetailLabel>
                <p>{formatCategory(row.blinding)}</p>
                <DetailLabel className="mt-2">Follow-up</DetailLabel>
                <p>{row.follow_up_weeks != null ? `${row.follow_up_weeks} weeks` : "Not reported"}</p>
              </div>
              <div className="md:col-span-2">
                <DetailLabel>Long Covid definition</DetailLabel>
                <p className="text-foreground/70">{row.long_covid_definition || "Not specified"}</p>
              </div>
              {row.outcomes_summary.length > 1 && (
                <div className="md:col-span-2">
                  <DetailLabel>All outcomes ({row.outcomes_summary.length})</DetailLabel>
                  <p className="text-foreground/50">
                    {row.outcomes_summary.slice(0, 8).join(" · ")}
                    {row.outcomes_summary.length > 8 && ` · +${row.outcomes_summary.length - 8} more`}
                  </p>
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
function CountryMap({ topCountries }: { topCountries: DashboardProps["topCountries"] }) {
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
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: count > 0 ? "#2563eb" : "#e2e8f0" },
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

function InterventionStackedBar({ data }: { data: InterventionBar[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; count: number; category: string } | null>(null);
  const maxCount = data.length ? Math.max(...data.map((d) => d.count)) : 0;
  const barHeight = 28;
  const labelWidth = 130;
  const chartWidth = 600;
  const rightPad = 40;

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${labelWidth + chartWidth + rightPad} ${data.length * (barHeight + 8) + 10}`}>
        {data.map((cat, rowIdx) => {
          const y = rowIdx * (barHeight + 8) + 4;
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
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: "#94a3b820", color: "#64748b" }}>
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
    <div className={`text-foreground/50 font-medium uppercase tracking-wide text-[10px] mb-0.5 ${className}`}>
      {children}
    </div>
  );
}
