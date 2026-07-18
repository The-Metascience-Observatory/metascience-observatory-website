"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChartWatermark } from "@/components/ChartWatermark";
import { useIsMobile } from "@/components/useIsMobile";
import type { CoverageStats, EffectRow, HIndexMeta, PaperHIndex } from "./types";

// Pearson correlation of two equal-length numeric arrays (null if degenerate).
function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

// Spearman rank correlation (Pearson on ranks; average ranks for ties).
function spearman(xs: number[], ys: number[]): number | null {
  const rank = (a: number[]): number[] => {
    const idx = a.map((v, i) => [v, i] as [number, number]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length).fill(0);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  return pearson(rank(xs), rank(ys));
}

const REPLICATED = "#10b981"; // bar color shared with the other by-* pages

const CRITERION_OPTIONS = [
  { value: 0, label: "Reported result (success / failure column)" },
  { value: 1, label: "Statistically significant effect in the same direction?" },
  { value: 2, label: "Original effect size in replication 95% confidence interval?" },
  { value: 3, label: "Replication effect size in original 95% confidence interval?" },
];

const METRIC_OPTIONS = [
  { value: 0, label: "Mean h-index of all authors" },
  { value: 1, label: "Max h-index on the byline" },
  { value: 2, label: "First-author h-index" },
  { value: 3, label: "Last-author h-index" },
];

// h-index metric value for one paper, or null when the paper can't support
// the metric (no SciSciNet match, or that positional author has no h-index).
function metricValue(paper: PaperHIndex, metricIdx: number): number | null {
  if (paper.na === 0) return null;
  if (metricIdx === 0) return paper.mean;
  if (metricIdx === 1) return paper.max;
  if (metricIdx === 2) return paper.first;
  return paper.last;
}

const BOOTSTRAP_ITERS = 1000;

// Small seeded PRNG (mulberry32) so bootstrap CIs are reproducible across
// renders instead of jittering on every recompute.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One determinate effect-level row with its h-index metric value attached. */
interface QualRow {
  p: number; // paper index (bootstrap cluster)
  val: number;
  success: boolean;
}

type Bin = {
  lo: number;
  hi: number;
  count: number;
  replicated: number;
  rate: number;
  ciLow: number;
  ciHigh: number;
  label?: string;
};

// Paper-cluster bootstrap 95% CI per bin: resample papers with replacement,
// keep the fixed bin assignment, and recompute each bin's rate. Effect rows
// within a paper are correlated, so a row-level Wilson interval would be
// over-confident; resampling whole papers propagates that clustering.
function bootstrapBinCIs(
  rowsQ: QualRow[],
  binOf: (val: number) => number,
  nBins: number,
): [number, number][] {
  const byPaper = new Map<number, QualRow[]>();
  for (const r of rowsQ) {
    const arr = byPaper.get(r.p);
    if (arr) arr.push(r);
    else byPaper.set(r.p, [r]);
  }
  const clusters = Array.from(byPaper.values());
  const rand = mulberry32(0x9e3779b9 ^ rowsQ.length);
  const boot: number[][] = Array.from({ length: nBins }, () => []);
  for (let b = 0; b < BOOTSTRAP_ITERS; b++) {
    const rep = new Array(nBins).fill(0);
    const tot = new Array(nBins).fill(0);
    for (let s = 0; s < clusters.length; s++) {
      const cluster = clusters[(rand() * clusters.length) | 0];
      for (const r of cluster) {
        const k = binOf(r.val);
        if (k < 0 || k >= nBins) continue;
        tot[k]++;
        if (r.success) rep[k]++;
      }
    }
    for (let k = 0; k < nBins; k++) if (tot[k] > 0) boot[k].push((rep[k] / tot[k]) * 100);
  }
  return boot.map((arr) => {
    if (arr.length === 0) return [0, 100];
    arr.sort((x, y) => x - y);
    return [arr[Math.floor(0.025 * (arr.length - 1))], arr[Math.ceil(0.975 * (arr.length - 1))]];
  });
}

// Fixed, metric-appropriate bins so the x-axis reads in natural h-index
// ranges. Replication projects target influential papers, so the byline
// h-indexes here run well above the field-wide norm; edges chosen so each
// bin keeps a healthy share of the sample.
const FIXED_BINS: { edges: number[]; labels: string[] }[] = [
  { edges: [0, 20, 40, 60, 90, Infinity], labels: ["<20", "20–39", "40–59", "60–89", "90+"] }, // mean
  { edges: [0, 40, 70, 110, 175, Infinity], labels: ["<40", "40–69", "70–109", "110–174", "175+"] }, // max
  { edges: [0, 15, 30, 50, 80, Infinity], labels: ["<15", "15–29", "30–49", "50–79", "80+"] }, // first author
  { edges: [0, 25, 50, 80, 120, Infinity], labels: ["<25", "25–49", "50–79", "80–119", "120+"] }, // last author
];

function buildFixedBins(rowsQ: QualRow[], metric: number): Bin[] {
  if (rowsQ.length === 0) return [];
  const { edges, labels } = FIXED_BINS[metric];
  const nBins = labels.length;
  const binOf = (val: number) => {
    let k = 0;
    while (k + 1 < nBins && val >= edges[k + 1]) k++;
    return k;
  };
  const rep = new Array(nBins).fill(0);
  const tot = new Array(nBins).fill(0);
  for (const r of rowsQ) {
    const k = binOf(r.val);
    tot[k]++;
    if (r.success) rep[k]++;
  }
  const cis = bootstrapBinCIs(rowsQ, binOf, nBins);
  const bins: Bin[] = [];
  for (let k = 0; k < nBins; k++) {
    bins.push({
      lo: edges[k],
      hi: edges[k + 1],
      count: tot[k],
      replicated: rep[k],
      rate: tot[k] > 0 ? (rep[k] / tot[k]) * 100 : 0,
      ciLow: cis[k][0],
      ciHigh: cis[k][1],
      label: labels[k],
    });
  }
  return bins;
}

export function HIndexDashboard({
  papers,
  rows,
  replicationTypes,
  meta,
  csvName,
  coverage,
}: {
  papers: PaperHIndex[];
  rows: EffectRow[];
  replicationTypes: string[];
  meta: HIndexMeta;
  csvName: string;
  coverage: CoverageStats;
}) {
  const [criterion, setCriterion] = useState(0);
  const [metric, setMetric] = useState(0); // default: mean h-index
  const [repType, setRepType] = useState(-1); // -1 = all types

  // Effect-level row counts per replication type, for the dropdown labels.
  const typeCounts = useMemo(() => {
    const counts = new Array(replicationTypes.length).fill(0) as number[];
    for (const r of rows) if (r.t >= 0) counts[r.t]++;
    return counts;
  }, [rows, replicationTypes]);

  // ---- Binned chart data (per effect row) -------------------------------
  const qualRows = useMemo(() => {
    const out: QualRow[] = [];
    let excluded = 0;
    for (const r of rows) {
      if (repType >= 0 && r.t !== repType) continue;
      const o = r.o[criterion];
      if (o !== "s" && o !== "f" && o !== "r") continue; // inconclusive rows never qualify
      const val = metricValue(papers[r.p], metric);
      if (val === null) {
        excluded++;
        continue;
      }
      out.push({ p: r.p, val, success: o === "s" });
    }
    return { rows: out, excluded };
  }, [rows, papers, criterion, metric, repType]);

  const fixedBins = useMemo(() => buildFixedBins(qualRows.rows, metric), [qualRows, metric]);

  // Row-level correlation between replication success and each h-index
  // metric: point-biserial r on log10(1+value) plus Spearman rho.
  const correlations = useMemo(() => {
    return METRIC_OPTIONS.map((opt) => {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const r of rows) {
        if (repType >= 0 && r.t !== repType) continue;
        const o = r.o[criterion];
        if (o !== "s" && o !== "f" && o !== "r") continue;
        const val = metricValue(papers[r.p], opt.value);
        if (val === null) continue;
        xs.push(Math.log10(1 + val));
        ys.push(o === "s" ? 1 : 0);
      }
      return { label: opt.label, r: pearson(xs, ys), rho: spearman(xs, ys), n: xs.length };
    });
  }, [rows, papers, criterion, repType]);

  const metricLabel = METRIC_OPTIONS[metric].label;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Replication Rate by Author h-index
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Are papers by eminent researchers more replicable? This page plots the
          replication rate of original papers in the database against the h-index of
          their authors &mdash; the mean across the byline, the most-cited coauthor, or
          the first or last author alone &mdash; using author metrics from{" "}
          <a
            href="https://www.nature.com/articles/s41597-023-02198-9"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            SciSciNet
          </a>{" "}
          (derived from OpenAlex). Note that h-indexes are the authors&rsquo;{" "}
          <em>current</em> values, not their values when the original paper was
          published (see methodology below).
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">Replication success criterion</span>
          <select
            value={criterion}
            onChange={(e) => setCriterion(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm max-w-[22rem]"
          >
            {CRITERION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">h-index metric</span>
          <select
            value={metric}
            onChange={(e) => setMetric(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            Replication type{" "}
            <Link href="/docs/defining-replication" className="text-xs opacity-60 hover:opacity-80 underline">
              (more info)
            </Link>
          </span>
          <select
            value={repType}
            onChange={(e) => setRepType(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
          >
            <option value={-1}>All types</option>
            {replicationTypes.map((name, i) => (
              <option key={name} value={i}>
                {name} ({typeCounts[i].toLocaleString()})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Fixed-bin chart */}
      <section className="space-y-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Replication rate by {metricLabel.toLowerCase()}
        </h2>
        {fixedBins.length === 0 ? (
          <p className="text-sm text-gray-500">Not enough data for this selection.</p>
        ) : (
          <div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
              <BinnedChart bins={fixedBins} xTitle={metricLabel} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              All determinate effect-level replications whose original paper matched in
              the SciSciNet snapshot, grouped into fixed h-index ranges. Each replication
              attempt counts once. Hover a bar for its 95% interval from a paper-cluster
              bootstrap ({BOOTSTRAP_ITERS.toLocaleString()} resamples of original papers
              with replacement), which accounts for multiple replications of the same
              paper not being independent.
            </p>
          </div>
        )}
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {qualRows.rows.length.toLocaleString()} replications plotted &middot;{" "}
        {qualRows.excluded.toLocaleString()} determinate rows excluded (no SciSciNet
        match{metric >= 2 ? " or that author has no h-index record" : ""})
      </p>

      {/* Correlation table */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Correlation between author h-index and replication success
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Row-level correlation between an original paper&rsquo;s author h-index metric
            and whether the replication attempt succeeded (1) or not (0), under the
            current criterion and replication-type filter.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-600 dark:text-gray-300">
                <th className="py-2 pr-6 font-medium">h-index metric</th>
                <th className="py-2 pr-6 font-medium text-right">Point-biserial r</th>
                <th className="py-2 pr-6 font-medium text-right">Spearman &rho;</th>
                <th className="py-2 font-medium text-right">Replications (n)</th>
              </tr>
            </thead>
            <tbody>
              {correlations.map((c) => (
                <tr key={c.label} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-6">{c.label}</td>
                  <td className="py-2 pr-6 text-right tabular-nums">{c.r === null ? "—" : c.r.toFixed(2)}</td>
                  <td className="py-2 pr-6 text-right tabular-nums">{c.rho === null ? "—" : c.rho.toFixed(2)}</td>
                  <td className="py-2 text-right tabular-nums">{c.n.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Point-biserial r is computed on log&#8321;&#8320;(1 + h) to tame the
          right-skew; Spearman &rho; is rank-based and scale-free. Values near zero mean
          author eminence carries little information about replicability.
        </p>
      </section>

      {/* Methodology */}
      <section className="text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-800 pt-6">
        <p>
          <strong>h-index source.</strong> Author h-indexes come from a SciSciNet-v2
          snapshot (derived from OpenAlex; snapshot {meta.dbSnapshot}, lookup generated{" "}
          {meta.generated}). Papers are matched by DOI, then joined to their authors and
          each author&rsquo;s h-index; authors missing from the snapshot are dropped from
          the mean and max.
        </p>
        <p>
          <strong>Current, not contemporaneous.</strong> An author&rsquo;s h-index is
          their value <em>today</em>, not at the time the original paper was published.
          It therefore bakes in everything that happened since &mdash; including
          citations to the original paper itself and to the replication debate around
          it &mdash; and is confounded with career stage, field citation norms, and team
          size. Treat these charts as descriptive, not causal.
        </p>
        <p>
          <strong>Matching.</strong> Original papers are matched by DOI:{" "}
          {coverage.rowsMatched.toLocaleString()} of {coverage.totalRows.toLocaleString()}{" "}
          replication rows ({((100 * coverage.rowsMatched) / Math.max(1, coverage.totalRows)).toFixed(1)}%)
          have a matched original with author data; rows without a DOI or without a
          SciSciNet record are excluded from the charts.
        </p>
        <p>
          <strong>Units.</strong> The chart and correlations count every determinate
          replication attempt once. Reversals count as determinate non-replications;
          inconclusive rows are excluded. First-author h-index is used as the
          last-author value for single-author papers.
        </p>
        <p>Data: {csvName}.</p>
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        <Link href="/replications-database" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to the replications database
        </Link>
      </p>
    </div>
  );
}

function BinnedChart({ bins, xTitle }: { bins: Bin[]; xTitle: string }) {
  const isMobile = useIsMobile();
  const W = isMobile ? 380 : 720;
  const H = isMobile ? 300 : 320;
  const M = isMobile ? { top: 16, right: 8, bottom: 60, left: 40 } : { top: 20, right: 20, bottom: 64, left: 62 };
  const F = isMobile
    ? { tick: 10, xlab: 9, val: 10, title: 11, sub: 8 }
    : { tick: 12, xlab: 12, val: 12, title: 14, sub: 10 };
  // Long metric titles overflow a 380-unit viewBox at 11px — shrink to fit.
  const titleFs = !isMobile ? F.title : xTitle.length > 60 ? 8.5 : xTitle.length > 45 ? 9.5 : F.title;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bandW = plotW / bins.length;
  const barW = bandW * 0.6;
  const y = (pct: number) => M.top + plotH * (1 - pct / 100);

  const fmt = (v: number) => {
    if (!Number.isFinite(v)) return "∞";
    return v >= 10 ? Math.round(v).toLocaleString() : v.toFixed(1);
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className={isMobile ? "w-full" : "w-full min-w-[560px]"} role="img">
        {/* y gridlines + ticks */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={W - M.right} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.12} />
            <line x1={M.left - 6} x2={M.left} y1={y(g)} y2={y(g)} stroke="#000000" strokeWidth={1} />
            <text x={M.left - (isMobile ? 8 : 10)} y={y(g) + 4} textAnchor="end" fontSize={F.tick} className="fill-black dark:fill-gray-100">
              {g}%
            </text>
          </g>
        ))}
        {/* axis lines */}
        <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        {bins.map((b, i) => {
          const cx = M.left + bandW * i + bandW / 2;
          const bx = cx - barW / 2;
          const top = y(b.rate);
          return (
            <g key={i}>
              <rect x={bx} y={top} width={barW} height={M.top + plotH - top} rx={2} fill={REPLICATED} opacity={0.85}>
                <title>
                  {`${b.label ?? `${fmt(b.lo)}–${fmt(b.hi)}`}: ${b.rate.toFixed(1)}% replicated (${b.replicated}/${b.count}), cluster-bootstrap 95% CI [${b.ciLow.toFixed(0)}–${b.ciHigh.toFixed(0)}%]`}
                </title>
              </rect>
              {/* rate label, above the bar */}
              <text x={cx} y={top - 6} textAnchor="middle" fontSize={F.val} fontWeight={600} fill="currentColor">
                {b.rate.toFixed(0)}%
              </text>
              {/* x labels */}
              <line x1={cx} x2={cx} y1={M.top + plotH} y2={M.top + plotH + 5} stroke="#000000" strokeWidth={1} />
              <text x={cx} y={H - M.bottom + (isMobile ? 14 : 18)} textAnchor="middle" fontSize={F.xlab} className="fill-black dark:fill-gray-100">
                {b.label ?? `${fmt(b.lo)}–${fmt(b.hi)}`}
              </text>
              <text x={cx} y={H - M.bottom + (isMobile ? 28 : 34)} textAnchor="middle" fontSize={F.sub} fill="currentColor" opacity={0.5}>
                n={b.count.toLocaleString()}
              </text>
            </g>
          );
        })}
        <text
          x={M.left + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={titleFs}
          fontWeight={700}
          className="fill-black dark:fill-gray-100"
        >
          {xTitle}
        </text>
        <text
          transform={`translate(${isMobile ? 10 : 14} ${M.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={F.title}
          fontWeight={700}
          className="fill-black dark:fill-gray-100"
        >
          Replication rate (%)
        </text>
        <ChartWatermark x={M.left + 8} y={M.top + 4} />
      </svg>
    </div>
  );
}
