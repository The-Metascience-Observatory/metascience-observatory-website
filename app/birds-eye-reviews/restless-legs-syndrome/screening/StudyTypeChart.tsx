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
  Cell,
} from "recharts";

const LABELS: Record<string, string> = {
  rct: "Randomized controlled trial",
  non_randomized_trial: "Non-randomized trial",
  human_challenge: "Human challenge trial",
  observational: "Observational (human)",
  case_series: "Case series / report",
  in_vitro: "In vitro (cell/virucidal assay)",
  animal_in_vivo: "Animal model (in vivo)",
  ex_vivo: "Ex vivo / tissue model",
  formulation_pk: "Formulation / pharmacokinetics",
  in_silico: "In silico / modeling",
  other: "Other",
  unclear: "Unclear",
};

const CLINICAL_COLOR = "#1a5276";
const PRECLINICAL_COLOR = "#7cb5ec";
const OTHER_COLOR = "#94a3b8";

function prettyLabel(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StudyTypeChart({
  breakdown,
  groups,
  onBarClick,
}: {
  breakdown: Record<string, number>;
  groups: { clinical: string[]; preclinical: string[] };
  onBarClick?: (designKey: string) => void;
}) {
  const clinical = new Set(groups.clinical);
  const preclinical = new Set(groups.preclinical);
  const colorFor = (key: string) =>
    clinical.has(key) ? CLINICAL_COLOR : preclinical.has(key) ? PRECLINICAL_COLOR : OTHER_COLOR;

  const data = Object.entries(breakdown)
    .map(([key, count]) => ({ key, label: prettyLabel(key), count, color: colorFor(key) }))
    .sort((a, b) => b.count - a.count);
  const total = data.reduce((s, d) => s + d.count, 0);

  const barHeight = 26;
  const chartHeight = data.length * (barHeight + 14) + 50;

  return (
    <div className="border border-border rounded-lg bg-white p-6 mb-8">
      <div className="flex flex-wrap items-baseline gap-x-4 mb-4">
        <h2 className="text-lg font-semibold">
          Treatment Studies by Study Design (n = {total.toLocaleString()})
        </h2>
        <div className="flex items-center gap-4 text-sm text-foreground/70">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CLINICAL_COLOR }} />
            Clinical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: PRECLINICAL_COLOR }} />
            Preclinical
          </span>
        </div>
        {onBarClick && (
          <p className="basis-full text-sm text-foreground/60">
            Click a bar to filter the table below to that study design.
          </p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 60, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => v.toLocaleString()} fontSize={12} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={200}
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
            radius={[0, 4, 4, 0]}
            barSize={barHeight}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={onBarClick ? (_: unknown, index: number) => onBarClick(data[index].key) : undefined}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
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
    </div>
  );
}
