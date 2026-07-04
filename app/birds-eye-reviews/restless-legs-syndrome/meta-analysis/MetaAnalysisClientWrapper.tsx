"use client";

import { useMemo, useState } from "react";
import { ForestGroup, ForestTrial, prettyDomain } from "../ForestPlot";
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
const TRIAL_BOX = "#2563eb";
const TRIAL_WHISKER = "#93c5fd";

interface Block {
  ingredient: string;
  k: number;
  i2: number;
  effect: number;
  lo: number;
  hi: number;
  sig: boolean;
  trials: ForestTrial[];
}

/** One forest plot per outcome: a random-effects pooled SMD (diamond) for every
 *  drug with ≥3 trials, so drugs can be compared head-to-head on one scale.
 *  Positive SMD = favors treatment; all diamonds share one color. When
 *  `showTrials` is on, each drug's individual trials are drawn above its diamond
 *  on the same shared scale. */
function OutcomeForest({
  domain,
  groups,
  showTrials,
}: {
  domain: string;
  groups: ForestGroup[];
  showTrials: boolean;
}) {
  const blocks: Block[] = groups
    .map((g) => ({
      ingredient: g.ingredient,
      k: g.n_trials,
      i2: g.pooled!.i2,
      effect: g.pooled!.effect,
      lo: g.pooled!.ci_low,
      hi: g.pooled!.ci_high,
      sig: g.pooled!.ci_low > 0 || g.pooled!.ci_high < 0,
      trials: g.trials,
    }))
    .sort((a, b) => b.effect - a.effect); // most-favors-treatment first

  const ROW_H = 28, HEADER_H = 24, AXIS_H = 44, GAP = showTrials ? 14 : 0;
  const LABEL_W = 210, PLOT_W = 380, VAL_W = 170;
  const W = LABEL_W + PLOT_W + VAL_W;
  const plotLeft = LABEL_W, plotRight = LABEL_W + PLOT_W;

  // --- layout: assign a y to every trial row + diamond row, top to bottom ---
  let cursor = HEADER_H;
  const laidOut = blocks.map((b, bi) => {
    const top = cursor + (showTrials && bi > 0 ? GAP : 0);
    let y = top;
    const trialYs: number[] = [];
    if (showTrials) {
      for (let t = 0; t < b.trials.length; t++) { trialYs.push(y + ROW_H / 2); y += ROW_H; }
    }
    const diamondY = y + ROW_H / 2;
    y += ROW_H;
    cursor = y;
    return { ...b, top, trialYs, diamondY };
  });
  const contentBottom = cursor;
  const H = contentBottom + AXIS_H;

  // --- x domain across pooled bounds (+ every shown trial's CI) + null line ---
  const vals: number[] = [0];
  for (const b of blocks) {
    vals.push(b.lo, b.hi, b.effect);
    if (showTrials) {
      for (const t of b.trials) {
        for (const v of [t.effect, t.ci_low, t.ci_high]) if (v != null && Number.isFinite(v)) vals.push(v);
      }
    }
  }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const xPix = (v: number) => plotLeft + ((v - lo) / (hi - lo)) * PLOT_W;
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) / 4) * i);

  // --- individual-trial box size ∝ √(pooled weight), normalized across the plot ---
  const shownTrials = showTrials ? blocks.flatMap((b) => b.trials) : [];
  const maxSqrtW = Math.max(
    ...shownTrials.map((t) => (t.weight != null ? Math.sqrt(t.weight) : 0)),
    1e-6
  );
  const halfBox = (w: number | null) => (w == null ? 4 : 4 + (Math.sqrt(w) / maxSqrtW) * 6);

  return (
    <div className="border border-border rounded-lg bg-white p-4 mb-8">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
        <h3 className="font-semibold text-foreground">{prettyDomain(domain)}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-violet-100 text-violet-700">
          Standardized (SMD)
        </span>
        <span className="text-xs text-foreground/50">{blocks.length} drugs · pooled random-effects (DerSimonian–Laird)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="text-foreground" style={{ width: "100%", height: "auto" }}>
        <text x={0} y={16} fontSize={11} fontWeight={600} fill="currentColor">Drug (trials)</text>
        <text x={W} y={16} fontSize={11} fontWeight={600} fill="currentColor" textAnchor="end">SMD (95% CI) · I²</text>

        {/* null reference line */}
        <line x1={xPix(0)} y1={HEADER_H} x2={xPix(0)} y2={contentBottom}
          stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />

        {laidOut.map((b, bi) => {
          const cc = xPix(b.effect), cl = xPix(b.lo), ch = xPix(b.hi);
          const hh = 6;
          const drugLabel = fmtIngredient(b.ingredient);
          const drugShort = drugLabel.length > 28 ? drugLabel.slice(0, 27) + "…" : drugLabel;
          return (
            <g key={b.ingredient}>
              {/* group divider between drugs when trials are shown */}
              {showTrials && bi > 0 && (
                <line x1={0} y1={b.top - GAP / 2} x2={W} y2={b.top - GAP / 2}
                  stroke="#e5e7eb" strokeWidth={1} />
              )}

              {/* individual trial rows (above this drug's diamond) */}
              {showTrials && b.trials.map((t, ti) => {
                const cy = b.trialYs[ti];
                const tcx = xPix(t.effect);
                const x1 = t.ci_low != null ? xPix(t.ci_low) : tcx;
                const x2 = t.ci_high != null ? xPix(t.ci_high) : tcx;
                const half = halfBox(t.weight);
                const raw = t.label || t.paper_id;
                const short = raw.length > 24 ? raw.slice(0, 23) + "…" : raw;
                return (
                  <g key={`${t.paper_id}-${ti}`}>
                    <text x={14} y={cy + 3} fontSize={10} fill="currentColor" className="fill-foreground/55">{short}</text>
                    <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={TRIAL_WHISKER} strokeWidth={1.25} />
                    <line x1={x1} y1={cy - 2.5} x2={x1} y2={cy + 2.5} stroke={TRIAL_WHISKER} strokeWidth={1.25} />
                    <line x1={x2} y1={cy - 2.5} x2={x2} y2={cy + 2.5} stroke={TRIAL_WHISKER} strokeWidth={1.25} />
                    <rect x={tcx - half} y={cy - half} width={half * 2} height={half * 2} fill={TRIAL_BOX} fillOpacity={0.7} />
                    <text x={W} y={cy + 3} fontSize={10} textAnchor="end" fill="currentColor" className="fill-foreground/45 tabular-nums">
                      {fmt(t.effect)} ({fmt(t.ci_low)}–{fmt(t.ci_high)})
                    </text>
                  </g>
                );
              })}

              {/* pooled diamond row for this drug */}
              <text x={0} y={b.diamondY + 3} fontSize={11} fill="currentColor"
                className={showTrials ? "fill-foreground/90 font-semibold" : "fill-foreground/80"}>
                {drugShort} <tspan className="fill-foreground/45">({b.k})</tspan>
              </text>
              <line x1={cl} y1={b.diamondY} x2={ch} y2={b.diamondY} stroke={DIAMOND} strokeWidth={1.5} />
              <line x1={cl} y1={b.diamondY - 3} x2={cl} y2={b.diamondY + 3} stroke={DIAMOND} strokeWidth={1.5} />
              <line x1={ch} y1={b.diamondY - 3} x2={ch} y2={b.diamondY + 3} stroke={DIAMOND} strokeWidth={1.5} />
              <polygon points={`${cl},${b.diamondY} ${cc},${b.diamondY - hh} ${ch},${b.diamondY} ${cc},${b.diamondY + hh}`}
                fill={DIAMOND} fillOpacity={b.sig ? 0.95 : 0.35} stroke={DIAMOND} />
              <text x={W} y={b.diamondY + 3} fontSize={11} textAnchor="end" fill="currentColor"
                className={`tabular-nums ${b.sig ? "fill-foreground/80 font-medium" : "fill-foreground/55"}`}>
                {fmt(b.effect)} ({fmt(b.lo)}–{fmt(b.hi)}) · {b.i2}%
              </text>
            </g>
          );
        })}

        {/* x-axis */}
        {(() => {
          const axisY = contentBottom + 8;
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

/** A small diamond swatch for the legend. */
function DiamondSwatch({ solid }: { solid: boolean }) {
  return (
    <svg width={22} height={12} className="shrink-0" aria-hidden>
      <polygon points="1,6 11,2 21,6 11,10" fill={DIAMOND} fillOpacity={solid ? 0.95 : 0.35} stroke={DIAMOND} />
    </svg>
  );
}

/** Opt-in meta-analysis view: one standardized (SMD) forest plot per outcome,
 *  pooling every drug with ≥3 trials so treatments can be compared side by side.
 *  A toggle expands each diamond into its underlying individual-trial estimates. */
export function MetaAnalysisClientWrapper({ groups }: { groups: ForestGroup[] }) {
  const [showTrials, setShowTrials] = useState(false);

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
      <p className="text-sm text-foreground/60 mb-4 max-w-3xl">
        Standardized (SMD) meta-analyses, <strong>grouped by outcome</strong>: each plot compares every
        drug&apos;s pooled effect on one outcome, so treatments sit side by side on a single Cohen&apos;s-d
        scale. Each diamond is a random-effects pooled estimate (DerSimonian–Laird) over that drug&apos;s
        ≥3 trials (continuous and binary outcomes folded onto SMD via Hedges&apos; g and Chinn&apos;s
        OR→SMD). Positive = favors treatment.
      </p>

      {/* Legend + toggle */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground/60">
          <span className="inline-flex items-center gap-1.5">
            <DiamondSwatch solid /> Solid diamond = statistically significant (95% CI excludes 0)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DiamondSwatch solid={false} /> Shaded diamond = not significant (95% CI crosses 0)
          </span>
          {showTrials && (
            <span className="inline-flex items-center gap-1.5">
              <svg width={16} height={12} className="shrink-0" aria-hidden>
                <rect x={4} y={3} width={6} height={6} fill={TRIAL_BOX} fillOpacity={0.7} />
              </svg>
              Squares = individual trials (size ∝ weight in the pool); whiskers = 95% CI
            </span>
          )}
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0">
          <span className="text-sm text-foreground/70">Show individual trials</span>
          <span className="relative inline-block h-5 w-9">
            <input
              type="checkbox"
              checked={showTrials}
              onChange={(e) => setShowTrials(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-foreground/20 transition-colors peer-checked:bg-blue-600" />
            <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
        </label>
      </div>

      {byDomain.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/60">
          No outcome yet has a drug with ≥3 trials in a standardized (SMD) pool.
        </div>
      ) : (
        byDomain.map((d) => (
          <OutcomeForest key={d.domain} domain={d.domain} groups={d.groups} showTrials={showTrials} />
        ))
      )}
    </>
  );
}
