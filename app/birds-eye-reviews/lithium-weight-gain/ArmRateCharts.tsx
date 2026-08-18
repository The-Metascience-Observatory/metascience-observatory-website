"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { ArmRatePoint } from "./arm-points";
import { fmt, niceTicks, tickLabel } from "./utils";

/** Dose-normalized weight-change charts, one point per lithium arm.
 *
 *  The results table shows each study's own metric because metrics are not
 *  interchangeable; these charts take the subset that DO share a metric —
 *  kilograms over a known treatment window — and normalize so a 6-week trial
 *  and a 2-year cohort can sit on one human-readable axis.
 *
 *  Data comes from lithium-arm change-from-baseline results (within-group),
 *  not between-group effects: single-arm cohorts report how much weight their
 *  patients gained without any comparator, and a rate axis can use exactly
 *  that. The trade-off is the missing counterfactual — bipolar populations
 *  gain weight on comparator drugs too — so these are exposure curves, not
 *  causal effects, and the prose says so.
 *
 *  %-change axes were considered and are NOT buildable: no record in either
 *  extraction file carries a numeric baseline weight or BMI (only a
 *  categorical BMI band), so there is no denominator for a percent change.
 *
 *  No trend lines are fitted anywhere: the usable point sets are below the k
 *  the pipeline requires for an interpretable meta-regression slope.
 */

const W = 720;
const H = 340;
// Margins sized for the 12/13px axis text.
const M = { top: 16, right: 20, bottom: 50, left: 64 };

// Strata whose weight relationship runs differently (drinking-water inverse;
// anorexia = gain intended) are excluded rather than silently mixed in.
const PLOTTABLE_STRATA = new Set(["", "therapeutic", "low_dose_clinical", "not_reported", "unclear"]);

// Rates from very short windows are dominated by fluid shifts (a 1-week
// metabolic study can show ±5 kg/week of pure water), so rate charts start
// at 2 weeks of treatment.
const MIN_RATE_WEEKS = 2;

interface Pt {
  x: number;
  y: number;
  p: ArmRatePoint;
}

interface LegendItem {
  label: string;
  className: string;
}

/** Duration buckets double as the color scale on the rate charts: a rate held
 *  for two years means something different from the same rate over a month. */
function durationBucket(weeks: number): 0 | 1 | 2 {
  if (weeks < 8) return 0;
  if (weeks <= 26) return 1;
  return 2;
}
const BUCKET_CLASS = [
  "fill-sky-400/45 stroke-sky-500/70",
  "fill-blue-500/50 stroke-blue-600/70",
  "fill-indigo-700/55 stroke-indigo-800/70",
];
const DURATION_LEGEND: LegendItem[] = [
  { label: "< 8 weeks", className: BUCKET_CLASS[0] },
  { label: "8–26 weeks", className: BUCKET_CLASS[1] },
  { label: "> 26 weeks", className: BUCKET_CLASS[2] },
];
const TRIAL_CLASS = "fill-blue-500/50 stroke-blue-600/70";
const OBS_CLASS = "fill-stone-400/50 stroke-stone-500/70";

function studyHref(doi: string): string | null {
  const base = doi.split("#")[0];
  if (base.startsWith("10.")) return `https://doi.org/${base}`;
  if (base.startsWith("pmid_")) return `https://pubmed.ncbi.nlm.nih.gov/${base.slice(5)}/`;
  return null;
}

function Scatter({
  title, subtitle, points, xLabel, yLabel, xTicks, xScale = "linear",
  colorClass, legend, legendTitle, footnote, tooltip,
}: {
  title: string;
  subtitle: string;
  points: Pt[];
  xLabel: string;
  yLabel: string;
  xTicks: number[];
  xScale?: "linear" | "log";
  colorClass: (p: Pt) => string;
  legend: LegendItem[];
  legendTitle?: string;
  footnote: ReactNode;
  tooltip: (p: Pt) => string;
}) {
  const [hover, setHover] = useState<{ pt: Pt; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover handoff: leaving a point starts a short fuse; entering the tooltip
  // (to click its study link) defuses it. Without the delay the tooltip
  // vanishes before the pointer can reach it.
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHover(null), 250);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  if (points.length < 3) return null;

  const tx = (v: number) => (xScale === "log" ? Math.log10(v) : v);
  const xs = points.map((p) => tx(p.x));
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs, tx(xTicks[0]));
  const xMax = Math.max(...xs, tx(xTicks[xTicks.length - 1]));
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 0);
  const yPad = (yMax - yMin) * 0.15 || 1;

  const sx = (v: number) =>
    M.left + ((tx(v) - xMin) / (xMax - xMin || 1)) * (W - M.left - M.right);
  const sy = (v: number) =>
    H - M.bottom -
    ((v - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad) || 1)) * (H - M.top - M.bottom);

  // Round-number ticks; because they are multiples of a nice step, 0 is
  // always among them when the data spans zero — so the dashed zero line
  // gets its own labeled tick.
  const yTicks = niceTicks(yMin - yPad, yMax + yPad);

  const showTip = (pt: Pt) => (e: React.MouseEvent) => {
    cancelClose();
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    // Near the pointer, clamped so it never leaves the card horizontally.
    const x = Math.min(e.clientX - r.left + 14, r.width - 230);
    const y = e.clientY - r.top + 12;
    setHover({ pt, x, y });
  };

  const href = hover ? studyHref(hover.pt.p.doi) : null;

  return (
    // w-fit + mx-auto: the card hugs the chart's own width and sits centered;
    // the subtitle/footnote paragraphs inherit that width and wrap inside it.
    <div className="mb-6 w-fit max-w-full mx-auto rounded-lg border border-border bg-white p-3 sm:p-4">
      <h2 className="mb-1 text-sm font-medium text-foreground">{title}</h2>
      <p className="mb-3 max-w-[720px] text-xs text-foreground/50">{subtitle}</p>
      <div ref={wrapRef} className="relative overflow-x-auto">
        {/* viewBox lets the whole chart scale down proportionally when a
            two-column layout gives it less than its natural 720px. */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="max-w-full h-auto">
          {/* zero line — above it weight was gained, below it lost */}
          <line x1={M.left} x2={W - M.right} y1={sy(0)} y2={sy(0)}
                stroke="currentColor" className="text-foreground/25" strokeDasharray="4 3" />
          <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom}
                stroke="currentColor" className="text-foreground/30" />
          <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom}
                stroke="currentColor" className="text-foreground/30" />

          {xTicks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={H - M.bottom} y2={H - M.bottom + 4}
                    stroke="currentColor" className="text-foreground/40" />
              <text x={sx(t)} y={H - M.bottom + 15} textAnchor="middle"
                    className="fill-current text-foreground" fontSize={12}>
                {t}
              </text>
            </g>
          ))}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.left - 4} x2={M.left} y1={sy(v)} y2={sy(v)}
                    stroke="currentColor" className="text-foreground/40" />
              <text x={M.left - 7} y={sy(v) + 3} textAnchor="end"
                    className="fill-current text-foreground" fontSize={12}>
                {tickLabel(v)}
              </text>
            </g>
          ))}

          <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle"
                className="fill-current text-foreground" fontSize={13}>
            {xLabel}
          </text>
          <text x={14} y={(M.top + H - M.bottom) / 2} textAnchor="middle" fontSize={13}
                className="fill-current text-foreground"
                transform={`rotate(-90 14 ${(M.top + H - M.bottom) / 2})`}>
            {yLabel}
          </text>

          {/* In-plot legend, upper-left, stacked vertically — the one corner
              every chart here leaves empty (doses start ≥ 100 mg, serum ≥ 0.3,
              and no short study reaches the top of the kg range). */}
          <g>
            {legendTitle && (
              <text x={M.left + 12} y={M.top + 14}
                    className="fill-current text-foreground" fontSize={12} fontWeight={600}>
                {legendTitle}
              </text>
            )}
            {legend.map((item, i) => {
              const y = M.top + (legendTitle ? 30 : 14) + i * 17;
              return (
                <g key={item.label}>
                  <circle cx={M.left + 17} cy={y - 4} r={5}
                          className={item.className} strokeWidth={1} />
                  <text x={M.left + 28} y={y}
                        className="fill-current text-foreground" fontSize={12}>
                    {item.label}
                  </text>
                </g>
              );
            })}
          </g>

          {points.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={5}
              className={colorClass(p)}
              strokeWidth={1}
              onMouseEnter={showTip(p)}
              onMouseLeave={scheduleClose}
            />
          ))}
        </svg>
        {hover && (
          <div
            className="absolute z-10 w-[220px] rounded border border-border bg-white/95 px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: hover.x, top: hover.y }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="font-medium">{hover.pt.p.label || hover.pt.p.doi}</div>
            <div className="text-foreground/60">{tooltip(hover.pt)}</div>
            <div className="text-foreground/60">
              N = {hover.pt.p.n != null ? hover.pt.p.n.toLocaleString() : "not reported"}
            </div>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
              >
                View study <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 max-w-[720px] text-xs text-foreground/45">{footnote}</p>
    </div>
  );
}

/** "0.05 kg/wk over 26 wk (+1.3 kg)" — the rate AND what it added up to. */
function rateTooltip(p: Pt): string {
  return `${fmt(p.p.kgPerWeek)} kg/week over ${fmt(p.p.weeks)} wk (${p.p.totalKg > 0 ? "+" : ""}${fmt(p.p.totalKg)} kg total)`;
}

export function ArmRateCharts({ points }: { points: ArmRatePoint[] }) {
  const plottable = useMemo(
    () => points.filter((p) => PLOTTABLE_STRATA.has(p.stratum)),
    [points],
  );
  const excludedStrata = points.length - plottable.length;

  const ratePts = plottable.filter((p) => p.weeks >= MIN_RATE_WEEKS);

  const dosePts: Pt[] = ratePts
    .filter((p) => p.doseMg != null)
    .map((p) => ({ x: p.doseMg as number, y: p.kgPerWeek, p }));
  const serumPts: Pt[] = ratePts
    .filter((p) => p.serum != null)
    .map((p) => ({ x: p.serum as number, y: p.kgPerWeek, p }));
  const durationPts: Pt[] = plottable
    .filter((p) => p.weeks >= 1)
    .map((p) => ({ x: p.weeks, y: p.totalKg, p }));
  // Cumulative exposure: mean daily elemental dose × days, in grams. A
  // dose-time product on a log axis — 100 mg/day for 2 weeks (1.4 g) up to
  // years of maintenance (hundreds of grams).
  const exposurePts: Pt[] = ratePts
    .filter((p) => p.doseMg != null)
    .map((p) => ({ x: ((p.doseMg as number) * p.weeks * 7) / 1000, y: p.totalKg, p }));

  if (dosePts.length < 3 && serumPts.length < 3 && durationPts.length < 3) return null;

  const doseTicks = [0, 50, 100, 150, 200, 250, 300, 350];
  const maxDose = Math.max(...dosePts.map((d) => d.x), 0);
  const strataNote = excludedStrata > 0 && (
    <>
      {" "}Drinking-water, supplement and anorexia-treatment studies
      ({excludedStrata} arm{excludedStrata === 1 ? "" : "s"}) are excluded —
      those strata are never pooled with therapeutic dosing.
    </>
  );
  const trialLegend: LegendItem[] = [
    { label: "Interventional (RCT, crossover, …)", className: TRIAL_CLASS },
    { label: "Observational", className: OBS_CLASS },
  ];

  return (
    // Two columns only when both charts can render near full size: at
    // 1700px viewport the content area (minus the page's 2xl side padding)
    // gives each column ~680px, a barely-noticeable scale-down. Below that,
    // one centered column.
    <div className="grid grid-cols-1 min-[1700px]:grid-cols-2 gap-x-6 items-start">
      <Scatter
        title="Rate of weight change vs elemental lithium dose"
        subtitle={`${dosePts.length} lithium arms reporting a kg change from baseline, a treatment length, and a daily dose. Rate = reported change ÷ weeks of treatment.`}
        points={dosePts}
        xLabel="Elemental lithium (mg/day) — 900 mg carbonate ≈ 169 mg elemental"
        yLabel="Weight change (kg per week)"
        xTicks={doseTicks.filter((t) => t <= maxDose + 50)}
        colorClass={(pt) => BUCKET_CLASS[durationBucket(pt.p.weeks)]}
        legend={DURATION_LEGEND}
        legendTitle="Treatment length"
        tooltip={(pt) => `${fmt(pt.p.doseMg!)} mg/day · ${rateTooltip(pt)}`}
        footnote={
          <>
            One point per lithium arm. No study reports elemental lithium
            directly — every dose here is converted from the stated salt
            (carbonate is 18.8% lithium by mass). Studies shorter than{" "}
            {MIN_RATE_WEEKS} weeks are excluded — a one-week weight change is
            mostly fluid shift, not tissue.{strataNote} These are within-arm
            changes with no comparison group, so they show what patients on
            lithium experienced, not what lithium caused.
          </>
        }
      />

      <Scatter
        title="Rate of weight change vs achieved serum lithium"
        subtitle={`${serumPts.length} lithium arms reporting a kg change from baseline, a treatment length, and a measured serum level.`}
        points={serumPts}
        xLabel="Achieved serum lithium (mmol/L)"
        yLabel="Weight change (kg per week)"
        xTicks={[0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2].filter(
          (t) => t <= Math.max(...serumPts.map((d) => d.x), 1.2) + 0.05,
        )}
        colorClass={(pt) => BUCKET_CLASS[durationBucket(pt.p.weeks)]}
        legend={DURATION_LEGEND}
        legendTitle="Treatment length"
        tooltip={(pt) => `${fmt(pt.p.serum!)} mmol/L · ${rateTooltip(pt)}`}
        footnote={
          <>
            Serum levels are <em>achieved</em> measurements, never protocol
            targets. Points below the dashed line lost weight on lithium.
            {strataNote}
          </>
        }
      />

      <Scatter
        title="Total weight change vs cumulative lithium exposure"
        subtitle={`${exposurePts.length} lithium arms where dose × duration is computable. Cumulative exposure = mean daily elemental dose × days on treatment.`}
        points={exposurePts}
        xLabel="Cumulative elemental lithium (grams, log scale)"
        yLabel="Total weight change (kg)"
        xTicks={[1, 3, 10, 30, 100, 300].filter(
          (t) =>
            t >= Math.min(...exposurePts.map((d) => d.x), 3) / 2 &&
            t <= Math.max(...exposurePts.map((d) => d.x), 30) * 1.5,
        )}
        xScale="log"
        colorClass={(pt) => BUCKET_CLASS[durationBucket(pt.p.weeks)]}
        legend={DURATION_LEGEND}
        legendTitle="Treatment length"
        tooltip={(pt) =>
          `${fmt(((pt.p.doseMg as number) * pt.p.weeks * 7) / 1000)} g cumulative · ${rateTooltip(pt)}`
        }
        footnote={
          <>
            Cumulative exposure = mean daily elemental dose × days on
            treatment, so a point far to the right can be a modest dose held
            for years.{strataNote}
          </>
        }
      />

      <Scatter
        title="Total weight change vs length of treatment"
        subtitle={`${durationPts.length} lithium arms with a kg change and a known observation window — the raw time course behind the rates above.`}
        points={durationPts}
        xLabel="Treatment duration (weeks, log scale)"
        yLabel="Total weight change (kg)"
        xTicks={[1, 4, 13, 26, 52, 104, 364].filter(
          (t) => t <= Math.max(...durationPts.map((d) => d.x), 52) * 1.1,
        )}
        xScale="log"
        colorClass={(pt) => (pt.p.isTrial ? TRIAL_CLASS : OBS_CLASS)}
        legend={trialLegend}
        tooltip={(pt) => rateTooltip(pt)}
        footnote={
          <>
            If lithium weight gain accrues early and then plateaus — the common
            clinical claim — points should rise across the first months and
            flatten to the right. Very short studies (&lt; 2 weeks) appear here
            even though they are excluded from the rate charts.{strataNote}
          </>
        }
      />
    </div>
  );
}
