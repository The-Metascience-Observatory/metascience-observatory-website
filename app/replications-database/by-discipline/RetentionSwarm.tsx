"use client";

import { useMemo, useState } from "react";

/**
 * How much of the original effect each replication retained, by discipline.
 *
 * WHY THIS CHART AND NOT A PAIR OF DISTRIBUTIONS
 * ---------------------------------------------
 * The obvious version of this plot draws two swarms per field -- the original
 * effects and the replication effects side by side. That shows two MARGINAL
 * distributions and throws away the pairing, which is the only thing the
 * database really records: you cannot see which original went with which
 * replication. Collapsing each pair to one number fixes that.
 *
 * The number is the SHARE OF THE ORIGINAL r RETAINED: the replication's
 * correlation divided by the original's magnitude, signed so the original is
 * positive. 1.0 means the replication matched it, 0.5 means half, 0 means
 * nothing was found, negative means the effect came back the other way.
 *
 * TWO THINGS DECIDED HONESTLY RATHER THAN CONVENIENTLY
 * ----------------------------------------------------
 * 1. A RATIO EXPLODES NEAR ZERO. Below |r| = 0.10 the spread of this metric is
 *    enormous (individual values past 20) because the denominator is noise.
 *    Rows below that floor are excluded, and the chart says how many. The floor
 *    is not field-neutral -- it removes far more of a field whose originals are
 *    small -- so the per-field excluded count is shown too.
 * 2. IT IS A RATIO OF CORRELATIONS, NOT OF "THE EFFECT". Retaining half the r
 *    is retaining a QUARTER of the variance explained. The axis is therefore
 *    labelled in r and nothing else.
 *
 * The horizontal spread at each height is proportional to the local density, so
 * the silhouette is a distribution and every point is drawn. A true beeswarm at
 * this n would either be enormously wide or silently drop points.
 */

type AnyRecord = Record<string, unknown>;

const R_FLOOR = 0.1;
const Y_LO = -1;
const Y_HI = 2;

/** Fields with fewer rows than this are pooled; a swarm of five points invites
 *  reading a pattern that is not distinguishable from noise. */
const MIN_FIELD_N = 15;

const PALETTE = [
  "#3d6d9e", "#c0392b", "#2e8b57", "#8e44ad", "#d68910",
  "#16a085", "#7f8c8d", "#c2185b", "#5d6d7e", "#795548",
];

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/** Deterministic PRNG (mulberry32), so the jitter does not move between
 *  renders. A chart whose points dance on every re-render is unreadable and
 *  makes two screenshots of the same data look like different data. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (pos - lo) * (s[hi] - s[lo]);
}

/**
 * Gaussian-kernel density at each point, used only to set the jitter width.
 * Silverman's rule for the bandwidth. O(n^2), which is fine at these n and is
 * why the field pooling above matters.
 */
function densities(values: number[]): number[] {
  const n = values.length;
  if (n < 5) return values.map(() => 0.4);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(n - 1, 1));
  const iqr = quantile(values, 0.75) - quantile(values, 0.25);
  const spread = Math.min(sd || 1, (iqr || sd || 1) / 1.349) || 1;
  const h = 0.9 * spread * Math.pow(n, -0.2) || 0.05;
  const out = values.map((v) => {
    let s = 0;
    for (const u of values) {
      const z = (v - u) / h;
      s += Math.exp(-0.5 * z * z);
    }
    return s;
  });
  const max = Math.max(...out) || 1;
  return out.map((d) => d / max);
}

type Field = {
  name: string;
  color: string;
  pts: { v: number; clipped: number; jitter: number }[];
  median: number;
  q1: number;
  q3: number;
  n: number;
  offScale: number;
  excludedByFloor: number;
  topSource: { name: string; share: number } | null;
};

export function RetentionSwarm({ rows }: { rows: AnyRecord[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  const { fields, totalKept, totalExcluded } = useMemo(() => {
    // Group by field first, so the floor's per-field cost can be reported.
    const byField = new Map<string, { kept: number[]; excluded: number; sources: Map<string, number> }>();

    for (const r of rows) {
      const o = toNumber(r.original_es_r);
      const rep = toNumber(r.replication_es_r);
      if (o == null || rep == null || o === 0 || rep === 0) continue;

      // The API already orients each pair so the original is positive.
      const x = Math.abs(o);
      const y = o >= 0 ? rep : -rep;

      const raw = String(r.discipline ?? "").split(",")[0].trim();
      const name = raw || "Unspecified";
      let f = byField.get(name);
      if (!f) {
        f = { kept: [], excluded: 0, sources: new Map() };
        byField.set(name, f);
      }
      if (x < R_FLOOR) {
        f.excluded++;
        continue;
      }
      f.kept.push(y / x);
      const src = String(r.source ?? "").trim() || "(unrecorded)";
      const label = /SCORE|Tyner/i.test(src)
        ? "DARPA SCORE"
        : src.split(";")[0].split("(")[0].trim() || "(unrecorded)";
      f.sources.set(label, (f.sources.get(label) ?? 0) + 1);
    }

    // Pool the small fields rather than drawing a swarm of four points.
    const small: number[] = [];
    let smallExcluded = 0;
    const big: [string, { kept: number[]; excluded: number; sources: Map<string, number> }][] = [];
    for (const [name, f] of byField) {
      if (f.kept.length >= MIN_FIELD_N) big.push([name, f]);
      else {
        small.push(...f.kept);
        smallExcluded += f.excluded;
      }
    }
    if (small.length) {
      big.push(["other fields", { kept: small, excluded: smallExcluded, sources: new Map() }]);
    }

    big.sort((a, b) => median(b[1].kept) - median(a[1].kept));

    const rand = mulberry32(20260731);
    const out: Field[] = big.map(([name, f], i) => {
      const dens = densities(f.kept);
      let top: { name: string; share: number } | null = null;
      for (const [s, c] of f.sources) {
        if (!top || c > top.share * f.kept.length) top = { name: s, share: c / f.kept.length };
      }
      return {
        name,
        color: PALETTE[i % PALETTE.length],
        pts: f.kept.map((v, j) => ({
          v,
          clipped: Math.max(Y_LO, Math.min(Y_HI, v)),
          jitter: (rand() * 2 - 1) * dens[j],
        })),
        median: median(f.kept),
        q1: quantile(f.kept, 0.25),
        q3: quantile(f.kept, 0.75),
        n: f.kept.length,
        offScale: f.kept.filter((v) => v < Y_LO || v > Y_HI).length,
        excludedByFloor: f.excluded,
        topSource: top && top.share >= 0.6 ? top : null,
      };
    });

    return {
      fields: out,
      totalKept: out.reduce((a, f) => a + f.n, 0),
      totalExcluded: out.reduce((a, f) => a + f.excludedByFloor, 0),
    };
  }, [rows]);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No rows with an effect size for both the original and the replication under the
        current filter.
      </p>
    );
  }

  // Geometry
  const W = Math.max(760, 96 * fields.length + 140);
  const H = 460;
  const PAD = { top: 30, right: 20, bottom: 78, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const colW = plotW / fields.length;
  const swarmHalf = Math.min(colW * 0.36, 34);

  const yScale = (v: number) => PAD.top + ((Y_HI - v) / (Y_HI - Y_LO)) * plotH;
  const xCentre = (i: number) => PAD.left + colW * (i + 0.5);

  const REFS = [
    { v: 1, label: "replication matched the original" },
    { v: 0.5, label: "half the original r retained" },
    { v: 0, label: "replication found nothing" },
  ];

  return (
    <div id="effect-retention" className="mt-8 scroll-mt-24">
      <h3 className="group text-lg font-semibold mb-1">
        How much of the original effect survived{" "}
        <a
          href="#effect-retention"
          aria-label="Link to section: How much of the original effect survived"
          className="text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-gray-700 dark:hover:text-gray-200"
        >
          #
        </a>
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
        One point per study pair: the replication&rsquo;s correlation divided by the
        original&rsquo;s, signed so the original is positive. Bar = median, box = IQR.
        Fields ordered by median.
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
        {totalKept.toLocaleString()} pairs shown. {totalExcluded.toLocaleString()} excluded
        because the original was below |r| = {R_FLOOR.toFixed(2)}, where a ratio is
        dominated by its denominator &mdash; that exclusion is not field-neutral, so each
        column reports its own excluded count on hover.
      </p>

      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px]" role="img"
             aria-label="Share of the original effect retained, by discipline">
          {/* zone below zero: the replication found the opposite */}
          <rect x={PAD.left} y={yScale(0)} width={plotW} height={yScale(Y_LO) - yScale(0)}
                fill="#c0392b" opacity={0.05} />

          {/* y grid */}
          {[-1, -0.5, 0, 0.5, 1, 1.5, 2].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={yScale(v)} y2={yScale(v)}
                    stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
              <text x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end"
                    className="fill-gray-500 dark:fill-gray-400" fontSize={11}>
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* reference lines, all drawn identically and named by their labels */}
          {REFS.map((r) => (
            <g key={r.v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={yScale(r.v)} y2={yScale(r.v)}
                    stroke="currentColor" className="text-gray-400 dark:text-gray-500"
                    strokeWidth={1} strokeDasharray="5 4" />
              <text x={PAD.left + plotW - 4} y={yScale(r.v) - 4} textAnchor="end"
                    className="fill-gray-500 dark:fill-gray-400" fontSize={10.5}>
                {r.label}
              </text>
            </g>
          ))}

          {fields.map((f, i) => {
            const cx = xCentre(i);
            return (
              <g key={f.name}>
                {/* IQR box, so a reader is not reading the median alone */}
                <rect x={cx - swarmHalf - 4} y={yScale(Math.min(f.q3, Y_HI))}
                      width={(swarmHalf + 4) * 2}
                      height={Math.max(1, yScale(Math.max(f.q1, Y_LO)) - yScale(Math.min(f.q3, Y_HI)))}
                      fill={f.color} opacity={0.09} />
                {f.pts.map((p, j) => (
                  <circle key={j} cx={cx + p.jitter * swarmHalf} cy={yScale(p.clipped)} r={2.6}
                          fill={f.color} opacity={0.62}
                          onMouseEnter={() =>
                            setHover({
                              x: cx + p.jitter * swarmHalf,
                              y: yScale(p.clipped),
                              text:
                                `${(p.v * 100).toFixed(0)}% of the original r retained` +
                                (p.v !== p.clipped ? " (off-scale, clipped)" : ""),
                            })
                          }
                          onMouseLeave={() => setHover(null)} />
                ))}
                {/* median */}
                <line x1={cx - swarmHalf - 6} x2={cx + swarmHalf + 6}
                      y1={yScale(f.median)} y2={yScale(f.median)}
                      stroke="#fff" strokeWidth={4} />
                <line x1={cx - swarmHalf - 6} x2={cx + swarmHalf + 6}
                      y1={yScale(f.median)} y2={yScale(f.median)}
                      stroke="currentColor" className="text-gray-900 dark:text-gray-100"
                      strokeWidth={2} />

                {/* column label + n, with a hover carrying the caveats */}
                <g onMouseEnter={() =>
                     setHover({
                       x: cx, y: PAD.top + plotH + 40,
                       text:
                         `${f.name}: n = ${f.n}, median ${f.median.toFixed(2)}, ` +
                         `IQR ${f.q1.toFixed(2)}–${f.q3.toFixed(2)}` +
                         (f.offScale ? `, ${f.offScale} off-scale` : "") +
                         (f.excludedByFloor ? `, ${f.excludedByFloor} below the |r| floor` : "") +
                         (f.topSource
                           ? ` — ${Math.round(f.topSource.share * 100)}% from ${f.topSource.name}`
                           : ""),
                     })
                   }
                   onMouseLeave={() => setHover(null)}>
                  <rect x={cx - colW / 2} y={PAD.top + plotH} width={colW} height={PAD.bottom - 10}
                        fill="transparent" />
                  <text x={cx} y={PAD.top + plotH + 18} textAnchor="middle"
                        className="fill-gray-700 dark:fill-gray-300" fontSize={11}>
                    {f.name.length > 14 ? f.name.slice(0, 13) + "…" : f.name}
                  </text>
                  <text x={cx} y={PAD.top + plotH + 33} textAnchor="middle"
                        fontSize={10.5} fill={f.color} fontWeight={600}>
                    {f.median.toFixed(2)}
                  </text>
                  <text x={cx} y={PAD.top + plotH + 47} textAnchor="middle"
                        className="fill-gray-400 dark:fill-gray-500" fontSize={9.5}>
                    n = {f.n}
                  </text>
                  {/* A field that is mostly ONE project is not a field result. */}
                  {f.topSource && (
                    <text x={cx} y={PAD.top + plotH + 60} textAnchor="middle"
                          fontSize={9} className="fill-amber-600 dark:fill-amber-500">
                      {Math.round(f.topSource.share * 100)}% one source
                    </text>
                  )}
                </g>
              </g>
            );
          })}

          <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" fontSize={11.5}
                className="fill-gray-600 dark:fill-gray-400"
                transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}>
            share of the original r retained
          </text>
        </svg>

        {hover && (
          <div className="pointer-events-none absolute z-20 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
               style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`,
                        transform: "translate(-50%, -140%)", maxWidth: 320 }}>
            {hover.text}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
        This is a ratio of <em>correlations</em>, not of &ldquo;the effect&rdquo;: retaining
        half the r is retaining a quarter of the variance explained. Points beyond the axis
        are drawn at the edge and counted on hover; medians use the unclipped values. Some
        of the shortfall is regression to the mean and would appear even if every study were
        sound. A column flagged &ldquo;one source&rdquo; is drawn mostly from a single
        replication project, so it describes that project rather than the field.
      </p>
    </div>
  );
}
