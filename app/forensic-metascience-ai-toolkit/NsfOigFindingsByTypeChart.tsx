"use client";

import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { NsfOigFindingsByTypeDatum } from "./nsfOigData";

const NSF_OIG_DATA_PATH = "/forensic-metascience-ai-toolkit/nsf-oig-data";
const PLAGIARISM_COLOR = "#1a5276";
const FF_COLOR = "#5ba3d0";
const AXIS_COLOR = "#000000";
const AXIS_STYLE = {
  stroke: AXIS_COLOR,
  tick: { fill: AXIS_COLOR },
  axisLine: { stroke: AXIS_COLOR },
  tickLine: { stroke: AXIS_COLOR },
};
const LINK_CLASS = "underline decoration-foreground/30 underline-offset-2 hover:text-foreground";

interface NsfOigFindingsByTypeChartProps {
  data: NsfOigFindingsByTypeDatum[];
  /** Off on the sources page itself, whose intro already cites the source and which the link would point to. */
  showMoreInfoLink?: boolean;
}

function LegendSwatch({ color }: { color: string }) {
  return (
    <svg width="12" height="12" aria-hidden className="inline-block align-middle mr-1.5">
      <rect width="12" height="12" fill={color} />
    </svg>
  );
}

export function NsfOigFindingsByTypeChart({
  data,
  showMoreInfoLink = true,
}: NsfOigFindingsByTypeChartProps) {
  const source = data[0];
  return (
    <figure className="mx-auto w-full md:w-4/5 border border-black rounded-lg bg-white p-6 my-8">
      <figcaption className="mb-3">
        <span className="block text-lg font-semibold text-foreground">
          NSF findings of research misconduct per year, by type
        </span>
        <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">
          <span>
            <LegendSwatch color={PLAGIARISM_COLOR} />
            Plagiarism
          </span>
          <span>
            <LegendSwatch color={FF_COLOR} />
            Fabrication or falsification
          </span>
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ left: 0, right: 10, top: 18, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis
            {...AXIS_STYLE}
            dataKey="year"
            type="category"
            interval="preserveStartEnd"
            minTickGap={10}
            tickMargin={6}
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            {...AXIS_STYLE}
            allowDecimals={false}
            domain={[0, 30]}
            ticks={[0, 5, 10, 15, 20, 25, 30]}
            fontSize={12}
            width={32}
          />
          <Tooltip
            labelFormatter={(l) => `Year ${l}`}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Bar dataKey="plagiarism" name="Plagiarism" stackId="type" fill={PLAGIARISM_COLOR} />
          <Bar
            dataKey="fabricationFalsification"
            name="Fabrication or falsification"
            stackId="type"
            fill={FF_COLOR}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      {showMoreInfoLink && (
        <p className="text-xs text-foreground/50 mt-3 mb-0">
          Source: NSF Office of Inspector General data, via{" "}
          <a href={source?.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            Mervis, <em>Science</em> (2017)
          </a>
          . We created an additional page with more info on OIG findings{" "}
          <Link href={NSF_OIG_DATA_PATH} className={LINK_CLASS}>
            here
          </Link>
          .
        </p>
      )}
    </figure>
  );
}
