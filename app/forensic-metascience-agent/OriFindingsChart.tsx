"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";

const BAR_COLOR = "#1a5276";
const PARTIAL_BAR_COLOR = "#5ba3d0";

export interface OriYearDatum {
  year: number;
  findings: number;
  partial: boolean;
}

interface OriFindingsChartProps {
  data: OriYearDatum[];
}

/** Direct labels only where the story is: the 1995 peak and the recent collapse. */
const LABELED_YEARS = new Set([1995, 2024, 2025, 2026]);

export function OriFindingsChart({ data }: OriFindingsChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: LABELED_YEARS.has(d.year) ? d.findings : undefined,
  }));
  return (
    <figure className="mx-auto w-full md:w-4/5 border border-black rounded-lg bg-white p-6 my-8">
      <figcaption className="mb-3">
        <span className="block text-lg font-semibold text-foreground">
          ORI findings of research misconduct per year
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ left: 0, right: 10, top: 18, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis
            dataKey="year"
            type="category"
            interval="preserveStartEnd"
            minTickGap={20}
            tickMargin={6}
            fontSize={12}
            tickLine={false}
          />
          <YAxis allowDecimals={false} fontSize={12} width={32} />
          <Tooltip
            formatter={(v: number, _name, item) => [
              `${v.toLocaleString()}${(item?.payload as OriYearDatum)?.partial ? " (partial year)" : ""}`,
              "Findings",
            ]}
            labelFormatter={(l) => `Year ${l}`}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Bar dataKey="findings" radius={[2, 2, 0, 0]}>
            {chartData.map((d) => (
              <Cell key={d.year} fill={d.partial ? PARTIAL_BAR_COLOR : BAR_COLOR} />
            ))}
            <LabelList dataKey="label" position="top" fontSize={11} fill={BAR_COLOR} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-foreground/50 mt-3 mb-0">
        Sources:{" "}
        <a
          href="https://www.medschool.umaryland.edu/media/som/offices-of-the-dean/office-of-research/documents/charrow_lecture_handout.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
        >
          HHS OGC compilation of the ORI case-summary database
        </a>{" "}
        (1994&ndash;2005),{" "}
        <a
          href="https://ori.hhs.gov/images/ddblock/ORI%20Data%20Graphs%202006-2015.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
        >
          ORI data graphs
        </a>{" "}
        (2006&ndash;2015), and{" "}
        <a
          href="https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=%22Findings+of+Research+Misconduct%22&conditions%5Btype%5D%5B%5D=NOTICE&conditions%5Bagencies%5D%5B%5D=health-and-human-services-department&order=newest"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
        >
          Federal Register misconduct-finding notice counts
        </a>{" "}
        (2016&ndash;2026).
      </p>
    </figure>
  );
}
