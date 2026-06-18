"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getOutcomeForRow, toNumber, type OutcomeMethod, type AnyRecord } from "@/lib/replicationOutcome";
import { absZFromR, fitZCurve, type ZCurveResult } from "@/lib/zcurve";

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

// Fixed significance-threshold bins for the original finding's p-value.
const P_BINS: { label: string; lo: number; hi: number }[] = [
  { label: "< 0.001", lo: 0, hi: 0.001 },
  { label: "0.001–0.01", lo: 0.001, hi: 0.01 },
  { label: "0.01–0.02", lo: 0.01, hi: 0.02 },
  { label: "0.02–0.03", lo: 0.02, hi: 0.03 },
  { label: "0.03–0.04", lo: 0.03, hi: 0.04 },
  { label: "0.04–0.05", lo: 0.04, hi: 0.05 },
  { label: "> 0.05", lo: 0.05, hi: Infinity },
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

function PValueBars({ bins }: { bins: PBin[] }) {
  const width = 720;
  const height = 320;
  const margin = { top: 16, right: 16, bottom: 70, left: 52 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const barGap = 10;
  const barWidth = Math.max(20, Math.min(70, (innerW - barGap * (bins.length - 1)) / bins.length));
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
              <line x1={-6} x2={0} y1={yScale(t)} y2={yScale(t)} stroke="#111827" strokeWidth={1} />
              <text x={-10} y={yScale(t)} dy="0.32em" textAnchor="end" className="text-xs fill-current" style={{ opacity: 0.7 }}>{t}%</text>
            </g>
          ))}
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
                    <rect x={bx} y={by} width={barWidth} height={Math.max(barH, 2)} fill="#10b981" fillOpacity={0.85} rx={1} />
                    {/* Wilson 95% CI whisker */}
                    <line x1={cx} x2={cx} y1={yScale(bin.ciLow)} y2={yScale(bin.ciHigh)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                    <line x1={cx - 4} x2={cx + 4} y1={yScale(bin.ciHigh)} y2={yScale(bin.ciHigh)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                    <line x1={cx - 4} x2={cx + 4} y1={yScale(bin.ciLow)} y2={yScale(bin.ciLow)} stroke="#111827" strokeWidth={1} strokeOpacity={0.5} />
                    <text x={cx} y={yScale(bin.ciHigh) - 4} textAnchor="middle" className="fill-current" style={{ fontSize: 10, opacity: 0.75 }}>n={bin.total}</text>
                  </>
                )}
                <text x={cx} y={innerH + 16} textAnchor="middle" className="fill-current" style={{ fontSize: 11, opacity: 0.75 }}>{bin.label}</text>
              </g>
            );
          })}
          <text x={-innerH / 2} y={-40} textAnchor="middle" transform="rotate(-90)" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 11 }}>Replication Success Rate (%)</text>
          <text x={innerW / 2} y={innerH + 48} textAnchor="middle" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 11 }}>p-value of the Original Finding</text>
        </g>
      </svg>
    </div>
  );
}

// Histogram of significant |z| with the fitted z-curve mixture density overlaid.
function ZCurvePlot({ fit }: { fit: ZCurveResult }) {
  const width = 720;
  const height = 300;
  const margin = { top: 16, right: 16, bottom: 50, left: 52 };
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

  const xTicks = [1.96, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="max-w-full h-auto">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <rect x={0} y={0} width={innerW} height={innerH} fill="#f9fafb" />
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
          {/* significance threshold */}
          <line x1={xScale(zCrit)} x2={xScale(zCrit)} y1={0} y2={innerH} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" />
          <text x={xScale(zCrit) + 4} y={12} className="fill-current" style={{ fontSize: 10, fill: "#ef4444" }}>z = 1.96</text>
          {/* x axis */}
          {xTicks.map((t) => (
            <g key={t}>
              <line x1={xScale(t)} x2={xScale(t)} y1={innerH} y2={innerH + 5} stroke="#111827" strokeWidth={1} />
              <text x={xScale(t)} y={innerH + 17} textAnchor="middle" className="fill-current" style={{ fontSize: 10, opacity: 0.7 }}>{t}</text>
            </g>
          ))}
          <text x={innerW / 2} y={innerH + 38} textAnchor="middle" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 11 }}>
            Absolute z-score of the original finding
          </text>
          <text x={-innerH / 2} y={-40} textAnchor="middle" transform="rotate(-90)" className="text-xs fill-current" style={{ opacity: 0.6, fontSize: 11 }}>
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

  const bins: PBin[] = useMemo(() => {
    const counts = P_BINS.map(() => ({ success: 0, failure: 0 }));
    if (data) {
      for (const row of data.rows) {
        const p = toNumber(row.original_p_value);
        if (p == null || p < 0) continue;
        const outcome = classifyRow(row, successDef);
        if (outcome == null) continue;
        const idx = P_BINS.findIndex((b) => p >= b.lo && p < b.hi);
        if (idx < 0) continue;
        if (outcome === "success") counts[idx].success++;
        else counts[idx].failure++;
      }
    }
    return P_BINS.map((b, i) => {
      const { success, failure } = counts[i];
      const total = success + failure;
      const [ciLow, ciHigh] = wilsonCI(success, total);
      return {
        label: b.label,
        success,
        failure,
        total,
        rate: total >= MIN_N ? (success / total) * 100 : -1,
        ciLow,
        ciHigh,
      };
    });
  }, [data, successDef]);

  const totalReplications = bins.reduce((s, b) => s + b.total, 0);

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
              Replication Rate by p-value of the Original Finding
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Effect-level analysis: each replication is placed in a bin according to the p-value
              reported for the <em>original</em> finding, and we show what fraction of replications in
              each bin were successful. Only replications that record an original p-value are
              included ({totalReplications.toLocaleString()} replications under the current definition).
              Bins with fewer than {MIN_N} replications are not scored. Whiskers are Wilson 95% confidence intervals.
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Findings just under the conventional p = 0.05 threshold tend to replicate less often — but
              note that original p-values near 0.05 are also more vulnerable to publication and selection
              effects, so read the right-hand bins with care.
            </p>
          </div>

          {/* Controls */}
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

          {/* Chart */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <PValueBars bins={bins} />
          </div>

          {/* Companion table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                  <th className="p-2 text-left font-medium">Original p-value</th>
                  <th className="p-2 text-right font-medium">Successful</th>
                  <th className="p-2 text-right font-medium">Failed</th>
                  <th className="p-2 text-right font-medium">Total</th>
                  <th className="p-2 text-right font-medium">Success rate</th>
                  <th className="p-2 text-right font-medium">95% CI</th>
                </tr>
              </thead>
              <tbody>
                {bins.map((b) => (
                  <tr key={b.label} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="p-2 text-left tabular-nums">{b.label}</td>
                    <td className="p-2 text-right tabular-nums">{b.success}</td>
                    <td className="p-2 text-right tabular-nums">{b.failure}</td>
                    <td className="p-2 text-right tabular-nums">{b.total}</td>
                    <td className="p-2 text-right tabular-nums">
                      {b.rate < 0 ? <span className="opacity-40">—</span> : `${b.rate.toFixed(1)}%`}
                    </td>
                    <td className="p-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {b.rate < 0 ? <span className="opacity-40">—</span> : `${b.ciLow.toFixed(0)}–${b.ciHigh.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
