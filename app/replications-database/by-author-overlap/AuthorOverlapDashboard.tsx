"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChartWatermark } from "@/components/ChartWatermark";
import { useIsMobile } from "@/components/useIsMobile";
import type { CoverageStats, EffectRow, OverlapMeta, PairOverlap } from "./types";

const REPLICATED = "#4f77bd"; // light blue, matching the rate bars on by-year

const CRITERION_OPTIONS = [
  { value: 0, label: "Reported result (success / failure column)" },
  { value: 1, label: "Statistically significant effect in the same direction?" },
  { value: 2, label: "Original effect size in replication 95% confidence interval?" },
  { value: 3, label: "Replication effect size in original 95% confidence interval?" },
];

const VIEW_OPTIONS = [
  { value: 0, label: "Number of shared authors" },
  { value: 1, label: "Shared authors as a fraction of the original byline" },
  { value: 2, label: "Original lead-author involvement" },
];

const VIEW_LABELS: string[][] = [
  ["0 (independent)", "1", "2", "3", "4", "5+"],
  ["0% (independent)", "1–33%", "34–66%", "67–100%"],
  ["No shared authors", "Shared co-authors only", "Orig. first/last author on replication"],
];

const VIEW_X_TITLES = [
  "Authors shared between original and replication",
  "Shared authors as % of the original paper's byline",
  "Original-team involvement in the replication",
];

// Overlap count under the current matching mode.
function overlapOf(pair: PairOverlap, strict: boolean): number {
  return strict ? pair.im : pair.o;
}

// Bin index for one pair under the current view/mode; nBins = labels.length.
function binFor(pair: PairOverlap, view: number, strict: boolean): number {
  const ov = overlapOf(pair, strict);
  if (view === 0) return Math.min(ov, 5);
  if (view === 1) {
    if (ov === 0) return 0;
    const frac = ov / pair.no;
    if (frac <= 1 / 3) return 1;
    if (frac <= 2 / 3) return 2;
    return 3;
  }
  const fl = strict ? pair.flStrict : pair.fl;
  return ov === 0 ? 0 : fl ? 2 : 1;
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

/** One determinate effect-level row with its bin assignment attached. */
interface QualRow {
  c: number; // original-paper index (bootstrap cluster)
  bin: number;
  success: boolean;
}

type Bin = {
  label: string;
  count: number;
  replicated: number;
  rate: number;
  ciLow: number;
  ciHigh: number;
};

// Cluster bootstrap 95% CI per bin: resample original papers with
// replacement, keep the fixed bin assignment, and recompute each bin's rate.
// Effect rows within one original paper (including several replications of
// it) are correlated, so a row-level Wilson interval would be over-confident;
// resampling whole originals propagates that clustering.
function bootstrapBinCIs(rowsQ: QualRow[], nBins: number): [number, number][] {
  const byCluster = new Map<number, QualRow[]>();
  for (const r of rowsQ) {
    const arr = byCluster.get(r.c);
    if (arr) arr.push(r);
    else byCluster.set(r.c, [r]);
  }
  const clusters = Array.from(byCluster.values());
  const rand = mulberry32(0x9e3779b9 ^ rowsQ.length);
  const boot: number[][] = Array.from({ length: nBins }, () => []);
  for (let b = 0; b < BOOTSTRAP_ITERS; b++) {
    const rep = new Array(nBins).fill(0);
    const tot = new Array(nBins).fill(0);
    for (let s = 0; s < clusters.length; s++) {
      const cluster = clusters[(rand() * clusters.length) | 0];
      for (const r of cluster) {
        if (r.bin < 0 || r.bin >= nBins) continue;
        tot[r.bin]++;
        if (r.success) rep[r.bin]++;
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

function buildBins(rowsQ: QualRow[], labels: string[]): Bin[] {
  if (rowsQ.length === 0) return [];
  const nBins = labels.length;
  const rep = new Array(nBins).fill(0);
  const tot = new Array(nBins).fill(0);
  for (const r of rowsQ) {
    tot[r.bin]++;
    if (r.success) rep[r.bin]++;
  }
  const cis = bootstrapBinCIs(rowsQ, nBins);
  const bins: Bin[] = [];
  for (let k = 0; k < nBins; k++) {
    bins.push({
      label: labels[k],
      count: tot[k],
      replicated: rep[k],
      rate: tot[k] > 0 ? (rep[k] / tot[k]) * 100 : 0,
      ciLow: cis[k][0],
      ciHigh: cis[k][1],
    });
  }
  return bins;
}

export function AuthorOverlapDashboard({
  pairs,
  rows,
  replicationTypes,
  disciplines,
  meta,
  csvName,
  coverage,
}: {
  pairs: (PairOverlap | null)[];
  rows: EffectRow[];
  replicationTypes: string[];
  disciplines: string[];
  meta: OverlapMeta;
  csvName: string;
  coverage: CoverageStats;
}) {
  const [criterion, setCriterion] = useState(0);
  const [view, setView] = useState(0); // default: number of shared authors
  const [strict, setStrict] = useState(true);
  const [repType, setRepType] = useState(-1); // -1 = all types
  const [discipline, setDiscipline] = useState(-1); // -1 = all disciplines
  const [showCI, setShowCI] = useState(false);

  // Effect-level row counts per replication type / discipline, for dropdowns.
  const typeCounts = useMemo(() => {
    const counts = new Array(replicationTypes.length).fill(0) as number[];
    for (const r of rows) if (r.t >= 0) counts[r.t]++;
    return counts;
  }, [rows, replicationTypes]);

  const disciplineCounts = useMemo(() => {
    const counts = new Array(disciplines.length).fill(0) as number[];
    for (const r of rows) if (r.d >= 0) counts[r.d]++;
    return counts;
  }, [rows, disciplines]);

  // Determinate rows passing the filters, with their pair attached.
  const filtered = useMemo(() => {
    const out: { c: number; pair: PairOverlap; success: boolean }[] = [];
    let excluded = 0;
    for (const r of rows) {
      if (repType >= 0 && r.t !== repType) continue;
      if (discipline >= 0 && r.d !== discipline) continue;
      const o = r.o[criterion];
      if (o !== "s" && o !== "f" && o !== "r") continue; // inconclusive rows never qualify
      const pair = r.p >= 0 ? pairs[r.p] : null;
      if (!pair) {
        excluded++;
        continue;
      }
      out.push({ c: r.c, pair, success: o === "s" });
    }
    return { rows: out, excluded };
  }, [rows, pairs, criterion, repType, discipline]);

  const chartBins = useMemo(() => {
    const rowsQ: QualRow[] = filtered.rows.map((r) => ({
      c: r.c,
      bin: binFor(r.pair, view, strict),
      success: r.success,
    }));
    return buildBins(rowsQ, VIEW_LABELS[view]);
  }, [filtered, view, strict]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Replication Rate by Author Overlap
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Do replications involving the original authors succeed more often than fully
          independent ones? This page plots the replication rate against the number of
          authors shared between the original study and its replication. Authors are
          matched by disambiguated{" "}
          <a
            href="https://www.nature.com/articles/s41597-023-02198-9"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            SciSciNet
          </a>
          /OpenAlex author identity, with ORCID checks and normalized-name matching as
          fallbacks (see methodology below).
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
          <span className="text-gray-600 dark:text-gray-300">Overlap measure</span>
          <select
            value={view}
            onChange={(e) => setView(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm max-w-[22rem]"
          >
            {VIEW_OPTIONS.map((o) => (
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

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-300">Discipline</span>
          <select
            value={discipline}
            onChange={(e) => setDiscipline(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm max-w-[16rem]"
          >
            <option value={-1}>All disciplines</option>
            {disciplines.map((name, i) => (
              <option key={name} value={i}>
                {name} ({disciplineCounts[i].toLocaleString()})
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm pb-1.5">
          <input
            type="checkbox"
            checked={strict}
            onChange={(e) => setStrict(e.target.checked)}
            className="accent-blue-600"
          />
          <span className="text-gray-600 dark:text-gray-300">
            Strict matching (ID-verified shared authors only)
          </span>
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

      {/* Binned chart */}
      <section className="space-y-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Replication rate by {VIEW_OPTIONS[view].label.toLowerCase()}
        </h2>
        {chartBins.length === 0 ? (
          <p className="text-sm text-gray-500">Not enough data for this selection.</p>
        ) : (
          <div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 w-fit max-w-full">
              <BinnedChart bins={chartBins} xTitle={VIEW_X_TITLES[view]} showCI={showCI} />
            </div>
            {showCI && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Error bars are 95% intervals from a cluster bootstrap (
                {BOOTSTRAP_ITERS.toLocaleString()} resamples of original papers with
                replacement), which accounts for multiple replications and multiple
                effects of the same original paper not being independent.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Methodology */}
      <section className="text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-800 pt-6">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Method details
        </h2>
        <p>
          <strong>Author matching.</strong> Both papers of each (original, replication)
          pair are resolved by DOI to their author lists, primarily from a SciSciNet-v2
          snapshot derived from OpenAlex (snapshot {meta.dbSnapshot}), falling back to
          the live OpenAlex API for papers missing from the snapshot, and to the
          database&rsquo;s own author-name fields as a last resort. Two authors count as
          the same person when they share a disambiguated OpenAlex author ID, or when
          their normalized names match (diacritics stripped, surname + first initial,
          &ldquo;Last,&nbsp;First&rdquo; ordering handled, single-character typos
          tolerated for full given names).
        </p>
        <p>
          <strong>Why differing OpenAlex IDs don&rsquo;t veto a name match.</strong>{" "}
          OpenAlex&rsquo;s author disambiguation errs heavily toward <em>splitting</em>:
          the same person often carries several author IDs across their papers
          (initials-only bylines, typos, name variants, affiliation changes), while
          wrongly <em>merging</em> two people into one ID is rarer. Sharing an ID is
          therefore good evidence two byline entries are the same person, but carrying
          different IDs is <em>weak</em> evidence they are different people. Meanwhile,
          the same surname and initial appearing on a paper and on its direct
          replication in the same literature is strong contextual evidence of identity.
          So a name match is allowed to bridge differing IDs, with ORCID as the
          tie-breaker where available: different ORCIDs veto the match, identical ORCIDs
          confirm it, and missing ORCIDs let the name match stand. (A real example from
          this database: the first author of an Alzheimer&rsquo;s cohort study appears
          under one OpenAlex ID on the original and under a second ID &mdash; via the
          typo &ldquo;Leonared&rdquo; &mdash; on its follow-up; only name matching
          recovers that the two papers share their lead author.)
        </p>
        <p>
          <strong>Strict matching.</strong> The &ldquo;strict matching&rdquo; toggle
          counts only ID-verified shared authors and discards every name-based match.
          Because ID splits then misclassify some genuinely author-involved replications
          as independent, strict mode is a deliberate <em>lower bound</em> on overlap
          &mdash; biased toward the &ldquo;independent&rdquo; side. Its purpose is
          falsification: if the gap between independent and author-involved replication
          rates were an artifact of same-name false positives, it would shrink under
          strict matching. A gap that survives the toggle cannot be explained by
          name-matching errors.
        </p>
        <p>
          <strong>Not causal.</strong> Original-author involvement is not randomly
          assigned. Original teams may choose to (help) replicate the effects they are
          most confident in, while independent teams may target suspect findings;
          original authors also bring materials, expertise and &mdash; possibly &mdash;
          allegiance effects. The gap between independent and author-involved
          replications reflects all of these at once.
        </p>
        <p>
          <strong>Team-size confound.</strong> Large consortium replications (Many Labs
          and similar) mechanically dilute the <em>fraction</em> views: one original
          author among dozens of replicators is a small fraction but full
          &ldquo;involvement&rdquo;. Compare the count, fraction and lead-author views
          before drawing conclusions.
        </p>
        <p>
          <strong>Matching limitations.</strong> OpenAlex author disambiguation is
          imperfect (it can split one person into several IDs or merge namesakes), ORCID
          coverage is sparse for older papers, and name matching can miss authors who
          changed names or publish under different transliterations. Overlap counts are
          therefore best treated as a lower bound with occasional false positives; the
          build script logs every name-only match for manual spot-checking.
        </p>
        <p>
          <strong>Coverage.</strong> {coverage.rowsMatched.toLocaleString()} of{" "}
          {coverage.totalRows.toLocaleString()} replication rows (
          {((100 * coverage.rowsMatched) / Math.max(1, coverage.totalRows)).toFixed(1)}%)
          have author data for both papers; rows missing a DOI on either side, or whose
          papers resolve nowhere, are excluded from the charts.{" "}
          {coverage.rowsWithBothDois.toLocaleString()} rows have both DOIs.
        </p>
        <p>
          <strong>Units.</strong> The chart counts every determinate
          replication attempt once. Reversals count as determinate non-replications;
          inconclusive rows are excluded. Overlap is counted on the original
          paper&rsquo;s byline, so it never exceeds the original&rsquo;s author count.
        </p>
        <p>Data: {csvName}. Author lookup generated {meta.generated}.</p>
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        <Link href="/replications-database" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to the replications database
        </Link>
      </p>
    </div>
  );
}

function BinnedChart({ bins, xTitle, showCI }: { bins: Bin[]; xTitle: string; showCI: boolean }) {
  const isMobile = useIsMobile();
  const W = isMobile ? 380 : 720;
  const H = isMobile ? 300 : 320;
  const M = isMobile ? { top: 16, right: 8, bottom: 60, left: 40 } : { top: 20, right: 20, bottom: 64, left: 62 };
  const F = isMobile
    ? { tick: 10, xlab: 9, val: 10, title: 11, sub: 8 }
    : { tick: 12, xlab: 12, val: 12, title: 14, sub: 10 };
  // Long titles overflow a 380-unit viewBox at 11px — shrink to fit.
  const titleFs = !isMobile ? F.title : xTitle.length > 60 ? 8.5 : xTitle.length > 45 ? 9.5 : F.title;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bandW = plotW / bins.length;
  const barW = bandW * 0.5;
  const y = (pct: number) => M.top + plotH * (1 - pct / 100);

  // Long categorical labels (lead-author view) wrap onto two lines.
  const wrapLabel = (label: string): string[] => {
    if (label.length <= 18) return [label];
    const words = label.split(" ");
    const lines: string[] = [""];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if (cur && (cur + " " + w).length > 20) lines.push(w);
      else lines[lines.length - 1] = cur ? cur + " " + w : w;
    }
    return lines.slice(0, 2);
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
          const labelLines = wrapLabel(b.label);
          const capW = Math.min(10, barW * 0.5);
          const labelY = (showCI ? Math.min(top, y(b.ciHigh)) : top) - 6;
          return (
            <g key={i}>
              <rect x={bx} y={top} width={barW} height={M.top + plotH - top} rx={2} fill={REPLICATED} opacity={0.85}>
                <title>
                  {`${b.label}: ${b.rate.toFixed(1)}% replicated (${b.replicated}/${b.count}), cluster-bootstrap 95% CI [${b.ciLow.toFixed(0)}–${b.ciHigh.toFixed(0)}%]`}
                </title>
              </rect>
              {/* 95% CI whiskers (cluster bootstrap) */}
              {showCI && b.count > 0 && (
                <g stroke="currentColor" strokeWidth={1.5} opacity={0.65}>
                  <line x1={cx} x2={cx} y1={y(b.ciHigh)} y2={y(b.ciLow)} />
                  <line x1={cx - capW / 2} x2={cx + capW / 2} y1={y(b.ciHigh)} y2={y(b.ciHigh)} />
                  <line x1={cx - capW / 2} x2={cx + capW / 2} y1={y(b.ciLow)} y2={y(b.ciLow)} />
                </g>
              )}
              {/* rate label, above the bar (and above the whisker when shown) */}
              <text x={cx} y={labelY} textAnchor="middle" fontSize={F.val} fontWeight={600} fill="currentColor">
                {b.rate.toFixed(0)}%
              </text>
              {/* x labels */}
              <line x1={cx} x2={cx} y1={M.top + plotH} y2={M.top + plotH + 5} stroke="#000000" strokeWidth={1} />
              {labelLines.map((ln, li) => (
                <text
                  key={li}
                  x={cx}
                  y={H - M.bottom + (isMobile ? 12 : 15) + li * (isMobile ? 10 : 12)}
                  textAnchor="middle"
                  fontSize={labelLines.length > 1 ? F.xlab - 1.5 : F.xlab}
                  className="fill-black dark:fill-gray-100"
                >
                  {ln}
                </text>
              ))}
              {/* n= sits directly under the tick label, however many lines it wrapped to */}
              <text
                x={cx}
                y={H - M.bottom + (isMobile ? 13 : 16) + labelLines.length * (isMobile ? 10 : 12)}
                textAnchor="middle"
                fontSize={F.sub}
                fill="currentColor"
                opacity={0.5}
              >
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
