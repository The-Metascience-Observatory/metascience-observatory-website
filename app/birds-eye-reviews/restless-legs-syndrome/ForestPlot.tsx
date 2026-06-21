"use client";

import { fmt } from "./utils";

/** A single trial estimate on a forest plot. */
export interface ForestTrial {
  paper_id: string;
  label: string; // "Author 2021" (falls back to DOI)
  doi?: string;
  first_author?: string;
  year?: number | null;
  effect: number;
  ci_low: number | null;
  ci_high: number | null;
  p_value: number | null;
  n_total: number | null;
  weight: number | null; // pooled weight (0..1) or null when not pooled
  outcome_name: string | null;
}

export interface ForestGroup {
  ingredient: string;
  outcome_domain: string;
  /** Optional display label that overrides prettyDomain(outcome_domain) for this
   *  specific group (e.g. "Influenza symptom duration" for zanamivir). */
  domainLabel?: string;
  effect_measure: string;
  scale: "log" | "linear";
  n_trials: number;
  trials: ForestTrial[];
  pooled?: {
    effect: number;
    ci_low: number;
    ci_high: number;
    i2: number;
    model: string;
  } | null;
}

const MEASURE_LABEL: Record<string, string> = {
  risk_ratio: "Risk ratio",
  odds_ratio: "Odds ratio",
  hazard_ratio: "Hazard ratio",
  rate_ratio: "Rate ratio",
  incidence_rate_ratio: "Incidence rate ratio",
  adjusted_odds_ratio: "Adjusted odds ratio",
  adjusted_risk_ratio: "Adjusted risk ratio",
  adjusted_hazard_ratio: "Adjusted hazard ratio",
  adjusted_rate_ratio: "Adjusted rate ratio",
  mean_difference: "Mean difference",
  adjusted_mean_difference: "Adjusted mean difference",
  smd: "Std. mean difference",
  standardized_mean_difference: "Std. mean difference",
  risk_difference: "Risk difference",
  rate_difference: "Rate difference",
};

/** Outcome-domain key -> display label. Shared with ResultsClientWrapper (the
 *  "Trials by Outcome Domain" chart) so the labels stay in one place. */
export const DOMAIN_LABELS: Record<string, string> = {
  symptom_severity: "Symptom severity (IRLS)",
  sleep_quality: "Sleep quality",
  periodic_limb_movements: "Periodic limb movements",
  quality_of_life: "Quality of life",
  daytime_functioning: "Daytime functioning",
  mood_anxiety: "Mood / anxiety",
  augmentation: "Augmentation",
  safety_adverse_events: "Safety / adverse events",
  other: "Other",
};

export function prettyMeasure(m: string): string {
  return MEASURE_LABEL[m] ?? m.replace(/_/g, " ");
}
export function prettyDomain(d: string): string {
  return DOMAIN_LABELS[d] ?? d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
/** Outbound link for a trial: real DOIs -> doi.org; PMIDs / trial registry ids
 *  -> their canonical page; non-resolvable ids (grey lit) -> no link. */
function trialHref(paperId: string | undefined): string | null {
  if (!paperId) return null;
  if (paperId.startsWith("10.")) return `https://doi.org/${paperId}`;
  if (paperId.startsWith("pmid_")) return `https://pubmed.ncbi.nlm.nih.gov/${paperId.slice(5)}/`;
  if (paperId.startsWith("nct:")) return `https://clinicaltrials.gov/study/${paperId.slice(4)}`;
  return null;
}

/** A self-contained SVG forest plot for one (ingredient × outcome × measure)
 *  group: one row per trial (square sized by pooled weight + CI whisker), a
 *  null reference line, x-axis ticks, and a pooled diamond when available. */
export function ForestPlot({ group }: { group: ForestGroup }) {
  const isLog = group.scale === "log";
  const nullVal = isLog ? 1 : 0;
  const ratio = isLog;

  const rows = group.trials;
  const ROW_H = 30;
  const HEADER_H = 28;
  const AXIS_H = 42;
  const LABEL_W = 190; // left text column
  const VAL_W = 150; // right value column
  const PLOT_W = 360;
  const W = LABEL_W + PLOT_W + VAL_W;
  const plotLeft = LABEL_W;
  const plotRight = LABEL_W + PLOT_W;
  const diamondRows = group.pooled ? 1 : 0;
  const H = HEADER_H + rows.length * ROW_H + diamondRows * ROW_H + AXIS_H;

  // --- x domain across all finite CI bounds + point estimates + null line ---
  const vals: number[] = [nullVal];
  for (const t of rows) {
    for (const v of [t.effect, t.ci_low, t.ci_high]) if (v != null && Number.isFinite(v)) vals.push(v);
  }
  if (group.pooled) vals.push(group.pooled.effect, group.pooled.ci_low, group.pooled.ci_high);

  const tx = (v: number) => (isLog ? Math.log(Math.max(v, 1e-6)) : v);
  const txVals = vals.map(tx);
  let lo = Math.min(...txVals);
  let hi = Math.max(...txVals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const xPix = (v: number) => plotLeft + ((tx(v) - lo) / (hi - lo)) * PLOT_W;

  // --- x-axis ticks ---
  const ratioTicks = [0.1, 0.25, 0.5, 1, 2, 4, 10];
  let ticks: number[];
  if (isLog) {
    ticks = ratioTicks.filter((t) => tx(t) >= lo && tx(t) <= hi);
    if (ticks.length < 2) ticks = [Math.exp(lo + (hi - lo) * 0.2), 1, Math.exp(lo + (hi - lo) * 0.8)];
  } else {
    const step = (hi - lo) / 4;
    ticks = [0, 1, 2, 3, 4].map((i) => lo + step * i);
  }

  const sqrtW = rows.map((t) => (t.weight != null ? Math.sqrt(t.weight) : null));
  const maxSqrt = Math.max(...sqrtW.filter((x): x is number => x != null), 1);
  const boxSize = (i: number) => {
    const s = sqrtW[i];
    if (s == null) return 7;
    return 5 + (s / maxSqrt) * 9; // 5..14 px half-size
  };

  return (
    <div className="border border-border rounded-lg bg-white p-4 mb-6">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
        <h3 className="font-semibold text-foreground capitalize">{group.ingredient}</h3>
        <span className="text-sm text-foreground/70">{group.domainLabel ?? prettyDomain(group.outcome_domain)}</span>
        <span className="text-xs text-foreground/50">
          {prettyMeasure(group.effect_measure)} · {group.n_trials} trial{group.n_trials === 1 ? "" : "s"}
          {group.pooled ? ` · I² = ${group.pooled.i2}%` : " · not pooled"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="text-foreground" style={{ width: "100%", height: "auto" }}>
        {/* column headers */}
        <text x={0} y={18} fontSize={11} fontWeight={600} fill="currentColor">Trial</text>
        <text x={W} y={18} fontSize={11} fontWeight={600} fill="currentColor" textAnchor="end">
          {prettyMeasure(group.effect_measure)} (95% CI)
        </text>

        {/* null reference line */}
        <line x1={xPix(nullVal)} y1={HEADER_H} x2={xPix(nullVal)} y2={HEADER_H + rows.length * ROW_H + diamondRows * ROW_H}
          stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />

        {/* trial rows */}
        {rows.map((t, i) => {
          const cy = HEADER_H + i * ROW_H + ROW_H / 2;
          const cx = xPix(t.effect);
          const half = boxSize(i);
          const x1 = t.ci_low != null ? xPix(t.ci_low) : cx;
          const x2 = t.ci_high != null ? xPix(t.ci_high) : cx;
          const valStr = `${fmt(t.effect)} (${fmt(t.ci_low)}–${fmt(t.ci_high)})`;
          const href = trialHref(t.doi ?? t.paper_id);
          const labelText = t.label.length > 30 ? t.label.slice(0, 29) + "…" : t.label;
          return (
            <g key={`${t.paper_id}-${i}`}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <text x={0} y={cy + 3} fontSize={11} className="fill-blue-600 hover:underline" style={{ cursor: "pointer" }}>
                    {labelText}
                  </text>
                </a>
              ) : (
                <text x={0} y={cy + 3} fontSize={11} fill="currentColor" className="fill-foreground/80">
                  {labelText}
                </text>
              )}
              {/* CI whisker */}
              <line x1={x1} y1={cy} x2={x2} y2={cy} stroke="#2563eb" strokeWidth={1.5} />
              <line x1={x1} y1={cy - 3} x2={x1} y2={cy + 3} stroke="#2563eb" strokeWidth={1.5} />
              <line x1={x2} y1={cy - 3} x2={x2} y2={cy + 3} stroke="#2563eb" strokeWidth={1.5} />
              {/* point estimate */}
              <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} fill="#1d4ed8" />
              <text x={W} y={cy + 3} fontSize={11} fill="currentColor" textAnchor="end" className="fill-foreground/70 tabular-nums">
                {valStr}
              </text>
            </g>
          );
        })}

        {/* pooled diamond */}
        {group.pooled && (() => {
          const cy = HEADER_H + rows.length * ROW_H + ROW_H / 2;
          const cl = xPix(group.pooled.ci_low);
          const ch = xPix(group.pooled.ci_high);
          const cc = xPix(group.pooled.effect);
          const hh = 7;
          const valStr = `${fmt(group.pooled.effect)} (${fmt(group.pooled.ci_low)}–${fmt(group.pooled.ci_high)})`;
          return (
            <g>
              <text x={0} y={cy + 4} fontSize={11} fontWeight={700} fill="currentColor">Pooled (random)</text>
              <polygon points={`${cl},${cy} ${cc},${cy - hh} ${ch},${cy} ${cc},${cy + hh}`}
                fill="#b91c1c" stroke="#7f1d1d" />
              <text x={W} y={cy + 4} fontSize={11} fontWeight={700} fill="currentColor" textAnchor="end" className="tabular-nums">
                {valStr}
              </text>
            </g>
          );
        })()}

        {/* x-axis */}
        {(() => {
          const axisY = HEADER_H + rows.length * ROW_H + diamondRows * ROW_H + 6;
          return (
            <g>
              <line x1={plotLeft} y1={axisY} x2={plotRight} y2={axisY} stroke="#9ca3af" strokeWidth={1} />
              {ticks.map((t, i) => (
                <g key={i}>
                  <line x1={xPix(t)} y1={axisY} x2={xPix(t)} y2={axisY + 4} stroke="#9ca3af" strokeWidth={1} />
                  <text x={xPix(t)} y={axisY + 15} fontSize={10} fill="currentColor" textAnchor="middle" className="fill-foreground/60">
                    {fmt(t)}
                  </text>
                </g>
              ))}
              <text x={xPix(nullVal)} y={axisY + 30} fontSize={9} fill="currentColor" textAnchor="middle" className="fill-foreground/45">
                no effect ({ratio ? "ratio = 1" : "difference = 0"})
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
