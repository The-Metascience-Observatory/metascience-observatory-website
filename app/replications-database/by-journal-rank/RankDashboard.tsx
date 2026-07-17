"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChartWatermark } from "@/components/ChartWatermark";
import type { RankMeta, JournalRank, PaperRow } from "./types";

// Wilson score 95% CI for a proportion k/n (percentage points). Kept identical
// to the by-impact-factor / by-journal / by-discipline analysis views.
function wilsonCI(k: number, n: number): [number, number] {
  if (n === 0) return [0, 100];
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin) * 100, Math.min(1, center + margin) * 100];
}

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

const REPLICATED = "#4f77bd";
const POINT = "#2563eb";

const CRITERION_OPTIONS = [
  { value: 0, label: "Reported result (success / failure column)" },
  { value: 1, label: "Statistically significant effect in the same direction?" },
  { value: 2, label: "Original effect size in replication 95% confidence interval?" },
  { value: 3, label: "Replication effect size in original 95% confidence interval?" },
];

// Metric tuple order: [sjr_percentile, sjr_quartile, sjr_rank, h_index].
const METRIC_OPTIONS = [
  { value: 0, label: "SJR percentile" },
  { value: 1, label: "SJR quartile" },
  { value: 2, label: "SJR overall rank" },
  { value: 3, label: "Journal h-index" },
];
const PERCENTILE = 0;
const QUARTILE = 1;
const RANK = 2;
const HINDEX = 3;
// Metrics where a LOWER value means a higher-status journal (rank 1 = best,
// quartile 1 = best). Correlations and the "higher rank replicates…" phrasing
// account for this so the direction is reported honestly.
const LOWER_IS_BETTER = new Set([QUARTILE, RANK]);
// h-index is a per-journal snapshot (constant across years), so the
// publication-year basis has nothing year-specific to show.
const SNAPSHOT_ONLY_METRICS = new Set([HINDEX]);

const THRESHOLD_OPTIONS = [0.5, 0.75, 0.9, 1.0];

// Short forms for a few long journal names, used only for on-chart point labels.
function journalLabel(name: string): string {
  if (name === "New England Journal of Medicine") return "NEJM";
  if (name === "The Quarterly Journal of Economics") return "Quarterly Journal of Economics";
  if (name === "American Economic Review") return "Am. Econ. Review";
  return name;
}

const MIN_PAPERS_OPTIONS = [5, 10, 15, 20, 25, 30, 50];
const N_BINS = 5;

interface Paper {
  j: number;
  y: number | null;
  codes: string[]; // one 4-char outcome string per effect-level row
}

interface QualPaper {
  j: number;
  val: number; // the selected metric value (percentile / quartile / rank / h-index)
  replicated: boolean;
}

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

const BOOTSTRAP_ITERS = 1000;

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

// Journal-cluster bootstrap 95% CI per bin: resample journals with replacement,
// keep the fixed bin assignment, and recompute each bin's rate. Papers within a
// journal are correlated, so a paper-level Wilson interval is over-confident;
// resampling whole journals propagates that clustering into wider, honest CIs.
function bootstrapBinCIs(
  papers: QualPaper[],
  binOf: (v: number) => number,
  nBins: number,
): [number, number][] {
  const byJournal = new Map<number, QualPaper[]>();
  for (const p of papers) {
    const arr = byJournal.get(p.j);
    if (arr) arr.push(p);
    else byJournal.set(p.j, [p]);
  }
  const clusters = Array.from(byJournal.values());
  const rand = mulberry32(0x9e3779b9 ^ papers.length);
  const boot: number[][] = Array.from({ length: nBins }, () => []);
  for (let b = 0; b < BOOTSTRAP_ITERS; b++) {
    const rep = new Array(nBins).fill(0);
    const tot = new Array(nBins).fill(0);
    for (let s = 0; s < clusters.length; s++) {
      const jp = clusters[(rand() * clusters.length) | 0];
      for (const p of jp) {
        const k = binOf(p.val);
        if (k < 0 || k >= nBins) continue;
        tot[k]++;
        if (p.replicated) rep[k]++;
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

// Split papers into N_BINS equal-COUNT bins by the metric value, with a
// cluster-bootstrap CI per bin.
function buildBins(papers: QualPaper[]): Bin[] {
  const sorted = [...papers].sort((a, b) => a.val - b.val);
  const n = sorted.length;
  const base: Bin[] = [];
  if (n < N_BINS) return base;
  for (let i = 0; i < N_BINS; i++) {
    const start = Math.floor((i * n) / N_BINS);
    const end = Math.floor(((i + 1) * n) / N_BINS);
    const slice = sorted.slice(start, end);
    if (slice.length === 0) continue;
    const rep = slice.filter((p) => p.replicated).length;
    base.push({
      lo: slice[0].val,
      hi: slice[slice.length - 1].val,
      count: slice.length,
      replicated: rep,
      rate: (rep / slice.length) * 100,
      ciLow: 0,
      ciHigh: 100,
    });
  }
  if (base.length < N_BINS) return base;
  const cutoffs = base.slice(0, -1).map((b) => b.hi);
  const binOf = (v: number) => {
    let k = 0;
    while (k < cutoffs.length && v > cutoffs[k]) k++;
    return k;
  };
  const cis = bootstrapBinCIs(papers, binOf, base.length);
  return base.map((b, k) => ({ ...b, ciLow: cis[k][0], ciHigh: cis[k][1] }));
}

// Replication rate per SJR quartile (Q1..Q4), with cluster-bootstrap CIs. The
// quartile is a discrete 1..4 metric, so this is its natural companion chart.
function buildQuartileBins(papers: QualPaper[]): Bin[] {
  // papers here carry val = quartile (1..4)
  const binOf = (v: number) => Math.round(v) - 1; // 1->0 .. 4->3
  const rep = [0, 0, 0, 0];
  const tot = [0, 0, 0, 0];
  for (const p of papers) {
    const k = binOf(p.val);
    if (k < 0 || k > 3) continue;
    tot[k]++;
    if (p.replicated) rep[k]++;
  }
  const cis = bootstrapBinCIs(papers, binOf, 4);
  const bins: Bin[] = [];
  for (let k = 0; k < 4; k++) {
    if (tot[k] === 0) continue;
    bins.push({
      lo: k + 1,
      hi: k + 1,
      count: tot[k],
      replicated: rep[k],
      rate: (rep[k] / tot[k]) * 100,
      ciLow: cis[k][0],
      ciHigh: cis[k][1],
      label: `Q${k + 1}`,
    });
  }
  return bins;
}

export function RankDashboard({
  journals,
  rows,
  replicationTypes,
  meta,
  csvName,
}: {
  journals: JournalRank[];
  rows: PaperRow[];
  replicationTypes: string[];
  meta: RankMeta;
  csvName: string;
}) {
  const [criterion, setCriterion] = useState(0);
  const [metric, setMetric] = useState(RANK);
  const [basis, setBasis] = useState<"pub" | "recent">("pub");
  const [threshold, setThreshold] = useState(0.75);
  const [minPapers, setMinPapers] = useState(15);
  const [repType, setRepType] = useState(-1); // -1 = all types
  const [showCI, setShowCI] = useState(false);

  // Effect-level row counts per replication type, for the dropdown labels.
  const typeCounts = useMemo(() => {
    const counts = new Array(replicationTypes.length).fill(0) as number[];
    for (const r of rows) if (r.t >= 0) counts[r.t]++;
    return counts;
  }, [rows, replicationTypes]);

  // Group effect-level rows into papers (only the replication-type filter
  // applies here; a paper's outcome is judged on its matching effect rows).
  const papers: Paper[] = useMemo(() => {
    const byId = new Map<number, Paper>();
    for (const r of rows) {
      if (repType >= 0 && r.t !== repType) continue;
      let paper = byId.get(r.p);
      if (!paper) {
        paper = { j: r.j, y: r.y, codes: [] };
        byId.set(r.p, paper);
      }
      if (paper.y === null && r.y !== null) paper.y = r.y;
      paper.codes.push(r.o);
    }
    return Array.from(byId.values());
  }, [rows, repType]);

  // Look up a journal's metric value under the current basis. Percentile,
  // quartile, and rank vary by publication year; h-index is a snapshot. Rank/
  // percentile can legitimately be 0-ish, so we only reject null/non-finite,
  // and (for percentile/h-index/quartile) require > 0; rank is allowed to be any
  // positive integer.
  const valueFor = useMemo(() => {
    return (j: number, y: number | null): number | null => {
      const jr = journals[j];
      if (!jr) return null;
      let quad: (number | null)[] | null = null;
      if (basis === "recent") quad = jr.recent;
      else if (y !== null) quad = jr.byYear[String(y)] ?? null;
      if (!quad) return null;
      const v = quad[metric];
      if (v === null || !Number.isFinite(v)) return null;
      return v;
    };
  }, [journals, basis, metric]);

  // Reactive: classify papers under the selected criterion/threshold, attach the
  // chosen metric value, and drop papers with no usable outcome/metric.
  const { qualified, quartilePapers, stats } = useMemo(() => {
    const qualified: QualPaper[] = [];
    const quartilePapers: QualPaper[] = [];
    let noOutcome = 0;
    let noMetric = 0;

    for (const paper of papers) {
      let success = 0;
      let determinate = 0;
      for (const c of paper.codes) {
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
      const replicated = success / determinate >= threshold;

      if (paper.j < 0) {
        noMetric++;
        continue;
      }

      // Collect the quartile FIRST, guarded only on the paper's own quartile slot
      // (not the selected metric), so the quartile bar chart is truly
      // metric-independent — a paper whose selected metric happens to be null but
      // whose quartile is present must still count here.
      const jr = journals[paper.j];
      const quad = basis === "recent" ? jr.recent : paper.y !== null ? jr.byYear[String(paper.y)] ?? null : null;
      const q = quad ? quad[QUARTILE] : null;
      if (q !== null && Number.isFinite(q)) {
        quartilePapers.push({ j: paper.j, val: q, replicated });
      }

      const val = valueFor(paper.j, paper.y);
      if (val === null) {
        noMetric++;
        continue;
      }
      qualified.push({ j: paper.j, val, replicated });
    }

    return {
      qualified,
      quartilePapers,
      stats: {
        totalPapers: papers.length,
        classified: qualified.length,
        noOutcome,
        noMetric,
      },
    };
  }, [papers, journals, criterion, threshold, basis, valueFor]);

  // Equal-count quantile bins over the selected metric.
  const bins = useMemo(() => buildBins(qualified), [qualified]);
  // Quartile bar chart (always over the quartile metric).
  const quartileBins = useMemo(() => buildQuartileBins(quartilePapers), [quartilePapers]);

  // Per-journal scatter points (journals with >= minPapers papers).
  const scatter = useMemo(() => {
    const byJournal = new Map<number, { rep: number; total: number; valSum: number }>();
    for (const p of qualified) {
      const e = byJournal.get(p.j) || { rep: 0, total: 0, valSum: 0 };
      e.total++;
      e.valSum += p.val;
      if (p.replicated) e.rep++;
      byJournal.set(p.j, e);
    }
    const out: {
      name: string;
      val: number;
      rate: number;
      ciLow: number;
      ciHigh: number;
      n: number;
      highImpact: boolean;
    }[] = [];
    for (const [j, e] of byJournal) {
      if (e.total < minPapers) continue;
      // Recent basis: the journal's snapshot value. Publication basis: mean of
      // the per-paper publication-year values contributing to this journal.
      let val: number | null = null;
      if (basis === "recent") {
        val = journals[j].recent ? journals[j].recent![metric] : null;
      } else {
        val = e.valSum / e.total;
      }
      if (val === null || !Number.isFinite(val)) continue;
      const [ciLow, ciHigh] = wilsonCI(e.rep, e.total);
      // Label the recognizable top-ranked journals (recent percentile > 99),
      // using the same fixed set across every metric so labels stay stable as the
      // x-axis switches; each labeled point still sits at its own metric value.
      const recent = journals[j].recent;
      const highImpact = !!recent && (recent[PERCENTILE] ?? 0) > 99;
      out.push({
        name: journals[j].name,
        val,
        rate: (e.rep / e.total) * 100,
        ciLow,
        ciHigh,
        n: e.total,
        highImpact,
      });
    }
    return out.sort((a, b) => a.val - b.val);
  }, [qualified, journals, basis, metric, minPapers]);

  // Per-journal correlation between replication rate and each rank metric, over
  // journals with >= minPapers papers. Classification is metric-independent, so
  // only the x-value differs across rows.
  const correlations = useMemo(() => {
    return METRIC_OPTIONS.map((opt) => {
      const m = opt.value;
      const byJournal = new Map<number, { rep: number; total: number; valSum: number }>();
      for (const paper of papers) {
        let success = 0, determinate = 0;
        for (const c of paper.codes) {
          const o = c[criterion];
          if (o === "s") { success++; determinate++; }
          else if (o === "f" || o === "r") determinate++;
        }
        if (determinate === 0 || paper.j < 0) continue;
        const jr = journals[paper.j];
        let val: number | null = null;
        if (basis === "recent") val = jr.recent ? jr.recent[m] : null;
        else if (paper.y !== null) {
          const quad = jr.byYear[String(paper.y)];
          val = quad ? quad[m] : null;
        }
        if (val === null || !Number.isFinite(val)) continue;
        const e = byJournal.get(paper.j) || { rep: 0, total: 0, valSum: 0 };
        e.total++;
        e.valSum += val;
        if (success / determinate >= threshold) e.rep++;
        byJournal.set(paper.j, e);
      }
      const vals: number[] = [];
      const rates: number[] = [];
      for (const [j, e] of byJournal) {
        if (e.total < minPapers) continue;
        const val = basis === "recent" ? journals[j].recent?.[m] ?? null : e.valSum / e.total;
        if (val === null || !Number.isFinite(val)) continue;
        vals.push(val);
        rates.push((e.rep / e.total) * 100);
      }
      return {
        label: opt.label,
        r: pearson(vals, rates),
        rho: spearman(vals, rates),
        n: vals.length,
        lowerIsBetter: LOWER_IS_BETTER.has(m),
      };
    });
  }, [papers, journals, criterion, threshold, basis, minPapers]);

  const metricLabel = METRIC_OPTIONS[metric].label;
  const basisLabel = basis === "recent" ? `recent (${meta.snapshotYear ?? "latest"})` : "at publication year";
  const metricNounLower =
    metric === PERCENTILE ? "SJR percentile"
    : metric === QUARTILE ? "SJR quartile"
    : metric === RANK ? "SJR overall rank"
    : "journal h-index";

  // X-axis titles reflect the basis.
  const phrase =
    basis === "recent"
      ? `${metricLabel} (${meta.snapshotYear ?? "latest"})`
      : `${metricLabel} at time of original study's publication`;
  const quintileAxis = `Journal ${phrase} (quintile range)`;
  const scatterAxis =
    (basis === "recent"
      ? `Journal ${metricLabel} (${meta.snapshotYear ?? "latest"})`
      : `Average ${metricLabel} at time of original study's publication`) +
    (metric === RANK ? " — log scale" : "");

  // Higher rank/percentile prestige direction, for prose.
  const higherMeansMorePrestigious = !LOWER_IS_BETTER.has(metric);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Replication Rate by Journal Rank
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Do papers published in more prestigious journals replicate more or less often? Each
          original paper is matched to its journal&rsquo;s {metricNounLower} and classified as
          &ldquo;replicated&rdquo; if at least {Math.round(threshold * 100)}% of its effect
          replications succeeded under the selected criterion. Metric shown: {metricLabel},{" "}
          {basisLabel}.
          {SNAPSHOT_ONLY_METRICS.has(metric) && (
            <>
              {" "}
              <span className="italic">
                The h-index is a cumulative per-journal figure, so it does not vary by
                publication year.
              </span>
            </>
          )}
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
          <span className="text-gray-600 dark:text-gray-300">Metric</span>
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
          <span className="text-gray-600 dark:text-gray-300">Basis</span>
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value as "pub" | "recent")}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="pub">At publication year</option>
            <option value="recent">Recent ({meta.snapshotYear ?? "latest"})</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">Success threshold</span>
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

        <label className="flex flex-col gap-1 text-sm">
          <span
            className="text-gray-600 dark:text-gray-300 cursor-help"
            title="Minimum number of plotted papers a journal needs to appear as a point in the per-journal scatterplot (and the correlation table). Journals with few papers have high-variance rate estimates. The quantile and quartile charts above always use all papers."
          >
            Min papers per journal
          </span>
          <select
            value={minPapers}
            onChange={(e) => setMinPapers(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
          >
            {MIN_PAPERS_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer pb-1.5 self-end">
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

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {stats.classified.toLocaleString()} papers plotted &middot;{" "}
        {stats.noMetric.toLocaleString()} excluded (no {basis === "recent" ? "recent" : "publication-year"} {metricNounLower}) &middot;{" "}
        {stats.noOutcome.toLocaleString()} excluded (inconclusive outcome)
      </p>

      {/* Quartile bar chart */}
      <section className="space-y-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Replication rate by SJR quartile
        </h2>
        {quartileBins.length === 0 ? (
          <p className="text-sm text-gray-500">Not enough data for this selection.</p>
        ) : (
          <div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
              <QuartileChart bins={quartileBins} showCI={showCI} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              All papers grouped by their journal&rsquo;s SCImago best-quartile in the
              publication year (Q1 = most prestigious). Whiskers are 95% intervals from a
              journal-cluster bootstrap ({BOOTSTRAP_ITERS.toLocaleString()} resamples of journals
              with replacement). Most replicated papers come from Q1 journals, so the higher
              quartiles have few papers and wide intervals.
            </p>
          </div>
        )}
      </section>

      {/* Binned quantile chart (over the selected metric) */}
      <section className="space-y-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Replication rate by {metricNounLower} quintile
        </h2>
        {bins.length === 0 ? (
          <p className="text-sm text-gray-500">Not enough data for this selection.</p>
        ) : (
          <div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
              <BinnedChart bins={bins} xTitle={quintileAxis} lowerIsBetter={LOWER_IS_BETTER.has(metric)} showCI={showCI} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              All papers with a publication-year {metricNounLower}, split into five equal-count
              bins{metric === RANK ? " (note: rank 1 is the most prestigious, so bins run best → worst left to right)" : ""}.
              Whiskers are cluster-bootstrap 95% intervals.
            </p>
          </div>
        )}
      </section>

      {/* Scatter */}
      <section className="space-y-3">
        <h2 className="text-lg md:text-xl font-semibold tracking-tight">
          Per-journal replication rate vs {metricNounLower}
        </h2>
        {scatter.length === 0 ? (
          <p className="text-sm text-gray-500">
            No journals reach {minPapers} papers for this selection.
          </p>
        ) : (
          <div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
              <ScatterChart points={scatter} metricLabel={metricLabel} xTitle={scatterAxis} logScale={metric === RANK} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              One point per journal with at least {minPapers} plotted papers. Point size
              reflects the number of papers; whiskers are 95% Wilson CIs.
              {metric === RANK && " Lower rank numbers are more prestigious journals."}
            </p>
          </div>
        )}
      </section>

      {/* Correlation table */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Replication rate correlation vs rank metric
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Correlation between a journal&rsquo;s replication rate and each rank metric, across
            the {correlations[0]?.n ?? 0} journals with at least {minPapers} plotted papers.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-600 dark:text-gray-300">
                <th className="py-2 pr-6 font-medium">Metric</th>
                <th className="py-2 pr-6 font-medium text-right">Pearson r</th>
                <th className="py-2 pr-6 font-medium text-right">Spearman &rho;</th>
                <th className="py-2 font-medium text-right">Journals (n)</th>
              </tr>
            </thead>
            <tbody>
              {correlations.map((c) => (
                <tr key={c.label} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-6">
                    {c.label}
                    {c.lowerIsBetter && <span className="text-xs opacity-60"> (lower = better)</span>}
                  </td>
                  <td className="py-2 pr-6 text-right tabular-nums">{c.r === null ? "—" : c.r.toFixed(2)}</td>
                  <td className="py-2 pr-6 text-right tabular-nums">{c.rho === null ? "—" : c.rho.toFixed(2)}</td>
                  <td className="py-2 text-right tabular-nums">{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Correlations use the current success criterion, threshold, and basis. For percentile
          and h-index (higher = more prestigious), a negative value means more-prestigious
          journals replicate less often. For rank and quartile (marked &ldquo;lower =
          better&rdquo;), the sign is reversed: a <em>positive</em> value means more-prestigious
          journals replicate less often. Spearman is robust to each metric&rsquo;s skew.
        </p>
      </section>

      {/* Methodology */}
      <section className="text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-800 pt-6">
        <p>
          <strong>Rank metrics.</strong> All four come from the SCImago Journal Rank (SJR).{" "}
          <em>SJR percentile</em> is 100 &times; (1 &minus; (rank &minus; 1) / N) over that
          year&rsquo;s N ranked journals, so it is comparable across years even though the raw
          rank is not (SCImago ranked ~17,000 journals in 1999, growing to ~32,000 by 2024).{" "}
          <em>SJR quartile</em> is the journal&rsquo;s best subject-category quartile (Q1&ndash;Q4).{" "}
          <em>SJR overall rank</em> is the raw position that year (1 = highest SJR).{" "}
          <em>Journal h-index</em> is SCImago&rsquo;s cumulative journal h-index (a snapshot,
          not year-specific). Percentile, quartile, and rank are taken per publication year;
          papers before 1999 use the 1999 ranking.
        </p>
        <p>
          <strong>Matching.</strong> Journal names in the replications database are joined to
          the SCImago data by ISSN with a normalized-name fallback (~93% of matched journals).
          Books, preprints, and conference proceedings are not ranked and are excluded.
        </p>
        <p>
          <strong>Attribution.</strong> SJR data: SCImago, (n.d.).{" "}
          <em>SJR &mdash; SCImago Journal &amp; Country Rank</em> [Portal], retrieved from{" "}
          <a href="https://www.scimagojr.com" className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer">
            scimagojr.com
          </a>{" "}
          (used non-commercially).
        </p>
        <p>
          Data: {csvName}; rank metrics generated {meta.generated}.
        </p>
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        <Link href="/replications-database" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to the replications database
        </Link>
      </p>
    </div>
  );
}

// Bar chart of replication rate per equal-count quantile bin (generic over any
// metric). lowerIsBetter only affects the x-axis note wording via the caller.
function BinnedChart({
  bins,
  xTitle,
  lowerIsBetter,
  showCI = false,
}: {
  bins: Bin[];
  xTitle: string;
  lowerIsBetter?: boolean;
  showCI?: boolean;
}) {
  const W = 720;
  const H = 320;
  const M = { top: 20, right: 20, bottom: 64, left: 62 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bandW = plotW / bins.length;
  const barW = bandW * 0.6;
  const y = (pct: number) => M.top + plotH * (1 - pct / 100);

  // Rank values are large integers; percentile 0–100; format compactly.
  const fmt = (v: number) => {
    if (Number.isInteger(v)) return v.toLocaleString();
    return v >= 10 ? v.toFixed(0) : v.toFixed(1);
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={W - M.right} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.12} />
            <line x1={M.left - 6} x2={M.left} y1={y(g)} y2={y(g)} stroke="#000000" strokeWidth={1} />
            <text x={M.left - 10} y={y(g) + 4} textAnchor="end" fontSize={12} className="fill-black dark:fill-gray-100">
              {g}%
            </text>
          </g>
        ))}
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
                  {`${fmt(b.lo)}–${fmt(b.hi)}: ${b.rate.toFixed(1)}% replicated (${b.replicated}/${b.count}), cluster-bootstrap 95% CI [${b.ciLow.toFixed(0)}–${b.ciHigh.toFixed(0)}%]`}
                </title>
              </rect>
              {showCI && (
                <>
                  <line x1={cx} x2={cx} y1={y(b.ciLow)} y2={y(b.ciHigh)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                  <line x1={cx - 5} x2={cx + 5} y1={y(b.ciLow)} y2={y(b.ciLow)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                  <line x1={cx - 5} x2={cx + 5} y1={y(b.ciHigh)} y2={y(b.ciHigh)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                </>
              )}
              <text x={cx} y={(showCI ? y(b.ciHigh) : top) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="currentColor">
                {b.rate.toFixed(0)}%
              </text>
              <line x1={cx} x2={cx} y1={M.top + plotH} y2={M.top + plotH + 5} stroke="#000000" strokeWidth={1} />
              <text x={cx} y={H - M.bottom + 18} textAnchor="middle" fontSize={11} className="fill-black dark:fill-gray-100">
                {b.label ?? `${fmt(b.lo)}–${fmt(b.hi)}`}
              </text>
              <text x={cx} y={H - M.bottom + 34} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.5}>
                n={b.count}
              </text>
            </g>
          );
        })}
        <text x={M.left + plotW / 2} y={H - 6} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-black dark:fill-gray-100">
          {xTitle}
        </text>
        <text transform={`translate(14 ${M.top + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-black dark:fill-gray-100">
          Replication rate (%)
        </text>
        <ChartWatermark x={M.left + 8} y={M.top + 4} />
      </svg>
    </div>
  );
}

// Discrete Q1–Q4 bar chart, one bar per quartile.
function QuartileChart({ bins, showCI = false }: { bins: Bin[]; showCI?: boolean }) {
  const W = 720;
  const H = 320;
  const M = { top: 20, right: 20, bottom: 48, left: 62 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bandW = plotW / bins.length;
  const barW = bandW * 0.55;
  const y = (pct: number) => M.top + plotH * (1 - pct / 100);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={W - M.right} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.12} />
            <line x1={M.left - 6} x2={M.left} y1={y(g)} y2={y(g)} stroke="#000000" strokeWidth={1} />
            <text x={M.left - 10} y={y(g) + 4} textAnchor="end" fontSize={12} className="fill-black dark:fill-gray-100">
              {g}%
            </text>
          </g>
        ))}
        <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        {bins.map((b, i) => {
          const cx = M.left + bandW * i + bandW / 2;
          const bx = cx - barW / 2;
          const top = y(b.rate);
          const qi = Math.round(b.lo) - 1;
          return (
            <g key={i}>
              <rect x={bx} y={top} width={barW} height={M.top + plotH - top} rx={2} fill={REPLICATED} opacity={0.85}>
                <title>
                  {`Q${qi + 1}: ${b.rate.toFixed(1)}% replicated (${b.replicated}/${b.count}), cluster-bootstrap 95% CI [${b.ciLow.toFixed(0)}–${b.ciHigh.toFixed(0)}%]`}
                </title>
              </rect>
              {showCI && (
                <>
                  <line x1={cx} x2={cx} y1={y(b.ciLow)} y2={y(b.ciHigh)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                  <line x1={cx - 5} x2={cx + 5} y1={y(b.ciLow)} y2={y(b.ciLow)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                  <line x1={cx - 5} x2={cx + 5} y1={y(b.ciHigh)} y2={y(b.ciHigh)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                </>
              )}
              <text x={cx} y={(showCI ? y(b.ciHigh) : top) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="currentColor">
                {b.rate.toFixed(0)}%
              </text>
              <line x1={cx} x2={cx} y1={M.top + plotH} y2={M.top + plotH + 5} stroke="#000000" strokeWidth={1} />
              <text x={cx} y={H - M.bottom + 20} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-black dark:fill-gray-100">
                {b.label}
              </text>
              <text x={cx} y={H - M.bottom + 35} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.5}>
                n={b.count}
              </text>
            </g>
          );
        })}
        <text transform={`translate(14 ${M.top + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-black dark:fill-gray-100">
          Replication rate (%)
        </text>
        <text x={M.left + plotW / 2} y={H - 6} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-black dark:fill-gray-100">
          SCImago best quartile (Q1 = most prestigious)
        </text>
        <ChartWatermark rightX={W - M.right - 8} y={M.top + 4} />
      </svg>
    </div>
  );
}

// Places journal labels next to their scatter points, then de-overlaps them.
type PlacedLabel<T> = {
  p: T;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  anchor: "start" | "end";
};
function layoutLabels<T extends { name: string }>(
  pts: T[],
  xOf: (p: T) => number,
  yOf: (p: T) => number,
  rOf: (p: T) => number,
  wOf: (p: T) => number,
  topBound: number,
): PlacedLabel<T>[] {
  const pad = 4;
  const boxH = 13;
  const gap = 2;
  const xVals = pts.map(xOf);
  const rightEdge = xVals.length ? Math.max(...xVals) : 0;
  const placed: PlacedLabel<T>[] = pts.map((p) => {
    const cx = xOf(p);
    const cy = yOf(p);
    const anchor: "start" | "end" = cx >= rightEdge - 1 ? "end" : "start";
    const dir = anchor === "end" ? -1 : 1;
    const off = rOf(p) + 5;
    const tw = wOf(p);
    const tx = cx + dir * off;
    const ty = cy - off;
    const boxX = anchor === "end" ? tx - tw - pad : tx - pad;
    return { p, cx, cy, tx, ty, boxX, boxY: ty - 10, boxW: tw + pad * 2, boxH, anchor };
  });
  const order = [...placed].sort((a, b) => a.boxY - b.boxY);
  const settled: PlacedLabel<T>[] = [];
  for (const lab of order) {
    for (let pass = 0; pass < order.length; pass++) {
      let moved = false;
      for (const prev of settled) {
        const xOverlap = lab.boxX < prev.boxX + prev.boxW && prev.boxX < lab.boxX + lab.boxW;
        if (!xOverlap) continue;
        const yOverlap = lab.boxY < prev.boxY + prev.boxH + gap && prev.boxY < lab.boxY + lab.boxH + gap;
        if (yOverlap) {
          const shift = prev.boxY - (lab.boxY + lab.boxH + gap);
          lab.boxY += shift;
          lab.ty += shift;
          moved = true;
        }
      }
      if (!moved) break;
    }
    if (lab.boxY < topBound) {
      const shift = topBound - lab.boxY;
      lab.boxY += shift;
      lab.ty += shift;
    }
    settled.push(lab);
  }
  return placed;
}

function ScatterChart({
  points,
  metricLabel,
  xTitle,
  logScale = false,
}: {
  points: { name: string; val: number; rate: number; ciLow: number; ciHigh: number; n: number; highImpact: boolean }[];
  metricLabel: string;
  xTitle: string;
  logScale?: boolean;
}) {
  const W = 720;
  const H = 380;
  const M = { top: 20, right: 20, bottom: 52, left: 62 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const labelRefs = useRef(new Map<string, SVGTextElement>());
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  useEffect(() => {
    const measure = () => {
      const next: Record<string, number> = {};
      labelRefs.current.forEach((el, name) => {
        if (el && el.isConnected) next[name] = el.getComputedTextLength();
      });
      setLabelWidths(next);
    };
    measure();
    let cancelled = false;
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [points]);

  const minV = Math.min(...points.map((p) => p.val));
  const maxV = Math.max(...points.map((p) => p.val));

  const y = (pct: number) => M.top + plotH * (1 - pct / 100);
  const maxN = Math.max(...points.map((p) => p.n));
  const r = (n: number) => 3 + 7 * Math.sqrt(n / maxN);

  // On a log scale (used for SJR overall rank, which spans 1 to tens of
  // thousands) the domain snaps to enclosing powers of ten and ticks fall on
  // each decade; otherwise a generic linear scale spans the data with ~6 ticks
  // at "nice" round steps (percentile 0–100, h-index, etc.).
  let x: (v: number) => number;
  let ticks: number[];
  let fmtTick: (t: number) => string;

  if (logScale) {
    // Guard against non-positive values (log undefined); rank is always >= 1.
    const lo = Math.max(1, minV);
    const loExp = Math.floor(Math.log10(lo));
    const hiExp = Math.ceil(Math.log10(Math.max(maxV, lo * 10)));
    const lx = Math.pow(10, loExp);
    const hx = Math.pow(10, hiExp);
    const lDenom = Math.log10(hx) - Math.log10(lx) || 1;
    x = (v: number) => M.left + plotW * ((Math.log10(Math.max(v, 1)) - Math.log10(lx)) / lDenom);
    ticks = [];
    for (let e = loExp; e <= hiExp; e++) ticks.push(Math.pow(10, e));
    fmtTick = (t: number) => t.toLocaleString();
  } else {
    const span = maxV - minV || 1;
    const niceStep = (raw: number) => {
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / mag;
      const step = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
      return step * mag;
    };
    const step = niceStep(span / 5);
    const xMin = Math.floor(minV / step) * step;
    const xMax = Math.ceil(maxV / step) * step;
    const denom = xMax - xMin || 1;
    x = (v: number) => M.left + plotW * ((v - xMin) / denom);
    // Build ticks, deduping any that collapse to the same rounded value when the
    // data spans a very narrow range (step < 0.01) — otherwise identical labels
    // overlap and React sees duplicate keys.
    ticks = [];
    const seenTicks = new Set<number>();
    for (let t = xMin; t <= xMax + step / 2; t += step) {
      const rounded = Math.round(t * 100) / 100;
      if (!seenTicks.has(rounded)) {
        seenTicks.add(rounded);
        ticks.push(rounded);
      }
    }
    fmtTick = (t: number) => (Number.isInteger(t) ? t.toLocaleString() : t.toFixed(1));
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={W - M.right} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.12} />
            <line x1={M.left - 6} x2={M.left} y1={y(g)} y2={y(g)} stroke="#000000" strokeWidth={1} />
            <text x={M.left - 10} y={y(g) + 4} textAnchor="end" fontSize={12} className="fill-black dark:fill-gray-100">
              {g}%
            </text>
          </g>
        ))}
        {ticks.map((t, ti) => (
          <g key={ti}>
            <line x1={x(t)} x2={x(t)} y1={M.top} y2={M.top + plotH} stroke="currentColor" strokeOpacity={0.08} />
            <line x1={x(t)} x2={x(t)} y1={M.top + plotH} y2={M.top + plotH + 5} stroke="#000000" strokeWidth={1} />
            <text x={x(t)} y={M.top + plotH + 17} textAnchor="middle" fontSize={12} className="fill-black dark:fill-gray-100">
              {fmtTick(t)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        {points.map((p) => (
          <g key={p.name}>
            <line x1={x(p.val)} x2={x(p.val)} y1={y(p.ciLow)} y2={y(p.ciHigh)} stroke={POINT} strokeWidth={1} opacity={0.35} />
            <circle cx={x(p.val)} cy={y(p.rate)} r={r(p.n)} fill={POINT} fillOpacity={0.55} stroke={POINT} strokeWidth={1}>
              <title>
                {`${p.name}\n${metricLabel}: ${p.val.toLocaleString()}\nReplication rate: ${p.rate.toFixed(0)}% (n=${p.n}), 95% CI [${p.ciLow.toFixed(0)}–${p.ciHigh.toFixed(0)}%]`}
              </title>
            </circle>
          </g>
        ))}
        {layoutLabels(
          points.filter((p) => p.highImpact && p.name !== "Journal of Consumer Research"),
          (p) => x(p.val),
          (p) => y(p.rate),
          (p) => r(p.n),
          (p) => labelWidths[p.name] ?? journalLabel(p.name).length * 6,
          M.top,
        ).map(({ p, tx, ty, boxX, boxY, boxW, boxH, anchor, cx, cy }) => {
          const cornerX = anchor === "end" ? boxX + boxW : boxX;
          return (
            <g key={`label-${p.name}`}>
              <line x1={cx} y1={cy} x2={cornerX} y2={boxY + boxH} stroke="#6b7280" strokeWidth={0.7} opacity={0.9} />
              <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={2.5} fill="#ffffff" stroke="#9ca3af" strokeWidth={0.6} />
              <text
                ref={(el) => {
                  if (el) labelRefs.current.set(p.name, el);
                  else labelRefs.current.delete(p.name);
                }}
                x={tx}
                y={ty}
                textAnchor={anchor}
                fontSize={10}
                fontStyle="italic"
                fill="#111827"
              >
                {journalLabel(p.name)}
              </text>
            </g>
          );
        })}
        <text x={M.left + plotW / 2} y={H - 6} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-black dark:fill-gray-100">
          {xTitle}
        </text>
        <text transform={`translate(14 ${M.top + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-black dark:fill-gray-100">
          Replication rate (%)
        </text>
        <ChartWatermark x={M.left + 8} y={M.top + 4} />
      </svg>
    </div>
  );
}
