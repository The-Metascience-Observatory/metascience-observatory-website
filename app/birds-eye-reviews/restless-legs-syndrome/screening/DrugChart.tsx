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

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DrugChart({
  agents,
  singletons,
  namedTotal,
  distinct,
  onBarClick,
}: {
  agents: { agent: string; count: number }[];
  singletons: string[];
  namedTotal: number;
  distinct: number;
  onBarClick?: (agent: string) => void;
}) {
  const data = agents
    // keep the raw (canonical) agent key alongside the display label so a click
    // can filter the table on the same value the bar represents
    .map((a) => ({ agent: a.agent, label: titleCase(a.agent), count: a.count }))
    .sort((a, b) => b.count - a.count);

  const barHeight = 24;
  const chartHeight = data.length * (barHeight + 12) + 50;

  return (
    <div className="border border-border rounded-lg bg-white p-6 mb-8">
      <h2 className="text-lg font-semibold mb-1">Most-Studied Compounds</h2>
      <p className="text-sm text-foreground/60 mb-4">
        {distinct.toLocaleString()} distinct compounds across {namedTotal.toLocaleString()} treatment studies.
        The {data.length} compounds studied by two or more papers are shown below.
        {onBarClick && " Click a bar to filter the table below to that compound."}
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => v.toLocaleString()} fontSize={12} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={260}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), "Studies"]}
            labelStyle={{ fontWeight: 600 }}
          />
          <Bar
            dataKey="count"
            fill="#1a5276"
            radius={[0, 4, 4, 0]}
            barSize={barHeight}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={onBarClick ? (_: unknown, index: number) => onBarClick(data[index].agent) : undefined}
          >
            <LabelList
              dataKey="count"
              position="right"
              fontSize={12}
              fill="#374151"
              formatter={(v: number) => v.toLocaleString()}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {singletons.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <div className="text-foreground font-medium uppercase tracking-wide text-[10px] mb-2">
            Studied by a single paper ({singletons.length.toLocaleString()} compounds)
            {onBarClick && (
              <span className="normal-case tracking-normal text-foreground/40 font-normal">
                {" "}— click a compound to filter the table below to its study.
              </span>
            )}
          </div>
          <p className="text-xs text-foreground/60 leading-relaxed">
            {singletons.map((s, i) => (
              <span key={s}>
                {i > 0 && " · "}
                {onBarClick ? (
                  <button
                    type="button"
                    onClick={() => onBarClick(s)}
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {titleCase(s)}
                  </button>
                ) : (
                  titleCase(s)
                )}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
