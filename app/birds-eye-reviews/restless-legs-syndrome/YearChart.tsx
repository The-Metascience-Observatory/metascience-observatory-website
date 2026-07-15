"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/** Vertical "Trials by Year" histogram. Fills the full min..max year range so
 *  gaps read as zero (a true temporal distribution). Driven by the caller's
 *  currently-filtered trial set, so it reacts to the page filters. */
export function YearChart({ years }: { years: number[] }) {
  const valid = years.filter((y) => Number.isFinite(y) && y > 1900 && y < 2100);
  if (valid.length === 0) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const counts = new Map<number, number>();
  for (const y of valid) counts.set(y, (counts.get(y) ?? 0) + 1);

  const data: { year: number; count: number }[] = [];
  for (let y = min; y <= max; y++) data.push({ year: y, count: counts.get(y) ?? 0 });

  return (
    <div className="border border-border rounded-lg bg-white p-6 mb-8">
      <h2 className="text-lg font-semibold mb-3">
        Trials by Year (n = {valid.length.toLocaleString()})
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
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
            formatter={(v: number) => [v.toLocaleString(), "Trials"]}
            labelFormatter={(l) => `Year ${l}`}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Bar dataKey="count" fill="#1a5276" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
