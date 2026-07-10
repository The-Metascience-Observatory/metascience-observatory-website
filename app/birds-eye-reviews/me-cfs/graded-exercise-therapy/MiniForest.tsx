"use client";

import { fmtSmd } from "./types";

export interface MiniRow {
  label: string;
  k?: number;
  effect: number;
  ci_low: number;
  ci_high: number;
  i2?: number;
  /** Visually emphasise (e.g. primary / pooled estimate). */
  emphasis?: boolean;
}

/** A compact SMD forest for subtotals / sensitivity re-pools. Each row is a
 *  labelled diamond+CI on a shared linear scale with a dashed null line at 0.
 *  Self-contained inline SVG; positive favours GET. */
export function MiniForest({ rows, caption }: { rows: MiniRow[]; caption?: string }) {
  if (rows.length === 0) return null;

  const ROW_H = 34;
  const HEADER_H = 4;
  const AXIS_H = 26;
  const LABEL_W = 168;
  const VAL_W = 128;
  const PLOT_W = 260;
  const W = LABEL_W + PLOT_W + VAL_W;
  const plotLeft = LABEL_W;
  const plotRight = LABEL_W + PLOT_W;
  const H = HEADER_H + rows.length * ROW_H + AXIS_H;

  const vals: number[] = [0];
  for (const r of rows) vals.push(r.effect, r.ci_low, r.ci_high);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const xPix = (v: number) => plotLeft + ((v - lo) / (hi - lo)) * PLOT_W;
  const xClamp = (v: number) => Math.max(plotLeft, Math.min(plotRight, xPix(v)));

  const step = (hi - lo) / 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + step * i);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={caption ?? "Subgroup / sensitivity summary forest"}
        className="text-foreground"
        style={{ width: "100%", minWidth: 480, height: "auto" }}
      >
        {/* null line at 0 */}
        <line x1={xPix(0)} y1={HEADER_H} x2={xPix(0)} y2={HEADER_H + rows.length * ROW_H}
          stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />

        {rows.map((r, i) => {
          const cy = HEADER_H + i * ROW_H + ROW_H / 2;
          const cc = xPix(r.effect);
          const cl = xClamp(r.ci_low);
          const ch = xClamp(r.ci_high);
          const hh = r.emphasis ? 7 : 6;
          const kStr = r.k != null ? ` (k=${r.k}${r.i2 != null ? `, I²=${r.i2}%` : ""})` : "";
          const valStr = `${fmtSmd(r.effect)} (${fmtSmd(r.ci_low)}–${fmtSmd(r.ci_high)})`;
          const fill = r.emphasis ? "#b91c1c" : "#1d4ed8";
          const stroke = r.emphasis ? "#7f1d1d" : "#1e3a8a";
          return (
            <g key={r.label}>
              <text x={0} y={cy - 2} fontSize={11} fontWeight={r.emphasis ? 700 : 500} className="fill-foreground/85">
                {r.label}
              </text>
              {kStr && (
                <text x={0} y={cy + 10} fontSize={9} className="fill-foreground/45">{kStr.trim()}</text>
              )}
              {/* CI bar */}
              <line x1={cl} y1={cy} x2={ch} y2={cy} stroke={fill} strokeWidth={1.5} />
              <line x1={cl} y1={cy - 3} x2={cl} y2={cy + 3} stroke={fill} strokeWidth={1.5} />
              <line x1={ch} y1={cy - 3} x2={ch} y2={cy + 3} stroke={fill} strokeWidth={1.5} />
              {/* diamond point */}
              <polygon points={`${cc - hh},${cy} ${cc},${cy - hh} ${cc + hh},${cy} ${cc},${cy + hh}`}
                fill={fill} stroke={stroke} />
              <text x={W} y={cy + 3} fontSize={11} textAnchor="end" className="fill-foreground/70 tabular-nums">
                {valStr}
              </text>
            </g>
          );
        })}

        {/* axis */}
        {(() => {
          const axisY = HEADER_H + rows.length * ROW_H + 4;
          return (
            <g>
              <line x1={plotLeft} y1={axisY} x2={plotRight} y2={axisY} stroke="#9ca3af" strokeWidth={1} />
              {ticks.map((t, i) => (
                <g key={i}>
                  <line x1={xPix(t)} y1={axisY} x2={xPix(t)} y2={axisY + 4} stroke="#9ca3af" strokeWidth={1} />
                  <text x={xPix(t)} y={axisY + 15} fontSize={9} textAnchor="middle" className="fill-foreground/55">
                    {fmtSmd(t)}
                  </text>
                </g>
              ))}
            </g>
          );
        })()}
      </svg>
      {caption && <p className="mt-1 text-[11px] leading-snug text-foreground/50">{caption}</p>}
    </div>
  );
}
