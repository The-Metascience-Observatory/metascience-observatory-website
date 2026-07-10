"use client";

import { GetGroup, fmt, fmtSmd, prettyDomain, gradeBadge, trialHref } from "./types";

/** A self-contained SVG forest plot for one GET meta-analysis group.
 *  - SMD groups (fatigue, physical function): linear axis, null line at 0,
 *    positive effect favours GET.
 *  - Harms group: log axis (risk ratio), null line at 1, RR > 1 favours control
 *    (more harm with GET).
 *  One row per trial (square sized by pooled weight + CI whisker), a null
 *  reference line, x-axis ticks, and a pooled diamond at the bottom. No external
 *  chart libraries — everything is inline SVG. Theme-aware: text uses
 *  currentColor (inherits text-foreground). */
export function GetForestPlot({ group }: { group: GetGroup }) {
  const isLog = group.effect_measure === "risk_ratio";
  const nullVal = isLog ? 1 : 0;

  // trials ordered by descending weight so the highest-leverage rows read first
  const rows = [...group.trials].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  const ROW_H = 30;
  const HEADER_H = 28;
  const AXIS_H = 46;
  const LABEL_W = 150;
  const VAL_W = 170;
  const PLOT_W = 340;
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
  // clamp so out-of-range whiskers stay inside the plot band
  const xClamp = (v: number) => Math.max(plotLeft, Math.min(plotRight, xPix(v)));

  // --- x-axis ticks ---
  let ticks: number[];
  if (isLog) {
    const ratioTicks = [0.1, 0.25, 0.5, 1, 2, 4, 10, 25, 50];
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

  const fmtVal = isLog ? fmt : (n: number | null | undefined) => fmtSmd(n);
  const valLabel = isLog ? "Risk ratio (95% CI)" : "SMD (95% CI)";
  const badge = group.certainty ? gradeBadge(group.certainty.grade) : null;

  // Favour direction labels under the axis extremes.
  const favLeft = isLog ? "fewer harms with GET" : "favours control";
  const favRight = isLog ? "more harm with GET" : "favours GET";

  return (
    <div className="border border-border rounded-lg bg-card p-4 mb-6 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-semibold text-foreground">{prettyDomain(group.outcome_domain)}</h3>
        <span className="text-xs text-foreground/55">
          {isLog ? "Risk ratio" : "Standardised mean difference"} · {group.n_trials} trial
          {group.n_trials === 1 ? "" : "s"}
          {group.pooled ? ` · I² = ${fmt(group.pooled.i2)}%` : " · not pooled"}
        </span>
        {badge && (
          <span className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${badge.cls}`}>
            {badge.label} (GRADE)
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Forest plot of ${prettyDomain(group.outcome_domain)}`}
          className="text-foreground"
          style={{ width: "100%", minWidth: 560, height: "auto" }}
        >
          {/* column headers */}
          <text x={0} y={18} fontSize={11} fontWeight={600} fill="currentColor">Trial (n)</text>
          <text x={W} y={18} fontSize={11} fontWeight={600} fill="currentColor" textAnchor="end">
            {valLabel}
          </text>

          {/* null reference line */}
          <line
            x1={xPix(nullVal)} y1={HEADER_H}
            x2={xPix(nullVal)} y2={HEADER_H + rows.length * ROW_H + diamondRows * ROW_H}
            stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3"
          />

          {/* trial rows */}
          {rows.map((t, i) => {
            const cy = HEADER_H + i * ROW_H + ROW_H / 2;
            const cx = xPix(t.effect);
            const half = boxSize(i);
            const x1 = t.ci_low != null ? xClamp(t.ci_low) : cx;
            const x2 = t.ci_high != null ? xClamp(t.ci_high) : cx;
            const clippedLo = t.ci_low != null && xPix(t.ci_low) < plotLeft;
            const clippedHi = t.ci_high != null && xPix(t.ci_high) > plotRight;
            const wpct = t.weight != null ? `${fmt(t.weight)}%` : "—";
            const valStr = `${fmtVal(t.effect)} (${fmtVal(t.ci_low)}–${fmtVal(t.ci_high)})  ${wpct}`;
            const href = trialHref(t.paper_id);
            const nLabel = t.n_total != null ? ` (${t.n_total})` : "";
            const rawLabel = `${t.first_author} ${t.year}`;
            const labelText = (rawLabel.length > 20 ? rawLabel.slice(0, 19) + "…" : rawLabel) + nLabel;
            return (
              <g key={`${t.paper_id}-${i}`}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <text x={0} y={cy + 3} fontSize={11} className="fill-blue-600 hover:underline" style={{ cursor: "pointer" }}>
                      {labelText}
                    </text>
                  </a>
                ) : (
                  <text x={0} y={cy + 3} fontSize={11} className="fill-foreground/80">
                    {labelText}
                  </text>
                )}
                {/* CI whisker (arrowless clamp markers when it runs off-scale) */}
                <line x1={x1} y1={cy} x2={x2} y2={cy} stroke="#2563eb" strokeWidth={1.5} />
                {!clippedLo && <line x1={x1} y1={cy - 3} x2={x1} y2={cy + 3} stroke="#2563eb" strokeWidth={1.5} />}
                {!clippedHi && <line x1={x2} y1={cy - 3} x2={x2} y2={cy + 3} stroke="#2563eb" strokeWidth={1.5} />}
                {clippedLo && <polygon points={`${x1 - 4},${cy} ${x1 + 2},${cy - 4} ${x1 + 2},${cy + 4}`} fill="#2563eb" />}
                {clippedHi && <polygon points={`${x2 + 4},${cy} ${x2 - 2},${cy - 4} ${x2 - 2},${cy + 4}`} fill="#2563eb" />}
                {/* point estimate, sized by weight */}
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
            const cl = xClamp(group.pooled.ci_low);
            const ch = xClamp(group.pooled.ci_high);
            const cc = xPix(group.pooled.effect);
            const hh = 7;
            const valStr = `${fmtVal(group.pooled.effect)} (${fmtVal(group.pooled.ci_low)}–${fmtVal(group.pooled.ci_high)})`;
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

          {/* x-axis + tick labels + direction cues */}
          {(() => {
            const axisY = HEADER_H + rows.length * ROW_H + diamondRows * ROW_H + 6;
            return (
              <g>
                <line x1={plotLeft} y1={axisY} x2={plotRight} y2={axisY} stroke="#9ca3af" strokeWidth={1} />
                {ticks.map((t, i) => (
                  <g key={i}>
                    <line x1={xPix(t)} y1={axisY} x2={xPix(t)} y2={axisY + 4} stroke="#9ca3af" strokeWidth={1} />
                    <text x={xPix(t)} y={axisY + 15} fontSize={10} fill="currentColor" textAnchor="middle" className="fill-foreground/60">
                      {isLog ? fmt(t) : fmtSmd(t)}
                    </text>
                  </g>
                ))}
                {/* direction cues under the axis */}
                <text x={plotLeft} y={axisY + 32} fontSize={9} fill="currentColor" textAnchor="start" className="fill-foreground/45">
                  ← {favLeft}
                </text>
                <text x={plotRight} y={axisY + 32} fontSize={9} fill="currentColor" textAnchor="end" className="fill-foreground/45">
                  {favRight} →
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* prediction interval note (SMD groups carry one) */}
      {group.pooled?.pred_low != null && group.pooled?.pred_high != null && (
        <p className="mt-1 text-[11px] leading-snug text-foreground/50">
          95% prediction interval {fmtSmd(group.pooled.pred_low)} to {fmtSmd(group.pooled.pred_high)} —
          a future trial could plausibly fall anywhere in this range, spanning harm to large benefit.
        </p>
      )}
    </div>
  );
}
