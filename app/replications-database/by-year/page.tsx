"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  SUCCESS_DEF_OPTIONS,
  classifyRowByDef,
  toBinary,
  toNumber,
  type AnyRecord,
  type SuccessDef,
} from "@/lib/replicationOutcome";
import { SuccessRateNote } from "@/components/SuccessRateNote";
import { ChartWatermark } from "@/components/ChartWatermark";
import { useIsMobile } from "@/components/useIsMobile";

type FredResponse = {
  columns: string[];
  rows: AnyRecord[];
};

const SUCCESS_COLOR = "#10b981";
const FAILURE_COLOR = "#f87171";
const OTHER_COLOR = "#cbd5e1";
// Bars in the success-rate charts (the counts chart keeps the green/red stack).
const RATE_BAR_COLOR = "#4f77bd";

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
 * Classify a single row under the chosen definition, per the frozen site-wide
 * rule in lib/replicationOutcome: reversal counts as a failure, inconclusive and
 * unrecorded outcomes are excluded from the denominator. Returns null when the
 * row falls outside the denominator.
 *
 * This is a thin alias over the shared helper so the rule cannot drift: the
 * previous local copy on this page dropped reversals under "reported" but
 * counted them as failures under every statistical criterion, so changing the
 * dropdown silently changed the denominator as well as the criterion.
 */
function classifyRow(row: AnyRecord, def: SuccessDef): "success" | "failure" | null {
  return toBinary(classifyRowByDef(row, def));
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
  unitPlural,
}: {
  counts: YearCount[];
  xLabel: string;
  yLabel?: string;
  unit?: string;
  unitPlural?: string;
}) {
  const isMobile = useIsMobile();
  const width = isMobile ? 380 : 720;
  const height = isMobile ? 276 : 299;
  const margin = isMobile ? { top: 8, right: 8, bottom: 40, left: 36 } : { top: 10, right: 16, bottom: 46, left: 62 };
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
  // Year labels need a wider pitch on mobile (~34 units per "1975" at 9px).
  const tickEvery = isMobile
    ? range > 30 ? 10 : range > 12 ? 5 : 2
    : range > 12 ? 5 : range > 6 ? 2 : 1;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#d1d5db" strokeWidth={0.5} />
              <line x1={-6} x2={0} y1={yScale(t)} y2={yScale(t)} stroke="#000000" strokeWidth={1} />
              <text x={isMobile ? -8 : -10} y={yScale(t)} dy="0.32em" textAnchor="end" className="fill-black dark:fill-gray-100" style={{ fontSize: isMobile ? 9 : 12 }}>
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
                  {`${c.year}: ${c.total.toLocaleString()} ${c.total === 1 ? unit : unitPlural ?? `${unit}s`} — ${c.success} successful, ${c.failure} failed, ${c.other} inconclusive/unclassified`}
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
                <text x={cx} y={innerH + (isMobile ? 15 : 17)} textAnchor="middle" className="fill-black dark:fill-gray-100" style={{ fontSize: isMobile ? 9 : 11 }}>
                  {c.year}
                </text>
              </g>
            );
          })}
          <text x={-innerH / 2} y={isMobile ? -26 : -48} textAnchor="middle" transform="rotate(-90)" className="fill-black dark:fill-gray-100" style={{ fontSize: isMobile ? 11 : 14, fontWeight: 700 }}>
            {yLabel}
          </text>
          <text x={innerW / 2} y={innerH + (isMobile ? 34 : 40)} textAnchor="middle" className="fill-black dark:fill-gray-100" style={{ fontSize: isMobile ? 11 : 14, fontWeight: 700 }}>
            {xLabel}
          </text>
          <ChartWatermark />
          {/* legend (top-left of the plot, publication style) */}
          <g transform={isMobile ? "translate(10,20)" : "translate(12,24)"}>
            <rect x={0} y={0} width={isMobile ? 150 : 186} height={isMobile ? 48 : 60} fill="#ffffff" stroke="#9ca3af" strokeWidth={0.75} />
            {[
              { label: "Successful", color: SUCCESS_COLOR },
              { label: "Failed", color: FAILURE_COLOR },
              { label: "Inconclusive / unclassified", color: OTHER_COLOR },
            ].map((item, i) => (
              <g key={item.label} transform={isMobile ? `translate(7,${7 + i * 13})` : `translate(9,${9 + i * 15})`}>
                <rect x={0} y={0} width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} fill={item.color} />
                <text x={isMobile ? 13 : 16} y={isMobile ? 7.5 : 9} fill="#000000" style={{ fontSize: isMobile ? 9 : 11 }}>
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

// Replication success rate per 5-year bin, with optional Wilson 95% CI whiskers.
function YearRateBars({ bins, xLabel, unit, showN = true, showCI = false, showRate = true }: { bins: YearBin[]; xLabel: string; unit: string; showN?: boolean; showCI?: boolean; showRate?: boolean }) {
  const isMobile = useIsMobile();
  const width = isMobile ? 380 : 720;
  const height = isMobile ? 300 : 318;
  const margin = isMobile ? { top: 8, right: 8, bottom: 64, left: 36 } : { top: 10, right: 16, bottom: 74, left: 62 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const barGap = isMobile ? 5 : 8;
  const barWidth = Math.max(isMobile ? 10 : 14, Math.min(isMobile ? 44 : 70, (innerW - barGap * (bins.length - 1)) / bins.length));
  const totalBarsWidth = bins.length * barWidth + (bins.length - 1) * barGap;
  const offsetX = (innerW - totalBarsWidth) / 2;

  const yScale = (v: number) => innerH - (v / 100) * innerH;
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#d1d5db" strokeWidth={0.5} />
              <line x1={-6} x2={0} y1={yScale(t)} y2={yScale(t)} stroke="#000000" strokeWidth={1} />
              <text x={isMobile ? -8 : -10} y={yScale(t)} dy="0.32em" textAnchor="end" className="fill-black dark:fill-gray-100" style={{ fontSize: isMobile ? 10 : 12 }}>
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
                    <rect x={bx} y={by} width={barWidth} height={Math.max(barH, 2)} fill={RATE_BAR_COLOR} fillOpacity={0.85} rx={1} />
                    {showCI && (
                      <>
                        {/* Wilson 95% CI whisker */}
                        <line x1={cx} x2={cx} y1={yScale(bin.ciLow)} y2={yScale(bin.ciHigh)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                        <line x1={cx - 4} x2={cx + 4} y1={yScale(bin.ciHigh)} y2={yScale(bin.ciHigh)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                        <line x1={cx - 4} x2={cx + 4} y1={yScale(bin.ciLow)} y2={yScale(bin.ciLow)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                      </>
                    )}
                    {/* rate label above the bar (or the upper CI whisker), clamped
                        so labels on ~100% bars stay inside the plot */}
                    {(() => {
                      const anchor = Math.max(showCI ? Math.min(yScale(bin.ciHigh), by) : by, showN && showRate ? 30 : 16);
                      return (
                        <>
                          {showN && (
                            <text x={cx} y={anchor - 4} textAnchor="middle" className="fill-current" style={{ fontSize: isMobile ? 8 : 9, opacity: 0.75 }}>
                              n={bin.total}
                            </text>
                          )}
                          {showRate && (
                            <text
                              x={cx}
                              y={anchor - (showN ? (barWidth < 30 ? 15 : 16) : 5)}
                              textAnchor="middle"
                              fontWeight={600}
                              fill="currentColor"
                              style={{ fontSize: isMobile ? (barWidth < 30 ? 9 : 10) : barWidth < 30 ? 10 : 12 }}
                            >
                              {bin.rate.toFixed(0)}%
                            </text>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
                <text
                  x={cx}
                  y={innerH + 14}
                  textAnchor="end"
                  transform={`rotate(-40 ${cx} ${innerH + 14})`}
                  className="fill-black dark:fill-gray-100"
                  style={{ fontSize: isMobile ? 9 : 11 }}
                >
                  {bin.label}
                </text>
              </g>
            );
          })}
          <ChartWatermark />
          <text x={-innerH / 2} y={isMobile ? -26 : -48} textAnchor="middle" transform="rotate(-90)" className="fill-black dark:fill-gray-100" style={{ fontSize: isMobile ? 11 : 14, fontWeight: 700 }}>
            Replication Success Rate (%)
          </text>
          <text x={innerW / 2} y={innerH + (isMobile ? 56 : 68)} textAnchor="middle" className="fill-black dark:fill-gray-100" style={{ fontSize: isMobile ? 11 : 14, fontWeight: 700 }}>
            {xLabel}
          </text>
        </g>
      </svg>
    </div>
  );
}

// Options for each dropdown are counted over the rows that pass every
// *other* row filter, so the numbers always describe what selecting that
// option would actually give you. The currently selected value is kept in
// its own list even when the cross-filter drops it to zero, otherwise the
// <select> would render blank with no way back.
const buildOptions = (
  rows: AnyRecord[],
  field: "discipline" | "replication_type",
  passesOtherFilters: (row: AnyRecord) => boolean,
  selected: string,
) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = String(row[field] ?? "").trim();
    if (!v) continue;
    if (!counts.has(v)) counts.set(v, 0);
    if (passesOtherFilters(row)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([name, count]) => count > 0 || name === selected)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
};

export default function ByYearPage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successDef, setSuccessDef] = useState<SuccessDef>("reported");
  const [discipline, setDiscipline] = useState<string>("all");
  const [replicationType, setReplicationType] = useState<string>("all");
  const [analysisLevel, setAnalysisLevel] = useState<"effect" | "paper">("paper");
  const [paperThreshold, setPaperThreshold] = useState<number>(0.75);
  const [minN, setMinN] = useState<number>(10);
  const [showCI, setShowCI] = useState(false);

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

  // Distinct disciplines present in the data, most common first. Counts
  // respect the replication-type filter.
  const disciplineOptions = useMemo(() => {
    if (!data) return [];
    return buildOptions(
      data.rows,
      "discipline",
      (row) =>
        replicationType === "all" ||
        String(row.replication_type ?? "").trim() === replicationType,
      discipline,
    );
  }, [data, replicationType, discipline]);

  // Distinct replication types present in the data, most common first. Counts
  // respect the discipline filter.
  const replicationTypeOptions = useMemo(() => {
    if (!data) return [];
    return buildOptions(
      data.rows,
      "replication_type",
      (row) =>
        discipline === "all" || String(row.discipline ?? "").trim() === discipline,
      replicationType,
    );
  }, [data, discipline, replicationType]);

  const agg = useMemo(() => {
    if (!data) return null;
    // The counts chart is keyed by the replication's publication year; the
    // success-rate charts are keyed by the original study's publication year.
    const parseYear = (v: unknown): number | null => {
      const y = toNumber(v);
      if (y == null || !Number.isFinite(y) || y <= 1900 || y >= 2100) return null;
      return Math.round(y);
    };

    // Counts chart: distinct replication studies grouped by replication_url,
    // placed at the study's earliest replication year. This chart is always
    // study-level — it ignores the level-of-analysis and threshold controls.
    const studyMap = new Map<string, { year: number | null; success: number; denom: number }>();
    // Effect-level success/failure tallies by original-study year.
    const rateOrigYear = new Map<number, { success: number; failure: number }>();
    // Paper-level grouping by original_url for the rate charts, keyed by the
    // original study's publication year. classifyRow handles every definition
    // (incl. "reported"), so inconclusive/blank rows stay out of the
    // denominators and reversals count as failures — consistent with the
    // effect level.
    const paperMap = new Map<string, { origYear: number | null; success: number; denom: number }>();

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      if (discipline !== "all" && String(row.discipline ?? "").trim() !== discipline) continue;
      if (replicationType !== "all" && String(row.replication_type ?? "").trim() !== replicationType) continue;
      const repYear = parseYear(row.replication_year);
      const origYear = parseYear(row.original_year);
      const outcome = classifyRow(row, successDef);

      // Study grouping for the counts chart (rows without a replication URL
      // each count as their own study).
      const repUrl = String(row.replication_url ?? "").trim();
      const studyKey = repUrl || `row-${i}`;
      let s = studyMap.get(studyKey);
      if (!s) {
        s = { year: null, success: 0, denom: 0 };
        studyMap.set(studyKey, s);
      }
      if (repYear != null) s.year = s.year == null ? repYear : Math.min(s.year, repYear);
      if (outcome != null) {
        s.denom++;
        if (outcome === "success") s.success++;
      }

      if (analysisLevel === "effect") {
        if (origYear != null && outcome != null) {
          let e = rateOrigYear.get(origYear);
          if (!e) {
            e = { success: 0, failure: 0 };
            rateOrigYear.set(origYear, e);
          }
          if (outcome === "success") e.success++;
          else e.failure++;
        }
      } else {
        const url = String(row.original_url ?? "").trim();
        if (!url) continue;
        let p = paperMap.get(url);
        if (!p) {
          p = { origYear: null, success: 0, denom: 0 };
          paperMap.set(url, p);
        }
        if (origYear != null) p.origYear = p.origYear == null ? origYear : Math.min(p.origYear, origYear);
        if (outcome != null) {
          p.denom++;
          if (outcome === "success") p.success++;
        }
      }
    }

    // Per-year study tallies for the counts chart. A study counts as a
    // success when at least half of its classified effect replications
    // succeeded; studies with no classified effects land in `other`.
    const countSource = new Map<number, { success: number; failure: number; other: number }>();
    for (const s of Array.from(studyMap.values())) {
      if (s.year == null) continue;
      let c = countSource.get(s.year);
      if (!c) {
        c = { success: 0, failure: 0, other: 0 };
        countSource.set(s.year, c);
      }
      if (s.denom === 0) c.other++;
      else if (s.success / s.denom >= 0.5) c.success++;
      else c.failure++;
    }

    // Success/failure per original-study year for the rate charts, at the
    // selected level of analysis. Paper level calls a paper a success when at
    // least the threshold share of its classified effect replications
    // succeeded (same rule as the main replications-database page).
    let rateByYear: Map<number, { success: number; failure: number }>;
    if (analysisLevel === "effect") {
      rateByYear = rateOrigYear;
    } else {
      rateByYear = new Map();
      for (const p of Array.from(paperMap.values())) {
        if (p.origYear == null || p.denom === 0) continue;
        const ok = p.success / p.denom >= paperThreshold;
        let e = rateByYear.get(p.origYear);
        if (!e) {
          e = { success: 0, failure: 0 };
          rateByYear.set(p.origYear, e);
        }
        if (ok) e.success++;
        else e.failure++;
      }
    }
    if (countSource.size === 0 && rateByYear.size === 0) return null;

    // The counts chart starts at 1945; earlier rows still count toward the
    // rate bins.
    const counts: YearCount[] = [];
    if (countSource.size > 0) {
      const countYears = Array.from(countSource.keys());
      const cMin = Math.min(...countYears);
      const cMax = Math.max(...countYears);
      for (let y = Math.max(cMin, 1945); y <= cMax; y++) {
        const e = countSource.get(y) ?? { success: 0, failure: 0, other: 0 };
        counts.push({ year: y, ...e, total: e.success + e.failure + e.other });
      }
    }

    // 5-year rate bins over original-study years, with everything before
    // BIN_START collapsed into one bin. Bins stop at 2024 — later years are
    // still filling in.
    let bins: YearBin[] = [];
    let recentBins: YearBin[] = [];
    if (rateByYear.size > 0) {
      const rateYears = Array.from(rateByYear.keys());
      const minYear = Math.min(...rateYears);
      const maxYear = Math.max(...rateYears);
      const binMax = Math.min(maxYear, 2024);
      const binDefs: { label: string; lo: number; hi: number }[] = [];
      const start = Math.max(BIN_START, Math.floor(minYear / 5) * 5);
      if (minYear < start) binDefs.push({ label: `< ${start}`, lo: -Infinity, hi: start });
      for (let lo = start; lo <= binMax; lo += 5) {
        const hiYear = Math.min(lo + 4, binMax);
        binDefs.push({ label: hiYear === lo ? `${lo}` : `${lo}–${String(hiYear).slice(2)}`, lo, hi: lo + 5 });
      }

      bins = binDefs.map((b) => {
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
    }

    return { counts, bins, recentBins };
  }, [data, successDef, discipline, replicationType, analysisLevel, paperThreshold, minN]);

  if (loading) return <main className="min-h-screen px-6 py-10">Loading…</main>;
  if (error || !data) return <main className="min-h-screen px-6 py-10">Failed to load: {error || "No data"}</main>;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              <Link href="/replications-database" className="text-blue-600 dark:text-blue-400 hover:underline">
                ← Back to the replications database
              </Link>
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Replications by year</h1>
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
                  title="Applies to the success-rate charts only. A paper is considered successfully replicated if X% of effect replications for effects reported in that paper were successful. The threshold X can be shifted with the dropdown."
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
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCI}
                  onChange={(e) => setShowCI(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-gray-600 dark:text-gray-300">
                  Show Wilson 95% confidence intervals
                </span>
              </label>
            </div>
          </div>

          {!agg ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No replications with a recorded year under the current view.
            </p>
          ) : (
            <>
              {/* Counts per year (studies by replication publication year;
                  always study-level, independent of the level-of-analysis
                  controls) */}
              {agg.counts.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                    Studies publishing a replication per year
                    {discipline !== "all" ? ` — ${discipline}` : ""}
                  </h2>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-full max-w-[752px]">
                    <YearCountBars
                      counts={agg.counts}
                      xLabel="Year the replication study was published"
                      yLabel="# of replication studies"
                      unit="replication study"
                      unitPlural="replication studies"
                    />
                  </div>
                </section>
              )}

              {/* Success rate by 5-year bin (by original publication year) */}
              {agg.bins.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                    Replication success rate by year{analysisLevel === "paper" ? " (paper level)" : ""}{discipline !== "all" ? ` — ${discipline}` : ""}
                  </h2>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-full max-w-[752px]">
                    <YearRateBars bins={agg.bins} xLabel="Year the original study was published" unit={analysisLevel === "effect" ? "replications" : "papers"} showCI={showCI} />
                  </div>
                  <SuccessRateNote
                    def={successDef}
                    unit={analysisLevel}
                    n={agg.bins.reduce((acc, b) => acc + b.total, 0)}
                    threshold={analysisLevel === "paper" ? paperThreshold : undefined}
                    filter={`rows with a usable original publication year, bins of ${minN}+`}
                  />
                </section>
              )}

              {/* Success rate per single year, 2005–present */}
              {agg.recentBins.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                    Replication success rate by year, 2005–2024{analysisLevel === "paper" ? " (paper level)" : ""}{discipline !== "all" ? ` — ${discipline}` : ""}
                  </h2>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-full max-w-[752px]">
                    <YearRateBars
                      bins={agg.recentBins}
                      xLabel="Year the original study was published"
                      unit={analysisLevel === "effect" ? "replications" : "papers"}
                      showCI={showCI}
                      showRate={false}
                    />
                  </div>
                  <SuccessRateNote
                    def={successDef}
                    unit={analysisLevel}
                    n={agg.recentBins.reduce((acc, b) => acc + b.total, 0)}
                    threshold={analysisLevel === "paper" ? paperThreshold : undefined}
                    filter={`originals published 2005–2024, bins of ${minN}+`}
                  />
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
