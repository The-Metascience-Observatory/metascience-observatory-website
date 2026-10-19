"use client";

import Link from "next/link";
import {
  ScatterChart,
  Scatter,
  ErrorBar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { NsfOigYearDatum, SourcedValue } from "./nsfOigData";

const NSF_OIG_DATA_PATH = "/forensic-metascience-ai-toolkit/nsf-oig-data";
const ALLEGATIONS_COLOR = "#c0392b";
const FINDINGS_COLOR = "#1a5276";
const AXIS_COLOR = "#000000";
const AXIS_STYLE = {
  stroke: AXIS_COLOR,
  tick: { fill: AXIS_COLOR },
  axisLine: { stroke: AXIS_COLOR },
  tickLine: { stroke: AXIS_COLOR },
};

/** Direct label only on the allegations peak. */
const LABELED_ALLEGATION_YEARS = new Set([2011]);

interface PointDatum {
  year: number;
  count: number;
  series: "Allegations received" | "Findings of misconduct";
  sourced: SourcedValue;
  yearBasis: string;
  /** [below, above] offsets for the range where sources disagree. */
  range?: [number, number];
  label?: number;
}

interface NsfOigMisconductChartProps {
  data: NsfOigYearDatum[];
}

function toPoints(
  data: NsfOigYearDatum[],
  key: "allegations" | "findings",
  series: PointDatum["series"],
): PointDatum[] {
  return data.flatMap((d) => {
    const v = d[key];
    if (!v) return [];
    return [
      {
        year: d.year,
        count: v.value,
        series,
        sourced: v,
        yearBasis: d.yearBasis,
        range: v.high > v.low ? [v.value - v.low, v.high - v.value] : undefined,
        label:
          key === "allegations" && LABELED_ALLEGATION_YEARS.has(d.year) ? v.value : undefined,
      },
    ];
  });
}

/** Filled = NSF OIG's own report; hollow = a secondary source citing it. */
function makeDot(color: string) {
  return function Dot(props: { cx?: number; cy?: number; payload?: PointDatum }) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return <g />;
    const primary = payload?.sourced.sourceType === "primary";
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5.5}
        fill={primary ? color : "#ffffff"}
        stroke={color}
        strokeWidth={2}
      />
    );
  };
}

function PointTooltip({ active, payload }: TooltipProps<number, string>) {
  const p = payload?.[0]?.payload as PointDatum | undefined;
  if (!active || !p) return null;
  const { sourced } = p;
  return (
    <div className="max-w-xs rounded border border-border bg-white p-2 text-xs shadow-sm">
      <p className="m-0 font-semibold text-foreground">
        {p.yearBasis === "fiscal" ? "FY" : ""}
        {p.year}
        {p.yearBasis === "fiscal" ? "" : " (fiscal/calendar unclear)"}
      </p>
      <p className="m-0 text-foreground">
        {p.series}: {p.count}
        {sourced.high > sourced.low ? ` (sources range ${sourced.low}–${sourced.high})` : ""}
      </p>
      <p className="m-0 mt-1 text-foreground/60">{sourced.source}</p>
    </div>
  );
}

function LegendDot({ color, filled }: { color: string; filled: boolean }) {
  return (
    <svg width="12" height="12" aria-hidden className="inline-block align-middle mr-1.5">
      <circle cx="6" cy="6" r="4.5" fill={filled ? color : "#ffffff"} stroke={color} strokeWidth={2} />
    </svg>
  );
}

export function NsfOigMisconductChart({ data }: NsfOigMisconductChartProps) {
  const allegations = toPoints(data, "allegations", "Allegations received");
  const findings = toPoints(data, "findings", "Findings of misconduct");
  return (
    <figure className="mx-auto w-full md:w-4/5 border border-black rounded-lg bg-white p-6 my-8">
      <figcaption className="mb-3">
        <span className="block text-lg font-semibold text-foreground">
          NSF OIG research misconduct allegations and findings per year
        </span>
        <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">
          <span>
            <LegendDot color={ALLEGATIONS_COLOR} filled />
            Allegations received
          </span>
          <span>
            <LegendDot color={FINDINGS_COLOR} filled />
            Findings of misconduct
          </span>
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ left: 0, right: 10, top: 18, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            {...AXIS_STYLE}
            dataKey="year"
            type="number"
            domain={[2002, 2026]}
            ticks={[2003, 2007, 2011, 2015, 2019, 2023]}
            tickMargin={6}
            fontSize={12}
            name="Year"
          />
          <YAxis
            {...AXIS_STYLE}
            dataKey="count"
            type="number"
            allowDecimals={false}
            domain={[0, 125]}
            ticks={[0, 25, 50, 75, 100, 125]}
            fontSize={12}
            width={36}
            name="Cases"
          />
          <Tooltip content={<PointTooltip />} cursor={{ strokeDasharray: "3 3", opacity: 0.4 }} />
          <Scatter
            name="Allegations received"
            data={allegations}
            fill={ALLEGATIONS_COLOR}
            shape={makeDot(ALLEGATIONS_COLOR)}
            isAnimationActive={false}
          >
            <LabelList dataKey="label" position="top" offset={10} fontSize={11} fill={ALLEGATIONS_COLOR} />
          </Scatter>
          <Scatter
            name="Findings of misconduct"
            data={findings}
            fill={FINDINGS_COLOR}
            shape={makeDot(FINDINGS_COLOR)}
            isAnimationActive={false}
          >
            <ErrorBar dataKey="range" direction="y" width={6} stroke={FINDINGS_COLOR} strokeWidth={2} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-xs text-foreground/50 mt-3 mb-0">
        Gaps are years with no figure found. Filled points come from NSF OIG&rsquo;s own reports,
        hollow points from secondary sources citing them; the bar on 2014 spans sources that
        disagree. Figures are provisional.{" "}
        <Link
          href={NSF_OIG_DATA_PATH}
          className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
        >
          Sources and notes for every point
        </Link>
        .
      </p>
    </figure>
  );
}
