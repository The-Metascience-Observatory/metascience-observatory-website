"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChartWatermark } from "@/components/ChartWatermark";
import type { IFMeta, JournalIF, PaperRow } from "./types";

// Wilson score 95% CI for a proportion k/n (percentage points).
// Copied from the by-journal / by-discipline pages to keep the definition
// identical across the replications-database analysis views.
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

const REPLICATED = "#10b981";
const NOT_REPLICATED = "#f87171";
const POINT = "#2563eb";

const CRITERION_OPTIONS = [
  { value: 0, label: "Reported result (success / failure column)" },
  { value: 1, label: "Statistically significant effect in the same direction?" },
  { value: 2, label: "Original effect size in replication 95% confidence interval?" },
  { value: 3, label: "Replication effect size in original 95% confidence interval?" },
];

const METRIC_OPTIONS = [
  { value: 0, label: "2-year impact factor" },
  { value: 1, label: "5-year impact factor" },
  { value: 2, label: "CiteScore" },
  { value: 3, label: "OpenAlex 2-year mean citedness" },
  { value: 4, label: "SCImago SJR" },
];
// Metric indices that are a single current snapshot (no per-publication-year
// series): the "publication year" basis has nothing year-specific to show, so
// the UI notes it falls back to the snapshot value. (OpenAlex 2yr only; SJR is
// genuinely per-year.)
const SNAPSHOT_ONLY_METRICS = new Set([3]);

const THRESHOLD_OPTIONS = [0.5, 0.75, 0.9, 1.0];

// Short forms for a few long journal names, used only for on-chart point labels.
function journalLabel(name: string): string {
  if (name === "New England Journal of Medicine") return "NEJM";
  if (name === "The Quarterly Journal of Economics") return "Quarterly Journal of Economics";
  if (name === "American Economic Review") return "Am. Econ. Review";
  return name;
}

// Options for the minimum papers a journal needs to appear in the scatter.
const MIN_PAPERS_OPTIONS = [5, 10, 15, 20, 25, 30, 50];
const N_BINS = 5;

interface Paper {
  j: number;
  y: number | null;
  codes: string[]; // one 4-char outcome string per effect-level row
}

interface QualPaper {
  j: number;
  ifVal: number;
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
  binOf: (ifv: number) => number,
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
        const k = binOf(p.ifVal);
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

// Split papers into N_BINS equal-COUNT bins by impact factor, with a
// cluster-bootstrap CI per bin.
function buildBins(papers: QualPaper[]): Bin[] {
  const sorted = [...papers].sort((a, b) => a.ifVal - b.ifVal);
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
      lo: slice[0].ifVal,
      hi: slice[slice.length - 1].ifVal,
      count: slice.length,
      replicated: rep,
      rate: (rep / slice.length) * 100,
      ciLow: 0,
      ciHigh: 100,
    });
  }
  if (base.length < N_BINS) return base;
  const cutoffs = base.slice(0, -1).map((b) => b.hi);
  const binOf = (ifv: number) => {
    let k = 0;
    while (k < cutoffs.length && ifv > cutoffs[k]) k++;
    return k;
  };
  const cis = bootstrapBinCIs(papers, binOf, base.length);
  return base.map((b, k) => ({ ...b, ciLow: cis[k][0], ciHigh: cis[k][1] }));
}

// Split papers into equal-WIDTH impact-factor bins (0–width, width–2·width, …),
// with the top bin a catch-all (">= (n-1)·width") so no data is dropped.
function buildEqualWidthBins(papers: QualPaper[], nBins: number, width: number): Bin[] {
  if (papers.length === 0) return [];
  const maxIF = Math.max(...papers.map((p) => p.ifVal));
  const binOf = (ifv: number) => Math.min(Math.floor(ifv / width), nBins - 1);
  const rep = new Array(nBins).fill(0);
  const tot = new Array(nBins).fill(0);
  for (const p of papers) {
    const k = binOf(p.ifVal);
    tot[k]++;
    if (p.replicated) rep[k]++;
  }
  const cis = bootstrapBinCIs(papers, binOf, nBins);
  const bins: Bin[] = [];
  for (let k = 0; k < nBins; k++) {
    const lo = k * width;
    const hi = k === nBins - 1 ? maxIF : (k + 1) * width;
    bins.push({
      lo,
      hi,
      count: tot[k],
      replicated: rep[k],
      rate: tot[k] > 0 ? (rep[k] / tot[k]) * 100 : 0,
      ciLow: cis[k][0],
      ciHigh: cis[k][1],
      label: k === nBins - 1 ? `${lo}+` : `${lo}–${(k + 1) * width}`,
    });
  }
  return bins;
}

export function ImpactFactorDashboard({
  journals,
  rows,
  replicationTypes,
  meta,
  csvName,
}: {
  journals: JournalIF[];
  rows: PaperRow[];
  replicationTypes: string[];
  meta: IFMeta;
  csvName: string;
}) {
  const [criterion, setCriterion] = useState(0);
  const [metric, setMetric] = useState(0);
  const [basis, setBasis] = useState<"pub" | "recent">("pub");
  const [threshold, setThreshold] = useState(0.75);
  const [minPapers, setMinPapers] = useState(15);
  const [repType, setRepType] = useState(-1); // -1 = all types

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

  // Reactive: classify papers under the selected criterion/threshold, attach
  // the chosen impact-factor value, and drop papers with no usable outcome/IF.
  const { qualified, stats } = useMemo(() => {
    const qualified: QualPaper[] = [];
    let noOutcome = 0;
    let noIF = 0;

    for (const paper of papers) {
      // success / (success+failure+reversal); inconclusive & blank excluded.
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
        noIF++;
        continue;
      }
      const journal = journals[paper.j];
      let ifVal: number | null = null;
      if (basis === "recent") {
        ifVal = journal.recent ? journal.recent[metric] : null;
      } else if (paper.y !== null) {
        const triple = journal.byYear[String(paper.y)];
        ifVal = triple ? triple[metric] : null;
      }
      if (ifVal === null || !Number.isFinite(ifVal) || ifVal <= 0) {
        noIF++;
        continue;
      }
      qualified.push({ j: paper.j, ifVal, replicated });
    }

    return {
      qualified,
      stats: {
        totalPapers: papers.length,
        classified: qualified.length,
        noOutcome,
        noIF,
      },
    };
  }, [papers, journals, criterion, metric, basis, threshold]);

  // Binned rate: split ALL qualifying papers into equal-count IF quantiles.
  // Unlike the per-journal scatter, this aggregate view uses every paper (no
  // min-papers-per-journal filter): a low-volume journal contributes one honest
  // data point, and filtering to big journals would bias the bins toward high-
  // volume venues and discard about half the data.
  const bins = useMemo(() => buildBins(qualified), [qualified]);
  // Equal-width companion (5 bins of width 4: 0–4 … 12–16, 16+).
  const widthBins = useMemo(() => buildEqualWidthBins(qualified, 5, 4), [qualified]);

  // Per-journal scatter points (journals with >= minPapers papers).
  const scatter = useMemo(() => {
    const byJournal = new Map<number, { rep: number; total: number; ifSum: number }>();
    for (const p of qualified) {
      const e = byJournal.get(p.j) || { rep: 0, total: 0, ifSum: 0 };
      e.total++;
      e.ifSum += p.ifVal;
      if (p.replicated) e.rep++;
      byJournal.set(p.j, e);
    }
    const out: {
      name: string;
      ifVal: number;
      rate: number;
      ciLow: number;
      ciHigh: number;
      n: number;
      highImpact: boolean;
    }[] = [];
    for (const [j, e] of byJournal) {
      if (e.total < minPapers) continue;
      // Recent basis: the journal's snapshot IF. Publication basis: mean of the
      // per-paper publication-year IFs contributing to this journal.
      let ifVal: number | null = null;
      if (basis === "recent") {
        ifVal = journals[j].recent ? journals[j].recent![metric] : null;
      } else {
        ifVal = e.ifSum / e.total;
      }
      if (ifVal === null || !Number.isFinite(ifVal) || ifVal <= 0) continue;
      const [ciLow, ciHigh] = wilsonCI(e.rep, e.total);
      // Label the recognizable high-prestige journals (recent 2-year IF > 15),
      // using the same fixed set across every metric so labels stay stable as the
      // x-axis switches; each labeled point still sits at its own metric value.
      const recent = journals[j].recent;
      const highImpact = !!recent && (recent[0] ?? 0) > 15;
      out.push({
        name: journals[j].name,
        ifVal,
        rate: (e.rep / e.total) * 100,
        ciLow,
        ciHigh,
        n: e.total,
        highImpact,
      });
    }
    return out.sort((a, b) => a.ifVal - b.ifVal);
  }, [qualified, journals, basis, metric, minPapers]);

  // Per-journal correlation between replication rate and each impact-factor
  // metric, over the same journals shown in the scatter (>= minPapers papers,
  // current criterion/threshold/basis). Replication classification does not
  // depend on the metric, so only the IF value differs across the three rows.
  const correlations = useMemo(() => {
    return METRIC_OPTIONS.map((opt) => {
      const m = opt.value;
      const byJournal = new Map<number, { rep: number; total: number; ifSum: number }>();
      for (const paper of papers) {
        let success = 0, determinate = 0;
        for (const c of paper.codes) {
          const o = c[criterion];
          if (o === "s") { success++; determinate++; }
          else if (o === "f" || o === "r") determinate++;
        }
        if (determinate === 0 || paper.j < 0) continue;
        const jrec = journals[paper.j];
        let ifVal: number | null = null;
        if (basis === "recent") ifVal = jrec.recent ? jrec.recent[m] : null;
        else if (paper.y !== null) {
          const triple = jrec.byYear[String(paper.y)];
          ifVal = triple ? triple[m] : null;
        }
        if (ifVal === null || !Number.isFinite(ifVal) || ifVal <= 0) continue;
        const e = byJournal.get(paper.j) || { rep: 0, total: 0, ifSum: 0 };
        e.total++;
        e.ifSum += ifVal;
        if (success / determinate >= threshold) e.rep++;
        byJournal.set(paper.j, e);
      }
      const ifs: number[] = [];
      const rates: number[] = [];
      for (const [j, e] of byJournal) {
        if (e.total < minPapers) continue;
        const ifVal = basis === "recent" ? journals[j].recent?.[m] ?? null : e.ifSum / e.total;
        if (ifVal === null || !Number.isFinite(ifVal)) continue;
        ifs.push(ifVal);
        rates.push((e.rep / e.total) * 100);
      }
      return { label: opt.label, r: pearson(ifs, rates), rho: spearman(ifs, rates), n: ifs.length };
    });
  }, [papers, journals, criterion, threshold, basis, minPapers]);

  const metricLabel = METRIC_OPTIONS[metric].label;
  const basisLabel = basis === "recent" ? `recent (${meta.snapshotYear})` : "at publication year";
  // Noun for chart/section titles. Each metric has its own proper name; the two
  // self-computed impact factors (0,1) share the "OpenAlex-derived" label.
  // Title case for headings, lower case for mid-sentence use.
  const metricNoun =
    metric === 2 ? "CiteScore"
    : metric === 3 ? "OpenAlex 2-Year Mean Citedness"
    : metric === 4 ? "SCImago SJR"
    : "OpenAlex-derived Impact Factor";
  const metricNounLower =
    metric === 2 ? "CiteScore"
    : metric === 3 ? "OpenAlex 2-year mean citedness"
    : metric === 4 ? "SCImago SJR"
    : "OpenAlex-derived impact factor";

  // X-axis titles reflect the basis: publication-year IF is the journal's IF in
  // the year the original study was published; recent is a fixed snapshot.
  const ifPhrase =
    basis === "recent"
      ? `${metricLabel} in ${meta.snapshotYear}`
      : `${metricLabel} at time of original study's publication`;
  const quintileAxis = `Journal ${ifPhrase} (quintile range)`;
  const widthAxis = `Journal ${ifPhrase} (equal-width bins)`;
  // Scatter points aggregate a journal's papers; in publication-year basis the
  // x-value is the mean of the per-paper publication-year IFs, hence "Average".
  const scatterAxis =
    basis === "recent"
      ? `Journal ${metricLabel} in ${meta.snapshotYear}`
      : `Average ${metricLabel} at time of original study's publication`;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Replication Rate by Journal {metricNoun}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Does research published in higher-impact journals replicate more or less
          often? Each original paper is matched to its journal&rsquo;s {metricNounLower} and
          classified as &ldquo;replicated&rdquo; if at least{" "}
          {Math.round(threshold * 100)}% of its effect replications succeeded under the
          selected criterion. Metric shown: {metricLabel}, {basisLabel}.
          {SNAPSHOT_ONLY_METRICS.has(metric) && (
            <>
              {" "}
              <span className="italic">
                {metricLabel} is a single current snapshot from the OpenAlex API, so it does
                not vary by publication year.
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
            <option value="recent">Recent ({meta.snapshotYear})</option>
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
            title="Minimum number of plotted papers a journal needs to appear as a point in the per-journal scatterplot (and the correlation table). Journals with few papers have high-variance rate estimates. The quintile chart above always uses all papers."
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
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {stats.classified.toLocaleString()} papers plotted &middot;{" "}
        {stats.noIF.toLocaleString()} excluded (no {basis === "recent" ? "recent" : "publication-year"} impact factor) &middot;{" "}
        {stats.noOutcome.toLocaleString()} excluded (no determinate outcome)
      </p>

      {/* Binned chart */}
      <section className="space-y-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Replication rate by {metricNounLower} quintile
        </h2>
        {bins.length === 0 ? (
          <p className="text-sm text-gray-500">Not enough data for this selection.</p>
        ) : (
          <div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
              <BinnedChart bins={bins} xTitle={quintileAxis} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              All papers with a publication-year impact factor, split into five equal-count
              bins. Whiskers are 95% intervals from a journal-cluster bootstrap ({BOOTSTRAP_ITERS.toLocaleString()}{" "}
              resamples of journals with replacement), which widens them to account for papers
              within a journal not being independent.
            </p>
          </div>
        )}
      </section>

      {/* Equal-width binned chart */}
      <section className="space-y-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Replication rate by {metricNounLower}
        </h2>
        {widthBins.length === 0 ? (
          <p className="text-sm text-gray-500">Not enough data for this selection.</p>
        ) : (
          <div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
              <BinnedChart bins={widthBins} xTitle={widthAxis} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              The same papers as above, grouped into equal-width impact-factor intervals
              (the top bin is a catch-all for IF &ge; 16). Unlike the equal-count quintiles,
              this shows the trend against a true impact-factor scale; most papers fall in the
              low bins. Whiskers are cluster-bootstrap 95% intervals.
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
              <ScatterChart points={scatter} metricLabel={metricLabel} xTitle={scatterAxis} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              One point per journal with at least {minPapers} plotted papers. Point size
              reflects the number of papers; whiskers are 95% Wilson CIs.
            </p>
          </div>
        )}
      </section>

      {/* Correlation table */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Replication rate correlation vs metric
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Correlation between a journal&rsquo;s replication rate and each journal-impact
            metric, across the {correlations[0]?.n ?? 0} journals with at least {minPapers}{" "}
            plotted papers. Every metric is shown so you can compare their signals side by side.
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
                  <td className="py-2 pr-6">{c.label}</td>
                  <td className="py-2 pr-6 text-right tabular-nums">{c.r === null ? "—" : c.r.toFixed(2)}</td>
                  <td className="py-2 pr-6 text-right tabular-nums">{c.rho === null ? "—" : c.rho.toFixed(2)}</td>
                  <td className="py-2 text-right tabular-nums">{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Correlations use the current success criterion, threshold, and basis. A negative
          value means higher-ranked journals replicate less often. Spearman is more
          robust to the heavy right-skew of these metrics.
        </p>
      </section>

      {/* Methodology */}
      <section className="text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-800 pt-6">
        <p>
          <strong>Metric sources.</strong> The <em>2-year</em> and <em>5-year impact
          factors</em> and the <em>CiteScore</em>-style 4-year metric are self-computed from
          the SciSciNet-v2 / OpenAlex citation graph &mdash; not the official Clarivate
          Journal Impact Factor&trade; or Scopus CiteScore. They use all document types with
          no self-citation exclusion and run systematically lower than the vendor figures, so
          treat them as internally consistent relative indicators. <em>OpenAlex 2-year mean
          citedness</em> is OpenAlex&rsquo;s own published impact-factor-like metric, fetched
          from the OpenAlex API as a single current snapshot (it does not vary by year).{" "}
          <em>SCImago SJR</em> is a prestige-weighted metric (citations weighted by the
          citing journal&rsquo;s standing) taken per publication year from SCImago; papers
          before 1999 use the 1999 ranking.
        </p>
        <p>
          <strong>Matching.</strong> Journal names in the replications database are matched
          to the impact-factor dataset by normalized name; SCImago SJR is joined by ISSN with
          a name fallback (~94% of matched journals). Books, preprints, and conference
          proceedings have no journal metric and are excluded.
        </p>
        <p>
          <strong>Attribution.</strong> SJR data: SCImago, (n.d.).{" "}
          <em>SJR &mdash; SCImago Journal &amp; Country Rank</em> [Portal], retrieved from{" "}
          <a href="https://www.scimagojr.com" className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer">
            scimagojr.com
          </a>{" "}
          (used non-commercially). OpenAlex data is CC0.
        </p>
        <p>
          Data: {csvName}; metrics generated {meta.generated}.
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

function BinnedChart({
  bins,
  xTitle = "Journal impact factor (quintile range)",
}: {
  bins: Bin[];
  xTitle?: string;
}) {
  const W = 720;
  const H = 320;
  const M = { top: 20, right: 20, bottom: 64, left: 62 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bandW = plotW / bins.length;
  const barW = bandW * 0.6;
  const y = (pct: number) => M.top + plotH * (1 - pct / 100);

  const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img">
        {/* y gridlines + ticks */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={W - M.right} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.12} />
            <line x1={M.left - 6} x2={M.left} y1={y(g)} y2={y(g)} stroke="#000000" strokeWidth={1} />
            <text x={M.left - 10} y={y(g) + 4} textAnchor="end" fontSize={12} className="fill-black dark:fill-gray-100">
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
                  {`IF ${fmt(b.lo)}–${fmt(b.hi)}: ${b.rate.toFixed(1)}% replicated (${b.replicated}/${b.count}), cluster-bootstrap 95% CI [${b.ciLow.toFixed(0)}–${b.ciHigh.toFixed(0)}%]`}
                </title>
              </rect>
              {/* CI whisker */}
              <line x1={cx} x2={cx} y1={y(b.ciLow)} y2={y(b.ciHigh)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
              <line x1={cx - 5} x2={cx + 5} y1={y(b.ciLow)} y2={y(b.ciLow)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
              <line x1={cx - 5} x2={cx + 5} y1={y(b.ciHigh)} y2={y(b.ciHigh)} stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
              {/* rate label, above the upper CI whisker */}
              <text x={cx} y={y(b.ciHigh) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="currentColor">
                {b.rate.toFixed(0)}%
              </text>
              {/* x labels */}
              <line x1={cx} x2={cx} y1={M.top + plotH} y2={M.top + plotH + 5} stroke="#000000" strokeWidth={1} />
              <text x={cx} y={H - M.bottom + 18} textAnchor="middle" fontSize={12} className="fill-black dark:fill-gray-100">
                {b.label ?? `${fmt(b.lo)}–${fmt(b.hi)}`}
              </text>
              <text x={cx} y={H - M.bottom + 34} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.5}>
                n={b.count}
              </text>
            </g>
          );
        })}
        <text
          x={M.left + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          className="fill-black dark:fill-gray-100"
        >
          {xTitle}
        </text>
        <text
          transform={`translate(14 ${M.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={14}
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

// Places journal labels next to their scatter points, then de-overlaps them.
// Each label naturally sits just up-and-right of its point (up-left near the
// right edge). A greedy pass then walks labels from the topmost down and pushes
// any box that would collide with an already-placed one further up, so no two
// boxes ever intersect — the economics cluster (AER / QJE) stays legible.
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
function layoutLabels<T extends { name: string; ifVal: number }>(
  pts: T[],
  xOf: (p: T) => number,
  yOf: (p: T) => number,
  rOf: (p: T) => number,
  wOf: (p: T) => number,
  topBound: number,
): PlacedLabel<T>[] {
  const pad = 4;
  const boxH = 13;
  const gap = 2; // vertical space to keep between stacked boxes
  const xVals = pts.map(xOf);
  const rightEdge = xVals.length ? Math.max(...xVals) : 0;
  // Anchor labels near the right edge to the left so they don't run off-plot.
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
  // Greedy de-overlap: process top-to-bottom, and for each label push it above
  // any earlier box it horizontally overlaps.
  const order = [...placed].sort((a, b) => a.boxY - b.boxY);
  const settled: PlacedLabel<T>[] = [];
  for (const lab of order) {
    // Push above every settled box this one collides with. Re-check after each
    // move (moving up can create a new collision higher in the stack), capping
    // the passes so a pathological cluster can't loop forever.
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
    // Never push a label above the top of the plot area.
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
}: {
  points: { name: string; ifVal: number; rate: number; ciLow: number; ciHigh: number; n: number; highImpact: boolean }[];
  metricLabel: string;
  xTitle: string;
}) {
  const W = 720;
  const H = 380;
  const M = { top: 20, right: 20, bottom: 52, left: 62 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  // Measure actual rendered label widths so the white boxes fit exactly (a
  // per-character estimate mis-sizes short all-caps labels like "NEJM").
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
    // Re-measure once webfonts finish loading — the first pass can run against
    // a fallback font and size the boxes wrong (whitespace or clipped text).
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

  // Linear x scale starting just below the lowest journal IF, ending at the
  // next multiple of 5 above the data, with gridlines every 5.
  const minIF = Math.min(...points.map((p) => p.ifVal));
  const maxIF = Math.max(...points.map((p) => p.ifVal));
  const xMin = Math.max(0, Math.round((minIF - 0.1) * 10) / 10);
  const xMax = Math.max(Math.ceil(maxIF / 5) * 5, xMin + 5);

  const x = (ifVal: number) => M.left + plotW * ((ifVal - xMin) / (xMax - xMin));
  const y = (pct: number) => M.top + plotH * (1 - pct / 100);
  const maxN = Math.max(...points.map((p) => p.n));
  const r = (n: number) => 3 + 7 * Math.sqrt(n / maxN);

  // Ticks: the axis start plus every multiple of 5.
  const ticks: number[] = [xMin];
  for (let t = 5; t <= xMax; t += 5) ticks.push(t);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img">
        {/* y gridlines + ticks */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={M.left} x2={W - M.right} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.12} />
            <line x1={M.left - 6} x2={M.left} y1={y(g)} y2={y(g)} stroke="#000000" strokeWidth={1} />
            <text x={M.left - 10} y={y(g) + 4} textAnchor="end" fontSize={12} className="fill-black dark:fill-gray-100">
              {g}%
            </text>
          </g>
        ))}
        {/* x ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={M.top} y2={M.top + plotH} stroke="currentColor" strokeOpacity={0.08} />
            <line x1={x(t)} x2={x(t)} y1={M.top + plotH} y2={M.top + plotH + 5} stroke="#000000" strokeWidth={1} />
            <text x={x(t)} y={M.top + plotH + 17} textAnchor="middle" fontSize={12} className="fill-black dark:fill-gray-100">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {/* axis lines */}
        <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="#000000" strokeWidth={1} />
        {/* points with CI whiskers */}
        {points.map((p) => (
          <g key={p.name}>
            <line x1={x(p.ifVal)} x2={x(p.ifVal)} y1={y(p.ciLow)} y2={y(p.ciHigh)} stroke={POINT} strokeWidth={1} opacity={0.35} />
            <circle cx={x(p.ifVal)} cy={y(p.rate)} r={r(p.n)} fill={POINT} fillOpacity={0.55} stroke={POINT} strokeWidth={1}>
              <title>
                {`${p.name}\n${metricLabel}: ${p.ifVal.toFixed(1)}\nReplication rate: ${p.rate.toFixed(0)}% (n=${p.n}), 95% CI [${p.ciLow.toFixed(0)}–${p.ciHigh.toFixed(0)}%]`}
              </title>
            </circle>
          </g>
        ))}
        {/* label layer: drawn after ALL points so no marker or whisker can paint
            over a label's white box. Boxes are laid out with a collision pass so
            labels for nearby journals (e.g. the economics cluster) never overlap. */}
        {layoutLabels(
          points.filter((p) => p.highImpact),
          (p) => x(p.ifVal),
          (p) => y(p.rate),
          (p) => r(p.n),
          (p) => labelWidths[p.name] ?? journalLabel(p.name).length * 6,
          M.top,
        ).map(({ p, tx, ty, boxX, boxY, boxW, boxH, anchor, cx, cy }) => {
          // leader line: marker center -> nearest bottom corner of the label box
          const cornerX = anchor === "end" ? boxX + boxW : boxX;
          return (
            <g key={`label-${p.name}`}>
              <line
                x1={cx}
                y1={cy}
                x2={cornerX}
                y2={boxY + boxH}
                stroke="#6b7280"
                strokeWidth={0.7}
                opacity={0.9}
              />
              <rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={boxH}
                rx={2.5}
                fill="#ffffff"
                stroke="#9ca3af"
                strokeWidth={0.6}
              />
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
        <text
          x={M.left + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          className="fill-black dark:fill-gray-100"
        >
          {xTitle}
        </text>
        <text
          transform={`translate(14 ${M.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          className="fill-black dark:fill-gray-100"
        >
          Replication rate (%)
        </text>
        <ChartWatermark rightX={W - M.right - 8} y={M.top + 4} />
      </svg>
    </div>
  );
}
