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
  LineChart,
  Line,
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

function formatFold(n: number): string {
  if (n >= 10) return `${Math.round(n)}×`;
  return `${n.toFixed(1).replace(/\.0$/, "")}×`;
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

function IndexedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: IndexedRow; dataKey: string; value: number }>;
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
      <p className="mt-1" style={{ color: NAVY }}>
        Formulaic NHANES papers: {row.papers.toLocaleString()} ({formatFold(row.nhanesFold)} vs 2014)
      </p>
      <p style={{ color: GRAY }}>
        PubMed “biobank”: {row.biobank.toLocaleString()} ({formatFold(row.biobankFold)} vs 2014)
      </p>
    </div>
  );
}

function ExplosionChart({ data }: { data: NhanesYearDatum[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: LABELED_YEARS.has(d.year) ? d.papers : undefined,
  }));
  return (
    <figure className="border border-black rounded-lg bg-white p-6 my-8">
      <figcaption className="mb-3">
        <span className="block text-lg font-semibold text-foreground">
          Formulaic single-factor NHANES papers per year
        </span>
        <span className="block text-sm text-foreground/70 mt-1">
          341 papers, each testing one predictor against one health outcome. An average of 4 per year
          from 2014–2021; 190 in 2024* through 9 October. ChatGPT launched November 2022.
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

interface IndexedRow extends NhanesYearDatum {
  nhanesFold: number;
  biobankFold: number;
  nhanesFoldLabel?: string;
  biobankFoldLabel?: string;
}

function IndexedChart({ data }: { data: NhanesYearDatum[] }) {
  const baseNhanes = data.find((d) => d.year === 2014)?.papers ?? 2;
  const baseBiobank = data.find((d) => d.year === 2014)?.biobank ?? 1120;
  const chartData: IndexedRow[] = data.map((d) => {
    const nhanesFold = d.papers / baseNhanes;
    const biobankFold = d.biobank / baseBiobank;
    return {
      ...d,
      nhanesFold,
      biobankFold,
      nhanesFoldLabel: d.year === 2024 ? formatFold(nhanesFold) : undefined,
      biobankFoldLabel: d.year === 2024 ? formatFold(biobankFold) : undefined,
    };
  });
  return (
    <figure className="border border-black rounded-lg bg-white p-6 my-8">
      <figcaption className="mb-3">
        <span className="block text-lg font-semibold text-foreground">
          Not just more health-data papers: 95× vs 5×
        </span>
        <span className="block text-sm text-foreground/70 mt-1">
          Formulaic NHANES papers versus every PubMed hit for “biobank”, both indexed to 2014. The
          wider literature grew; this workflow exploded.
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ left: 8, right: 16, top: 24, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
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
          <YAxis
            type="number"
            domain={[0, 120]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickFormatter={(v: number) => (v === 0 ? "0" : `${v}×`)}
            fontSize={12}
            width={44}
          />
          <Tooltip content={<IndexedTooltip />} />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-foreground/70">
                {value === "nhanesFold"
                  ? "Formulaic NHANES papers"
                  : "PubMed papers on “biobank”"}
              </span>
            )}
          />
          <Line
            type="linear"
            dataKey="biobankFold"
            name="biobankFold"
            stroke={GRAY}
            strokeWidth={2}
            dot={{ r: 3, fill: GRAY, stroke: GRAY }}
            activeDot={{ r: 5 }}
          >
            <LabelList dataKey="biobankFoldLabel" position="top" fontSize={11} fill={GRAY} />
          </Line>
          <Line
            type="linear"
            dataKey="nhanesFold"
            name="nhanesFold"
            stroke={NAVY}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: NAVY, stroke: NAVY }}
            activeDot={{ r: 5 }}
          >
            <LabelList dataKey="nhanesFoldLabel" position="top" fontSize={11} fill={NAVY} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
      <SourceNote extra="Both series are through 9 October 2024 (2024*). Indexed to 2014 = 1×." />
    </figure>
  );
}

export function NhanesFormulaicCharts({ data }: { data: NhanesFormulaicData }) {
  return (
    <>
      <ExplosionChart data={data.byYear} />
      <IndexedChart data={data.byYear} />
    </>
  );
}
