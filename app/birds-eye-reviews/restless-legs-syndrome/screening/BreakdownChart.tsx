"use client";

import { useState, useEffect } from "react";
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
const SELECT_OUTLINE = "#4b5563"; // dark grey rectangle drawn around the selected bar

interface TiledSegmentProps {
  x: number; y: number; width: number; height: number;
  payload: Record<string, unknown>; segKey: string; leading: boolean;
  isLast?: boolean; selectedKey?: string;
  [key: string]: unknown;
}
function TiledSegment(props: TiledSegmentProps) {
  const { x, y, width, height, payload, segKey, leading, isLast, selectedKey } = props;
  const value = Number(payload?.[segKey] ?? 0);
  const hasSelection = selectedKey != null && selectedKey !== "";
  const isSelected = hasSelection && payload?.key === selectedKey;
  const dimmed = hasSelection && !isSelected;

  const lines: React.ReactNode[] = [];
  if (value > 0 && width > 0) {
    const per = width / value;
    for (let k = leading ? 0 : 1; k < value; k++) {
      const lx = x + k * per;
      lines.push(
        <line key={k} x1={lx} x2={lx} y1={y} y2={y + height}
          stroke="#fff" strokeWidth={1.5} pointerEvents="none"
          opacity={dimmed ? 0.5 : 1} />
      );
    }
  }

  // Dark-grey outline around the whole selected bar. The left edge is drawn by the
  // first segment (at the axis origin) and the right edge by the last segment (at the
  // bar's end) regardless of their own value; top/bottom run along each filled
  // segment, so the collinear pieces compose one clean rectangle with no inner lines.
  const outline: React.ReactNode[] = [];
  if (isSelected) {
    const ol = (key: string, x1: number, y1: number, x2: number, y2: number) => (
      <line key={key} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={SELECT_OUTLINE} strokeWidth={2} pointerEvents="none" />
    );
    if (width > 0) {
      outline.push(ol("t", x, y, x + width, y));
      outline.push(ol("b", x, y + height, x + width, y + height));
    }
    if (!leading) outline.push(ol("l", x, y, x, y + height));            // first segment → left edge
    if (isLast) outline.push(ol("r", x + width, y, x + width, y + height)); // last segment → right edge
  }

  const rectProps = dimmed ? { ...props, fillOpacity: 0.25 } : props;
  return (
    <g>
      <Rectangle {...rectProps} />
      {lines}
      {outline}
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
  selectedKey,
}: {
  title: string;
  breakdown: Record<string, number> | Record<string, Record<string, number>>;
  labels?: Record<string, string>;
  colors?: Record<string, string>;
  onBarClick?: (key: string) => void;
  clickHint?: string;
  segments?: Segment[];
  /** When set, keep every bar visible but lighten the others and outline this one. */
  selectedKey?: string;
}) {
  const prettyLabel = (key: string) =>
    labels?.[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // On narrow screens a fixed 220px left label column would swallow the whole
  // chart width, collapsing the bars (and their per-study dividers) to nothing.
  // There we drop the label column and render each category name *above* its bar.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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
  // Mobile rows need extra vertical room for the stacked label sitting above each bar.
  const labelRow = isMobile ? 20 : 0;
  const chartHeight = data.length * (barHeight + 14 + labelRow) + 50;

  // Category-name (YAxis) tick. Clickable when onBarClick is set, so clicking the
  // ingredient name selects it just like clicking its bar. On mobile the name sits
  // above-left of its bar (no fixed label column); on desktop it's right-aligned in
  // the 220px column. The tick payload carries the pretty label, so map back to key.
  const labelToKey: Record<string, string> = {};
  for (const d of data) labelToKey[d.label as string] = d.key as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CategoryTick = (p: any) => {
    const label = p.payload?.value as string;
    const key = labelToKey[label];
    const isSelected = selectedKey != null && selectedKey !== "" && key === selectedKey;
    const clickable = !!onBarClick;
    const common = {
      fontSize: 12,
      fontWeight: isSelected ? 700 : 500,
      fill: "#374151",
      cursor: clickable ? "pointer" : undefined,
      onClick: clickable && key != null ? () => onBarClick!(key) : undefined,
      className: clickable ? "hover:underline" : undefined,
    } as const;
    return isMobile ? (
      <text x={p.x} y={p.y - barHeight / 2 - 6} textAnchor="start" {...common}>{label}</text>
    ) : (
      <text x={p.x} y={p.y} dy="0.355em" textAnchor="end" {...common}>{label}</text>
    );
  };

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
            width={isMobile ? 1 : 220}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={<CategoryTick />}
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
                  shape={(p: any) => <TiledSegment {...p} segKey={seg.key} leading={si > 0} isLast={isLast} selectedKey={selectedKey} />}
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
              {data.map((d) => {
                const hasSelection = selectedKey != null && selectedKey !== "";
                const isSelected = hasSelection && d.key === selectedKey;
                return (
                  <Cell
                    key={d.key}
                    fill={d.color}
                    fillOpacity={hasSelection && !isSelected ? 0.25 : 1}
                    stroke={isSelected ? SELECT_OUTLINE : undefined}
                    strokeWidth={isSelected ? 2 : undefined}
                  />
                );
              })}
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
