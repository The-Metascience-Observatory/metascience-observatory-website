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
} from "recharts";

export interface ArticleTypeBar {
  label: string;
  total: number;
  treatment: number;
  pct: string;
  totalLabel?: string;
}

const formatLabel = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* eslint-disable @typescript-eslint/no-explicit-any */
const SingleLineLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width + 6}
      y={y + 16}
      fontSize={11}
      fill="#374151"
      dominantBaseline="middle"
      textAnchor="start"
    >
      {value}
    </text>
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export function ScreeningFunnelChart({
  data,
  totalArticles,
  totalTreatment,
  onBarClick,
}: {
  data: ArticleTypeBar[];
  totalArticles: number;
  totalTreatment: number;
  onBarClick?: (sourceFolder: string) => void;
}) {
  const barHeight = 32;
  const chartHeight = data.length * (barHeight + 14) + 60;

  return (
    <div className="border border-border rounded-lg bg-white p-6 mb-8">
      <div className="flex flex-wrap items-baseline gap-x-4 mb-1">
        <h2 className="text-lg font-semibold">
          Long COVID Papers by Article Type (n = {totalArticles.toLocaleString()})
        </h2>
        <div className="flex items-center gap-4 text-sm text-foreground/70">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#7cb5ec" }} />
            All papers ({totalArticles.toLocaleString()})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#1a5276" }} />
            Studies treatment ({totalTreatment.toLocaleString()})
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 10, right: 250, top: 5, bottom: 5 }}
          barGap={-barHeight}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => v.toLocaleString()}
            fontSize={12}
            label={{ value: "Number of papers", position: "insideBottom", offset: -2, fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={200}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatLabel}
            interval={0}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              name === "total" ? "All papers" : "Studies treatment",
            ]}
            labelFormatter={formatLabel}
            labelStyle={{ fontWeight: 600 }}
          />
          <Bar
            dataKey="total"
            fill="#7cb5ec"
            radius={[0, 4, 4, 0]}
            barSize={barHeight}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={onBarClick ? (_: unknown, index: number) => onBarClick(data[index].label) : undefined}
          >
            <LabelList
              dataKey="totalLabel"
              content={<SingleLineLabel />}
            />
          </Bar>
          <Bar
            dataKey="treatment"
            fill="#1a5276"
            radius={[0, 4, 4, 0]}
            barSize={barHeight}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={onBarClick ? (_: unknown, index: number) => onBarClick(data[index].label) : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
