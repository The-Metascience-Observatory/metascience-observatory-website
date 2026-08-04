"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useIsMobile } from "@/components/useIsMobile";
import {
  SUCCESS_DEF_OPTIONS,
  classifyRowByDef,
  toBinary,
  toNumber,
  type AnyRecord,
  type SuccessDef,
} from "@/lib/replicationOutcome";
import { SuccessRateNote } from "@/components/SuccessRateNote";
import { absZFromR, fitZCurve, type ZCurveResult } from "@/lib/zcurve";
import { correlate } from "@/lib/correlation";

type FredResponse = {
  columns: string[];
  rows: AnyRecord[];
};

// Fixed significance-threshold bins for the original finding's p-value.
// Only originally-significant findings (p < 0.05) are charted, so there is no
// "> 0.05" bin — a non-significant original has no comparable "replication rate".
const P_BINS: { label: string; lo: number; hi: number }[] = [
  { label: "< 0.001", lo: 0, hi: 0.001 },
  { label: "0.001–0.01", lo: 0.001, hi: 0.01 },
  { label: "0.01–0.02", lo: 0.01, hi: 0.02 },
  { label: "0.02–0.03", lo: 0.02, hi: 0.03 },
  { label: "0.03–0.04", lo: 0.03, hi: 0.04 },
  { label: "0.04–0.05", lo: 0.04, hi: 0.05 },
];

// Minimum number of effect replications in a bin before we draw a rate bar.
const MIN_N = 10;

type PBin = {
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

// Build a PBin from success/failure tallies, sharing the Wilson CI and the
// "below MIN_N ⇒ don't score" convention used across all three bar sets.
function makeBin(label: string, success: number, failure: number): PBin {
  const total = success + failure;
  const [ciLow, ciHigh] = wilsonCI(success, total);
  return {
    label,
    success,
    failure,
    total,
    rate: total >= MIN_N ? (success / total) * 100 : -1,
    ciLow,
    ciHigh,
  };
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

// Correlation-table formatting: 3 dp throughout, with a floor on tiny p-values
// so the column never reads "0.000".
const fmtR = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : "\u2014");
const fmtP = (v: number) =>
  !Number.isFinite(v) ? "\u2014" : v < 0.001 ? "< 0.001" : v.toFixed(3);

// Chart 2: the six range bins (blue, exact p-values only) followed by a separated
// group of imputed "p < X" bound bars (amber), so studies whose original p was only
// reported as an upper bound are visible rather than silently dropped.
function PValueBarsWithBounds({ rangeBins, boundBars, showCI }: { rangeBins: PBin[]; boundBars: PBin[]; showCI: boolean }) {
  const isMobile = useIsMobile();
  const width = isMobile ? 380 : 720;
  // Bottom margin is trimmed to just clear the lowest content (the two legend
  // captions at innerH + 44 desktop / + 64 mobile) rather than the ~37 units of
  // dead space it used to reserve; height moves with it so innerH is unchanged.
  const height = isMobile ? 357 : 346;
  const margin = isMobile ? { top: 12, right: 8, bottom: 74, left: 44 } : { top: 16, right: 16, bottom: 54, left: 62 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const nBars = rangeBins.length + boundBars.length;
  const barGap = isMobile ? 4 : 10;
  const groupGap = isMobile ? 16 : 34; // extra space between the range group and the bound group
  // Reserve the edge insets BEFORE sizing the bars. Without this the bar width
  // formula consumed the whole of innerW, which drove offsetX to 0 and left the
  // first bar sitting flush against the y-axis.
  const padLeft = barGap;
  const padRight = isMobile ? 10 : 16;
  const barWidth = Math.max(
    isMobile ? 12 : 18,
    Math.min(
      isMobile ? 40 : 60,
      (innerW - padLeft - padRight - barGap * (nBars - 1) - groupGap) / Math.max(nBars, 1),
    ),
  );

  // "0.001–0.01" → ".001–.01": shorter labels for the narrow mobile bands.
  const binLabel = (label: string) => (isMobile ? label.replace(/0\./g, ".") : label);
  const totalBarsWidth = nBars * barWidth + (nBars - 1) * barGap + (boundBars.length > 0 ? groupGap : 0);
  const offsetX = Math.max(padLeft, (innerW - totalBarsWidth) / 2);

  // x of bar i (a group gap is inserted before the first bound bar)
  const xAt = (i: number) =>
    offsetX + i * (barWidth + barGap) + (i >= rangeBins.length ? groupGap : 0);

  // Horizontal centre of the bars from index `from` to `to` inclusive, so each
  // caption can sit centred under the group it labels.
  const groupCentre = (from: number, to: number) => (xAt(from) + xAt(to) + barWidth) / 2;

  const yScale = (v: number) => innerH - (v / 100) * innerH;
  const yTicks = [0, 20, 40, 60, 80, 100];

  const bars = [
    ...rangeBins.map((bin) => ({ bin, color: "#4f77bd" })),
    ...boundBars.map((bin) => ({ bin, color: "#a9761f" })),
  ];
  const dividerX =
    rangeBins.length > 0 && boundBars.length > 0
      ? xAt(rangeBins.length) - barGap / 2 - groupGap / 2
      : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMid meet"
        width={width}
        className="block max-w-full h-auto"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#d1d5db" strokeWidth={0.5} />
              <line x1={-6} x2={0} y1={yScale(t)} y2={yScale(t)} stroke="#000000" strokeWidth={1} />
              <text x={isMobile ? -8 : -10} y={yScale(t)} dy="0.32em" textAnchor="end" className="fill-current" style={{ fontSize: isMobile ? 10 : 12 }}>{t}%</text>
            </g>
          ))}
          <line x1={0} x2={0} y1={0} y2={innerH} stroke="#000000" strokeWidth={1} />
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#000000" strokeWidth={1} />
          {dividerX != null && (
            <line x1={dividerX} x2={dividerX} y1={0} y2={innerH} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
          )}
          {bars.map(({ bin, color }, i) => {
            const bx = xAt(i);
            const cx = bx + barWidth / 2;
            const insufficientData = bin.rate < 0;
            const barH = insufficientData ? 0 : (bin.rate / 100) * innerH;
            const by = innerH - barH;
            return (
              <g key={`${bin.label}-${i}`}>
                <title>
                  {insufficientData
                    ? `${bin.label}: insufficient data (${bin.total} replications)`
                    : `${bin.label}: ${bin.rate.toFixed(1)}% success (${bin.success}/${bin.total}) · 95% CI [${bin.ciLow.toFixed(1)}%–${bin.ciHigh.toFixed(1)}%]`}
                </title>
                {insufficientData ? (
                  <text x={cx} y={innerH - 24} textAnchor="middle" className="fill-current" style={{ fontSize: 8, opacity: 0.4 }}>
                    <tspan x={cx} dy="0">not</tspan>
                    <tspan x={cx} dy="10">enough</tspan>
                    <tspan x={cx} dy="10">data</tspan>
                  </text>
                ) : (
                  <>
                    <rect x={bx} y={by} width={barWidth} height={Math.max(barH, 2)} fill={color} fillOpacity={0.85} rx={1} />
                    {showCI && (
                      <>
                        <line x1={cx} x2={cx} y1={yScale(bin.ciLow)} y2={yScale(bin.ciHigh)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                        <line x1={cx - 4} x2={cx + 4} y1={yScale(bin.ciHigh)} y2={yScale(bin.ciHigh)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                        <line x1={cx - 4} x2={cx + 4} y1={yScale(bin.ciLow)} y2={yScale(bin.ciLow)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                      </>
                    )}
                    <text x={cx} y={(showCI ? yScale(bin.ciHigh) : by) - 4} textAnchor="middle" className="fill-current" style={{ fontSize: isMobile ? 8.5 : 10, opacity: 0.75 }}>n={bin.total}</text>
                  </>
                )}
                {/* Rotated on mobile: up to ~10 bars leave only a ~32-unit pitch per label. */}
                <text
                  x={cx}
                  y={innerH + (isMobile ? 12 : 16)}
                  textAnchor={isMobile ? "end" : "middle"}
                  transform={isMobile ? `rotate(-40 ${cx} ${innerH + 12})` : undefined}
                  className="fill-current"
                  style={{ fontSize: isMobile ? 8.5 : 10 }}
                >
                  {binLabel(bin.label)}
                </text>
              </g>
            );
          })}
          {rangeBins.length > 0 && (
            <text x={groupCentre(0, rangeBins.length - 1)} y={innerH + (isMobile ? 52 : 44)} textAnchor="middle" style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, fill: "#4f77bd" }}>
              {isMobile ? "blue: exact p-values" : "p-values reported exactly"}
            </text>
          )}
          {boundBars.length > 0 && (
            <text x={groupCentre(rangeBins.length, nBars - 1)} y={innerH + (isMobile ? 64 : 44)} textAnchor="middle" style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, fill: "#8a5f19" }}>
              {isMobile ? "amber: reported only as a bound" : "reported only as a bound"}
            </text>
          )}
          <text x={-innerH / 2} y={isMobile ? -34 : -48} textAnchor="middle" transform="rotate(-90)" className="text-xs fill-current" style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700 }}>Replication Success Rate (%)</text>
        </g>
      </svg>
    </div>
  );
}

// Histogram of significant |z| with the fitted z-curve mixture density overlaid.
function ZCurvePlot({ fit }: { fit: ZCurveResult }) {
  const isMobile = useIsMobile();
  const width = isMobile ? 380 : 720;
  const height = isMobile ? 250 : 300;
  const margin = isMobile ? { top: 12, right: 8, bottom: 44, left: 44 } : { top: 16, right: 16, bottom: 50, left: 62 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const zCrit = 1.96;
  const zMax = 6;
  const binW = 0.2;
  const nBins = Math.ceil((zMax - zCrit) / binW);

  // Histogram counts of the significant z's.
  const counts = new Array(nBins).fill(0);
  for (const z of fit.zValues) {
    let idx = Math.floor((z - zCrit) / binW);
    if (idx < 0) idx = 0;
    if (idx >= nBins) idx = nBins - 1;
    counts[idx]++;
  }
  const n = fit.zValues.length || 1;

  // Convert counts and the fitted density to a common "density" scale (area = 1
  // over [zCrit, zMax]) so the curve overlays the histogram.
  const histDensity = counts.map((c) => c / n / binW);
  const curvePts: { x: number; y: number }[] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const z = zCrit + (i / steps) * (zMax - zCrit);
    curvePts.push({ x: z, y: fit.density(z) });
  }
  const yMax = Math.max(...histDensity, ...curvePts.map((p) => p.y), 0.1) * 1.1;

  const xScale = (z: number) => ((z - zCrit) / (zMax - zCrit)) * innerW;
  const yScale = (d: number) => innerH - (d / yMax) * innerH;

  const xTicks = isMobile ? [1.96, 3, 4, 5, 6] : [1.96, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet" width={width} className="block max-w-full h-auto">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* histogram bars */}
          {histDensity.map((d, i) => {
            const x = xScale(zCrit + i * binW);
            const w = xScale(zCrit + (i + 1) * binW) - x;
            const y = yScale(d);
            return <rect key={i} x={x} y={y} width={Math.max(w - 0.5, 0.5)} height={innerH - y} fill="#cbd5e1" />;
          })}
          {/* fitted density curve */}
          <path
            d={curvePts.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(2)} ${yScale(p.y).toFixed(2)}`).join(" ")}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
          />
          <line x1={0} x2={0} y1={0} y2={innerH} stroke="#000000" strokeWidth={1} />
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#000000" strokeWidth={1} />
          {/* significance threshold */}
          <line x1={xScale(zCrit)} x2={xScale(zCrit)} y1={0} y2={innerH} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" />
          <text x={xScale(zCrit) + 4} y={12} className="fill-current" style={{ fontSize: isMobile ? 9 : 10, fill: "#ef4444" }}>z = 1.96</text>
          {/* x axis */}
          {xTicks.map((t) => (
            <g key={t}>
              <line x1={xScale(t)} x2={xScale(t)} y1={innerH} y2={innerH + 5} stroke="#000000" strokeWidth={1} />
              <text x={xScale(t)} y={innerH + 17} textAnchor="middle" className="fill-current" style={{ fontSize: isMobile ? 9 : 10 }}>{t}</text>
            </g>
          ))}
          <text x={innerW / 2} y={innerH + (isMobile ? 34 : 38)} textAnchor="middle" className="text-xs fill-current" style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700 }}>
            Absolute z-score of the original finding
          </text>
          <text x={-innerH / 2} y={isMobile ? -34 : -48} textAnchor="middle" transform="rotate(-90)" className="text-xs fill-current" style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700 }}>
            Density
          </text>
        </g>
      </svg>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 min-w-[8rem]">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">{sub}</div>}
    </div>
  );
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

export default function ByPValuePage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successDef, setSuccessDef] = useState<SuccessDef>("reported");
  // Off by default: the whiskers crowd the bars and most readers want the rates.
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

  // Two bar sets, computed in one pass:
  //  • chart2RangeBins – six range bins built from EXACT p-values only.
  //  • chart2BoundBars – imputed "p < X" bounds pulled out as their own bars, grouped by
  //                       cutoff (only groups with ≥ MIN_N are kept).
  // Both exclude null originals (p ≥ 0.05) from the range bins; the bound bars keep
  // "p < .05" because that is a genuinely significant (if imprecise) finding.
  const { chart2RangeBins, chart2BoundBars } = useMemo(() => {
    const c2 = P_BINS.map(() => ({ success: 0, failure: 0 }));
    const boundGroups = [
      { key: "lt001", label: "p < .001", success: 0, failure: 0 },
      { key: "lt01", label: "p < .01", success: 0, failure: 0 },
      { key: "lt05", label: "p < .05", success: 0, failure: 0 },
    ];
    const bump = (g: { success: number; failure: number }, ok: boolean) =>
      ok ? g.success++ : g.failure++;

    if (data) {
      for (const row of data.rows) {
        const p = toNumber(row.original_p_value);
        if (p == null || p < 0) continue;
        const outcome = classifyRow(row, successDef);
        if (outcome == null) continue;
        const ok = outcome === "success";
        const isLt = String(row.original_p_value_type ?? "").trim() === "<";

        // Chart 2 imputed-bound bars: significant bounds only (p ≤ 0.05).
        if (isLt && p <= 0.05) {
          // Each bound joins the tightest conventional threshold it still
          // satisfies, so "p < .005" sits with .01 and "p < .02"/"p < .048" with
          // .05. Every bar label is therefore literally true of every row in it.
          // This replaces an "other bounds" catch-all that mixed cutoffs from
          // .002 to .048 into one uninterpretable bar.
          if (p <= 0.001) bump(boundGroups[0], ok);
          else if (p <= 0.01) bump(boundGroups[1], ok);
          else bump(boundGroups[2], ok);
        }

        // Range bins exclude null originals (also drops exact-0.05 and "p < .05").
        if (p >= 0.05) continue;

        // Range bars are EXACT p-values only; an imputed "p < X" is a bound and
        // is shown separately in the bound bars above.
        if (!isLt) {
          const idx = P_BINS.findIndex((b) => p >= b.lo && p < b.hi);
          if (idx >= 0) bump(c2[idx], ok);
        }
      }
    }

    return {
      chart2RangeBins: P_BINS.map((b, i) => makeBin(b.label, c2[i].success, c2[i].failure)),
      chart2BoundBars: boundGroups
        .map((g) => makeBin(g.label, g.success, g.failure))
        .filter((b) => b.total >= MIN_N),
    };
  }, [data, successDef]);

  const totalReplications =
    chart2RangeBins.reduce((s, b) => s + b.total, 0) +
    chart2BoundBars.reduce((s, b) => s + b.total, 0);

  // Correlation between the original p-value and replication success, over the
  // same rows chart 2's range bars use: EXACT p-values only (an imputed "p < .01"
  // is a bound, not a measurement) and originally significant (0 < p < .05).
  // Three measures because the raw-p Pearson understates a relationship that is
  // monotonic but strongly non-linear across four orders of magnitude.
  const correlations = useMemo(() => {
    if (!data) return null;
    const ps: number[] = [];
    const oks: number[] = [];
    for (const row of data.rows) {
      if (String(row.original_p_value_type ?? "").trim() === "<") continue;
      const pv = toNumber(row.original_p_value);
      if (pv == null || pv <= 0 || pv >= 0.05) continue;
      const outcome = classifyRow(row, successDef);
      if (outcome == null) continue;
      ps.push(pv);
      oks.push(outcome === "success" ? 1 : 0);
    }
    if (ps.length < 10) return null;
    return {
      n: ps.length,
      raw: correlate(ps, oks),
      log: correlate(ps.map((v) => Math.log10(v)), oks),
      rank: correlate(ps, oks, "spearman"),
    };
  }, [data, successDef]);

  // z-curve: fit on the significant original test statistics that also have a
  // replication outcome, so the model-predicted rate (ERR) describes exactly the
  // studies whose observed rate we measure. ERR/EDR depend only on the z's; the
  // observed rate follows the selected success definition.
  const zcurve = useMemo(() => {
    if (!data) return null;
    const zValues: number[] = [];
    let success = 0;
    let failure = 0;
    for (const row of data.rows) {
      const z = absZFromR(toNumber(row.original_es_r), toNumber(row.original_n));
      if (z == null || z < 1.96) continue; // significant originals only
      const outcome = classifyRow(row, successDef);
      if (outcome == null) continue; // require a replication outcome
      zValues.push(z);
      if (outcome === "success") success++;
      else failure++;
    }
    const total = success + failure;
    const [obsLo, obsHi] = wilsonCI(success, total);
    const fit: ZCurveResult | null = total >= 20 ? fitZCurve(zValues, { bootstrap: 500 }) : null;
    return {
      fit,
      total,
      success,
      failure,
      observedRate: total > 0 ? success / total : 0,
      observedCI: [obsLo / 100, obsHi / 100] as [number, number],
    };
  }, [data, successDef]);

  if (loading) return <main className="min-h-screen px-6 py-10">Loading…</main>;
  if (error || !data) return <main className="min-h-screen px-6 py-10">Failed to load: {error || "No data"}</main>;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Replication rate by p-value of the original finding
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Effect-level analysis: each replication is placed in a bin according to the p-value
              reported for the <em>original</em> finding, and we show what fraction of replications in
              each bin were successful. Only <strong>originally-significant</strong> findings (original
              p &lt; 0.05) are included ({totalReplications.toLocaleString()} replications under the
              current definition) — when the original found no effect, &ldquo;replication rate&rdquo; is
              not comparable. Bins with fewer than {MIN_N} replications are not scored. Wilson 95%
              confidence intervals can be shown with the checkbox below.
            </p>
            <SuccessRateNote
              def={successDef}
              unit="effect"
              n={totalReplications}
              filter="originals with a recorded p-value below 0.05"
              className="mt-2"
            />
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Findings just under the conventional p = 0.05 threshold tend to replicate less often.
              About a fifth of original p-values are recorded only as an upper bound
              (&ldquo;p &lt; X&rdquo;): the first chart charts such a bound only when X ≤ 0.001 (it
              clearly belongs in the &lt; 0.001 bar); the second chart shows the coarser bounds
              (p &lt; .01, p &lt; .05, …) as their own bars.
            </p>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-6">
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
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 w-fit cursor-pointer">
              <input
                type="checkbox"
                checked={showCI}
                onChange={(e) => setShowCI(e.target.checked)}
                className="h-4 w-4 accent-[#4f77bd] cursor-pointer"
              />
              Show 95% confidence intervals
            </label>
          </div>

          {/* Chart 2 — including imputed bounds */}
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Replication rate by p-value of original finding</h2>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 w-fit max-w-full">
              <PValueBarsWithBounds rangeBins={chart2RangeBins} boundBars={chart2BoundBars} showCI={showCI} />
            </div>
          </div>

          {/* Correlation between the original p-value and replication success */}
          {correlations && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                Correlation between p-value and replication rate
              </h2>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 w-fit max-w-full overflow-x-auto">
                <table className="text-sm tabular-nums">
                  <thead>
                    <tr className="text-left border-b border-gray-300 dark:border-gray-600">
                      <th className="py-1.5 pr-8 font-semibold">Measure</th>
                      <th className="py-1.5 pr-8 font-semibold">r</th>
                      <th className="py-1.5 pr-8 font-semibold">95% CI</th>
                      <th className="py-1.5 font-semibold">p</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Pearson (point-biserial), raw p-value", e: correlations.raw },
                      { label: "Pearson (point-biserial), log\u2081\u2080 p-value", e: correlations.log },
                      { label: "Spearman \u03c1 (rank-based)", e: correlations.rank },
                    ].map(({ label, e }) => (
                      <tr
                        key={label}
                        className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <td className="py-1.5 pr-8">{label}</td>
                        <td className="py-1.5 pr-8">{fmtR(e.r)}</td>
                        <td className="py-1.5 pr-8">
                          [{fmtR(e.ciLow)}, {fmtR(e.ciHigh)}]
                        </td>
                        <td className="py-1.5">{fmtP(e.p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[70ch]">
                A <strong>negative</strong> coefficient means a larger original p-value goes with a
                lower replication rate. Computed on the {correlations.n.toLocaleString()} replication
                effects behind the blue bars above &mdash; exact p-values only (an imputed
                &ldquo;p &lt; .01&rdquo; is a bound, not a measurement), originally significant
                (0 &lt; p &lt; 0.05), and with a determinate outcome under the selected definition.
                Because the range is truncated at 0.05, all three understate the association
                across the full p-value scale. <strong>Spearman&rsquo;s &rho; is the one to trust
                here:</strong> it depends only on ordering, so it is immune both to the extreme
                skew of raw p-values and to the handful of reported p&rsquo;s that have underflowed
                to the smallest representable double (the minimum in this set is 5&nbsp;&times;
                10<sup>&minus;324</sup>, and about 12% of rows fall below 10<sup>&minus;10</sup>).
                Those same values are what drag the log&#8321;&#8320; row below the raw-p row,
                which is a property of the recorded precision rather than of the science.
              </p>
            </div>
          )}

          {/* z-curve: observed vs expected replication rate */}
          <section className="pt-8 mt-4 border-t border-gray-200 dark:border-gray-800 space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Observed vs. Expected Replication Rate (z-curve)
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                We convert each significant original finding to an absolute z-score and fit a{" "}
                <strong>z-curve</strong> (Bartoš &amp; Schimmack, 2020): a mixture model that accounts for the
                fact that the literature is selected for significance. From it we read off the{" "}
                <strong>Expected Replication Rate (ERR)</strong> — the mean statistical power of these studies,
                i.e. the replication rate you would expect if each were re-run at the same sample size — and the{" "}
                <strong>Expected Discovery Rate (EDR)</strong>, which bounds the false-positive contamination.
                The informative quantity is the <em>gap</em> between the observed and expected rate.
              </p>
            </div>

            {!zcurve || !zcurve.fit ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Not enough studies with both a computable original z-score and a replication outcome
                under the current definition{zcurve ? ` (only ${zcurve.total})` : ""}.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <Stat label="Observed replication rate" value={pct1(zcurve.observedRate)} sub={`${zcurve.success}/${zcurve.total} · 95% CI ${pct(zcurve.observedCI[0])}–${pct(zcurve.observedCI[1])}`} accent="#10b981" />
                  <Stat label="Expected (ERR)" value={pct1(zcurve.fit.err)} sub={`95% CI ${pct(zcurve.fit.errCI[0])}–${pct(zcurve.fit.errCI[1])}`} accent="#2563eb" />
                  <Stat label="Gap (observed − expected)" value={`${zcurve.observedRate - zcurve.fit.err >= 0 ? "+" : ""}${((zcurve.observedRate - zcurve.fit.err) * 100).toFixed(1)} pts`} />
                  <Stat label="Expected Discovery Rate (EDR)" value={pct1(zcurve.fit.edr)} sub={`95% CI ${pct(zcurve.fit.edrCI[0])}–${pct(zcurve.fit.edrCI[1])}`} />
                  <Stat label="Max false-discovery rate" value={pct(zcurve.fit.soricFDR)} sub="Soric bound at α = .05" />
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 w-fit max-w-full">
                  <ZCurvePlot fit={zcurve.fit} />
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 text-center">
                    Histogram of {zcurve.fit.nSignificant.toLocaleString()} significant original z-scores (grey)
                    with the fitted z-curve density (blue). z &gt; 6 is clamped to 6.
                  </p>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-2">
                  <p>
                    <strong>Why not just compute power from the original effects?</strong> Because published
                    original effects are inflated by selection (the winner&apos;s curse), so powering off them
                    overstates how often things should replicate. z-curve avoids this: it is a{" "}
                    <em>selection model</em> fit to the distribution of significant z-scores, and estimates the
                    mean power of the underlying population rather than trusting any single inflated estimate.
                  </p>
                  <p>
                    ERR corresponds to a &ldquo;statistically significant effect in the same direction, at the
                    same N&rdquo; notion of replication, so it is most directly comparable to the observed rate
                    under the <em>&ldquo;statistically significant effect in the same direction&rdquo;</em>{" "}
                    definition in the dropdown above. ERR and EDR are derived from the original z-scores only and
                    do not change with the success definition; the observed rate and the gap do.
                    z is derived from each study&apos;s original r and N; only studies with a replication outcome
                    are included.
                  </p>
                </div>
              </>
            )}
          </section>

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
