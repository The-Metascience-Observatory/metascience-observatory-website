"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChartWatermark } from "@/components/ChartWatermark";
import { useIsMobile } from "@/components/useIsMobile";
import { SUCCESS_DEFS, rateFromCodes } from "@/lib/replicationOutcome";
import { SuccessRateNote } from "@/components/SuccessRateNote";
import type { CitationsMeta, CoverageStats, EffectRow, PaperCitations } from "./types";

// Yang et al. (2020) Fig. 1 palette: teal = passed, coral = failed.
const PASSED = "#12a5a5";
const FAILED = "#f4837d";
const REPLICATED = "#4f77bd"; // same blue as the by-impact-factor quintile bars

const CRITERION_OPTIONS = [
  { value: 0, label: "Reported result (success / failure column)" },
  { value: 1, label: "Statistically significant effect in the same direction?" },
  { value: 2, label: "Original effect size in replication 95% confidence interval?" },
  { value: 3, label: "Replication effect size in original 95% confidence interval?" },
];

const METRIC_OPTIONS = [
  { value: 0, label: "Total citations" },
  { value: 1, label: "Citations per year" },
  { value: 2, label: "Citations in first 5 years" },
];

// Citation metric value for one paper, or null when the paper can't support
// the metric (no OpenAlex match, no publication year, or fewer than 5
// observed post-publication years). Total citations are age-confounded
// (Spearman rho ~ -0.36 vs publication year in this sample); the first-5-year
// window and per-year rate are age-adjusted.
function metricValue(
  paper: PaperCitations,
  metricIdx: number,
  currentYear: number,
): number | null {
  if (paper.n < 0) return null;
  if (metricIdx === 0) return paper.n;
  if (metricIdx === 1) {
    if (paper.y === null) return null;
    return paper.n / Math.max(1, currentYear - paper.y);
  }
  if (!paper.by || paper.by.length < 5) return null;
  return paper.by[0] + paper.by[1] + paper.by[2] + paper.by[3] + paper.by[4];
}

const THRESHOLD_OPTIONS = [0.5, 0.75, 0.9, 1.0];
const BOOTSTRAP_ITERS = 1000;
// Minimum papers per group for a trajectory point to be shown; keeps the tail
// of the years-since-publication axis from degenerating into noise.
const TRAJ_FLOOR = 30;
// Hard cap on the years-since-publication axis: beyond this, group sizes are
// small and dominated by a handful of heavily-replicated classics, so the CIs
// balloon without adding signal.
const TRAJ_MAX_YEARS = 30;

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

/** One determinate effect-level row with its citation metric value attached. */
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

// Fixed, metric-appropriate log-scale-ish bins so the x-axis reads in natural
// citation ranges (the quintile chart's cutoffs shift with the data).
const FIXED_BINS: { edges: number[]; labels: string[] }[] = [
  { edges: [0, 25, 100, 250, 1000, Infinity], labels: ["<25", "25–99", "100–249", "250–999", "1000+"] },
  { edges: [0, 2, 5, 10, 25, Infinity], labels: ["<2", "2–5", "5–10", "10–25", "25+"] },
  { edges: [0, 10, 30, 75, 150, Infinity], labels: ["<10", "10–29", "30–74", "75–149", "150+"] },
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

interface TrajPoint {
  t: number;
  passed: TrajStats;
  failed: TrajStats;
}

/** Per-group cumulative-citation statistics at one trajectory point. */
interface TrajStats {
  n: number;
  mean: number;
  meanLo: number; // mean ± 1.96 SEM
  meanHi: number;
  med: number;
  medLo: number; // distribution-free 95% CI of the median (order statistics)
  medHi: number;
}

// Mean ± 1.96·SEM plus median with a distribution-free 95% CI, using the
// normal approximation to Binomial(n, 1/2) for the CI ranks. values must be
// non-empty.
function trajStats(values: number[]): TrajStats {
  const n = values.length;
  const s = [...values].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / n;
  let sq = 0;
  for (const v of s) sq += (v - mean) * (v - mean);
  const hw = n > 1 ? 1.96 * Math.sqrt(sq / (n - 1) / n) : 0;
  const mid = n >> 1;
  const med = n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  const half = (1.96 * Math.sqrt(n)) / 2;
  const lo = Math.max(0, Math.floor(n / 2 - half));
  const hi = Math.min(n - 1, Math.ceil(n / 2 + half));
  return { n, mean, meanLo: mean - hw, meanHi: mean + hw, med, medLo: s[lo], medHi: s[hi] };
}

export function CitationCountDashboard({
  papers,
  rows,
  replicationTypes,
  meta,
  csvName,
  coverage,
}: {
  papers: PaperCitations[];
  rows: EffectRow[];
  replicationTypes: string[];
  meta: CitationsMeta;
  csvName: string;
  coverage: CoverageStats;
}) {
  const [criterion, setCriterion] = useState(0);

  // The canonical site-wide rate over this page's rows, under the selected
  // criterion. Shown so the reader can reconcile this page's coverage-filtered
  // numbers with the site-wide rate rather than reading them as a contradiction.
  const siteRate = useMemo(() => rateFromCodes(rows.map((r) => r.o), criterion), [rows, criterion]);
  const [threshold, setThreshold] = useState(0.75);
  const [metric, setMetric] = useState(2); // default: first-5-years (age-adjusted)
  const [repType, setRepType] = useState(-1); // -1 = all types
  // Trajectory statistic: median is the default because citation counts are
  // heavily right-skewed (mean ≈ 3x median in this sample).
  const [stat, setStat] = useState<"median" | "mean">("median");
  const [showCI, setShowCI] = useState(false);

  const currentYear = meta.lastCompleteYear + 1;

  // Effect-level row counts per replication type, for the dropdown labels.
  const typeCounts = useMemo(() => {
    const counts = new Array(replicationTypes.length).fill(0) as number[];
    for (const r of rows) if (r.t >= 0) counts[r.t]++;
    return counts;
  }, [rows, replicationTypes]);

  // Group effect-level rows into papers (only the replication-type filter
  // applies here; a paper's outcome is judged on its matching effect rows).
  const paperCodes = useMemo(() => {
    const byId = new Map<number, string[]>();
    for (const r of rows) {
      if (repType >= 0 && r.t !== repType) continue;
      const codes = byId.get(r.p);
      if (codes) codes.push(r.o);
      else byId.set(r.p, [r.o]);
    }
    return byId;
  }, [rows, repType]);

  // ---- Trajectory chart data (per paper: passed vs failed) --------------
  const trajectory = useMemo(() => {
    const passedBy: number[][] = [];
    const failedBy: number[][] = [];
    const passedTotals: number[] = [];
    const failedTotals: number[] = [];
    let noOutcome = 0;
    let noCitations = 0;

    for (const [pId, codes] of paperCodes) {
      let success = 0;
      let determinate = 0;
      for (const c of codes) {
        const o = c[criterion];
        if (o === "s") {
          success++;
          determinate++;
        } else if (o === "f" || o === "r") {
          determinate++;
        }
      }
      if (determinate === 0) {
        noOutcome++;
        continue;
      }
      const paper = papers[pId];
      if (paper.n < 0 || !paper.by || paper.by.length === 0) {
        noCitations++;
        continue;
      }
      const passed = success / determinate >= threshold;
      (passed ? passedBy : failedBy).push(paper.by);
      (passed ? passedTotals : failedTotals).push(paper.n);
    }

    // A paper contributes to point t only if it is old enough to have
    // observed year t.
    const maxLen = Math.max(
      0,
      ...passedBy.map((b) => b.length),
      ...failedBy.map((b) => b.length),
    );
    // CUMULATIVE citations received by t+1 years since publication, per
    // group (mean and median with their CIs). Points are displayed at
    // x = t + 1 with a (0,0) anchor prepended in the chart, so cap at
    // TRAJ_MAX_YEARS points to keep the axis within [0, TRAJ_MAX_YEARS].
    // Running totals freeze when a paper ages out, but aged-out papers are
    // excluded from later points anyway.
    const points: TrajPoint[] = [];
    const runP = new Array(passedBy.length).fill(0) as number[];
    const runF = new Array(failedBy.length).fill(0) as number[];
    for (let t = 0; t < Math.min(maxLen, TRAJ_MAX_YEARS); t++) {
      const vp: number[] = [];
      const vf: number[] = [];
      for (let i = 0; i < passedBy.length; i++) {
        const b = passedBy[i];
        if (t < b.length) { runP[i] += b[t]; vp.push(runP[i]); }
      }
      for (let i = 0; i < failedBy.length; i++) {
        const b = failedBy[i];
        if (t < b.length) { runF[i] += b[t]; vf.push(runF[i]); }
      }
      if (vp.length < TRAJ_FLOOR || vf.length < TRAJ_FLOOR) break;
      points.push({ t, passed: trajStats(vp), failed: trajStats(vf) });
    }

    const median = (a: number[]): number => {
      if (a.length === 0) return 0;
      const s = [...a].sort((x, y) => x - y);
      const mid = s.length >> 1;
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };

    return {
      points,
      nPassed: passedBy.length,
      nFailed: failedBy.length,
      medPassed: median(passedTotals),
      medFailed: median(failedTotals),
      noOutcome,
      noCitations,
    };
  }, [paperCodes, papers, criterion, threshold]);

  // ---- Binned charts data (per effect row) -------------------------------
  const qualRows = useMemo(() => {
    const out: QualRow[] = [];
    let excluded = 0;
    for (const r of rows) {
      if (repType >= 0 && r.t !== repType) continue;
      const o = r.o[criterion];
      if (o !== "s" && o !== "f" && o !== "r") continue; // inconclusive rows never qualify
      const val = metricValue(papers[r.p], metric, currentYear);
      if (val === null) {
        excluded++;
        continue;
      }
      out.push({ p: r.p, val, success: o === "s" });
    }
    return { rows: out, excluded };
  }, [rows, papers, criterion, metric, repType, currentYear]);

  const fixedBins = useMemo(() => buildFixedBins(qualRows.rows, metric), [qualRows, metric]);

  const metricLabel = METRIC_OPTIONS[metric].label;
  const fixedAxis = `Original paper ${metricLabel.toLowerCase()}`;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Replication Rate by Citation Count
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Are highly cited papers more replicable?{" "}
          <a
            href="https://doi.org/10.1073/pnas.1909046117"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Yang, Youyou &amp; Uzzi (PNAS 2020)
          </a>{" "}
          found that the 61 papers that failed replication were cited at the same yearly rate
          as the 39 that passed &mdash; citation counts did not distinguish replicable from
          non-replicable findings (their Fig.&nbsp;1). This page repeats that comparison on
          the full replications database, using per-year citation counts from OpenAlex for
          every original paper with a DOI.
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

        <div className="basis-full">
          <SuccessRateNote
            def={SUCCESS_DEFS[criterion]}
            unit="effect"
            n={siteRate.n}
            filter="originals matched in the OpenAlex citation dataset"
          />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">Success threshold (per paper)</span>
          <select
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
          >
            {THRESHOLD_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {Math.round(t * 100)}%
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">Statistic (trajectory chart)</span>
          <select
            value={stat}
            onChange={(e) => setStat(e.target.value as "median" | "mean")}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="median">Median (robust to outliers)</option>
            <option value="mean">Mean (as in Yang et al.)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">Citation metric (binned charts)</span>
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

        <label className="flex items-center gap-2 text-sm cursor-pointer pb-1.5">
          <input
            type="checkbox"
            checked={showCI}
            onChange={(e) => setShowCI(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          <span className="text-gray-600 dark:text-gray-300">
            Show 95% confidence intervals
          </span>
        </label>
      </div>

      {/* Trajectory chart */}
      <section className="space-y-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Citation trajectories for papers that passed vs failed{" "}
          {repType >= 0 ? `${replicationTypes[repType]} ` : ""}replication
        </h2>
        {trajectory.points.length < 3 ? (
          <p className="text-sm text-gray-500">Not enough data for this selection.</p>
        ) : (
          <div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
              <TrajectoryChart points={trajectory.points} stat={stat} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {stat === "median" ? "Median" : "Average"} cumulative number of citations
              received by each year since publication, for original papers classified as
              replicated ({trajectory.nPassed.toLocaleString()} papers) vs not replicated
              ({trajectory.nFailed.toLocaleString()} papers) under the selected criterion
              and threshold. Unlike Yang et&nbsp;al.&rsquo;s single-year
              2008 cohort, our originals span several decades, so the x-axis is years since
              publication rather than calendar year; each point uses only the papers old
              enough to have observed that year, and the axis is capped at {TRAJ_MAX_YEARS}{" "}
              years (or earlier if a group falls below {TRAJ_FLOOR} papers) &mdash; beyond
              that, the shrinking sample is dominated by a few heavily-replicated classics.
              {stat === "median"
                ? "Shaded bands are distribution-free 95% confidence intervals for the median (from order statistics)"
                : "Shaded bands are 95% confidence intervals for the mean (±1.96 standard errors)"}
              ; where they overlap, the two groups&rsquo; citation rates are statistically
              indistinguishable. Citation counts are heavily right-skewed &mdash; the mean
              runs roughly 3&times; the median because replication projects target
              influential papers &mdash; so the median is the default view. Hover the lines
              for exact values and group sizes.
            </p>
          </div>
        )}
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {(trajectory.nPassed + trajectory.nFailed).toLocaleString()} papers in the trajectory
        chart &middot; {trajectory.noCitations.toLocaleString()} excluded (no OpenAlex match
        or publication year) &middot; {trajectory.noOutcome.toLocaleString()} excluded
        (inconclusive outcome)
      </p>

      {/* Fixed-bin chart */}
      <section className="space-y-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Replication rate by {metricLabel.toLowerCase()}
        </h2>
        {fixedBins.length === 0 ? (
          <p className="text-sm text-gray-500">Not enough data for this selection.</p>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
            <BinnedChart bins={fixedBins} xTitle={fixedAxis} showCI={showCI} />
          </div>
        )}
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {qualRows.rows.length.toLocaleString()} replications plotted in the binned charts{" "}
        &middot; {qualRows.excluded.toLocaleString()} determinate rows excluded (no OpenAlex
        match{metric === 1 ? " or publication year" : metric === 2 ? " or fewer than 5 observed years" : ""})
      </p>

      {/* Methodology */}
      <section className="text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-800 pt-6">
        <p>
          <strong>Citation source.</strong> Total citation counts and per-year trajectories
          come from the OpenAlex API (generated {meta.generated}). A paper&rsquo;s per-year
          citations are the publication years of the works citing it; the current partial
          year is excluded from trajectories, and the rare citing works dated before
          publication (preprints, metadata errors) are counted in year&nbsp;0.
        </p>
        <p>
          <strong>Matching.</strong> Original papers are matched to OpenAlex by DOI:{" "}
          {coverage.rowsMatched.toLocaleString()} of {coverage.totalRows.toLocaleString()}{" "}
          replication rows ({((100 * coverage.rowsMatched) / Math.max(1, coverage.totalRows)).toFixed(1)}%)
          have a matched original; rows without a DOI or without an OpenAlex record are
          excluded from the charts.
        </p>
        <p>
          <strong>Units.</strong> The trajectory chart classifies each original paper as
          replicated if at least the threshold share of its determinate effect-level
          replications succeeded. The binned charts instead count every
          determinate replication attempt once. Reversals count as determinate
          non-replications; inconclusive rows are excluded.
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

// Yang-Fig.-1-style line chart: median or mean cumulative citations (linear
// y) for the two groups, x = years since publication, anchored at (0,0).
function TrajectoryChart({ points, stat }: { points: TrajPoint[]; stat: "median" | "mean" }) {
  const isMobile = useIsMobile();
  const W = isMobile ? 380 : 720;
  const H = isMobile ? 340 : 378;
  const M = isMobile ? { top: 20, right: 10, bottom: 46, left: 44 } : { top: 24, right: 24, bottom: 56, left: 70 };
  const F = isMobile ? { tick: 10, title: 11, legend: 11 } : { tick: 12, title: 14, legend: 13 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  // Data point for offset t is displayed at x = t + 1; x = 0 is the (0, 0)
  // anchor (no citations at the moment of publication).
  const maxX = points[points.length - 1].t + 1;
  const x = (xv: number) => M.left + plotW * (xv / maxX);

  // Accessors for the selected statistic and its CI band.
  const get =
    stat === "median"
      ? {
          m: (s: TrajStats) => s.med,
          lo: (s: TrajStats) => s.medLo,
          hi: (s: TrajStats) => s.medHi,
          word: "median",
          yLabel: "Median cumulative citations received",
        }
      : {
          m: (s: TrajStats) => s.mean,
          lo: (s: TrajStats) => s.meanLo,
          hi: (s: TrajStats) => s.meanHi,
          word: "mean",
          yLabel: "Average cumulative citations received",
        };

  // Linear y-scale from 0 over both series including their CI bands, padded;
  // negative band edges (rare, skewed data) are clamped to the axis.
  const rawMax = Math.max(
    ...points.flatMap((p) => [get.hi(p.passed), get.hi(p.failed), get.m(p.passed), get.m(p.failed)]),
  );
  const yMax = rawMax * 1.08;
  const ly = (v: number) => M.top + plotH * (1 - Math.max(v, 0) / yMax);

  // Round tick step (1/2/5 x 10^k) giving at most ~6 ticks.
  const pow = 10 ** Math.floor(Math.log10(yMax / 5));
  const yStep = [1, 2, 5, 10].map((m) => m * pow).find((s) => yMax / s <= 6) ?? 10 * pow;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);
  const xStep = (maxX <= 12 ? 1 : maxX <= 24 ? 2 : 5) * (isMobile ? 2 : 1);
  const xTicks: number[] = [];
  for (let t = 0; t <= maxX; t += xStep) xTicks.push(t);

  const fmtTick = (v: number) => (v < 1 ? v.toString() : v.toLocaleString());

  const series = [
    { key: "passed", label: "Passed replication", color: PASSED, g: (p: TrajPoint) => p.passed },
    { key: "failed", label: "Failed replication", color: FAILED, g: (p: TrajPoint) => p.failed },
  ];

  // The (0,0) anchor: zero cumulative citations at the moment of publication.
  const origin = `${x(0)},${ly(0)}`;

  // Shaded CI band: origin, upper edge left-to-right, then lower edge back to
  // the origin (the band collapses to a point at publication).
  const bandPoints = (g: (p: TrajPoint) => TrajStats) =>
    `${origin} ` +
    points.map((p) => `${x(p.t + 1)},${ly(get.hi(g(p)))}`).join(" ") +
    " " +
    [...points].reverse().map((p) => `${x(p.t + 1)},${ly(get.lo(g(p)))}`).join(" ") +
    ` ${origin}`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className={isMobile ? "w-full" : "w-full min-w-[560px]"} role="img">
        {/* y gridlines + ticks */}
        {yTicks.map((g) => (
          <g key={g}>
            <line x1={M.left} x2={W - M.right} y1={ly(g)} y2={ly(g)} stroke="currentColor" strokeOpacity={0.12} />
            <line x1={M.left - 6} x2={M.left} y1={ly(g)} y2={ly(g)} stroke="#000000" strokeWidth={1} />
            <text x={M.left - (isMobile ? 8 : 10)} y={ly(g) + 4} textAnchor="end" fontSize={F.tick} className="fill-black dark:fill-gray-100">
              {fmtTick(g)}
            </text>
          </g>
        ))}
        {/* x ticks */}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={M.top + plotH} y2={M.top + plotH + 5} stroke="#000000" strokeWidth={1} />
            <text x={x(t)} y={M.top + plotH + (isMobile ? 16 : 18)} textAnchor="middle" fontSize={F.tick} className="fill-black dark:fill-gray-100">
              {t}
            </text>
          </g>
        ))}
        {/* axis lines */}
        <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />

        {/* shaded 95%-CI bands (both first, so neither line is buried) */}
        {series.map((s) => (
          <polygon key={`band-${s.key}`} points={bandPoints(s.g)} fill={s.color} fillOpacity={0.16} stroke="none" />
        ))}

        {/* series lines, anchored at (0,0) */}
        {series.map((s) => (
          <polyline
            key={`line-${s.key}`}
            points={`${origin} ` + points.map((p) => `${x(p.t + 1)},${ly(get.m(s.g(p)))}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ))}

        {/* invisible hover targets so tooltips survive without visible dots */}
        {series.map((s) => (
          <g key={`hover-${s.key}`}>
            {points.map((p) => (
              <circle key={p.t} cx={x(p.t + 1)} cy={ly(get.m(s.g(p)))} r={9} fill="transparent">
                <title>
                  {`${s.label}, ${p.t + 1} year${p.t === 0 ? "" : "s"} since publication:\n${get.word} ${get.m(s.g(p)).toFixed(0)} cumulative citations (95% CI ${Math.max(0, get.lo(s.g(p))).toFixed(0)}–${get.hi(s.g(p)).toFixed(0)}, n=${s.g(p).n.toLocaleString()} papers)`}
                </title>
              </circle>
            ))}
          </g>
        ))}

        {/* legend */}
        <g>
          {series.map((s, i) => {
            const cy = M.top + 14 + i * (isMobile ? 17 : 20);
            const x0 = M.left + (isMobile ? 8 : 12);
            const swatch = isMobile ? 16 : 22;
            return (
              <g key={s.key}>
                <rect x={x0} y={cy - 5} width={swatch} height={10} fill={s.color} opacity={0.18} rx={2} />
                <line x1={x0} x2={x0 + swatch} y1={cy} y2={cy} stroke={s.color} strokeWidth={2.5} />
                <text
                  x={x0 + swatch + (isMobile ? 6 : 8)}
                  y={cy + 4}
                  fontSize={F.legend}
                  fontWeight={600}
                  className="fill-black dark:fill-gray-100"
                >
                  {s.label}
                </text>
              </g>
            );
          })}
        </g>

        <text
          x={M.left + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={F.title}
          fontWeight={700}
          className="fill-black dark:fill-gray-100"
        >
          Years since publication
        </text>
        <text
          transform={`translate(${isMobile ? 10 : 14} ${M.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={F.title}
          fontWeight={700}
          className="fill-black dark:fill-gray-100"
        >
          {get.yLabel}
        </text>
        {/* On mobile the top-left legend + top-right watermark would overlap in a
            380-unit viewBox; the bottom-right corner is empty (lines rise left→right). */}
        <ChartWatermark rightX={W - M.right - 8} y={isMobile ? M.top + plotH - 18 : M.top + 4} />
      </svg>
    </div>
  );
}

function BinnedChart({ bins, xTitle, showCI = false }: { bins: Bin[]; xTitle: string; showCI?: boolean }) {
  const isMobile = useIsMobile();
  const W = isMobile ? 380 : 720;
  const H = isMobile ? 300 : 320;
  const M = isMobile ? { top: 16, right: 8, bottom: 60, left: 40 } : { top: 20, right: 20, bottom: 64, left: 62 };
  const F = isMobile
    ? { tick: 10, xlab: 9, val: 10, title: 11, sub: 8 }
    : { tick: 12, xlab: 12, val: 12, title: 14, sub: 10 };
  const whisker = isMobile ? 4 : 5;
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
                  {`${b.label ?? `${fmt(b.lo)}–${fmt(b.hi)} citations`}: ${b.rate.toFixed(1)}% replicated (${b.replicated}/${b.count}), cluster-bootstrap 95% CI [${b.ciLow.toFixed(0)}–${b.ciHigh.toFixed(0)}%]`}
                </title>
              </rect>
              {showCI && (
                <>
                  {/* paper-cluster bootstrap 95% CI whisker */}
                  <line x1={cx} x2={cx} y1={y(b.ciLow)} y2={y(b.ciHigh)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                  <line x1={cx - whisker} x2={cx + whisker} y1={y(b.ciLow)} y2={y(b.ciLow)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                  <line x1={cx - whisker} x2={cx + whisker} y1={y(b.ciHigh)} y2={y(b.ciHigh)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                </>
              )}
              {/* rate label, above the bar (or the upper CI whisker) */}
              <text x={cx} y={(showCI ? y(b.ciHigh) : top) - 6} textAnchor="middle" fontSize={F.val} fontWeight={600} fill="currentColor">
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
