"use client";

import { useMemo, useState } from "react";
import { TrialRow } from "./ResultsTable";
import { fmt } from "./utils";

/** Achieved serum lithium vs reported weight change, one bubble per study.
 *
 *  This is the review's central question — does lithium's effect on weight
 *  depend on how much lithium you actually have on board? — and the scatter is
 *  the honest artifact for it. A fitted meta-regression line is deliberately NOT
 *  drawn: the pipeline suppresses the slope below k=8 points, and the usable set
 *  here is smaller than that. Showing the raw points lets a reader see both the
 *  trend and how little there is of it; a line would imply precision the
 *  evidence does not support.
 *
 *  Bubble area is inverse-variance weighted where a CI is available, so bigger
 *  circles are better-estimated studies rather than merely larger ones.
 *
 *  x = achieved serum level (mmol/L), NOT the protocol target: a target is not
 *  an exposure, and imputing the midpoint of a target range manufactures data.
 */

const W = 720;
const H = 340;
const M = { top: 16, right: 20, bottom: 44, left: 56 };

interface Pt {
  x: number;
  y: number;
  r: number;
  label: string;
  metric: string;
  doi: string;
  design: string;
}

export function DoseResponseScatter({ rows }: { rows: TrialRow[] }) {
  const [hover, setHover] = useState<Pt | null>(null);

  const pts = useMemo<Pt[]>(() => {
    const out: Pt[] = [];
    for (const r of rows) {
      if (r.serumMmolL == null || r.effVal == null) continue;
      // Only continuous weight measures share an axis. A "proportion gaining
      // >=7%" is a different quantity and cannot sit on a kg scale.
      if (!/kg|bmi|percent_change|waist/.test(r.weightMetric)) continue;
      const width =
        r.ciLo != null && r.ciHi != null ? Math.abs(r.ciHi - r.ciLo) : null;
      // Inverse-variance proxy: narrower CI -> bigger bubble. Studies with no
      // CI get the floor size rather than being dropped.
      const w = width && width > 0 ? 1 / width : 0;
      out.push({
        x: r.serumMmolL,
        y: r.effVal,
        r: w,
        label: r.hoverLabel || r.doi,
        metric: r.weightMetricLabel || r.weightMetric,
        doi: r.doi,
        design: r.design,
      });
    }
    return out;
  }, [rows]);

  if (pts.length < 3) return null;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs, 0);
  const xMax = Math.max(...xs, 1.2);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 0);
  const yPad = (yMax - yMin) * 0.15 || 1;

  const sx = (v: number) =>
    M.left + ((v - xMin) / (xMax - xMin || 1)) * (W - M.left - M.right);
  const sy = (v: number) =>
    H - M.bottom -
    ((v - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad) || 1)) * (H - M.top - M.bottom);

  const maxR = Math.max(...pts.map((p) => p.r), 0);
  const radius = (p: Pt) => (maxR > 0 ? 4 + 8 * Math.sqrt(p.r / maxR) : 5);

  const xTicks = [0, 0.4, 0.6, 0.8, 1.0, 1.2].filter((t) => t >= xMin && t <= xMax);
  const yTicks = 5;

  return (
    <div className="mb-6 rounded-lg border border-border bg-white p-3 sm:p-4">
      <h2 className="mb-1 text-sm font-medium text-foreground">
        Weight change vs achieved serum lithium
      </h2>
      <p className="mb-3 text-xs text-foreground/50">
        {pts.length} stud{pts.length === 1 ? "y" : "ies"} reporting both an achieved
        serum level and a continuous weight outcome. Bubble size is inverse-variance
        weighted. No trend line is fitted — there are too few points for a
        meta-regression slope to be interpretable.
      </p>
      <div className="relative overflow-x-auto">
        <svg width={W} height={H} className="max-w-full">
          {/* zero line — above it lithium gained weight, below it lost */}
          <line
            x1={M.left}
            x2={W - M.right}
            y1={sy(0)}
            y2={sy(0)}
            stroke="currentColor"
            className="text-foreground/25"
            strokeDasharray="4 3"
          />
          {/* axes */}
          <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom}
                stroke="currentColor" className="text-foreground/30" />
          <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom}
                stroke="currentColor" className="text-foreground/30" />

          {xTicks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={H - M.bottom} y2={H - M.bottom + 4}
                    stroke="currentColor" className="text-foreground/40" />
              <text x={sx(t)} y={H - M.bottom + 15} textAnchor="middle"
                    className="fill-current text-foreground/50" fontSize={10}>
                {t}
              </text>
            </g>
          ))}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const v = (yMin - yPad) + (i / yTicks) * ((yMax + yPad) - (yMin - yPad));
            return (
              <g key={i}>
                <line x1={M.left - 4} x2={M.left} y1={sy(v)} y2={sy(v)}
                      stroke="currentColor" className="text-foreground/40" />
                <text x={M.left - 7} y={sy(v) + 3} textAnchor="end"
                      className="fill-current text-foreground/50" fontSize={10}>
                  {fmt(v)}
                </text>
              </g>
            );
          })}

          <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle"
                className="fill-current text-foreground/60" fontSize={11}>
            Achieved serum lithium (mmol/L)
          </text>
          <text x={14} y={(M.top + H - M.bottom) / 2} textAnchor="middle" fontSize={11}
                className="fill-current text-foreground/60"
                transform={`rotate(-90 14 ${(M.top + H - M.bottom) / 2})`}>
            Weight change (study&apos;s own metric)
          </text>

          {pts.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={radius(p)}
              className="fill-blue-500/40 stroke-blue-600/70"
              strokeWidth={1}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute left-2 top-2 rounded border border-border bg-white/95 px-2 py-1 text-xs shadow">
            <div className="font-medium">{hover.label}</div>
            <div className="text-foreground/60">
              {fmt(hover.x)} mmol/L · {fmt(hover.y)} {hover.metric}
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-foreground/45">
        Points sit at each study&apos;s <em>achieved</em> serum level. Protocol
        target ranges are excluded — a target is not an exposure.
      </p>
    </div>
  );
}
