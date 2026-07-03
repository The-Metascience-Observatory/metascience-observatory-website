"use client";

import { useMemo } from "react";
import { ForestGroup, prettyDomain } from "../ForestPlot";
import { fmt } from "../utils";

/** Pretty drug label (matches the dashboard's prettyLabel / fmtIngredient). */
const fmtIngredient = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Only these outcome domains are shown, in this display priority: the primary
// endpoint (symptom severity) plus the two most useful secondaries.
const KEEP_DOMAINS = ["symptom_severity", "sleep_quality", "periodic_limb_movements"];

// A group is shown only as a standardized (SMD) pool, for a kept domain, pooling
// ≥3 trials, and not the meaningless pooled "other"-drug bucket. Only the
// standardized (Cohen's d) plots are shown — the original-scale plots would be
// redundant with these.
const isShownGroup = (g: ForestGroup) =>
  !!g.standardized &&
  g.n_trials >= 3 &&
  !!g.pooled &&
  KEEP_DOMAINS.includes(g.outcome_domain) &&
  g.ingredient !== "other";

// One color for every treatment — the plot compares drugs, it does not
// color-code them.
const DIAMOND = "#1d4ed8";

interface DrugRow {
  ingredient: string;
  k: number;
  i2: number;
  effect: number;
  lo: number;
  hi: number;
  sig: boolean;
}

/** One forest plot per outcome: a random-effects pooled SMD (diamond) for every
 *  drug with ≥3 trials, so drugs can be compared head-to-head on one scale.
 *  Positive SMD = favors treatment; all diamonds share one color. */
function OutcomeForest({ domain, groups }: { domain: string; groups: ForestGroup[] }) {
  const rows: DrugRow[] = groups
    .map((g) => ({
      ingredient: g.ingredient,
      k: g.n_trials,
      i2: g.pooled!.i2,
      effect: g.pooled!.effect,
      lo: g.pooled!.ci_low,
      hi: g.pooled!.ci_high,
      sig: g.pooled!.ci_low > 0 || g.pooled!.ci_high < 0,
    }))
    .sort((a, b) => b.effect - a.effect); // most-favors-treatment first

  const ROW_H = 30, HEADER_H = 24, AXIS_H = 44;
  const LABEL_W = 210, PLOT_W = 380, VAL_W = 170;
  const W = LABEL_W + PLOT_W + VAL_W;
  const plotLeft = LABEL_W, plotRight = LABEL_W + PLOT_W;
  const H = HEADER_H + rows.length * ROW_H + AXIS_H;

  const vals = rows.flatMap((r) => [r.lo, r.hi, r.effect]).concat(0);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const xPix = (v: number) => plotLeft + ((v - lo) / (hi - lo)) * PLOT_W;
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) / 4) * i);

  return (
    <div className="border border-border rounded-lg bg-white p-4 mb-8">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
        <h3 className="font-semibold text-foreground">{prettyDomain(domain)}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-violet-100 text-violet-700">
          Standardized (SMD)
        </span>
        <span className="text-xs text-foreground/50">{rows.length} drugs · pooled random-effects (DerSimonian–Laird)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="text-foreground" style={{ width: "100%", height: "auto" }}>
        <text x={0} y={16} fontSize={11} fontWeight={600} fill="currentColor">Drug (trials)</text>
        <text x={W} y={16} fontSize={11} fontWeight={600} fill="currentColor" textAnchor="end">SMD (95% CI) · I²</text>

        {/* null reference line */}
        <line x1={xPix(0)} y1={HEADER_H} x2={xPix(0)} y2={HEADER_H + rows.length * ROW_H}
          stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />

        {rows.map((r, i) => {
          const cy = HEADER_H + i * ROW_H + ROW_H / 2;
          const cc = xPix(r.effect), cl = xPix(r.lo), ch = xPix(r.hi);
          const hh = 6;
          const label = fmtIngredient(r.ingredient);
          const short = label.length > 28 ? label.slice(0, 27) + "…" : label;
          return (
            <g key={r.ingredient}>
              <text x={0} y={cy + 3} fontSize={11} fill="currentColor" className="fill-foreground/80">
                {short} <tspan className="fill-foreground/45">({r.k})</tspan>
              </text>
              {/* CI whisker + pooled diamond (same color for every drug) */}
              <line x1={cl} y1={cy} x2={ch} y2={cy} stroke={DIAMOND} strokeWidth={1.5} />
              <line x1={cl} y1={cy - 3} x2={cl} y2={cy + 3} stroke={DIAMOND} strokeWidth={1.5} />
              <line x1={ch} y1={cy - 3} x2={ch} y2={cy + 3} stroke={DIAMOND} strokeWidth={1.5} />
              <polygon points={`${cl},${cy} ${cc},${cy - hh} ${ch},${cy} ${cc},${cy + hh}`}
                fill={DIAMOND} fillOpacity={r.sig ? 0.95 : 0.35} stroke={DIAMOND} />
              <text x={W} y={cy + 3} fontSize={11} textAnchor="end" fill="currentColor"
                className={`tabular-nums ${r.sig ? "fill-foreground/80 font-medium" : "fill-foreground/55"}`}>
                {fmt(r.effect)} ({fmt(r.lo)}–{fmt(r.hi)}) · {r.i2}%
              </text>
            </g>
          );
        })}

        {/* x-axis */}
        {(() => {
          const axisY = HEADER_H + rows.length * ROW_H + 8;
          return (
            <g>
              <line x1={plotLeft} y1={axisY} x2={plotRight} y2={axisY} stroke="#9ca3af" strokeWidth={1} />
              {ticks.map((t, i) => (
                <g key={i}>
                  <line x1={xPix(t)} y1={axisY} x2={xPix(t)} y2={axisY + 4} stroke="#9ca3af" strokeWidth={1} />
                  <text x={xPix(t)} y={axisY + 15} fontSize={10} fill="currentColor" textAnchor="middle" className="fill-foreground/60">{fmt(t)}</text>
                </g>
              ))}
              <text x={xPix(0)} y={axisY + 31} fontSize={9} fill="currentColor" textAnchor="middle" className="fill-foreground/45">
                ← favors control   ·   SMD 0 = no effect   ·   favors treatment →
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/** Opt-in meta-analysis view: one standardized (SMD) forest plot per outcome,
 *  pooling every drug with ≥3 trials so treatments can be compared side by side. */
export function MetaAnalysisClientWrapper({ groups }: { groups: ForestGroup[] }) {
  // Standardized SMD pools for the kept domains, grouped by outcome (primary
  // endpoint first), drugs within a plot sorted by effect at render time.
  const byDomain = useMemo(() => {
    const shown = groups.filter(isShownGroup);
    return KEEP_DOMAINS
      .map((domain) => ({ domain, groups: shown.filter((g) => g.outcome_domain === domain) }))
      .filter((d) => d.groups.length > 0);
  }, [groups]);

  return (
    <>
      <p className="text-sm text-foreground/60 mb-6 max-w-3xl">
        Standardized (SMD) meta-analyses, <strong>grouped by outcome</strong>: each plot compares every
        drug&apos;s pooled effect on one outcome, so treatments sit side by side on a single Cohen&apos;s-d
        scale. Each diamond is a random-effects pooled estimate (DerSimonian–Laird) over that drug&apos;s
        ≥3 trials (continuous and binary outcomes folded onto SMD via Hedges&apos; g and Chinn&apos;s
        OR→SMD). Positive = favors treatment; a diamond crossing 0 is not statistically significant.
      </p>

      {byDomain.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/60">
          No outcome yet has a drug with ≥3 trials in a standardized (SMD) pool.
        </div>
      ) : (
        byDomain.map((d) => <OutcomeForest key={d.domain} domain={d.domain} groups={d.groups} />)
      )}
    </>
  );
}
