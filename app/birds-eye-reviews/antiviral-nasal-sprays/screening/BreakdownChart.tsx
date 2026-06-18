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
  Rectangle,
} from "recharts";

const DEFAULT_COLOR = "#1a5276";
const MUTED_COLOR = "#94a3b8";

/** A stacked segment definition: which field to read, its legend label and color. */
export type Segment = { key: string; label: string; color: string };

/** Bar segment that also draws thin vertical dividers at each study boundary, so
 *  every individual study within a (stacked) bar reads as its own cell. The
 *  segment's width is linear in its study count, so per-study width = width/value.
 *  Renders the default Rectangle (keeps fill, radius, click + hover) then overlays
 *  non-interactive divider lines. `leading` adds a divider at the segment's left
 *  edge too (the boundary with the previous segment) so every study is bounded. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TiledSegment(props: any) {
  const { x, y, width, height, payload, segKey, leading } = props;
  const value = Number(payload?.[segKey] ?? 0);
  const lines: React.ReactNode[] = [];
  if (value > 0 && width > 0) {
    const per = width / value;
    for (let k = leading ? 0 : 1; k < value; k++) {
      const lx = x + k * per;
      lines.push(
        <line key={k} x1={lx} x2={lx} y1={y} y2={y + height}
          stroke="#fff" strokeWidth={1.5} pointerEvents="none" />
      );
    }
  }
  return (
    <g>
      <Rectangle {...props} />
      {lines}
    </g>
  );
}

/** Full-row clickable background so the whole horizontal band (not just the bar)
 *  filters on click. Recharts clones this per row with x/y/width/height/index;
 *  we expand it vertically to cover the inter-bar gap (the gray hover band). */
function RowBackground(props: {
  x?: number; y?: number; width?: number; height?: number; index?: number;
  gap?: number; onPick?: (i: number) => void;
}) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, gap = 0, onPick } = props;
  return (
    <rect
      x={x}
      y={y - gap / 2}
      width={width}
      height={height + gap}
      fill="transparent"
      cursor="pointer"
      onClick={() => onPick?.(index)}
    />
  );
}

/** Tooltip for stacked (segmented) bars: lists each segment's count and its
 *  share of that bar's total (favors treatment / control / no difference / …). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SegmentTooltip({ active, payload, segments }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as Record<string, number | string>;
  const total = Number(row.total ?? 0);
  if (!total) return null;
  return (
    <div className="rounded border border-border bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold mb-1">
        {row.label} — {total.toLocaleString()} trial{total === 1 ? "" : "s"}
      </div>
      {(segments as Segment[])
        .map((seg) => ({ seg, n: Number(row[seg.key] ?? 0) }))
        .filter((x) => x.n > 0)
        .map(({ seg, n }) => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-foreground/70">{seg.label}</span>
            <span className="ml-auto tabular-nums text-foreground/90">
              {n} ({Math.round((n / total) * 100)}%)
            </span>
          </div>
        ))}
    </div>
  );
}

/** Generic horizontal bar chart over a breakdown, with optional click-to-filter.
 *
 *  Two modes:
 *   - Simple (default): `breakdown` is {key: count}, one bar per key.
 *   - Stacked: pass `segments` and make `breakdown` {key: {segKey: count}}; each
 *     bar is split into the given segments (color-coded) with a legend. Used e.g.
 *     to split "Trials by Ingredient" by result direction (favors treatment /
 *     control / inconclusive).
 */
export function BreakdownChart({
  title,
  breakdown,
  labels,
  colors,
  onBarClick,
  clickHint,
  segments,
}: {
  title: string;
  breakdown: Record<string, number> | Record<string, Record<string, number>>;
  labels?: Record<string, string>;
  colors?: Record<string, string>;
  onBarClick?: (key: string) => void;
  clickHint?: string;
  segments?: Segment[];
}) {
  const prettyLabel = (key: string) =>
    labels?.[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const barHeight = 26;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = segments
    ? Object.entries(breakdown as Record<string, Record<string, number>>)
        .map(([key, segCounts]) => {
          const total = segments.reduce((s, seg) => s + (segCounts[seg.key] || 0), 0);
          const row: Record<string, number | string> = { key, label: prettyLabel(key), total };
          for (const seg of segments) row[seg.key] = segCounts[seg.key] || 0;
          return row;
        })
        .sort((a, b) => (b.total as number) - (a.total as number))
    : Object.entries(breakdown as Record<string, number>)
        .map(([key, count]) => ({
          key,
          label: prettyLabel(key),
          count,
          color: colors?.[key] ?? (key === "unclassified" || key === "unclear" ? MUTED_COLOR : DEFAULT_COLOR),
        }))
        .sort((a, b) => b.count - a.count);

  const total = data.reduce((s, d) => s + (segments ? (d.total as number) : (d.count as number)), 0);
  const chartHeight = data.length * (barHeight + 14) + 50;

  const rowBg = onBarClick
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => (
        <RowBackground
          {...(p as { x?: number; y?: number; width?: number; height?: number; index?: number })}
          gap={14}
          onPick={(i) => onBarClick(data[i].key)}
        />
      )
    : undefined;

  return (
    <div className="border border-border rounded-lg bg-white p-6 mb-8">
      <div className="flex flex-wrap items-baseline gap-x-4 mb-2">
        <h2 className="text-lg font-semibold">
          {title} (n = {total.toLocaleString()})
        </h2>
        {onBarClick && clickHint && (
          <p className="basis-full text-sm text-foreground/60">{clickHint}</p>
        )}
      </div>

      {/* Legend (stacked mode only) */}
      {segments && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          {segments.map((seg) => (
            <span key={seg.key} className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 60, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => v.toLocaleString()} fontSize={12} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={220}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          {segments ? (
            <Tooltip content={<SegmentTooltip segments={segments} />} />
          ) : (
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), "Studies"]}
              labelStyle={{ fontWeight: 600 }}
            />
          )}

          {segments ? (
            segments.map((seg, si) => {
              const isLast = si === segments.length - 1;
              return (
                <Bar
                  key={seg.key}
                  dataKey={seg.key}
                  name={seg.label}
                  stackId="a"
                  fill={seg.color}
                  barSize={barHeight}
                  radius={isLast ? [0, 4, 4, 0] : undefined}
                  cursor={onBarClick ? "pointer" : undefined}
                  onClick={onBarClick ? (_: unknown, index: number) => onBarClick(data[index].key) : undefined}
                  // Custom shape draws the segment plus per-study divider lines.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  shape={(p: any) => <TiledSegment {...p} segKey={seg.key} leading={si > 0} />}
                  // Row background only on the first segment so it isn't drawn N times.
                  background={si === 0 ? rowBg : undefined}
                >
                  {isLast && (
                    <LabelList
                      dataKey="total"
                      position="right"
                      fontSize={12}
                      fill="#374151"
                      formatter={(v: number) => v.toLocaleString()}
                    />
                  )}
                </Bar>
              );
            })
          ) : (
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              barSize={barHeight}
              cursor={onBarClick ? "pointer" : undefined}
              onClick={onBarClick ? (_: unknown, index: number) => onBarClick(data[index].key) : undefined}
              background={rowBg}
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
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
