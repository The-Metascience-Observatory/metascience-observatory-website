"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

interface FunnelStep {
  label: string;
  count: number;
  color: string;
}

const BAR_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#14b8a6", // teal
  "#22c55e", // green
];

export function ScreeningFunnelChart({ data }: { data: FunnelStep[] }) {
  return (
    <div className="border border-border rounded-lg bg-white p-6 mb-8">
      <h2 className="text-lg font-semibold mb-1">Screening Funnel</h2>
      <p className="text-sm text-foreground/60 mb-4">
        Progressive filtering from initial search to extracted trials
      </p>
      <ResponsiveContainer width="100%" height={data.length * 56 + 20}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 10, right: 80, top: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => v.toLocaleString()}
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            fontSize={13}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), "Articles"]}
            labelStyle={{ fontWeight: 600 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={entry.color || BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              formatter={(v: number) => v.toLocaleString()}
              style={{ fontSize: 13, fontWeight: 600, fill: "#374151" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
