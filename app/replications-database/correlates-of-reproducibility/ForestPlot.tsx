import { ChartWatermark } from "@/components/ChartWatermark";

/**
 * Server-rendered forest plot of standardized fractional-logit coefficients:
 * one row per covariate, Models A and B dodged within the row. Static SVG —
 * native <title> tooltips, no hydration. Model identity is encoded by color
 * AND marker shape (circle vs diamond) so the plot survives monochrome.
 */

export const MODEL_A_COLOR = "#4f77bd";
export const MODEL_B_COLOR = "#d97706";

export interface ForestEstimate {
  beta: number;
  se: number;
  p: number;
  ame: number;
}

export interface ForestTerm {
  name: string;
  a?: ForestEstimate;
  b?: ForestEstimate;
}

const Z = 1.959963984540054;

function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const rawStep = span / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 6) ?? 10 * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
    ticks.push(Math.abs(t) < 1e-9 ? 0 : t);
  }
  return ticks;
}

function fmtTip(name: string, model: string, e: ForestEstimate): string {
  const lo = e.beta - Z * e.se;
  const hi = e.beta + Z * e.se;
  const p = e.p < 0.001 ? "< 0.001" : e.p.toFixed(3);
  return (
    `${name} — ${model}: β = ${e.beta.toFixed(3)} per +1 SD ` +
    `[${lo.toFixed(3)}, ${hi.toFixed(3)}], p ${e.p < 0.001 ? "" : "= "}${p}; ` +
    `AME ${(e.ame * 100).toFixed(1)} pp per +1 SD`
  );
}

export function ForestPlot({
  terms,
  legendA,
  legendB,
}: {
  terms: ForestTerm[];
  legendA: string;
  legendB: string;
}) {
  const W = 720;
  const labelW = 198;
  const x0 = labelW + 12;
  const x1 = W - 24;
  const rowH = 46;
  const top = 46;
  const H = top + terms.length * rowH + 42;

  let lo = 0;
  let hi = 0;
  for (const t of terms) {
    for (const e of [t.a, t.b]) {
      if (!e) continue;
      lo = Math.min(lo, e.beta - Z * e.se);
      hi = Math.max(hi, e.beta + Z * e.se);
    }
  }
  const pad = 0.06 * (hi - lo || 1);
  lo -= pad;
  hi += pad;
  const xOf = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const ticks = niceTicks(lo, hi);

  const axisY = top + terms.length * rowH;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Forest plot of standardized coefficients from the two fractional logit models"
    >
      {/* legend */}
      <g>
        <circle cx={x0 + 6} cy={16} r={4.5} fill={MODEL_A_COLOR} />
        <text x={x0 + 16} y={20} className="fill-black dark:fill-gray-100" style={{ fontSize: 12 }}>
          {legendA}
        </text>
        <rect
          x={x0 + 218}
          y={11.5}
          width={9}
          height={9}
          transform={`rotate(45 ${x0 + 222.5} 16)`}
          fill={MODEL_B_COLOR}
        />
        <text x={x0 + 232} y={20} className="fill-black dark:fill-gray-100" style={{ fontSize: 12 }}>
          {legendB}
        </text>
      </g>

      {/* gridlines + axis */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={xOf(t)}
            y1={top - 6}
            x2={xOf(t)}
            y2={axisY}
            className={
              t === 0 ? "stroke-gray-500 dark:stroke-gray-400" : "stroke-gray-200 dark:stroke-gray-700"
            }
            strokeWidth={t === 0 ? 1.2 : 1}
            strokeDasharray={t === 0 ? undefined : "3 3"}
          />
          <text
            x={xOf(t)}
            y={axisY + 16}
            textAnchor="middle"
            className="fill-gray-600 dark:fill-gray-400"
            style={{ fontSize: 11 }}
          >
            {t === 0 ? "0" : t.toFixed(2).replace(/\.?0+$/, "")}
          </text>
        </g>
      ))}
      <text
        x={(x0 + x1) / 2}
        y={axisY + 34}
        textAnchor="middle"
        className="fill-gray-600 dark:fill-gray-400"
        style={{ fontSize: 11 }}
      >
        Standardized coefficient (log-odds per +1 SD) with 95% CI · right of 0 → more replicable
      </text>

      {/* rows */}
      {terms.map((t, i) => {
        const yMid = top + i * rowH + rowH / 2;
        const yA = t.b ? yMid - 8 : yMid;
        const yB = t.a ? yMid + 8 : yMid;
        return (
          <g key={t.name}>
            {i > 0 && (
              <line
                x1={12}
                y1={top + i * rowH}
                x2={x1}
                y2={top + i * rowH}
                className="stroke-gray-100 dark:stroke-gray-800"
                strokeWidth={1}
              />
            )}
            <text
              x={labelW}
              y={yMid + 4}
              textAnchor="end"
              className="fill-black dark:fill-gray-100"
              style={{ fontSize: 12.5 }}
            >
              {t.name}
            </text>
            {t.a && (
              <g>
                <title>{fmtTip(t.name, legendA, t.a)}</title>
                <line
                  x1={xOf(t.a.beta - Z * t.a.se)}
                  y1={yA}
                  x2={xOf(t.a.beta + Z * t.a.se)}
                  y2={yA}
                  stroke={MODEL_A_COLOR}
                  strokeWidth={2}
                />
                <circle cx={xOf(t.a.beta)} cy={yA} r={4.5} fill={MODEL_A_COLOR} className="stroke-white dark:stroke-gray-900" strokeWidth={1.5} />
              </g>
            )}
            {t.b && (
              <g>
                <title>{fmtTip(t.name, legendB, t.b)}</title>
                <line
                  x1={xOf(t.b.beta - Z * t.b.se)}
                  y1={yB}
                  x2={xOf(t.b.beta + Z * t.b.se)}
                  y2={yB}
                  stroke={MODEL_B_COLOR}
                  strokeWidth={2}
                />
                <rect
                  x={xOf(t.b.beta) - 4.5}
                  y={yB - 4.5}
                  width={9}
                  height={9}
                  transform={`rotate(45 ${xOf(t.b.beta)} ${yB})`}
                  fill={MODEL_B_COLOR}
                  className="stroke-white dark:stroke-gray-900"
                  strokeWidth={1.5}
                />
              </g>
            )}
          </g>
        );
      })}

      <ChartWatermark x={12} y={H - 20} />
    </svg>
  );
}
