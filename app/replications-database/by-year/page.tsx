"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getOutcomeForRow, toNumber, type OutcomeMethod, type AnyRecord } from "@/lib/replicationOutcome";
import { ChartWatermark } from "@/components/ChartWatermark";

type FredResponse = {
  columns: string[];
  rows: AnyRecord[];
};

// "reported" uses the database's `result` column directly; the others reuse the
// same statistical definitions offered on the main replications-database page.
type SuccessDef = "reported" | OutcomeMethod;

const SUCCESS_DEF_OPTIONS: { value: SuccessDef; label: string }[] = [
  { value: "reported", label: "Reported result (as recorded in the database)" },
  { value: "significance", label: "Statistically significant effect in the same direction?" },
  { value: "orig_in_rep_ci", label: "Original effect size in replication 95% confidence interval?" },
  { value: "rep_in_orig_ci", label: "Replication effect size in original 95% confidence interval?" },
];

type YearDim = "replication_year" | "original_year";

const YEAR_DIM_OPTIONS: { value: YearDim; label: string }[] = [
  { value: "replication_year", label: "Year the replication was published" },
  { value: "original_year", label: "Year the original study was published" },
];

const SUCCESS_COLOR = "#10b981";
const FAILURE_COLOR = "#f87171";
const OTHER_COLOR = "#cbd5e1";

// Years before this are aggregated into a single "< 1970" bin in the rate chart.
const BIN_START = 1970;

// Options for the minimum number of classified replications in a bin before we
// draw a rate bar ("min data").
const MIN_N_OPTIONS = [5, 10, 20];

type YearCount = {
  year: number;
  success: number;
  failure: number;
  other: number; // inconclusive / no recorded outcome under the current definition
  total: number;
};

type YearBin = {
  label: string;
  success: number;
  failure: number;
  total: number;
  rate: number; // percent, or -1 when below MIN_N
  ciLow: number; // percent
  ciHigh: number; // percent
};

// Wilson score 95% CI for a proportion k/n, returned as percentages.
function wilsonCI(k: number, n: number): [number, number] {
  if (n === 0) return [0, 100];
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin) * 100, Math.min(1, center + margin) * 100];
}

/**
 * Classify a single row as a replication success / failure / excluded, per the
 * chosen definition. Returns null when the row should not count toward any rate
 * (inconclusive, or no recorded outcome).
 */
function classifyRow(row: AnyRecord, def: SuccessDef): "success" | "failure" | null {
  if (def === "reported") {
    const res = String(row.result ?? "").trim().toLowerCase();
    if (res === "success") return "success";
    if (res === "failure") return "failure";
    return null;
  }
  const outcome = getOutcomeForRow(row, def);
  if (outcome === "success") return "success";
  if (outcome === "failure" || outcome === "reversal") return "failure";
  return null; // inconclusive
}

// Round an axis maximum up to a "nice" value and return the tick positions.
function niceTicks(maxVal: number): { ticks: number[]; top: number } {
  const rough = Math.max(maxVal, 1) / 7;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => maxVal / s <= 7) ?? 10 * pow;
  const top = Math.max(step, Math.ceil(maxVal / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { ticks, top };
}

// Stacked bar histogram: one bar per calendar year, success/failure/other.
function YearCountBars({
  counts,
  xLabel,
  yLabel = "Number of replications",
  unit = "replication",
}: {
  counts: YearCount[];
  xLabel: string;
  yLabel?: string;
  unit?: string;
}) {
  const width = 720;
  const height = 260;
  const margin = { top: 10, right: 16, bottom: 46, left: 62 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const n = counts.length;
  const step = innerW / n;
  const gap = step >= 8 ? 2 : step >= 3 ? 1 : 0.5;
  const barW = Math.max(1, step - gap);

  const maxTotal = Math.max(...counts.map((c) => c.total), 1);
  const { ticks: yTicks, top: yMax } = niceTicks(maxTotal);
  const yScale = (v: number) => innerH - (v / yMax) * innerH;

  const range = counts[n - 1].year - counts[0].year;
  const tickEvery = range > 12 ? 5 : range > 6 ? 2 : 1;

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="max-w-full h-auto"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          <rect x={0} y={0} width={innerW} height={innerH} fill="#f3f4f6" />
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#d1d5db" strokeWidth={0.5} />
              <line x1={-6} x2={0} y1={yScale(t)} y2={yScale(t)} stroke="#000000" strokeWidth={1} />
              <text x={-10} y={yScale(t)} dy="0.32em" textAnchor="end" className="text-xs fill-black dark:fill-gray-100">
                {t.toLocaleString()}
              </text>
            </g>
          ))}
          {/* axis lines */}
          <line x1={0} x2={0} y1={0} y2={innerH} stroke="#000000" strokeWidth={1} />
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#000000" strokeWidth={1} />
          {counts.map((c, i) => {
            const x = i * step + gap / 2;
            const hS = (c.success / yMax) * innerH;
            const hF = (c.failure / yMax) * innerH;
            const hO = (c.other / yMax) * innerH;
            return (
              <g key={c.year}>
                <title>
                  {`${c.year}: ${c.total.toLocaleString()} ${unit}${c.total === 1 ? "" : "s"} — ${c.success} successful, ${c.failure} failed, ${c.other} inconclusive/unclassified`}
                </title>
                {/* full-column hover target so tooltips work on short bars too */}
                <rect x={i * step} y={0} width={step} height={innerH} fill="transparent" />
                {c.success > 0 && (
                  <rect x={x} y={innerH - hS} width={barW} height={hS} fill={SUCCESS_COLOR} fillOpacity={0.85} />
                )}
                {c.failure > 0 && (
                  <rect x={x} y={innerH - hS - hF} width={barW} height={hF} fill={FAILURE_COLOR} fillOpacity={0.85} />
                )}
                {c.other > 0 && (
                  <rect x={x} y={innerH - hS - hF - hO} width={barW} height={hO} fill={OTHER_COLOR} fillOpacity={0.85} />
                )}
              </g>
            );
          })}
          {counts.map((c, i) => {
            if (c.year % tickEvery !== 0) return null;
            const cx = i * step + step / 2;
            return (
              <g key={`x-${c.year}`}>
                <line x1={cx} x2={cx} y1={innerH} y2={innerH + 5} stroke="#000000" strokeWidth={1} />
                <text x={cx} y={innerH + 17} textAnchor="middle" className="fill-black dark:fill-gray-100" style={{ fontSize: 11 }}>
                  {c.year}
                </text>
              </g>
            );
          })}
          <text x={-innerH / 2} y={-48} textAnchor="middle" transform="rotate(-90)" className="fill-black dark:fill-gray-100" style={{ fontSize: 14, fontWeight: 700 }}>
            {yLabel}
          </text>
          <text x={innerW / 2} y={innerH + 40} textAnchor="middle" className="fill-black dark:fill-gray-100" style={{ fontSize: 14, fontWeight: 700 }}>
            {xLabel}
          </text>
          {/* arrow marking 2005 */}
          {(() => {
            const idx = counts.findIndex((c) => c.year === 2005);
            if (idx < 0) return null;
            const cx = idx * step + step / 2;
            const topY = innerH - (counts[idx].total / yMax) * innerH;
            return (
              <g style={{ cursor: "help" }}>
                <title>
                  {'John Ioannidis inaugurates the modern metascience movement with his paper "Why Most Published Research Findings Are False"'}
                </title>
                {/* invisible hover target so the tooltip is easy to hit */}
                <rect x={cx - 8} y={topY - 30} width={16} height={28} fill="transparent" />
                <line x1={cx} x2={cx} y1={topY - 26} y2={topY - 9} stroke="#000000" strokeWidth={1.5} />
                <polygon points={`${cx - 3.5},${topY - 10} ${cx + 3.5},${topY - 10} ${cx},${topY - 4}`} fill="#000000" />
              </g>
            );
          })()}
          <ChartWatermark />
          {/* legend (top-left of the plot, publication style) */}
          <g transform="translate(12,24)">
            <rect x={0} y={0} width={186} height={60} fill="#ffffff" stroke="#9ca3af" strokeWidth={0.75} />
            {[
              { label: "Successful", color: SUCCESS_COLOR },
              { label: "Failed", color: FAILURE_COLOR },
              { label: "Inconclusive / unclassified", color: OTHER_COLOR },
            ].map((item, i) => (
              <g key={item.label} transform={`translate(9,${9 + i * 15})`}>
                <rect x={0} y={0} width={10} height={10} fill={item.color} />
                <text x={16} y={9} fill="#000000" style={{ fontSize: 11 }}>
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}

// Replication success rate per 5-year bin, with Wilson 95% CI whiskers.
function YearRateBars({ bins, xLabel, unit, showN = true }: { bins: YearBin[]; xLabel: string; unit: string; showN?: boolean }) {
  const width = 720;
  const height = 318;
  const margin = { top: 10, right: 16, bottom: 74, left: 62 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const barGap = 8;
  const barWidth = Math.max(14, Math.min(70, (innerW - barGap * (bins.length - 1)) / bins.length));
  const totalBarsWidth = bins.length * barWidth + (bins.length - 1) * barGap;
  const offsetX = (innerW - totalBarsWidth) / 2;

  const yScale = (v: number) => innerH - (v / 100) * innerH;
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="max-w-full h-auto"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          <rect x={0} y={0} width={innerW} height={innerH} fill="#f3f4f6" />
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#d1d5db" strokeWidth={0.5} />
              <line x1={-6} x2={0} y1={yScale(t)} y2={yScale(t)} stroke="#000000" strokeWidth={1} />
              <text x={-10} y={yScale(t)} dy="0.32em" textAnchor="end" className="text-xs fill-black dark:fill-gray-100">
                {t}%
              </text>
            </g>
          ))}
          {/* axis lines */}
          <line x1={0} x2={0} y1={0} y2={innerH} stroke="#000000" strokeWidth={1} />
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#000000" strokeWidth={1} />
          {bins.map((bin, i) => {
            const bx = offsetX + i * (barWidth + barGap);
            const cx = bx + barWidth / 2;
            const insufficientData = bin.rate < 0;
            const barH = insufficientData ? 0 : (bin.rate / 100) * innerH;
            const by = innerH - barH;
            return (
              <g key={bin.label}>
                <title>
                  {insufficientData
                    ? `${bin.label}: insufficient data (${bin.total} classified ${unit})`
                    : `${bin.label}: ${bin.rate.toFixed(1)}% success (${bin.success}/${bin.total} ${unit}) · 95% CI [${bin.ciLow.toFixed(1)}%–${bin.ciHigh.toFixed(1)}%]`}
                </title>
                {insufficientData ? (
                  <text x={cx} y={innerH - 24} textAnchor="middle" className="fill-current" style={{ fontSize: 8, opacity: 0.4 }}>
                    <tspan x={cx} dy="0">not</tspan>
                    <tspan x={cx} dy="10">enough</tspan>
                    <tspan x={cx} dy="10">data</tspan>
                  </text>
                ) : (
                  <>
                    <rect x={bx} y={by} width={barWidth} height={Math.max(barH, 2)} fill={SUCCESS_COLOR} fillOpacity={0.85} rx={1} />
                    {/* Wilson 95% CI whisker */}
                    <line x1={cx} x2={cx} y1={yScale(bin.ciLow)} y2={yScale(bin.ciHigh)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                    <line x1={cx - 4} x2={cx + 4} y1={yScale(bin.ciHigh)} y2={yScale(bin.ciHigh)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                    <line x1={cx - 4} x2={cx + 4} y1={yScale(bin.ciLow)} y2={yScale(bin.ciLow)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                    {showN && (
                      <text x={cx} y={yScale(bin.ciHigh) - 4} textAnchor="middle" className="fill-current" style={{ fontSize: 9, opacity: 0.75 }}>
                        n={bin.total}
                      </text>
                    )}
                  </>
                )}
                <text
                  x={cx}
                  y={innerH + 14}
                  textAnchor="end"
                  transform={`rotate(-40 ${cx} ${innerH + 14})`}
                  className="fill-black dark:fill-gray-100"
                  style={{ fontSize: 11 }}
                >
                  {bin.label}
                </text>
              </g>
            );
          })}
          <ChartWatermark />
          <text x={-innerH / 2} y={-48} textAnchor="middle" transform="rotate(-90)" className="fill-black dark:fill-gray-100" style={{ fontSize: 14, fontWeight: 700 }}>
            Replication Success Rate (%)
          </text>
          <text x={innerW / 2} y={innerH + 68} textAnchor="middle" className="fill-black dark:fill-gray-100" style={{ fontSize: 14, fontWeight: 700 }}>
            {xLabel}
          </text>
        </g>
      </svg>
    </div>
  );
}

export default function ByYearPage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearDim, setYearDim] = useState<YearDim>("original_year");
  const [successDef, setSuccessDef] = useState<SuccessDef>("reported");
  const [discipline, setDiscipline] = useState<string>("all");
  const [replicationType, setReplicationType] = useState<string>("all");
  const [analysisLevel, setAnalysisLevel] = useState<"effect" | "paper">("effect");
  const [paperThreshold, setPaperThreshold] = useState<number>(0.5);
  const [minN, setMinN] = useState<number>(10);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/fred", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FredResponse;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Distinct disciplines present in the data, most common first.
  const disciplineOptions = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const row of data.rows) {
      const d = String(row.discipline ?? "").trim();
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [data]);

  // Distinct replication types present in the data, most common first.
  const replicationTypeOptions = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const row of data.rows) {
      const t = String(row.replication_type ?? "").trim();
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [data]);

  const agg = useMemo(() => {
    if (!data) return null;
    const perYear = new Map<number, { success: number; failure: number; other: number }>();
    for (const row of data.rows) {
      if (discipline !== "all" && String(row.discipline ?? "").trim() !== discipline) continue;
      if (replicationType !== "all" && String(row.replication_type ?? "").trim() !== replicationType) continue;
      const y = toNumber(row[yearDim]);
      if (y == null || !Number.isFinite(y) || y <= 1900 || y >= 2100) continue;
      const yr = Math.round(y);
      let e = perYear.get(yr);
      if (!e) {
        e = { success: 0, failure: 0, other: 0 };
        perYear.set(yr, e);
      }
      const outcome = classifyRow(row, successDef);
      if (outcome === "success") e.success++;
      else if (outcome === "failure") e.failure++;
      else e.other++;
    }
    if (perYear.size === 0) return null;

    const years = Array.from(perYear.keys());
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    // 5-year rate bins, with everything before BIN_START collapsed into one bin.
    // Bins stop at 2024 — later years are still filling in.
    const binMax = Math.min(maxYear, 2024);
    const binDefs: { label: string; lo: number; hi: number }[] = [];
    const start = Math.max(BIN_START, Math.floor(minYear / 5) * 5);
    if (minYear < start) binDefs.push({ label: `< ${start}`, lo: -Infinity, hi: start });
    for (let lo = start; lo <= binMax; lo += 5) {
      const hiYear = Math.min(lo + 4, binMax);
      binDefs.push({ label: hiYear === lo ? `${lo}` : `${lo}–${String(hiYear).slice(2)}`, lo, hi: lo + 5 });
    }
    // Success/failure tallies per year for the rate chart, at the selected level
    // of analysis. Effect level counts each replication row; paper level groups
    // rows by original_url and calls the paper a success when at least the
    // threshold share of its effect replications succeeded (same rule as the
    // main replications-database page).
    let rateByYear: Map<number, { success: number; failure: number }>;
    // At paper level, per-year paper tallies for the counts chart (papers with no
    // classified outcome under the current definition land in `other`).
    let paperPerYear: Map<number, { success: number; failure: number; other: number }> | null = null;
    if (analysisLevel === "effect") {
      rateByYear = perYear;
    } else {
      const paperMap = new Map<string, { year: number; success: number; denom: number }>();
      for (const row of data.rows) {
        if (discipline !== "all" && String(row.discipline ?? "").trim() !== discipline) continue;
        if (replicationType !== "all" && String(row.replication_type ?? "").trim() !== replicationType) continue;
        const y = toNumber(row[yearDim]);
        if (y == null || !Number.isFinite(y) || y <= 1900 || y >= 2100) continue;
        const url = String(row.original_url ?? "").trim();
        if (!url) continue;
        const yr = Math.round(y);
        let e = paperMap.get(url);
        if (!e) {
          e = { year: yr, success: 0, denom: 0 };
          paperMap.set(url, e);
        }
        e.year = Math.min(e.year, yr);
        if (successDef === "reported") {
          const res = String(row.result ?? "").trim().toLowerCase();
          if (res) {
            e.denom++;
            if (res === "success") e.success++;
          }
        } else {
          const o = classifyRow(row, successDef);
          if (o != null) {
            e.denom++;
            if (o === "success") e.success++;
          }
        }
      }
      rateByYear = new Map();
      paperPerYear = new Map();
      for (const p of Array.from(paperMap.values())) {
        let c = paperPerYear.get(p.year);
        if (!c) {
          c = { success: 0, failure: 0, other: 0 };
          paperPerYear.set(p.year, c);
        }
        if (p.denom === 0) {
          c.other++;
          continue;
        }
        const ok = p.success / p.denom >= paperThreshold;
        if (ok) c.success++;
        else c.failure++;
        let e = rateByYear.get(p.year);
        if (!e) {
          e = { success: 0, failure: 0 };
          rateByYear.set(p.year, e);
        }
        if (ok) e.success++;
        else e.failure++;
      }
    }

    // Counts chart: effect replications per year, or papers per year at the
    // paper level of analysis. The chart starts at 1945; the handful of earlier
    // rows still count toward the header totals and the "< 1970" rate bin.
    const countSource = paperPerYear ?? perYear;
    const counts: YearCount[] = [];
    for (let y = Math.max(minYear, 1945); y <= maxYear; y++) {
      const e = countSource.get(y) ?? { success: 0, failure: 0, other: 0 };
      counts.push({ year: y, ...e, total: e.success + e.failure + e.other });
    }

    const bins: YearBin[] = binDefs.map((b) => {
      let success = 0;
      let failure = 0;
      for (const [yr, e] of Array.from(rateByYear.entries())) {
        if (yr >= b.lo && yr < b.hi) {
          success += e.success;
          failure += e.failure;
        }
      }
      const total = success + failure;
      const [ciLow, ciHigh] = wilsonCI(success, total);
      return {
        label: b.label,
        success,
        failure,
        total,
        rate: total >= minN ? (success / total) * 100 : -1,
        ciLow,
        ciHigh,
      };
    });

    // Single-year rate bins, 2005–2024 (recent years are still filling in, so
    // they are excluded). Years without enough data are trimmed from both ends.
    let recentBins: YearBin[] = [];
    for (let yr = 2005; yr <= Math.min(maxYear, 2024); yr++) {
      const e = rateByYear.get(yr) ?? { success: 0, failure: 0 };
      const total = e.success + e.failure;
      const [ciLow, ciHigh] = wilsonCI(e.success, total);
      recentBins.push({
        label: String(yr),
        success: e.success,
        failure: e.failure,
        total,
        rate: total >= minN ? (e.success / total) * 100 : -1,
        ciLow,
        ciHigh,
      });
    }
    const firstValid = recentBins.findIndex((b) => b.rate >= 0);
    const lastValid = recentBins.length - 1 - [...recentBins].reverse().findIndex((b) => b.rate >= 0);
    recentBins = firstValid < 0 ? [] : recentBins.slice(firstValid, lastValid + 1);

    const sourceEntries = Array.from(countSource.values());
    const totalRows = sourceEntries.reduce((s, e) => s + e.success + e.failure + e.other, 0);
    const totalClassified = sourceEntries.reduce((s, e) => s + e.success + e.failure, 0);
    const rateUnits = bins.reduce((s, b) => s + b.total, 0);
    return { counts, bins, recentBins, totalRows, totalClassified, rateUnits };
  }, [data, yearDim, successDef, discipline, replicationType, analysisLevel, paperThreshold, minN]);

  const yearDimLabel = YEAR_DIM_OPTIONS.find((o) => o.value === yearDim)?.label ?? "";

  if (loading) return <main className="min-h-screen px-6 py-10">Loading…</main>;
  if (error || !data) return <main className="min-h-screen px-6 py-10">Failed to load: {error || "No data"}</main>;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Replications by year</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {analysisLevel === "paper" ? "Paper-level analysis" : "Effect-level analysis"}: each{" "}
              {analysisLevel === "paper" ? "replicated paper" : "replication"} in the database is placed
              on a timeline by publication year — of either the replication study or the original study
              it targeted.
              {agg && (
                <>
                  {" "}
                  {agg.totalRows.toLocaleString()} {analysisLevel === "paper" ? "papers" : "replications"}{" "}
                  have a recorded year under the current view, of which{" "}
                  {agg.totalClassified.toLocaleString()} have a success/failure outcome under the current
                  definition.
                </>
              )}{" "}
              Rate bins with fewer than {minN} classified replications are not scored. Whiskers are
              Wilson 95% confidence intervals.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Discipline:</span>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm max-w-md"
              >
                <option value="all">All disciplines</option>
                {disciplineOptions.map((opt) => (
                  <option key={opt.name} value={opt.name}>
                    {opt.name} ({opt.count.toLocaleString()})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                Replication type{" "}
                <Link href="/docs/defining-replication" className="text-xs text-gray-500 dark:text-gray-400 underline hover:opacity-80">
                  (more info)
                </Link>
                :
              </span>
              <select
                value={replicationType}
                onChange={(e) => setReplicationType(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm max-w-md"
              >
                <option value="all">All types</option>
                {replicationTypeOptions.map((opt) => (
                  <option key={opt.name} value={opt.name}>
                    {opt.name} ({opt.count.toLocaleString()})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Group by:</span>
              <select
                value={yearDim}
                onChange={(e) => setYearDim(e.target.value as YearDim)}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm max-w-md"
              >
                {YEAR_DIM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Definition of replication success:</span>
              <select
                value={successDef}
                onChange={(e) => setSuccessDef(e.target.value as SuccessDef)}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm max-w-md"
              >
                {SUCCESS_DEF_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <a
              href="/docs/replication-outcome-classification"
              className="text-xs text-gray-500 dark:text-gray-400 underline hover:opacity-80"
            >
              How are these defined?
            </a>
            <div className="w-full flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="flex items-center gap-2 text-sm">
                <span
                  className="text-gray-600 dark:text-gray-300 cursor-help"
                  title="A paper is considered successfully replicated if X% of effect replications for effects reported in that paper were successful. The threshold X can be shifted with the dropdown. At the paper level, a paper's year is the earliest year among its replications (or its original publication year). Applies to the success-rate charts below."
                >
                  Level of analysis:
                </span>
                <select
                  value={analysisLevel}
                  onChange={(e) => setAnalysisLevel(e.target.value as "effect" | "paper")}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="effect">Effect</option>
                  <option value="paper">Paper</option>
                </select>
              </label>
              {analysisLevel === "paper" && (
                <label className="flex items-center gap-2 text-sm">
                  <span
                    className="text-gray-600 dark:text-gray-300 cursor-help"
                    title="The minimum share of a paper's effect replications that must be successful for the paper to count as successfully replicated. For example, at 50%, a paper with 4 effect replications counts as a success if at least 2 of them succeeded."
                  >
                    Threshold for success:
                  </span>
                  <select
                    value={paperThreshold}
                    onChange={(e) => setPaperThreshold(Number(e.target.value))}
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value={0.5}>50%</option>
                    <option value={0.75}>75%</option>
                    <option value={0.9}>90%</option>
                    <option value={1}>100%</option>
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <span
                  className="text-gray-600 dark:text-gray-300 cursor-help"
                  title="Minimum number of classified replications (or papers) a time bin needs before its success rate is drawn. Bins below this show 'not enough data'."
                >
                  Min data per bin:
                </span>
                <select
                  value={minN}
                  onChange={(e) => setMinN(Number(e.target.value))}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
                >
                  {MIN_N_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!agg ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No replications with a recorded year under the current view.
            </p>
          ) : (
            <>
              {/* Counts per year */}
              <section className="space-y-3">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                  {analysisLevel === "paper" ? "Replication papers per year" : "Replications per year"}
                  {discipline !== "all" ? ` — ${discipline}` : ""}
                </h2>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
                  <YearCountBars
                    counts={agg.counts}
                    xLabel={
                      analysisLevel === "paper"
                        ? yearDim === "replication_year"
                          ? "Year the replication paper was published"
                          : "Year the original paper was published"
                        : yearDimLabel
                    }
                    yLabel={analysisLevel === "paper" ? "# replication papers" : "Number of replications"}
                    unit={analysisLevel === "paper" ? "replication paper" : "replication"}
                  />
                </div>
              </section>

              {/* Success rate by 5-year bin */}
              <section className="space-y-3">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                  Replication success rate by year{discipline !== "all" ? ` — ${discipline}` : ""}
                </h2>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
                  <YearRateBars bins={agg.bins} xLabel={yearDimLabel} unit={analysisLevel === "effect" ? "replications" : "papers"} />
                </div>
              </section>

              {/* Success rate per single year, 2005–present */}
              {agg.recentBins.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                    Replication success rate by year, 2005–2024{discipline !== "all" ? ` — ${discipline}` : ""}
                  </h2>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
                    <YearRateBars
                      bins={agg.recentBins}
                      xLabel={yearDimLabel}
                      unit={analysisLevel === "effect" ? "replications" : "papers"}
                    />
                  </div>
                </section>
              )}

            </>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400">
            <Link href="/replications-database" className="text-blue-600 dark:text-blue-400 hover:underline">
              ← Back to the replications database
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
