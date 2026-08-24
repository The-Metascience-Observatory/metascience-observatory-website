"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  Legend,
} from "recharts";

const NAVY = "#1a5276";
const GRAY = "#94a3b8";

const LABELED_YEARS = new Set([2021, 2022, 2023, 2024]);
const SOURCE_DOI = "https://doi.org/10.1371/journal.pbio.3003152";

export interface NhanesYearDatum {
  year: number;
  papers: number;
  china: number;
  other: number;
  biobank: number;
  partial: boolean;
}

export interface NhanesFormulaicData {
  source: { citation: string; doi: string; note: string };
  byYear: NhanesYearDatum[];
}

function SourceNote({ extra }: { extra?: string }) {
  return (
    <p className="text-xs text-foreground/50 mt-3 mb-0">
      {extra ? `${extra} ` : null}
      Source:{" "}
      <a
        href={SOURCE_DOI}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
      >
        Suchak et al., PLOS Biology 2025
      </a>
      .
    </p>
  );
}

function ExplosionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: NhanesYearDatum }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded border border-border bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">
        {label}
        {row.partial ? " (through 9 Oct)" : ""}
      </p>
      <p className="text-foreground/80 mt-1">China: {row.china.toLocaleString()}</p>
      <p className="text-foreground/80">Other: {row.other.toLocaleString()}</p>
      <p className="text-foreground mt-1 font-medium">Total: {row.papers.toLocaleString()}</p>
    </div>
  );
}

function ExplosionChart({ data }: { data: NhanesYearDatum[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: LABELED_YEARS.has(d.year) ? d.papers : undefined,
  }));
  return (
    <figure className="mx-auto w-full md:w-4/5 border border-black rounded-lg bg-white p-6 my-8">
      <figcaption className="mb-3">
        <span className="block text-lg font-semibold text-foreground">
          Formulaic single-factor NHANES papers per year
        </span>
        <span className="block text-sm text-foreground/70 mt-1">
          NHANES = National Health and Nutrition Examination Survey
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ left: 0, right: 12, top: 28, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis
            dataKey="year"
            type="category"
            interval="preserveStartEnd"
            minTickGap={16}
            tickMargin={6}
            fontSize={12}
            tickLine={false}
            tickFormatter={(y: number) => (y === 2024 ? "2024*" : String(y))}
          />
          <YAxis allowDecimals={false} fontSize={12} width={36} domain={[0, 220]} ticks={[0, 50, 100, 150, 200]} />
          <Tooltip content={<ExplosionTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-foreground/70">
                {value === "china" ? "First-listed affiliation in China" : "Other"}
              </span>
            )}
          />
          <Bar dataKey="other" stackId="a" name="other" fill={GRAY} />
          <Bar dataKey="china" stackId="a" name="china" fill={NAVY} radius={[2, 2, 0, 0]}>
            <LabelList dataKey="label" position="top" fontSize={11} fill={NAVY} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <SourceNote extra="2024* is through 9 October. China/other is coded from the first-listed author affiliation in S1 Table A." />
    </figure>
  );
}

export function NhanesFormulaicCharts({ data }: { data: NhanesFormulaicData }) {
  return <ExplosionChart data={data.byYear} />;
}
